import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readEnv } from "./env";

const KNOWLEDGE_SOURCE = {
  fileName: "hotwax_order_routing_domain_knowledge.yaml",
  label: "Deterministic HotWax order-routing domain knowledge",
  usage: "Use this as domain context for interpreting business intent, configuration patterns, prerequisites, and safe defaults."
};

const cachedKnowledgeText: Record<string, string> = {};
let cachedDiagnosticPatterns: DiagnosticPattern[] | undefined;

export type DiagnosticPatternIntent =
  | "config_lookup"
  | "behavior_diagnostic"
  | "environmental_audit"
  | "recommendation";

export type CanonicalToolId =
  | "facility_change_summary"
  | "brokering_facility_groups"
  | "product_store_settings"
  | "facility_order_limits";

export type RecommendationFormat = {
  mustOpenWith: string;
  eachRecommendationMustName: string[];
  forbiddenPhrasings: string[];
  minimumSpecificity: string;
};

export type DiagnosticPattern = {
  id: string;
  userQuestionExamples: string[];
  intent: DiagnosticPatternIntent;
  requires: CanonicalToolId[];
  diagnosticLevers: { lever: string; explanation: string }[];
  appropriateClarifyingQuestions: string[];
  inappropriateClarifyingQuestions: string[];
  recommendationFormat?: RecommendationFormat;
  reasoningWorkflow?: DiagnosticReasoningStep[];
  rejectionDiagnoses?: DiagnosticRejectionDiagnosis[];
};

export type DiagnosticReasoningStep = {
  step: string;
  action: string;
};

export type DiagnosticRejectionDiagnosis = {
  id: string;
  when: Record<string, unknown>;
  likelyCause: string;
  prescriptionTemplate: string;
  suggestedValueLogic?: string;
};

const VALID_INTENTS: readonly DiagnosticPatternIntent[] = [
  "config_lookup",
  "behavior_diagnostic",
  "environmental_audit",
  "recommendation"
];

const VALID_CANONICAL_TOOL_IDS: readonly CanonicalToolId[] = [
  "facility_change_summary",
  "brokering_facility_groups",
  "product_store_settings",
  "facility_order_limits"
];

export function getOrderRoutingDomainKnowledge() {
  const text = loadKnowledgeFile(KNOWLEDGE_SOURCE.fileName);
  if (!text) {
    return "";
  }

  return [
    "Order-routing knowledge base context.",
    "The page capability manifest remains the only authority for editable targets, valid option IDs, disabled controls, and the output contract.",
    `Source: ${KNOWLEDGE_SOURCE.label} (${KNOWLEDGE_SOURCE.fileName}). ${KNOWLEDGE_SOURCE.usage}`,
    text
  ].join("\n\n");
}

export function requireOrderRoutingDomainKnowledge() {
  const knowledge = getOrderRoutingDomainKnowledge();
  if (!knowledge.trim()) {
    throw new Error("Order-routing knowledge base is unavailable. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml.");
  }

  return knowledge;
}

export function loadOrderRoutingDomainKnowledge() {
  return loadKnowledgeFile(KNOWLEDGE_SOURCE.fileName) || "";
}

function loadKnowledgeFile(fileName: string) {
  if (cachedKnowledgeText[fileName] !== undefined) {
    return cachedKnowledgeText[fileName];
  }

  const knowledgePath = resolveKnowledgePath(fileName);
  cachedKnowledgeText[fileName] = knowledgePath ? readFileSync(knowledgePath, "utf8") : "";
  return cachedKnowledgeText[fileName];
}

