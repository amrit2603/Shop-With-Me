# Decision 0001: Establish a measurable delivery baseline

- Status: accepted
- Date: 2026-10-29

The provided workspace is an extracted project without a `.git` directory. Do not claim branch or commit compliance until Git metadata is initialized. Baseline commands use the already-present lockfiles and installed dependencies; no new dependency is introduced in P0. Test failures caused by sandbox localhost restrictions must be rerun with the required authorization before they are classified as product failures.
