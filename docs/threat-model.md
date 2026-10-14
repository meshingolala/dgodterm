# DgodTerm Threat Model (STRIDE)

| Threat Category | Potential Attack Vector | DgodTerm Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Rogue SSH server impersonating trusted bastion or host. | Strict host key verification: rejects unknown/changed keys; displays full SHA-256 fingerprint; blocks connection until operator verifies out-of-band. |
| **Tampering** | Modification of saved connection profiles or local audit records. | Profiles validated against JSON schema rejecting arbitrary command injections; Audit logs linked via sequential SHA-256 hash chains (`integrity_link`). |
| **Repudiation** | Operator denying running destructive Ansible playbook on fleet. | Immutable `AutomationRunManifest` generated with playbook hash, inventory digest, approval signature, and recorded per-host results. |
| **Information Disclosure** | Leakage of private SSH keys, passwords, or tokens in crash dumps, logs, or exports. | Zero raw secret storage in DB; CredentialBroker utilizes OS Keychain/DPAPI; automatic regex redaction of keys/tokens before rendering or writing logs. |
| **Denial of Service** | Unbounded fleet execution crashing server cluster or resource exhaustion. | Policy engine enforces target limits, serial rollout, canary gating, failure thresholds, and execution timeouts. |
| **Elevation of Privilege** | Malicious remote server injecting terminal escape sequences to trigger local commands or clipboard injection. | Terminal emulator sanitizes OSC/VT sequences; multi-line paste confirmation modal warns before executing pasted blocks with newlines. |
