// src/types/draft.ts
// Type definitions for the Circuit / Mastra draft assistant pipeline.
// Pure TS — no runtime imports.

export type DraftValue = string | number | boolean | string[];

export type DraftOperationReason = {
  kind: "explicit_user_request" | "manifest_dependency";
  promptText: string;
  explanation: string;
  dependencyTarget?: string;
};

export type DraftOperation = {
  op: "set";
  target: string;
  value?: DraftValue;
  reason?: DraftOperationReason;
  ruleKey?: string;
  ruleName?: string;
  ruleSequence?: number;
};

export type DraftConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DraftOperationSet = {
  operations: DraftOperation[];
  unansweredQuestions: string[];
  summary: string;
  intent?: "edit" | "inquiry";
  targetRouting?: {
    action: "edit" | "create";
    routingKey?: string;
    name?: string;
  };
};

type OptionSelection = {
  include: string[];
  exclude: string[];
};

type BrokeringRouteDraftRule = {
  ruleKey: string;
  name: string;
  statusId: "RULE_DRAFT" | "RULE_ACTIVE" | "RULE_ARCHIVED";
  sequence: number;
  inventorySelection: {
    filters: {
      facilityGroups: OptionSelection;
      proximity: {
        maxDistance: number | null;
        unit: "METRIC" | "IMPERIAL" | null;
      };
      safetyStock: {
        minimum: number | null;
      };
      facilityOrderLimit: "respect" | "bypass" | "unchanged";
      shipmentThreshold: number | null;
    };
    sorts: Array<{
      field: "proximity" | "inventoryBalance" | "customerSequence";
      direction: "asc" | "desc";
    }>;
  };
  allocation: {
    partialOrderAllocation: boolean;
    partialGroupedItemAllocation: boolean;
  };
  unavailableItems: {
    action: "nextRule" | "moveToQueue";
    queueId: string | null;
    autoCancel: {
      mode: "none" | "clear" | "days";
      days: number | null;
    };
  };
};

export type BrokeringRouteDraft = {
  schemaVersion: "brokering-route-draft.v1";
  applyMode: "merge" | "replace";
  targetRouting?: {
    action: "edit" | "create";
    routingKey?: string;
    name?: string;
  };
  route: {
    statusId: "ROUTING_DRAFT" | "ROUTING_ACTIVE" | "ROUTING_ARCHIVED";
    orderSelection: {
      filters: {
        queues: OptionSelection;
        shippingMethods: OptionSelection;
        priorities: OptionSelection;
        promiseDateDays: {
          max: number | null;
          excludeMax: number | null;
        };
        salesChannels: OptionSelection;
        originFacilityGroups: OptionSelection;
      };
      sorts: Array<{
        field: "shipByDate" | "shipAfterDate" | "orderDate" | "shippingMethod" | "priority";
        direction: "asc" | "desc";
      }>;
    };
    inventoryRules: BrokeringRouteDraftRule[];
  };
  questions: string[];
  summary: string;
};

export type DraftProposal = {
  operations: DraftOperation[];
  unansweredQuestions: string[];
  summary: string;
  providerSummary: string;
  intent?: "edit" | "inquiry";
  newRouting?: { routingKey: string; name: string };
};

export type DraftValueType = "string" | "number" | "boolean" | "enum" | "string[]";

export type DraftOption = {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  disabled?: boolean;
  disabledReason?: string;
};

export type DraftTargetDependency = {
  target: string;
  values: DraftValue[];
  description?: string;
};

export type DraftTargetCapability = {
  target: string;
  label: string;
  description?: string;
  aliases?: string[];
  entity?: string;
  valueType: DraftValueType;
  currentValue?: DraftValue;
  options?: DraftOption[];
  multiple?: boolean;
  editable: boolean;
  disabled?: boolean;
  disabledReason?: string;
  staticDisabled?: boolean;
  dependencies?: DraftTargetDependency[];
};

export type PageCapabilityManifest = {
  pageId: string;
  route: string;
  visibleEntities: Record<string, unknown>;
  editableTargets: DraftTargetCapability[];
  outputContract: {
    operations: DraftOperation["op"][];
    operationShape: Record<string, string>;
    responseShape: Record<string, string>;
  };
};

export type DraftValidationResult = {
  operations: DraftOperation[];
  unansweredQuestions: string[];
};

export type DraftApplyResult = {
  appliedCount: number;
  skipped: string[];
  unansweredQuestions: string[];
};

export type DraftTargetBinding = {
  target: string;
  setValue: (value: DraftValue, operation: DraftOperation) => void | boolean;
  afterApply?: (operation: DraftOperation) => void;
};

export type DraftTargetBindings = Record<string, DraftTargetBinding>;

export interface ApplyDraftProposalContext {
  createSiblingRouting: (name: string) => Promise<string>;
  selectRouting: (orderRoutingId: string) => void;
  buildBindings: () => DraftTargetBindings;
}
