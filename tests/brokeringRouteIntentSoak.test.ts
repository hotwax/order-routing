import assert from "assert";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Agent } from "@mastra/core/agent";
import { classifyBrokeringRouteIntent } from "../mastra/brokeringRouteIntent";

const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
if (!apiKey) {
  console.log("Brokering route intent soak test SKIPPED (no OPENAI_API_KEY)");
  process.exit(0);
}

type Case = { prompt: string; expected: "edit" | "inquiry"; note?: string };

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "fixtures", "brokeringRouteIntentCases.json");
const cases: Case[] = JSON.parse(await readFile(fixturePath, "utf-8"));
assert.ok(cases.length >= 30, `expected at least 30 fixture cases, got ${cases.length}`);

const agent = new Agent({
  id: "brokering-route-intent-soak-agent",
  name: "Brokering Route Intent Soak Agent",
  model: process.env.VITE_MASTRA_INTENT_MODEL || "openai/gpt-4.1-nano"
});

let correct = 0;
const misclassifications: Array<{ prompt: string; expected: string; got: string; reasoning: string }> = [];

for (const testCase of cases) {
  const result = await classifyBrokeringRouteIntent({
    userPrompt: testCase.prompt,
    conversationHistory: [],
    generate: agent.generate.bind(agent) as any
  });
  if (result.intent === testCase.expected) {
    correct += 1;
  } else {
    misclassifications.push({
      prompt: testCase.prompt,
      expected: testCase.expected,
      got: result.intent,
      reasoning: result.reasoning
    });
  }
}

if (misclassifications.length) {
  console.log("Misclassifications:");
  for (const miss of misclassifications) {
    console.log(`  prompt: ${JSON.stringify(miss.prompt)}`);
    console.log(`    expected: ${miss.expected}, got: ${miss.got} — reasoning: ${miss.reasoning}`);
  }
}

const threshold = Math.ceil(cases.length * 0.9);
assert.ok(correct >= threshold, `expected at least ${threshold}/${cases.length} correct; got ${correct}`);

console.log(`Brokering route intent soak test passed (${correct}/${cases.length} correct)`);
