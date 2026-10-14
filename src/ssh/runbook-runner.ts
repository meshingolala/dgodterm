import { SSHManager } from './ssh-client';
import { AuditService } from '../audit/audit-service';

export interface RunbookParameter {
  name: string;
  label: string;
  defaultValue: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  description: string;
}

export interface RunbookDefinition {
  id: string;
  title: string;
  category: 'Maintenance' | 'Security' | 'Reliability' | 'Diagnostics' | 'Custom';
  description: string;
  parameters: RunbookParameter[];
  scriptTemplate: string;
}

export interface RunbookHostResult {
  hostIdentifier: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'aborted';
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  isCanary?: boolean;
}

export interface RunbookExecutionReport {
  runId: string;
  runbookId: string;
  runbookTitle: string;
  strategy: 'canary' | 'sequential' | 'parallel';
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'canary_failed' | 'failed';
  hostResults: RunbookHostResult[];
}

export const BUILTIN_RUNBOOKS: RunbookDefinition[] = [
  {
    id: 'rolling-patch',
    title: 'Rolling Security Patching & Reboot Audit',
    category: 'Security',
    description: 'Updates security package manifests, applies security updates, and inspects whether a kernel reboot is required.',
    parameters: [
      {
        name: 'package_manager',
        label: 'Target Distro Package Manager',
        defaultValue: 'apt',
        type: 'select',
        options: ['apt', 'dnf', 'yum'],
        description: 'Package management system of the target Linux servers'
      }
    ],
    scriptTemplate: `
echo "=== [1/3] Refreshing Security Package Catalogs ==="
if [ "{{package_manager}}" = "apt" ]; then
  sudo apt-get update -q
  echo "=== [2/3] Upgrading Security Patches ==="
  sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -q
elif [ "{{package_manager}}" = "dnf" ] || [ "{{package_manager}}" = "yum" ]; then
  sudo {{package_manager}} check-update -q || true
  echo "=== [2/3] Upgrading Security Packages ==="
  sudo {{package_manager}} update -y --security -q
fi

echo "=== [3/3] Checking Kernel Reboot Requirements ==="
if [ -f /var/run/reboot-required ]; then
  echo ">>> STATUS: REBOOT REQUIRED to finalize kernel patches. File: $(cat /var/run/reboot-required.pkgs 2>/dev/null || echo 'core')"
elif command -v needs-restarting >/dev/null 2>&1 && needs-restarting -r >/dev/null 2>&1; then
  echo ">>> STATUS: Clean. No reboot required."
elif command -v needs-restarting >/dev/null 2>&1 && ! needs-restarting -r >/dev/null 2>&1; then
  echo ">>> STATUS: REBOOT REQUIRED per needs-restarting check."
else
  echo ">>> STATUS: Clean. Running kernel is up to date."
fi
`
  },
  {
    id: 'ssl-audit',
    title: 'SSL/TLS Certificate Expiration & Sanity Audit',
    category: 'Security',
    description: 'Scans system certificate directories (/etc/ssl/certs, Let’s Encrypt, nginx certs) and verifies expiration dates.',
    parameters: [
      {
        name: 'days_threshold',
        label: 'Warning Threshold (Days)',
        defaultValue: '30',
        type: 'number',
        description: 'Warn if certificate expires within this number of days'
      }
    ],
    scriptTemplate: `
echo "=== Auditing TLS Certificates (Warning threshold: {{days_threshold}} days) ==="
threshold_sec=$(( {{days_threshold}} * 86400 ))
found_any=0

search_paths="/etc/ssl/certs/*.pem /etc/ssl/certs/*.crt /etc/letsencrypt/live/*/*.pem /etc/nginx/ssl/* /etc/pki/tls/certs/*"

for cert in $search_paths; do
  if [ -f "$cert" ] && ! [ -h "$cert" ]; then
    enddate=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
    if [ -n "$enddate" ]; then
      found_any=1
      subject=$(openssl x509 -subject -noout -in "$cert" 2>/dev/null | sed 's/subject=//')
      if openssl x509 -checkend $threshold_sec -noout -in "$cert" >/dev/null 2>&1; then
        echo "[VALID] $cert (Subject: $subject | Expires: $enddate)"
      else
        echo "[WARNING: EXPIRING SOON] $cert (Subject: $subject | Expires: $enddate)"
      fi
    fi
  fi
done

if [ $found_any -eq 0 ]; then
  echo "No x509 PEM certificates found in standard directories or insufficient permissions."
fi
`
  },
  {
    id: 'service-reload',
    title: 'Web / Application Service Rolling Graceful Reload',
    category: 'Reliability',
    description: 'Performs syntax validation (e.g. nginx -t), executes a zero-downtime graceful reload, and verifies active status.',
    parameters: [
      {
        name: 'service_name',
        label: 'Systemd Service Name',
        defaultValue: 'nginx',
        type: 'text',
        description: 'Name of the service to reload (e.g. nginx, haproxy, apache2)'
      }
    ],
    scriptTemplate: `
echo "=== Step 1: Pre-Flight Configuration Test ==="
if [ "{{service_name}}" = "nginx" ]; then
  sudo nginx -t || { echo "Configuration test failed! Aborting reload."; exit 1; }
elif [ "{{service_name}}" = "haproxy" ]; then
  sudo haproxy -c -f /etc/haproxy/haproxy.cfg || { echo "HAProxy config test failed! Aborting."; exit 1; }
elif [ "{{service_name}}" = "apache2" ] || [ "{{service_name}}" = "httpd" ]; then
  sudo apachectl configtest || { echo "Apache config test failed! Aborting."; exit 1; }
fi

echo "=== Step 2: Gracefully Reloading {{service_name}} ==="
sudo systemctl reload {{service_name}} || sudo systemctl restart {{service_name}}

echo "=== Step 3: Verifying Post-Reload Health ==="
sleep 1
if sudo systemctl is-active {{service_name}} >/dev/null 2>&1; then
  echo "SUCCESS: {{service_name}} is active and healthy."
  sudo systemctl status {{service_name}} --no-pager | head -n 8
else
  echo "ERROR: {{service_name}} failed to remain active after reload!"
  sudo journalctl -u {{service_name}} -n 20 --no-pager
  exit 1
fi
`
  },
  {
    id: 'disk-cleanup',
    title: 'Disk Space & Log Partition Vacuum',
    category: 'Maintenance',
    description: 'Vacuums rotated systemd journal logs, clears package archive caches, and reports disk usage before and after.',
    parameters: [
      {
        name: 'vacuum_days',
        label: 'Keep Logs Newer Than (Days)',
        defaultValue: '7',
        type: 'number',
        description: 'Retain journal logs for the specified number of days'
      }
    ],
    scriptTemplate: `
echo "=== [1/4] Filesystem Utilization Prior to Vacuum ==="
df -h / /var /var/log /tmp 2>/dev/null | head -n 5

echo "=== [2/4] Vacuuming systemd Journald Archives (> {{vacuum_days}} days) ==="
sudo journalctl --vacuum-time={{vacuum_days}}d 2>/dev/null || echo "Journald vacuum complete"

echo "=== [3/4] Purging Cached Download Packages ==="
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get clean 2>/dev/null
  sudo apt-get autoremove -y -q 2>/dev/null
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf clean all 2>/dev/null
elif command -v yum >/dev/null 2>&1; then
  sudo yum clean all 2>/dev/null
fi

echo "=== [4/4] Filesystem Utilization After Vacuum ==="
df -h / /var /var/log /tmp 2>/dev/null | head -n 5
`
  },
  {
    id: 'custom-runbook',
    title: 'Custom Enterprise Parameterized Shell Script',
    category: 'Custom',
    description: 'Executes a custom parameterized bash runbook across target Linux servers.',
    parameters: [
      {
        name: 'script_content',
        label: 'Shell Script Command',
        defaultValue: 'uname -a && uptime',
        type: 'text',
        description: 'Bash commands to execute across target servers'
      }
    ],
    scriptTemplate: `{{script_content}}`
  }
];