function resolveKnowledgePath(fileName: string) {
  const mastraDir = dirname(fileURLToPath(import.meta.url));
  const overrideDir = readEnv("VITE_ORDER_ROUTING_KNOWLEDGE_DIR");
  const candidates = [
    overrideDir ? join(overrideDir, fileName) : "",
    join(mastraDir, "public", "knowledge", fileName),
    join(mastraDir, "knowledge", fileName),
    join(process.cwd(), "mastra", "public", "knowledge", fileName),
    join(process.cwd(), "public", "knowledge", fileName),
    join(process.cwd(), "knowledge", fileName)
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

export function getDiagnosticPatterns(): DiagnosticPattern[] {
  if (cachedDiagnosticPatterns) {
    return cachedDiagnosticPatterns;
  }

  const text = loadKnowledgeFile(KNOWLEDGE_SOURCE.fileName);
  if (!text) {
    throw new Error("Order-routing knowledge base is unavailable. Check mastra/public/knowledge/hotwax_order_routing_domain_knowledge.yaml.");
  }

  const raw = parseDiagnosticPatternsSection(text);
  cachedDiagnosticPatterns = raw.map(normalizePattern);
  return cachedDiagnosticPatterns;
}

type RawListItem = string | Record<string, string>;
type RawRecommendationFormat = Record<string, string | string[]>;
type RawValue = string | RawValue[] | { [key: string]: RawValue };
type RawPattern = Record<string, string | RawListItem[] | RawRecommendationFormat | RawValue[]>;

function parseDiagnosticPatternsSection(yamlText: string): RawPattern[] {
  const lines = yamlText.split(/\r?\n/);
  const startIdx = lines.findIndex((line) => /^diagnostic_patterns:\s*$/.test(line));
  if (startIdx === -1) {
    throw new Error("diagnostic_patterns section not found in order-routing knowledge YAML.");
  }

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || /^\s/.test(line) || line.startsWith("#")) continue;
    endIdx = i;
    break;
  }

  const section = lines.slice(startIdx + 1, endIdx);
  const patterns: RawPattern[] = [];
  let current: string[] | null = null;
  for (const line of section) {
    if (/^ {2}- id:\s*\S/.test(line)) {
      if (current) patterns.push(parsePatternBlock(current));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) patterns.push(parsePatternBlock(current));

  return patterns;
}

function parsePatternBlock(lines: string[]): RawPattern {
  const idMatch = lines[0].match(/^ {2}- id:\s*(\S.*)$/);
  if (!idMatch) {
    throw new Error(`Malformed diagnostic_pattern block header: ${lines[0]}`);
  }

  const fields: RawPattern = { id: parseScalarValue(idMatch[1]) };
  let i = 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      i++;
      continue;
    }

    const scalarMatch = line.match(/^ {4}([a-z_]+):\s*(.*)$/);
    if (!scalarMatch) {
      i++;
      continue;
    }

    const key = scalarMatch[1];
    const valueText = scalarMatch[2].trim();

    if (valueText === "") {
      if (key === "recommendation_format") {
        const nested = parseNestedObject(lines, i + 1, 6);
        fields[key] = nested.value;
        i = nested.nextIdx;
      } else if (key === "reasoning_workflow" || key === "rejection_diagnoses") {
        const list = parseRecursiveList(lines, i + 1, 6);
        fields[key] = list.value;
        i = list.nextIdx;
      } else {
        const list = parseList(lines, i + 1, 6);
        fields[key] = list.value;
        i = list.nextIdx;
      }
    } else if (valueText === "[]") {
      fields[key] = [];
      i++;
    } else {
      fields[key] = parseScalarValue(valueText);
      i++;
    }
  }

  return fields;
}

