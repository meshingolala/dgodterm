import { ConnectionProfile } from '../../domain/types';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedSshHost {
  id: string;
  display_name: string;
  hostname: string;
  port: number;
  username: string;
  folder_id: string | null;
  tags: string[];
  key_path?: string | null;
  selected: boolean;
  detectedFormat?: string;
}

export interface ParseOptions {
  defaultUser: string;
  defaultPort: number;
  defaultFolderId: string | null;
  commonTags: string[];
}

export function parseSshHostList(rawText: string, options: ParseOptions): ParsedSshHost[] {
  const text = rawText.trim();
  if (!text) return [];

  // 1. Try parsing as JSON array first
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item: any) => Boolean(item && (item.hostname || item.host || item.ip)))
          .map((item: any, idx: number) => {
            const host = item.hostname || item.host || item.ip;
            const name = item.display_name || item.name || host;
            const user = item.username || item.user || options.defaultUser || 'operator';
            const port = Number(item.port) || options.defaultPort || 22;
            const itemTags = Array.isArray(item.tags) ? item.tags : [];
            const mergedTags = Array.from(new Set([...options.commonTags, ...itemTags]));

            return {
              id: item.id || `import-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
              display_name: name,
              hostname: host,
              port,
              username: user,
              folder_id: item.folder_id || options.defaultFolderId,
              tags: mergedTags,
              key_path: item.auth_reference?.key_path || item.key_path || null,
              selected: true,
              detectedFormat: 'JSON'
            };
          });
      }
    } catch {
      // Fall through to other formats
    }
  }

  // 2. Check if OpenSSH config format (Host ... HostName ...)
  if (/\bHost\s+[^\n*]+/i.test(text) && /\bHostName\s+/i.test(text)) {
    return parseOpenSshConfig(text, options);
  }

  // 3. Check if Ansible INI inventory format
  if (/\bansible_host=/i.test(text) || /^\[[a-zA-Z0-9_-]+\]/m.test(text)) {
    const ansibleHosts = parseAnsibleInventory(text, options);
    if (ansibleHosts.length > 0) return ansibleHosts;
  }

  // 4. Check if CSV/TSV format
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  const hasCommaDelimited = lines.length > 0 && lines.some((l) => l.includes(',') && l.split(',').length >= 2);
  const hasTabDelimited = lines.length > 0 && lines.some((l) => l.includes('\t') && l.split('\t').length >= 2);

  if (hasCommaDelimited || hasTabDelimited) {
    const delimiter = hasTabDelimited ? '\t' : ',';
    const csvHosts = parseDelimitedLines(lines, delimiter, options);
    if (csvHosts.length > 0) return csvHosts;
  }

  // 5. Default: Plaintext Line-by-Line (IPs, user@host:port, ssh commands)
  return parseLineByLine(lines, options);
}

// OpenSSH ~/.ssh/config parser
function parseOpenSshConfig(text: string, options: ParseOptions): ParsedSshHost[] {
  const results: ParsedSshHost[] = [];
  const lines = text.split(/\r?\n/);

  let currentHost: Partial<ParsedSshHost> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const key = parts[0].toLowerCase();
    const val = parts.slice(1).join(' ').trim();

    if (key === 'host') {
      // Save previous host if valid
      if (currentHost && currentHost.hostname && currentHost.display_name && !currentHost.display_name.includes('*')) {
        results.push(finalizeHost(currentHost, options, 'OpenSSH Config'));
      }

      // Ignore wildcard blocks like Host *
      if (val.includes('*') || val.includes('?')) {
        currentHost = null;
        continue;
      }

      currentHost = {
        display_name: val,
        hostname: val,
        port: options.defaultPort || 22,
        username: options.defaultUser || 'operator',
        folder_id: options.defaultFolderId,
        tags: [...options.commonTags],
        selected: true
      };
    } else if (currentHost) {
      if (key === 'hostname') {
        currentHost.hostname = val;
      } else if (key === 'user') {
        currentHost.username = val;
      } else if (key === 'port') {
        currentHost.port = parseInt(val, 10) || options.defaultPort;
      } else if (key === 'identityfile') {
        currentHost.key_path = val.replace(/^~/, '$HOME');
      }
    }
  }

  // Push last block
  if (currentHost && currentHost.hostname && currentHost.display_name && !currentHost.display_name.includes('*')) {
    results.push(finalizeHost(currentHost, options, 'OpenSSH Config'));
  }

  return results;
}

// Ansible Inventory parser (e.g. hosts.ini)
function parseAnsibleInventory(text: string, options: ParseOptions): ParsedSshHost[] {
  const results: ParsedSshHost[] = [];
  const lines = text.split(/\r?\n/);
  let currentGroup = 'default';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    // Group header: [webservers]
    if (line.startsWith('[') && line.endsWith(']')) {
      const g = line.slice(1, -1).trim();
      if (!g.includes(':')) {
        currentGroup = g;
      }
      continue;
    }

    // Skip children/vars sections
    if (currentGroup.includes(':vars') || currentGroup.includes(':children')) {
      continue;
    }

    const tokens = line.split(/\s+/);
    if (!tokens.length) continue;

    const hostAlias = tokens[0];
    let actualHost = hostAlias;
    let user = options.defaultUser || 'operator';
    let port = options.defaultPort || 22;

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith('ansible_host=')) {
        actualHost = token.split('=')[1];
      } else if (token.startsWith('ansible_user=')) {
        user = token.split('=')[1];
      } else if (token.startsWith('ansible_port=')) {
        port = parseInt(token.split('=')[1], 10) || port;
      }
    }

    const tags = Array.from(new Set([...options.commonTags, currentGroup]));
    results.push({
      id: `ansible-${Date.now()}-${results.length}-${Math.random().toString(36).substring(2, 6)}`,
      display_name: hostAlias !== actualHost ? `${hostAlias} (${actualHost})` : hostAlias,
      hostname: actualHost,
      port,
      username: user,
      folder_id: options.defaultFolderId,
      tags,
      selected: true,
      detectedFormat: 'Ansible Inventory'
    });
  }

  return results;
}

// Delimited CSV/TSV parser
function parseDelimitedLines(lines: string[], delimiter: string, options: ParseOptions): ParsedSshHost[] {
  const results: ParsedSshHost[] = [];
  let headerIndex = -1;
  let colMap: { name?: number; host?: number; user?: number; port?: number; tags?: number } = {};

  const firstLineCols = lines[0].split(delimiter).map((c) => c.trim().toLowerCase());
  if (firstLineCols.some((c) => ['host', 'hostname', 'ip', 'name', 'display_name'].includes(c))) {
    headerIndex = 0;
    firstLineCols.forEach((col, idx) => {
      if (['name', 'display_name', 'label', 'server'].includes(col)) colMap.name = idx;
      if (['host', 'hostname', 'ip', 'address'].includes(col)) colMap.host = idx;
      if (['user', 'username', 'login'].includes(col)) colMap.user = idx;
      if (['port', 'ssh_port'].includes(col)) colMap.port = idx;
      if (['tags', 'tag', 'group'].includes(col)) colMap.tags = idx;
    });
  }

  const dataLines = headerIndex === 0 ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (!cols.length || !cols[0]) continue;

    let host = '';
    let name = '';
    let user = options.defaultUser || 'operator';
    let port = options.defaultPort || 22;
    let extraTags: string[] = [];

    if (colMap.host !== undefined) {
      host = cols[colMap.host] || '';
      name = colMap.name !== undefined ? cols[colMap.name] || host : host;
      user = colMap.user !== undefined ? cols[colMap.user] || user : user;
      port = colMap.port !== undefined ? parseInt(cols[colMap.port], 10) || port : port;
      if (colMap.tags !== undefined && cols[colMap.tags]) {
        extraTags = cols[colMap.tags].split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
      }
    } else {
      // Positional heuristic: Name, Host, User, Port
      if (cols.length >= 4) {
        name = cols[0];
        host = cols[1];
        user = cols[2] || user;
        port = parseInt(cols[3], 10) || port;
        if (cols[4]) extraTags = cols[4].split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
      } else if (cols.length === 3) {
        host = cols[0];
        user = cols[1] || user;
        port = parseInt(cols[2], 10) || port;
        name = host;
      } else if (cols.length === 2) {
        name = cols[0];
        host = cols[1];
      } else {
        host = cols[0];
        name = host;
      }
    }

    if (!host) continue;

    // Check if host contains user@host:port
    const inlineParsed = extractUserHostPort(host, options);
    if (inlineParsed) {
      host = inlineParsed.hostname;
      if (inlineParsed.username) user = inlineParsed.username;
      if (inlineParsed.port) port = inlineParsed.port;
    }

    const mergedTags = Array.from(new Set([...options.commonTags, ...extraTags]));

    results.push({
      id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      display_name: name || host,
      hostname: host,
      port,
      username: user,
      folder_id: options.defaultFolderId,
      tags: mergedTags,
      selected: true,
      detectedFormat: delimiter === '\t' ? 'TSV' : 'CSV'
    });
  }

  return results;
}

// Plaintext Line-by-line parser (IPs, user@host:port, ssh -p 2200 user@host)
function parseLineByLine(lines: string[], options: ParseOptions): ParsedSshHost[] {
  const results: ParsedSshHost[] = [];

  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('//')) continue;

    // Extract inline comment if any: 192.168.1.50 # Web Server
    let label = '';
    const commentMatch = raw.match(/^(.*?)\s+[#;]\s*(.*)$/);
    if (commentMatch) {
      raw = commentMatch[1].trim();
      label = commentMatch[2].trim();
    }

    // Strip leading "ssh " or "ssh.exe " command
    let port = options.defaultPort || 22;
    let user = options.defaultUser || 'operator';

    raw = raw.replace(/^ssh(?:\.exe)?\s+/i, '');

    // Extract -p <port> flag
    const portFlagMatch = raw.match(/-p\s+(\d+)/i);
    if (portFlagMatch) {
      port = parseInt(portFlagMatch[1], 10);
      raw = raw.replace(/-p\s+\d+/i, '').trim();
    }

    // Extract -l <user> flag
    const userFlagMatch = raw.match(/-l\s+([a-zA-Z0-9_.-]+)/i);
    if (userFlagMatch) {
      user = userFlagMatch[1];
      raw = raw.replace(/-l\s+[a-zA-Z0-9_.-]+/i, '').trim();
    }

    // Extract -i <key> flag
    let keyPath: string | null = null;
    const keyFlagMatch = raw.match(/-i\s+([^\s]+)/i);
    if (keyFlagMatch) {
      keyPath = keyFlagMatch[1];
      raw = raw.replace(/-i\s+[^\s]+/i, '').trim();
    }

    // Now parse user@hostname:port label
    const tokens = raw.split(/\s+/);
    const hostSpec = tokens[0];
    if (tokens.length > 1 && !label) {
      label = tokens.slice(1).join(' ').trim();
    }

    const inline = extractUserHostPort(hostSpec, options);
    if (!inline || !inline.hostname) continue;

    const finalHost = inline.hostname;
    const finalUser = inline.username || user;
    const finalPort = inline.port || port;
    const displayName = label || (inline.username ? `${inline.username}@${finalHost}` : finalHost);

    results.push({
      id: `host-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      display_name: displayName,
      hostname: finalHost,
      port: finalPort,
      username: finalUser,
      folder_id: options.defaultFolderId,
      tags: [...options.commonTags],
      key_path: keyPath,
      selected: true,
      detectedFormat: 'Host List'
    });
  }

  return results;
}

