# Service-worker update validation — 2026-10-24

## Final implementation

Order Routing uses its existing `vite-plugin-pwa` and `register-service-worker` dependencies.
The plugin generates a normal prompt-mode worker instead of a self-unregistering worker.
The registration library supplies the waiting-worker notification; returning to a visible tab
requests the browser's native update check. There is no custom polling, build marker, or shared API.

Settings confirms updates and sends the existing `SKIP_WAITING` message. Only the consenting tab
reloads, after checking blockers again when the worker activates. Other tabs receive a notice and
keep their working copy. The plugin's convenience registration helper is intentionally not used:
its controlling-event handler reloads tabs without consulting their unsaved-work state.
Routing edits, proposal review, typed prompts, and active routing operations block updates; other
screens direct users to Settings. Settings also checks modal/loading overlays. No automatic save.
HTML/deep links revalidate, `sw.js` is not cached, and hashed JS/CSS remains immutable.
The legacy `/service-worker.js` retirement endpoint remains unchanged.

## Validation

- Typecheck and all 473 tests across 74 files passed. An earlier heavily parallel run timed out in
  two unrelated suites; both passed individually and in the final reduced-concurrency full run.
- Production builds succeeded for root and `/v2.5.0/`. Generated workers contain the waiting-worker
  message handler. Root navigation fallback excludes versioned paths.
- Chrome used two actual local builds against the real demo-oms backend. A validation-only Vite
  transform removed the production cookie domain for localhost; it is untracked and not part of
  the PR. Authentication and routing APIs were not mocked. No hosted deployment was performed.
- Build A's worker controlled two authenticated tabs. In the routing editor, toggling Allow partial
  allocation created an unsaved working copy (Changed / enabled Save). Serving build B and returning
  to the tab showed the update notice with only Later; the edit and build A document remained.
- The clean Settings tab displayed a visible confirmation. Later dismissed it without reloading.
  Update now activated the worker and loaded build B. The dirty routing tab retained its changed
  rule, checked toggle, enabled Save, and build A entry script after that other-tab update.
- Discard restored the routing baseline: Changed disappeared, the toggle returned to false, and
  Saved was disabled. Navigating that tab to Settings then permitted a confirmed update to build B,
  including the case where the other tab had already activated the worker. No update notice remained.
- No Save or Run action was invoked. The temporary working copy was discarded.

The entry scripts observed were `index-DdSvjSAO.js` (A) and `index-B95jO2ND.js` (B).
Actual hosted cache headers and installed-device migration remain checks for an authorized future
rollout. Existing old tabs need one ordinary reload to adopt service-worker registration.

AccxUI PR #248 was reverted and closed; there is no framework dependency or release-pin change.
