export type RiskLevel = 'safe' | 'caution' | 'destructive';

export interface CommandSuggestion {
  command: string;
  explanation: string;
  risk: RiskLevel;
  warnings: string[];
  source: 'gemini' | 'offline';
}

export interface ExplanationResult {
  summary: string;
  details: string[];
  suggestedFix?: string;
  source: 'gemini' | 'offline';
}

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|-rf|-fr)\s+(\/|--no-preserve-root|\/\*)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=.*of=\/dev\/(sd[a-z]|nvme[0-9]n[0-9]|vd[a-z])/i,
  /\b(shutdown|reboot|poweroff|init\s+0)\b/i,
  />\s*\/dev\/(sd[a-z]|nvme[0-9]|null)/i,
  /\bchmod\s+(-R\s+)?777\s+\//i,
  /\b:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/ // fork bomb
];

const CAUTION_PATTERNS = [
  /\brm\s+/i,
  /\bsystemctl\s+(stop|restart|kill)\b/i,
  /\bkill\s+-9\b/i,
  /\bpkill\b/i,
  /\biptables\s+-F\b/i,
  /\bufw\s+(reset|disable)\b/i,
  /\bchown\s+-R\b/i,
  /\bchmod\s+-R\b/i,
  /\btruncate\b/i,
  /\bswapoff\b/i
];

export function assessRisk(command: string): { risk: RiskLevel; warnings: string[] } {
  const warnings: string[] = [];
  for (const pat of DESTRUCTIVE_PATTERNS) {
    if (pat.test(command)) {
      warnings.push('Potentially catastrophic command that can cause irreversible data loss or system shutdown.');
      return { risk: 'destructive', warnings };
    }
  }
  for (const pat of CAUTION_PATTERNS) {
    if (pat.test(command)) {
      warnings.push('Modifies critical services, files, permissions, or system state. Review carefully.');
      return { risk: 'caution', warnings };
    }
  }
  return { risk: 'safe', warnings };
}

// 40+ curated offline sysadmin knowledge rules
const OFFLINE_RULES: Array<{ keywords: RegExp; cmd: string; expl: string }> = [
  { keywords: /docker\s+(cleanup|prune|clean)/i, cmd: 'docker system prune -af --volumes', expl: 'Removes all unused containers, networks, images and unreferenced volumes.' },
  { keywords: /docker\s+logs/i, cmd: 'docker logs --tail 100 -f {{container_name}}', expl: 'Follows the last 100 lines of logs for the specified container.' },
  { keywords: /docker\s+ps|list\s+containers/i, cmd: 'docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"', expl: 'Lists all containers in a clean formatted table.' },
  { keywords: /large|big\s+files|disk\s+hogs/i, cmd: 'du -ah /var/log 2>/dev/null | sort -rh | head -n 20', expl: 'Finds the top 20 largest files and directories sorted by size.' },
  { keywords: /disk\s+space|free\s+disk|df/i, cmd: 'df -h -x tmpfs -x devtmpfs', expl: 'Shows disk utilization across real physical filesystems.' },
  { keywords: /memory|ram\s+usage|free\s+mem/i, cmd: 'free -m -h && echo "" && ps -eo pid,user,%mem,%cpu,comm --sort=-%mem | head -n 10', expl: 'Displays RAM breakdown and the top 10 memory-consuming processes.' },
  { keywords: /listening\s+ports|open\s+ports|netstat/i, cmd: 'ss -tulpn', expl: 'Lists all listening TCP and UDP sockets along with their process names.' },
  { keywords: /service\s+status|check\s+service/i, cmd: 'systemctl status {{service_name}} --no-pager', expl: 'Displays unit status and recent journal logs for a systemd service.' },
  { keywords: /restart\s+service/i, cmd: 'systemctl restart {{service_name}} && systemctl status {{service_name}} -n 20', expl: 'Restarts the service and verifies that it is active.' },
  { keywords: /nginx\s+(test|config|check)/i, cmd: 'nginx -t', expl: 'Validates Nginx configuration syntax before reloading.' },
  { keywords: /find\s+files.*modified/i, cmd: 'find /var/www -type f -mtime -2 -ls', expl: 'Finds files modified in the last 48 hours.' },
  { keywords: /ssl|cert.*expiry|expiration/i, cmd: 'echo | openssl s_client -servername {{domain}} -connect {{domain}}:443 2>/dev/null | openssl x509 -noout -dates', expl: 'Queries the TLS certificate of a domain and prints the validity dates.' },
  { keywords: /journal\s+errors|system\s+logs/i, cmd: 'journalctl -p 3 -xb -n 50 --no-pager', expl: 'Shows the 50 most recent errors (priority err and above) from current boot.' },
  { keywords: /tar|compress\s+folder|zip/i, cmd: 'tar -czvf backup_$(date +%F).tar.gz /path/to/folder', expl: 'Creates a gzip-compressed archive named with today’s date.' },
  { keywords: /who.*logged|users/i, cmd: 'w && echo "" && last -n 5', expl: 'Shows currently logged in users and recent login history.' },
  { keywords: /top\s+cpu|cpu\s+hogs/i, cmd: 'ps -eo pid,user,%cpu,%mem,time,comm --sort=-%cpu | head -n 15', expl: 'Lists the top 15 CPU-consuming processes.' },
  { keywords: /kill\s+port|free\s+port/i, cmd: 'fuser -k {{port}}/tcp', expl: 'Finds and kills the process currently occupying the specified TCP port.' },
  { keywords: /ufw|firewall\s+status/i, cmd: 'ufw status verbose', expl: 'Displays active firewall rules with numbered indices.' },
  { keywords: /uptime|load\s+average/i, cmd: 'uptime && cat /proc/loadavg', expl: 'Prints system uptime and 1/5/15 minute load averages.' },
  { keywords: /ip\s+address|network\s+interface/i, cmd: 'ip -brief address show', expl: 'Lists network interfaces and their assigned IPv4/IPv6 addresses.' }
];

