# Service-worker update validation — 2026-10-24

Order Routing reuses its existing PWA state and Settings Update button. The button is
small, dark outlined, and right aligned beside the App/version information, matching
the existing app design. There is no additional update store, blocker registry,
banner component, polling timer, build-marker endpoint, or shared framework change.

The existing PWA plugin generates a prompt-mode worker. Its waiting-worker notification
updates userStore.pwaState and shows the standard toast. Returning to a visible tab
requests a native worker update check. Only clicking Update in Settings reloads that
tab; activation in another tab only notifies. The existing routing leave guard resolves
unsaved work before Settings can be entered. Update also checks the current route and
modal/loading overlays when clicked and when worker activation finishes.

Settings is eagerly imported so the old document can still reach Update after another
tab activates a new worker and the host removes old asset files. Browser registrations
are excluded from persisted user state. HTML/deep links revalidate, sw.js uses no-store,
and hashed JS/CSS remains immutable. The legacy worker retirement endpoint is unchanged.

Validation:
- Typecheck and all 472 tests across 74 files passed.
- The unmodified production build passed. Earlier root and versioned worker builds
  also passed; root navigation fallback excludes versioned URLs.
- Chrome verified the dark outlined, small Update button at the right edge of App details.
- Build A controlled two tabs. An unsaved Allow partial allocation edit survived update
  detection and activation of build B in the clean Settings tab. Stay in the existing
  leave confirmation kept the draft and the old document intact.
- Discard restored the original toggle and disabled Saved state. After navigation and
  overlay dismissal completed, the original tab's Update button loaded build B too.
  The test recorded zero routing/brokering mutation requests and closed its browser.
- The test replaced the complete hosted directory, removing all old asset files. This
  also verified that the eager Settings screen remains reachable from the old document.
- Local Chrome validation uses two production-mode builds and the real demo-oms backend.
  An untracked test-only transform removes the production cookie domain for localhost;
  authentication and routing APIs are not mocked. The release build keeps normal cookies.

No merge, hosted deployment, routing Save, or Run action is authorized for this change.
Hosted cache headers and installed-device migration remain future rollout checks.
Old tabs need one ordinary reload to adopt service-worker registration.
AccxUI PR #248 was reverted and closed; no release pin change is needed.
