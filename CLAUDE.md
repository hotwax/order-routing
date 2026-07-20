# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

- `ionic serve` or `npm run serve` — run the PWA dev server (vue-cli-service under the hood)
- `npm run build` or `ionic build` — production build of the PWA
- `npm run lint` — ESLint over `.ts` / `.vue` files
- `npm run i18n:report` — surface missing/unused translation keys in `src/locales/**`
- `npx vue-cli-service build --mode=sandbox` — build in a non-default mode (the Ionic CLI strips `--mode`; see README)
- Mastra server is now in `sandbox/circuit/` — run `pnpm dev` from there to start the circuit backend
- Firebase deploy targets are `order-routing-rules` (prod) and `order-routing-rules-dev`

### Tests

`tests/*.test.ts` is a mix of two conventions:

- Newer specs — including all the channel/inventory-scope ones (`useChannelInventory`,
  `channelSwitcherModal`, `inventoryScope`, `inventoryDetailChannelScope`,
  `useProductFacility`, `inventoryMovementDeltas`, `inventoryListOnlineAtp`) — are real vitest specs
  (`describe`/`it`/`expect`/`vi` imported from `"vitest"`). `npm run test:unit` runs
  `vitest` directly; run a single file with `npx vitest run tests/<name>.test.ts`.
- Older files still import `assert`/`node:assert` and run as standalone scripts via
  `npx tsx tests/<name>.test.ts` (or `ts-node`), throwing on failure and logging a
  `"... tests passed"` line on success. `vitest`'s default include pattern still picks
  these up when you run the whole suite (`npm run test:unit` with no path), and reports
  them as failed files since they have no `describe`/`it` — that's expected noise from
  the older scripts, not a signal about the vitest specs sitting alongside them.
- `npm run test:e2e` — vue-cli-service Cypress wiring; no specs exist in `tests/e2e/`,
  nothing to run.
- Mastra/brokering agent tests live in `sandbox/circuit/src/mastra/test/brokering/`.

When adding new tests, prefer the vitest convention (already used by every
channel/inventory-scope spec) over adding another `node:assert` script. Mastra/brokering
agent tests still follow the existing `node:assert` + `tsx`-runnable pattern in
`sandbox/circuit/src/mastra/test/brokering/`.

## Required env

The app reads config almost entirely from `.env` (copied from `.env.example`):

- `VUE_APP_RULE_ENUMS`, `VUE_APP_RULE_FILTER_ENUMS`, `VUE_APP_RULE_SORT_ENUMS`, `VUE_APP_RULE_ACTION_ENUMS` — JSON maps from internal enum keys to backend IDs/codes. Many components read these at runtime, so changing a key here is effectively a breaking API change for the PWA.
- `VUE_APP_LOGIN_URL` — DXP launchpad URL used by the auth guard in `src/router/index.ts`.
- `VUE_APP_MASTRA_URL` — base URL the PWA uses for `/brokering-route-assistant` and `/brokering-route-draft` calls (served by the circuit server in `sandbox/circuit/`).

## Architecture

This is a two-piece system: an **Ionic + Vue 3 PWA** for the merchant-facing UI and a **circuit server** (`sandbox/circuit/`) that hosts the LLM-backed draft/inquiry agents (implemented with Mastra). The PWA never lets the model touch backend data directly — the circuit server returns a validated JSON draft, the PWA applies it to local Vue state, and only an explicit user Save calls the Order Routing REST API.

### PWA (`src/`)

- Vue 3 + Ionic 8, Vuex (with `vuex-persistedstate`) plus a small amount of Pinia (via `@hotwax/dxp-components`).
- Vuex modules in `src/store/modules/{user,util,orderRouting,product,circuit}`. The persisted paths are defined in `src/store/index.ts` — note that only specific subpaths are persisted (e.g. `orderRouting.currentGroup`, `circuit.activeContext`) so adding new persisted state needs to be added there explicitly.
- Routing in `src/router/index.ts` is built around `Tabs.vue` with three primary tabs: brokering runs/routes (the rules editor), `BrokeringQuery`/`BrokeringRouteTest`/`BrokeringRunTest` (test harness), and `Circuit` (the AI assistant). An auth guard bounces unauthenticated users to `VUE_APP_LOGIN_URL`.
- API access goes through `src/services/*Service.ts`, which call `src/api/index.ts` (axios with `axios-cache-adapter`). `RoutingService.ts` is the canonical place for backend mutations; treat its functions as the only legitimate way to persist routing-rule state.
- `src/services/CircuitLLMService.ts` wraps `@mlc-ai/web-llm` so Circuit can optionally run a small WebGPU-hosted model in-browser for offline/testing flows (see `docs/webllm-circuit-testing.md`). This coexists with the Mastra-backed flow; do not assume one or the other.
- `src/services/CircuitStorageService.ts` persists chat threads/messages in IndexedDB. `circuitClearHistory.test.ts` patches its methods directly.

