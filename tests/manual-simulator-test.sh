#!/usr/bin/env bash
# Manual test for the brokering simulator tools wired into the runs-list inquiry agent.
#
# Usage:
#   1. Fill in the THREE env vars at the top.
#   2. Make sure the Mastra dev server is running (port 4111).
#   3. Run: bash tests/manual-simulator-test.sh
#   4. Watch the response body for `simulationRan: true` and a populated `impact` object.
#      Also watch the Mastra server log for `[runs-list-inquiry] tools wired:` listing the
#      three new tools and for the `[runBrokeringSimulation]` log line confirming the tool fired.

set -euo pipefail

# ─── FILL THESE IN ────────────────────────────────────────────────────────────
OMS_BASE_URL="${OMS_BASE_URL:-https://YOUR-DEV-OMS.example.com/api}"
AUTH_TOKEN="${AUTH_TOKEN:-YOUR_BEARER_TOKEN_HERE}"
PRODUCT_STORE_ID="${PRODUCT_STORE_ID:-STORE_NYC_01}"
# ─────────────────────────────────────────────────────────────────────────────

MASTRA_URL="${MASTRA_URL:-http://localhost:4111}"

# ─── Test 1: sync sim, single change (distance=100) ──────────────────────────
# This is the canonical "what if we tightened distance?" scenario. Expect the
# agent to call runBrokeringSimulation and narrate the impact.
echo "─── Test 1: sync simulation — distance=100 ──────────────────────────"
curl -sS -X POST "$MASTRA_URL/brokering-runs-list-inquiry" \
  -H "Content-Type: application/json" \
  -d @- <<JSON | python3 -m json.tool
{
  "prompt": "What would happen if we tightened the brokering distance to 100 miles for store ${PRODUCT_STORE_ID}?",
  "conversationHistory": [],
  "omsBaseUrl": "${OMS_BASE_URL}",
  "authToken": "${AUTH_TOKEN}",
  "pageCapabilityManifest": {
    "pageId": "brokering-runs-list",
    "route": "/brokering-runs",
    "visibleEntities": {
      "productStoreId": "${PRODUCT_STORE_ID}",
      "brokeringRuns": []
    },
    "editableTargets": [],
    "outputContract": {}
  }
}
JSON

echo
echo "─── Test 2: sweep mode — distance across [25, 50, 75, 100] ──────────"
# Sweep returns one variant per submitted value, sorted by round2Routed DESC.
curl -sS -X POST "$MASTRA_URL/brokering-runs-list-inquiry" \
  -H "Content-Type: application/json" \
  -d @- <<JSON | python3 -m json.tool
{
  "prompt": "Show me the effect on routing for ${PRODUCT_STORE_ID} if we tried distance values of 25, 50, 75, and 100 miles.",
  "conversationHistory": [],
  "omsBaseUrl": "${OMS_BASE_URL}",
  "authToken": "${AUTH_TOKEN}",
  "pageCapabilityManifest": {
    "pageId": "brokering-runs-list",
    "route": "/brokering-runs",
    "visibleEntities": {
      "productStoreId": "${PRODUCT_STORE_ID}",
      "brokeringRuns": []
    },
    "editableTargets": [],
    "outputContract": {}
  }
}
JSON

echo
echo "─── Test 3: safety-stock change ─────────────────────────────────────"
curl -sS -X POST "$MASTRA_URL/brokering-runs-list-inquiry" \
  -H "Content-Type: application/json" \
  -d @- <<JSON | python3 -m json.tool
{
  "prompt": "What if we raised brokering safety stock to 5 for store ${PRODUCT_STORE_ID}?",
  "conversationHistory": [],
  "omsBaseUrl": "${OMS_BASE_URL}",
  "authToken": "${AUTH_TOKEN}",
  "pageCapabilityManifest": {
    "pageId": "brokering-runs-list",
    "route": "/brokering-runs",
    "visibleEntities": {
      "productStoreId": "${PRODUCT_STORE_ID}",
      "brokeringRuns": []
    },
    "editableTargets": [],
    "outputContract": {}
  }
}
JSON
