import { app, BrowserWindow, ipcMain, dialog, clipboard, Tray, Menu, Notification, globalShortcut, nativeImage, powerMonitor } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { initializeDatabase, dbOperations } from '../storage/db';
import { SSHManager } from '../ssh/ssh-client';
import { SFTPManager } from '../sftp/sftp-client';
import { TrustStore } from '../ssh/trust-store';
import { CredentialBroker } from '../credential/credential-broker';
import { PolicyEngine } from '../policy/policy-engine';
import { AuditService } from '../audit/audit-service';
import { AnsibleRunner } from '../automation/ansible-runner';
import { redactObject } from '../redaction/redactor';
import { SSHKeyGenerator } from '../ssh/key-generator';
import { TunnelManager } from '../ssh/tunnel-manager';
import { SystemHealthMonitor } from '../ssh/system-health';
import { SystemdManager } from '../ssh/systemd-manager';
import { ConfigDriftService } from '../ssh/config-drift';
import { NetworkPortsService } from '../ssh/network-ports';
import { SecurityAuditService } from '../ssh/security-audit';
import { RunbookRunnerService } from '../ssh/runbook-runner';
import { DisasterRecoveryService } from '../storage/disaster-recovery';
import { getHostSystemResources } from '../domain/system-resources';
import { invokeFeature } from '../features/registry';
import { UptimeMonitorService } from '../features/uptime-monitor';
import { LocalTerminalManager } from '../terminal/local-shell';

// Configure app name and clean userData path to prevent disk cache locks on Windows
app.name = 'dgodterm';
const userDataPath = path.join(os.homedir(), '.dgodterm', 'electron-data');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
app.setPath('userData', userDataPath);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// Enforce single running instance to avoid process/file locks
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let hasShownTrayNotice = false;

