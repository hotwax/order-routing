# Why simulation is off until a deployment opts in

The app already has a login pass for the normal OMS backend. Simulation may live at a different
address, so sending that pass there is safe only after the deployment team verifies that the address
is theirs and is configured to accept the same pass.

That is why simulation needs three explicit settings: turn the feature on, name the exact secure
simulation address, and confirm that the address is trusted to receive the OMS login pass. If any
setting is absent or unsafe, the tab stays hidden and the app refuses the request before sending
anything.

The Circuit assistant is separate. Drafting changes sends only the prompt and page description.
For routing diagnostics, the enabled Circuit service receives the current session token in an
authorization header so it can read the same OMS data as the user. Circuit accepts only Maarg
servers on its configured allowlist. If a read is unavailable, the answer must say what is missing.
See the technical contract below for the required companion backend release and configuration.

For the exact deployment checklist, see
[`simulation-production-readiness.md`](./simulation-production-readiness.md). The technical trust
boundary is documented in [`simulation-login-technical.md`](./simulation-login-technical.md).
