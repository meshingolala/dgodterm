# Secure SSH and Ansible Automation Client

## Build specification

**Document type:** Implementation blueprint  
**Version:** 1.0  
**Date:** 7 October 2026  
**Status:** Ready for architecture and delivery planning

## 1. Product objective

Build a secure desktop application for authorized operators to connect to Linux and Unix systems over SSH, organize saved sessions, manage remote files over SFTP, and run controlled Ansible automation across selected hosts.

The product combines interactive administration with fleet automation. It must make it straightforward to connect and organize sessions while placing host identity, least privilege, approvals, secrets handling, auditability, and controlled rollout into the normal workflow.

ISO/IEC 27001:2022 is a management-system standard. The application can support an organization’s ISMS and provide evidence, but software alone cannot be “ISO certified.” Any conformity claim must be scoped to an organization and supported through that organization’s certification process.

## 2. Product principles

1. **Verify every remote identity.** An unknown or changed host key blocks connection until the user makes an informed, auditable decision.
2. **Keep secrets out of profile data.** Profiles contain references to credentials, not plaintext passwords, tokens, or private keys.
3. **Make fleet impact visible.** Show resolved targets, rollout strategy, approval state, and per-host results before and during execution.
4. **Use least privilege throughout.** Limit identities, target scope, worker permissions, filesystem access, and network egress.
5. **Prefer reproducibility.** Pin playbooks, collections, execution images, and tool versions; record their digests with each run.
6. **Make unsafe actions deliberate.** Forwarding, trust exceptions, broad production runs, overwrites, recursive deletion, and privileged changes require clear intent.
7. **Design for evidence.** Record security-relevant actions with actor, time, reason, correlation ID, and outcome without recording secret values.

## 3. Initial release scope

### 3.1 Required capabilities

- SSH-2 terminal sessions with tabs, reconnect, keepalive, resize, search, and session organization.
- Saved profiles with nested local folders, tags, favorites, recent sessions, and search.
- Host-key and host-certificate authority trust management.
- Authentication using OS SSH agent, key files, OpenSSH certificates, keyboard-interactive/MFA, and non-persistent password prompts. Add GSSAPI/SSO when supported by the chosen platform and SSH stack.
- SFTP file browsing and transfers with explicit local/remote context and safe overwrite behavior.
- Ansible project, inventory, playbook, role, collection, and execution-environment management.
- Target preview, syntax and policy checks, approval hooks, bounded rollout, cancellation, and host-level results.
- Local audit records in the first release; optional centralized identity, policy, audit, and workers in an enterprise deployment.

### 3.2 Explicitly excluded from MVP

- Silent trust-on-first-use or automatic replacement of changed host keys.
- Plaintext passwords or private keys embedded in profiles, logs, telemetry, exports, or crash reports.
- Unrestricted one-click script broadcast to all discovered hosts.
- A claim of ISO certification or FIPS validation without the relevant independent assessment.
- An SSH server, full PAM replacement, or uncontrolled third-party plugin execution.

## 4. Suggested technical direction

Choose and document final technologies during Phase 0. The following is a practical default that should be validated against target operating systems, SSH agent support, terminal quality, and team expertise.

- **Desktop shell:** Tauri 2 with Rust backend and a TypeScript UI framework. Keep the renderer sandboxed and use a narrow typed IPC API. If platform compatibility or library maturity makes Tauri unsuitable, use another maintained desktop shell while preserving the process and trust boundaries in this specification.
- **Terminal:** use a maintained terminal emulator component in the UI, connected to a backend PTY/channel abstraction. Treat all remote terminal output as untrusted content; defend against escape-sequence abuse and clipboard injection.
- **SSH and SFTP:** use a maintained, security-reviewed implementation with platform-aware agent and certificate integration. Do not write cryptographic primitives. Compare native SSH libraries with invoking the system OpenSSH client before committing; test host certificates, agent use, jump hosts, terminal behavior, and supported Unix variants.
- **Ansible execution:** run a pinned Ansible Core version in an isolated execution environment. For desktop mode, use a managed local runtime or container/VM isolation appropriate to the host OS. For enterprise mode, execute jobs on ephemeral workers inside the customer network.
- **Local persistence:** SQLite for non-secret profile and preference data, with schema migrations. Store secret material only in the OS credential store or enterprise secret manager. Encrypt sensitive local metadata where feasible and rely on managed endpoint disk encryption as a baseline.
- **Enterprise service (later phase):** API for identity, policy, approvals, job orchestration, audit export, and worker coordination. Keep customer credentials and SSH reachability inside the customer’s defined trust boundary.

## 5. Repository layout

