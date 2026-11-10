import cp from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionProfile } from '../domain/types';

export interface PuTTYSession {
  rawName: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  protocol: string;
  keyPath?: string;
}

export class PuTTYImporter {
  /**
   * Scans the Windows Registry for saved PuTTY sessions
   */
  public static getSavedSessions(): PuTTYSession[] {
    if (process.platform !== 'win32') {
      return [];
    }

    try {
      const regKey = 'HKCU\\Software\\SimonTatham\\PuTTY\\Sessions';
      const listOutput = cp.spawnSync('reg.exe', ['query', regKey], {
        encoding: 'utf8'
      });

      if (listOutput.status !== 0 || !listOutput.stdout) {
        return [];
      }

      const sessionKeys = listOutput.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith(regKey + '\\'))
        .map((line) => line.substring(regKey.length + 1));

      const sessions: PuTTYSession[] = [];

      for (const rawName of sessionKeys) {
        if (!rawName || rawName === 'Default%20Settings') continue;

        const sessionDetail = cp.spawnSync('reg.exe', ['query', `${regKey}\\${rawName}`], {
          encoding: 'utf8'
        });

        if (sessionDetail.status === 0 && sessionDetail.stdout) {
          const lines = sessionDetail.stdout.split(/\r?\n/);
          let hostname = '';
          let port = 22;
          let username = '';
          let protocol = 'ssh';
          let keyPath = '';

          for (const l of lines) {
            const parts = l.trim().split(/\s{2,}/);
            if (parts.length >= 3) {
              const valName = parts[0];
              const valType = parts[1];
              const valData = parts[2];

              if (valName === 'HostName') hostname = valData;
              else if (valName === 'PortNumber') port = parseInt(valData, 16) || parseInt(valData, 10) || 22;
              else if (valName === 'UserName') username = valData;
              else if (valName === 'Protocol') protocol = valData;
              else if (valName === 'PublicKeyFile') keyPath = valData;
            }
          }

          if (hostname) {
            const decodedName = decodeURIComponent(rawName.replace(/\+/g, '%20'));
            sessions.push({
              rawName,
              name: decodedName,
              hostname,
              port,
              username: username || 'root',
              protocol,
              keyPath: keyPath || undefined
            });
          }
        }
      }

      return sessions;
    } catch (e) {
      console.warn('[PuTTYImporter] Error querying PuTTY registry:', e);
      return [];
    }
  }

  /**
   * Converts PuTTY sessions into DgodTerm ConnectionProfiles
   */
  public static convertToProfiles(sessions: PuTTYSession[], folderId: string | null = null): ConnectionProfile[] {
    const now = new Date().toISOString();

    return sessions.map((s) => ({
      id: uuidv4(),
      schema_version: 1,
      display_name: s.name || s.hostname,
      hostname: s.hostname,
      port: s.port || 22,
      username: s.username || 'root',
      folder_id: folderId,
      tags: ['putty-import'],
      jump_host_profile_id: null,
      auth_reference: s.keyPath
        ? {
            kind: 'key_file_reference',
            reference_id: uuidv4(),
            account_or_key_label: 'PuTTY Private Key',
            key_path: s.keyPath
          }
        : {
            kind: 'transient_prompt',
            reference_id: uuidv4()
          },
      host_trust_policy_id: null,
      ssh_options: {
        keepalive_interval: 30,
        agent_forwarding: true,
        x11_forwarding: false,
        terminal_type: 'xterm-256color'
      },
      is_favorite: false,
      last_connected_at: null,
      created_at: now,
      updated_at: now,
      created_by: 'putty_importer',
      notes: `Imported from PuTTY session "${s.name}"`
    }));
  }
}
