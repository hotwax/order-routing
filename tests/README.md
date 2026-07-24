# Test suite standard

This suite protects routing decisions and user workflows. It is not a mirror of every source file.

Keep a test when it protects at least one of these contracts:

- a user action with meaningful state or payload consequences;
- a backend request, response adapter, or persistence boundary;
- routing, variation, simulation, or Circuit behavior that would be costly to regress;
- a previously reproduced bug, with the test exercising the failure through the smallest stable surface.

Avoid tests that:

- assert static markup or copy with no behavioral consequence;
- invent backend fields or outcomes that are not available in the verified API;
- duplicate the same pure function across several files;
- mock most of a component's implementation just to prove that props render;
- target deleted exports, historical paths, or private implementation steps;
- execute assertions at module load instead of declaring Vitest test cases.

Prefer pure-function and store/service contract tests. Use a mounted Vue test only when the behavior
depends on actual component interaction, such as inventory selection or modal filtering. Validate
full UI workflows against the running app and real backend rather than treating JSDOM as browser proof.

Before merging a test, verify that it fails for the regression it claims to prevent and that the full
suite still completes with `vitest run` without unhandled errors or zero-test files.
