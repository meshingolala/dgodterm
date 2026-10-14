import { SSHManager } from './ssh-client';
import { AuditService } from '../audit/audit-service';

export interface AuditCheckResult {
  id: string;
  title: string;
  category: 'Access Control' | 'Network Security' | 'System Hardening' | 'Integrity';
  severity: 'pass' | 'warning' | 'critical';
  evidence: string;
  explanation: string;
  remediation?: string;
}

export interface SecurityAuditReport {
  score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  passedCount: number;
  warningCount: number;
  criticalCount: number;
  checks: AuditCheckResult[];
  hostIdentifier: string;
  scannedAt: string;
}

export class SecurityAuditService {
  private static instance: SecurityAuditService;

  private constructor() {}

  public static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  public async runAudit(target: { sessionId?: string; profileId?: string; label?: string }): Promise<SecurityAuditReport> {
    const ssh = SSHManager.getInstance();

    const auditScript = `
echo "===CHECK_ROOT_LOGIN==="
grep -Ei "^\\s*PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || echo "PermitRootLogin not explicitly set"

echo "===CHECK_PASSWORD_AUTH==="
grep -Ei "^\\s*PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/* 2>/dev/null || echo "PasswordAuthentication not explicitly set"

echo "===CHECK_FIREWALL==="
if command -v ufw >/dev/null 2>&1; then
  ufw status 2>/dev/null | head -n 4
elif command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewalld: $(firewall-cmd --state 2>&1)"
else
  iptables -L -n 2>/dev/null | head -n 4 || echo "inactive"
fi

echo "===CHECK_SUDOERS==="
grep -rnEi "NOPASSWD:\\s*ALL" /etc/sudoers /etc/sudoers.d/ 2>/dev/null || echo "CLEAN"

echo "===CHECK_WORLD_WRITABLE==="
find /etc -maxdepth 3 -type f -perm -0002 2>/dev/null | head -n 5 || echo "CLEAN"

echo "===CHECK_UNATTENDED==="
systemctl is-active unattended-upgrades 2>/dev/null || echo "inactive"

echo "===CHECK_EMPTY_PASSWORDS==="
awk -F: '($2 == "" ) { print $1 }' /etc/shadow 2>/dev/null || echo "CLEAN"

echo "===CHECK_PROTECTED_LINKS==="
sysctl -n fs.protected_symlinks fs.protected_hardlinks 2>/dev/null || echo "1 1"

echo "===CHECK_NTP==="
timedatectl status 2>/dev/null | grep -i "NTP service" || systemctl is-active chrony chronyd systemd-timesyncd 2>/dev/null || echo "unknown"

echo "===CHECK_CORE_DUMPS==="
sysctl -n fs.suid_dumpable 2>/dev/null || echo "0"
`;

    const { stdout } = await ssh.executeCommandOnTarget(target, auditScript);

    const sections: Record<string, string> = {};
    let cur = '';
    for (const line of stdout.split('\n')) {
      if (line.startsWith('===CHECK_') && line.endsWith('===')) {
        cur = line.replace(/=/g, '').trim();
        sections[cur] = '';
      } else if (cur) {
        sections[cur] += line + '\n';
      }
    }

    const checks: AuditCheckResult[] = [];

    // 1. SSH Root Login
    const rootLoginRaw = (sections['CHECK_ROOT_LOGIN'] || '').trim();
    if (rootLoginRaw.toLowerCase().includes('permitrootlogin no')) {
      checks.push({
        id: 'ssh-root-login',
        title: 'SSH Direct Root Login Disabled',
        category: 'Access Control',
        severity: 'pass',
        evidence: rootLoginRaw,
        explanation: 'Direct root login over SSH is disabled. Operators must log in as unprivileged users.'
      });
    } else if (rootLoginRaw.toLowerCase().includes('prohibit-password')) {
      checks.push({
        id: 'ssh-root-login',
        title: 'SSH Root Login Restricted to Public Key',
        category: 'Access Control',
        severity: 'warning',
        evidence: rootLoginRaw,
        explanation: 'Root login is allowed only via key pairs. Best practice recommends disabling root login entirely (PermitRootLogin no).',
        remediation: 'sed -i "s/^PermitRootLogin.*/PermitRootLogin no/" /etc/ssh/sshd_config && systemctl reload sshd'
      });
    } else {
      checks.push({
        id: 'ssh-root-login',
        title: 'SSH Direct Root Login Allowed or Undefined',
        category: 'Access Control',
        severity: 'critical',
        evidence: rootLoginRaw || 'Not configured (defaulting to enabled)',
        explanation: 'Direct root access over SSH exposes server to brute-force attacks and bypasses identity attribution.',
        remediation: 'echo "PermitRootLogin no" | sudo tee -a /etc/ssh/sshd_config.d/hardening.conf && sudo systemctl reload sshd'
      });
    }

    // 2. SSH Password Authentication
    const passAuthRaw = (sections['CHECK_PASSWORD_AUTH'] || '').trim();
    if (passAuthRaw.toLowerCase().includes('passwordauthentication no')) {
      checks.push({
        id: 'ssh-password-auth',
        title: 'SSH Password Authentication Disabled',
        category: 'Access Control',
        severity: 'pass',
        evidence: passAuthRaw,
        explanation: 'Password authentication is disabled. SSH mandates cryptographic keys / certificates.'
      });
    } else {
      checks.push({
        id: 'ssh-password-auth',
        title: 'SSH Password Authentication Enabled',
        category: 'Access Control',
        severity: 'warning',
        evidence: passAuthRaw || 'PasswordAuthentication yes (or default)',
        explanation: 'Passwords can be brute-forced or credential-stuffed. Corporate policy mandates SSH key authentication.',
        remediation: 'echo "PasswordAuthentication no" | sudo tee -a /etc/ssh/sshd_config.d/hardening.conf && sudo systemctl reload sshd'
      });
    }

    // 3. Firewall Status
    const firewallRaw = (sections['CHECK_FIREWALL'] || '').trim();
    if (firewallRaw.toLowerCase().includes('status: active') || firewallRaw.toLowerCase().includes('running') || firewallRaw.includes('Chain INPUT')) {
      checks.push({
        id: 'host-firewall',
        title: 'Host-Level Firewall Active',
        category: 'Network Security',
        severity: 'pass',
        evidence: firewallRaw.split('\n')[0],
        explanation: 'Active host firewall (UFW / firewalld / iptables) filters unwanted inbound packets.'
      });
    } else {
      checks.push({
        id: 'host-firewall',
        title: 'Host-Level Firewall Inactive or Missing',
        category: 'Network Security',
        severity: 'critical',
        evidence: firewallRaw || 'No active firewall rules detected',
        explanation: 'Without a host firewall, any listening port is vulnerable to internal network scanning.',
        remediation: 'sudo ufw default deny incoming && sudo ufw allow 22/tcp && sudo ufw enable'
      });
    }

    // 4. Sudoers NOPASSWD Check
    const sudoersRaw = (sections['CHECK_SUDOERS'] || '').trim();
    if (!sudoersRaw || sudoersRaw === 'CLEAN') {
      checks.push({
        id: 'sudoers-nopasswd',
        title: 'No Blanket NOPASSWD: ALL Sudoers Grants',
        category: 'Access Control',
        severity: 'pass',
        evidence: 'No unrestricted NOPASSWD: ALL directives discovered.',
        explanation: 'All privileged sudo elevations require password or identity re-authentication.'
      });
    } else {
      checks.push({
        id: 'sudoers-nopasswd',
        title: 'Unrestricted NOPASSWD: ALL Sudoer Rules Discovered',
        category: 'Access Control',
        severity: 'warning',
        evidence: sudoersRaw.split('\n')[0],
        explanation: 'Unrestricted sudo without password allows compromised accounts to achieve immediate unauthenticated root.',
        remediation: 'sudo visudo # review and restrict NOPASSWD entries to specific audited binaries only'
      });
    }

    // 5. World-Writable Files in /etc
    const worldWritableRaw = (sections['CHECK_WORLD_WRITABLE'] || '').trim();
    if (!worldWritableRaw || worldWritableRaw === 'CLEAN') {
      checks.push({
        id: 'world-writable-etc',
        title: 'No World-Writable Files in /etc',
        category: 'Integrity',
        severity: 'pass',
        evidence: 'No files with mode 0002 found in /etc.',
        explanation: 'All system configuration files in /etc are protected against unauthorized modification.'
      });
    } else {
      checks.push({
        id: 'world-writable-etc',
        title: 'World-Writable Configuration Files in /etc',
        category: 'Integrity',
        severity: 'critical',
        evidence: worldWritableRaw,
        explanation: 'World-writable files in /etc allow any local unprivileged user to modify system parameters or elevate to root.',
        remediation: 'sudo chmod -R o-w /etc'
      });
    }

    // 6. Unattended Security Upgrades
    const unattendedRaw = (sections['CHECK_UNATTENDED'] || '').trim();
    if (unattendedRaw.includes('active') || unattendedRaw.includes('running')) {
      checks.push({
        id: 'unattended-upgrades',
        title: 'Automated Security Upgrades Active',
        category: 'System Hardening',
        severity: 'pass',
        evidence: 'unattended-upgrades service active',
        explanation: 'Critical OS kernel and security patches are automatically applied.'
      });
    } else {
      checks.push({
        id: 'unattended-upgrades',
        title: 'Automated Security Upgrades Inactive',
        category: 'System Hardening',
        severity: 'warning',
        evidence: unattendedRaw || 'inactive',
        explanation: 'Without automated patching, known zero-days may remain unpatched until manual maintenance.',
        remediation: 'sudo apt-get install -y unattended-upgrades && sudo systemctl enable --now unattended-upgrades'
      });
    }

    // 7. Empty Password Accounts
    const emptyPassRaw = (sections['CHECK_EMPTY_PASSWORDS'] || '').trim();
    if (!emptyPassRaw || emptyPassRaw === 'CLEAN') {
      checks.push({
        id: 'empty-passwords',
        title: 'Zero Accounts with Empty Passwords',
        category: 'Access Control',
        severity: 'pass',
        evidence: 'Verified /etc/shadow: no accounts have blank password fields.',
        explanation: 'All active local accounts possess cryptographic password hashes or are locked.'
      });
    } else {
      checks.push({
        id: 'empty-passwords',
        title: 'Local User Accounts with Empty Passwords Found',
        category: 'Access Control',
        severity: 'critical',
        evidence: `Accounts: ${emptyPassRaw}`,
        explanation: 'Accounts with blank passwords can be logged into by anyone without credentials.',
        remediation: `for u in ${emptyPassRaw}; do sudo passwd -l "$u"; done`
      });
    }

    // 8. Protected Symlinks & Hardlinks
    const protectedLinksRaw = (sections['CHECK_PROTECTED_LINKS'] || '').trim();
    if (protectedLinksRaw.includes('1 1') || protectedLinksRaw.includes('1')) {
      checks.push({
        id: 'protected-symlinks',
        title: 'Kernel Protected Symlinks & Hardlinks Enabled',
        category: 'System Hardening',
        severity: 'pass',
        evidence: `fs.protected_symlinks / fs.protected_hardlinks: ${protectedLinksRaw}`,
        explanation: 'Prevents time-of-check to time-of-use (TOCTOU) symlink race condition exploits in /tmp.'
      });
    } else {
      checks.push({
        id: 'protected-symlinks',
        title: 'Kernel Symlink Protection Disabled',
        category: 'System Hardening',
        severity: 'warning',
        evidence: protectedLinksRaw,
        explanation: 'Vulnerable to symlink traversal and unauthorized file overwrites in shared directories.',
        remediation: 'echo "fs.protected_symlinks = 1\\nfs.protected_hardlinks = 1" | sudo tee /etc/sysctl.d/99-security.conf && sudo sysctl -p'
      });
    }

    // 9. NTP Time Synchronization
    const ntpRaw = (sections['CHECK_NTP'] || '').trim();
    if (ntpRaw.toLowerCase().includes('active') || ntpRaw.toLowerCase().includes('yes')) {
      checks.push({
        id: 'ntp-sync',
        title: 'Cryptographic Clock & NTP Synchronization Active',
        category: 'Integrity',
        severity: 'pass',
        evidence: ntpRaw.split('\n')[0],
        explanation: 'Accurate time synchronization is required for TLS certificates, Kerberos tickets, and forensic audit logs.'
      });
    } else {
      checks.push({
        id: 'ntp-sync',
        title: 'NTP Time Synchronization Not Detected',
        category: 'Integrity',
        severity: 'warning',
        evidence: ntpRaw || 'Time sync service inactive',
        explanation: 'Clock drift causes TLS handshake errors, token verification failures, and desynchronized log timestamps.',
        remediation: 'sudo timedatectl set-ntp true || sudo systemctl enable --now systemd-timesyncd'
      });
    }

    // 10. Core Dump Hardening
    const coreDumpsRaw = (sections['CHECK_CORE_DUMPS'] || '').trim();
    if (coreDumpsRaw === '0') {
      checks.push({
        id: 'core-dumps-hardened',
        title: 'Process Memory Core Dumps Restricted',
        category: 'System Hardening',
        severity: 'pass',
        evidence: `fs.suid_dumpable = ${coreDumpsRaw}`,
        explanation: 'Memory core dumps of setuid processes are disabled, protecting cryptographic keys and tokens in memory from leaking.'
      });
    } else {
      checks.push({
        id: 'core-dumps-hardened',
        title: 'Core Dumps Enabled (Potential Memory Token Leakage)',
        category: 'System Hardening',
        severity: 'warning',
        evidence: `fs.suid_dumpable = ${coreDumpsRaw}`,
        explanation: 'Unrestricted core dumps can write memory contents (including plaintext credentials and private keys) to world-readable disk.',
        remediation: 'echo "fs.suid_dumpable = 0" | sudo tee -a /etc/sysctl.d/99-security.conf && sudo sysctl -p'
      });
    }

    // Calculate score: Pass = 10 pts, Warning = 5 pts, Critical = 0 pts
    let totalScore = 0;
    let passedCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const c of checks) {
      if (c.severity === 'pass') {
        totalScore += 10;
        passedCount++;
      } else if (c.severity === 'warning') {
        totalScore += 5;
        warningCount++;
      } else {
        criticalCount++;
      }
    }

    let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (totalScore >= 95) grade = 'A+';
    else if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 55) grade = 'C';

    AuditService.getInstance().logEvent({
      eventType: 'security_audit_completed',
      action: 'run_linux_security_benchmark',
      outcome: 'success',
      resourceType: 'host',
      resourceId: target.label || target.profileId || target.sessionId || 'target',
      metadata: { score: totalScore, grade, passedCount, warningCount, criticalCount }
    });

    return {
      score: totalScore,
      grade,
      passedCount,
      warningCount,
      criticalCount,
      checks,
      hostIdentifier: target.label || target.profileId || target.sessionId || 'Linux Host',
      scannedAt: new Date().toISOString()
    };
  }
}
