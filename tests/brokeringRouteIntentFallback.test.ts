import assert from "assert";
import { dictionaryIntentFallback } from "../mastra/brokeringRouteIntentFallback";

assert.equal(dictionaryIntentFallback("add a queue filter for backorders"), "edit");
assert.equal(dictionaryIntentFallback("remove the warehouse rule"), "edit");
assert.equal(dictionaryIntentFallback("enable partial allocation"), "edit");
assert.equal(dictionaryIntentFallback("disable the safety stock filter"), "edit");
assert.equal(dictionaryIntentFallback("set shipment threshold to 50"), "edit");
assert.equal(dictionaryIntentFallback("clear the auto cancel days"), "edit");
assert.equal(dictionaryIntentFallback("delete the second rule"), "edit");
assert.equal(dictionaryIntentFallback("create a new fallback rule"), "edit");

// Inquiries — no fallback verb present
assert.equal(dictionaryIntentFallback("what does this route do?"), "inquiry");
assert.equal(dictionaryIntentFallback("is partial allocation on for B bucket?"), "inquiry");
assert.equal(dictionaryIntentFallback("which rules ship from warehouses?"), "inquiry");

// Ambiguous / verb-less prompts default to inquiry (never mutate on a guess)
assert.equal(dictionaryIntentFallback("the B bucket"), "inquiry");
assert.equal(dictionaryIntentFallback(""), "inquiry");
assert.equal(dictionaryIntentFallback("   "), "inquiry");

// Soft verbs the LLM would catch but fallback intentionally does NOT —
// the fallback is a safety net for unambiguous cases only.
assert.equal(dictionaryIntentFallback("allow partial allocation for B bucket"), "inquiry");
assert.equal(dictionaryIntentFallback("make the stores fallback active"), "inquiry");

console.log("Brokering route intent fallback tests passed");
