/**
 * DgodTerm Browser WebSocket Bridge
 * Connects the web UI to the real Node backend at ws://localhost:5188/ws
 * for 100% real SSH connections, PTY streaming, password prompts, and SFTP.
 */

if (typeof window !== 'undefined' && !(window as any).dgodterm) {
  console.log('[DgodTerm] Initializing WebSocket client bridge to backend.');

  const wsUrl = `ws://${window.location.host}/ws`;
  let ws: WebSocket | null = null;
  const pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  const eventListeners: Record<string, Function[]> = {};

  const emit = (event: string, ...args: any[]) => {
    (eventListeners[event] || []).forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error(`Error in listener for ${event}:`, e);
      }
    });
  };

  const addListener = (event: string, fn: Function) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
    return () => {
      eventListeners[event] = (eventListeners[event] || []).filter((f) => f !== fn);
    };
  };

  function connectWs() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[DgodTerm] WebSocket connection established to real SSH backend.');
    };

    ws.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);

        if (type && type.startsWith('res:')) {
          const id = type.substring(4);
          const pending = pendingRequests.get(id);
          if (pending) {
            pendingRequests.delete(id);
            if (payload.success) {
              pending.resolve(payload.data);
            } else {
              pending.reject(new Error(payload.error));
            }
          }
        } else {
          // Push event from backend
          if (type === 'ssh:stream-data') {
            emit('ssh:data', payload.sessionId, payload.data);
          } else if (type === 'ssh:closed') {
            emit('ssh:close', payload.sessionId, payload.code);
          } else if (type === 'ssh:error') {
            emit('ssh:error', payload.sessionId, payload.error);
          } else if (type === 'ssh:host-verification-prompt') {
            emit('ssh:host-prompt', payload.sessionId, payload.result);
          } else if (type === 'ssh:password-prompt') {
            emit('ssh:password-prompt', payload.sessionId, payload.prompt);
          } else if (type === 'ansible:event') {
            emit('ansible:event', payload);
          }
        }
      } catch (err) {
        console.error('Error handling WS message:', err);
      }
    };

    ws.onclose = () => {
      console.warn('[DgodTerm] WebSocket closed. Reconnecting in 2s...');
      setTimeout(connectWs, 2000);
    };

    ws.onerror = (err) => {
      console.error('[DgodTerm] WebSocket error:', err);
    };
  }

  connectWs();

  async function invoke(action: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Wait a tiny bit if connecting
        setTimeout(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket not connected to backend.'));
            return;
          }
          sendRequest();
        }, 300);
        return;
      }

      sendRequest();

      function sendRequest() {
        const id = Math.random().toString(36).substring(2, 10);
        pendingRequests.set(id, { resolve, reject });
        ws!.send(JSON.stringify({ id, action, payload }));
      }
    });
  }

  function send(action: string, payload: any): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action, payload }));
    }
  }

  (window as any).dgodterm = {
    // Profiles
    getProfiles: () => invoke('profiles:get-all'),
    saveProfile: (p: any) => invoke('profiles:save', p),
    deleteProfile: (id: string) => invoke('profiles:delete', id),

    // Folders
    getFolders: () => invoke('folders:get-all'),
    saveFolder: (f: any) => invoke('folders:save', f),
    deleteFolder: (id: string) => invoke('folders:delete', id),

    importProfiles: (json: string) => invoke('profiles:import', json),
    exportProfiles: () => invoke('profiles:export'),

    // Password Vault & App Authentication
    getVaultStatus: () => invoke('vault:get-status'),
    setupVaultMaster: (password: string, hint?: string) => invoke('vault:setup-master', { password, hint }),
    unlockVault: (password: string, mfaToken?: string) => invoke('vault:unlock', { password, mfaToken }),
    lockVault: () => invoke('vault:lock'),
    getMfaStatus: () => invoke('vault:mfa-status'),
    setupMfa: () => invoke('vault:mfa-setup'),
    enableMfa: (secret: string, token: string) => invoke('vault:mfa-enable', { secret, token }),
    disableMfa: (password: string) => invoke('vault:mfa-disable', { password }),
    getVaultCredentials: () => invoke('vault:get-all'),
    saveVaultCredential: (cred: any) => invoke('vault:save', cred),
    deleteVaultCredential: (id: string) => invoke('vault:delete', id),

    // SSH
    connectSSH: (sessionId: string, profileId: string, cols: number, rows: number) =>
      invoke('ssh:connect', { sessionId, profileId, cols, rows }),
    sendSSHData: (sessionId: string, data: string) => send('ssh:data', { sessionId, data }),
    resizeSSH: (sessionId: string, cols: number, rows: number) => send('ssh:resize', { sessionId, cols, rows }),
    disconnectSSH: (sessionId: string) => invoke('ssh:disconnect', sessionId),
    resolveHostVerification: (sessionId: string, accept: boolean) =>
      invoke('ssh:resolve-host-verification', { sessionId, accept }),
    submitTransientPassword: (sessionId: string, pass: string, ttlMinutes?: number, profileId?: string) =>
      invoke('ssh:submit-transient-password', { sessionId, pass, ttlMinutes, profileId }),

    onSSHData: (cb: Function) => addListener('ssh:data', cb),
    onSSHClose: (cb: Function) => addListener('ssh:close', cb),
    onSSHError: (cb: Function) => addListener('ssh:error', cb),
    onHostVerificationPrompt: (cb: Function) => addListener('ssh:host-prompt', cb),
    onPasswordPrompt: (cb: Function) => addListener('ssh:password-prompt', cb),

    // Host Trust
    getHostTrustRecords: () => invoke('trust:get-records'),
    acceptHostKey: (p: any) => invoke('trust:accept-key', p),
    rotateHostKey: (p: any) => invoke('trust:rotate-key', p),
    revokeHostKey: (p: any) => invoke('trust:revoke-key', p),

    // SFTP
    connectSFTP: (sessionId: string, profileId: string) => invoke('sftp:connect', { sessionId, profileId }),
    disconnectSFTP: (sessionId: string) => invoke('sftp:disconnect', sessionId),
    listLocalDir: (dirPath: string) => invoke('sftp:list-local', dirPath),
    listRemoteDir: (sessionId: string, dirPath: string) => invoke('sftp:list-remote', { sessionId, dirPath }),
    uploadFile: (sessionId: string, localPath: string, remotePath: string) =>
      invoke('sftp:upload-file', { sessionId, localPath, remotePath }),
    uploadBuffer: async (sessionId: string, buffer: ArrayBuffer | Uint8Array, remotePath: string) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      return invoke('sftp:upload-buffer', { sessionId, buffer: base64, encoding: 'base64', remotePath });
    },
    downloadFile: (sessionId: string, remotePath: string, localPath: string, sudoPassword?: string) =>
      invoke('sftp:download-file', { sessionId, remotePath, localPath, sudoPassword }),
    deleteRemoteFile: (sessionId: string, remotePath: string, isDirectory?: boolean) =>
      invoke('sftp:delete-remote', { sessionId, remotePath, isDirectory }),
    deleteLocalItem: (localPath: string) =>
      invoke('sftp:delete-local', { localPath }),
    createLocalDir: (dirPath: string) =>
      invoke('sftp:mkdir-local', { dirPath }),
    createRemoteDir: (sessionId: string, remotePath: string) =>
      invoke('sftp:mkdir-remote', { sessionId, remotePath }),
    copyLocalItem: (srcPath: string, destDir: string) =>
      invoke('sftp:copy-local', { srcPath, destDir }),
    copyRemoteItem: (sessionId: string, srcPath: string, destDir: string) =>
      invoke('sftp:copy-remote', { sessionId, srcPath, destDir }),
    fixPermissions: (sessionId: string, remotePath: string, mode?: string) =>
      invoke('sftp:fix-permissions', { sessionId, remotePath, mode }),
    onTransferProgress: (cb: (progress: any) => void) => addListener('sftp:transfer-progress', cb),

    // Ansible
    resolveInventoryTargets: (inventorySource: string, limit?: string, customTargets?: any[]) =>
      invoke('ansible:resolve-targets', { inventorySource, limit, customTargets }),
    executeAutomation: (req: any) => invoke('ansible:execute', req),
    cancelAutomation: (runId: string) => invoke('ansible:cancel', runId),
    getAutomationRuns: () => invoke('ansible:get-runs'),
    onAutomationEvent: (cb: Function) => addListener('ansible:event', cb),

    // Playbooks Library
    getPlaybooks: () => invoke('playbooks:get-all'),
    savePlaybook: (p: any) => invoke('playbooks:save', p),
    deletePlaybook: (id: string) => invoke('playbooks:delete', id),

    // Policy & Audit
    getActivePolicy: () => invoke('policy:get-active'),
    setPolicy: (p: any) => invoke('policy:set', p),
    getAuditEvents: (limit?: number) => invoke('audit:get-events', limit),
    verifyAuditIntegrity: () => invoke('audit:verify-integrity'),
    exportAuditBundle: () => invoke('audit:export-bundle'),

    // Support
    generateSupportBundle: () => invoke('support:generate-bundle'),
    detectSshAgent: () => invoke('system:detect-agent'),
    listStandardKeys: () => invoke('system:list-keys'),

    // SSH Key Pair Generator
    generateSSHKeyPair: (options: any) => invoke('ssh:generate-key-pair', options),

    // Snippets & Quick Commands
    getSnippets: () => invoke('snippets:get-all'),
    saveSnippet: (snippet: any) => invoke('snippets:save', snippet),
    deleteSnippet: (id: string) => invoke('snippets:delete', id),

    // Tunnels & Port Forwarding
    getTunnels: () => invoke('tunnels:get-all'),
    saveTunnel: (tunnel: any) => invoke('tunnels:save', tunnel),
    deleteTunnel: (id: string) => invoke('tunnels:delete', id),
    startTunnel: (id: string) => invoke('tunnels:start', id),
    stopTunnel: (id: string) => invoke('tunnels:stop', id),
    getTunnelStatuses: () => invoke('tunnels:get-statuses'),

    // Multi-Host Broadcast Input
    broadcastSSH: (sessionIds: string[], data: string) =>
      invoke('ssh:broadcast', { sessionIds, data }),

    // Remote System Health Monitor
    getSystemHealth: (target: string | { sessionId?: string; profileId?: string }) =>
      invoke('ssh:system-health', target),
    getCachedSystemHealth: (key: string) =>
      invoke('ssh:cached-system-health', key),

    // Remote File Editor
    readRemoteFile: (sessionId: string, remotePath: string) =>
      invoke('sftp:read-file', { sessionId, remotePath }),
    writeRemoteFile: (sessionId: string, remotePath: string, content: string, createBackup?: boolean) =>
      invoke('sftp:write-file', { sessionId, remotePath, content, createBackup }),

    // Enterprise Linux Services & Journalctl Manager
    listSystemdServices: (target: { sessionId?: string; profileId?: string }) =>
      invoke('systemd:list-services', target),
    controlSystemdService: (target: { sessionId?: string; profileId?: string }, unit: string, action: string) =>
      invoke('systemd:control-service', { target, unit, action }),
    getSystemdJournal: (target: { sessionId?: string; profileId?: string }, unit: string, lines?: number) =>
      invoke('systemd:get-journal', { target, unit, lines }),

    // Enterprise Multi-Host Configuration Drift
    compareConfigDrift: (targetA: any, targetB: any, pathOrCommand: string) =>
      invoke('config:compare-drift', { targetA, targetB, pathOrCommand }),

    // Enterprise Listening Ports & Socket Inspector
    getNetworkSockets: (target: { sessionId?: string; profileId?: string }) =>
      invoke('network:get-sockets', target),

    // Enterprise CIS Benchmark & Security Hardening Audit
    runSecurityAudit: (target: { sessionId?: string; profileId?: string; label?: string }) =>
      invoke('security:run-audit', target),

    // Enterprise Parameterized Runbooks & Canary Execution
    getRunbookCatalog: () =>
      invoke('runbook:get-catalog'),
    executeRunbook: (runbookId: string, params: any, targets: any[], strategy: string) =>
      invoke('runbook:execute', { runbookId, params, targets, strategy }),

    // Just-In-Time (JIT) Break-Glass Emergency Escalation
    requestBreakGlassAccess: (target: any, requestedUser: string, incidentTicketId: string, justification: string, durationMinutes: number) =>
      invoke('breakglass:request', { target, requestedUser, incidentTicketId, justification, durationMinutes }),

    // High-Availability Disaster Recovery & Diagnostics Service
    exportEncryptedBackup: (passphrase: string) =>
      invoke('disaster-recovery:export-backup', { passphrase }),
    restoreEncryptedBackup: (backupJson: string, passphrase: string) =>
      invoke('disaster-recovery:restore-backup', { backupJson, passphrase }),
    generateDiagnosticsReport: () =>
      invoke('diagnostics:generate-report'),
    invokeFeature: (channel: string, payload?: any) =>
      invoke('feature:invoke', { channel, payload }),
    getHostResources: () =>
      invoke('host:get-resources')
  };
}
