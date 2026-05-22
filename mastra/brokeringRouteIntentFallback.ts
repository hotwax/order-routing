// Safety net used only when the LLM intent classifier is unavailable
// (network error, timeout, missing API key). Keep this list short and
// unambiguous — every entry must be an imperative that virtually never
// appears inside a routing inquiry. Soft verbs like "allow", "make",
// "change" are intentionally excluded: they appear in inquiries too
// ("Do both rules allow partial allocation?") and the LLM handles them.
// When no token matches, return "inquiry" — never mutate state on a
// guess.
const FALLBACK_EDIT_VERB_TOKENS = new Set([
  "add",
  "remove",
  "enable",
  "disable",
  "set",
  "clear",
  "delete",
  "create"
]);

export function dictionaryIntentFallback(prompt: string): "edit" | "inquiry" {
  const tokens = String(prompt || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ");
  return tokens.some((token) => FALLBACK_EDIT_VERB_TOKENS.has(token)) ? "edit" : "inquiry";
}
