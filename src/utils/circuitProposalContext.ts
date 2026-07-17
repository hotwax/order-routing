import type { DraftOperation, DraftProposal, DraftValue } from "@/types/draft";
import type { RoutingConfigSection, RoutingConfigSectionKind } from "@/types/routingConfigSection";
import { humanizeRoutingConfigValue, routingConfigTargetLabel } from "@/utils/routingConfigSection";

export function buildCircuitProposalContextCards(
  proposal: Pick<DraftProposal, "operations" | "newRouting"> | null | undefined
): RoutingConfigSection[] {
  const cards = new Map<string, RoutingConfigSection>();

  if (proposal?.newRouting) {
    cards.set("new-routing:routing", {
      key: "new-routing:routing",
      eyebrow: "Routing",
      title: "New routing",
      kind: "routing",
      items: [{
        target: "newRouting.name",
        label: routingConfigTargetLabel("newRouting.name"),
        value: proposal.newRouting.name,
        dirty: true
      }]
    });
  }

  (proposal?.operations || []).forEach((operation) => {
    const identity = proposalCardIdentity(operation);
    const card = cards.get(identity.key) || { ...identity, items: [] };
    card.items.push({
      target: operation.target,
      label: routingConfigTargetLabel(operation.target),
      value: proposalValueLabel(operation.value, identity.kind),
      dirty: true
    });
    cards.set(identity.key, card);
  });

  return [...cards.values()];
}

function proposalCardIdentity(operation: DraftOperation) {
  const section = proposalCardSection(operation.target);
  const isRuleSetting = operation.target.startsWith("selectedRule.");
  const scopeKey = isRuleSetting ? `rule:${operation.ruleKey || "selected"}` : "route";

  return {
    key: `${scopeKey}:${section.kind}`,
    eyebrow: isRuleSetting ? operation.ruleName || "Selected routing rule" : "Routing",
    title: section.title,
    kind: section.kind
  };
}

function proposalCardSection(target: string): { kind: RoutingConfigSectionKind; title: string } {
  if (target.startsWith("route.orderFilters.") || target.startsWith("selectedRule.inventoryFilters.")) {
    return { kind: "filters", title: "Filters" };
  }
  if (target.startsWith("route.orderSorts.") || target.startsWith("selectedRule.inventorySorts.")) {
    return { kind: "sort", title: "Sort" };
  }
  if (target === "selectedRule.partialAllocation" || target === "selectedRule.partialGroupItemsAllocation") {
    return { kind: "partial", title: "Partially available" };
  }
  if ([
    "selectedRule.unavailableItemsAction",
    "selectedRule.unavailableItemsQueueId",
    "selectedRule.clearAutoCancelDays",
    "selectedRule.autoCancelDays"
  ].includes(target)) {
    return { kind: "unavailable", title: "Unavailable items" };
  }
  if (target.startsWith("route.")) return { kind: "routing", title: "Routing settings" };
  return {
    kind: "rule",
    title: "Rule settings"
  };
}

function proposalValueLabel(value: DraftValue | undefined, kind: RoutingConfigSectionKind) {
  if (kind === "sort" && value === true) return "";
  if (kind === "sort" && value === false) return "Removed";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === undefined || value === null || value === "") return "None";
  return humanizeRoutingConfigValue(String(value));
}
