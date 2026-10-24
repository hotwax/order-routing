# Frontend update validation — 2026-10-24

## Problem and behavior

An already-open frontend retains its compiled backend URL after deployment. The live development
site also served HTML/deep links with `Cache-Control: max-age=3600`. No active service worker was
controlling the inspected Chrome tab. The existing Settings update action had no registration
producer after the service-worker retirement.

Order Routing now opts into AccxUI build detection. A notice appears when the hosted marker differs
from the running build. Users finish their work and open Settings to update. The update requires
confirmation and refuses to reload during routing edits, proposal review, pending requests, or an
open modal/loading overlay. Other screens expose only Later. Nothing automatically reloads.

HTML and deep links revalidate, the build marker is not cached, and only hashed JS/CSS is immutable.
An already-open old frontend still needs one ordinary reload to adopt this detector.

## Verified locally

- Typecheck passed; application suite: 74 files / 471 tests passed.
- Shared detector suite: 8 tests passed. Full common suite had 488 passing tests and the same
  pre-existing commonUtil/useProducts/useSolrSearch failures reproduced in the untouched checkout.
- Two real production builds succeeded with different marker IDs despite identical source.
- In regular Chrome, an isolated context loaded build A. Serving build B from the same local
  preview caused the update notice to appear without navigation or a reload.
- The typed OMS value remained `demo-oms`; the loaded entry script remained build A. Only Later
  was offered on the login form. Dismissing the notice retained the input and document.
- An ordinary reload (cache bypass disabled) loaded the build B entry script and cleared the notice.
- Hosting configuration checked for all three targets: deep links and stable filenames are not
  matched by the immutable asset rule; root and versioned hashed JS/CSS are matched.

## Remaining deployment gates

This change has not been merged or deployed. The authenticated production-build test on localhost
is blocked by the existing shared cookie helper, which scopes production cookies to `hotwax.io`.
No cookie policy was changed to bypass that restriction. A HotWax test host is still required to
verify the actual Settings confirmation, dirty routing draft retention, and live cache headers.
The confirmation/overlay/blocker behavior is covered by unit tests, not claimed as live UI proof.
No routing configuration was saved or routing execution started during these checks.

Merge the shared AccxUI PR before the app PR: app CI and development deployment currently check out
AccxUI main. The tagged release workflow pins shared commit
`349d087ec7be8a62d0b8ee652942634b4b83d9f3` so releases include the new API.