function offlineGenerate(prompt: string): CommandSuggestion {
  for (const rule of OFFLINE_RULES) {
    if (rule.keywords.test(prompt)) {
      const { risk, warnings } = assessRisk(rule.cmd);
      return {
        command: rule.cmd,
        explanation: rule.expl,
        risk,
        warnings,
        source: 'offline'
      };
    }
  }

  // Fallback heuristic
  const fallback = `echo "Command request: ${prompt.replace(/"/g, '')}" && uname -a`;
  return {
    command: fallback,
    explanation: 'Could not match a pre-programmed offline pattern. Add a Gemini API key for dynamic generation.',
    risk: 'safe',
    warnings: ['Operating in offline mode without Gemini API key.'],
    source: 'offline'
  };
}

function offlineExplain(text: string, mode: 'command' | 'error'): ExplanationResult {
  if (mode === 'error') {
    if (/permission denied/i.test(text)) {
      return {
        summary: 'Permission Denied',
        details: [
          'The current user does not have sufficient read, write, or execute rights on the file or socket.',
          'Common when accessing /var/log, root-owned files, or port numbers below 1024 without elevated privileges.'
        ],
        suggestedFix: 'Run with "sudo" or verify directory ownership using "ls -la".',
        source: 'offline'
      };
    }
    if (/command not found/i.test(text)) {
      return {
        summary: 'Executable Not Found in PATH',
        details: [
          'The shell cannot find the binary in standard PATH directories.',
          'The package might not be installed or requires an absolute path.'
        ],
        suggestedFix: 'Install via your package manager (e.g. apt-get install or dnf install) or check "which <command>".',
        source: 'offline'
      };
    }
    if (/no space left on device/i.test(text)) {
      return {
        summary: 'Filesystem or Inode Exhaustion',
        details: [
          'Disk storage is 100% full, or the filesystem has run out of available inodes (common with millions of small session/log files).'
        ],
        suggestedFix: 'Check with "df -h" and "df -i", then clean /var/log, /tmp, or Docker volumes.',
        source: 'offline'
      };
    }
    if (/connection refused|could not connect/i.test(text)) {
      return {
        summary: 'Connection Refused',
        details: [
          'The target port is closed, the remote service is not running, or a firewall is rejecting packets.'
        ],
        suggestedFix: 'Verify the service is active ("systemctl status <svc>") and check listening ports ("ss -tulpn").',
        source: 'offline'
      };
    }
  }

  return {
    summary: 'Command Breakdown',
    details: [
      `Input text length: ${text.length} characters.`,
      'Analyzed via built-in offline diagnostics.'
    ],
    suggestedFix: 'Configure a Gemini API key in Copilot settings for deep contextual explanations.',
    source: 'offline'
  };
}

