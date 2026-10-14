/**
 * Command Safety Guardian: Catastrophic Command Detection
 * Intercepts accidental destruction on Linux servers (e.g. rm -rf /, mkfs, dd).
 */

export interface DestructiveCommandAlert {
  isDestructive: boolean;
  severity: 'critical' | 'high' | 'warning';
  matchedRule: string;
  commandSnippet: string;
  explanation: string;
}

const DESTRUCTIVE_PATTERNS: { regex: RegExp; rule: string; severity: 'critical' | 'high' | 'warning'; explanation: string }[] = [
  {
    regex: /\brm\s+-[rfRF]{1,4}\s+([/]|[/][*]|\.\.|\b~[/]?\b|\$HOME\b)/i,
    rule: 'Root or Home Recursive Deletion (rm -rf /)',
    severity: 'critical',
    explanation: 'Command attempts to recursively wipe the root filesystem or user directory.'
  },
  {
    regex: /\brm\s+-[rfRF]{1,4}\s+--no-preserve-root\b/i,
    rule: 'Forced Root Erasure (--no-preserve-root)',
    severity: 'critical',
    explanation: 'Explicit bypass of root filesystem protection flag.'
  },
  {
    regex: /\bmkfs(\.[a-z0-9]+)?\s+(\/dev\/[shv]d[a-z][0-9]?|\/dev\/nvme[0-9]n[0-9])/i,
    rule: 'Filesystem Format (mkfs on raw disk)',
    severity: 'critical',
    explanation: 'Attempts to format an active disk block device, destroying existing partitions.'
  },
  {
    regex: /\bdd\s+.*of=\/dev\/([shv]d[a-z]|nvme[0-9]n[0-9]|null)\b/i,
    rule: 'Raw Disk Overwrite (dd of=/dev/sdX)',
    severity: 'critical',
    explanation: 'Writes low-level binary data directly over physical partition or disk table.'
  },
  {
    regex: /\b(chmod|chown)\s+(-R|--recursive)\s+(777|000)\s+(\/|\/etc|\/bin|\/usr|\/lib|\/var)\b/i,
    rule: 'Destructive Mass Permissions Overwrite',
    severity: 'high',
    explanation: 'Recursively destroys system security boundaries or bricks root filesystem access.'
  },
  {
    regex: />\s*\/dev\/([shv]d[a-z]|nvme[0-9]n[0-9]|kmem|mem)\b/i,
    rule: 'Direct Redirection to Raw Disk/Memory Device',
    severity: 'critical',
    explanation: 'Shell redirection directly into raw kernel block or memory devices.'
  },
  {
    regex: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/i,
    rule: 'Fork Bomb Signature',
    severity: 'critical',
    explanation: 'Denial of service loop exhausting all available kernel process tables.'
  },
  {
    regex: /\b(init\s+0|shutdown\s+-h\s+now|poweroff|halt)\b/i,
    rule: 'Host Shutdown / Poweroff Command',
    severity: 'warning',
    explanation: 'Immediately turns off the remote host machine.'
  }
];

export function checkDestructiveCommand(rawText: string): DestructiveCommandAlert | null {
  if (!rawText || !rawText.trim()) return null;

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.regex.test(rawText)) {
      return {
        isDestructive: true,
        severity: pattern.severity,
        matchedRule: pattern.rule,
        commandSnippet: rawText.trim().slice(0, 150),
        explanation: pattern.explanation
      };
    }
  }

  return null;
}
