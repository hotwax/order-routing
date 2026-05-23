import assert from "assert";
import {
  getDiagnosticPatterns,
  requireOrderRoutingDomainKnowledge,
  type CanonicalToolId,
  type DiagnosticPattern,
  type DiagnosticPatternIntent
} from "../mastra/orderRoutingDomainKnowledge";

const VALID_INTENTS: DiagnosticPatternIntent[] = [
  "config_lookup",
  "behavior_diagnostic",
  "environmental_audit",
  "recommendation"
];

const VALID_CANONICAL_TOOL_IDS: CanonicalToolId[] = [
  "facility_change_summary",
  "brokering_facility_groups",
  "product_store_settings",
  "facility_order_limits"
];

const PHASE_1_HUF_TOOL_IDS: CanonicalToolId[] = [
  "facility_change_summary",
  "brokering_facility_groups",
  "product_store_settings",
  "facility_order_limits"
];

function findPattern(patterns: DiagnosticPattern[], id: string): DiagnosticPattern {
  const match = patterns.find((pattern) => pattern.id === id);
  if (!match) {
    throw new Error(`Expected diagnostic pattern "${id}" to be present`);
  }
  return match;
}

const patterns = getDiagnosticPatterns();

assert.equal(patterns.length, 3, "expected three diagnostic patterns (Phase 1 set)");

const ids = patterns.map((pattern) => pattern.id).sort();
assert.deepEqual(
  ids,
  ["environmental_audit_overview", "facility_concentration", "high_unfillable_rate"],
  "diagnostic pattern IDs do not match expected set"
);

for (const pattern of patterns) {
  assert.ok(
    VALID_INTENTS.includes(pattern.intent),
    `pattern "${pattern.id}" has invalid intent "${pattern.intent}"`
  );
  assert.ok(
    Array.isArray(pattern.userQuestionExamples) && pattern.userQuestionExamples.length > 0,
    `pattern "${pattern.id}" must have user question examples`
  );
  assert.ok(
    Array.isArray(pattern.requires),
    `pattern "${pattern.id}" requires must be an array`
  );
  for (const tool of pattern.requires) {
    assert.ok(
      VALID_CANONICAL_TOOL_IDS.includes(tool),
      `pattern "${pattern.id}" requires invalid canonical tool ID "${tool}"`
    );
  }
}

const highUnfillable = findPattern(patterns, "high_unfillable_rate");
assert.deepEqual(
  [...highUnfillable.requires].sort(),
  [...PHASE_1_HUF_TOOL_IDS].sort(),
  "high_unfillable_rate must still require its original four canonical tools"
);
assert.equal(highUnfillable.intent, "recommendation");
assert.ok(
  highUnfillable.diagnosticLevers.length >= 1,
  "high_unfillable_rate must declare diagnostic levers"
);
assert.ok(
  highUnfillable.inappropriateClarifyingQuestions.length > 0,
  "high_unfillable_rate must list inappropriate clarifying questions"
);
assert.ok(
  highUnfillable.diagnosticLevers.every(
    (lever) => typeof lever.lever === "string" && typeof lever.explanation === "string" && lever.explanation.length > 0
  ),
  "high_unfillable_rate diagnostic levers must each have lever + explanation strings"
);

const facilityConcentration = findPattern(patterns, "facility_concentration");
assert.equal(facilityConcentration.intent, "recommendation");
assert.ok(
  facilityConcentration.inappropriateClarifyingQuestions.length > 0,
  "facility_concentration must list inappropriate clarifying questions"
);

const envAudit = findPattern(patterns, "environmental_audit_overview");
assert.equal(envAudit.intent, "environmental_audit");
assert.equal(envAudit.requires.length, 3, "environmental_audit_overview must require exactly three tools");
assert.ok(
  !envAudit.requires.includes("facility_change_summary"),
  "environmental_audit_overview must NOT require facility_change_summary"
);
assert.deepEqual(
  [...envAudit.requires].sort(),
  ["brokering_facility_groups", "facility_order_limits", "product_store_settings"]
);
assert.deepEqual(envAudit.diagnosticLevers, [], "environmental_audit_overview should have no diagnostic levers");
assert.deepEqual(envAudit.appropriateClarifyingQuestions, [], "environmental_audit_overview should have no appropriate clarifying questions");
assert.equal(envAudit.recommendationFormat, undefined, "environmental_audit_overview must not declare a recommendation_format");