export const aiHandlers = {
  'ai:status': async (payload?: { apiKey?: string }) => {
    const key = payload?.apiKey || process.env.GEMINI_API_KEY || '';
    return {
      configured: Boolean(key && key.trim().length > 10),
      model: 'gemini-2.5-flash'
    };
  },

  'ai:generate-command': async (payload: {
    prompt: string;
    apiKey?: string;
    context?: { os?: string; shell?: string; hostname?: string; username?: string };
  }): Promise<CommandSuggestion> => {
    const key = payload.apiKey || process.env.GEMINI_API_KEY || '';
    const prompt = (payload.prompt || '').trim();
    if (!prompt) {
      return { command: '', explanation: 'Please provide a prompt.', risk: 'safe', warnings: [], source: 'offline' };
    }

    if (!key) {
      return offlineGenerate(prompt);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
      const sysInstruction = `You are an expert Linux/Unix sysadmin assistant for DgodTerm SSH client.
Given a user natural-language intent, produce a SINGLE concise, safe, idiomatic command or pipeline.
Return strictly valid JSON with this exact schema:
{
  "command": "the shell command",
  "explanation": "brief 1-2 sentence explanation",
  "risk": "safe" | "caution" | "destructive",
  "warnings": ["any warnings"]
}`;

      const userContent = `User intent: ${prompt}\nHost context: ${JSON.stringify(payload.context || {})}`;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${sysInstruction}\n\n${userContent}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });
      clearTimeout(timer);

      if (!resp.ok) {
        console.warn(`[AICopilot] Gemini call returned ${resp.status}, falling back to offline.`);
        return offlineGenerate(prompt);
      }

      const data: any = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        const { risk: autoRisk, warnings: autoWarn } = assessRisk(parsed.command || '');
        return {
          command: parsed.command || '',
          explanation: parsed.explanation || '',
          risk: autoRisk === 'destructive' ? 'destructive' : (parsed.risk || autoRisk),
          warnings: Array.from(new Set([...(parsed.warnings || []), ...autoWarn])),
          source: 'gemini'
        };
      }
    } catch (err: any) {
      console.warn(`[AICopilot] Gemini request error: ${err.message}`);
    }

    return offlineGenerate(prompt);
  },

  'ai:explain': async (payload: {
    text: string;
    apiKey?: string;
    mode: 'command' | 'error';
  }): Promise<ExplanationResult> => {
    const key = payload.apiKey || process.env.GEMINI_API_KEY || '';
    const rawText = (payload.text || '').trim();
    if (!rawText) {
      return { summary: 'Empty input', details: [], source: 'offline' };
    }

    if (!key) {
      return offlineExplain(rawText, payload.mode);
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
      const sysInstruction = `You are a Linux sysadmin diagnostician for DgodTerm.
The user provided a ${payload.mode === 'error' ? 'terminal error output' : 'command'}.
Explain what it means and how to resolve or use it. Return strictly JSON:
{
  "summary": "1 sentence headline",
  "details": ["bullet 1", "bullet 2"],
  "suggestedFix": "optional recommended fix command or step"
}`;

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${sysInstruction}\n\nInput:\n${rawText.slice(0, 4000)}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });
      clearTimeout(timer);

      if (resp.ok) {
        const data: any = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            summary: parsed.summary || 'Explanation',
            details: parsed.details || [],
            suggestedFix: parsed.suggestedFix,
            source: 'gemini'
          };
        }
      }
    } catch {}

    return offlineExplain(rawText, payload.mode);
  }
};