function parseNestedObject(lines: string[], startIdx: number, fieldIndent: number): { value: RawRecommendationFormat; nextIdx: number } {
  const result: RawRecommendationFormat = {};
  const fieldRegex = new RegExp(`^ {${fieldIndent}}([a-z_]+):\\s*(.*)$`);
  const contentIndent = fieldIndent + 2;
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      i++;
      continue;
    }

    const match = line.match(fieldRegex);
    if (!match) break;

    const key = match[1];
    const valueText = match[2].trim();

    if (valueText === "|") {
      const block = parseBlockScalar(lines, i + 1, contentIndent);
      result[key] = block.value;
      i = block.nextIdx;
    } else if (valueText === "") {
      const list = parseList(lines, i + 1, contentIndent);
      result[key] = list.value.map((item, index) => {
        if (typeof item !== "string") {
          throw new Error(`Nested list "${key}" entry ${index} must be a scalar string.`);
        }
        return item;
      });
      i = list.nextIdx;
    } else if (valueText === "[]") {
      result[key] = [];
      i++;
    } else {
      result[key] = parseScalarValue(valueText);
      i++;
    }
  }

  return { value: result, nextIdx: i };
}

function parseBlockScalar(lines: string[], startIdx: number, contentIndent: number): { value: string; nextIdx: number } {
  const prefix = " ".repeat(contentIndent);
  const chunks: string[] = [];
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line === "") {
      chunks.push("");
      i++;
      continue;
    }
    if (line.startsWith(prefix)) {
      chunks.push(line.slice(contentIndent));
      i++;
    } else {
      break;
    }
  }

  while (chunks.length > 0 && chunks[chunks.length - 1] === "") chunks.pop();
  return { value: chunks.join("\n"), nextIdx: i };
}

function parseList(lines: string[], startIdx: number, itemIndent: number): { value: RawListItem[]; nextIdx: number } {
  const result: RawListItem[] = [];
  const itemPrefix = `${" ".repeat(itemIndent)}- `;
  const contIndent = " ".repeat(itemIndent + 2);
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      i++;
      continue;
    }

    if (!line.startsWith(itemPrefix)) break;

    const rest = line.slice(itemPrefix.length);
    const kvMatch = rest.match(/^([a-z_]+):\s*(.*)$/);
    if (kvMatch && kvMatch[2].trim() !== "") {
      const obj: Record<string, string> = { [kvMatch[1]]: parseScalarValue(kvMatch[2]) };
      i++;
      while (i < lines.length) {
        const contLine = lines[i];
        if (contLine.trim() === "" || contLine.trimStart().startsWith("#")) {
          i++;
          continue;
        }
        if (contLine.startsWith(itemPrefix)) break;
        if (!contLine.startsWith(contIndent)) break;
        const contMatch = contLine.slice(contIndent.length).match(/^([a-z_]+):\s*(.*)$/);
        if (!contMatch) break;
        obj[contMatch[1]] = parseScalarValue(contMatch[2]);
        i++;
      }
      result.push(obj);
    } else {
      result.push(parseScalarValue(rest));
      i++;
    }
  }

  return { value: result, nextIdx: i };
}

function parseRecursiveList(lines: string[], startIdx: number, itemIndent: number): { value: RawValue[]; nextIdx: number } {
  const result: RawValue[] = [];
  const itemPrefix = `${" ".repeat(itemIndent)}- `;
  const contIndent = itemIndent + 2;
  const contPrefix = " ".repeat(contIndent);
  const keyRegex = /^([A-Za-z_][A-Za-z0-9_.]*):\s*(.*)$/;
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      i++;
      continue;
    }
    if (!line.startsWith(itemPrefix)) break;

    const rest = line.slice(itemPrefix.length);
    const kvMatch = rest.match(keyRegex);
    if (!kvMatch) {
      result.push(parseScalarValue(rest));
      i++;
      continue;
    }

    const obj: { [key: string]: RawValue } = {};
    let nextI = i + 1;
    nextI = absorbKeyValue(lines, nextI, contIndent, kvMatch[1], kvMatch[2].trim(), obj);

    while (nextI < lines.length) {
      const contLine = lines[nextI];
      if (contLine.trim() === "" || contLine.trimStart().startsWith("#")) {
        nextI++;
        continue;
      }
      if (contLine.startsWith(itemPrefix)) break;
      if (!contLine.startsWith(contPrefix)) break;
      const remainder = contLine.slice(contIndent);
      if (/^\s/.test(remainder)) break;
      const contMatch = remainder.match(keyRegex);
      if (!contMatch) break;
      nextI = absorbKeyValue(lines, nextI + 1, contIndent, contMatch[1], contMatch[2].trim(), obj);
    }

    result.push(obj);
    i = nextI;
  }

  return { value: result, nextIdx: i };
}