// recommendationFormat — present on both recommendation patterns, with the right shape.
for (const recommendationPattern of [highUnfillable, facilityConcentration]) {
  const format = recommendationPattern.recommendationFormat;
  assert.ok(format, `pattern "${recommendationPattern.id}" must declare a recommendationFormat`);
  assert.ok(
    typeof format.mustOpenWith === "string" && format.mustOpenWith.trim().length > 0,
    `pattern "${recommendationPattern.id}" must_open_with must be a non-empty string`
  );
  assert.ok(
    typeof format.minimumSpecificity === "string" && format.minimumSpecificity.trim().length > 0,
    `pattern "${recommendationPattern.id}" minimum_specificity must be a non-empty string`
  );
  assert.ok(
    Array.isArray(format.eachRecommendationMustName) && format.eachRecommendationMustName.length > 0,
    `pattern "${recommendationPattern.id}" each_recommendation_must_name must be a non-empty list`
  );
  assert.ok(
    Array.isArray(format.forbiddenPhrasings) && format.forbiddenPhrasings.length > 0,
    `pattern "${recommendationPattern.id}" forbidden_phrasings must be a non-empty list`
  );
  for (const phrase of format.forbiddenPhrasings) {
    assert.ok(
      !phrase.includes("#"),
      `pattern "${recommendationPattern.id}" forbidden phrase "${phrase}" leaked an inline YAML comment`
    );
    assert.equal(phrase, phrase.trim(), `pattern "${recommendationPattern.id}" forbidden phrase should be trimmed`);
  }
}

// Block-scalar content from the user-provided high_unfillable_rate spec must be preserved verbatim
// (newline-joined) so the response agent can quote it. Spot-check anchor phrases on both lines.
const hufFormatPresent = highUnfillable.recommendationFormat;
assert.ok(hufFormatPresent, "high_unfillable_rate.recommendationFormat must be present");
const hufFormat = hufFormatPresent;
assert.ok(
  hufFormat.mustOpenWith.startsWith("Identify the specific brokering run + rule"),
  "must_open_with should start with the spec-provided sentence"
);
assert.ok(
  hufFormat.mustOpenWith.includes("groupName + routingRuleName + sequenceNum"),
  "must_open_with should retain the entity-naming clause from line 2 of the block scalar"
);
assert.ok(
  hufFormat.minimumSpecificity.includes("open the run, find the named rule"),
  "minimum_specificity should retain wording across the block scalar"
);
assert.deepEqual(
  hufFormat.forbiddenPhrasings,
  ["consider", "you could", "try", "might want to", "broaden your filters"],
  "high_unfillable_rate forbidden_phrasings must match spec exactly with inline comments stripped"
);
assert.ok(
  hufFormat.eachRecommendationMustName.some((item) => item.includes("routing_group")),
  "each_recommendation_must_name should name routing_group"
);
assert.ok(
  hufFormat.eachRecommendationMustName.some((item) => item.includes("FACILITY_GROUP filter")),
  "each_recommendation_must_name should name the FACILITY_GROUP filter field"
);

// reasoning_workflow + rejection_diagnoses present on high_unfillable_rate (Phase 1).
const hufWorkflow = highUnfillable.reasoningWorkflow;
assert.ok(hufWorkflow, "high_unfillable_rate must declare reasoningWorkflow");
assert.ok(Array.isArray(hufWorkflow), "high_unfillable_rate.reasoningWorkflow must be an array");
assert.equal(
  hufWorkflow.length,
  5,
  "high_unfillable_rate.reasoningWorkflow must have exactly 5 steps"
);
const expectedSteps = ["parse_comments", "lookup_rule_config", "attribute_impact", "diagnose_and_prescribe", "order_by_impact"];
assert.deepEqual(
  hufWorkflow.map((step) => step.step),
  expectedSteps,
  "high_unfillable_rate.reasoningWorkflow step IDs must match declared sequence"
);
for (const step of hufWorkflow) {
  assert.ok(
    typeof step.step === "string" && step.step.length > 0,
    `reasoningWorkflow step "${step.step}" must have non-empty step`
  );
  assert.ok(
    typeof step.action === "string" && step.action.length > 0,
    `reasoningWorkflow step "${step.step}" must have non-empty action`
  );
}

