# Why simulation is off until a deployment opts in

The app already has a login pass for the normal OMS backend. Simulation may live at a different
address, so sending that pass there is safe only after the deployment team verifies that the address
is theirs and is configured to accept the same pass.

That is why simulation needs three explicit settings: turn the feature on, name the exact secure
simulation address, and confirm that the address is trusted to receive the OMS login pass. If any
setting is absent or unsafe, the tab stays hidden and the app refuses the request before sending
anything.

The Circuit assistant is separate. The app can send it a prompt and a description of the editable
page only after it is explicitly enabled. It never sends the user's raw OMS login pass or OMS URL.
If Circuit needs to look up OMS data, its server must receive a reviewed server-to-server
authentication design first.

For the exact deployment checklist, see
[`simulation-production-readiness.md`](./simulation-production-readiness.md). The technical trust
boundary is documented in [`simulation-login-technical.md`](./simulation-login-technical.md).