function parseRecursiveObject(lines: string[], startIdx: number, fieldIndent: number): { value: { [key: string]: RawValue }; nextIdx: number } {
  const result: { [key: string]: RawValue } = {};
  const fieldPrefix = " ".repeat(fieldIndent);
  const keyRegex = /^([A-Za-z_][A-Za-z0-9_.]*):\s*(.*)$/;
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      i++;
      continue;
    }
    if (!line.startsWith(fieldPrefix)) break;
    const remainder = line.slice(fieldIndent);
    if (/^\s/.test(remainder)) break;
    const match = remainder.match(keyRegex);
    if (!match) break;
    i = absorbKeyValue(lines, i + 1, fieldIndent, match[1], match[2].trim(), result);
  }

  return { value: result, nextIdx: i };
}

function absorbKeyValue(
  lines: string[],
  afterKeyIdx: number,
  keyIndent: number,
  key: string,
  valueText: string,
  target: { [key: string]: RawValue }
): number {
  const childIndent = keyIndent + 2;
  if (valueText === "|") {
    const block = parseBlockScalar(lines, afterKeyIdx, childIndent);
    target[key] = block.value;
    return block.nextIdx;
  }
  if (valueText === "[]") {
    target[key] = [];
    return afterKeyIdx;
  }
  if (valueText === "") {
    const kind = peekStructureKind(lines, afterKeyIdx, childIndent);
    if (kind === "list") {
      const sub = parseRecursiveList(lines, afterKeyIdx, childIndent);
      target[key] = sub.value;
      return sub.nextIdx;
    }
    if (kind === "object") {
      const sub = parseRecursiveObject(lines, afterKeyIdx, childIndent);
      target[key] = sub.value;
      return sub.nextIdx;
    }
    target[key] = "";
    return afterKeyIdx;
  }
  target[key] = parseScalarValue(valueText);
  return afterKeyIdx;
}

function peekStructureKind(lines: string[], startIdx: number, indent: number): "list" | "object" | null {
  const prefix = " ".repeat(indent);
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!line.startsWith(prefix)) return null;
    const remainder = line.slice(indent);
    if (/^\s/.test(remainder)) return null;
    if (remainder.startsWith("- ")) return "list";
    if (/^[A-Za-z_][A-Za-z0-9_.]*\s*:/.test(remainder)) return "object";
    return null;
  }
  return null;
}

function parseScalarValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) {
    const close = trimmed.indexOf('"', 1);
    if (close > 0) {
      return trimmed.slice(1, close);
    }
  }
  if (trimmed.startsWith("'")) {
    const close = trimmed.indexOf("'", 1);
    if (close > 0) {
      return trimmed.slice(1, close);
    }
  }
  const commentIdx = trimmed.indexOf(" #");
  if (commentIdx >= 0) {
    return trimmed.slice(0, commentIdx).trimEnd();
  }
  return trimmed;
}

