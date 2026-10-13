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
}

export interface ShippedWeekRow {
  facilityId?: string;
  shipmentMethodTypeId?: string;
  salesChannelEnumId?: string;
  shippedUnits?: number | string;
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
  // Location types the rule allocated to in these weeks, e.g. only stores or only warehouses.
  facilityTypeIds: string[];
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
  if(!trimmed) {return "";}
  const parts = trimmed.split(" : ");

  return parts.slice(-2).join(" : ");
}

export function isRoutableRow(row: { salesChannelEnumId?: string | null; shipmentMethodTypeId?: string | null }) {
  if(row.salesChannelEnumId && EXCLUDED_SALES_CHANNELS.includes(row.salesChannelEnumId)) {return false;}
  if(row.shipmentMethodTypeId && EXCLUDED_SHIPMENT_METHODS.includes(row.shipmentMethodTypeId)) {return false;}

  return true;
}

export interface RuleTypeRow {
  routingRuleId?: string;
  facilityTypeId?: string;
}

// rowsByWeek holds one distinct-order count per rule and week, already filtered on the server to
// routable orders at stores and warehouses, so the counts are used as they are. typeRows lists the
// location types each rule allocated to across the range.
export function buildRuleSeries(rowsByWeek: RuleWeekRow[][], typeRows: RuleTypeRow[] = []): RuleSeries[] {
  // Keyed by rule id, so rules with the same name in different routing groups stay apart.
  const series = new Map<string, RuleSeries & { recordedRule: string }>();
  rowsByWeek.forEach((rows, weekIndex) => {
    for(const row of rows) {
      const ruleKey = row.routingRuleId || String(row.routingRule || "");
      let entry = series.get(ruleKey);
      if(!entry) {
        entry = {
          ruleKey,
          label: ruleLabel(row.routingRule),
          recordedRule: String(row.routingRule || ""),
          routingRuleId: row.routingRuleId || "",
          routingGroupId: row.routingGroupId || "",
          orderRoutingId: row.orderRoutingId || "",
          facilityTypeIds: [],
          counts: rowsByWeek.map(() => 0),
          total: 0
        };
        series.set(ruleKey, entry);
      }
      const count = toNumber(row.orderCount);
      entry.counts[weekIndex] += count;
      entry.total += count;
    }
  });
  for(const row of typeRows) {
    const entry = series.get(row.routingRuleId || "");
    if(entry && row.facilityTypeId && !entry.facilityTypeIds.includes(row.facilityTypeId)) {entry.facilityTypeIds.push(row.facilityTypeId);}
  }
  const entries = [...series.values()];
  // When two rules share a routing and rule name, name their routing group too.
  const shared = new Set(entries.map((entry) => entry.label).filter((label, index, labels) => labels.indexOf(label) !== index));

  return entries
    .map((entry) => {
      const { recordedRule, ...rule } = entry;

      return shared.has(rule.label) ? { ...rule, label: recordedRule.replace(/\]+\s*$/, "").trim() || rule.label } : rule;
    })
    .sort((a, b) => b.total - a.total);
}

