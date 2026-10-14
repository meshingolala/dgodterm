# ADR-006: Audit Event Model and Cryptographic Integrity Link Chaining

## Status
Accepted

## Context
ISO/IEC 27001:2022 clause A.8.15 (Logging) requires that audit logs are protected against tampering and unauthorized deletion. Local audit records must be verifiable.

## Decision
1. All security-relevant actions (authentication, host trust decisions, SFTP file operations, automation runs, policy rejections) emit structured `AuditEvent` records.
2. Cryptographic Hash Chaining: Each event includes an `integrity_link` computed as:
   `SHA-256(previous_integrity_link + canonical_json(event_payload))`
   The initial event uses a genesis seed.
3. Secret Scrubbing: All event payloads are passed through the Redaction Engine before hash generation and persistence, ensuring zero credentials, passwords, or private keys enter the audit chain.
4. Integrity Verification: The application provides a one-click audit integrity validator that verifies the entire cryptographic chain from genesis to the latest record.

## Consequences
- Immediate detection of any modification, insertion, or deletion of past audit entries.
- Directly supports compliance verification and forensic auditing.