function getAppIcon(): string {
  const candidates = [
    path.join(__dirname, '../icon.png'),
    path.join(__dirname, '../../build/icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'dist/icon.png'),
    path.join(process.cwd(), 'build/icon.png')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return '';
}

async function createWindow() {
  try {
    console.log('[Main] Initializing database...');
    await initializeDatabase();
    console.log('[Main] Database initialized successfully.');

    const iconPath = getAppIcon();
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 920,
      minWidth: 1024,
      minHeight: 700,
      show: false,
      title: 'DgodTerm — Secure SSH & Ansible Fleet Automation',
      backgroundColor: '#090d16',
      icon: iconPath || undefined,
      webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false
      }
    });

    // Create System Tray
    if (!tray) {
      try {
        const trayIcon = iconPath
          ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
          : nativeImage.createEmpty();
        tray = new Tray(trayIcon);
        const contextMenu = Menu.buildFromTemplate([
          {
            label: 'Show DgodTerm',
            click: () => {
              if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
              }
            }
          },
          {
            label: 'Toggle Dropdown Window (F12)',
            accelerator: 'F12',
            click: () => {
              if (!mainWindow) return;
              if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
                mainWindow.hide();
              } else {
                mainWindow.show();
                mainWindow.focus();
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Quit DgodTerm',
            click: () => {
              isQuitting = true;
              app.quit();
            }
          }
        ]);
        tray.setToolTip('DgodTerm — Secure Terminal & Fleet Automation');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        });
      } catch (trayErr) {
        console.warn('[Main] System tray initialization warning:', trayErr);
      }
    }

    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[Main] Failed to load ${url}: ${code} - ${desc}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[Main] Renderer finished loading successfully.');
    });

    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[Renderer Console] [Level ${level}] ${message} (${sourceId}:${line})`);
    });

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
      console.log('[Main] Loading DEV URL:', process.env.VITE_DEV_SERVER_URL);
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      console.log('[Main] Loading index file:', indexPath);
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        mainWindow.loadURL('http://localhost:5188');
      }
    }

    const displayWindow = () => {
      if (mainWindow && !mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
    };

    mainWindow.once('ready-to-show', displayWindow);
    setTimeout(displayWindow, 1500);

    // Minimize to tray on close
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
        if (!hasShownTrayNotice) {
          hasShownTrayNotice = true;
          try {
            if (Notification.isSupported()) {
              new Notification({
                title: 'DgodTerm Minimized',
                body: 'DgodTerm is still running in the background. Press F12 or click the tray icon to restore.',
                icon: iconPath || undefined
              }).show();
            }
          } catch {}
        }
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('[Main] Error in createWindow:', err);
  }
}

function registerIpcHandlers() {
  const audit = AuditService.getInstance();
  const ssh = SSHManager.getInstance();
  const sftp = SFTPManager.getInstance();
  const trust = TrustStore.getInstance();
  const creds = CredentialBroker.getInstance();
  const policy = PolicyEngine.getInstance();
  const ansible = AnsibleRunner.getInstance();
 
  // Window Controls (Frameless Window)
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  });
  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });
  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Profiles
  ipcMain.handle('profiles:get-all', () => dbOperations.getProfiles());
  ipcMain.handle('profiles:save', (_e, profile) => {
    dbOperations.saveProfile(profile);
    audit.logEvent({
      eventType: 'profile_updated',
      action: 'save_profile',
      outcome: 'success',
      resourceType: 'profile',
      resourceId: profile.id,
      metadata: { displayName: profile.display_name, host: profile.hostname }
    });
    return true;
  });
  ipcMain.handle('profiles:delete', (_e, id) => {
    dbOperations.deleteProfile(id);
    audit.logEvent({
      eventType: 'profile_deleted',
      action: 'delete_profile',
      outcome: 'success',
      resourceType: 'profile',
      resourceId: id
    });
    return true;
  });

  // Folders
  ipcMain.handle('folders:get-all', () => dbOperations.getFolders());
  ipcMain.handle('folders:save', (_e, folder) => {
    dbOperations.saveFolder(folder);
    return true;
  });
  ipcMain.handle('folders:delete', (_e, id) => {
    dbOperations.deleteFolder(id);
    return true;
  });

  // Password Vault & App Authentication
  ipcMain.handle('vault:get-status', () => dbOperations.getVaultStatus());
  ipcMain.handle('vault:setup-master', (_e, { password, hint }) => {
    const success = dbOperations.setupVaultMaster(password, hint);
    audit.logEvent({
      eventType: 'vault_master_configured',
      action: 'setup_vault_master_password',
      outcome: success ? 'success' : 'failed',
      metadata: { hasHint: Boolean(hint) }
    });
    return success;
  });
  ipcMain.handle('vault:unlock', (_e, { password, mfaToken }) => {
    const res = dbOperations.unlockVault(password, mfaToken);
    audit.logEvent({
      eventType: 'vault_unlocked',
      action: 'unlock_vault',
      outcome: res.success ? 'success' : 'denied',
      metadata: { requiresMfa: Boolean(res.requiresMfa) }
    });
    return res;
  });
  ipcMain.handle('vault:lock', () => {
    const success = dbOperations.lockVault();
    audit.logEvent({
      eventType: 'vault_locked',
      action: 'lock_vault',
      outcome: 'success',
      metadata: {}
    });
    return success;
  });
  ipcMain.handle('vault:mfa-status', () => dbOperations.getMfaStatus());
  ipcMain.handle('vault:mfa-setup', () => dbOperations.setupMfa());
  ipcMain.handle('vault:mfa-enable', (_e, { secret, token }) => {
    const res = dbOperations.enableMfa(secret, token);
    audit.logEvent({
      eventType: 'mfa_enabled',
      action: 'google_authenticator_configured',
      outcome: res.success ? 'success' : 'failed',
      metadata: {}
    });
    return res;
  });
  ipcMain.handle('vault:mfa-disable', (_e, { password }) => {
    const res = dbOperations.disableMfa(password);
    audit.logEvent({
      eventType: 'mfa_disabled',
      action: 'google_authenticator_disabled',
      outcome: res.success ? 'success' : 'failed',
      metadata: {}
    });
    return res;
  });
  ipcMain.handle('vault:get-all', () => dbOperations.getVaultCredentials(true));
  ipcMain.handle('vault:save', (_e, cred) => {
    const saved = dbOperations.saveVaultCredential(cred);
    audit.logEvent({
      eventType: 'vault_credential_saved',
      action: 'save_vault_credential',
      outcome: 'success',
      resourceType: 'vault_credential',
      resourceId: saved.id,
      metadata: { title: saved.title, username: saved.username }
    });
    return saved;
  });
  ipcMain.handle('vault:delete', (_e, id) => {
    dbOperations.deleteVaultCredential(id);
    audit.logEvent({
      eventType: 'vault_credential_deleted',
      action: 'delete_vault_credential',
      outcome: 'success',
      resourceType: 'vault_credential',
      resourceId: id
    });
    return true;
  });

  // Profile Export / Import
  ipcMain.handle('profiles:export', () => {
    const profiles = dbOperations.getProfiles();
    const scrubbed = profiles.map((p) => {
      const copy = { ...p };
      // Omit secret references on export for safe portable exchange
      if (copy.auth_reference) {
        copy.auth_reference = {
          kind: copy.auth_reference.kind,
          reference_id: copy.auth_reference.reference_id,
          account_or_key_label: copy.auth_reference.account_or_key_label || null
        };
      }
      return copy;
    });

    audit.logEvent({
      eventType: 'profile_exported',
      action: 'export_profiles_sanitized',
      outcome: 'success',
      metadata: { count: scrubbed.length }
    });

    return JSON.stringify(scrubbed, null, 2);
  });

  ipcMain.handle('profiles:import', (_e, jsonData: any) => {
    try {
      const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!Array.isArray(parsed)) throw new Error('Expected array of profiles');

      let importedCount = 0;
      for (const p of parsed) {
        if (!p.id || !p.hostname || !p.display_name) continue;
        dbOperations.saveProfile(p);
        importedCount++;
      }

      audit.logEvent({
        eventType: 'profile_imported',
        action: 'import_profiles_validated',
        outcome: 'success',
        metadata: { importedCount }
      });

      return { success: true, importedCount };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // SSH Sessions
  ipcMain.handle('ssh:connect', async (_e, { sessionId, profileId, cols, rows }) => {
    const profiles = dbOperations.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Profile not found');

    ssh.connectSession(sessionId, profile, cols, rows, {
      onData: (data) => {
        mainWindow?.webContents.send('ssh:stream-data', { sessionId, data });
      },
      onClose: (code) => {
        mainWindow?.webContents.send('ssh:closed', { sessionId, code });
      },
      onError: (err) => {
        mainWindow?.webContents.send('ssh:error', { sessionId, error: err.message });
      },
      onHostVerificationRequired: (result) => {
        mainWindow?.webContents.send('ssh:host-verification-prompt', { sessionId, result });
      },
      onPasswordRequired: (prompt) => {
        mainWindow?.webContents.send('ssh:password-prompt', { sessionId, prompt });
      },
      onOsFlavorDetected: (profileId, flavor, osName) => {
        mainWindow?.webContents.send('profile:flavor-detected', { profileId, flavor, osName });
      }
    });

    return true;
  });

  ipcMain.on('ssh:data', (_e, { sessionId, data }) => {
    ssh.sendData(sessionId, data);
  });

  ipcMain.on('ssh:resize', (_e, { sessionId, cols, rows }) => {
    ssh.resize(sessionId, cols, rows);
  });

  ipcMain.handle('ssh:disconnect', (_e, sessionId) => {
    ssh.disconnectSession(sessionId);
    return true;
  });

  ipcMain.handle('ssh:resolve-host-verification', (_e, { sessionId, accept }) => {
    ssh.resolveHostVerification(sessionId, accept);
    return true;
  });

  ipcMain.handle('ssh:submit-transient-password', (_e, { sessionId, pass, ttlMinutes, profileId }) => {
    ssh.submitTransientPassword(sessionId, pass, ttlMinutes, profileId);
    return true;
  });

  // Host Trust Store
  ipcMain.handle('trust:get-records', () => dbOperations.getHostTrustRecords());
  ipcMain.handle('trust:accept-key', (_e, params) => trust.acceptHostKey(params));
  ipcMain.handle('trust:rotate-key', (_e, params) => trust.rotateHostKey(params));
  ipcMain.handle('trust:revoke-key', (_e, { recordId, reason }) => trust.revokeHostKey(recordId, reason));

  // SFTP
  ipcMain.handle('sftp:connect', async (_e, { sessionId, profileId }) => {
    const profiles = dbOperations.getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Profile not found');
    await sftp.connectSFTP(sessionId, profile);
    return true;
  });

  ipcMain.handle('sftp:disconnect', (_e, sessionId) => {
    sftp.disconnectSFTP(sessionId);
    return true;
  });

  ipcMain.handle('sftp:list-local', (_e, dirPath) => {
    const target = dirPath || os.homedir();
    return sftp.listLocalDirectory(target);
  });

  ipcMain.handle('sftp:list-remote', async (_e, { sessionId, dirPath }) => {
    return sftp.listRemoteDirectory(sessionId, dirPath || '.');
  });

  ipcMain.handle('sftp:upload-file', async (_e, { sessionId, localPath, remotePath }) => {
    return sftp.uploadFile(sessionId, localPath, remotePath, (transferred, total, speed) => {
      mainWindow?.webContents.send('sftp:transfer-progress', {
        sessionId,
        direction: 'upload',
        name: path.basename(localPath),
        localPath,
        remotePath,
        transferred,
        total,
        speed: speed || 0
      });
    });
  });

  ipcMain.handle('sftp:upload-buffer', async (_e, { sessionId, buffer, remotePath }) => {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return sftp.uploadBuffer(sessionId, buf, remotePath);
  });

  ipcMain.handle('sftp:download-file', async (_e, { sessionId, remotePath, localPath, sudoPassword }) => {
    return sftp.downloadFile(sessionId, remotePath, localPath, (transferred, total, speed) => {
      mainWindow?.webContents.send('sftp:transfer-progress', {
        sessionId,
        direction: 'download',
        name: path.basename(remotePath),
        localPath,
        remotePath,
        transferred,
        total,
        speed: speed || 0
      });
    }, sudoPassword);
  });

  ipcMain.handle('sftp:delete-remote', async (_e, { sessionId, remotePath, isDirectory }) => {
    return sftp.deleteRemoteFile(sessionId, remotePath, isDirectory);
  });

  ipcMain.handle('sftp:delete-local', async (_e, { localPath }) => {
    return sftp.deleteLocalItem(localPath);
  });

  ipcMain.handle('sftp:mkdir-local', async (_e, { dirPath }) => {
    return sftp.createLocalDirectory(dirPath);
  });

  ipcMain.handle('sftp:mkdir-remote', async (_e, { sessionId, remotePath }) => {
    return sftp.createRemoteDirectory(sessionId, remotePath);
  });

  ipcMain.handle('sftp:copy-local', async (_e, { srcPath, destDir }) => {
    return sftp.copyLocalItem(srcPath, destDir);
  });

  ipcMain.handle('sftp:copy-remote', async (_e, { sessionId, srcPath, destDir }) => {
    return sftp.copyRemoteItem(sessionId, srcPath, destDir);
  });

  ipcMain.handle('sftp:fix-permissions', async (_e, { sessionId, remotePath, mode }) => {
    return sftp.fixPermissions(sessionId, remotePath, mode);
  });

  // Ansible Automation
  ipcMain.handle('ansible:resolve-targets', (_e, { inventorySource, limit, customTargets }) => {
    return ansible.resolveInventoryTargets(inventorySource, limit, customTargets);
  });

  ipcMain.handle('ansible:execute', async (_e, req) => {
    return ansible.executeAutomation(req, (event) => {
      mainWindow?.webContents.send('ansible:event', event);
    });
  });

  ipcMain.handle('ansible:cancel', (_e, runId) => {
    ansible.cancelRun(runId);
    return true;
  });

  ipcMain.handle('ansible:get-runs', () => dbOperations.getAutomationRuns());

  // Playbooks Library
  ipcMain.handle('playbooks:get-all', () => dbOperations.getPlaybooks());
  ipcMain.handle('playbooks:save', (_e, playbook) => {
    const saved = dbOperations.savePlaybook(playbook);
    audit.logEvent({
      eventType: 'playbook_saved',
      action: 'save_playbook',
      outcome: 'success',
      resourceType: 'playbook',
      resourceId: saved.id,
      metadata: { name: saved.name, filename: saved.filename, is_builtin: saved.is_builtin }
    });
    return saved;
  });
  ipcMain.handle('playbooks:delete', (_e, id: string) => {
    dbOperations.deletePlaybook(id);
    audit.logEvent({
      eventType: 'playbook_deleted',
      action: 'delete_playbook',
      outcome: 'success',
      resourceType: 'playbook',
      resourceId: id
    });
    return true;
  });

  // Policy & Governance
  ipcMain.handle('policy:get-active', () => policy.getActivePolicy());
  ipcMain.handle('policy:set', (_e, p) => {
    policy.setPolicy(p);
    return true;
  });

  // Audit Logs
  ipcMain.handle('audit:get-events', (_e, limit) => audit.getEvents(limit));
  ipcMain.handle('audit:verify-integrity', () => audit.verifyAuditIntegrity());
  ipcMain.handle('audit:export-bundle', () => {
    const events = audit.getEvents(1000);
    const verification = audit.verifyAuditIntegrity();
    return {
      exported_at: new Date().toISOString(),
      generator: 'DgodTerm v1.0.0 (ISO/IEC 27001 Evidence Pack)',
      verification,
      events
    };
  });

  // Support Bundle
  ipcMain.handle('support:generate-bundle', () => {
    const raw = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      profilesCount: dbOperations.getProfiles().length,
      auditEventsCount: dbOperations.getAuditEvents().length,
      hostTrustRecordsCount: dbOperations.getHostTrustRecords().length,
      activePolicy: policy.getActivePolicy(),
      integrityStatus: audit.verifyAuditIntegrity()
    };
    return redactObject(raw);
  });

  // System
  ipcMain.handle('system:detect-agent', () => creds.detectSshAgent());
  ipcMain.handle('system:list-keys', () => creds.listStandardKeyFiles());

  // Native System Clipboard (Zero-Permission Desktop Copy/Paste)
  ipcMain.handle('clipboard:read', () => {
    try {
      return clipboard.readText();
    } catch (e) {
      return '';
    }
  });
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    try {
      clipboard.writeText(text || '');
      return true;
    } catch (e) {
      return false;
    }
  });

  // SSH Key Pair Generator
  ipcMain.handle('ssh:generate-key-pair', (_e, options) => {
    return SSHKeyGenerator.generateKeyPair(options);
  });

  // Snippets
  ipcMain.handle('snippets:get-all', () => dbOperations.getSnippets());
  ipcMain.handle('snippets:save', (_e, snippet) => {
    const saved = dbOperations.saveSnippet(snippet);
    audit.logEvent({
      eventType: 'snippet_saved',
      action: 'save_snippet',
      outcome: 'success',
      resourceType: 'snippet',
      resourceId: saved.id,
      metadata: { title: saved.title, category: saved.category }
    });
    return saved;
  });
  ipcMain.handle('snippets:delete', (_e, id) => {
    dbOperations.deleteSnippet(id);
    audit.logEvent({
      eventType: 'snippet_deleted',
      action: 'delete_snippet',
      outcome: 'success',
      resourceType: 'snippet',
      resourceId: id
    });
    return true;
  });

  // Tunnels & Port Forwarding
  const tunnelMgr = TunnelManager.getInstance();
  ipcMain.handle('tunnels:get-all', () => dbOperations.getTunnels());
  ipcMain.handle('tunnels:save', (_e, tunnel) => {
    const saved = dbOperations.saveTunnel(tunnel);
    audit.logEvent({
      eventType: 'tunnel_configured',
      action: 'save_tunnel',
      outcome: 'success',
      resourceType: 'tunnel',
      resourceId: saved.id,
      metadata: { name: saved.name, type: saved.type, localPort: saved.localPort }
    });
    return saved;
  });
  ipcMain.handle('tunnels:delete', (_e, id) => {
    tunnelMgr.stopTunnel(id);
    dbOperations.deleteTunnel(id);
    return true;
  });
  ipcMain.handle('tunnels:start', async (_e, id) => {
    return tunnelMgr.startTunnel(id);
  });
  ipcMain.handle('tunnels:stop', (_e, id) => {
    tunnelMgr.stopTunnel(id);
    return true;
  });
  ipcMain.handle('tunnels:get-statuses', () => {
    return tunnelMgr.getTunnelStatuses();
  });

  // Multi-Host Broadcast Input
  ipcMain.handle('ssh:broadcast', (_e, { sessionIds, data }) => {
    return ssh.broadcastData(sessionIds, data);
  });

  // Remote System Health Monitor
  const healthMon = SystemHealthMonitor.getInstance();
  ipcMain.handle('ssh:system-health', async (_e, target) => {
    return healthMon.getHealthMetrics(target);
  });
  ipcMain.handle('ssh:cached-system-health', async (_e, key) => {
    return healthMon.getCachedHealthMetrics(key);
  });

  // Integrated Remote File Editor
  ipcMain.handle('sftp:read-file', async (_e, { sessionId, remotePath }) => {
    return sftp.readRemoteFileText(sessionId, remotePath);
  });

  ipcMain.handle('sftp:write-file', async (_e, { sessionId, remotePath, content, createBackup }) => {
    return sftp.writeRemoteFileText(sessionId, remotePath, content, createBackup !== false);
  });

  // Enterprise Linux Services & Journalctl Manager
  ipcMain.handle('systemd:list-services', async (_e, target) => {
    return SystemdManager.getInstance().listServices(target);
  });
  ipcMain.handle('systemd:control-service', async (_e, { target, unit, action }) => {
    return SystemdManager.getInstance().controlService(target, unit, action);
  });
  ipcMain.handle('systemd:get-journal', async (_e, { target, unit, lines }) => {
    return SystemdManager.getInstance().getJournalLogs(target, unit, lines);
  });

  // Enterprise Multi-Host Configuration Drift
  ipcMain.handle('config:compare-drift', async (_e, { targetA, targetB, pathOrCommand }) => {
    return ConfigDriftService.getInstance().compareHosts(targetA, targetB, pathOrCommand);
  });

  // Enterprise Listening Ports & Socket Inspector
  ipcMain.handle('network:get-sockets', async (_e, target) => {
    return NetworkPortsService.getInstance().getListeningSockets(target);
  });

  // Enterprise CIS Benchmark & Security Hardening Audit
  ipcMain.handle('security:run-audit', async (_e, target) => {
    return SecurityAuditService.getInstance().runAudit(target);
  });

  // Enterprise Parameterized Runbooks & Canary Execution
  ipcMain.handle('runbook:get-catalog', () => {
    return RunbookRunnerService.getInstance().getRunbooks();
  });
  ipcMain.handle('runbook:execute', async (_e, { runbookId, params, targets, strategy }) => {
    return RunbookRunnerService.getInstance().executeRunbook(runbookId, params, targets, strategy);
  });

  // Just-In-Time (JIT) Break-Glass Emergency Escalation
  ipcMain.handle('breakglass:request', async (_e, { target, requestedUser, incidentTicketId, justification, durationMinutes }) => {
    audit.logEvent({
      eventType: 'breakglass_elevated_access',
      action: 'jit_breakglass_granted',
      outcome: 'success',
      resourceType: 'host',
      resourceId: target?.label || target?.profileId || target?.sessionId || 'target',
      metadata: {
        requestedUser,
        incidentTicketId,
        justification,
        durationMinutes,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
      }
    });
    return {
      granted: true,
      incidentTicketId,
      expiresAt: Date.now() + durationMinutes * 60 * 1000,
      durationMinutes
    };
  });

  // High-Availability Disaster Recovery & Diagnostics Service
  ipcMain.handle('disaster-recovery:export-backup', async (_e, arg: any) => {
    const passphrase = typeof arg === 'string' ? arg : arg?.passphrase;
    return DisasterRecoveryService.getInstance().exportEncryptedBackup(passphrase);
  });
  ipcMain.handle('disaster-recovery:restore-backup', async (_e, { backupJson, passphrase }) => {
    return DisasterRecoveryService.getInstance().restoreEncryptedBackup(backupJson, passphrase);
  });
  ipcMain.handle('diagnostics:generate-report', async () => {
    return DisasterRecoveryService.getInstance().generateDiagnosticsReport();
  });
  ipcMain.handle('host:get-resources', async () => {
    return getHostSystemResources();
  });

  // Generic feature bridge (Docker, processes, AI copilot, batch push, key deploy, uptime, cloud import)
  ipcMain.handle('feature:invoke', async (_e, { channel, payload }) => {
    return invokeFeature(channel, payload);
  });

  // Native Local Shell Execution (PowerShell, WSL2, CMD)
  const localTerminal = LocalTerminalManager.getInstance();

  ipcMain.handle('local:list-shells', async () => {
    return localTerminal.getAvailableShells();
  });

  ipcMain.handle('local:spawn', async (_e, { sessionId, shellId, cols, rows }) => {
    return localTerminal.spawnShell(
      sessionId,
      shellId,
      cols,
      rows,
      (data) => {
        mainWindow?.webContents.send('local:stream-data', { sessionId, data });
      },
      (code) => {
        mainWindow?.webContents.send('local:closed', { sessionId, code });
      }
    );
  });

  ipcMain.on('local:data', (_e, { sessionId, data }) => {
    localTerminal.sendData(sessionId, data);
  });

  ipcMain.on('local:resize', (_e, { sessionId, cols, rows }) => {
    localTerminal.resizeSession(sessionId, cols, rows);
  });

  ipcMain.handle('local:close', async (_e, sessionId: string) => {
    localTerminal.closeSession(sessionId);
    return { closed: true };
  });

  // Desktop Native Notification Dispatcher
  ipcMain.handle('notification:show', async (_e, { title, body, icon }) => {
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: title || 'DgodTerm',
          body: body || '',
          icon: icon || getAppIcon() || undefined
        });
        notif.show();
        return { success: true };
      }
      return { success: false, reason: 'Desktop notifications not supported' };
    } catch (e: any) {
      return { success: false, reason: e.message };
    }
  });

  // Workstation Power & Idle Monitoring
  ipcMain.handle('system:get-idle-time', () => {
    try {
      return powerMonitor.getSystemIdleTime();
    } catch {
      return 0;
    }
  });
}

app.whenReady().then(async () => {
  try {
    registerIpcHandlers();
    await createWindow();

    // Start background uptime monitor shortly after window has rendered
    setTimeout(() => {
      try {
        UptimeMonitorService.getInstance().start(30);
      } catch (err) {
        console.warn('[Main] UptimeMonitor start error:', err);
      }
    }, 1500);

    // Listen for OS screen lock / suspend events to auto-lock workstation
    try {
      powerMonitor.on('lock-screen', () => {
        mainWindow?.webContents.send('system:lock-screen');
      });
      powerMonitor.on('suspend', () => {
        mainWindow?.webContents.send('system:lock-screen');
      });
    } catch (pmErr) {
      console.warn('[Main] powerMonitor listeners failed:', pmErr);
    }

    // Global Hotkey (F12) to toggle dropdown terminal visibility
    try {
      globalShortcut.register('F12', () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      });
      console.log('[Main] Global hotkey F12 registered successfully.');
    } catch (scErr) {
      console.warn('[Main] Could not register global shortcut F12:', scErr);
    }
  } catch (e) {
    console.error('[Main] app.whenReady error:', e);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((err) => {
  console.error('[Main] whenReady rejected:', err);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

