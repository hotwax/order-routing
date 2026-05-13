import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MAX_CHARS = 22000;
const KNOWLEDGE_SOURCES = [
  {
    fileName: "hotwax_order_routing_domain_knowledge.yaml",
    label: "Deterministic HotWax order-routing domain knowledge",
    usage: "Use this as domain context for interpreting business intent, configuration patterns, prerequisites, and safe defaults.",
    maxChars: 15000
  }
];
const cachedKnowledgeText: Record<string, string> = {};

type ScoredChunk = {
  chunk: string;
  score: number;
  index: number;
};

export function getOrderRoutingDomainKnowledge(prompt: string, maxChars = DEFAULT_MAX_CHARS) {
  const promptTokens = new Set(tokenize(prompt));
  let remainingChars = maxChars;
  const sections = KNOWLEDGE_SOURCES.flatMap((source) => {
    if (remainingChars <= 0) {
      return [];
    }

    const knowledgeText = loadKnowledgeFile(source.fileName);
    if (!knowledgeText) {
      return [];
    }

    const chunks = chunkKnowledge(knowledgeText);
    const scoredChunks = chunks
      .map((chunk, index) => ({
        chunk,
        index,
        score: scoreChunk(chunk, promptTokens)
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index);

    const selectedChunks = selectChunks(scoredChunks, Math.min(source.maxChars, remainingChars));
    if (!selectedChunks.length) {
      return [];
    }

    const section = [
      `Source: ${source.label} (${source.fileName}).`,
      source.usage,
      ...selectedChunks
    ].join("\n\n");
    remainingChars -= section.length;
    return [section];
  });

  if (!sections.length) {
    return "";
  }

  return [
    "Order-routing knowledge base context.",
    "The page capability manifest remains the only authority for editable targets, valid option IDs, disabled controls, and the output contract.",
    ...sections
  ].join("\n\n");
}

export function requireOrderRoutingDomainKnowledge(prompt: string, maxChars = DEFAULT_MAX_CHARS) {
  const knowledge = getOrderRoutingDomainKnowledge(prompt, maxChars);
  if (!knowledge.trim()) {
    throw new Error("Order-routing knowledge base is unavailable or no excerpt could be selected.");
  }

  return knowledge;
}

export function loadOrderRoutingDomainKnowledge() {
  return KNOWLEDGE_SOURCES
    .map((source) => loadKnowledgeFile(source.fileName))
    .filter(Boolean)
    .join("\n\n");
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
  const candidates = [
    process.env.ORDER_ROUTING_KNOWLEDGE_DIR
      ? join(process.env.ORDER_ROUTING_KNOWLEDGE_DIR, fileName)
      : "",
    join(mastraDir, "public", "knowledge", fileName),
    join(mastraDir, "knowledge", fileName),
    join(process.cwd(), "mastra", "public", "knowledge", fileName),
    join(process.cwd(), "public", "knowledge", fileName),
    join(process.cwd(), "knowledge", fileName)
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function chunkKnowledge(knowledgeText: string) {
  const lines = knowledgeText.split(/\r?\n/);
  const chunks: string[] = [];
  const maxChunkChars = 3500;
  let currentChunk: string[] = [];
  let currentLength = 0;

  lines.forEach((line) => {
    if (currentChunk.length && currentLength + line.length > maxChunkChars) {
      chunks.push(currentChunk.join("\n").trim());
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push(line);
    currentLength += line.length + 1;
  });

  if (currentChunk.length) {
    chunks.push(currentChunk.join("\n").trim());
  }

  return chunks.filter(Boolean);
}

function selectChunks(scoredChunks: ScoredChunk[], maxChars: number) {
  const selected: ScoredChunk[] = [];
  let totalChars = 0;

  for (const scoredChunk of scoredChunks) {
    if (scoredChunk.score <= 0 && selected.length > 0) {
      continue;
    }

    if (totalChars + scoredChunk.chunk.length > maxChars) {
      continue;
    }

    selected.push(scoredChunk);
    totalChars += scoredChunk.chunk.length;

    if (totalChars >= maxChars) {
      break;
    }
  }

  return selected
    .sort((left, right) => left.index - right.index)
    .map((scoredChunk) => scoredChunk.chunk);
}

function scoreChunk(chunk: string, promptTokens: Set<string>) {
  const chunkTokens = new Set(tokenize(chunk));
  let score = 0;

  promptTokens.forEach((token) => {
    if (chunkTokens.has(token)) {
      score += 2;
    }

    const stemmedToken = stemToken(token);
    if (stemmedToken !== token && chunkTokens.has(stemmedToken)) {
      score += 1;
    }
  });

  return score;
}

function tokenize(text: string) {
  return normalizeSearchText(text)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stemToken(token: string) {
  return token.replace(/(?:ing|ed|d|s)$/i, "");
}

const stopWords = new Set([
  "the",
  "and",
  "for",
  "from",
  "with",
  "that",
  "this",
  "into",
  "should",
  "need",
  "needs",
  "want",
  "wants",
  "order",
  "orders",
  "routing",
  "route",
  "rule",
  "rules"
]);
