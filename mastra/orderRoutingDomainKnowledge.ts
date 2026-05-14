import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KNOWLEDGE_SOURCE = {
  fileName: "hotwax_order_routing_domain_knowledge.yaml",
  label: "Deterministic HotWax order-routing domain knowledge",
  usage: "Use this as domain context for interpreting business intent, configuration patterns, prerequisites, and safe defaults."
};

const cachedKnowledgeText: Record<string, string> = {};

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
  const candidates = [
    import.meta.env.VITE_ORDER_ROUTING_KNOWLEDGE_DIR
      ? join(import.meta.env.VITE_ORDER_ROUTING_KNOWLEDGE_DIR, fileName)
      : "",
    join(mastraDir, "public", "knowledge", fileName),
    join(mastraDir, "knowledge", fileName),
    join(process.cwd(), "mastra", "public", "knowledge", fileName),
    join(process.cwd(), "public", "knowledge", fileName),
    join(process.cwd(), "knowledge", fileName)
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}
