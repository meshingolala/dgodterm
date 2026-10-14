import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import {
  ConnectionProfile,
  Folder,
  HostTrustRecord,
  AuditEvent,
  AutomationRunManifest,
  Policy,
  CredentialReference,
  VaultCredential,
  SavedPlaybook,
  PortForwardConfig,
  Snippet
} from '../domain/types';
import { redactObject } from '../redaction/redactor';

let SQLInstance: SqlJsStatic | null = null;
let db: Database | null = null;
let dbFilePath = '';

function getStorageDirectory(): string {
  const home = os.homedir();
  const dir = path.join(home, '.dgodterm');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getVaultMasterKey(): Buffer {
  const dir = getStorageDirectory();
  const keyPath = path.join(dir, 'vault.key');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath);
  }
  const key = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
  } catch {
    fs.writeFileSync(keyPath, key);
  }
  return key;
}

export function encryptVaultSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getVaultMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptVaultSecret(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, tagHex, dataHex] = parts;
    const key = getVaultMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Failed to decrypt vault secret:', err);
    return '';
  }
}

import { TotpService } from '../auth/totp';

interface VaultAuthData {
  salt: string;
  hash: string;
  hint?: string;
  createdAt: string;
  mfaEnabled?: boolean;
  mfaSecret?: string; // encrypted with VaultMasterKey
}

function getVaultAuthPath(): string {
  return path.join(getStorageDirectory(), 'vault_auth.json');
}

let isVaultUnlockedInMemory: boolean = false;

export function isVaultMasterConfigured(): boolean {
  return fs.existsSync(getVaultAuthPath());
}

export function isVaultUnlocked(): boolean {
  if (!isVaultMasterConfigured()) return false;
  return isVaultUnlockedInMemory;
}

export function setVaultMasterPassword(password: string, hint?: string): boolean {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const data: VaultAuthData = {
    salt,
    hash,
    hint: hint ? hint.trim() : undefined,
    createdAt: new Date().toISOString(),
    mfaEnabled: false
  };
  try {
    fs.writeFileSync(getVaultAuthPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch {
    fs.writeFileSync(getVaultAuthPath(), JSON.stringify(data, null, 2));
  }
  isVaultUnlockedInMemory = true;
  return true;
}

export function verifyVaultMasterPassword(password: string, mfaToken?: string): { success: boolean; requiresMfa?: boolean; error?: string } {
  const authPath = getVaultAuthPath();
  if (!fs.existsSync(authPath)) return { success: false, error: 'Vault master password not set.' };
  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const authData: VaultAuthData = JSON.parse(raw);
    const calculated = crypto.pbkdf2Sync(password, authData.salt, 100000, 64, 'sha512').toString('hex');
    const matches = crypto.timingSafeEqual(Buffer.from(authData.hash, 'hex'), Buffer.from(calculated, 'hex'));
    if (!matches) {
      return { success: false, error: 'Incorrect master password.' };
    }

    // Check if MFA is enabled
    if (authData.mfaEnabled && authData.mfaSecret) {
      if (!mfaToken) {
        return { success: false, requiresMfa: true, error: 'Two-factor authenticator code required.' };
      }
      const plainSecret = decryptVaultSecret(authData.mfaSecret);
      const isMfaValid = TotpService.verifyCode(mfaToken, plainSecret);
      if (!isMfaValid) {
        return { success: false, requiresMfa: true, error: 'Invalid Google Authenticator code. Check time sync on your device.' };
      }
    }

    isVaultUnlockedInMemory = true;
    return { success: true };
  } catch (err: any) {
    console.error('Error verifying master password:', err);
    return { success: false, error: err.message || 'Authentication error' };
  }
}

export function getMfaStatus(): { isEnabled: boolean } {
  const authPath = getVaultAuthPath();
  if (!fs.existsSync(authPath)) return { isEnabled: false };
  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const authData: VaultAuthData = JSON.parse(raw);
    return { isEnabled: Boolean(authData.mfaEnabled && authData.mfaSecret) };
  } catch {
    return { isEnabled: false };
  }
}

export function setupMfaSecret(): { secret: string; otpauthUrl: string } {
  const secret = TotpService.generateSecret();
  const otpauthUrl = TotpService.generateOtpAuthUrl('operator@dgodterm', 'DgodTerm', secret);
  return { secret, otpauthUrl };
}

export function enableMfa(secret: string, token: string): { success: boolean; error?: string } {
  const authPath = getVaultAuthPath();
  if (!fs.existsSync(authPath)) return { success: false, error: 'Vault is not configured.' };

  const isTokenValid = TotpService.verifyCode(token, secret);
  if (!isTokenValid) {
    return { success: false, error: 'Invalid verification code. Please check your authenticator app.' };
  }

  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const authData: VaultAuthData = JSON.parse(raw);
    authData.mfaEnabled = true;
    authData.mfaSecret = encryptVaultSecret(secret);
    fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), { mode: 0o600 });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save MFA configuration.' };
  }
}

export function disableMfa(password: string): { success: boolean; error?: string } {
  const authPath = getVaultAuthPath();
  if (!fs.existsSync(authPath)) return { success: false, error: 'Vault is not configured.' };

  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const authData: VaultAuthData = JSON.parse(raw);
    const calculated = crypto.pbkdf2Sync(password, authData.salt, 100000, 64, 'sha512').toString('hex');
    const matches = crypto.timingSafeEqual(Buffer.from(authData.hash, 'hex'), Buffer.from(calculated, 'hex'));
    if (!matches) {
      return { success: false, error: 'Incorrect master password.' };
    }

    authData.mfaEnabled = false;
    delete authData.mfaSecret;
    fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), { mode: 0o600 });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to disable MFA.' };
  }
}

export function lockVault(): boolean {
  isVaultUnlockedInMemory = false;
  return true;
}

