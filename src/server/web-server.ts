import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
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

const PORT = 5188;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

export async function startWebServer(): Promise<void> {
  await initializeDatabase();

  // Always serve compiled production assets from dist/renderer
  let publicDir = path.resolve(__dirname, '../../dist/renderer');
  if (!fs.existsSync(publicDir)) {
    publicDir = path.resolve(__dirname, '../renderer');
  }
  if (!fs.existsSync(publicDir)) {
    publicDir = path.resolve(process.cwd(), 'dist/renderer');
  }

  const server = http.createServer((req, res) => {
    let reqUrl = req.url || '/';
    if (reqUrl.startsWith('/ws')) return; // handled by WS

    let filePath = path.join(publicDir, reqUrl === '/' ? 'index.html' : reqUrl);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(publicDir, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  const ssh = SSHManager.getInstance();
  const sftp = SFTPManager.getInstance();
  const trust = TrustStore.getInstance();
  const creds = CredentialBroker.getInstance();
  const policy = PolicyEngine.getInstance();
  const audit = AuditService.getInstance();
  const ansible = AnsibleRunner.getInstance();

  wss.on('connection', (ws: WebSocket) => {
    console.log('[DgodTerm Server] Browser WebSocket client connected.');

    const send = (type: string, payload: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
      }
    };

    ws.on('message', async (raw: string) => {
      let currentId: string | undefined;
      try {
        const msg = JSON.parse(raw.toString());
        const { id, action, payload } = msg;
        currentId = id;

        const reply = (result: any) => send(`res:${id}`, { success: true, data: result });
        const replyErr = (err: any) => send(`res:${id}`, { success: false, error: err.message || String(err) });

        if (action === 'feature:invoke') {
          try {
            reply(await invokeFeature(payload?.channel, payload?.payload));
          } catch (err: any) {
            replyErr(err);
          }
          return;
        }

        switch (action) {
          // Profiles
          case 'profiles:get-all':
            reply(dbOperations.getProfiles());
            break;
          case 'profiles:save':
            dbOperations.saveProfile(payload);
            audit.logEvent({
              eventType: 'profile_updated',
              action: 'save_profile',
              outcome: 'success',
              resourceType: 'profile',
              resourceId: payload.id,
              metadata: { displayName: payload.display_name, host: payload.hostname }
            });
            reply(true);
            break;
          case 'profiles:delete':
            dbOperations.deleteProfile(payload);
            audit.logEvent({
              eventType: 'profile_deleted',
              action: 'delete_profile',
              outcome: 'success',
              resourceType: 'profile',
              resourceId: payload
            });
            reply(true);
            break;
          case 'profiles:export': {
            const profiles = dbOperations.getProfiles();
            const scrubbed = profiles.map((p) => {
              const copy = { ...p };
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
            reply(JSON.stringify(scrubbed, null, 2));
            break;
          }
          case 'profiles:import': {
            try {
              const rawData = payload;
              const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
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

              reply({ success: true, importedCount });
            } catch (err: any) {
              reply({ success: false, error: err.message });
            }
            break;
          }

          // Folders
          case 'folders:get-all':
            reply(dbOperations.getFolders());
            break;
          case 'folders:save':
            dbOperations.saveFolder(payload);
            reply(true);
            break;
          case 'folders:delete':
            dbOperations.deleteFolder(payload);
            reply(true);
            break;

          // Password Vault
          case 'vault:get-status':
            reply(dbOperations.getVaultStatus());
            break;
          case 'vault:setup-master': {
            const success = dbOperations.setupVaultMaster(payload.password, payload.hint);
            audit.logEvent({
              eventType: 'vault_master_configured',
              action: 'setup_vault_master_password',
              outcome: success ? 'success' : 'failed',
              metadata: { hasHint: Boolean(payload.hint) }
            });
            reply(success);
            break;
          }
          case 'vault:unlock': {
            const res = dbOperations.unlockVault(payload?.password, payload?.mfaToken);
            audit.logEvent({
              eventType: 'vault_unlocked',
              action: 'unlock_vault',
              outcome: res.success ? 'success' : 'denied',
              metadata: { requiresMfa: Boolean(res.requiresMfa) }
            });
            reply(res);
            break;
          }
          case 'vault:lock': {
            const success = dbOperations.lockVault();
            audit.logEvent({
              eventType: 'vault_locked',
              action: 'lock_vault',
              outcome: 'success',
              metadata: {}
            });
            reply(success);
            break;
          }
          case 'vault:mfa-status': {
            reply(dbOperations.getMfaStatus());
            break;
          }
          case 'vault:mfa-setup': {
            reply(dbOperations.setupMfa());
            break;
          }
          case 'vault:mfa-enable': {
            const res = dbOperations.enableMfa(payload?.secret, payload?.token);
            audit.logEvent({
              eventType: 'mfa_enabled',
              action: 'google_authenticator_configured',
              outcome: res.success ? 'success' : 'failed',
              metadata: {}
            });
            reply(res);
            break;
          }
          case 'vault:mfa-disable': {
            const res = dbOperations.disableMfa(payload?.password);
            audit.logEvent({
              eventType: 'mfa_disabled',
              action: 'google_authenticator_disabled',
              outcome: res.success ? 'success' : 'failed',
              metadata: {}
            });
            reply(res);
            break;
          }
          case 'vault:get-all':
            reply(dbOperations.getVaultCredentials(true));
            break;
          case 'vault:save': {
            const saved = dbOperations.saveVaultCredential(payload);
            audit.logEvent({
              eventType: 'vault_credential_saved',
              action: 'save_vault_credential',
              outcome: 'success',
              resourceType: 'vault_credential',
              resourceId: saved.id,
              metadata: { title: saved.title, username: saved.username }
            });
            reply(saved);
            break;
          }
          case 'vault:delete':
            dbOperations.deleteVaultCredential(payload);
            audit.logEvent({
              eventType: 'vault_credential_deleted',
              action: 'delete_vault_credential',
              outcome: 'success',
              resourceType: 'vault_credential',
              resourceId: payload
            });
            reply(true);
            break;

          // SSH Connections
          case 'ssh:connect': {
            const { sessionId, profileId, cols, rows } = payload;
            const profiles = dbOperations.getProfiles();
            const prof = profiles.find((p) => p.id === profileId);
            if (!prof) {
              replyErr(new Error('Profile not found'));
              break;
            }

            ssh.connectSession(sessionId, prof, cols || 80, rows || 24, {
              onData: (data) => {
                send('ssh:stream-data', { sessionId, data });
              },
              onClose: (code) => {
                send('ssh:closed', { sessionId, code });
              },
              onError: (err) => {
                send('ssh:error', { sessionId, error: err.message });
              },
              onHostVerificationRequired: (result) => {
                send('ssh:host-verification-prompt', { sessionId, result });
              },
              onPasswordRequired: (prompt) => {
                send('ssh:password-prompt', { sessionId, prompt });
              }
            });
            reply(true);
            break;
          }

          case 'ssh:data':
            ssh.sendData(payload.sessionId, payload.data);
            break;

          case 'ssh:resize':
            ssh.resize(payload.sessionId, payload.cols, payload.rows);
            break;

          case 'ssh:disconnect':
            ssh.disconnectSession(payload);
            reply(true);
            break;

          case 'ssh:submit-transient-password':
            ssh.submitTransientPassword(payload.sessionId, payload.pass, payload.ttlMinutes, payload.profileId);
            reply(true);
            break;

          case 'ssh:resolve-host-verification':
            ssh.resolveHostVerification(payload.sessionId, payload.accept);
            reply(true);
            break;

          // Host Trust
          case 'trust:get-records':
            reply(dbOperations.getHostTrustRecords());
            break;
          case 'trust:accept-key':
            reply(trust.acceptHostKey(payload));
            break;
          case 'trust:rotate-key':
            trust.rotateHostKey(payload);
            reply(true);
            break;
          case 'trust:revoke-key':
            trust.revokeHostKey(payload.recordId, payload.reason);
            reply(true);
            break;

          // SFTP
          case 'sftp:connect': {
            const profs = dbOperations.getProfiles();
            const p = profs.find((x) => x.id === payload.profileId);
            if (!p) {
              replyErr(new Error('Profile not found'));
              break;
            }
            await sftp.connectSFTP(payload.sessionId, p);
            reply(true);
            break;
          }
          case 'sftp:disconnect':
            sftp.disconnectSFTP(payload);
            reply(true);
            break;
          case 'sftp:list-local':
            try {
              const pathArg = (typeof payload === 'string' ? payload : payload?.dirPath) || '';
              reply(sftp.listLocalDirectory(pathArg));
            } catch (err: any) {
              replyErr(err);
            }
            break;
          case 'sftp:list-remote':
            reply(await sftp.listRemoteDirectory(payload.sessionId, payload.dirPath));
            break;
          case 'sftp:upload-file':
            reply(
              await sftp.uploadFile(
                payload.sessionId,
                payload.localPath,
                payload.remotePath,
                (transferred, total, speed) => {
                  send('sftp:transfer-progress', {
                    sessionId: payload.sessionId,
                    direction: 'upload',
                    name: path.basename(payload.localPath),
                    localPath: payload.localPath,
                    remotePath: payload.remotePath,
                    transferred,
                    total,
                    speed: speed || 0
                  });
                }
              )
            );
            break;
          case 'sftp:upload-buffer': {
            const buf = Buffer.from(payload.buffer, payload.encoding || 'base64');
            reply(await sftp.uploadBuffer(payload.sessionId, buf, payload.remotePath));
            break;
          }
          case 'sftp:download-file':
            reply(
              await sftp.downloadFile(
                payload.sessionId,
                payload.remotePath,
                payload.localPath,
                (transferred, total, speed) => {
                  send('sftp:transfer-progress', {
                    sessionId: payload.sessionId,
                    direction: 'download',
                    name: path.basename(payload.remotePath),
                    localPath: payload.localPath,
                    remotePath: payload.remotePath,
                    transferred,
                    total,
                    speed: speed || 0
                  });
                },
                payload.sudoPassword
              )
            );
            break;
          case 'sftp:delete-remote':
            reply(await sftp.deleteRemoteFile(payload.sessionId, payload.remotePath, payload.isDirectory));
            break;
          case 'sftp:delete-local':
            reply(sftp.deleteLocalItem(payload.localPath));
            break;
          case 'sftp:mkdir-local':
            reply(sftp.createLocalDirectory(payload.dirPath));
            break;
          case 'sftp:mkdir-remote':
            reply(await sftp.createRemoteDirectory(payload.sessionId, payload.remotePath));
            break;
          case 'sftp:copy-local':
            reply(sftp.copyLocalItem(payload.srcPath, payload.destDir));
            break;
          case 'sftp:copy-remote':
            reply(await sftp.copyRemoteItem(payload.sessionId, payload.srcPath, payload.destDir));
            break;
          case 'sftp:fix-permissions':
            reply(await sftp.fixPermissions(payload.sessionId, payload.remotePath, payload.mode));
            break;

          // Ansible
          case 'ansible:resolve-targets':
            reply(ansible.resolveInventoryTargets(payload.inventorySource, payload.limit, payload.customTargets));
            break;
          case 'ansible:execute': {
            const manifest = await ansible.executeAutomation(payload, (event) => {
              send('ansible:event', event);
            });
            reply(manifest);
            break;
          }
          case 'ansible:cancel':
            ansible.cancelRun(payload);
            reply(true);
            break;
          case 'ansible:get-runs':
            reply(dbOperations.getAutomationRuns());
            break;

          // Playbooks Library
          case 'playbooks:get-all':
            reply(dbOperations.getPlaybooks());
            break;
          case 'playbooks:save': {
            const saved = dbOperations.savePlaybook(payload);
            audit.logEvent({
              eventType: 'playbook_saved',
              action: 'save_playbook',
              outcome: 'success',
              resourceType: 'playbook',
              resourceId: saved.id,
              metadata: { name: saved.name, filename: saved.filename, is_builtin: saved.is_builtin }
            });
            reply(saved);
            break;
          }
          case 'playbooks:delete':
            dbOperations.deletePlaybook(payload);
            audit.logEvent({
              eventType: 'playbook_deleted',
              action: 'delete_playbook',
              outcome: 'success',
              resourceType: 'playbook',
              resourceId: payload
            });
            reply(true);
            break;

          // Policy & Audit
          case 'policy:get-active':
            reply(policy.getActivePolicy());
            break;
          case 'policy:set':
            policy.setPolicy(payload);
            reply(true);
            break;
          case 'audit:get-events':
            reply(audit.getEvents(payload));
            break;
          case 'audit:verify-integrity':
            reply(audit.verifyAuditIntegrity());
            break;
          case 'audit:export-bundle':
            reply({
              exported_at: new Date().toISOString(),
              generator: 'DgodTerm v1.0.0 (ISO/IEC 27001 Evidence Pack)',
              verification: audit.verifyAuditIntegrity(),
              events: audit.getEvents(1000)
            });
            break;

          // Diagnostics
          case 'support:generate-bundle':
            reply(
              redactObject({
                timestamp: new Date().toISOString(),
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                profilesCount: dbOperations.getProfiles().length,
                auditEventsCount: dbOperations.countAuditEvents(),
                hostTrustRecordsCount: dbOperations.getHostTrustRecords().length,
                activePolicy: policy.getActivePolicy(),
                integrityStatus: audit.verifyAuditIntegrity()
              })
            );
            break;

          case 'system:detect-agent':
            reply(creds.detectSshAgent());
            break;
          case 'system:list-keys':
            reply(creds.listStandardKeyFiles());
            break;

          // SSH Key Pair Generator
          case 'ssh:generate-key-pair':
            reply(SSHKeyGenerator.generateKeyPair(payload));
            break;

          // Snippets
          case 'snippets:get-all':
            reply(dbOperations.getSnippets());
            break;
          case 'snippets:save':
            {
              const saved = dbOperations.saveSnippet(payload);
              audit.logEvent({
                eventType: 'snippet_saved',
                action: 'save_snippet',
                outcome: 'success',
                resourceType: 'snippet',
                resourceId: saved.id,
                metadata: { title: saved.title, category: saved.category }
              });
              reply(saved);
            }
            break;
          case 'snippets:delete':
            dbOperations.deleteSnippet(payload);
            audit.logEvent({
              eventType: 'snippet_deleted',
              action: 'delete_snippet',
              outcome: 'success',
              resourceType: 'snippet',
              resourceId: payload
            });
            reply(true);
            break;

          // Tunnels & Port Forwarding
          case 'tunnels:get-all':
            reply(dbOperations.getTunnels());
            break;
          case 'tunnels:save':
            {
              const saved = dbOperations.saveTunnel(payload);
              audit.logEvent({
                eventType: 'tunnel_configured',
                action: 'save_tunnel',
                outcome: 'success',
                resourceType: 'tunnel',
                resourceId: saved.id,
                metadata: { name: saved.name, type: saved.type, localPort: saved.localPort }
              });
              reply(saved);
            }
            break;
          case 'tunnels:delete':
            TunnelManager.getInstance().stopTunnel(payload);
            dbOperations.deleteTunnel(payload);
            reply(true);
            break;
          case 'tunnels:start':
            {
              const ok = await TunnelManager.getInstance().startTunnel(payload);
              reply(ok);
            }
            break;
          case 'tunnels:stop':
            TunnelManager.getInstance().stopTunnel(payload);
            reply(true);
            break;
          case 'tunnels:get-statuses':
            reply(TunnelManager.getInstance().getTunnelStatuses());
            break;

          // Multi-Host Broadcast Input
          case 'ssh:broadcast':
            {
              const { sessionIds, data } = payload;
              reply(ssh.broadcastData(sessionIds, data));
            }
            break;

          // Remote System Health Monitor
          case 'ssh:system-health':
            {
              const metrics = await SystemHealthMonitor.getInstance().getHealthMetrics(payload);
              reply(metrics);
            }
            break;

          // Remote File Editor
          case 'sftp:read-file':
            {
              const { sessionId, remotePath } = payload;
              const fileData = await sftp.readRemoteFileText(sessionId, remotePath);
              reply(fileData);
            }
            break;
          case 'sftp:write-file':
            {
              const { sessionId, remotePath, content, createBackup } = payload;
              const saveRes = await sftp.writeRemoteFileText(sessionId, remotePath, content, createBackup !== false);
              reply(saveRes);
            }
            break;

          // Enterprise Linux Services & Journalctl Manager
          case 'systemd:list-services':
            {
              const list = await SystemdManager.getInstance().listServices(payload);
              reply(list);
            }
            break;
          case 'systemd:control-service':
            {
              const { target, unit, action: sAction } = payload;
              const res = await SystemdManager.getInstance().controlService(target, unit, sAction);
              reply(res);
            }
            break;
          case 'systemd:get-journal':
            {
              const { target, unit, lines } = payload;
              const logs = await SystemdManager.getInstance().getJournalLogs(target, unit, lines);
              reply(logs);
            }
            break;

          // Enterprise Multi-Host Configuration Drift
          case 'config:compare-drift':
            {
              const { targetA, targetB, pathOrCommand } = payload;
              const driftRes = await ConfigDriftService.getInstance().compareHosts(targetA, targetB, pathOrCommand);
              reply(driftRes);
            }
            break;

          // Enterprise Listening Ports & Socket Inspector
          case 'network:get-sockets':
            {
              const socketsReport = await NetworkPortsService.getInstance().getListeningSockets(payload);
              reply(socketsReport);
            }
            break;

          // Enterprise CIS Benchmark & Security Hardening Audit
          case 'security:run-audit':
            {
              const auditReport = await SecurityAuditService.getInstance().runAudit(payload);
              reply(auditReport);
            }
            break;

          // Enterprise Parameterized Runbooks & Canary Execution
          case 'runbook:get-catalog':
            {
              reply(RunbookRunnerService.getInstance().getRunbooks());
            }
            break;
          case 'runbook:execute':
            {
              const { runbookId, params, targets, strategy } = payload;
              const runReport = await RunbookRunnerService.getInstance().executeRunbook(runbookId, params, targets, strategy);
              reply(runReport);
            }
            break;

          // Just-In-Time (JIT) Break-Glass Emergency Escalation
          case 'breakglass:request':
            {
              const { target, requestedUser, incidentTicketId, justification, durationMinutes } = payload;
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
              reply({
                granted: true,
                incidentTicketId,
                expiresAt: Date.now() + durationMinutes * 60 * 1000,
                durationMinutes
              });
            }
            break;

          // High-Availability Disaster Recovery & Diagnostics Service
          case 'disaster-recovery:export-backup':
            {
              const { passphrase } = payload || {};
              const backup = DisasterRecoveryService.getInstance().exportEncryptedBackup(passphrase);
              reply(backup);
            }
            break;
          case 'disaster-recovery:restore-backup':
            {
              const { backupJson, passphrase } = payload || {};
              const res = DisasterRecoveryService.getInstance().restoreEncryptedBackup(backupJson, passphrase);
              reply(res);
            }
            break;
          case 'diagnostics:generate-report':
            {
              const report = DisasterRecoveryService.getInstance().generateDiagnosticsReport();
              reply(report);
            }
            break;
          case 'host:get-resources':
            {
              reply(getHostSystemResources());
            }
            break;

          default:
            replyErr(new Error(`Unknown action: ${action}`));
        }
      } catch (err: any) {
        console.error('[DgodTerm Server] Message processing error:', err);
        if (currentId) {
          send(`res:${currentId}`, { success: false, error: err.message || String(err) });
        }
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DgodTerm] Real SSH Server & Web UI listening at http://localhost:${PORT}`);
  });
}

// If executed directly
if (require.main === module) {
  startWebServer().catch((e) => console.error(e));
}
