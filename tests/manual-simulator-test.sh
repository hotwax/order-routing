#!/usr/bin/env bash
# Read-only preflight for the current sim-routing API. It never calls an OMS URL and never mutates
# simulation data. The bearer is read silently when OMS_BEARER is not already present.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  SIM_URL=https://simulation.example \
  PRODUCT_STORE_ID=STORE_ID \
  ROUTING_GROUP_ID=OPTIONAL_GROUP_ID \
  PWA_ORIGIN=https://pwa.example \
  NEGATIVE_PRODUCT_STORE_ID=OPTIONAL_UNAUTHORIZED_STORE \
  bash tests/manual-simulator-test.sh

Required: SIM_URL, PRODUCT_STORE_ID, and an OMS bearer supplied through OMS_BEARER or the silent
prompt. The script performs GET/OPTIONS requests only. Do not enable shell tracing (`set -x`).
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

: "${SIM_URL:?Set SIM_URL to the trusted simulation origin.}"
: "${PRODUCT_STORE_ID:?Set PRODUCT_STORE_ID to the release-test store.}"

if [[ -n "${ROUTING_GROUP_ID:-}" && ! "$ROUTING_GROUP_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "ROUTING_GROUP_ID contains unsupported path characters." >&2
  exit 2
fi

if [[ -z "${OMS_BEARER:-}" ]]; then
  if [[ ! -t 0 ]]; then
    echo "OMS_BEARER is required when stdin is not interactive." >&2
    exit 2
  fi
  read -r -s -p "OMS bearer (input hidden): " OMS_BEARER
  echo
fi
if [[ -z "$OMS_BEARER" ]]; then
  echo "A non-empty OMS bearer is required." >&2
  exit 2
fi
if [[ ! "$OMS_BEARER" =~ ^[A-Za-z0-9._~-]+$ ]]; then
  echo "The bearer contains unsupported characters." >&2
  exit 2
fi

SIM_ORIGIN="$(python3 - "$SIM_URL" <<'PY'
import sys
from urllib.parse import urlparse

raw = sys.argv[1].strip().rstrip("/")
parsed = urlparse(raw)
loopback = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
if parsed.scheme not in {"http", "https"} or not parsed.netloc:
    raise SystemExit("SIM_URL must be an absolute HTTP(S) origin.")
if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
    raise SystemExit("SIM_URL must be a bare origin without credentials, path, query, or fragment.")
if parsed.scheme != "https" and not (parsed.scheme == "http" and loopback):
    raise SystemExit("SIM_URL must use HTTPS except for loopback development.")
print(f"{parsed.scheme}://{parsed.netloc}")
PY
)"

API_ROOT="${SIM_ORIGIN}/rest/s1"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
BODY_FILE="${TMP_DIR}/body"
HEADER_FILE="${TMP_DIR}/headers"
AUTH_CONFIG="${TMP_DIR}/curl-auth.conf"
printf 'header = "Authorization: Bearer %s"\n' "$OMS_BEARER" > "$AUTH_CONFIG"
chmod 600 "$AUTH_CONFIG"
unset OMS_BEARER

log() {
  local line="$1"
  printf '%s\n' "$line"
  if [[ -n "${EVIDENCE_FILE:-}" ]]; then printf '%s\n' "$line" >> "$EVIDENCE_FILE"; fi
}

authenticated_get() {
  local label="$1"
  local path="$2"
  local shape="$3"
  shift 3
  local status
  status="$(curl --disable --silent --show-error --get \
    --config "$AUTH_CONFIG" \
    --output "$BODY_FILE" --dump-header "$HEADER_FILE" --write-out '%{http_code}' \
    --header "Accept: application/json" \
    "$@" "${API_ROOT}/${path}")"
  log "${status} GET /rest/s1/${path} (${label})"
  if [[ "$status" != 2* ]]; then
    echo "Preflight failed: ${label} returned HTTP ${status}. Response body was not printed." >&2
    return 1
  fi
  python3 - "$BODY_FILE" "$shape" <<'PY'
import json, sys

try:
    body = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception as error:
    raise SystemExit(f"Successful response was not valid JSON: {error}")
shape = sys.argv[2]
valid = {
    "array": isinstance(body, list),
    "object": isinstance(body, dict),
    "history": isinstance(body, list) or (isinstance(body, dict) and isinstance(body.get("simulationList"), list)),
    "variations": isinstance(body, dict) and isinstance(body.get("variationList", []), list),
}[shape]
if not valid:
    raise SystemExit(f"Successful response did not match expected {shape} shape.")
PY
}

log "Simulation API read-only preflight"
log "timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
log "origin=${SIM_ORIGIN}"
log "productStoreId=${PRODUCT_STORE_ID}"

authenticated_get "scoped routing groups" "order-routing/groups" "array" \
  --data-urlencode "productStoreId=${PRODUCT_STORE_ID}" --data-urlencode "pageSize=200"
authenticated_get "scoped simulation history" "sim-routing/brokeringSimulations" "history" \
  --data-urlencode "productStoreId=${PRODUCT_STORE_ID}" --data-urlencode "pageIndex=0" --data-urlencode "pageSize=1"

if [[ -n "${ROUTING_GROUP_ID:-}" ]]; then
  authenticated_get "raw routing group" "order-routing/groups/${ROUTING_GROUP_ID}/raw" "object"
  authenticated_get "saved variations" "sim-routing/variations" "variations" \
    --data-urlencode "parentRoutingGroupId=${ROUTING_GROUP_ID}"
fi

UNAUTH_STATUS="$(curl --disable --silent --show-error --get \
  --output "$BODY_FILE" --write-out '%{http_code}' \
  --header "Accept: application/json" \
  --data-urlencode "productStoreId=${PRODUCT_STORE_ID}" --data-urlencode "pageSize=1" \
  "${API_ROOT}/order-routing/groups")"
log "${UNAUTH_STATUS} GET /rest/s1/order-routing/groups (missing-bearer negative test)"
if [[ "$UNAUTH_STATUS" != "401" && "$UNAUTH_STATUS" != "403" ]]; then
  echo "Expected 401 or 403 without a bearer; received ${UNAUTH_STATUS}." >&2
  exit 1
fi

if [[ -n "${PWA_ORIGIN:-}" ]]; then
  CORS_STATUS="$(curl --disable --silent --show-error --request OPTIONS \
    --output "$BODY_FILE" --dump-header "$HEADER_FILE" --write-out '%{http_code}' \
    --header "Origin: ${PWA_ORIGIN}" \
    --header "Access-Control-Request-Method: GET" \
    --header "Access-Control-Request-Headers: authorization,content-type" \
    "${API_ROOT}/order-routing/groups")"
  log "${CORS_STATUS} OPTIONS /rest/s1/order-routing/groups (CORS preflight)"
  python3 - "$HEADER_FILE" "$PWA_ORIGIN" <<'PY'
import sys

headers = {}
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    if ":" in line:
        key, value = line.split(":", 1)
        headers[key.strip().lower()] = value.strip()
origin = headers.get("access-control-allow-origin", "")
allowed_headers = headers.get("access-control-allow-headers", "").lower()
if origin != sys.argv[2]:
    raise SystemExit(f"CORS did not echo the exact PWA origin: {origin!r}")
if "authorization" not in allowed_headers:
    raise SystemExit("CORS does not allow the Authorization header.")
PY
fi

if [[ -n "${NEGATIVE_PRODUCT_STORE_ID:-}" ]]; then
  NEGATIVE_STATUS="$(curl --disable --silent --show-error --get \
    --config "$AUTH_CONFIG" \
    --output "$BODY_FILE" --write-out '%{http_code}' \
    --header "Accept: application/json" \
    --data-urlencode "productStoreId=${NEGATIVE_PRODUCT_STORE_ID}" --data-urlencode "pageSize=5" \
    "${API_ROOT}/order-routing/groups")"
  log "${NEGATIVE_STATUS} GET /rest/s1/order-routing/groups (tenant/store negative test)"
  if [[ "$NEGATIVE_STATUS" == "2"* ]]; then
    python3 - "$BODY_FILE" <<'PY'
import json, sys
body = json.load(open(sys.argv[1], encoding="utf-8"))
if not isinstance(body, list) or body:
    raise SystemExit("Unauthorized store returned routing-group data.")
PY
  elif [[ "$NEGATIVE_STATUS" != "401" && "$NEGATIVE_STATUS" != "403" ]]; then
    echo "Expected 401/403 or an empty array for the unauthorized store; received ${NEGATIVE_STATUS}." >&2
    exit 1
  fi
fi

log "PASS: read-only API, missing-bearer, and requested optional negative checks completed."
log "No POST, PUT, PATCH, or DELETE request was made."
