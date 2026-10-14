# DgodTerm Architecture Overview

## 1. System Components
DgodTerm is a high-assurance SSH-2 terminal, SFTP client, and controlled Ansible fleet automation application built on an isolated multi-process desktop architecture:

```
+-----------------------------------------------------------------------+
|                             DgodTerm UI                               |
|              (Sandboxed Chromium Renderer, React, xterm.js)           |
+-----------------------------------------------------------------------+
                                  |
               Narrow Typed IPC (Electron contextBridge)
                                  |
+-----------------------------------------------------------------------+
|                         DgodTerm Desktop Core                         |
|                                                                       |
|  +--------------------+  +--------------------+  +-----------------+  |
|  |     SSH Manager    |  |     SFTP Engine    |  | Ansible Runner  |  |
|  | (ssh2, PTY, Trust) |  | (Path Traversal    |  | (Target Preview,|  |
|  |                    |  |  Guard, Checksums) |  |  Serial Rollout)|  |
|  +--------------------+  +--------------------+  +-----------------+  |
|            |                       |                      |           |
|  +--------------------+  +--------------------+  +-----------------+  |
|  | Host Trust Store   |  | Credential Broker  |  | Policy Engine   |  |
|  | (Strict Fingerprint|  | (No Raw Secrets In |  | (Approval Gates,|  |
|  |  Verification)     |  |  DB / OS DPAPI)    |  |  Target Limits) |  |
|  +--------------------+  +--------------------+  +-----------------+  |
|            \                       |                      /           |
|             \                      |                     /            |
|              +------------------------------------------+             |
|              |         Cryptographic Audit Engine       |             |
|              |     (SHA-256 Hash Chain Integrity Log)   |             |
|              +------------------------------------------+             |
|                                    |                                  |
|              +------------------------------------------+             |
|              |        Storage & Migrations (SQLite)     |             |
|              +------------------------------------------+             |
+-----------------------------------------------------------------------+
```

## 2. Process Separation & Security Boundaries
- **Renderer Isolation**: The UI has no direct file system access, network socket creation, or child process spawning privileges (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
- **Secret Redaction**: All data traversing to UI or persistence is scrubbed by the Redaction Engine. Credentials are kept exclusively as references (`CredentialReference`), never stored as plaintext in profiles or audit records.
- **Strict Host Verification**: Unknown or changed SSH host keys are intercepted synchronously in the protocol handshake and presented for explicit operator authorization.