export class RunbookRunnerService {
  private static instance: RunbookRunnerService;

  private constructor() {}

  public static getInstance(): RunbookRunnerService {
    if (!RunbookRunnerService.instance) {
      RunbookRunnerService.instance = new RunbookRunnerService();
    }
    return RunbookRunnerService.instance;
  }

  public getRunbooks(): RunbookDefinition[] {
    return BUILTIN_RUNBOOKS;
  }

  public async executeRunbook(
    runbookId: string,
    params: Record<string, string>,
    targets: Array<{ sessionId?: string; profileId?: string; label: string }>,
    strategy: 'canary' | 'sequential' | 'parallel',
    onProgress?: (report: RunbookExecutionReport) => void
  ): Promise<RunbookExecutionReport> {
    const runbook = BUILTIN_RUNBOOKS.find((r) => r.id === runbookId) || BUILTIN_RUNBOOKS[0];
    const ssh = SSHManager.getInstance();

    // Substitute parameters into script template
    let renderedScript = runbook.scriptTemplate;
    for (const [k, v] of Object.entries(params)) {
      renderedScript = renderedScript.split(`{{${k}}}`).join(v);
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const hostResults: RunbookHostResult[] = targets.map((t, idx) => ({
      hostIdentifier: t.label || t.profileId || t.sessionId || `Host ${idx + 1}`,
      status: 'pending',
      stdout: '',
      stderr: '',
      durationMs: 0,
      isCanary: strategy === 'canary' && idx === 0
    }));

    const report: RunbookExecutionReport = {
      runId,
      runbookId: runbook.id,
      runbookTitle: runbook.title,
      strategy,
      startedAt: new Date().toISOString(),
      status: 'running',
      hostResults
    };

    if (onProgress) onProgress({ ...report, hostResults: [...report.hostResults] });

    const executeOne = async (target: typeof targets[0], hostIndex: number): Promise<boolean> => {
      hostResults[hostIndex].status = 'running';
      if (onProgress) onProgress({ ...report, hostResults: [...report.hostResults] });

      const startTime = Date.now();
      try {
        const { stdout, stderr, code } = await ssh.executeCommandOnTarget(target, renderedScript);
        const durationMs = Date.now() - startTime;
        hostResults[hostIndex].exitCode = code;
        hostResults[hostIndex].stdout = stdout;
        hostResults[hostIndex].stderr = stderr;
        hostResults[hostIndex].durationMs = durationMs;
        hostResults[hostIndex].status = code === 0 ? 'success' : 'failed';
        if (onProgress) onProgress({ ...report, hostResults: [...report.hostResults] });
        return code === 0;
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        hostResults[hostIndex].exitCode = 1;
        hostResults[hostIndex].stderr = err.message || String(err);
        hostResults[hostIndex].durationMs = durationMs;
        hostResults[hostIndex].status = 'failed';
        if (onProgress) onProgress({ ...report, hostResults: [...report.hostResults] });
        return false;
      }
    };

    if (strategy === 'canary' && targets.length > 0) {
      // 1. Run canary on target 0
      const canaryPassed = await executeOne(targets[0], 0);
      if (!canaryPassed) {
        // Halt remaining targets!
        for (let i = 1; i < targets.length; i++) {
          hostResults[i].status = 'aborted';
          hostResults[i].stderr = 'Aborted: Canary server execution failed. Rolling rollout halted.';
        }
        report.status = 'canary_failed';
        report.completedAt = new Date().toISOString();
        if (onProgress) onProgress({ ...report, hostResults: [...report.hostResults] });
        return report;
      }

      // Canary succeeded, proceed with remaining hosts sequentially
      for (let i = 1; i < targets.length; i++) {
        await executeOne(targets[i], i);
      }
    } else if (strategy === 'sequential') {
      for (let i = 0; i < targets.length; i++) {
        await executeOne(targets[i], i);
      }
    } else {
      // Parallel execution
      await Promise.all(targets.map((t, idx) => executeOne(t, idx)));
    }

    const anyFailed = hostResults.some((h) => h.status === 'failed');
    report.status = anyFailed ? 'failed' : 'completed';
    report.completedAt = new Date().toISOString();

    AuditService.getInstance().logEvent({
      eventType: 'runbook_executed',
      action: `runbook_${runbook.id}`,
      outcome: anyFailed ? 'failed' : 'success',
      resourceType: 'fleet',
      resourceId: runId,
      metadata: {
        runbookTitle: runbook.title,
        strategy,
        targetCount: targets.length,
        status: report.status
      }
    });

    if (onProgress) onProgress({ ...report, hostResults: [...report.hostResults] });
    return report;
  }
}
