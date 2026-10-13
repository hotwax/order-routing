// Pure helpers for the routing diagnostics dashboard. Every number on the dashboard is
// derived here from rows returned by the RoutingDash* DataDocuments, so the analysis
// can be unit tested without a backend.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Orders that never ship from a fulfillment location are left out of every routing and
// shipping measure: POS sales and pickup/handover methods.
export const EXCLUDED_SALES_CHANNELS = ["POS_SALES_CHANNEL"];
export const EXCLUDED_SHIPMENT_METHODS = ["POS_COMPLETED", "STOREPICKUP", "EMPLOYEE_LOCAL_PICKUP"];
export const FULFILLMENT_FACILITY_TYPES = ["RETAIL_STORE", "WAREHOUSE"];

export interface Week {
  // Monday 00:00 UTC, the same week boundary the stored OMS timestamps use.
  start: number;
  end: number;
  label: string;
}

export interface RuleWeekRow {
  routingRule?: string;
  routingRuleId?: string;
  routingGroupId?: string;
  orderRoutingId?: string;
  orderCount?: number | string;
  salesChannelEnumId?: string;
  shipmentMethodTypeId?: string;
  facilityTypeId?: string;
}

export interface ShippedWeekRow {
  facilityId?: string;
  shipmentMethodTypeId?: string;
  salesChannelEnumId?: string;
  shippedUnits?: number | string;
  shippedOrders?: number | string;
}

export interface InventoryRow {
  facilityId?: string;
  allowBrokering?: string | null;
  availableUnits?: number | string;
  heldUnits?: number | string;
}

export interface FacilityInfo {
  facilityId: string;
  facilityName: string;
  facilityTypeId: string;
}

export interface RuleSeries {
  ruleKey: string;
  label: string;
  routingRuleId: string;
  routingGroupId: string;
  orderRoutingId: string;
  facilityTypeId: string;
  counts: number[];
  total: number;
}

export interface FacilityHold {
  facilityId: string;
  facilityName: string;
  facilityTypeId: string;
  available: number;
  safetyStockHeld: number;
  shippingExcluded: number;
  overlap: number;
  combinedHeld: number;
  eligible: number;
  safetyStockShare: number | null;
}

function toNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatWeekLabel(start: number) {
  const date = new Date(start);

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// The last `count` complete Monday-to-Sunday weeks before `now`, oldest first.
export function lastCompleteWeeks(count: number, now = Date.now()): Week[] {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const weekday = (new Date(today).getUTCDay() + 6) % 7; // Monday = 0
  const currentWeekStart = today - weekday * DAY_MS;
  const weeks: Week[] = [];
  for(let i = count; i >= 1; i--) {
    const start = currentWeekStart - i * WEEK_MS;
    weeks.push({ start, end: start + WEEK_MS, label: formatWeekLabel(start) });
  }

  return weeks;
}

// OrderFacilityChange records the rule as "<group> : <routing> : <rule>]". The dashboard
// names a rule by its routing and rule, which is how merchants recognise it.
export function ruleLabel(recordedRule?: string) {
  const trimmed = String(recordedRule || "").replace(/\]+\s*$/, "").trim();
  if(!trimmed) {return "Unrecorded rule";}
  const parts = trimmed.split(" : ");

  return parts.slice(-2).join(" : ");
}

export function isRoutableRow(row: { salesChannelEnumId?: string | null; shipmentMethodTypeId?: string | null }) {
  if(row.salesChannelEnumId && EXCLUDED_SALES_CHANNELS.includes(row.salesChannelEnumId)) {return false;}
  if(row.shipmentMethodTypeId && EXCLUDED_SHIPMENT_METHODS.includes(row.shipmentMethodTypeId)) {return false;}

  return true;
}

// Rows are distinct-order counts grouped by rule, channel, method and facility type. An
// order has one sales channel, so adding a rule's channel rows does not double count.
export function buildRuleSeries(rowsByWeek: RuleWeekRow[][]): RuleSeries[] {
  const series = new Map<string, RuleSeries>();
  rowsByWeek.forEach((rows, weekIndex) => {
    for(const row of rows) {
      if(!isRoutableRow(row)) {continue;}
      if(row.facilityTypeId && !FULFILLMENT_FACILITY_TYPES.includes(row.facilityTypeId)) {continue;}
      const label = ruleLabel(row.routingRule);
      let entry = series.get(label);
      if(!entry) {
        entry = {
          ruleKey: label,
          label,
          routingRuleId: row.routingRuleId || "",
          routingGroupId: row.routingGroupId || "",
          orderRoutingId: row.orderRoutingId || "",
          facilityTypeId: row.facilityTypeId || "",
          counts: rowsByWeek.map(() => 0),
          total: 0
        };
        series.set(label, entry);
      }
      const count = toNumber(row.orderCount);
      entry.counts[weekIndex] += count;
      entry.total += count;
    }
  });

  return [...series.values()].sort((a, b) => b.total - a.total);
}

