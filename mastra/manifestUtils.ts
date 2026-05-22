import type { PageCapabilityManifest } from "./pageCapabilitySchema";

export type InquiryManifest = {
  pageId: string;
  route: string;
  visibleEntities: Record<string, unknown>;
};

export type DraftManifest = {
  pageId: string;
  route: string;
  visibleEntities: Record<string, unknown>;
  editableTargets: unknown[];
  outputContract: Record<string, unknown>;
};

// Inquiry calls only need the current visible state, not the editable target list.
export function pruneManifestForInquiry(manifest: PageCapabilityManifest): InquiryManifest {
  return {
    pageId: manifest.pageId,
    route: manifest.route,
    visibleEntities: manifest.visibleEntities
  };
}

// Draft calls need editable targets + the slice of visibleEntities the model
// uses to decide whether to edit an existing inventory rule vs. create a new
// one (route.availableInventoryRules, the currently selectedRule, and the
// route's routingName/draftLimitations). Without availableInventoryRules the
// model has no routingRuleId to reuse and is forced to invent a new
// `new:*` ruleKey for every edit.
// staticDisabled targets are stripped — the model can't change them and the
// validator would reject any attempt, so including them only wastes tokens.
export function pruneManifestForDraft(manifest: PageCapabilityManifest): DraftManifest {
  const editableTargets = (manifest.editableTargets as Array<Record<string, unknown>>)
    .filter(target => !target.staticDisabled);

  return {
    pageId: manifest.pageId,
    route: manifest.route,
    visibleEntities: pickDraftVisibleEntities(manifest.visibleEntities),
    editableTargets,
    outputContract: manifest.outputContract
  };
}

function pickDraftVisibleEntities(visibleEntities: Record<string, unknown>): Record<string, unknown> {
  const route = (visibleEntities.route as Record<string, unknown> | undefined) || {};
  const picked: Record<string, unknown> = {
    route: {
      routingName: route.routingName,
      statusId: route.statusId,
      availableInventoryRules: route.availableInventoryRules || [],
      draftLimitations: route.draftLimitations
    }
  };

  if (visibleEntities.selectedRule) {
    picked.selectedRule = visibleEntities.selectedRule;
  }

  return picked;
}