```text
secure-ssh-client/
├── apps/
│   ├── desktop/                 # UI and desktop shell
│   ├── control-service/         # Optional enterprise control plane
│   └── worker/                  # Isolated Ansible job worker
├── crates/
│   ├── domain/                  # Shared domain types and validation
│   ├── ssh-core/                # SSH connection, trust, channels, SFTP
│   ├── credential-broker/       # OS keychain and secret-manager adapters
│   ├── automation-core/         # Run planning and Ansible integration
│   ├── policy-engine/           # Authorization and execution policy
│   ├── audit/                   # Event model, redaction, integrity/export
│   └── ipc-api/                 # Typed desktop boundary
├── packages/
│   ├── ui/                      # Shared UI components
│   └── api-client/              # Typed control-service client
├── schemas/
│   ├── profile.schema.json
│   ├── run-manifest.schema.json
│   └── audit-event.schema.json
├── policies/                    # Example policy templates; no secrets
├── docs/
│   ├── architecture.md
│   ├── threat-model.md
│   ├── security-controls.md
│   ├── operations.md
│   └── decisions/               # Architecture decision records
├── infra/                       # Service and worker deployment definitions
├── scripts/                     # Build, signing, SBOM and release helpers
└── README.md
```

A monorepo is suggested to keep shared schemas and security boundaries versioned together. Do not place credentials, customer inventories, production hostnames, or real playbook secrets in the repository.

## 6. Core domain model

Use stable opaque IDs, UTC timestamps, schema versions, and explicit ownership/scope in persisted entities.

### 6.1 Connection profile

```text
ConnectionProfile
- id: UUID
- schema_version: integer
- display_name: string
- hostname: string
- port: integer (1..65535)
- username: string
- folder_id: UUID | null
- tags: string[]
- jump_host_profile_id: UUID | null
- auth_reference: CredentialReference | null
- host_trust_policy_id: UUID
- ssh_options: allowlisted typed options
- created_at / updated_at: UTC timestamp
- created_by: local user or enterprise identity
```

Do not persist arbitrary SSH command-line strings in `ssh_options`. Validate imported profiles, prevent recursive jump-host graphs, and reject unsupported or security-weakening options unless an administrator explicitly permits a scoped exception.

### 6.2 Credential reference

```text
CredentialReference
- kind: os_keychain | ssh_agent | key_file_reference | certificate | secret_manager
- reference_id: opaque provider-specific identifier
- account_or_key_label: optional display metadata
- last_used_at: optional UTC timestamp
```

A reference is not a credential. Never serialize private key contents, passwords, tokens, decrypted Ansible Vault values, or secret-manager responses into the profile database.

### 6.3 Host trust record

```text
HostTrustRecord
- hostname_pattern: string
- port: integer | wildcard only if policy allows
- key_or_ca_fingerprint: string
- key_type: string
- source: manually_verified | organization_ca | managed_inventory
- verified_by: identity
- verified_at: UTC timestamp
- expires_at: optional UTC timestamp
- status: active | revoked | expired
- reason / change_reference: optional string
```

### 6.4 Automation run manifest

```text
AutomationRunManifest
- run_id: UUID
- requested_by: identity
- requested_at: UTC timestamp
- project_id: UUID
- playbook_path: repository-relative path
- source_revision: immutable VCS commit or content digest
- inventory_source: immutable reference and digest
- resolved_targets: host IDs or protected references
- limit / tags / extra_vars_digest: values or protected references
- execution_image_digest: immutable digest
- ansible_core_version / collection_versions: pinned values
- policy_decision: allow | deny | approval_required plus policy version
- approvals: actor, time, rationale, approval scope
- rollout: serial/canary/failure threshold/timeouts
- change_reference: optional required value per policy
- started_at / completed_at: UTC timestamps
- per_host_results: status, changed, redacted summary, timing
```

Secrets and secret values must not be present in manifest fields. Store protected references or one-way digests when needed to prove which input was used.

### 6.5 Audit event

```text
AuditEvent
- event_id: UUID
- event_type: enum
- actor_id: identity
- actor_role: role at event time
- occurred_at: UTC timestamp
- correlation_id: UUID
- resource_type / resource_id: optional
- action: stable action name
- outcome: success | denied | failed | partial
- reason / change_reference: optional
- policy_version: optional
- metadata: schema-validated, secret-free fields
- integrity_link: sequence/hash/signature according to deployment
```

## 7. Application workflows

### 7.1 Connect to a host

