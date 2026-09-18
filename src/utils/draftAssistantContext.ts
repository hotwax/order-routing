import type { DraftAssistantContext, PageCapabilityManifest } from "@/types/draft";

export const variationUnavailableOperations: NonNullable<DraftAssistantContext["unavailableOperations"]> = [
  "newRouting",
  "cloneRouting",
  "schedule",
  "liveRun",
  "groupStatus"
];

type ContextInput = {
  context?: DraftAssistantContext;
  orderRoutingId?: string;
  routingGroupId?: string;
  siblingRoutingIds?: string[];
};

/**
 * Builds the small, credential-free editor context sent to Circuit. An explicit context wins;
 * variation ids can also be recovered from the persisted variation route ids used by sim-routing.
 */
export function resolveDraftAssistantContext(input: ContextInput): DraftAssistantContext {
  const inferredVariationId = inferVariationId([input.orderRoutingId, ...(input.siblingRoutingIds || [])]);
  const variationId = input.context?.mode === "variation"
    ? cleanIdentifier(input.context.variationId) || inferredVariationId
    : input.context?.mode === "live" ? "" : inferredVariationId;
  const mode = input.context?.mode || (variationId ? "variation" : "live");
  const routingGroupId = cleanIdentifier(input.context?.routingGroupId || input.routingGroupId);

  return {
    mode,
    ...(variationId ? { variationId } : {}),
    ...(routingGroupId ? { routingGroupId } : {}),
    ...(mode === "variation" ? { unavailableOperations: [...variationUnavailableOperations] } : {})
  };
}

export function getDraftAssistantContext(manifest: PageCapabilityManifest): DraftAssistantContext {
  const visible = manifest.visibleEntities as any;
  const siblingRoutingIds = Array.isArray(visible?.brokeringRun?.availableSiblingRoutings)
    ? visible.brokeringRun.availableSiblingRoutings.map((routing: any) => String(routing?.orderRoutingId || ""))
    : [];

  return resolveDraftAssistantContext({
    context: manifest.context,
    orderRoutingId: String(visible?.route?.orderRoutingId || ""),
    routingGroupId: String(visible?.brokeringRun?.routingGroupId || ""),
    siblingRoutingIds
  });
}

export function isVariationManifest(manifest: PageCapabilityManifest) {
  return getDraftAssistantContext(manifest).mode === "variation";
}

/**
 * Normalizes variation manifests at the network boundary. Live schedule/run/group controls are
 * deliberately described as unavailable, not editable, and a provider never receives a live job
 * payload while reasoning about a variation working copy.
 */
export function prepareDraftAssistantManifest(manifest: PageCapabilityManifest): PageCapabilityManifest {
  const context = getDraftAssistantContext(manifest);
  if (context.mode !== "variation") {
    return manifest.context ? manifest : { ...manifest, context };
  }

  const visible = manifest.visibleEntities as any;
  const brokeringRun = visible?.brokeringRun || {};
  const route = visible?.route || {};

  return {
    ...manifest,
    context,
    editableTargets: manifest.editableTargets.filter((target) => !isVariationForbiddenTarget(target.target)),
    visibleEntities: {
      ...visible,
      brokeringRun: {
        ...brokeringRun,
        schedule: null,
        scheduleAvailability: "unavailable_in_variation",
        liveRunAvailable: false,
        groupStatusEditable: false
      },
      route: {
        ...route,
        draftLimitations: {
          ...(route.draftLimitations || {}),
          canCreateSiblingRoutings: false,
          unavailableOperations: [...variationUnavailableOperations]
        }
      }
    }
  };
}

/**
 * Serializes the manifest for the deployed Circuit contract. Circuit's top-level manifest schema is
 * strict and predates the local editor context field, while visibleEntities is its supported
 * extension point. Keep context available to the assistant without sending an unknown top-level key.
 */
export function serializeDraftAssistantManifest(manifest: PageCapabilityManifest): Omit<PageCapabilityManifest, "context"> {
  const { context, ...transportManifest } = manifest;
  if (!context) return transportManifest;

  return {
    ...transportManifest,
    visibleEntities: {
      ...transportManifest.visibleEntities,
      assistantContext: context
    }
  };
}

export function isVariationForbiddenTarget(target: string) {
  return /^(?:(?:brokeringRun|routingGroup|group|schedule|liveRun|newRouting|cloneRouting)(?:\.|$)|route\.(?:clone|create|schedule|run)(?:\.|$))/.test(String(target || ""));
}

function inferVariationId(ids: Array<string | undefined>) {
  for (const id of ids) {
    // Current sim-routing ids are VM<number>_<parent id>; local tests also use V<number>.
    const match = String(id || "").match(/^(VM?\d+)_/);
    if (match) return match[1];
  }
  return "";
}

function cleanIdentifier(value: unknown) {
  return String(value || "").trim();
}
