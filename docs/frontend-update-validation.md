# Service-worker update review — 2026-10-24

Every added production line was reviewed against the update and unsaved-draft requirements.
Removed the immutable-asset regex/rules, the separate worker cache-header override,
the redundant worker scope option, and the version-info export. Settings again reads
its existing build metadata directly. No additional store, blocker registry, banner,
polling timer, build-marker endpoint, dependency, or framework change remains.

## Retained changes and why

| File | Why the remaining change is needed |
| --- | --- |
| `firebase.json` | One `no-cache` header per existing hosting target makes HTTP responses revalidate, including HTML reached through SPA rewrites. No filename parsing or year-long caching policy. |
| `vite.config.ts` | Prompt-mode worker replaces the self-destroying worker. App-owned registration prevents automatic tab reloads. The 4 MiB precache limit accommodates the entry bundle above Workbox's 2 MiB default. The short version-path exclusion prevents root HTML being served for a versioned app. |
| `src/registerServiceWorker.ts` | The existing registration library sets existing PWA state and shows the standard toast. A browser-native check on returning to a tab finds updates without polling. A controller change only notifies; it never reloads other tabs. Native registration is kept raw for browser API access. |
| `src/App.vue`, locale | Register once when the app mounts; translate the notification. |
| `src/components/DxpAppVersionInfo.vue` | Keep the existing small, dark outlined button at the right. Reload only on a click, after activation; check Settings and overlays again at that point. Ignore duplicate clicks and reset after failed activation. |
| `src/router/index.ts` | Eager Settings import keeps Update reachable when another tab activates a worker and old asset files disappear. This failure was reproduced with the lazy import. |
| `src/store/userStore.ts` | Exclude browser registration/update state from JSON persistence; reuse the existing PWA state. |
| `tests/appUpdate.test.ts` | Six behavior tests cover activation, duplicate clicks, route/overlay protection, leaving Settings during activation, failed installation, and notification without automatic reload. |

The existing routing leave guard and before-unload handling are unchanged. The leave
guard requires Stay or explicit discard for unfinished routing edits before Settings
can be entered. The component rechecks the current route after asynchronous overlay
checks so navigation during activation cannot reload a newly opened draft.

## Validation

- Typecheck, all 472 tests across 74 files, and the unmodified production build pass.
- Real Chrome uses two local production-mode builds against the real demo-oms backend.
  Firebase Hosting's local emulator serves the PR's actual rewrites and headers; only
  the public directory, local port, and demo project identifier are local overrides.
- An untracked test-only build transform removes the production cookie domain for
  localhost login. Backend APIs are not mocked; release cookie policy is unchanged.
- Stay preserves an unsaved Allow partial allocation edit. After replacing the entire
  served directory with build B, Update in a clean Settings tab loads B while the dirty
  tab retains its edit, enabled Save, and build A document.
- Discard restores the baseline. Once navigation overlays finish closing, the original
  tab reaches Settings and updates too. Button styling and right alignment are checked.
- The browser run records zero routing/brokering mutation requests and closes its context.

No merge, hosted deployment, routing Save, or Run occurred. Hosted CDN behavior and
installed-device migration remain future rollout checks. Old tabs need one ordinary
reload to adopt registration. AccxUI PR #248 is closed; no release pin change is needed.