### Circuit / brokering-draft pipeline

This is the most subtle part of the codebase. End-to-end flow:

1. The user types a prompt in `src/components/circuit/CircuitChatCanvas.vue`.
2. `CircuitCanvas.vue` builds a **page capability manifest** via `src/draftTargets/BrokeringRulesDraftTargets.ts`. The manifest describes the currently visible route/rule, what targets are editable, what option IDs are valid, and which targets are disabled. **This manifest is the hard authority for the model** — anything not in it is off-limits.
3. `src/services/DraftAssistantService.ts` POSTs prompt + history + manifest to the Mastra server.
4. `circuit/src/mastra/brokering/routes.ts` registers two routes:
   - `/brokering-route-assistant` — orchestrates intent classification, then dispatches to either an inquiry agent (read-only Q&A about the current draft) or a draft agent (returns a brokering-route draft).
   - `/brokering-route-draft` — direct draft generation, no inquiry path.
5. Both agents are pure model configs — instructions live as constants in `circuit/src/mastra/brokering/agents.ts` and are passed at call time through the `callStructured()` helper, never stored on the `Agent` instance. Schemas live in `circuit/src/mastra/brokering/brokeringRouteDraftSchema.ts` (domain) and `circuit/src/mastra/brokering/pageCapabilitySchema.ts` (manifest contract). Structured output is enforced via Mastra `structuredOutput` with `errorStrategy: "strict"`, then re-validated by `circuit/src/mastra/brokering/brokeringRouteDraftValidator.ts` against the manifest.
6. `circuit/src/mastra/brokering/orderRoutingDomainKnowledge.ts` loads the domain knowledge YAML and injects it as **advisory context only** — the manifest still wins on conflicts.
7. The validated draft comes back to the PWA, which applies it to Vue refs via the binding layer in `BrokeringRulesDraftTargets.ts`. Only on Save does `RoutingService.ts` hit the real Order Routing API.

When changing agent behaviour, the relevant pieces are usually all three of: instructions in `circuit/src/mastra/brokering/agents.ts`, schema in `circuit/src/mastra/brokering/brokeringRouteDraftSchema.ts`, and validator in `circuit/src/mastra/brokering/brokeringRouteDraftValidator.ts`. Schemas and validators must stay aligned with the manifest produced by `BrokeringRulesDraftTargets.ts` or drafts will start coming back as 422 validation errors.

`circuit/src/mastra/brokering/manifestUtils.ts` (`pruneManifestForInquiry`) trims the manifest for the inquiry agent path so it stays within token budgets; mirror any new manifest fields there if they need to reach the inquiry agent.

### Backend / data model

The backend is HotWax Commerce's Order Routing service. The PWA only talks to it through `@hotwax/oms-api` and the services in `src/services/`. Rule, filter, sort, and action types are referred to throughout the codebase by the **enum keys** defined in `.env` (e.g. `QUEUE`, `PROXIMITY`, `BRK_SAFETY_STOCK`), not by their backend IDs — `src/store/modules/util` resolves keys to IDs. New rule/filter/sort types require updates in `.env.example`, the relevant Vuex util module, and any draft target bindings in `src/draftTargets/`.

## Conventions worth knowing

- The repo follows the rules in `.agent/rules/`:
  - **Ionic UI dev**: prefer native Ionic components and CSS variables over custom HTML/CSS. Don't override Ionic typography/colors without an explicit user request.
  - **Browser automation/testing**: use the Chrome DevTools MCP server (configured in `.mcp.json`), not a generic browser agent. Assume the app is running on localhost and ask for the port if it isn't already known.
- Vuex `vuex-persistedstate` is set up to hydrate before route mounting (see comment in `src/store/index.ts`); registering a new module from inside a component will not get this guarantee.
- Branch naming for contributions is `order-routing-rules/<issue-number>` per the README.