function normalizePattern(raw: RawPattern): DiagnosticPattern {
  const id = expectString(raw, "id");
  const intentValue = expectString(raw, "intent", id);
  if (!VALID_INTENTS.includes(intentValue as DiagnosticPatternIntent)) {
    throw new Error(`diagnostic_pattern "${id}" has invalid intent "${intentValue}". Expected one of: ${VALID_INTENTS.join(", ")}.`);
  }

  const userQuestionExamples = expectStringList(raw, "user_question_examples", id);
  const requiresRaw = expectStringList(raw, "requires", id);
  for (const tool of requiresRaw) {
    if (!VALID_CANONICAL_TOOL_IDS.includes(tool as CanonicalToolId)) {
      throw new Error(`diagnostic_pattern "${id}" requires unknown canonical tool ID "${tool}". Expected one of: ${VALID_CANONICAL_TOOL_IDS.join(", ")}.`);
    }
  }

  const diagnosticLevers = expectObjectList(raw, "diagnostic_levers", id).map((entry) => {
    const lever = entry.lever;
    const explanation = entry.explanation;
    if (!lever || !explanation) {
      throw new Error(`diagnostic_pattern "${id}" has a diagnostic_levers entry missing "lever" or "explanation".`);
    }
    return { lever, explanation };
  });

  const result: DiagnosticPattern = {
    id,
    userQuestionExamples,
    intent: intentValue as DiagnosticPatternIntent,
    requires: requiresRaw as CanonicalToolId[],
    diagnosticLevers,
    appropriateClarifyingQuestions: expectStringList(raw, "appropriate_clarifying_questions", id),
    inappropriateClarifyingQuestions: expectStringList(raw, "inappropriate_clarifying_questions", id)
  };

  const rawFormat = raw["recommendation_format"];
  if (rawFormat !== undefined) {
    result.recommendationFormat = normalizeRecommendationFormat(rawFormat, id);
  }

  const rawWorkflow = raw["reasoning_workflow"];
  if (rawWorkflow !== undefined) {
    result.reasoningWorkflow = normalizeReasoningWorkflow(rawWorkflow, id);
  }

  const rawDiagnoses = raw["rejection_diagnoses"];
  if (rawDiagnoses !== undefined) {
    result.rejectionDiagnoses = normalizeRejectionDiagnoses(rawDiagnoses, id);
  }

  return result;
}

function normalizeReasoningWorkflow(value: RawPattern[string], patternId: string): DiagnosticReasoningStep[] {
  if (!Array.isArray(value)) {
    throw new Error(`diagnostic_pattern "${patternId}" reasoning_workflow must be a list.`);
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`diagnostic_pattern "${patternId}" reasoning_workflow entry ${index} must be a mapping.`);
    }
    const step = (entry as Record<string, unknown>).step;
    const action = (entry as Record<string, unknown>).action;
    if (typeof step !== "string" || step.trim() === "") {
      throw new Error(`diagnostic_pattern "${patternId}" reasoning_workflow entry ${index} must have a non-empty "step".`);
    }
    if (typeof action !== "string" || action.trim() === "") {
      throw new Error(`diagnostic_pattern "${patternId}" reasoning_workflow entry ${index} must have a non-empty "action".`);
    }
    return { step, action };
  });
}

function normalizeRejectionDiagnoses(value: RawPattern[string], patternId: string): DiagnosticRejectionDiagnosis[] {
  if (!Array.isArray(value)) {
    throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses must be a list.`);
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses entry ${index} must be a mapping.`);
    }
    const record = entry as Record<string, unknown>;
    const diagId = record.id;
    const when = record.when;
    const likelyCause = record.likely_cause;
    const prescriptionTemplate = record.prescription_template;
    const suggestedValueLogic = record.suggested_value_logic;
    if (typeof diagId !== "string" || diagId.trim() === "") {
      throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses entry ${index} must have a non-empty "id".`);
    }
    if (!when || typeof when !== "object" || Array.isArray(when)) {
      throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses entry "${diagId}" must have a "when" mapping.`);
    }
    if (typeof likelyCause !== "string" || likelyCause.trim() === "") {
      throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses entry "${diagId}" must have a non-empty "likely_cause".`);
    }
    if (typeof prescriptionTemplate !== "string" || prescriptionTemplate.trim() === "") {
      throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses entry "${diagId}" must have a non-empty "prescription_template".`);
    }
    if (suggestedValueLogic !== undefined && (typeof suggestedValueLogic !== "string" || suggestedValueLogic.trim() === "")) {
      throw new Error(`diagnostic_pattern "${patternId}" rejection_diagnoses entry "${diagId}" suggested_value_logic must be a non-empty string when present.`);
    }
    const diagnosis: DiagnosticRejectionDiagnosis = {
      id: diagId,
      when: when as Record<string, unknown>,
      likelyCause,
      prescriptionTemplate
    };
    if (typeof suggestedValueLogic === "string") {
      diagnosis.suggestedValueLogic = suggestedValueLogic;
    }
    return diagnosis;
  });
}

