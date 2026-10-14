# DgodTerm — Secure SSH & Ansible Automation Client

Built to the specification defined in `BUILD-SPEC-Secure-SSH-Ansible-Client.md`.

## 1. Overview
**DgodTerm** is a secure desktop application designed for authorized system engineers and operators to:
- Connect to Linux and Unix systems over modern **SSH-2** with strict host identity verification.
- Organize saved profiles in nested local folders with tags, search, and favorites.
- Perform safe **SFTP** file operations with clear local/remote context, overwrite confirmations, and SHA-256 integrity verification.
- Run controlled **Ansible automation** across target fleets with pre-execution target preview, governance policies, separation of duties, canary/serial rollout, and immutable signed run manifests.
- Maintain an append-only **ISO/IEC 27001:2022** compliant audit trail protected with sequential **SHA-256 hash chaining** (`integrity_link`).

---

## 2. Core Security Principles Implemented

1. **Verify Every Remote Identity**:
   - Silent Trust-On-First-Use (TOFU) is prohibited.
   - Unknown host keys trigger an out-of-band verification modal showing the SHA-256 fingerprint, key algorithm, host, and port.
   - Changed host keys trigger a critical **Host Key Mismatch Alert** and block connections until an authorized key rotation workflow with a documented Change Reference ticket is executed.
2. **Keep Secrets Out of Profile Data**:
   - Profiles persist opaque `CredentialReference` records pointing to the OS SSH agent, hardware keys, key file paths, or memory-only transient password prompts.
   - Raw private keys, passwords, and tokens are strictly absent from profiles and database tables.
3. **Make Fleet Impact Visible**:
   - The Ansible automation console shows the exact resolved host list, counts, IP addresses, and environmental classification (Production vs. Staging/Dev) before execution.
4. **Least Privilege & Safe Boundaries**:
   - Sandboxed renderer with narrow typed IPC (`contextBridge`).
   - SSH agent forwarding and X11 forwarding disabled by default.
   - Destructive SFTP operations (overwrite, delete) require explicit confirmation.
5. **Reproducibility & Evidence**:
   - Pinned `ansible-core 2.17.4` runtime, immutable playbook revisions, and container image digests.
   - Emits an `AutomationRunManifest` with a tamper-evident SHA-256 `manifest_hash`.
6. **Audit & Secret Redaction**:
   - Built-in regex and pattern Redaction Engine scrubs private keys, passwords, tokens, and authorization headers before logging, storage, export, or support bundle generation.
   - Audit trail is linked by a continuous SHA-256 hash chain with one-click cryptographic validation.

---

## 3. Repository Structure

```text
dgodterm/
├── BUILD-SPEC-Secure-SSH-Ansible-Client.md   # Base implementation blueprint
├── package.json                              # App dependencies and scripts
├── tsconfig.json                             # TypeScript configuration
├── vite.config.ts                            # Vite frontend build configuration
├── schemas/                                  # JSON Schemas
│   ├── profile.schema.json                   # Connection profile schema
│   ├── run-manifest.schema.json              # Ansible run manifest schema
│   └── audit-event.schema.json               # ISO 27001 audit event schema
├── policies/                                 # Security Governance Policies
│   ├── default-policy.json                   # Standard strict policy
│   └── production-policy.json                # Tier-1 production policy
├── docs/                                     # Architecture & Security Documentation
│   ├── architecture.md                       # Architecture diagram and component breakdown
│   ├── threat-model.md                       # STRIDE threat model & mitigations
│   ├── security-controls.md                  # ISO/IEC 27001:2022 control mapping
│   ├── operations.md                         # Operational key rotation & incident guide
│   └── decisions/                            # Architecture Decision Records (ADRs)
│       ├── ADR-001-ssh-implementation.md
│       ├── ADR-002-desktop-shell-ipc.md
│       ├── ADR-003-local-and-enterprise-boundary.md
│       ├── ADR-004-ansible-execution-isolation.md
│       ├── ADR-005-host-trust-and-ca.md
│       └── ADR-006-audit-retention-integrity.md
├── scripts/
│   ├── generate-sbom.js                      # CycloneDX SBOM generator
│   ├── validate-schemas.js                   # JSON Schema validator
│   └── test-integrity.js                     # Automated security & integrity test suite
└── src/
    ├── domain/types.ts                       # Shared TypeScript domain models
    ├── redaction/redactor.ts                 # High-performance secret scrubber
    ├── storage/db.ts                         # SQLite persistence & migrations
    ├── audit/audit-service.ts                # Cryptographic hash-chained audit engine
    ├── credential/credential-broker.ts       # Credential reference manager
    ├── policy/policy-engine.ts               # Policy evaluator & separation-of-duties
    ├── ssh/                                  # SSH subsystem
    │   ├── trust-store.ts                    # Host key verification & rotation
    │   └── ssh-client.ts                     # PTY management & xterm bridge
    ├── sftp/sftp-client.ts                   # Dual-pane SFTP & traversal protection
    ├── automation/ansible-runner.ts          # Fleet target preview & serial rollout
    ├── preload/preload.ts                    # Sandboxed typed IPC boundary
    ├── main/main.ts                          # Electron process lifecycle
    └── renderer/                             # React + Tailwind + xterm UI
        ├── index.html
        ├── main.tsx
        ├── App.tsx
        └── components/
            ├── TerminalView.tsx              # xterm.js terminal with search & safe paste
            ├── SftpView.tsx                  # Dual-pane SFTP manager
            ├── AnsibleView.tsx               # Controlled fleet automation runner
            ├── AuditView.tsx                 # ISO 27001 audit trail & hash verifier
            ├── TrustStoreView.tsx            # Host key & CA manager
            ├── SettingsView.tsx              # Policies & redacted support bundles
            ├── HostVerificationModal.tsx     # Strict unknown/changed key modal
            ├── ClipboardPasteModal.tsx       # Multi-line paste defense
            ├── ProfileEditModal.tsx          # Profile editor (no secrets in DB)
            └── ImportExportModal.tsx         # Schema import/export
```

---

## 4. How to Run & Build

### Development / Building
```bash
# Install dependencies
npm install

# Compile the application (both renderer and Electron main process)
npm run build

# Run automated tests (schema validation, SBOM generation, integrity test)
npm test
```

### Launching the Desktop Application
```bash
# Start DgodTerm
npm start
```
