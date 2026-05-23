import { createFacilityChangeSummaryTool } from "./tools/getFacilityChangeSummary";
import { createBrokeringFacilityGroupsTool } from "./tools/getBrokeringFacilityGroups";
import { createProductStoreBrokeringSettingsTool } from "./tools/getProductStoreBrokeringSettings";
import { createFacilityOrderLimitsTool } from "./tools/getFacilityOrderLimits";

export type CanonicalToolId =
  | "facility_change_summary"
  | "brokering_facility_groups"
  | "product_store_settings"
  | "facility_order_limits";

export type RunsListIntent =
  | "config_lookup"
  | "behavior_diagnostic"
  | "environmental_audit"
  | "recommendation";

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; unavailable: true; reason: string };

export type ToolContext = Partial<Record<CanonicalToolId, ToolResult>>;

type ToolLike = {
  execute?: (input: any, context?: any) => Promise<any>;
};

type ToolFactory = (omsBaseUrl: string, authToken: string) => ToolLike;

export const TOOL_FACTORIES: Record<CanonicalToolId, ToolFactory> = {
  facility_change_summary: createFacilityChangeSummaryTool,
  brokering_facility_groups: createBrokeringFacilityGroupsTool,
  product_store_settings: createProductStoreBrokeringSettingsTool,
  facility_order_limits: createFacilityOrderLimitsTool
};

const INTENT_DEFAULT_TOOLS: Record<RunsListIntent, CanonicalToolId[]> = {
  config_lookup: [],
  behavior_diagnostic: ["facility_change_summary"],
  environmental_audit: [
    "brokering_facility_groups",
    "product_store_settings",
    "facility_order_limits"
  ],
  recommendation: [
    "facility_change_summary",
    "brokering_facility_groups",
    "product_store_settings",
    "facility_order_limits"
  ]
};

export function resolveRequiredTools(args: {
  intent: RunsListIntent;
  matchedPatternId: string | null;
  patterns: { id: string; requires: CanonicalToolId[] }[];
}): CanonicalToolId[] {
  const { intent, matchedPatternId, patterns } = args;
  if (matchedPatternId) {
    const match = patterns.find((p) => p.id === matchedPatternId);
    if (match) {
      return match.requires;
    }
  }
  return INTENT_DEFAULT_TOOLS[intent];
}

export async function prefetchToolContext(args: {
  requiredTools: CanonicalToolId[];
  productStoreId: string;
  omsBaseUrl: string;
  authToken: string;
}): Promise<ToolContext> {
  const { requiredTools, productStoreId, omsBaseUrl, authToken } = args;

  const calls = requiredTools.map((id) => {
    const factory = TOOL_FACTORIES[id];
    const tool = factory(omsBaseUrl, authToken);
    const exec = tool.execute;
    if (!exec) {
      return Promise.reject(new Error(`tool ${id} has no execute function`));
    }
    return exec({ productStoreId });
  });

  const settled = await Promise.allSettled(calls);

  const context: ToolContext = {};
  requiredTools.forEach((id, idx) => {
    const result = settled[idx];
    if (result.status === "fulfilled") {
      context[id] = { ok: true, data: result.value };
    } else {
      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : typeof result.reason === "string"
            ? result.reason
            : "unknown error";
      context[id] = { ok: false, unavailable: true, reason };
    }
  });

  return context;
}