// Weekly units shipped from retail stores, plus the per-store split for the latest week.
export function buildStoreShipped(rowsByWeek: ShippedWeekRow[][], facilities: Record<string, FacilityInfo>) {
  const weeklyUnits = rowsByWeek.map(() => 0);
  const weeklyOrders = rowsByWeek.map(() => 0);
  const byStore = new Map<string, number[]>();
  rowsByWeek.forEach((rows, weekIndex) => {
    for(const row of rows) {
      if(!isRoutableRow(row)) {continue;}
      const facility = facilities[row.facilityId || ""];
      if(facility?.facilityTypeId !== "RETAIL_STORE") {continue;}
      const units = toNumber(row.shippedUnits);
      weeklyUnits[weekIndex] += units;
      weeklyOrders[weekIndex] += toNumber(row.shippedOrders);
      if(!byStore.has(facility.facilityId)) {byStore.set(facility.facilityId, rowsByWeek.map(() => 0));}
      byStore.get(facility.facilityId)![weekIndex] += units;
    }
  });
  const stores = [...byStore.entries()]
    .map(([facilityId, units]) => ({ facilityId, facilityName: facilities[facilityId]?.facilityName || facilityId, units }))
    .sort((a, b) => (b.units[b.units.length - 1] || 0) - (a.units[a.units.length - 1] || 0));

  return { weeklyUnits, weeklyOrders, stores };
}

function sumByFacility(rows: InventoryRow[], key: "availableUnits" | "heldUnits") {
  const totals: Record<string, { all: number; notBrokered: number }> = {};
  for(const row of rows) {
    const facilityId = row.facilityId || "";
    if(!totals[facilityId]) {totals[facilityId] = { all: 0, notBrokered: 0 };}
    const units = toNumber(row[key]);
    totals[facilityId].all += units;
    if(row.allowBrokering === "N") {totals[facilityId].notBrokered += units;}
  }

  return totals;
}

// Per-location hold from the two inventory controls that keep units away from routing:
//  - safety stock holds min(on hand, minimum stock) of every SKU;
//  - a location with shipping disabled (allowBrokering = N) holds all of that SKU.
// A unit can be held by both, so the combined hold subtracts the overlap.
export function buildFacilityHolds(
  available: InventoryRow[],
  safetyCapped: InventoryRow[],
  safetyShort: InventoryRow[],
  facilities: Record<string, FacilityInfo>
): FacilityHold[] {
  const availableTotals = sumByFacility(available, "availableUnits");
  const safetyTotals = sumByFacility([...safetyCapped, ...safetyShort], "heldUnits");

  return Object.keys(availableTotals)
    .filter((facilityId) => facilities[facilityId])
    .map((facilityId) => {
      const facility = facilities[facilityId];
      const availableUnits = availableTotals[facilityId].all;
      const safetyStockHeld = safetyTotals[facilityId]?.all || 0;
      const shippingExcluded = availableTotals[facilityId].notBrokered;
      const overlap = safetyTotals[facilityId]?.notBrokered || 0;
      const combinedHeld = safetyStockHeld + shippingExcluded - overlap;

      return {
        facilityId,
        facilityName: facility.facilityName,
        facilityTypeId: facility.facilityTypeId,
        available: availableUnits,
        safetyStockHeld,
        shippingExcluded,
        overlap,
        combinedHeld,
        eligible: availableUnits - combinedHeld,
        safetyStockShare: availableUnits > 0 ? safetyStockHeld / availableUnits : null
      };
    })
    .sort((a, b) => (b.safetyStockShare || 0) - (a.safetyStockShare || 0));
}

export function totalHolds(holds: FacilityHold[]) {
  const total = holds.reduce((sum, hold) => {
    sum.available += hold.available;
    sum.safetyStockHeld += hold.safetyStockHeld;
    sum.shippingExcluded += hold.shippingExcluded;
    sum.overlap += hold.overlap;
    sum.combinedHeld += hold.combinedHeld;
    sum.eligible += hold.eligible;

    return sum;
  }, { available: 0, safetyStockHeld: 0, shippingExcluded: 0, overlap: 0, combinedHeld: 0, eligible: 0 });

  return { ...total, safetyStockShare: total.available > 0 ? total.safetyStockHeld / total.available : null };
}

// Week-over-week change of the last value, as a fraction; null when there is no base.
export function weekOverWeek(values: number[]) {
  if(values.length < 2) {return null;}
  const previous = values[values.length - 2];
  const latest = values[values.length - 1];
  if(!previous) {return null;}

  return (latest - previous) / previous;
}

