import { contextBridge, ipcRenderer } from 'electron';

export const dgodtermApi = {
  // Profiles & Folders
  getProfiles: () => ipcRenderer.invoke('profiles:get-all'),
  saveProfile: (profile: any) => ipcRenderer.invoke('profiles:save', profile),
  deleteProfile: (id: string) => ipcRenderer.invoke('profiles:delete', id),
  getFolders: () => ipcRenderer.invoke('folders:get-all'),
  saveFolder: (folder: any) => ipcRenderer.invoke('folders:save', folder),
  deleteFolder: (id: string) => ipcRenderer.invoke('folders:delete', id),
  importProfiles: (jsonData: string) => ipcRenderer.invoke('profiles:import', jsonData),
  exportProfiles: () => ipcRenderer.invoke('profiles:export'),

  // Password Vault & App Authentication
  getVaultStatus: () => ipcRenderer.invoke('vault:get-status'),
  setupVaultMaster: (password: string, hint?: string) => ipcRenderer.invoke('vault:setup-master', { password, hint }),
  unlockVault: (password: string, mfaToken?: string) => ipcRenderer.invoke('vault:unlock', { password, mfaToken }),
  lockVault: () => ipcRenderer.invoke('vault:lock'),
  getMfaStatus: () => ipcRenderer.invoke('vault:mfa-status'),
  setupMfa: () => ipcRenderer.invoke('vault:mfa-setup'),
  enableMfa: (secret: string, token: string) => ipcRenderer.invoke('vault:mfa-enable', { secret, token }),
  disableMfa: (password: string) => ipcRenderer.invoke('vault:mfa-disable', { password }),
  getVaultCredentials: () => ipcRenderer.invoke('vault:get-all'),
  saveVaultCredential: (cred: any) => ipcRenderer.invoke('vault:save', cred),
  deleteVaultCredential: (id: string) => ipcRenderer.invoke('vault:delete', id),

  // SSH Terminal Sessions
  connectSSH: (sessionId: string, profileId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('ssh:connect', { sessionId, profileId, cols, rows }),
  sendSSHData: (sessionId: string, data: string) =>
    ipcRenderer.send('ssh:data', { sessionId, data }),
  resizeSSH: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('ssh:resize', { sessionId, cols, rows }),
  disconnectSSH: (sessionId: string) =>
    ipcRenderer.invoke('ssh:disconnect', sessionId),
  resolveHostVerification: (sessionId: string, accept: boolean) =>
    ipcRenderer.invoke('ssh:resolve-host-verification', { sessionId, accept }),
  submitTransientPassword: (sessionId: string, pass: string, ttlMinutes?: number, profileId?: string) =>
    ipcRenderer.invoke('ssh:submit-transient-password', { sessionId, pass, ttlMinutes, profileId }),

  // SSH Event Listeners
  onSSHData: (callback: (sessionId: string, data: string) => void) => {
    const handler = (_event: any, args: { sessionId: string; data: string }) => callback(args.sessionId, args.data);
    ipcRenderer.on('ssh:stream-data', handler);
    return () => ipcRenderer.removeListener('ssh:stream-data', handler);
  },
  onSSHClose: (callback: (sessionId: string, code: number) => void) => {
    const handler = (_event: any, args: { sessionId: string; code: number }) => callback(args.sessionId, args.code);
    ipcRenderer.on('ssh:closed', handler);
    return () => ipcRenderer.removeListener('ssh:closed', handler);
  },
  onSSHError: (callback: (sessionId: string, error: string) => void) => {
    const handler = (_event: any, args: { sessionId: string; error: string }) => callback(args.sessionId, args.error);
    ipcRenderer.on('ssh:error', handler);
    return () => ipcRenderer.removeListener('ssh:error', handler);
  },
  onHostVerificationPrompt: (callback: (sessionId: string, result: any) => void) => {
    const handler = (_event: any, args: { sessionId: string; result: any }) => callback(args.sessionId, args.result);
    ipcRenderer.on('ssh:host-verification-prompt', handler);
    return () => ipcRenderer.removeListener('ssh:host-verification-prompt', handler);
  },
  onPasswordPrompt: (callback: (sessionId: string, promptText: string) => void) => {
    const handler = (_event: any, args: { sessionId: string; prompt: string }) => callback(args.sessionId, args.prompt);
    ipcRenderer.on('ssh:password-prompt', handler);
    return () => ipcRenderer.removeListener('ssh:password-prompt', handler);
  },
  onProfileFlavorDetected: (callback: (data: { profileId: string; flavor: string; osName: string }) => void) => {
    const handler = (_event: any, data: { profileId: string; flavor: string; osName: string }) => callback(data);
    ipcRenderer.on('profile:flavor-detected', handler);
    return () => ipcRenderer.removeListener('profile:flavor-detected', handler);
  },

  // Host Trust Store
  getHostTrustRecords: () => ipcRenderer.invoke('trust:get-records'),
  acceptHostKey: (params: any) => ipcRenderer.invoke('trust:accept-key', params),
  rotateHostKey: (params: any) => ipcRenderer.invoke('trust:rotate-key', params),
  revokeHostKey: (recordId: string, reason: string) =>
    ipcRenderer.invoke('trust:revoke-key', { recordId, reason }),

  // SFTP Operations
  connectSFTP: (sessionId: string, profileId: string) =>
    ipcRenderer.invoke('sftp:connect', { sessionId, profileId }),
  disconnectSFTP: (sessionId: string) =>
    ipcRenderer.invoke('sftp:disconnect', sessionId),
  listLocalDir: (dirPath: string) => ipcRenderer.invoke('sftp:list-local', dirPath),
  listRemoteDir: (sessionId: string, dirPath: string) =>
    ipcRenderer.invoke('sftp:list-remote', { sessionId, dirPath }),
  uploadFile: (sessionId: string, localPath: string, remotePath: string) =>
    ipcRenderer.invoke('sftp:upload-file', { sessionId, localPath, remotePath }),
  uploadBuffer: (sessionId: string, buffer: ArrayBuffer | Uint8Array, remotePath: string) =>
    ipcRenderer.invoke('sftp:upload-buffer', { sessionId, buffer, remotePath }),
  downloadFile: (sessionId: string, remotePath: string, localPath: string, sudoPassword?: string) =>
    ipcRenderer.invoke('sftp:download-file', { sessionId, remotePath, localPath, sudoPassword }),
  deleteRemoteFile: (sessionId: string, remotePath: string, isDirectory?: boolean) =>
    ipcRenderer.invoke('sftp:delete-remote', { sessionId, remotePath, isDirectory }),
  deleteLocalItem: (localPath: string) =>
    ipcRenderer.invoke('sftp:delete-local', { localPath }),
  createLocalDir: (dirPath: string) =>
    ipcRenderer.invoke('sftp:mkdir-local', { dirPath }),
  createRemoteDir: (sessionId: string, remotePath: string) =>
    ipcRenderer.invoke('sftp:mkdir-remote', { sessionId, remotePath }),
  copyLocalItem: (srcPath: string, destDir: string) =>
    ipcRenderer.invoke('sftp:copy-local', { srcPath, destDir }),
  copyRemoteItem: (sessionId: string, srcPath: string, destDir: string) =>
    ipcRenderer.invoke('sftp:copy-remote', { sessionId, srcPath, destDir }),
  fixPermissions: (sessionId: string, remotePath: string, mode?: string) =>
    ipcRenderer.invoke('sftp:fix-permissions', { sessionId, remotePath, mode }),
  onTransferProgress: (cb: (progress: any) => void) => {
    const handler = (_event: any, data: any) => cb(data);
    ipcRenderer.on('sftp:transfer-progress', handler);
    return () => ipcRenderer.removeListener('sftp:transfer-progress', handler);
  },

  // Ansible Automation
  resolveInventoryTargets: (inventorySource: string, limit?: string | null, customTargets?: any[]) =>
    ipcRenderer.invoke('ansible:resolve-targets', { inventorySource, limit, customTargets }),
  executeAutomation: (request: any) =>
    ipcRenderer.invoke('ansible:execute', request),
  cancelAutomation: (runId: string) =>
    ipcRenderer.invoke('ansible:cancel', runId),
  getAutomationRuns: () => ipcRenderer.invoke('ansible:get-runs'),
  onAutomationEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('ansible:event', handler);
    return () => ipcRenderer.removeListener('ansible:event', handler);
  },

  // Playbooks Library
  getPlaybooks: () => ipcRenderer.invoke('playbooks:get-all'),
  savePlaybook: (playbook: any) => ipcRenderer.invoke('playbooks:save', playbook),
  deletePlaybook: (id: string) => ipcRenderer.invoke('playbooks:delete', id),

  // Policy & Governance
  getActivePolicy: () => ipcRenderer.invoke('policy:get-active'),
  setPolicy: (policy: any) => ipcRenderer.invoke('policy:set', policy),

  // Audit Log & Cryptographic Verification
  getAuditEvents: (limit?: number) => ipcRenderer.invoke('audit:get-events', limit),
  verifyAuditIntegrity: () => ipcRenderer.invoke('audit:verify-integrity'),
  exportAuditBundle: () => ipcRenderer.invoke('audit:export-bundle'),

  // Diagnostics & Support
  generateSupportBundle: () => ipcRenderer.invoke('support:generate-bundle'),

  // System & Credentials
  detectSshAgent: () => ipcRenderer.invoke('system:detect-agent'),
  listStandardKeys: () => ipcRenderer.invoke('system:list-keys'),

  // Native System Clipboard
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

  // SSH Key Pair Generator
  generateSSHKeyPair: (options: any) => ipcRenderer.invoke('ssh:generate-key-pair', options),

  // Snippets & Quick Commands
  getSnippets: () => ipcRenderer.invoke('snippets:get-all'),
  saveSnippet: (snippet: any) => ipcRenderer.invoke('snippets:save', snippet),
  deleteSnippet: (id: string) => ipcRenderer.invoke('snippets:delete', id),

  // Tunnels & Port Forwarding
  getTunnels: () => ipcRenderer.invoke('tunnels:get-all'),
  saveTunnel: (tunnel: any) => ipcRenderer.invoke('tunnels:save', tunnel),
  deleteTunnel: (id: string) => ipcRenderer.invoke('tunnels:delete', id),
  startTunnel: (id: string) => ipcRenderer.invoke('tunnels:start', id),
  stopTunnel: (id: string) => ipcRenderer.invoke('tunnels:stop', id),
  getTunnelStatuses: () => ipcRenderer.invoke('tunnels:get-statuses'),

  // Multi-Host Broadcast Input
  broadcastSSH: (sessionIds: string[], data: string) =>
    ipcRenderer.invoke('ssh:broadcast', { sessionIds, data }),

  // Remote System Health Monitor
  getSystemHealth: (target: string | { sessionId?: string; profileId?: string }) =>
    ipcRenderer.invoke('ssh:system-health', target),
  getCachedSystemHealth: (key: string) =>
    ipcRenderer.invoke('ssh:cached-system-health', key),

  // Remote File Editor
  readRemoteFile: (sessionId: string, remotePath: string) =>
    ipcRenderer.invoke('sftp:read-file', { sessionId, remotePath }),
  writeRemoteFile: (sessionId: string, remotePath: string, content: string, createBackup?: boolean) =>
    ipcRenderer.invoke('sftp:write-file', { sessionId, remotePath, content, createBackup }),

  // Enterprise Linux Services & Journalctl Manager
  listSystemdServices: (target: { sessionId?: string; profileId?: string }) =>
    ipcRenderer.invoke('systemd:list-services', target),
  controlSystemdService: (target: { sessionId?: string; profileId?: string }, unit: string, action: string) =>
    ipcRenderer.invoke('systemd:control-service', { target, unit, action }),
  getSystemdJournal: (target: { sessionId?: string; profileId?: string }, unit: string, lines?: number) =>
    ipcRenderer.invoke('systemd:get-journal', { target, unit, lines }),

  // Enterprise Multi-Host Configuration Drift
  compareConfigDrift: (targetA: any, targetB: any, pathOrCommand: string) =>
    ipcRenderer.invoke('config:compare-drift', { targetA, targetB, pathOrCommand }),

  // Enterprise Listening Ports & Socket Inspector
  getNetworkSockets: (target: { sessionId?: string; profileId?: string }) =>
    ipcRenderer.invoke('network:get-sockets', target),

  // Enterprise CIS Benchmark & Security Hardening Audit
  runSecurityAudit: (target: { sessionId?: string; profileId?: string; label?: string }) =>
    ipcRenderer.invoke('security:run-audit', target),

  // Enterprise Parameterized Runbooks & Canary Execution
  getRunbookCatalog: () =>
    ipcRenderer.invoke('runbook:get-catalog'),
  executeRunbook: (runbookId: string, params: any, targets: any[], strategy: string) =>
    ipcRenderer.invoke('runbook:execute', { runbookId, params, targets, strategy }),

  // Just-In-Time (JIT) Break-Glass Emergency Escalation
  requestBreakGlassAccess: (target: any, requestedUser: string, incidentTicketId: string, justification: string, durationMinutes: number) =>
    ipcRenderer.invoke('breakglass:request', { target, requestedUser, incidentTicketId, justification, durationMinutes }),

  // High-Availability Disaster Recovery & Diagnostics Service
  exportEncryptedBackup: (passphrase: string) =>
    ipcRenderer.invoke('disaster-recovery:export-backup', passphrase),
  restoreEncryptedBackup: (backupJson: string, passphrase: string) =>
    ipcRenderer.invoke('disaster-recovery:restore-backup', { backupJson, passphrase }),
  generateDiagnosticsReport: () =>
    ipcRenderer.invoke('diagnostics:generate-report'),
  invokeFeature: (channel: string, payload?: any) =>
    ipcRenderer.invoke('feature:invoke', { channel, payload }),
  getHostResources: () =>
    ipcRenderer.invoke('host:get-resources'),

  // Native Local Shell Management (PowerShell, WSL2, CMD)
  listLocalShells: () =>
    ipcRenderer.invoke('local:list-shells'),
  spawnLocalShell: (sessionId: string, shellId: string, cols?: number, rows?: number) =>
    ipcRenderer.invoke('local:spawn', { sessionId, shellId, cols, rows }),
  resizeLocalShell: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('local:resize', { sessionId, cols, rows }),
  sendLocalData: (sessionId: string, data: string) =>
    ipcRenderer.send('local:data', { sessionId, data }),
  closeLocalShell: (sessionId: string) =>
    ipcRenderer.invoke('local:close', sessionId),
  onLocalData: (callback: (sessionId: string, data: string) => void) => {
    const handler = (_event: any, args: { sessionId: string; data: string }) => callback(args.sessionId, args.data);
    ipcRenderer.on('local:stream-data', handler);
    return () => ipcRenderer.removeListener('local:stream-data', handler);
  },
  onLocalClose: (callback: (sessionId: string, code: number) => void) => {
    const handler = (_event: any, args: { sessionId: string; code: number }) => callback(args.sessionId, args.code);
    ipcRenderer.on('local:closed', handler);
    return () => ipcRenderer.removeListener('local:closed', handler);
  },

  // Desktop Notifications
  showNotification: (title: string, body: string, icon?: string) =>
    ipcRenderer.invoke('notification:show', { title, body, icon }),

  // Workstation Power & Idle Monitoring
  getSystemIdleTime: () =>
    ipcRenderer.invoke('system:get-idle-time'),
  onSystemLockScreen: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('system:lock-screen', handler);
    return () => ipcRenderer.removeListener('system:lock-screen', handler);
  }
};

contextBridge.exposeInMainWorld('dgodterm', dgodtermApi);
