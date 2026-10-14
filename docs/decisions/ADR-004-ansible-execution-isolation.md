# ADR-004: Ansible Execution Isolation and Controlled Rollout

## Status
Accepted

## Context
Ansible playbooks and collections are executable code that can modify infrastructure. Unchecked execution poses risks of broadcast errors, secret leaks in logs, and uncontrolled concurrency.

## Decision
1. Execution is constrained by pre-execution Target Preview: the operator must review the resolved host list, counts, and environmental classification prior to triggering.
2. Controlled Rollout: Support serial batches (e.g. 1 host or 2 hosts at a time), canary execution, strict failure thresholds (abort immediately if threshold exceeded), and real-time cancellation.
3. Every execution creates an immutable `AutomationRunManifest` containing pinned versions, SHA-256 digests of playbooks and inventories, policy decisions, and per-host outcomes.
4. Outputs are automatically scrubbed by the Redaction Engine before persisting or rendering in logs.

## Consequences
- Prevents destructive fleet broadcast.
- Ensures forensic reproducibility and compliance evidence.
