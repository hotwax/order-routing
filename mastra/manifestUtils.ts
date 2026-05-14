import type { PageCapabilityManifest } from "./pageCapabilitySchema";

export type InquiryManifest = {
  pageId: string;
  route: string;
  visibleEntities: Record<string, unknown>;
};

export type DraftManifest = {
  pageId: string;
  route: string;
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

// Draft calls only need editable targets and the output contract.
// staticDisabled targets are stripped — the model can't change them and the
// validator would reject any attempt, so including them only wastes tokens.
export function pruneManifestForDraft(manifest: PageCapabilityManifest): DraftManifest {
  const editableTargets = (manifest.editableTargets as Array<Record<string, unknown>>)
    .filter(target => !target.staticDisabled);

  return {
    pageId: manifest.pageId,
    route: manifest.route,
    editableTargets,
    outputContract: manifest.outputContract
  };
}