1. User selects or creates a profile.
2. Application validates hostname, port, username, jump path, credential reference, and effective policy.
3. SSH service negotiates an allowed algorithm set.
4. Trust service compares server identity with an existing host key, host CA, or verified enrollment process.
5. On unknown identity, display fingerprint, key type, host/port, and instructions for out-of-band verification. Do not continue until explicitly trusted or denied.
6. On changed identity, block by default and show prior/new fingerprints. Permit replacement only through an approved rotation workflow or documented, audited exception.
7. Authentication succeeds, and the terminal opens with visible host/user identity and session status.

### 7.2 Organize profiles

- Create, rename, nest, move, archive, restore, and delete folders and profiles.
- Folder operations apply to local organization metadata only. Remote folder creation happens only through SFTP and an explicit remote action.
- Search by profile label, hostname, username, folder, and tag; do not expose secret values to search or indexing.
- Export/import supports schema-versioned profile metadata with secret references omitted or safely redacted. Show a preview before importing and report rejected fields.

### 7.3 Transfer files

- Display `LOCAL` and `REMOTE: host` labels and full paths on both panes.
- Require confirmation before overwrite, recursive deletion, permission changes, or replacing a non-empty target.
- Show transfer progress, result, checksum option, and partial-transfer recovery state.
- Prevent path traversal and unsafe local path resolution. Do not interpret remote filenames as UI markup or shell input.

### 7.4 Run Ansible automation

1. Select project, immutable playbook revision, inventory, environment, target limit, tags, and rollout policy.
2. Resolve inventory and show the exact target list/count and environment classification.
3. Validate syntax, pinned dependencies, policy, execution-image digest, and required change reference.
4. Display check-mode/diff output where available. Clearly state that modules may not support accurate preview.
5. Evaluate approval requirements. Do not let the requester approve their own run where separation of duties is required.
6. Create signed or integrity-protected run manifest; start in canary/serial batches according to policy.
7. Stream redacted host-level progress. Respect cancellation, timeout, concurrency and failure thresholds.
8. Present final summary and exportable audit record. Retry only selected failed hosts after fresh authorization and state review.

## 8. Security requirements

### 8.1 SSH and host identity

- SSH-2 only; maintained protocol library; no custom cryptography.
- Strict known-host verification by default and supported host CA trust for fleet management.
- Modern algorithms according to current upstream and organizational cryptographic policy. Disable obsolete SHA-1 signatures, DSA, and weak protocol options by default.
- Do not confuse RSA key format with legacy `ssh-rsa` SHA-1 signatures; allow RSA/SHA-2 only when policy supports it.
- Changed host keys block connection unless an authorized rotation workflow is used.
- Agent forwarding, X11 forwarding, port forwarding, tunnels, and local shell actions disabled by default and individually governed.
- Compatibility exceptions are host-scoped, justified, time-bounded, visible, and reported.

### 8.2 Credentials and secrets

- Prefer short-lived SSH certificates, hardware-backed keys, OS agents, MFA, and federated identity where supported.
- Password entry is transient and not saved by default.
- Use OS keychain or an approved secret manager; minimize secret lifetime in process memory.
- Redact secret values before UI display, logs, telemetry, audit, export, support bundle, and crash reporting.
- Ansible Vault protects data at rest only. Use `no_log` carefully, restrict output, and favor secret-manager lookups with short-lived credentials.
- Never expose secrets in process arguments, profile exports, analytics, exception messages, clipboard history, or run manifests.

### 8.3 Ansible worker isolation

- Treat playbooks, roles, collections, inventory plugins, callback plugins, and execution images as executable code.
- Pin versions and trusted sources; scan dependencies and produce SBOMs.
- Use ephemeral workers, dedicated identities, isolated workspaces, resource limits, restricted network egress, and no cross-run writable state.
- Use separate workers or equivalent isolation for separate tenants/security domains.
- Restrict privilege escalation and sudo to approved actions. Do not assume Ansible modules are safe just because they are declarative.
- Use canary and serial rollout, health gates, timeouts, failure thresholds, and cancellation.

### 8.4 Audit and privacy

- Record actor, role, time, correlation ID, target scope, policy/approval decision, content digests and outcomes.
- Never record secret values. Minimize terminal output capture and redact before persistence.
- Centralize and protect enterprise audit records; use append-only or equivalent integrity controls and synchronized clocks.
- Define retention and deletion by data class and jurisdiction. Session recording is optional, purpose-bound, access-restricted, disclosed, and time-limited.
- Provide user-reviewed support bundles with explicit inclusion and automatic secret scrubbing.

### 8.5 Secure software lifecycle