const hufDiagnoses = highUnfillable.rejectionDiagnoses;
assert.ok(hufDiagnoses, "high_unfillable_rate must declare rejectionDiagnoses");
assert.ok(Array.isArray(hufDiagnoses), "high_unfillable_rate.rejectionDiagnoses must be an array");
assert.equal(
  hufDiagnoses.length,
  5,
  "high_unfillable_rate.rejectionDiagnoses must have exactly 5 entries"
);
const expectedDiagnoses = ["tight_safety_stock", "narrow_facility_group", "tight_proximity", "no_partial_allocation", "no_fallback_rule"];
assert.deepEqual(
  hufDiagnoses.map((diagnosis) => diagnosis.id),
  expectedDiagnoses,
  "high_unfillable_rate.rejectionDiagnoses IDs must match declared sequence"
);
for (const diagnosis of hufDiagnoses) {
  assert.ok(
    typeof diagnosis.id === "string" && diagnosis.id.length > 0,
    `rejectionDiagnosis "${diagnosis.id}" must have non-empty id`
  );
  assert.ok(
    diagnosis.when && typeof diagnosis.when === "object" && !Array.isArray(diagnosis.when),
    `rejectionDiagnosis "${diagnosis.id}" must have a "when" mapping`
  );
  assert.ok(
    Object.keys(diagnosis.when).length > 0,
    `rejectionDiagnosis "${diagnosis.id}" "when" mapping must have at least one key`
  );
  assert.ok(
    typeof diagnosis.likelyCause === "string" && diagnosis.likelyCause.length > 0,
    `rejectionDiagnosis "${diagnosis.id}" must have non-empty likelyCause`
  );
  assert.ok(
    typeof diagnosis.prescriptionTemplate === "string" && diagnosis.prescriptionTemplate.length > 0,
    `rejectionDiagnosis "${diagnosis.id}" must have non-empty prescriptionTemplate`
  );
}

// Other patterns must still parse and must NOT declare these new fields (Phase 1 scope).
assert.equal(
  facilityConcentration.reasoningWorkflow,
  undefined,
  "facility_concentration must not declare reasoningWorkflow in Phase 1"
);
assert.equal(
  facilityConcentration.rejectionDiagnoses,
  undefined,
  "facility_concentration must not declare rejectionDiagnoses in Phase 1"
);
assert.equal(
  envAudit.reasoningWorkflow,
  undefined,
  "environmental_audit_overview must not declare reasoningWorkflow in Phase 1"
);
assert.equal(
  envAudit.rejectionDiagnoses,
  undefined,
  "environmental_audit_overview must not declare rejectionDiagnoses in Phase 1"
);

// Loader does not throw when reasoning_workflow / rejection_diagnoses are absent on a pattern.
// Verified by getDiagnosticPatterns() succeeding above — facility_concentration and
// environmental_audit_overview omit both fields and the loader returned a normalized array.
assert.equal(patterns.length, 3, "loader must still produce three patterns even though two omit the new fields");

// Cache identity check — repeat calls return the same parsed array.
assert.strictEqual(getDiagnosticPatterns(), patterns, "getDiagnosticPatterns should cache its result");

// Existing string-export path stays intact for the route assistant.
const opaque = requireOrderRoutingDomainKnowledge();
assert.ok(typeof opaque === "string" && opaque.length > 0, "requireOrderRoutingDomainKnowledge must still return non-empty string");
assert.ok(opaque.includes("diagnostic_patterns"), "knowledge text should include the new diagnostic_patterns section");

console.log("diagnosticPatterns tests passed");