// ---------------------------------------------------------------------------------------
// Safety stock by reason
// ---------------------------------------------------------------------------------------

export const UNATTRIBUTED_REASON = "Unattributed safety stock";
export const SHIPPING_REASON = "Shipping beyond safety stock";

export interface SafetyRule {
  ruleId: string;
  ruleName: string;
  sequenceNum: number;
  // Units the rule sets as minimum stock.
  buffer: number;
  facilityGroupIds: string[];
  includeTags: string[];
  excludeTags: string[];
  // True when the rule has a condition this dashboard cannot evaluate, so it never claims units.
  hasUnsupportedCondition: boolean;
}

export interface SafetySkuRow {
  productId?: string;
  facilityId?: string;
  minimumStock?: number | string | null;
  lastInventoryCount?: number | string | null;
}

// Reads an ATP decision rule (available-to-promise/decisionRules) into the parts that decide
// which SKUs and locations it applies to.
export function toSafetyRule(rule: any): SafetyRule {
  const conditions: any[] = rule.ruleConditions || [];
  const action = (rule.ruleActions || []).find((item: any) => item.actionTypeEnumId === "ATP_SAFETY_STOCK");
  const listValue = (value: unknown) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  const facilityGroupIds = conditions.filter((item) => item.conditionTypeEnumId === "ENTCT_ATP_FAC_GROUPS").flatMap((item) => listValue(item.fieldValue));
  const tagConditions = conditions.filter((item) => item.conditionTypeEnumId === "ENTCT_ATP_FILTER" && item.fieldName === "tags");
  const known = new Set(["ENTCT_ATP_FAC_GROUPS"]);
  const hasUnsupportedCondition = conditions.some((item) => !known.has(item.conditionTypeEnumId) &&
    !(item.conditionTypeEnumId === "ENTCT_ATP_FILTER" && item.fieldName === "tags"));

  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName || rule.ruleId,
    sequenceNum: Number(rule.sequenceNum) || 0,
    buffer: toNumber(action?.fieldValue),
    facilityGroupIds,
    includeTags: tagConditions.filter((item) => item.operator === "contains").flatMap((item) => listValue(item.fieldValue)),
    excludeTags: tagConditions.filter((item) => item.operator === "not-contains").flatMap((item) => listValue(item.fieldValue)),
    hasUnsupportedCondition
  };
}

// Credits each SKU's safety-stock hold to the rule that set it. The matching rule with the
// highest sequence wins, the same precedence the ATP engine applies, and the credit only
// stands when that rule's buffer equals the minimum stock on the record; anything else is
// unattributed rather than guessed. Units held only because shipping is off are their own reason.
export function buildSafetyByReason(
  skuRows: SafetySkuRow[],
  tagsByProduct: Record<string, string[]>,
  rules: SafetyRule[],
  facilitiesByGroup: Record<string, string[]>,
  holds: FacilityHold[]
) {
  const ordered = [...rules].sort((a, b) => b.sequenceNum - a.sequenceNum);
  const byFacility: Record<string, Record<string, number>> = {};
  const add = (facilityId: string, reason: string, units: number) => {
    if(!units) {return;}
    byFacility[facilityId] = byFacility[facilityId] || {};
    byFacility[facilityId][reason] = (byFacility[facilityId][reason] || 0) + units;
  };
  const storeIds = new Set(holds.map((hold) => hold.facilityId));

  for(const row of skuRows) {
    const facilityId = row.facilityId || "";
    if(!storeIds.has(facilityId)) {continue;}
    const minimumStock = Math.max(toNumber(row.minimumStock), 0);
    const held = Math.min(Math.max(toNumber(row.lastInventoryCount), 0), minimumStock);
    if(!held) {continue;}
    const tags = new Set(tagsByProduct[row.productId || ""] || []);
    const winner = ordered.find((rule) => {
      if(rule.hasUnsupportedCondition) {return false;}
      if(rule.facilityGroupIds.length && !rule.facilityGroupIds.some((groupId) => facilitiesByGroup[groupId]?.includes(facilityId))) {return false;}
      if(rule.includeTags.length && !rule.includeTags.some((tag) => tags.has(tag))) {return false;}

      return !rule.excludeTags.some((tag) => tags.has(tag));
    });
    add(facilityId, winner && winner.buffer === minimumStock ? winner.ruleName : UNATTRIBUTED_REASON, held);
  }
  for(const hold of holds) {add(hold.facilityId, SHIPPING_REASON, hold.shippingExcluded - hold.overlap);}

  const reasons = [
    ...ordered.map((rule) => rule.ruleName).filter((name) => Object.values(byFacility).some((reasonUnits) => reasonUnits[name])),
    UNATTRIBUTED_REASON,
    SHIPPING_REASON
  ].filter((reason, index, list) => list.indexOf(reason) === index && Object.values(byFacility).some((reasonUnits) => reasonUnits[reason]));
  const stores = holds
    .filter((hold) => byFacility[hold.facilityId])
    .map((hold) => ({
      facilityId: hold.facilityId,
      facilityName: hold.facilityName,
      units: byFacility[hold.facilityId],
      total: Object.values(byFacility[hold.facilityId]).reduce((sum, units) => sum + units, 0)
    }))
    .sort((a, b) => b.total - a.total);
  const totals = Object.fromEntries(reasons.map((reason) => [reason, stores.reduce((sum, store) => sum + (store.units[reason] || 0), 0)]));

  return { reasons, stores, totals };
}