- Threat-model UI, IPC, SSH, terminal parsing, SFTP paths, profile import/export, local DB, worker, update service, plugins, logs, and support bundles.
- Require code review and security review for trust, authentication, cryptography, secret handling, policy, IPC, and update changes.
- Use static analysis, dependency scanning, secret scanning, fuzzing of parsers/protocol boundaries, and release signing.
- Produce SBOMs for application, SSH libraries, Ansible collections, and execution images.
- Verify update signatures and provenance before installation; use staged rollout and a protected rollback path.
- Define vulnerability disclosure, severity classification, patch SLAs, end-of-life policy, and incident response for credential/update compromise.

## 9. Policy model

Policies should be centrally enforced in enterprise mode and locally configurable in standalone mode. Example policy fields:

```yaml
policy_id: production-automation-v1
scope:
  environments: [production]
ssh:
  host_key_mode: strict
  allow_legacy_algorithms: false
  agent_forwarding: disabled
automation:
  max_targets_without_approval: 10
  production_requires_approval: true
  require_change_reference: true
  self_approval: false
  default_serial: 1
  failure_threshold: 1
  max_run_minutes: 60
credentials:
  persistent_passwords: false
  require_short_lived_certificates: true
logging:
  secrets: never
  terminal_recording: disabled
```

The sample is illustrative. A real policy schema must be validated, versioned, reviewed, and tested. Deny by default when a required policy decision cannot be obtained in enterprise mode.

## 10. Build phases and work items

### Phase 0 — Discovery and architecture

- Confirm target desktop operating systems and supported Linux/Unix server matrix.
- Decide native SSH library versus system OpenSSH integration using a documented decision record.
- Decide local-first and enterprise deployment boundaries.
- Build a threat model, data classification, initial risk register, and privacy assessment.
- Define cryptographic policy source, supported algorithms, exception lifecycle, and host enrollment process.
- Define identity, approval, audit, retention, and worker isolation requirements.

**Exit:** architecture/security review approved; key choices and risks documented.

### Phase 1 — Secure SSH foundation

- Create desktop shell and sandboxed renderer with typed IPC.
- Implement profile CRUD, nested folders, tags, search, schema migrations, and profile validation.
- Implement trust store, fingerprint view, strict unknown/changed-key behavior, and trust events.
- Integrate OS credential store, SSH agent, key references, and transient password prompt.
- Implement terminal tabs, resize, reconnect, keepalive, search, and safe clipboard controls.
- Add security event model and local audit viewer/export.

**Exit:** host mismatch blocks; no credentials appear in DB/logs; profiles and terminal work on the target OS matrix.

### Phase 2 — SFTP and session usability

- Add SFTP browser with clear local/remote path labels.
- Add transfer queue, overwrite prompts, safe rename/mkdir, partial-transfer handling, and optional checksums.
- Add profile import/export with preview, validation, secret-reference omission, and safe error messages.
- Add user-reviewed support diagnostics and automatic redaction.

**Exit:** destructive path operations are guarded; malformed imports and path traversal attempts are rejected.

### Phase 3 — Controlled Ansible MVP

- Build pinned execution environment and isolated local worker.
- Add project, inventory, playbook, collection, and execution-image metadata.
- Add syntax checks, inventory resolution, target preview, check/diff display, and policy validation.
- Add target caps, canary/serial rollout, approval hook, cancellation, timeouts, and failure thresholds.
- Emit immutable run manifest and redacted per-host status.

**Exit:** run inputs and outcomes are reconstructable; secret values are absent; partial failure and cancellation are safe.

### Phase 4 — Enterprise governance

- Integrate enterprise identity and role mapping.
- Add central policy service and separation-of-duties approvals.
- Add customer-network ephemeral workers and constrained egress.
- Add centralized audit export/SIEM integration, retention, access review reports, and key revocation workflows.
- Add managed inventory sources and approved execution environment catalog.

**Exit:** centrally enforced roles/policies and access reviews are demonstrable; audit export integrity can be validated.

### Phase 5 — Assurance and production readiness

- Independent penetration test and remediation.
- Supply-chain review, signing/provenance verification, SBOM and dependency remediation process.
- Restore/continuity exercise, incident response tabletop, performance and accessibility review.
- Validate organizational ISO/IEC 27001 control mapping and evidence ownership.

**Exit:** critical/high findings fixed or formally risk-accepted; operational owners and evidence cadence assigned.

## 11. Acceptance criteria

### SSH and profile management

- Unknown and changed server keys never become trusted silently.
- Trust prompts show hostname, port, fingerprint, key type, and a clear verification instruction.
- Profiles support nested local folders and tags without changing the remote filesystem.
- Passwords and private key contents are absent from the local database and exports.
- Forwarding is disabled by default and requires explicit policy permission.

