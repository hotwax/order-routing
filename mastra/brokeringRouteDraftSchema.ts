import { z } from "zod/v4";
import {
  draftConversationMessageSchema,
  pageCapabilityManifestSchema
} from "./pageCapabilitySchema";

const routeStatusSchema = z.enum(["ROUTING_DRAFT", "ROUTING_ACTIVE", "ROUTING_ARCHIVED"]);
const ruleStatusSchema = z.enum(["RULE_DRAFT", "RULE_ACTIVE", "RULE_ARCHIVED"]);
const sortDirectionSchema = z.enum(["asc", "desc"]);

const optionSelectionSchema = z.object({
  include: z.array(z.string()),
  exclude: z.array(z.string())
}).strict();

const orderSortSchema = z.object({
  field: z.enum(["shipByDate", "shipAfterDate", "orderDate", "shippingMethod", "priority"]),
  direction: sortDirectionSchema
}).strict();

const inventorySortSchema = z.object({
  field: z.enum(["proximity", "inventoryBalance", "customerSequence"]),
  direction: sortDirectionSchema
}).strict();

const orderSelectionSchema = z.object({
  filters: z.object({
    queues: optionSelectionSchema,
    shippingMethods: optionSelectionSchema,
    priorities: optionSelectionSchema,
    promiseDateDays: z.object({
      max: z.number().int().nonnegative().nullable(),
      excludeMax: z.number().int().nonnegative().nullable()
    }),
    salesChannels: optionSelectionSchema,
    originFacilityGroups: optionSelectionSchema
  }).strict(),
  sorts: z.array(orderSortSchema)
}).strict();

const inventoryRuleSchema = z.object({
  ruleKey: z.string().min(1),
  name: z.string().min(1),
  statusId: ruleStatusSchema,
  sequence: z.number().int().nonnegative(),
  inventorySelection: z.object({
    filters: z.object({
      facilityGroups: optionSelectionSchema,
      proximity: z.object({
        maxDistance: z.number().nonnegative().nullable(),
        unit: z.enum(["METRIC", "IMPERIAL"]).nullable()
      }).strict(),
      safetyStock: z.object({
        minimum: z.number().nonnegative().nullable()
      }).strict(),
      facilityOrderLimit: z.enum(["respect", "bypass", "unchanged"]),
      shipmentThreshold: z.number().nonnegative().nullable()
    }).strict(),
    sorts: z.array(inventorySortSchema)
  }).strict(),
  allocation: z.object({
    partialOrderAllocation: z.boolean(),
    partialGroupedItemAllocation: z.boolean()
  }).strict(),
  unavailableItems: z.object({
    action: z.enum(["nextRule", "moveToQueue"]),
    queueId: z.string().min(1).nullable(),
    autoCancel: z.object({
      mode: z.enum(["none", "clear", "days"]),
      days: z.number().int().nonnegative().nullable()
    }).strict()
  }).strict()
}).strict();

const targetRoutingSchema = z.object({
  action: z.enum(["edit", "create"]),
  routingKey: z.string().min(1).optional(),
  name: z.string().min(1).max(80).optional()
}).strict();

export const brokeringRouteDraftSchema = z.object({
  schemaVersion: z.literal("brokering-route-draft.v1"),
  applyMode: z.enum(["merge", "replace"]),
  targetRouting: targetRoutingSchema.optional(),
  route: z.object({
    statusId: routeStatusSchema,
    orderSelection: orderSelectionSchema,
    inventoryRules: z.array(inventoryRuleSchema)
  }).strict(),
  questions: z.array(z.string()),
  summary: z.string().min(1)
}).strict();

export const brokeringRouteDraftRequestSchema = z.object({
  prompt: z.string().min(1),
  conversationHistory: z.array(draftConversationMessageSchema).max(20).default([]),
  pageCapabilityManifest: pageCapabilityManifestSchema,
  outputContract: z.record(z.string(), z.unknown()).optional()
}).strict();

export type BrokeringRouteDraft = z.infer<typeof brokeringRouteDraftSchema>;
export type BrokeringRouteDraftRequest = z.infer<typeof brokeringRouteDraftRequestSchema>;

export function normalizeBrokeringRouteDraft(value: any): BrokeringRouteDraft {
  return brokeringRouteDraftSchema.parse({
    schemaVersion: "brokering-route-draft.v1",
    applyMode: normalizeApplyMode(value?.applyMode),
    targetRouting: normalizeTargetRouting(value?.targetRouting),
    route: {
      statusId: normalizeRouteStatus(value?.route?.statusId),
      orderSelection: normalizeOrderSelection(value?.route?.orderSelection),
      inventoryRules: Array.isArray(value?.route?.inventoryRules)
        ? value.route.inventoryRules.map(normalizeInventoryRule)
        : []
    },
    questions: Array.isArray(value?.questions) ? value.questions.map(String).filter(Boolean) : [],
    summary: typeof value?.summary === "string" && value.summary.trim()
      ? value.summary.trim()
      : "Drafted brokering route changes."
  });
}