function normalizeRecommendationFormat(value: RawPattern[string], patternId: string): RecommendationFormat {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`diagnostic_pattern "${patternId}" recommendation_format must be a mapping.`);
  }

  const mustOpenWith = (value as Record<string, unknown>)["must_open_with"];
  const eachRecommendationMustName = (value as Record<string, unknown>)["each_recommendation_must_name"];
  const forbiddenPhrasings = (value as Record<string, unknown>)["forbidden_phrasings"];
  const minimumSpecificity = (value as Record<string, unknown>)["minimum_specificity"];

  if (typeof mustOpenWith !== "string" || mustOpenWith.trim() === "") {
    throw new Error(`diagnostic_pattern "${patternId}" recommendation_format.must_open_with must be a non-empty string.`);
  }
  if (typeof minimumSpecificity !== "string" || minimumSpecificity.trim() === "") {
    throw new Error(`diagnostic_pattern "${patternId}" recommendation_format.minimum_specificity must be a non-empty string.`);
  }
  if (!Array.isArray(eachRecommendationMustName) || eachRecommendationMustName.length === 0) {
    throw new Error(`diagnostic_pattern "${patternId}" recommendation_format.each_recommendation_must_name must be a non-empty list.`);
  }
  if (!Array.isArray(forbiddenPhrasings) || forbiddenPhrasings.length === 0) {
    throw new Error(`diagnostic_pattern "${patternId}" recommendation_format.forbidden_phrasings must be a non-empty list.`);
  }
  for (const [index, item] of eachRecommendationMustName.entries()) {
    if (typeof item !== "string") {
      throw new Error(`diagnostic_pattern "${patternId}" recommendation_format.each_recommendation_must_name entry ${index} is not a string.`);
    }
  }
  for (const [index, item] of forbiddenPhrasings.entries()) {
    if (typeof item !== "string") {
      throw new Error(`diagnostic_pattern "${patternId}" recommendation_format.forbidden_phrasings entry ${index} is not a string.`);
    }
  }

  return {
    mustOpenWith,
    eachRecommendationMustName: eachRecommendationMustName as string[],
    forbiddenPhrasings: forbiddenPhrasings as string[],
    minimumSpecificity
  };
}

function expectString(raw: RawPattern, key: string, patternId?: string): string {
  const value = raw[key];
  if (typeof value !== "string") {
    throw new Error(`diagnostic_pattern${patternId ? ` "${patternId}"` : ""} is missing required scalar field "${key}".`);
  }
  return value;
}

function expectStringList(raw: RawPattern, key: string, patternId: string): string[] {
  const value = raw[key];
  if (!Array.isArray(value)) {
    throw new Error(`diagnostic_pattern "${patternId}" is missing required list field "${key}".`);
  }
  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new Error(`diagnostic_pattern "${patternId}" field "${key}" entry ${index} is not a scalar string.`);
    }
    return item;
  });
}

function expectObjectList(raw: RawPattern, key: string, patternId: string): Record<string, string>[] {
  const value = raw[key];
  if (!Array.isArray(value)) {
    throw new Error(`diagnostic_pattern "${patternId}" is missing required list field "${key}".`);
  }
  return value.map((item, index) => {
    if (typeof item === "string" || Array.isArray(item)) {
      throw new Error(`diagnostic_pattern "${patternId}" field "${key}" entry ${index} is not a mapping.`);
    }
    return item;
  });
}