// ---------------------------------------------------------------------------------------
// Safety-stock share over time
// ---------------------------------------------------------------------------------------

export interface InventorySnapshotRow {
  facilityId?: string;
  allowBrokering?: string | null;
  lastInventoryCount?: number | string | null;
  minimumStock?: number | string | null;
  skuCount?: number | string;
}

// One RoutingDashInvHistogram result counts SKUs per location by on-hand and minimum stock,
// which is enough to rebuild that moment's available units and safety-stock hold exactly.
export function summarizeSnapshot(rows: InventorySnapshotRow[], facilities: Record<string, FacilityInfo>) {
  const byStore: Record<string, { available: number; held: number }> = {};
  for(const row of rows) {
    const facility = facilities[row.facilityId || ""];
    if(facility?.facilityTypeId !== "RETAIL_STORE") {continue;}
    const onHand = toNumber(row.lastInventoryCount);
    if(onHand <= 0) {continue;}
    const skus = toNumber(row.skuCount);
    const entry = byStore[facility.facilityId] || (byStore[facility.facilityId] = { available: 0, held: 0 });
    entry.available += onHand * skus;
    entry.held += Math.min(onHand, Math.max(toNumber(row.minimumStock), 0)) * skus;
  }

  return byStore;
}

export interface SnapshotPoint {
  label: string;
  takenAt: number;
  byStore: Record<string, { available: number; held: number }>;
}

// Weekly exports are taken just after a week closes; each one is labelled with the Monday of
// the week it closes, and only the latest export for a week is kept.
export function weeklySnapshotPoints(snapshots: { takenAt: number; byStore: SnapshotPoint["byStore"] }[], limit: number): SnapshotPoint[] {
  const byWeek = new Map<number, { takenAt: number; byStore: SnapshotPoint["byStore"] }>();
  for(const snapshot of snapshots) {
    const [week] = lastCompleteWeeks(1, snapshot.takenAt);
    const current = byWeek.get(week.start);
    if(!current || snapshot.takenAt > current.takenAt) {byWeek.set(week.start, snapshot);}
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-limit)
    .map(([start, snapshot]) => ({ label: formatWeekLabel(start), takenAt: snapshot.takenAt, byStore: snapshot.byStore }));
}

export function shareOf(byStore: SnapshotPoint["byStore"], facilityIds?: string[]) {
  const ids = facilityIds || Object.keys(byStore);
  const total = ids.reduce((sum, id) => {
    sum.available += byStore[id]?.available || 0;
    sum.held += byStore[id]?.held || 0;

    return sum;
  }, { available: 0, held: 0 });

  return total.available ? total.held / total.available : null;
}

// Minimal RFC 4180 reader for the export CSVs: a header row, then quoted or bare values.
export function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for(let i = 0; i < text.length; i++) {
    const char = text[i];
    if(quoted) {
      if(char === "\"" && text[i + 1] === "\"") { field += "\""; i++; } else if(char === "\"") {quoted = false;} else {field += char;}
    } else if(char === "\"") {quoted = true;} else if(char === ",") { record.push(field); field = ""; } else if(char === "\n" || char === "\r") {
      if(char === "\r" && text[i + 1] === "\n") {i++;}
      record.push(field); field = "";
      if(record.some((value) => value !== "")) {records.push(record);}
      record = [];
    } else {field += char;}
  }
  if(field !== "" || record.length) { record.push(field); records.push(record); }
  const [header, ...rows] = records;
  if(!header) {return [];}

  return rows.map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
}

// ---------------------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------------------

export function thresholdSummary(rules: any[]) {
  const active = rules.filter((rule) => rule.statusId === "ATP_RULE_ACTIVE");
  const units = active.flatMap((rule) => (rule.ruleActions || [])
    .filter((action: any) => action.actionTypeEnumId === "ATP_THRESHOLD")
    .map((action: any) => toNumber(action.fieldValue)));

  return { activeRules: active.length, maxThreshold: units.length ? Math.max(...units) : 0 };
}
