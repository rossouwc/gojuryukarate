---
name: Learner data safety
description: Why incompatible local learner progress should remain recoverable rather than being silently reset.
---

Treat unreadable or newer learner-progress schemas as potentially recoverable data, not permission to overwrite them.

**Why:** A student may revisit an earlier published build after using a newer one. A schema mismatch is not necessarily corrupted data, and saving an empty default would permanently discard their review history.

**How to apply:** Allow temporary in-memory study with a visible persistence warning. Only replace incompatible saved data after the learner explicitly confirms a reset; do not silently reset during startup or an upgrade.
