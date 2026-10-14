# ADR-005: Host Trust, Certificate Authority, and Key Rotation

## Status
Accepted

## Context
Silent Trust-On-First-Use (TOFU) is susceptible to Man-In-The-Middle (MITM) attacks and DNS spoofing. Changing host keys without operator authorization represents an acute security risk.

## Decision
1. Default to Strict Verification: An unknown host key halts connection establishment. The operator is presented with the remote fingerprint (SHA-256), key type, and host port, requiring conscious verification.
2. Changed Key Blocking: If a stored host key differs from the remote server's presented key, connection is blocked immediately. A security alert displays the previous fingerprint versus the received fingerprint.
3. Rotation Workflow: Replacing a changed host key requires deliberate administrative acknowledgment with a documented reason, recorded directly in the audit trail.
4. Support OpenSSH Host CA trust records to allow organizational certificate verification.

## Consequences
- Zero silent key acceptance.
- Auditable trail of all host identity decisions.