// Helper: extracts user, hostname, port from strings like operator@192.168.1.1:2222 or 10.0.0.1
function extractUserHostPort(spec: string, options: ParseOptions): { username?: string; hostname: string; port?: number } | null {
  const match = spec.match(/^(?:(?<user>[a-zA-Z0-9_.-]+)@)?(?<host>[a-zA-Z0-9_.:-]+)$/);
  if (!match || !match.groups) return null;

  let hostPart = match.groups.host;
  let userPart = match.groups.user;
  let portPart: number | undefined;

  // Check if IPv6 or host:port
  if (hostPart.includes(':') && !hostPart.startsWith('[') && hostPart.split(':').length === 2) {
    const [h, p] = hostPart.split(':');
    hostPart = h;
    const parsedP = parseInt(p, 10);
    if (!isNaN(parsedP)) portPart = parsedP;
  }

  return {
    username: userPart || undefined,
    hostname: hostPart,
    port: portPart
  };
}

function finalizeHost(h: Partial<ParsedSshHost>, options: ParseOptions, formatName: string): ParsedSshHost {
  return {
    id: `parsed-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    display_name: h.display_name || h.hostname || 'Host',
    hostname: h.hostname || '127.0.0.1',
    port: h.port || options.defaultPort || 22,
    username: h.username || options.defaultUser || 'operator',
    folder_id: h.folder_id || options.defaultFolderId,
    tags: h.tags || [...options.commonTags],
    key_path: h.key_path || null,
    selected: true,
    detectedFormat: formatName
  };
}

export function convertToProfile(host: ParsedSshHost): ConnectionProfile {
  return {
    id: host.id,
    schema_version: 1,
    display_name: host.display_name,
    hostname: host.hostname,
    port: host.port,
    username: host.username,
    folder_id: host.folder_id,
    tags: host.tags,
    jump_host_profile_id: null,
    auth_reference: host.key_path ? {
      kind: 'key_file_reference',
      reference_id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      key_path: host.key_path
    } : null,
    host_trust_policy_id: null,
    ssh_options: {
      keepalive_interval: 30
    },
    is_favorite: false,
    last_connected_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'batch_import'
  };
}