function normalizeTargetRouting(value: unknown): BrokeringRouteDraft["targetRouting"] {
  if (!value || typeof value !== "object") return { action: "edit" };
  const v = value as Record<string, unknown>;
  if (v.action === "create") {
    const name = typeof v.name === "string" && v.name.trim() ? v.name.trim() : undefined;
    const rawKey = typeof v.routingKey === "string" && v.routingKey.trim() ? v.routingKey.trim() : "";
    const routingKey = rawKey
      ? (rawKey.startsWith("new:") ? rawKey : `new:${rawKey}`)
      : undefined;
    return { action: "create", routingKey, name };
  }
  // Any value other than "create" — including unknown strings — falls back to edit.
  // Edit branch never carries a name.
  return { action: "edit" };
}

function normalizeApplyMode(value: unknown): BrokeringRouteDraft["applyMode"] {
  return value === "replace" ? "replace" : "merge";
}

function normalizeRouteStatus(value: unknown): BrokeringRouteDraft["route"]["statusId"] {
  return routeStatusSchema.safeParse(value).success ? value as BrokeringRouteDraft["route"]["statusId"] : "ROUTING_DRAFT";
}

function normalizeOrderSelection(value: any): BrokeringRouteDraft["route"]["orderSelection"] {
  return {
    filters: {
      queues: normalizeOptionSelection(value?.filters?.queues),
      shippingMethods: normalizeOptionSelection(value?.filters?.shippingMethods),
      priorities: normalizeOptionSelection(value?.filters?.priorities),
      promiseDateDays: {
        max: normalizeNonNegativeInteger(value?.filters?.promiseDateDays?.max),
        excludeMax: normalizeNonNegativeInteger(value?.filters?.promiseDateDays?.excludeMax)
      },
      salesChannels: normalizeOptionSelection(value?.filters?.salesChannels),
      originFacilityGroups: normalizeOptionSelection(value?.filters?.originFacilityGroups)
    },
    sorts: normalizeSorts(value?.sorts, orderSortSchema, "shipByDate")
  };
}

function normalizeInventoryRule(value: any, index: number): BrokeringRouteDraft["route"]["inventoryRules"][number] {
  return {
    ruleKey: normalizeString(value?.ruleKey, `new:rule-${index + 1}`),
    name: normalizeString(value?.name, `Rule ${index + 1}`),
    statusId: ruleStatusSchema.safeParse(value?.statusId).success ? value.statusId : "RULE_DRAFT",
    sequence: normalizeNonNegativeInteger(value?.sequence) ?? (index + 1) * 10,
    inventorySelection: {
      filters: {
        facilityGroups: normalizeOptionSelection(value?.inventorySelection?.filters?.facilityGroups),
        proximity: {
          maxDistance: normalizeNonNegativeNumber(value?.inventorySelection?.filters?.proximity?.maxDistance),
          unit: normalizeProximityUnit(value?.inventorySelection?.filters?.proximity?.unit)
        },
        safetyStock: {
          minimum: normalizeNonNegativeNumber(value?.inventorySelection?.filters?.safetyStock?.minimum)
        },
        facilityOrderLimit: normalizeFacilityOrderLimit(value?.inventorySelection?.filters?.facilityOrderLimit),
        shipmentThreshold: normalizeNonNegativeNumber(value?.inventorySelection?.filters?.shipmentThreshold)
      },
      sorts: normalizeSorts(value?.inventorySelection?.sorts, inventorySortSchema, "proximity")
    },
    allocation: {
      partialOrderAllocation: Boolean(value?.allocation?.partialOrderAllocation),
      partialGroupedItemAllocation: Boolean(value?.allocation?.partialGroupedItemAllocation)
    },
    unavailableItems: {
      action: value?.unavailableItems?.action === "moveToQueue" ? "moveToQueue" : "nextRule",
      queueId: normalizeNullableString(value?.unavailableItems?.queueId),
      autoCancel: {
        mode: normalizeAutoCancelMode(value?.unavailableItems?.autoCancel?.mode),
        days: normalizeNonNegativeInteger(value?.unavailableItems?.autoCancel?.days)
      }
    }
  };
}

function normalizeOptionSelection(value: any): { include: string[]; exclude: string[] } {
  return {
    include: normalizeStringArray(value?.include),
    exclude: normalizeStringArray(value?.exclude)
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function normalizeSorts<T extends z.ZodTypeAny>(value: unknown, schema: T, fallbackField: string) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((candidate) => {
    const normalizedCandidate = {
      ...(candidate && typeof candidate === "object" ? candidate : {}),
      direction: (candidate as any)?.direction === "desc" ? "desc" : "asc"
    };
    const parsed = schema.safeParse(normalizedCandidate);
    if (parsed.success) {
      return parsed.data;
    }

    const fallback = schema.safeParse({ field: fallbackField, direction: normalizedCandidate.direction });
    return fallback.success ? fallback.data : null;
  }).filter(Boolean);
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

function normalizeString(value: unknown, fallback: string): string {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeNullableString(value: unknown): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeProximityUnit(value: unknown): "METRIC" | "IMPERIAL" | null {
  return value === "METRIC" || value === "IMPERIAL" ? value : null;
}

function normalizeFacilityOrderLimit(value: unknown): "respect" | "bypass" | "unchanged" {
  return value === "respect" || value === "bypass" ? value : "unchanged";
}

function normalizeAutoCancelMode(value: unknown): "none" | "clear" | "days" {
  return value === "clear" || value === "days" ? value : "none";
}
