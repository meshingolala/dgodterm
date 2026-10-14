import { SSHManager } from './ssh-client';

export interface NetworkSocketInfo {
  protocol: string;
  localAddress: string;
  port: number;
  foreignAddress: string;
  state: string;
  pid?: string;
  processName?: string;
  isPubliclyExposed: boolean;
  isRisky: boolean;
  riskReason?: string;
}

export interface NetworkPortsReport {
  sockets: NetworkSocketInfo[];
  firewallStatus: string;
  totalListening: number;
  riskyExposureCount: number;
  timestamp: string;
}

const RISKY_PORTS: Record<number, string> = {
  21: 'Unencrypted FTP exposed to network',
  23: 'Insecure Telnet exposed',
  3306: 'MySQL database port exposed directly to external network',
  5432: 'PostgreSQL database port exposed directly',
  6379: 'Redis in-memory database exposed without isolation',
  27017: 'MongoDB document database exposed',
  9200: 'Elasticsearch search cluster exposed',
  2375: 'Unauthenticated Docker daemon API socket exposed'
};

export class NetworkPortsService {
  private static instance: NetworkPortsService;

  private constructor() {}

  public static getInstance(): NetworkPortsService {
    if (!NetworkPortsService.instance) {
      NetworkPortsService.instance = new NetworkPortsService();
    }
    return NetworkPortsService.instance;
  }

  public async getListeningSockets(target: { sessionId?: string; profileId?: string }): Promise<NetworkPortsReport> {
    const ssh = SSHManager.getInstance();

    const cmd = `
echo "===SS==="
ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null
echo "===FIREWALL==="
if command -v ufw >/dev/null 2>&1; then
  ufw status 2>/dev/null | head -n 4
elif command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewalld: $(firewall-cmd --state 2>&1)"
else
  iptables -L -n 2>/dev/null | head -n 3 || echo "Firewall: iptables active"
fi
`;

    const { stdout } = await ssh.executeCommandOnTarget(target, cmd);

    const sections: Record<string, string> = {};
    let currentSec = '';
    for (const line of stdout.split('\n')) {
      if (line.startsWith('===') && line.endsWith('===')) {
        currentSec = line.replace(/=/g, '').trim();
        sections[currentSec] = '';
      } else if (currentSec) {
        sections[currentSec] += line + '\n';
      }
    }

    const ssRaw = sections['SS'] || '';
    const firewallStatus = (sections['FIREWALL'] || 'Unknown').trim();

    const sockets: NetworkSocketInfo[] = [];
    const ssLines = ssRaw.split('\n');

    for (const line of ssLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Netid') || trimmed.startsWith('Proto') || trimmed.startsWith('Active')) continue;

      const parts = trimmed.split(/\s+/);
      if (parts.length < 5) continue;

      const protocol = parts[0];
      const state = parts[1];
      // Parts usually: Proto Recv-Q Send-Q Local Address:Port Peer Address:Port Process
      let localPart = parts[4] || '';
      let procPart = parts.slice(5).join(' ');

      if (parts.length >= 6 && (parts[1] === 'LISTEN' || parts[1] === 'UNCONN')) {
        localPart = parts[4];
        procPart = parts.slice(6).join(' ');
      }

      // Parse IP and Port from e.g. 0.0.0.0:22 or [::]:80 or *:22 or 127.0.0.1:5432
      const lastColon = localPart.lastIndexOf(':');
      if (lastColon === -1) continue;

      const localAddress = localPart.substring(0, lastColon);
      const portStr = localPart.substring(lastColon + 1);
      const port = parseInt(portStr, 10);
      if (isNaN(port)) continue;

      // Extract PID and Process Name from e.g. users:(("sshd",pid=1234,fd=3))
      let pid: string | undefined;
      let processName: string | undefined;

      const procMatch = procPart.match(/users:\(\("([^"]+)",pid=([0-9]+)/);
      if (procMatch) {
        processName = procMatch[1];
        pid = procMatch[2];
      } else {
        const netstatMatch = procPart.match(/([0-9]+)\/([^\s]+)/);
        if (netstatMatch) {
          pid = netstatMatch[1];
          processName = netstatMatch[2];
        }
      }

      const isPubliclyExposed = localAddress === '0.0.0.0' || localAddress === '*' || localAddress === '::' || localAddress === '[::]';
      const isRisky = isPubliclyExposed && Boolean(RISKY_PORTS[port]);
      const riskReason = isRisky ? RISKY_PORTS[port] : undefined;

      sockets.push({
        protocol,
        localAddress: localAddress || '0.0.0.0',
        port,
        foreignAddress: parts[5] || '*:*',
        state,
        pid,
        processName: processName || 'kernel/daemon',
        isPubliclyExposed,
        isRisky,
        riskReason
      });
    }

    // Sort: risky ports first, then port ascending
    sockets.sort((a, b) => {
      if (a.isRisky && !b.isRisky) return -1;
      if (!a.isRisky && b.isRisky) return 1;
      return a.port - b.port;
    });

    const riskyCount = sockets.filter((s) => s.isRisky).length;

    return {
      sockets,
      firewallStatus: firewallStatus || 'Active',
      totalListening: sockets.length,
      riskyExposureCount: riskyCount,
      timestamp: new Date().toISOString()
    };
  }
}
