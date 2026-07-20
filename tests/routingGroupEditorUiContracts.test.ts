import { describe, expect, it } from "vitest";
import editorSource from "../src/components/circuit/RoutingGroupEditor.vue?raw";
import canvasSource from "../src/components/circuit/RoutingDetailCanvas.vue?raw";
import skeletonSource from "../src/components/circuit/RoutingGroupEditorSkeleton.vue?raw";
import variationDiffModalSource from "../src/components/simulation/VariationDiffModal.vue?raw";

describe("routing group editor UI contracts", () => {
  it("loads routing enum options for direct detail entry and Circuit manifests", () => {
    expect(editorSource.match(/utilStore\.fetchRoutingEditorEnums\(\)/g)).toHaveLength(2);
  });

  it("stacks every status value below its label", () => {
    const statusSelects = editorSource.match(/<ion-select[^>]*:label="translate\('Status'\)"[^>]*>/g) || [];

    expect(statusSelects).toHaveLength(3);
    expect(statusSelects.every((select) => select.includes('label-placement="stacked"'))).toBe(true);
  });

  it("marks changed rule rows and guards editing without making the canvas inert", () => {
    expect(editorSource).toContain("'dirty-row': isRuleDirty(rule)");
    expect(editorSource).toContain('translate("Changed")');
    expect(canvasSource).toContain(':interaction-locked="editorLocked"');
    expect(canvasSource).not.toContain(':inert="editorLocked');
  });

  it("keeps the baseline Save action clear-filled while highlighting dirty state", () => {
    expect(canvasSource).toContain('fill="clear"');
    expect(canvasSource).not.toContain(":fill=\"editorDirty ? 'outline' : 'clear'\"");
    expect(canvasSource).toContain(":color=\"editorDirty ? 'primary' : undefined\"");
    expect(canvasSource).toContain(':disabled="!editorDirty || editorLocked"');
  });

  it("combines the routing position and reorder handle in an outline chip", () => {
    const routingChip = editorSource.match(/<ion-chip slot="end" outline v-if="group\.routings">[\s\S]*?<\/ion-chip>/)?.[0] || "";

    expect(routingChip).toContain("{{ (index as number) + 1 }}/{{ group.routings.length }}");
    expect(routingChip).toContain('<ion-reorder @pointerdown="isReordering = true" />');
  });

  it("never renders a routing status system ID when enum reference data is unavailable", () => {
    expect(editorSource).toContain("description && description !== id ? description : routingEditorCodeLabel(id)");
  });

  it("holds the detail canvas geometry with card skeletons throughout the initial group load", () => {
    expect(editorSource).toContain('<RoutingGroupEditorSkeleton v-if="isLoadingGroup || sandboxReferenceLoading"');
    expect(editorSource).toContain("const isLoadingGroup = ref(Boolean(props.routingGroupId));");
    expect(skeletonSource).toContain('role="status"');
    expect(skeletonSource).toContain('class="skeleton-column skeleton-group-column"');
    expect(skeletonSource).toContain('class="skeleton-column skeleton-routing-column"');
    expect(skeletonSource).toContain('class="skeleton-column skeleton-rule-column"');
    expect(skeletonSource.match(/<ion-card/g)?.length).toBeGreaterThanOrEqual(7);
  });

  it("replaces the prompt with proposal context and card-level partial acceptance", () => {
    expect(canvasSource).toContain('v-if="!pendingDraftProposal"');
    expect(canvasSource).toContain('<RoutingConfigSectionCard');
    expect(canvasSource).toContain('class="proposal-card-decision"');
    expect(canvasSource).toContain('@ionChange="setProposalCardDecision(card.key, $event.detail.value)"');
    expect(canvasSource).toContain('selectCircuitProposalCards(pendingDraftProposal.value, acceptedProposalCardKeys.value)');
    expect(canvasSource).toContain('translate("Accept selected")');
    expect(canvasSource).toContain('translate("Reject all")');
    expect(canvasSource).toContain('class="proposal-actions"');
    expect(canvasSource).toContain('class="circuit-loading"');
  });

  it("reviews Circuit proposals in live and variation editors with stale-context guards", () => {
    expect(canvasSource).toContain('<div v-if="pendingDraftProposal" class="proposal-review">');
    expect(canvasSource).not.toContain('pendingDraftProposal && !activeVariationId');
    expect(canvasSource).not.toContain('Circuit can only edit the live routing');
    expect(canvasSource).toContain('assertCurrentCircuitContext(circuitContext)');
    expect(editorSource).toContain('simulationWorking: cloneSnapshotValue(sim.working)');
    expect(editorSource).toContain('restoreObjectInPlace(sim.working, snap.simulationWorking)');
    expect(editorSource).toContain('variationId: String(group.value.variationGroupId || sim.tree?.variationGroupId || sim.working?.variationGroupId || "")');
    expect(editorSource).toContain('...buildRoutingAgentSnapshot(editorReferenceMaps.value)');
    expect(editorSource).toContain('if (isSandbox.value) return ""');
  });

  it("uses the same routing-section component for the canvas and Circuit context", () => {
    expect(canvasSource).toContain("RoutingConfigSectionCard from '@/components/circuit/RoutingConfigSectionCard.vue'");
    expect(editorSource).toContain('RoutingConfigSectionCard from "@/components/circuit/RoutingConfigSectionCard.vue"');
    expect(editorSource.match(/<RoutingConfigSectionCard/g)).toHaveLength(6);
    expect(editorSource).toContain(':card="routeFiltersSectionCard"');
    expect(editorSource).toContain(':card="ruleSortSectionCard"');
    expect(editorSource).toContain(':card="unavailableSectionCard"');
  });

  it("marks the affected canvas card and exact setting row as dirty", () => {
    expect(editorSource).toContain("isOrderConditionCardDirty('ENTCT_SORT_BY')");
    expect(editorSource).toContain('items: routingSectionItems(');
    expect(editorSource).toContain(':class="{ \'dirty-setting-row\': item.dirty }"');
    expect(editorSource).toContain("isRuleConditionCardDirty('ENTCT_FILTER')");
    expect(editorSource).toContain("'dirty-setting-row'");
    expect(editorSource).toContain(':dirty="isRuleConditionCardDirty(\'ENTCT_FILTER\')"');
  });

  it("renders the demo CPCM filter like the compact shipment-threshold row", () => {
    expect(editorSource).toContain("item.target.endsWith('.CARRIER_POSTAL_CODE_MAPPING')");
    expect(editorSource).toContain("@ionChange=\"updateOperator($event, 'CARRIER_POSTAL_CODE_MAPPING')\"");
    expect(editorSource).toContain("@ionChange=\"updateRuleFilterValue($event, 'CARRIER_POSTAL_CODE_MAPPING')\"");
    expect(editorSource).toContain('v-for="zone in DEMO_CPCM_ZONE_OPTIONS"');
    expect(editorSource).toContain('<ion-select-option value="less">');
    expect(editorSource).toContain('<ion-select-option value="less-equals">');
  });

  it("uses the AccxUI single-step modal and list-divider structure for variation differences", () => {
    expect(variationDiffModalSource.match(/<ion-toolbar>/g)).toHaveLength(2);
    expect(variationDiffModalSource).toContain('<ion-icon slot="icon-only" :icon="closeOutline" />');
    expect(variationDiffModalSource).toContain('<ion-title>{{ modalTitle }}</ion-title>');
    expect(variationDiffModalSource).toContain('<ion-list-header>');
    expect(variationDiffModalSource).toContain('<ion-item-divider color="light">');
    expect(variationDiffModalSource.match(/<ion-list(?:\s|>)/g)).toHaveLength(1);
    expect(variationDiffModalSource).not.toContain('<ion-item-group');
    expect(variationDiffModalSource).not.toMatch(/<ion-item[\s\S]*?<h[1-6]>/);
    expect(variationDiffModalSource).not.toContain('<p>{{ section.routingName }}</p>');
    expect(variationDiffModalSource).toContain('translate("Reset to baseline")');
    expect(variationDiffModalSource).not.toContain('translate("Restore baseline")');
  });

  it("commits rule renames from a dedicated input draft before variation serialization", () => {
    expect(editorSource).toContain('aria-label="rule name" v-model="ruleName"');
    expect(editorSource).toContain('activeRule.value.ruleName = nextRuleName');
    expect(editorSource).toContain('ruleName: ruleName.value');
  });

  it("treats a replaced simulation working copy as the clean authoritative state", () => {
    const workingCopyWatcher = editorSource.slice(
      editorSource.indexOf('watch(() => sim.working'),
      editorSource.indexOf('async function fetchRoutingGroupInformation')
    );

    expect(workingCopyWatcher).toContain('await initializeFromWorking()');
    expect(workingCopyWatcher).toContain('hasUnsavedChanges.value = false');
    expect(workingCopyWatcher).not.toContain('flushEditorDraft()');
  });

  it("keeps chat copy readable and makes the panel accessibly resizable", () => {
    expect(canvasSource).toContain('class="message-content"');
    expect(canvasSource).toContain('font-size: 1rem');
    expect(canvasSource).toContain('role="separator"');
    expect(canvasSource).toContain(':aria-valuenow="chatWidth"');
    expect(canvasSource).toContain('@pointerdown="startChatResize"');
    expect(canvasSource).toContain('@keydown="resizeChatWithKeyboard"');
    expect(canvasSource).toContain(":class=\"{ 'is-resizing': isResizingChat }\"");
    expect(canvasSource).toContain('border-inline: 1px solid var(--ion-color-medium)');
    expect(canvasSource).toContain('background: var(--ion-color-light)');
    expect(canvasSource).toContain('background: var(--ion-color-light-shade)');
  });
});