export function getVaultHint(): string | null {
  const authPath = getVaultAuthPath();
  if (!fs.existsSync(authPath)) return null;
  try {
    const raw = fs.readFileSync(authPath, 'utf8');
    const authData: VaultAuthData = JSON.parse(raw);
    return authData.hint || null;
  } catch {
    return null;
  }
}

export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  if (!SQLInstance) {
    SQLInstance = await initSqlJs();
  }

  const dir = getStorageDirectory();
  dbFilePath = path.join(dir, 'dgodterm.sqlite');

  let fileBuffer: Buffer | null = null;
  if (fs.existsSync(dbFilePath)) {
    fileBuffer = fs.readFileSync(dbFilePath);
  }

  db = fileBuffer ? new SQLInstance.Database(fileBuffer) : new SQLInstance.Database();

  runMigrations(db);
  seedInitialData(db);
  saveDatabase();

  return db;
}

function saveDatabase(): void {
  if (!db || !dbFilePath) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbFilePath, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist database file:', err);
  }
}

function runMigrations(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const res = database.exec('SELECT MAX(version) AS max_v FROM schema_migrations');
  const currentVersion = (res[0]?.values[0]?.[0] as number) || 0;

  if (currentVersion < 1) {
    database.run(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        color TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL DEFAULT 1,
        display_name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL,
        folder_id TEXT,
        tags TEXT,
        jump_host_profile_id TEXT,
        auth_reference TEXT,
        host_trust_policy_id TEXT,
        ssh_options TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        last_connected_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        notes TEXT,
        os_flavor TEXT,
        os_name TEXT
      );

      CREATE TABLE IF NOT EXISTS host_trust (
        id TEXT PRIMARY KEY,
        hostname_pattern TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        key_or_ca_fingerprint TEXT NOT NULL,
        key_type TEXT NOT NULL,
        raw_public_key TEXT,
        source TEXT NOT NULL,
        verified_by TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        expires_at TEXT,
        status TEXT NOT NULL,
        reason TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        reason TEXT,
        change_reference TEXT,
        policy_version TEXT,
        metadata TEXT NOT NULL,
        integrity_link TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS automation_runs (
        run_id TEXT PRIMARY KEY,
        requested_by TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        project_id TEXT NOT NULL,
        playbook_path TEXT NOT NULL,
        source_revision TEXT NOT NULL,
        inventory_source TEXT NOT NULL,
        resolved_targets TEXT NOT NULL,
        limit_val TEXT,
        tags TEXT,
        extra_vars_digest TEXT NOT NULL,
        execution_image_digest TEXT NOT NULL,
        ansible_core_version TEXT NOT NULL,
        collection_versions TEXT,
        policy_decision TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        approvals TEXT,
        rollout TEXT NOT NULL,
        change_reference TEXT,
        started_at TEXT,
        completed_at TEXT,
        per_host_results TEXT,
        manifest_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS policies (
        policy_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        config_json TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        label TEXT,
        key_path TEXT,
        cert_path TEXT,
        encrypted_secret TEXT,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );

      INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'));
    `);
  }

  // Ensure password_vault table exists
  database.run(`
    CREATE TABLE IF NOT EXISTS password_vault (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      username TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Ensure playbooks table exists
  database.run(`
    CREATE TABLE IF NOT EXISTS playbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      description TEXT,
      badge TEXT,
      badge_variant TEXT,
      content TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Ensure snippets table exists
  database.run(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      command TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Custom',
      tags TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Ensure tunnels table exists
  database.run(`
    CREATE TABLE IF NOT EXISTS tunnels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      type TEXT NOT NULL,
      local_host TEXT,
      local_port INTEGER NOT NULL,
      remote_host TEXT,
      remote_port INTEGER,
      auto_start INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  try {
    database.run('ALTER TABLE profiles ADD COLUMN notes TEXT;');
  } catch {
    // Column already exists or table newly created with it
  }

  try {
    database.run('ALTER TABLE profiles ADD COLUMN os_flavor TEXT;');
  } catch {
    // Column already exists
  }

  try {
    database.run('ALTER TABLE profiles ADD COLUMN os_name TEXT;');
  } catch {
    // Column already exists
  }
}

function seedInitialData(database: Database): void {
  // Check if folders already exist
  const res = database.exec('SELECT COUNT(*) FROM folders');
  const count = (res[0]?.values[0]?.[0] as number) || 0;

  if (count === 0) {
    const f1 = 'f0000000-0000-0000-0000-000000000001';
    const f2 = 'f0000000-0000-0000-0000-000000000002';
    const now = new Date().toISOString();

    database.run(
      `INSERT INTO folders (id, name, parent_id, color, created_at) VALUES
       (?, 'Production Fleet', NULL, '#ef4444', ?),
       (?, 'Staging & Dev', NULL, '#3b82f6', ?);`,
      [f1, now, f2, now]
    );

    database.run(
      `INSERT INTO profiles (
        id, schema_version, display_name, hostname, port, username, folder_id,
        tags, jump_host_profile_id, auth_reference, host_trust_policy_id,
        ssh_options, is_favorite, last_connected_at, created_at, updated_at, created_by
      ) VALUES
      (
        'p0000000-0000-0000-0000-000000000001', 1, 'Local Test Linux VM', '127.0.0.1', 2222, 'operator',
        ?, '["test", "local", "vm"]', NULL,
        '{"kind":"ssh_agent","reference_id":"agent-default","account_or_key_label":"Local SSH Agent"}',
        NULL, '{"keepalive_interval":30,"agent_forwarding":false,"x11_forwarding":false,"terminal_type":"xterm-256color"}',
        1, NULL, ?, ?, 'admin'
      ),
      (
        'p0000000-0000-0000-0000-000000000002', 1, 'Prod Bastion Gateway 01', 'bastion.prod.internal', 22, 'sysadmin',
        ?, '["prod", "bastion", "pci"]', NULL,
        '{"kind":"key_file_reference","reference_id":"id_ed25519_prod","account_or_key_label":"Hardware Security Key"}',
        NULL, '{"keepalive_interval":15,"agent_forwarding":false,"x11_forwarding":false,"terminal_type":"xterm-256color"}',
        0, NULL, ?, ?, 'admin'
      );`,
      [f2, now, now, f1, now, now]
    );

    // Initial Host Trust Record
    database.run(
      `INSERT INTO host_trust (
        id, hostname_pattern, port, key_or_ca_fingerprint, key_type, raw_public_key,
        source, verified_by, verified_at, expires_at, status, reason
      ) VALUES
      (
        'ht000000-0000-0000-0000-000000000001', 'bastion.prod.internal', 22,
        'SHA256:vT4+8PqF5r3xLzW+e1kY9j6Q3A5s7D2f8G1h0J9k2Lm', 'ssh-ed25519',
        'AAAAC3NzaC1lZDI1NTE5AAAAIG...', 'organization_ca', 'Security Team', ?, NULL, 'active', 'Initial fleet trust enrollment'
      );`,
      [now]
    );
  }

  // Seed default playbooks if none exist
  const pbRes = database.exec('SELECT COUNT(*) FROM playbooks');
  const pbCount = (pbRes[0]?.values[0]?.[0] as number) || 0;
  if (pbCount === 0) {
    const now = new Date().toISOString();

    const secHardeningYaml = `---
- name: CIS Benchmark Baseline Security Hardening
  hosts: all
  become: yes
  tasks:
    - name: Disable root login over SSH (/etc/ssh/sshd_config)
      lineinfile:
        path: /etc/ssh/sshd_config
        line: "PermitRootLogin no"

    - name: Enforce SSH Protocol 2 & disable empty passwords
      lineinfile:
        path: /etc/ssh/sshd_config
        line: "PermitEmptyPasswords no"

    - name: Configure UFW firewall default ingress deny policy
      command: ufw default deny incoming && ufw default allow outgoing

    - name: Allow SSH port 22 with connection rate limiting
      command: ufw limit 22/tcp

    - name: Install and start Fail2ban intrusion prevention daemon
      apt:
        name: fail2ban
        state: present

    - name: Apply sysctl kernel hardening parameters
      command: sysctl -w net.ipv4.conf.all.rp_filter=1 net.ipv4.tcp_syncookies=1

    - name: Verify auditd security logging daemon is running
      service:
        name: auditd
        state: status
`;

    const osPatchingYaml = `---
- name: Fleet OS Security & Package Patching
  hosts: all
  become: yes
  tasks:
    - name: Update apt package repository cache
      command: apt-get update -y

    - name: Check for pending security updates and CVE advisories
      command: apt list --upgradable

    - name: Upgrade distribution packages (dist-upgrade)
      command: DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y

    - name: Autoremove obsolete orphan dependencies
      command: apt-get autoremove -y

    - name: Check if kernel restart is required
      command: test -f /var/run/reboot-required && echo "REBOOT_REQUIRED" || echo "OK"

    - name: Record post-patch package audit log
      shell: logger -t dgodterm "Patch verification completed"
`;

    const nginxRotateYaml = `---
- name: TLS/SSL Certificate Rotation & Nginx Reload
  hosts: all
  become: yes
  tasks:
    - name: Validate TLS certificate and private key modulus
      command: openssl version

    - name: Backup existing TLS certificates to /etc/ssl/backup/
      command: mkdir -p /etc/ssl/backup && cp -a /etc/ssl/certs /etc/ssl/backup/ 2>/dev/null || true

    - name: Verify Nginx configuration syntax test (nginx -t)
      command: nginx -t

    - name: Graceful reload of Nginx service worker processes
      service:
        name: nginx
        state: reload
`;

    const createUserYaml = `---
- name: Create user and grant sudo access
  hosts: all
  become: yes
  tasks:
    - name: Create operator user with sudo privileges
      user:
        name: newuser
        groups: sudo
        shell: /bin/bash
        state: present

    - name: Ensure passwordless sudo access for operator
      lineinfile:
        path: /etc/sudoers.d/newuser
        line: "newuser ALL=(ALL) NOPASSWD:ALL"
        create: yes
`;

    database.run(
      `INSERT INTO playbooks (id, name, filename, description, badge, badge_variant, content, is_builtin, created_at, updated_at) VALUES
       ('pb-builtin-security', 'CIS Benchmark Baseline Security Hardening', 'security_hardening.yml', 'CIS Benchmark baseline security hardening and firewall policy enforcement.', 'SECURITY', 'sky', ?, 1, ?, ?),
       ('pb-builtin-patching', 'Fleet OS Security & Package Patching', 'os_patching.yml', 'Kernel and CVE package updates across target fleet.', 'PATCHING', 'indigo', ?, 1, ?, ?),
       ('pb-builtin-nginx', 'TLS/SSL Certificate Rotation & Nginx Reload', 'nginx_tls_rotate.yml', 'Automated TLS/SSL certificate reload and reverse proxy configuration.', 'TLS/SSL', 'emerald', ?, 1, ?, ?),
       ('pb-builtin-user', 'Create User with Sudo Access', 'create_user.yml', 'Create operator user with /bin/bash, sudo group, and passwordless sudoers rules.', 'USER', 'purple', ?, 1, ?, ?);`,
      [secHardeningYaml, now, now, osPatchingYaml, now, now, nginxRotateYaml, now, now, createUserYaml, now, now]
    );
  }

  // Check if snippets already exist
  const snipRes = database.exec('SELECT COUNT(*) FROM snippets');
  const snipCount = (snipRes[0]?.values[0]?.[0] as number) || 0;
  if (snipCount === 0) {
    const now = new Date().toISOString();
    const builtinSnippets = [
      {
        id: 'snip-sys-health',
        title: 'System Health & Resources',
        command: 'uname -a && uptime && free -h && df -h',
        description: 'Check kernel version, system uptime, available RAM, and disk utilization.',
        category: 'System',
        tags: ['system', 'health', 'disk', 'memory']
      },
      {
        id: 'snip-docker-ps',
        title: 'Docker Container Status',
        command: 'docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
        description: 'Formatted overview of running Docker containers and port bindings.',
        category: 'Docker',
        tags: ['docker', 'containers']
      },
      {
        id: 'snip-net-ports',
        title: 'Active Listening Ports (ss)',
        command: 'ss -tulpn | grep LISTEN',
        description: 'Display all TCP and UDP listening sockets with associated PIDs and processes.',
        category: 'Network',
        tags: ['network', 'ports', 'firewall']
      },
      {
        id: 'snip-service-status',
        title: 'Systemd Service Status',
        command: 'systemctl status {{service_name}} --no-pager',
        description: 'Inspect status, active state, and recent logs for a specific systemd daemon.',
        category: 'Services',
        tags: ['systemd', 'service']
      },
      {
        id: 'snip-journal-tail',
        title: 'Tail Service Journal Logs',
        command: 'journalctl -u {{service_name}} -n 100 -f',
        description: 'Follow the last 100 journal log lines in real-time.',
        category: 'Logs',
        tags: ['logs', 'journalctl']
      },
      {
        id: 'snip-top-cpu',
        title: 'Top Processes by CPU Usage',
        command: 'ps aux --sort=-%cpu | head -n 11',
        description: 'List the top 10 most CPU-intensive processes.',
        category: 'System',
        tags: ['cpu', 'processes', 'performance']
      },
      {
        id: 'snip-nginx-reload',
        title: 'Test & Reload Nginx Configuration',
        command: 'nginx -t && systemctl reload nginx',
        description: 'Syntax-check Nginx configuration files before triggering graceful reload.',
        category: 'Services',
        tags: ['nginx', 'web', 'proxy']
      },
      {
        id: 'snip-fail2ban-status',
        title: 'Fail2ban Jail Status',
        command: 'fail2ban-client status sshd',
        description: 'Inspect active SSH brute-force defense status and banned IP addresses.',
        category: 'Security',
        tags: ['security', 'fail2ban', 'firewall']
      }
    ];

    for (const snip of builtinSnippets) {
      database.run(
        `INSERT INTO snippets (id, title, command, description, category, tags, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [snip.id, snip.title, snip.command, snip.description, snip.category, JSON.stringify(snip.tags), now, now]
      );
    }
  }
}

// Database Operations
export const dbOperations = {
  // Profiles
  getProfiles(): ConnectionProfile[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM profiles ORDER BY display_name ASC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id as string,
        schema_version: obj.schema_version as number,
        display_name: obj.display_name as string,
        hostname: obj.hostname as string,
        port: obj.port as number,
        username: obj.username as string,
        folder_id: (obj.folder_id as string) || null,
        tags: obj.tags ? JSON.parse(obj.tags as string) : [],
        jump_host_profile_id: (obj.jump_host_profile_id as string) || null,
        auth_reference: obj.auth_reference ? JSON.parse(obj.auth_reference as string) : null,
        host_trust_policy_id: (obj.host_trust_policy_id as string) || null,
        ssh_options: obj.ssh_options ? JSON.parse(obj.ssh_options as string) : {},
        is_favorite: Boolean(obj.is_favorite),
        last_connected_at: (obj.last_connected_at as string) || null,
        created_at: obj.created_at as string,
        updated_at: obj.updated_at as string,
        created_by: obj.created_by as string,
        notes: (obj.notes as string) || null,
        os_flavor: (obj.os_flavor as string) || null,
        os_name: (obj.os_name as string) || null
      };
    });
  },

  saveProfile(profile: ConnectionProfile): void {
    if (!db) return;
    const clean = redactObject(profile);
    const existing = db.exec('SELECT id FROM profiles WHERE id = ?', [clean.id]);
    const tagsJson = JSON.stringify(clean.tags || []);
    const authJson = clean.auth_reference ? JSON.stringify(clean.auth_reference) : null;
    const optsJson = JSON.stringify(clean.ssh_options || {});

    if (existing[0]?.values?.length) {
      db.run(
        `UPDATE profiles SET
          schema_version = ?, display_name = ?, hostname = ?, port = ?, username = ?,
          folder_id = ?, tags = ?, jump_host_profile_id = ?, auth_reference = ?,
          host_trust_policy_id = ?, ssh_options = ?, is_favorite = ?,
          updated_at = ?, notes = ?, os_flavor = ?, os_name = ?
         WHERE id = ?`,
        [
          clean.schema_version ?? 1,
          clean.display_name ?? 'Unnamed',
          clean.hostname ?? '',
          clean.port ?? 22,
          clean.username ?? 'root',
          clean.folder_id ?? null,
          tagsJson,
          clean.jump_host_profile_id ?? null,
          authJson,
          clean.host_trust_policy_id ?? null,
          optsJson,
          clean.is_favorite ? 1 : 0,
          new Date().toISOString(),
          clean.notes ?? null,
          clean.os_flavor ?? null,
          clean.os_name ?? null,
          clean.id
        ]
      );
    } else {
      db.run(
        `INSERT INTO profiles (
          id, schema_version, display_name, hostname, port, username, folder_id,
          tags, jump_host_profile_id, auth_reference, host_trust_policy_id,
          ssh_options, is_favorite, last_connected_at, created_at, updated_at, created_by, notes, os_flavor, os_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clean.id,
          clean.schema_version ?? 1,
          clean.display_name ?? 'Unnamed',
          clean.hostname ?? '',
          clean.port ?? 22,
          clean.username ?? 'root',
          clean.folder_id ?? null,
          tagsJson,
          clean.jump_host_profile_id ?? null,
          authJson,
          clean.host_trust_policy_id ?? null,
          optsJson,
          clean.is_favorite ? 1 : 0,
          clean.last_connected_at ?? null,
          clean.created_at || new Date().toISOString(),
          new Date().toISOString(),
          clean.created_by || 'local-user',
          clean.notes ?? null,
          clean.os_flavor ?? null,
          clean.os_name ?? null
        ]
      );
    }
    saveDatabase();
  },

  deleteProfile(id: string): void {
    if (!db) return;
    db.run('DELETE FROM profiles WHERE id = ?', [id]);
    saveDatabase();
  },

  updateProfileLastConnected(id: string): void {
    if (!db) return;
    db.run('UPDATE profiles SET last_connected_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    saveDatabase();
  },

  updateProfileOsFlavor(id: string, flavor: string, osName?: string): void {
    if (!db) return;
    db.run(
      'UPDATE profiles SET os_flavor = ?, os_name = COALESCE(?, os_name), updated_at = ? WHERE id = ?',
      [flavor, osName || null, new Date().toISOString(), id]
    );
    saveDatabase();
  },

  // Folders
  getFolders(): Folder[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM folders ORDER BY name ASC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id as string,
        name: obj.name as string,
        parent_id: (obj.parent_id as string) || null,
        color: (obj.color as string) || null,
        created_at: obj.created_at as string
      };
    });
  },

  saveFolder(folder: Folder): void {
    if (!db) return;
    const existing = db.exec('SELECT id FROM folders WHERE id = ?', [folder.id]);
    if (existing[0]?.values?.length) {
      db.run('UPDATE folders SET name = ?, parent_id = ?, color = ? WHERE id = ?', [
        folder.name,
        folder.parent_id,
        folder.color || null,
        folder.id
      ]);
    } else {
      db.run('INSERT INTO folders (id, name, parent_id, color, created_at) VALUES (?, ?, ?, ?, ?)', [
        folder.id,
        folder.name,
        folder.parent_id,
        folder.color || null,
        folder.created_at || new Date().toISOString()
      ]);
    }
    saveDatabase();
  },

  deleteFolder(id: string): void {
    if (!db) return;
    db.run('DELETE FROM folders WHERE id = ?', [id]);
    db.run('UPDATE profiles SET folder_id = NULL WHERE folder_id = ?', [id]);
    saveDatabase();
  },

  // Host Trust
  getHostTrustRecords(): HostTrustRecord[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM host_trust ORDER BY verified_at DESC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id as string,
        hostname_pattern: obj.hostname_pattern as string,
        port: obj.port as number,
        key_or_ca_fingerprint: obj.key_or_ca_fingerprint as string,
        key_type: obj.key_type as string,
        raw_public_key: (obj.raw_public_key as string) || undefined,
        source: obj.source as any,
        verified_by: obj.verified_by as string,
        verified_at: obj.verified_at as string,
        expires_at: (obj.expires_at as string) || null,
        status: obj.status as any,
        reason: (obj.reason as string) || null
      };
    });
  },

  saveHostTrustRecord(record: HostTrustRecord): void {
    if (!db) return;
    const existing = db.exec('SELECT id FROM host_trust WHERE id = ?', [record.id]);
    if (existing[0]?.values?.length) {
      db.run(
        `UPDATE host_trust SET
          hostname_pattern = ?, port = ?, key_or_ca_fingerprint = ?, key_type = ?,
          raw_public_key = ?, source = ?, verified_by = ?, verified_at = ?,
          expires_at = ?, status = ?, reason = ?
         WHERE id = ?`,
        [
          record.hostname_pattern,
          record.port,
          record.key_or_ca_fingerprint,
          record.key_type,
          record.raw_public_key || null,
          record.source,
          record.verified_by,
          record.verified_at,
          record.expires_at || null,
          record.status,
          record.reason || null,
          record.id
        ]
      );
    } else {
      db.run(
        `INSERT INTO host_trust (
          id, hostname_pattern, port, key_or_ca_fingerprint, key_type, raw_public_key,
          source, verified_by, verified_at, expires_at, status, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.hostname_pattern,
          record.port,
          record.key_or_ca_fingerprint,
          record.key_type,
          record.raw_public_key || null,
          record.source,
          record.verified_by,
          record.verified_at,
          record.expires_at || null,
          record.status,
          record.reason || null
        ]
      );
    }
    saveDatabase();
  },

  deleteHostTrustRecord(id: string): void {
    if (!db) return;
    db.run('DELETE FROM host_trust WHERE id = ?', [id]);
    saveDatabase();
  },

  // Audit Events
  getAuditEvents(limit = 200): AuditEvent[] {
    if (!db) return [];
    const res = db.exec(`SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT ${limit}`);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        event_id: obj.event_id as string,
        event_type: obj.event_type as any,
        actor_id: obj.actor_id as string,
        actor_role: obj.actor_role as string,
        occurred_at: obj.occurred_at as string,
        correlation_id: obj.correlation_id as string,
        resource_type: (obj.resource_type as string) || null,
        resource_id: (obj.resource_id as string) || null,
        action: obj.action as string,
        outcome: obj.outcome as any,
        reason: (obj.reason as string) || null,
        change_reference: (obj.change_reference as string) || null,
        policy_version: (obj.policy_version as string) || null,
        metadata: obj.metadata ? JSON.parse(obj.metadata as string) : {},
        integrity_link: obj.integrity_link as string
      };
    });
  },

  getLatestAuditIntegrityLink(): string {
    if (!db) return 'GENESIS_INTEGRITY_LINK_DGODTERM_0000000000';
    const res = db.exec('SELECT integrity_link FROM audit_events ORDER BY occurred_at DESC LIMIT 1');
    if (res[0]?.values?.length) {
      return res[0].values[0][0] as string;
    }
    return 'GENESIS_INTEGRITY_LINK_DGODTERM_0000000000';
  },

  saveAuditEvent(event: AuditEvent): void {
    if (!db) return;
    const cleanMeta = redactObject(event.metadata || {});
    db.run(
      `INSERT INTO audit_events (
        event_id, event_type, actor_id, actor_role, occurred_at, correlation_id,
        resource_type, resource_id, action, outcome, reason, change_reference,
        policy_version, metadata, integrity_link
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.event_id,
        event.event_type,
        event.actor_id,
        event.actor_role,
        event.occurred_at,
        event.correlation_id,
        event.resource_type || null,
        event.resource_id || null,
        event.action,
        event.outcome,
        event.reason || null,
        event.change_reference || null,
        event.policy_version || null,
        JSON.stringify(cleanMeta),
        event.integrity_link
      ]
    );
    saveDatabase();
  },

  // Automation Runs
  getAutomationRuns(limit = 50): AutomationRunManifest[] {
    if (!db) return [];
    const res = db.exec(`SELECT * FROM automation_runs ORDER BY requested_at DESC LIMIT ${limit}`);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        run_id: obj.run_id as string,
        requested_by: obj.requested_by as string,
        requested_at: obj.requested_at as string,
        project_id: obj.project_id as string,
        playbook_path: obj.playbook_path as string,
        source_revision: obj.source_revision as string,
        inventory_source: obj.inventory_source as string,
        resolved_targets: obj.resolved_targets ? JSON.parse(obj.resolved_targets as string) : [],
        limit: (obj.limit_val as string) || null,
        tags: obj.tags ? JSON.parse(obj.tags as string) : [],
        extra_vars_digest: obj.extra_vars_digest as string,
        execution_image_digest: obj.execution_image_digest as string,
        ansible_core_version: obj.ansible_core_version as string,
        collection_versions: obj.collection_versions ? JSON.parse(obj.collection_versions as string) : {},
        policy_decision: obj.policy_decision as any,
        policy_version: obj.policy_version as string,
        approvals: obj.approvals ? JSON.parse(obj.approvals as string) : [],
        rollout: obj.rollout ? JSON.parse(obj.rollout as string) : { serial: 1, canary_count: 0, failure_threshold: 1, max_run_minutes: 30 },
        change_reference: (obj.change_reference as string) || null,
        started_at: (obj.started_at as string) || null,
        completed_at: (obj.completed_at as string) || null,
        per_host_results: obj.per_host_results ? JSON.parse(obj.per_host_results as string) : {},
        manifest_hash: obj.manifest_hash as string
      };
    });
  },

  saveAutomationRun(manifest: AutomationRunManifest): void {
    if (!db) return;
    const clean = redactObject(manifest);
    const existing = db.exec('SELECT run_id FROM automation_runs WHERE run_id = ?', [clean.run_id]);

    const targetsJson = JSON.stringify(clean.resolved_targets || []);
    const tagsJson = JSON.stringify(clean.tags || []);
    const collsJson = JSON.stringify(clean.collection_versions || {});
    const appsJson = JSON.stringify(clean.approvals || []);
    const rolloutJson = JSON.stringify(clean.rollout || {});
    const resultsJson = JSON.stringify(clean.per_host_results || {});

    if (existing[0]?.values?.length) {
      db.run(
        `UPDATE automation_runs SET
          policy_decision = ?, approvals = ?, started_at = ?, completed_at = ?,
          per_host_results = ?, manifest_hash = ?
         WHERE run_id = ?`,
        [
          clean.policy_decision,
          appsJson,
          clean.started_at,
          clean.completed_at,
          resultsJson,
          clean.manifest_hash,
          clean.run_id
        ]
      );
    } else {
      db.run(
        `INSERT INTO automation_runs (
          run_id, requested_by, requested_at, project_id, playbook_path,
          source_revision, inventory_source, resolved_targets, limit_val, tags,
          extra_vars_digest, execution_image_digest, ansible_core_version, collection_versions,
          policy_decision, policy_version, approvals, rollout, change_reference,
          started_at, completed_at, per_host_results, manifest_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clean.run_id,
          clean.requested_by,
          clean.requested_at,
          clean.project_id,
          clean.playbook_path,
          clean.source_revision,
          clean.inventory_source,
          targetsJson,
          clean.limit,
          tagsJson,
          clean.extra_vars_digest,
          clean.execution_image_digest,
          clean.ansible_core_version,
          collsJson,
          clean.policy_decision,
          clean.policy_version,
          appsJson,
          rolloutJson,
          clean.change_reference,
          clean.started_at,
          clean.completed_at,
          resultsJson,
          clean.manifest_hash
        ]
      );
    }
    saveDatabase();
  },

  // Password Vault Operations
  getVaultCredentials(includeDecryptedPassword = false): VaultCredential[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM password_vault ORDER BY title COLLATE NOCASE ASC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      const enc = (obj.encrypted_password as string) || '';
      return {
        id: obj.id as string,
        title: obj.title as string,
        username: obj.username as string,
        encrypted_password: enc,
        password: includeDecryptedPassword ? decryptVaultSecret(enc) : undefined,
        notes: (obj.notes as string) || null,
        created_at: obj.created_at as string,
        updated_at: obj.updated_at as string
      };
    });
  },

  getVaultCredentialById(id: string, includeDecrypted = true): VaultCredential | null {
    if (!db) return null;
    const res = db.exec('SELECT * FROM password_vault WHERE id = ?', [id]);
    if (!res[0] || !res[0].values.length) return null;
    const cols = res[0].columns;
    const obj: Record<string, unknown> = {};
    cols.forEach((col, idx) => {
      obj[col] = res[0].values[0][idx];
    });
    const enc = (obj.encrypted_password as string) || '';
    return {
      id: obj.id as string,
      title: obj.title as string,
      username: obj.username as string,
      encrypted_password: enc,
      password: includeDecrypted ? decryptVaultSecret(enc) : undefined,
      notes: (obj.notes as string) || null,
      created_at: obj.created_at as string,
      updated_at: obj.updated_at as string
    };
  },

  saveVaultCredential(cred: { id?: string; title: string; username: string; password?: string; notes?: string }): VaultCredential {
    if (!db) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const id = cred.id || `vault-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const existing = db.exec('SELECT encrypted_password, created_at FROM password_vault WHERE id = ?', [id]);

    let encryptedPassword = '';
    let createdAt = now;

    if (existing[0]?.values?.length) {
      createdAt = existing[0].values[0][1] as string;
      if (cred.password !== undefined && cred.password !== '') {
        encryptedPassword = encryptVaultSecret(cred.password);
      } else {
        encryptedPassword = existing[0].values[0][0] as string;
      }
      db.run(
        `UPDATE password_vault SET title = ?, username = ?, encrypted_password = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [cred.title.trim(), cred.username.trim(), encryptedPassword, cred.notes || null, now, id]
      );
    } else {
      encryptedPassword = cred.password ? encryptVaultSecret(cred.password) : '';
      db.run(
        `INSERT INTO password_vault (id, title, username, encrypted_password, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, cred.title.trim(), cred.username.trim(), encryptedPassword, cred.notes || null, createdAt, now]
      );
    }
    saveDatabase();

    return {
      id,
      title: cred.title.trim(),
      username: cred.username.trim(),
      encrypted_password: encryptedPassword,
      password: cred.password,
      notes: cred.notes || null,
      created_at: createdAt,
      updated_at: now
    };
  },

  deleteVaultCredential(id: string): void {
    if (!db) return;
    db.run('DELETE FROM password_vault WHERE id = ?', [id]);
    saveDatabase();
  },

  getVaultStatus(): { isConfigured: boolean; isUnlocked: boolean; hint: string | null; mfaEnabled: boolean } {
    const isConfigured = isVaultMasterConfigured();
    return {
      isConfigured,
      isUnlocked: isConfigured ? isVaultUnlocked() : true,
      hint: getVaultHint(),
      mfaEnabled: getMfaStatus().isEnabled
    };
  },

  setupVaultMaster(password: string, hint?: string): boolean {
    return setVaultMasterPassword(password, hint);
  },

  unlockVault(password: string, mfaToken?: string): { success: boolean; requiresMfa?: boolean; error?: string } {
    return verifyVaultMasterPassword(password, mfaToken);
  },

  lockVault(): boolean {
    return lockVault();
  },

  getMfaStatus(): { isEnabled: boolean } {
    return getMfaStatus();
  },

  setupMfa(): { secret: string; otpauthUrl: string } {
    return setupMfaSecret();
  },

  enableMfa(secret: string, token: string): { success: boolean; error?: string } {
    return enableMfa(secret, token);
  },

  disableMfa(password: string): { success: boolean; error?: string } {
    return disableMfa(password);
  },

  // Playbooks CRUD
  getPlaybooks(): SavedPlaybook[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM playbooks ORDER BY is_builtin DESC, name ASC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id as string,
        name: obj.name as string,
        filename: obj.filename as string,
        description: (obj.description as string) || '',
        badge: (obj.badge as string) || 'PLAYBOOK',
        badge_variant: (obj.badge_variant as any) || 'indigo',
        content: obj.content as string,
        is_builtin: Boolean(obj.is_builtin),
        created_at: obj.created_at as string,
        updated_at: obj.updated_at as string
      };
    });
  },

  getPlaybookById(id: string): SavedPlaybook | null {
    if (!db) return null;
    const res = db.exec('SELECT * FROM playbooks WHERE id = ?', [id]);
    if (!res[0] || !res[0].values.length) return null;
    const cols = res[0].columns;
    const row = res[0].values[0];
    const obj: Record<string, unknown> = {};
    cols.forEach((col, idx) => { obj[col] = row[idx]; });
    return {
      id: obj.id as string,
      name: obj.name as string,
      filename: obj.filename as string,
      description: (obj.description as string) || '',
      badge: (obj.badge as string) || 'PLAYBOOK',
      badge_variant: (obj.badge_variant as any) || 'indigo',
      content: obj.content as string,
      is_builtin: Boolean(obj.is_builtin),
      created_at: obj.created_at as string,
      updated_at: obj.updated_at as string
    };
  },

  savePlaybook(p: Partial<SavedPlaybook> & { name: string; content: string }): SavedPlaybook {
    if (!db) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    let filename = p.filename?.trim() || '';
    if (!filename) {
      filename = p.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') + '.yml';
    }
    if (!filename.endsWith('.yml') && !filename.endsWith('.yaml')) {
      filename += '.yml';
    }

    const id = p.id || `pb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const existing = db.exec('SELECT id, created_at, is_builtin FROM playbooks WHERE id = ?', [id]);

    const name = p.name.trim();
    const description = p.description?.trim() || '';
    const badge = p.badge?.trim().toUpperCase() || 'CUSTOM';
    const badgeVariant = p.badge_variant || 'sky';
    const content = p.content;

    if (existing[0]?.values?.length) {
      const createdAt = existing[0].values[0][1] as string;
      const isBuiltin = Boolean(existing[0].values[0][2]);
      db.run(
        `UPDATE playbooks SET name = ?, filename = ?, description = ?, badge = ?, badge_variant = ?, content = ?, updated_at = ? WHERE id = ?`,
        [name, filename, description, badge, badgeVariant, content, now, id]
      );
      saveDatabase();
      return {
        id,
        name,
        filename,
        description,
        badge,
        badge_variant: badgeVariant,
        content,
        is_builtin: isBuiltin,
        created_at: createdAt,
        updated_at: now
      };
    } else {
      const isBuiltin = p.is_builtin ? 1 : 0;
      db.run(
        `INSERT INTO playbooks (id, name, filename, description, badge, badge_variant, content, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, filename, description, badge, badgeVariant, content, isBuiltin, now, now]
      );
      saveDatabase();
      return {
        id,
        name,
        filename,
        description,
        badge,
        badge_variant: badgeVariant,
        content,
        is_builtin: Boolean(isBuiltin),
        created_at: now,
        updated_at: now
      };
    }
  },

  deletePlaybook(id: string): void {
    if (!db) return;
    db.run('DELETE FROM playbooks WHERE id = ?', [id]);
    saveDatabase();
  },

  // Snippets
  getSnippets(): Snippet[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM snippets ORDER BY category ASC, title ASC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id as string,
        title: obj.title as string,
        command: obj.command as string,
        description: (obj.description as string) || '',
        category: (obj.category as any) || 'Custom',
        tags: obj.tags ? JSON.parse(obj.tags as string) : [],
        is_builtin: Boolean(obj.is_builtin),
        created_at: obj.created_at as string,
        updated_at: obj.updated_at as string
      };
    });
  },

  saveSnippet(snip: Partial<Snippet>): Snippet {
    if (!db) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const id = snip.id || `snip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const title = (snip.title || 'Untitled Snippet').trim();
    const command = (snip.command || '').trim();
    const description = (snip.description || '').trim();
    const category = (snip.category as any) || 'Custom';
    const tagsJson = JSON.stringify(snip.tags || []);
    const existing = db.exec('SELECT id, created_at, is_builtin FROM snippets WHERE id = ?', [id]);

    if (existing[0]?.values?.length) {
      const createdAt = existing[0].values[0][1] as string;
      const isBuiltin = Boolean(existing[0].values[0][2]);
      db.run(
        `UPDATE snippets SET title = ?, command = ?, description = ?, category = ?, tags = ?, updated_at = ? WHERE id = ?`,
        [title, command, description, category, tagsJson, now, id]
      );
      saveDatabase();
      return {
        id,
        title,
        command,
        description,
        category,
        tags: snip.tags || [],
        is_builtin: isBuiltin,
        created_at: createdAt,
        updated_at: now
      };
    } else {
      const isBuiltin = snip.is_builtin ? 1 : 0;
      db.run(
        `INSERT INTO snippets (id, title, command, description, category, tags, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title, command, description, category, tagsJson, isBuiltin, now, now]
      );
      saveDatabase();
      return {
        id,
        title,
        command,
        description,
        category,
        tags: snip.tags || [],
        is_builtin: Boolean(isBuiltin),
        created_at: now,
        updated_at: now
      };
    }
  },

  deleteSnippet(id: string): void {
    if (!db) return;
    db.run('DELETE FROM snippets WHERE id = ?', [id]);
    saveDatabase();
  },

  // Tunnels
  getTunnels(): PortForwardConfig[] {
    if (!db) return [];
    const res = db.exec('SELECT * FROM tunnels ORDER BY name ASC');
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id as string,
        name: obj.name as string,
        profileId: obj.profile_id as string,
        type: (obj.type as any) || 'local',
        localHost: (obj.local_host as string) || '127.0.0.1',
        localPort: obj.local_port as number,
        remoteHost: (obj.remote_host as string) || '127.0.0.1',
        remotePort: (obj.remote_port as number) || undefined,
        autoStart: Boolean(obj.auto_start),
        status: 'stopped',
        created_at: obj.created_at as string,
        updated_at: obj.updated_at as string
      };
    });
  },

  saveTunnel(tun: Partial<PortForwardConfig>): PortForwardConfig {
    if (!db) throw new Error('Database not initialized');
    const now = new Date().toISOString();
    const id = tun.id || `tun-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const name = (tun.name || 'Port Forward').trim();
    const profileId = tun.profileId || '';
    const type = tun.type || 'local';
    const localHost = tun.localHost || '127.0.0.1';
    const localPort = Number(tun.localPort) || 8080;
    const remoteHost = tun.remoteHost || '127.0.0.1';
    const remotePort = tun.remotePort ? Number(tun.remotePort) : null;
    const autoStart = tun.autoStart ? 1 : 0;

    const existing = db.exec('SELECT id, created_at FROM tunnels WHERE id = ?', [id]);
    if (existing[0]?.values?.length) {
      const createdAt = existing[0].values[0][1] as string;
      db.run(
        `UPDATE tunnels SET name = ?, profile_id = ?, type = ?, local_host = ?, local_port = ?, remote_host = ?, remote_port = ?, auto_start = ?, updated_at = ? WHERE id = ?`,
        [name, profileId, type, localHost, localPort, remoteHost, remotePort, autoStart, now, id]
      );
      saveDatabase();
      return {
        id,
        name,
        profileId,
        type,
        localHost,
        localPort,
        remoteHost,
        remotePort: remotePort ?? undefined,
        autoStart: Boolean(autoStart),
        status: 'stopped',
        created_at: createdAt,
        updated_at: now
      };
    } else {
      db.run(
        `INSERT INTO tunnels (id, name, profile_id, type, local_host, local_port, remote_host, remote_port, auto_start, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, profileId, type, localHost, localPort, remoteHost, remotePort, autoStart, now, now]
      );
      saveDatabase();
      return {
        id,
        name,
        profileId,
        type,
        localHost,
        localPort,
        remoteHost,
        remotePort: remotePort ?? undefined,
        autoStart: Boolean(autoStart),
        status: 'stopped',
        created_at: now,
        updated_at: now
      };
    }
  },

  deleteTunnel(id: string): void {
    if (!db) return;
    db.run('DELETE FROM tunnels WHERE id = ?', [id]);
    saveDatabase();
  }
};
