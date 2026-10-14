export interface CredentialReference {
  kind: 'os_keychain' | 'ssh_agent' | 'key_file_reference' | 'certificate' | 'secret_manager' | 'transient_prompt' | 'vault_reference';
  reference_id: string;
  account_or_key_label?: string | null;
  key_path?: string | null;
  certificate_path?: string | null;
  last_used_at?: string | null;
}

export interface VaultCredential {
  id: string;
  title: string;
  username: string;
  password?: string;
  encrypted_password?: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SSHOptions {
  keepalive_interval?: number;
  agent_forwarding?: boolean;
  x11_forwarding?: boolean;
  terminal_type?: string;
  ciphers?: string[];
  kex_algorithms?: string[];
}

export interface ConnectionProfile {
  id: string;
  schema_version: number;
  display_name: string;
  hostname: string;
  port: number;
  username: string;
  folder_id: string | null;
  tags: string[];
  jump_host_profile_id: string | null;
  auth_reference: CredentialReference | null;
  host_trust_policy_id: string | null;
  ssh_options: SSHOptions;
  is_favorite: boolean;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  notes?: string | null;
  os_flavor?: string | null;
  os_name?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  color?: string | null;
  created_at: string;
}

export interface HostTrustRecord {
  id: string;
  hostname_pattern: string;
  port: number;
  key_or_ca_fingerprint: string;
  key_type: string;
  raw_public_key?: string;
  source: 'manually_verified' | 'organization_ca' | 'managed_inventory';
  verified_by: string;
  verified_at: string;
  expires_at?: string | null;
  status: 'active' | 'revoked' | 'expired';
  reason?: string | null;
}

export interface AutomationRunManifest {
  run_id: string;
  requested_by: string;
  requested_at: string;
  project_id: string;
  playbook_path: string;
  source_revision: string;
  inventory_source: string;
  resolved_targets: string[];
  limit: string | null;
  tags: string[];
  extra_vars_digest: string;
  execution_image_digest: string;
  ansible_core_version: string;
  collection_versions: Record<string, string>;
  policy_decision: 'allow' | 'deny' | 'approval_required';
  policy_version: string;
  approvals: Array<{
    actor: string;
    approved_at: string;
    rationale: string;
    scope: string;
  }>;
  rollout: {
    serial: number;
    canary_count: number;
    failure_threshold: number;
    max_run_minutes: number;
  };
  change_reference: string | null;
  started_at: string | null;
  completed_at: string | null;
  per_host_results: Record<
    string,
    {
      status: 'success' | 'failed' | 'changed' | 'skipped' | 'unreachable';
      duration_ms: number;
      summary: string;
    }
  >;
  manifest_hash: string;
}

export type AuditEventType =
  | 'session_connect'
  | 'session_disconnect'
  | 'host_trust_prompt'
  | 'host_trust_accepted'
  | 'host_trust_rejected'
  | 'host_key_mismatch'
  | 'host_key_rotated'
  | 'sftp_upload'
  | 'sftp_download'
  | 'sftp_delete'
  | 'sftp_mkdir'
  | 'sftp_copy'
  | 'automation_requested'
  | 'automation_approved'
  | 'automation_started'
  | 'automation_completed'
  | 'automation_cancelled'
  | 'policy_denied'
  | 'credential_access'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_deleted'
  | 'profile_exported'
  | 'profile_imported'
  | 'vault_credential_saved'
  | 'vault_credential_deleted'
  | 'vault_unlocked'
  | 'vault_locked'
  | 'vault_master_configured'
  | 'playbook_saved'
  | 'playbook_deleted'
  | 'tunnel_started'
  | 'tunnel_stopped'
  | 'tunnel_configured'
  | 'snippet_saved'
  | 'snippet_deleted'
  | 'ssh_key_generated'
  | 'service_action'
  | 'configuration_drift_checked'
  | 'runbook_executed'
  | 'security_audit_completed'
  | 'breakglass_elevated_access'
  | 'mfa_enabled'
  | 'mfa_disabled';

export interface AuditEvent {
  event_id: string;
  event_type: AuditEventType;
  actor_id: string;
  actor_role: string;
  occurred_at: string;
  correlation_id: string;
  resource_type?: string | null;
  resource_id?: string | null;
  action: string;
  outcome: 'success' | 'denied' | 'failed' | 'partial';
  reason?: string | null;
  change_reference?: string | null;
  policy_version?: string | null;
  metadata: Record<string, unknown>;
  integrity_link: string;
}

export interface Policy {
  policy_id: string;
  name: string;
  description: string;
  scope: {
    environments: string[];
  };
  ssh: {
    host_key_mode: 'strict' | 'accept_new' | 'off';
    allow_legacy_algorithms: boolean;
    agent_forwarding: 'disabled' | 'allowed';
    x11_forwarding: 'disabled' | 'allowed';
    supported_kex: string[];
    supported_ciphers: string[];
  };
  automation: {
    max_targets_without_approval: number;
    production_requires_approval: boolean;
    require_change_reference: boolean;
    self_approval: boolean;
    default_serial: number;
    failure_threshold: number;
    max_run_minutes: number;
  };
  credentials: {
    persistent_passwords: boolean;
    require_short_lived_certificates: boolean;
  };
  logging: {
    secrets: 'never';
    terminal_recording: 'disabled' | 'enabled';
  };
}

export interface SFTPItem {
  name: string;
  path: string;
  size: number;
  modifyTime: number;
  isDirectory: boolean;
  isSymlink: boolean;
  permissions: string;
}

export interface LocalDirectoryResult {
  items: SFTPItem[];
  currentPath: string;
  homeDir: string;
}

export interface TransferQueueItem {
  id: string;
  sessionId: string;
  direction: 'upload' | 'download';
  localPath: string;
  remotePath: string;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  totalBytes: number;
  transferredBytes: number;
  progressPercent: number;
  sha256?: string;
  error?: string;
}

export interface SavedPlaybook {
  id: string;
  name: string;
  filename: string;
  description: string;
  badge: string;
  badge_variant?: 'red' | 'amber' | 'emerald' | 'sky' | 'indigo' | 'purple' | 'slate';
  content: string;
  is_builtin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortForwardConfig {
  id: string;
  name: string;
  profileId: string;
  type: 'local' | 'remote' | 'dynamic';
  localHost?: string;
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  status?: 'stopped' | 'running' | 'error';
  errorMessage?: string;
  activeConnections?: number;
  bytesTransferred?: number;
  autoStart?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Snippet {
  id: string;
  title: string;
  command: string;
  description?: string;
  category: 'System' | 'Docker' | 'Network' | 'Services' | 'Logs' | 'Security' | 'Custom';
  tags: string[];
  is_builtin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedSSHKeyPair {
  type: 'ed25519' | 'rsa';
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  comment?: string;
}

export interface SystemHealthMetrics {
  timestamp: number;
  uptime: string;
  loadAverage: [number, number, number];
  cpuUsagePercent: number;
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    mountPoint: string;
  };
  network?: {
    rxBytesPerSec: number;
    txBytesPerSec: number;
  };
  topProcesses: Array<{
    pid: number;
    user: string;
    cpuPercent: number;
    memPercent: number;
    command: string;
  }>;
}

export interface AsciicastFrame {
  time: number;
  type: 'o' | 'i';
  data: string;
}

export interface SessionRecording {
  version: 2;
  width: number;
  height: number;
  timestamp: number;
  title: string;
  env?: {
    TERM?: string;
    SHELL?: string;
  };
  events: [number, string, string][];
}

export interface RemoteFileContent {
  path: string;
  content: string;
  size: number;
  encoding: 'utf-8';
  lastModified?: number;
}