// Weekly units shipped from retail stores, in total and per store.
export function buildStoreShipped(rowsByWeek: ShippedWeekRow[][], facilities: Record<string, FacilityInfo>) {
  const weeklyUnits = rowsByWeek.map(() => 0);
  const byStore = new Map<string, number[]>();
  rowsByWeek.forEach((rows, weekIndex) => {
    for(const row of rows) {
      if(!isRoutableRow(row)) {continue;}
      const facility = facilities[row.facilityId || ""];
      if(facility?.facilityTypeId !== "RETAIL_STORE") {continue;}
      const units = toNumber(row.shippedUnits);
      weeklyUnits[weekIndex] += units;
      if(!byStore.has(facility.facilityId)) {byStore.set(facility.facilityId, rowsByWeek.map(() => 0));}
      byStore.get(facility.facilityId)![weekIndex] += units;
    }
  });
  const stores = [...byStore.entries()]
    .map(([facilityId, units]) => ({ facilityId, facilityName: facilities[facilityId]?.facilityName || facilityId, units }));

  return { weeklyUnits, stores };
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

// Rounds a chart's axis top up to 1, 2 or 5 times a power of ten, so gridlines land on round numbers.
export function axisCeiling(value: number) {
  if(value <= 0) {return 1;}
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const step = [1, 2, 5, 10].find((multiplier) => multiplier * magnitude >= value) || 10;

  return step * magnitude;
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
  // Facility groups the rule is limited to; empty when it applies to every group.
  includeFacilityGroupIds: string[];
  excludeFacilityGroupIds: string[];
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
  const groupConditions = conditions.filter((item) => item.conditionTypeEnumId === "ENTCT_ATP_FAC_GROUPS");
  const included = groupConditions.filter((item) => item.operator !== "not-in").flatMap((item) => listValue(item.fieldValue));
  // ALL means every facility group, so it places no restriction.
  const includeFacilityGroupIds = included.includes("ALL") ? [] : included;
  const excludeFacilityGroupIds = groupConditions.filter((item) => item.operator === "not-in").flatMap((item) => listValue(item.fieldValue));
  const tagConditions = conditions.filter((item) => item.conditionTypeEnumId === "ENTCT_ATP_FILTER" && item.fieldName === "tags");
  const known = new Set(["ENTCT_ATP_FAC_GROUPS"]);
  const hasUnsupportedCondition = conditions.some((item) => !known.has(item.conditionTypeEnumId) &&
    !(item.conditionTypeEnumId === "ENTCT_ATP_FILTER" && item.fieldName === "tags"));

  return {
    ruleId: rule.ruleId,
    ruleName: rule.ruleName || rule.ruleId,
    sequenceNum: Number(rule.sequenceNum) || 0,
    buffer: toNumber(action?.fieldValue),
    includeFacilityGroupIds,
    excludeFacilityGroupIds,
    includeTags: tagConditions.filter((item) => item.operator === "contains").flatMap((item) => listValue(item.fieldValue)),
    excludeTags: tagConditions.filter((item) => item.operator === "not-contains").flatMap((item) => listValue(item.fieldValue)),
    hasUnsupportedCondition
  };
}

// Credits each SKU's safety-stock hold to the rule that set it. The matching rule with the
// highest sequence wins, the same precedence the ATP engine applies, and the credit only
// stands when that rule's buffer equals the minimum stock on the record. When the winning rule
// has a condition this dashboard can't evaluate, the SKU is unattributed rather than credited to
// a lower rule. Units held only because shipping is off are their own reason.
// Reasons are keyed by rule id (or the two reason constants); labels holds each rule's name.
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
    const inGroup = (groupId: string) => !!facilitiesByGroup[groupId]?.includes(facilityId);
    // The highest rule whose facility groups and tags match; an unsupported condition might also
    // match, so such a rule still stops the search and leaves the SKU unattributed.
    const winner = ordered.find((rule) => {
      if(rule.includeFacilityGroupIds.length && !rule.includeFacilityGroupIds.some(inGroup)) {return false;}
      if(rule.excludeFacilityGroupIds.some(inGroup)) {return false;}
      if(rule.includeTags.length && !rule.includeTags.some((tag) => tags.has(tag))) {return false;}

      return !rule.excludeTags.some((tag) => tags.has(tag));
    });
    const credited = winner && !winner.hasUnsupportedCondition && winner.buffer === minimumStock;
    add(facilityId, credited ? winner.ruleId : UNATTRIBUTED_REASON, held);
  }
  for(const hold of holds) {add(hold.facilityId, SHIPPING_REASON, hold.shippingExcluded - hold.overlap);}

  const hasUnits = (reason: string) => Object.values(byFacility).some((reasonUnits) => reasonUnits[reason]);
  const reasons = [...ordered.map((rule) => rule.ruleId), UNATTRIBUTED_REASON, SHIPPING_REASON]
    .filter((reason, index, list) => list.indexOf(reason) === index && hasUnits(reason));
  // Rules that share a name are told apart by their id.
  const labels = Object.fromEntries(ordered.map((rule) => {
    const sameName = ordered.filter((other) => other.ruleName === rule.ruleName).length > 1;

    return [rule.ruleId, sameName ? `${rule.ruleName} (${rule.ruleId})` : rule.ruleName];
  }));
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

  return { reasons, labels, stores, totals };
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