### SFTP

- UI always labels local and remote sides and shows the current host/path.
- Overwrite, recursive deletion, and permission changes require confirmation according to policy.
- Invalid paths, traversal attempts, and malformed transfer states fail safely.

### Automation

- Exact resolved targets are visible before execution.
- High-impact runs enforce configured approval and change-reference requirements.
- The run record contains immutable code, inventory, dependency, image, and policy identities.
- Cancellation, timeout, failure threshold, and per-host retry behave as documented.
- Preview output is not represented as a guarantee that a playbook is safe.

### Audit and security

- Secret values never appear in audit, logs, telemetry, support bundle, or crash report tests.
- Authorized reviewers can export and verify audit integrity without access to secret values.
- Security exceptions have owner, rationale, scope, expiry, and review event.
- A credential compromise response can revoke identities/credentials and preserve incident evidence.

## 12. Verification strategy

Create tests as part of implementation; do not treat security verification as an end-of-project activity.

- **Unit tests:** profile validation, policy decisions, algorithm allowlists, redaction, manifest signing/digests, path normalization, and state transitions.
- **Integration tests:** SSH host-key enrollment/mismatch/rotation, agent/certificate use, SFTP operations, keychain adapters, and Ansible job lifecycle.
- **Adversarial tests:** malicious profile imports, command injection, terminal escape sequences, inventory/plugin abuse, symlink and path traversal, secret leakage, oversized output, cancellation races, and update-signature failures.
- **Compatibility tests:** supported desktop OS versions and representative OpenSSH/Unix targets; record limitations per server family.
- **Operational exercises:** worker outage, audit sink failure, secret manager outage, compromised credential, partial fleet failure, restore, and emergency update rollback.
- **Release gates:** no unresolved critical vulnerabilities; high-severity findings fixed or formally accepted; signed artifacts and SBOM generated; release notes and support matrix published.

## 13. ISO/IEC 27001:2022 readiness

The product should provide evidence useful to an ISMS, including access and role history, approvals, host trust changes, automation manifests, policy changes, signed release metadata, SBOMs, vulnerability remediation, incident exports, and restore evidence.

The organization pursuing certification remains responsible for:

- Defining ISMS scope and interested-party requirements.
- Risk assessment, risk treatment, and Statement of Applicability.
- Assigning control owners and operating procedures.
- Managing people, suppliers, endpoint, physical, business continuity, and legal obligations.
- Internal audits, management reviews, corrective actions, and continual improvement.
- Engaging a suitable certification body and making claims only for the certified scope.

Use the ISO/IEC 27001:2022 text and applicable amendments as the authoritative requirements. A product control crosswalk is a planning aid, not a conformity assessment.

## 14. Key risks and decision records

Create an architecture decision record (ADR) for each item:

1. SSH library versus system OpenSSH process.
2. Desktop shell and IPC security model.
3. Local-only versus enterprise control plane, and tenant boundary.
4. Ansible execution isolation on each supported desktop OS.
5. Host CA enrollment, key rotation, and exception expiry.
6. Audit retention, optional session recording, and privacy obligations.
7. Supported legacy Unix matrix and compatibility exception process.
8. Signing, update channel, rollback, and software supply-chain attestations.
9. Local database encryption and backup/restore behavior.
10. Product claims and organizational ISO certification scope.

## 15. Current reference sources

Checked 7 October 2026; revalidate implementation details and upstream recommendations before release.

- ISO, [ISO/IEC 27001:2022 overview](https://www.iso.org/standard/27001)
- NIST, [NISTIR 7966: Security of Interactive and Automated Access Management Using Secure Shell (SSH)](https://doi.org/10.6028/NIST.IR.7966)
- OpenSSH, [Release Notes](https://www.openssh.org/releasenotes.html)
- OpenSSH, [Legacy Options](https://www.openssh.org/legacy.html)
- OpenSSH, [Post-quantum cryptography](https://www.openssh.org/pq.html)
- Ansible Community Documentation, [Ansible Vault](https://docs.ansible.com/projects/ansible/latest/vault_guide/vault.html)

## 16. Definition of done

A release is build-ready only when:

- Every feature has an owner, user story, acceptance test, and security/data classification.
- The architecture and trust boundaries are reviewed and documented.
- Sensitive flows have threat-model coverage and redaction tests.
- Required features operate on the declared support matrix.
- Automation results are reproducible from run manifests without exposing secret values.
- Update artifacts are signed and accompanied by a software bill of materials.
- Operational support, vulnerability response, incident handling, backup, and retention are documented.
- Any compliance statement is limited to substantiated facts and the organization’s certified scope.
