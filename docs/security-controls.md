# DgodTerm ISO/IEC 27001:2022 Security Controls Crosswalk

| Control Identifier | ISO/IEC 27001:2022 Title | DgodTerm Implementation |
| :--- | :--- | :--- |
| **A.5.15** | Access control | Role-based profile assignment, explicit approval workflows for production systems, separation of duties. |
| **A.8.5** | Secure authentication | Support for SSH Agent, hardware keys, OpenSSH certificates, transient memory passwords without persistent storage. |
| **A.8.7** | Protection against malware | Strict isolation of Ansible workers, verification of playbook hashes and execution image digests. |
| **A.8.15** | Logging | Cryptographically chained audit event trail (`integrity_link`), capturing actor, time, correlation ID, target, and outcome. |
| **A.8.18** | Use of privileged utility programs | Bounded Ansible rollout (serial batching, canary gates, immediate tripwire on failure threshold). |
| **A.8.20** | Network security | Explicit SFTP paths, path traversal defense, strict SSH-2 algorithm allowlisting, disabling agent/X11 forwarding by default. |
| **A.8.24** | Use of cryptography | Standardized modern suites (Ed25519, Curve25519, AES-GCM), complete prohibition of legacy SHA-1 and DSA. |
| **A.8.28** | Secure coding | Sandboxed renderer, typed IPC, zero raw secrets in database, automated secret redaction engine. |
