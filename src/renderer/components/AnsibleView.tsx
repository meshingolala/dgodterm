import React, { useState, useEffect, useRef } from 'react';
import { TargetHost, AutomationRunManifest, ConnectionProfile, Folder, SavedPlaybook } from '../../domain/types';
import {
  Play,
  StopCircle,
  ShieldCheck,
  ShieldAlert,
  Server,
  FileCode,
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
  Download,
  Plus,
  Trash2,
  Folder as FolderIcon,
  Terminal,
  Search,
  Check,
  Copy,
  RotateCcw,
  Code,
  Sparkles,
  ListPlus,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowDown,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  FilePlus,
  Pencil,
  BookmarkPlus,
  Upload
} from 'lucide-react';
import { CustomSelect, CustomSelectOption } from './CustomSelect';
import { PlaybookModal } from './PlaybookModal';
import { copyTextToClipboard } from '../utils/clipboard-utils';

const ENVIRONMENT_OPTIONS: CustomSelectOption<'production' | 'staging' | 'development'>[] = [
  {
    value: 'development',
    label: 'Development (Sandbox / Homelab)',
    description: 'Unrestricted testing & homelab automation. No change tickets required.',
    badge: 'Sandbox',
    badgeVariant: 'emerald',
    dotColor: 'emerald',
  },
  {
    value: 'staging',
    label: 'Staging Cluster',
    description: 'Pre-production verification nodes. Safe canary execution.',
    badge: 'Pre-prod',
    badgeVariant: 'amber',
    dotColor: 'amber',
  },
  {
    value: 'production',
    label: 'Production (High Impact)',
    description: 'Critical infrastructure nodes. Controlled canary rollout with audit logs.',
    badge: 'High Impact',
    badgeVariant: 'red',
    dotColor: 'red',
  },
];

const PLAYBOOK_OPTIONS: CustomSelectOption<string>[] = [
  {
    value: 'playbooks/security_hardening.yml',
    label: 'security_hardening.yml',
    description: 'CIS Benchmark baseline security hardening and firewall policy enforcement.',
    badge: 'Security',
    badgeVariant: 'sky',
    icon: <FileCode className="w-3.5 h-3.5 text-sky-400" />
  },
  {
    value: 'playbooks/os_patching.yml',
    label: 'os_patching.yml',
    description: 'Kernel and CVE package updates across target fleet.',
    badge: 'Patching',
    badgeVariant: 'indigo',
    icon: <FileCode className="w-3.5 h-3.5 text-indigo-400" />
  },
  {
    value: 'playbooks/nginx_tls_rotate.yml',
    label: 'nginx_tls_rotate.yml',
    description: 'Automated TLS/SSL certificate reload and reverse proxy configuration.',
    badge: 'TLS/SSL',
    badgeVariant: 'emerald',
    icon: <FileCode className="w-3.5 h-3.5 text-emerald-400" />
  },
];

const SERIAL_OPTIONS: CustomSelectOption<number>[] = [
  {
    value: 1,
    label: '1 host at a time (Canary / Safest)',
    description: 'Sequential rollout with canary validation on each node.',
    badge: 'Safest',
    badgeVariant: 'emerald'
  },
  {
    value: 2,
    label: '2 hosts concurrent',
    description: 'Balanced rollout pace across dual canary nodes.',
    badge: 'Balanced',
    badgeVariant: 'sky'
  },
  {
    value: 5,
    label: '5 hosts concurrent',
    description: 'Rapid cluster-wide deployment in parallel batches.',
    badge: 'Fast',
    badgeVariant: 'indigo'
  },
  {
    value: 50,
    label: 'All hosts parallel',
    description: 'Simultaneous cluster-wide deployment across all targets.',
    badge: 'Parallel',
    badgeVariant: 'amber'
  }
];

const FAILURE_THRESHOLD_OPTIONS: CustomSelectOption<number>[] = [
  {
    value: 1,
    label: '1 failure (Halt immediately)',
    description: 'Emergency circuit breaker: trips and aborts after first failed host.',
    badge: 'Strict',
    badgeVariant: 'red'
  },
  {
    value: 2,
    label: '2 failures',
    description: 'Permits one transient failure before tripping circuit breaker.',
    badge: 'Tolerant',
    badgeVariant: 'amber'
  },
  {
    value: 999,
    label: 'Continue on failure (No tripwire)',
    description: 'Attempts execution on all targets regardless of individual errors.',
    badge: 'Ignore',
    badgeVariant: 'emerald'
  }
];

const SAMPLE_YAML_PLAYBOOK = `---
- name: Fleet Automation Task
  hosts: all
  become: yes
  tasks:
    - name: Gather OS and system telemetry
      setup:
        filter: "ansible_distribution*"

    - name: Check free disk space
      command: df -h /
      register: disk_space

    - name: Display system health
      debug:
        msg: "Host {{ inventory_hostname }} is online and ready."
`;

export const AnsibleView: React.FC = () => {
  // Saved profiles & folders from DgodTerm SQLite
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());

  // Active targets list for the execution
  const [targets, setTargets] = useState<TargetHost[]>([]);
  const [targetTab, setTargetTab] = useState<'saved' | 'custom' | 'paste'>('saved');
  const [searchTarget, setSearchTarget] = useState('');

  // Custom Host Form state
  const [customHostname, setCustomHostname] = useState('');
  const [customIp, setCustomIp] = useState('');
  const [customPort, setCustomPort] = useState(22);
  const [customUser, setCustomUser] = useState('root');
  const [customEnv, setCustomEnv] = useState<'production' | 'staging' | 'development'>('development');
  const [customGroup, setCustomGroup] = useState('manual');

  // Paste IP Inventory state
  const [pasteInput, setPasteInput] = useState('');

  // Execution Mode: Quick Shell Command vs Playbook
  const [execMode, setExecMode] = useState<'command' | 'playbook'>('command');
  const [adhocCommand, setAdhocCommand] = useState('uptime');
  const [playbookSource, setPlaybookSource] = useState<'preset' | 'custom'>('preset');
  const [playbookPath, setPlaybookPath] = useState('playbooks/security_hardening.yml');
  const [customPlaybookYaml, setCustomPlaybookYaml] = useState(SAMPLE_YAML_PLAYBOOK);

  // Saved Playbooks Library
  const [savedPlaybooks, setSavedPlaybooks] = useState<SavedPlaybook[]>([]);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<SavedPlaybook | null>(null);
  const [previewYamlOpen, setPreviewYamlOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Settings & Rollout
  const [environment, setEnvironment] = useState<'production' | 'staging' | 'development'>('development');
  const [limitFilter, setLimitFilter] = useState('');
  const [serialCount, setSerialCount] = useState(1);
  const [failureThreshold, setFailureThreshold] = useState(1);
  const [checkModeOnly, setCheckModeOnly] = useState(false);

  // Governance & Authorizations
  const [showGovernance, setShowGovernance] = useState(false);
  const [changeReference, setChangeReference] = useState('');
  const [requesterId, setRequesterId] = useState('lead-ops-user');
  const [peerApprover, setPeerApprover] = useState('');
  const [selfAuthorize, setSelfAuthorize] = useState(true);

  // Authentication & Sudo Elevation State
  const [vaultCredentials, setVaultCredentials] = useState<any[]>([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string>('');
  const [sshPassword, setSshPassword] = useState('');
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [elevateSudo, setElevateSudo] = useState(true);
  const [sudoSameAsSsh, setSudoSameAsSsh] = useState(true);
  const [sudoPassword, setSudoPassword] = useState('');
  const [showSudoPassword, setShowSudoPassword] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Active Policy & State
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [hostStatus, setHostStatus] = useState<
    Record<
      string,
      {
        status: 'running' | 'success' | 'failed' | 'changed' | 'pending';
        currentTask?: string;
        taskProgress?: string;
      }
    >
  >({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [completedManifest, setCompletedManifest] = useState<AutomationRunManifest | null>(null);
  const [errorBanner, setErrorBanner] = useState('');

  // Live Execution Progress State
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentTaskInfo, setCurrentTaskInfo] = useState<{
    index: number;
    total: number;
    name: string;
    module?: string;
  } | null>(null);
  const [liveRecap, setLiveRecap] = useState<{ ok: number; changed: number; failed: number }>({
    ok: 0,
    changed: 0,
    failed: 0
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Stopwatch timer when executing
  useEffect(() => {
    let timer: any = null;
    if (executing) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((sec) => sec + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [executing]);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    loadInitialData();

    const unsubscribe = (window as any).dgodterm?.onAutomationEvent?.((ev: any) => {
      const splitMsg = (msg: string) => (msg ? msg.split('\n') : []);

      if (ev.type === 'started') {
        setProgressPercent(2);
        setLogs((prev) => [...prev, `[INIT] ${ev.message}`]);
      } else if (ev.type === 'play_started') {
        setProgressPercent(4);
        setLogs((prev) => [...prev, ...splitMsg(ev.message)]);
      } else if (ev.type === 'task_started') {
        setCurrentTaskInfo({
          index: ev.taskIndex || 1,
          total: ev.totalTasks || 1,
          name: ev.taskName || '',
          module: ev.module
        });
        if (typeof ev.progressPercent === 'number') {
          setProgressPercent(ev.progressPercent);
        }
        setLogs((prev) => [...prev, ...splitMsg(ev.message)]);
        if (ev.hostId) {
          setHostStatus((prev) => ({
            ...prev,
            [ev.hostId]: {
              status: 'running',
              currentTask: ev.taskName,
              taskProgress: `${ev.taskIndex}/${ev.totalTasks}`
            }
          }));
        }
      } else if (ev.type === 'task_finished') {
        if (typeof ev.progressPercent === 'number') {
          setProgressPercent(ev.progressPercent);
        }
        if (ev.recapStats) {
          setLiveRecap({
            ok: ev.recapStats.ok || 0,
            changed: ev.recapStats.changed || 0,
            failed: ev.recapStats.failed || 0
          });
        }
        setLogs((prev) => [...prev, ...splitMsg(ev.message)]);
        if (ev.hostId) {
          const st = ev.status === 'ok' ? 'running' : (ev.status || 'running');
          setHostStatus((prev) => ({
            ...prev,
            [ev.hostId]: {
              status: st === 'ok' ? 'running' : (st as any),
              currentTask: ev.taskName,
              taskProgress: `${ev.taskIndex}/${ev.totalTasks}`
            }
          }));
        }
      } else if (ev.type === 'host_started') {
        if (ev.hostId) {
          setHostStatus((prev) => ({
            ...prev,
            [ev.hostId]: { status: 'running', currentTask: 'Executing tasks...' }
          }));
        }
      } else if (ev.type === 'host_finished') {
        if (ev.hostId && ev.status) {
          setHostStatus((prev) => ({
            ...prev,
            [ev.hostId]: { status: ev.status, currentTask: 'Completed' }
          }));
        }
      } else if (ev.type === 'cancelled' || ev.type === 'failed') {
        setLogs((prev) => [...prev, `[HALT] ${ev.message}`]);
        setExecuting(false);
      } else if (ev.type === 'completed') {
        setProgressPercent(100);
        setLogs((prev) => [...prev, `[FINISHED] ${ev.message}`]);
        setExecuting(false);
        if (ev.manifest) {
          setCompletedManifest(ev.manifest);
        }
      } else if (ev.type === 'log') {
        setLogs((prev) => [...prev, ...splitMsg(ev.message)]);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const pol = await (window as any).dgodterm.getActivePolicy?.();
      if (pol) setActivePolicy(pol);

      const p: ConnectionProfile[] = (await (window as any).dgodterm.getProfiles?.()) || [];
      const f: Folder[] = (await (window as any).dgodterm.getFolders?.()) || [];
      const v: any[] = (await (window as any).dgodterm.getVaultCredentials?.()) || [];
      const pbs: SavedPlaybook[] = (await (window as any).dgodterm.getPlaybooks?.()) || [];
      setProfiles(p);
      setFolders(f);
      setVaultCredentials(v);
      setSavedPlaybooks(pbs);
      if (pbs.length > 0 && !pbs.some((pb) => pb.filename === playbookPath)) {
        setPlaybookPath(pbs[0].filename);
      }
      if (v.length > 0) {
        setSelectedVaultId(v[0].id);
        if (v[0].password) setSshPassword(v[0].password);
      }

      // Auto-select all saved profiles into targets
      if (p.length > 0) {
        const initialSelected = new Set(p.map((prof) => prof.id));
        setSelectedProfileIds(initialSelected);

        const initialTargets = p.map((prof) => profileToTarget(prof, f));
        setTargets(initialTargets);
      } else {
        // Fallback default targets
        const defaultTargets: TargetHost[] = [
          {
            hostId: 'srv-prod-web-01',
            hostname: 'web-01.prod.internal',
            displayName: 'Web Server 01 (Prod)',
            environment: 'production',
            ipAddress: '10.0.1.10',
            groups: ['web', 'production']
          },
          {
            hostId: 'srv-stage-web-01',
            hostname: 'web-01.stage.internal',
            displayName: 'Staging Frontend Node',
            environment: 'staging',
            ipAddress: '10.10.1.10',
            groups: ['web', 'staging']
          },
          {
            hostId: 'srv-dev-sandbox-01',
            hostname: 'sandbox.dev.internal',
            displayName: 'Dev Sandbox Node',
            environment: 'development',
            ipAddress: '10.20.1.5',
            groups: ['development']
          }
        ];
        setTargets(defaultTargets);
      }
    } catch (e) {
      console.error('Failed to load initial automation targets:', e);
    }
  };

  const profileToTarget = (prof: ConnectionProfile, folderList: Folder[]): TargetHost => {
    const parentFolder = folderList.find((f) => f.id === prof.folder_id);
    const folderName = parentFolder?.name || 'Unassigned';
    const tags = Array.isArray(prof.tags) ? prof.tags : [];

    const isProd =
      tags.some((t) => (t || '').toLowerCase().includes('prod')) ||
      folderName.toLowerCase().includes('prod');
    const isStage =
      tags.some((t) => (t || '').toLowerCase().includes('stage')) ||
      folderName.toLowerCase().includes('stage');

    const env: 'production' | 'staging' | 'development' = isProd
      ? 'production'
      : isStage
      ? 'staging'
      : 'development';

    return {
      hostId: prof.id,
      hostname: prof.hostname,
      displayName: prof.display_name,
      environment: env,
      ipAddress: prof.hostname,
      port: prof.port || 22,
      username: prof.username,
      groups: [folderName, ...tags]
    };
  };

  // Toggle single profile selection
  const handleToggleProfile = (prof: ConnectionProfile) => {
    const next = new Set(selectedProfileIds);
    if (next.has(prof.id)) {
      next.delete(prof.id);
      setTargets((prev) => prev.filter((t) => t.hostId !== prof.id));
    } else {
      next.add(prof.id);
      const newTarget = profileToTarget(prof, folders);
      setTargets((prev) => [...prev, newTarget]);
    }
    setSelectedProfileIds(next);
  };

  // Toggle all profiles in a folder
  const handleToggleFolder = (folderId: string | null) => {
    const folderProfs = profiles.filter((p) => p.folder_id === folderId);
    if (folderProfs.length === 0) return;

    const allChecked = folderProfs.every((p) => selectedProfileIds.has(p.id));
    const next = new Set(selectedProfileIds);

    if (allChecked) {
      // Uncheck all in this folder
      folderProfs.forEach((p) => next.delete(p.id));
      const idsToRemove = new Set(folderProfs.map((p) => p.id));
      setTargets((prev) => prev.filter((t) => !idsToRemove.has(t.hostId)));
    } else {
      // Check all in this folder
      folderProfs.forEach((p) => next.add(p.id));
      const existingIds = new Set(targets.map((t) => t.hostId));
      const toAdd = folderProfs
        .filter((p) => !existingIds.has(p.id))
        .map((p) => profileToTarget(p, folders));
      setTargets((prev) => [...prev, ...toAdd]);
    }
    setSelectedProfileIds(next);
  };

  // Select all saved profiles
  const handleSelectAllProfiles = () => {
    const allIds = new Set(profiles.map((p) => p.id));
    setSelectedProfileIds(allIds);
    setTargets(profiles.map((p) => profileToTarget(p, folders)));
  };

  // Deselect all
  const handleDeselectAllProfiles = () => {
    setSelectedProfileIds(new Set());
    setTargets([]);
  };

  // Add custom host
  const handleAddCustomHost = () => {
    if (!customHostname.trim()) {
      setErrorBanner('Please enter a valid Hostname or IP address.');
      return;
    }
    setErrorBanner('');

    const newTarget: TargetHost = {
      hostId: 'custom-' + Math.random().toString(36).substring(2, 8),
      hostname: customHostname.trim(),
      displayName: customHostname.trim(),
      environment: customEnv,
      ipAddress: customIp.trim() || customHostname.trim(),
      port: customPort,
      username: customUser.trim() || 'root',
      groups: [customGroup.trim() || 'manual']
    };

    setTargets((prev) => [...prev, newTarget]);
    setCustomHostname('');
    setCustomIp('');
  };

  // Parse and paste inventory
  const handleParsePasteInventory = () => {
    if (!pasteInput.trim()) return;

    const lines = pasteInput.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('['));
    const parsed: TargetHost[] = [];

    lines.forEach((line, idx) => {
      // Format could be "192.168.1.10" or "node01 ansible_host=10.0.0.1 ansible_user=root"
      const parts = line.split(/\s+/);
      const host = parts[0];
      if (host) {
        parsed.push({
          hostId: 'pasted-' + idx + '-' + Math.random().toString(36).substring(2, 6),
          hostname: host,
          displayName: host,
          environment: environment,
          ipAddress: host,
          port: 22,
          username: 'root',
          groups: ['pasted']
        });
      }
    });

    if (parsed.length > 0) {
      setTargets((prev) => [...prev, ...parsed]);
      setPasteInput('');
      setTargetTab('saved');
    }
  };

  // Remove target from active table
  const handleRemoveTarget = (hostId: string) => {
    setTargets((prev) => prev.filter((t) => t.hostId !== hostId));
    if (selectedProfileIds.has(hostId)) {
      const next = new Set(selectedProfileIds);
      next.delete(hostId);
      setSelectedProfileIds(next);
    }
  };

  // Execution Trigger
  const handleStartRun = async (overrideCreds?: { password?: string; becomePassword?: string }) => {
    setErrorBanner('');

    if (targets.length === 0) {
      setErrorBanner('Please select or add at least one Target Host before executing.');
      return;
    }

    if (execMode === 'command' && !adhocCommand.trim()) {
      setErrorBanner('Please enter an ad-hoc command to execute across the fleet.');
      return;
    }

    if (execMode === 'playbook' && playbookSource === 'custom' && !customPlaybookYaml.trim()) {
      setErrorBanner('Please enter valid YAML playbook content.');
      return;
    }

    // Check if targets contain real (non-mock) hosts and no credentials were configured
    const hasRealTargets = targets.some(
      (t) =>
        !t.hostname.toLowerCase().endsWith('.internal') &&
        !t.hostId.startsWith('srv-dev-') &&
        !t.hostId.startsWith('srv-prod-') &&
        !t.hostId.startsWith('srv-stage-')
    );

    if (hasRealTargets && !overrideCreds && !sshPassword && !selectedVaultId) {
      setShowAuthModal(true);
      return;
    }

    setProgressPercent(0);
    setCurrentTaskInfo(null);
    setLiveRecap({ ok: 0, changed: 0, failed: 0 });
    setElapsedSeconds(0);
    setLogs([]);
    setHostStatus({});
    setCompletedManifest(null);

    // Build approvals
    const effectiveChangeRef = changeReference.trim() || `CR-RUN-${Date.now().toString(36).toUpperCase()}`;
    const approvals = [
      {
        actor: peerApprover.trim() || 'operator-admin',
        approved_at: new Date().toISOString(),
        rationale: 'Direct operator self-authorization via Fleet Hub',
        scope: `${environment}: ${execMode === 'command' ? adhocCommand : playbookPath}`
      }
    ];

    const vaultMatch = vaultCredentials.find((v) => v.id === selectedVaultId);
    const effPass = overrideCreds?.password || sshPassword || vaultMatch?.password;
    const effBecome = overrideCreds?.becomePassword || (sudoSameAsSsh ? effPass : sudoPassword);

    const selectedPb = savedPlaybooks.find((p) => p.filename === playbookPath || p.id === playbookPath);

    const req: any = {
      projectId: 'proj-fleet-mgmt-01',
      projectName: 'Infrastructure Fleet Management',
      playbookPath: execMode === 'command' ? 'ad-hoc-command.yml' : playbookPath,
      playbookContent:
        execMode === 'playbook'
          ? playbookSource === 'custom'
            ? customPlaybookYaml
            : selectedPb?.content
          : undefined,
      command: execMode === 'command' ? adhocCommand.trim() : undefined,
      customTargets: targets,
      inventorySource: 'custom-fleet-inventory',
      environment,
      limit: limitFilter || null,
      changeReference: effectiveChangeRef,
      requesterId: requesterId.trim() || 'lead-ops-user',
      approvals,
      become: elevateSudo,
      defaultPassword: effPass || undefined,
      becomePassword: effBecome || undefined,
      rolloutConfig: {
        serial: serialCount,
        canaryCount: 0,
        failureThreshold,
        maxRunMinutes: 30
      }
    };

    setExecuting(true);
    try {
      const manifest = await (window as any).dgodterm.executeAutomation(req);
      if (manifest.policy_decision === 'deny') {
        setErrorBanner(`Policy Denied: Execution blocked.`);
        setExecuting(false);
      } else {
        setActiveRunId(manifest.run_id);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Execution error');
      setExecuting(false);
    }
  };

  const handleCancelRun = () => {
    if (activeRunId) {
      (window as any).dgodterm.cancelAutomation(activeRunId);
    }
  };

  const handleSavePlaybook = async (pb: Partial<SavedPlaybook> & { name: string; content: string }) => {
    try {
      const saved = await (window as any).dgodterm.savePlaybook?.(pb);
      const updated: SavedPlaybook[] = (await (window as any).dgodterm.getPlaybooks?.()) || [];
      setSavedPlaybooks(updated);
      if (saved?.filename) {
        setPlaybookPath(saved.filename);
      }
      setShowPlaybookModal(false);
      setEditingPlaybook(null);
    } catch (err: any) {
      console.error('Failed to save playbook:', err);
      throw err;
    }
  };

  const handleDeletePlaybook = async (id: string) => {
    try {
      await (window as any).dgodterm.deletePlaybook?.(id);
      const updated: SavedPlaybook[] = (await (window as any).dgodterm.getPlaybooks?.()) || [];
      setSavedPlaybooks(updated);
      if (updated.length > 0) {
        setPlaybookPath(updated[0].filename);
      }
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error('Failed to delete playbook:', err);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        const autoName = file.name.replace(/\.(ya?ml)$/i, '').replace(/[_-]+/g, ' ');
        const formattedName = autoName.charAt(0).toUpperCase() + autoName.slice(1);
        try {
          const saved = await (window as any).dgodterm.savePlaybook?.({
            name: formattedName,
            filename: file.name,
            description: `Imported local playbook: ${file.name}`,
            badge: 'IMPORTED',
            badge_variant: 'indigo',
            content: text,
            is_builtin: false
          });
          const updated: SavedPlaybook[] = (await (window as any).dgodterm.getPlaybooks?.()) || [];
          setSavedPlaybooks(updated);
          if (saved?.filename) {
            setPlaybookPath(saved.filename);
          }
        } catch (err) {
          console.error('Failed to import playbook file:', err);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyLogs = async () => {
    if (logs.length === 0) return;
    try {
      const fullText = logs.join('\n');
      const ok = await copyTextToClipboard(fullText);
      if (ok) {
        setCopiedLogs(true);
        setTimeout(() => setCopiedLogs(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy console logs:', err);
    }
  };

  // Filtered saved profiles
  const filteredProfiles = profiles.filter((p) => {
    const s = searchTarget.toLowerCase();
    const tags = Array.isArray(p.tags) ? p.tags : [];
    return (
      (p.display_name || '').toLowerCase().includes(s) ||
      (p.hostname || '').toLowerCase().includes(s) ||
      (p.username || '').toLowerCase().includes(s) ||
      tags.some((t) => (t || '').toLowerCase().includes(s))
    );
  });

  // Dynamic playbooks options
  const currentSelectedPb = savedPlaybooks.find(
    (p) => p.filename === playbookPath || p.id === playbookPath
  );

  const dynamicPlaybookOptions: CustomSelectOption<string>[] = (
    savedPlaybooks.length > 0 ? savedPlaybooks : (PLAYBOOK_OPTIONS as any[])
  ).map((pb: any) => ({
    value: pb.filename || pb.value,
    label: pb.filename || pb.label,
    description: pb.description || pb.name,
    badge: pb.badge || (pb.is_builtin ? 'BUILT-IN' : 'CUSTOM'),
    badgeVariant: (pb.badge_variant as any) || pb.badgeVariant || (pb.is_builtin ? 'indigo' : 'emerald'),
    dotColor: pb.is_builtin ? 'indigo' : 'emerald',
    icon: <FileCode className={`w-3.5 h-3.5 ${pb.is_builtin ? 'text-sky-400' : 'text-emerald-400'}`} />
  }));

  return (
    <div className="flex flex-col h-full w-full bg-[#090d16] text-slate-200 overflow-hidden">
      {/* Top Banner Header */}
      <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Controlled Ansible & Fleet Automation
          </h2>
          <p className="text-xs text-slate-400">
            Execute batch playbooks, shell scripts, and ad-hoc commands across your server fleet with canary rollout safety.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs">
            <Server className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-300">Fleet Targets:</span>
            <span className="font-bold font-mono text-emerald-400">{targets.length} hosts</span>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {activePolicy?.name || 'Default Strict Policy'}
          </span>
        </div>
      </div>

      {errorBanner && (
        <div className="mx-4 mt-3 p-3 bg-red-950/70 border border-red-500/60 rounded-xl text-xs text-red-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner('')} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Column (5 cols): Target Selection & Task Configuration */}
        <div className="col-span-5 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Card 1: TARGET SELECTION */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                1. Select Target Hosts ({targets.length})
              </div>

              {/* Source Switcher Tabs */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                <button
                  onClick={() => setTargetTab('saved')}
                  className={`px-2 py-1 rounded-md font-medium transition ${
                    targetTab === 'saved' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Saved Sessions
                </button>
                <button
                  onClick={() => setTargetTab('custom')}
                  className={`px-2 py-1 rounded-md font-medium transition ${
                    targetTab === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  + Add Host
                </button>
                <button
                  onClick={() => setTargetTab('paste')}
                  className={`px-2 py-1 rounded-md font-medium transition ${
                    targetTab === 'paste' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Paste IPs
                </button>
              </div>
            </div>

            {/* TAB A: Saved Sessions / Folders */}
            {targetTab === 'saved' && (
              <div className="space-y-2">
                {/* Search & Bulk Select */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter saved sessions..."
                      value={searchTarget}
                      onChange={(e) => setSearchTarget(e.target.value)}
                      className="bg-transparent outline-none w-full text-xs"
                    />
                  </div>
                  <button
                    onClick={handleSelectAllProfiles}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
                  >
                    All
                  </button>
                  <button
                    onClick={handleDeselectAllProfiles}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium"
                  >
                    Clear
                  </button>
                </div>

                {/* Tree List of Folders & Profiles */}
                <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/70 p-2 space-y-2 text-xs">
                  {folders.map((folder) => {
                    const folderProfs = filteredProfiles.filter((p) => p.folder_id === folder.id);
                    if (folderProfs.length === 0) return null;
                    const allChecked = folderProfs.every((p) => selectedProfileIds.has(p.id));
                    const someChecked = folderProfs.some((p) => selectedProfileIds.has(p.id));

                    return (
                      <div key={folder.id} className="space-y-1">
                        <div
                          onClick={() => handleToggleFolder(folder.id)}
                          className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-900 cursor-pointer text-slate-300 font-semibold"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => {
                                if (el) el.indeterminate = someChecked && !allChecked;
                              }}
                              onChange={() => handleToggleFolder(folder.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                            />
                            <FolderIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{folder.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {folderProfs.filter((p) => selectedProfileIds.has(p.id)).length}/{folderProfs.length}
                          </span>
                        </div>

                        {/* Profiles in Folder */}
                        <div className="pl-6 space-y-1">
                          {folderProfs.map((prof) => {
                            const isChecked = selectedProfileIds.has(prof.id);
                            return (
                              <div
                                key={prof.id}
                                onClick={() => handleToggleProfile(prof)}
                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition ${
                                  isChecked ? 'bg-indigo-950/40 text-slate-100' : 'hover:bg-slate-900/60 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleProfile(prof)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                                  />
                                  <Terminal className="w-3 h-3 text-sky-400 shrink-0" />
                                  <span className="truncate font-medium">{prof.display_name}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono truncate ml-2">
                                  {prof.username}@{prof.hostname}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Unassigned Profiles */}
                  {(() => {
                    const rootProfs = filteredProfiles.filter((p) => !p.folder_id);
                    if (rootProfs.length === 0) return null;
                    const allChecked = rootProfs.every((p) => selectedProfileIds.has(p.id));

                    return (
                      <div className="space-y-1 pt-1 border-t border-slate-900">
                        <div
                          onClick={() => handleToggleFolder(null)}
                          className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-900 cursor-pointer text-slate-300 font-semibold"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={() => handleToggleFolder(null)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                            />
                            <Server className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Root (No Folder)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {rootProfs.filter((p) => selectedProfileIds.has(p.id)).length}/{rootProfs.length}
                          </span>
                        </div>

                        <div className="pl-6 space-y-1">
                          {rootProfs.map((prof) => {
                            const isChecked = selectedProfileIds.has(prof.id);
                            return (
                              <div
                                key={prof.id}
                                onClick={() => handleToggleProfile(prof)}
                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition ${
                                  isChecked ? 'bg-indigo-950/40 text-slate-100' : 'hover:bg-slate-900/60 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleProfile(prof)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                                  />
                                  <Terminal className="w-3 h-3 text-sky-400 shrink-0" />
                                  <span className="truncate font-medium">{prof.display_name}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono truncate ml-2">
                                  {prof.username}@{prof.hostname}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB B: Add Custom Host */}
            {targetTab === 'custom' && (
              <div className="space-y-2.5 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Hostname or IP *</label>
                    <input
                      type="text"
                      placeholder="192.168.1.150 or host.lan"
                      value={customHostname}
                      onChange={(e) => setCustomHostname(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">SSH Port</label>
                    <input
                      type="number"
                      value={customPort}
                      onChange={(e) => setCustomPort(Number(e.target.value) || 22)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Username</label>
                    <input
                      type="text"
                      placeholder="root"
                      value={customUser}
                      onChange={(e) => setCustomUser(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Environment</label>
                    <select
                      value={customEnv}
                      onChange={(e) => setCustomEnv(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 text-xs"
                    >
                      <option value="development">Development</option>
                      <option value="staging">Staging</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Group / Tag</label>
                    <input
                      type="text"
                      placeholder="web, db"
                      value={customGroup}
                      onChange={(e) => setCustomGroup(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddCustomHost}
                  className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition text-xs shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Target Fleet
                </button>
              </div>
            )}

            {/* TAB C: Paste Inventory */}
            {targetTab === 'paste' && (
              <div className="space-y-2 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800">
                <label className="text-[11px] text-slate-400 block">
                  Paste IPs or hostnames (one per line, or hosts.ini snippet):
                </label>
                <textarea
                  rows={4}
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder="192.168.1.10&#10;192.168.1.11&#10;10.0.0.5 ansible_user=ubuntu"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-xs text-slate-200 outline-none"
                />
                <button
                  onClick={handleParsePasteInventory}
                  className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 transition text-xs shadow"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  Parse & Add Targets
                </button>
              </div>
            )}
          </div>

          {/* Card 2: TASK & COMMAND CONFIGURATION */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileCode className="w-4 h-4 text-sky-400" />
                2. Execution Command or Playbook
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                <button
                  onClick={() => setExecMode('command')}
                  className={`px-2 py-1 rounded-md font-medium transition ${
                    execMode === 'command' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ Shell Command
                </button>
                <button
                  onClick={() => setExecMode('playbook')}
                  className={`px-2 py-1 rounded-md font-medium transition ${
                    execMode === 'playbook' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📜 Ansible Playbook
                </button>
              </div>
            </div>

            {/* Sub-mode 1: Ad-hoc shell command */}
            {execMode === 'command' && (
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Ad-Hoc Shell Command *</label>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 focus-within:border-sky-500 font-mono">
                    <span className="text-slate-500">$</span>
                    <input
                      type="text"
                      value={adhocCommand}
                      onChange={(e) => setAdhocCommand(e.target.value)}
                      placeholder="e.g. uptime, df -h, systemctl restart nginx, docker ps"
                      className="bg-transparent text-xs text-sky-300 outline-none w-full font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 font-semibold self-center">Presets:</span>
                  {[
                    { label: 'Uptime', cmd: 'uptime' },
                    { label: 'Disk (df -h)', cmd: 'df -h /' },
                    { label: 'Memory (free -m)', cmd: 'free -m' },
                    { label: 'OS Info', cmd: 'uname -a' },
                    { label: 'Docker ps', cmd: 'docker ps' },
                    { label: 'Updates', cmd: 'apt-get update -y' }
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setAdhocCommand(p.cmd)}
                      className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700/60"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-mode 2: Ansible Playbook */}
            {execMode === 'playbook' && (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <label className="text-slate-400 block">Playbook Source:</label>
                  <button
                    onClick={() => setPlaybookSource('preset')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      playbookSource === 'preset' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Built-in Playbook
                  </button>
                  <button
                    onClick={() => setPlaybookSource('custom')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      playbookSource === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    Custom YAML
                  </button>
                </div>

                {playbookSource === 'preset' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-medium block">
                        Select Playbook *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlaybook(null);
                            setShowPlaybookModal(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shadow-sm transition"
                          title="Add a new custom playbook to your library"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Playbook</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => importFileInputRef.current?.click()}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] border border-slate-700 transition"
                          title="Import a YAML playbook file from your computer"
                        >
                          <Upload className="w-3 h-3 text-sky-400" />
                          <span>Import .yml</span>
                        </button>
                        <input
                          ref={importFileInputRef}
                          type="file"
                          accept=".yml,.yaml"
                          onChange={handleImportFile}
                          className="hidden"
                        />
                      </div>
                    </div>

                    <CustomSelect
                      value={playbookPath}
                      onChange={(val) => {
                        setPlaybookPath(val);
                        setPreviewYamlOpen(false);
                      }}
                      options={dynamicPlaybookOptions}
                    />

                    {/* Selected Playbook Info & Actions Card */}
                    {currentSelectedPb && (
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">
                                {currentSelectedPb.name}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold uppercase ${
                                  currentSelectedPb.is_builtin
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {currentSelectedPb.is_builtin ? 'BUILT-IN' : 'CUSTOM'}
                              </span>
                            </div>
                            {currentSelectedPb.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                {currentSelectedPb.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewYamlOpen(!previewYamlOpen)}
                              className={`p-1 rounded border transition ${
                                previewYamlOpen
                                  ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300'
                                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-400'
                              }`}
                              title={previewYamlOpen ? 'Hide YAML' : 'Preview YAML Directives'}
                            >
                              {previewYamlOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>

                            {!currentSelectedPb.is_builtin ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPlaybook(currentSelectedPb);
                                    setShowPlaybookModal(true);
                                  }}
                                  className="p-1 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                                  title="Edit Playbook"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {deleteConfirmId === currentSelectedPb.id ? (
                                  <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/50 rounded px-1.5 py-0.5">
                                    <span className="text-[10px] text-red-300">Delete?</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePlaybook(currentSelectedPb.id)}
                                      className="text-[10px] text-red-400 font-bold hover:underline"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="text-[10px] text-slate-400 hover:text-white ml-0.5"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(currentSelectedPb.id)}
                                    className="p-1 rounded bg-slate-900 border border-slate-700 hover:bg-red-950/60 hover:border-red-500/50 text-slate-400 hover:text-red-400 transition"
                                    title="Delete Playbook"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPlaybook(null);
                                  setShowPlaybookModal(true);
                                }}
                                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:bg-slate-800 text-indigo-300 text-[10px] font-medium transition"
                                title="Duplicate as Custom Playbook"
                              >
                                Duplicate
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible YAML Preview */}
                        {previewYamlOpen && currentSelectedPb.content && (
                          <div className="pt-2 border-t border-slate-900 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400">
                              <span className="font-mono">YAML Directives:</span>
                              <button
                                type="button"
                                onClick={() => copyTextToClipboard(currentSelectedPb.content)}
                                className="flex items-center gap-1 hover:text-slate-200 transition"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy Code</span>
                              </button>
                            </div>
                            <pre className="max-h-48 overflow-y-auto p-2 bg-[#060910] border border-slate-800/80 rounded font-mono text-[10.5px] text-emerald-300/90 leading-relaxed whitespace-pre-wrap">
                              {currentSelectedPb.content}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 block">Playbook YAML Content:</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlaybook(null);
                            setShowPlaybookModal(true);
                          }}
                          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition font-medium"
                          title="Save this YAML as a permanent playbook in your library"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Save to Library</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomPlaybookYaml(SAMPLE_YAML_PLAYBOOK)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 hover:underline"
                        >
                          Reset Template
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={6}
                      value={customPlaybookYaml}
                      onChange={(e) => setCustomPlaybookYaml(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-[11px] text-emerald-300 outline-none leading-relaxed"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Rollout & Canary Settings */}
            <div className="grid grid-cols-2 gap-3 pt-1 text-xs border-t border-slate-800/80">
              <div>
                <label className="text-slate-400 block mb-1">Rollout Concurrency</label>
                <CustomSelect
                  value={serialCount}
                  onChange={(val) => setSerialCount(Number(val))}
                  options={SERIAL_OPTIONS}
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Failure Tripwire</label>
                <CustomSelect
                  value={failureThreshold}
                  onChange={(val) => setFailureThreshold(Number(val))}
                  options={FAILURE_THRESHOLD_OPTIONS}
                />
              </div>
            </div>

            {/* Environment Selection */}
            <div className="pt-1 text-xs">
              <label className="text-slate-400 block mb-1">Fleet Environment</label>
              <CustomSelect
                value={environment}
                onChange={(val) => setEnvironment(val as any)}
                options={ENVIRONMENT_OPTIONS}
              />
            </div>

            {/* Authentication & Sudo Elevation Card */}
            <div className="border-t border-slate-800/80 pt-2 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-medium flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  Target SSH & Sudo Privileges
                </label>
                {vaultCredentials.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {vaultCredentials.length} Vault key(s)
                  </span>
                )}
              </div>

              <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs">
                {vaultCredentials.length > 0 && (
                  <div>
                    <label className="text-slate-400 block mb-0.5 text-[11px]">Password Vault Credential:</label>
                    <select
                      value={selectedVaultId}
                      onChange={(e) => {
                        setSelectedVaultId(e.target.value);
                        if (e.target.value) {
                          const match = vaultCredentials.find((v) => v.id === e.target.value);
                          if (match?.password) setSshPassword(match.password);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                    >
                      <option value="">Auto (Saved Profile / Vault)</option>
                      {vaultCredentials.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.title} ({v.username})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-slate-400 text-[11px]">SSH Password (Optional override):</label>
                    {sshPassword && (
                      <span className="text-[10px] text-emerald-400 font-mono">Configured</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showSshPassword ? 'text' : 'password'}
                      placeholder="Enter target SSH password..."
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 pr-7 text-slate-200 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSshPassword(!showSshPassword)}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-200"
                    >
                      {showSshPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 text-[11px]">
                    <input
                      type="checkbox"
                      checked={elevateSudo}
                      onChange={(e) => setElevateSudo(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500"
                    />
                    <span>Elevate with sudo (become)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 text-[11px]">
                    <input
                      type="checkbox"
                      checked={sudoSameAsSsh}
                      onChange={(e) => setSudoSameAsSsh(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500"
                    />
                    <span>Sudo = SSH pass</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Governance Accordion (Non-intrusive) */}
            <div className="border-t border-slate-800/80 pt-2 text-xs">
              <button
                onClick={() => setShowGovernance(!showGovernance)}
                className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 py-1"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Governance & Authorizations (Optional)
                </span>
                {showGovernance ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {showGovernance && (
                <div className="mt-2 space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Change Reference / Ticket ID</label>
                    <input
                      type="text"
                      placeholder="e.g. CR-10492 or Homelab-Run"
                      value={changeReference}
                      onChange={(e) => setChangeReference(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 text-slate-300">
                    <input
                      type="checkbox"
                      checked={selfAuthorize}
                      onChange={(e) => setSelfAuthorize(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-500"
                    />
                    <span>Self-Authorize this Run (Permit immediate execution)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Action Trigger Button */}
            <div className="pt-2">
              {executing ? (
                <button
                  onClick={handleCancelRun}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition"
                >
                  <StopCircle className="w-4 h-4" />
                  Abort Execution Now
                </button>
              ) : (
                <button
                  onClick={handleStartRun}
                  disabled={targets.length === 0}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition shadow-lg ${
                    targets.length === 0
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : environment === 'production'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {execMode === 'command'
                    ? `Launch Fleet Command on ${targets.length} Hosts`
                    : `Trigger Playbook on ${targets.length} Hosts`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Resolved Targets Table & Live Execution Console */}
        <div className="col-span-7 flex flex-col gap-3 overflow-hidden">
          {/* Active Target Preview Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col h-1/2 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  Resolved Fleet Targets ({targets.length})
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                  {targets.filter((t) => hostStatus[t.hostname] === 'success').length} OK / {targets.filter((t) => hostStatus[t.hostname] === 'failed').length} Failed
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTargetTab('custom')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-emerald-400" />
                  Add Host
                </button>
                <button
                  onClick={() => setTargets([])}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-xs"
                  title="Clear All Targets"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/80">
              {targets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs space-y-2">
                  <Server className="w-8 h-8 text-slate-600" />
                  <p>No targets selected for this fleet run.</p>
                  <p className="text-[11px] text-slate-600">
                    Check sessions on the left, click <strong>+ Add Host</strong>, or paste an IP list to get started.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800 text-[11px] bg-slate-900/90 sticky top-0">
                      <th className="py-2 px-3">Target Host</th>
                      <th className="py-2 px-2">IP : Port</th>
                      <th className="py-2 px-2">User</th>
                      <th className="py-2 px-2">Environment</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((t) => {
                      const hostInfo = hostStatus[t.hostname] || hostStatus[t.hostId];
                      const st = hostInfo?.status;
                      return (
                        <tr key={t.hostId} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-slate-200 font-semibold truncate max-w-[150px]">
                            {t.displayName || t.hostname}
                          </td>
                          <td className="py-2 px-2 text-slate-400 font-mono">
                            {t.ipAddress}{t.port ? `:${t.port}` : ''}
                          </td>
                          <td className="py-2 px-2 text-slate-400 font-mono">
                            {t.username || 'root'}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                              t.environment === 'production'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : t.environment === 'staging'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {t.environment}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            {st === 'running' && (
                              <div className="flex flex-col">
                                <span className="text-sky-400 flex items-center gap-1.5 text-[11px] font-medium">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Running {hostInfo?.taskProgress ? `(${hostInfo.taskProgress})` : ''}
                                </span>
                                {hostInfo?.currentTask && (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={hostInfo.currentTask}>
                                    {hostInfo.currentTask}
                                  </span>
                                )}
                              </div>
                            )}
                            {st === 'success' && (
                              <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                OK
                              </span>
                            )}
                            {st === 'changed' && (
                              <span className="text-amber-400 flex items-center gap-1 text-[11px] font-medium">
                                <RotateCcw className="w-3.5 h-3.5" />
                                CHANGED
                              </span>
                            )}
                            {st === 'failed' && (
                              <span className="text-red-400 flex items-center gap-1 text-[11px] font-medium">
                                <XCircle className="w-3.5 h-3.5" />
                                FAILED
                              </span>
                            )}
                            {!st && <span className="text-slate-600 text-[11px]">Pending</span>}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              onClick={() => handleRemoveTarget(t.hostId)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition"
                              title="Remove target"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Live Telemetry / Execution Output Console & Progress Dashboard */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col h-1/2 overflow-hidden shadow-lg">
            {/* Live Progress Bar & Status Metric Header */}
            <div className="mb-3 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {executing ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      {currentTaskInfo
                        ? `TASK [${currentTaskInfo.index}/${currentTaskInfo.total}]: ${currentTaskInfo.name}`
                        : 'Executing tasks...'}
                    </span>
                  ) : progressPercent === 100 ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Execution Finished (100%)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                      Ready to launch
                    </span>
                  )}

                  {currentTaskInfo?.module && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-indigo-300">
                      mod: {currentTaskInfo.module}
                    </span>
                  )}
                </div>

                {/* Real-time Stopwatch & Live Counters */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 shadow-inner">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>⏱ {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}s</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ok: {liveRecap.ok}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-amber-400" />
                      chg: {liveRecap.changed}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800/60 flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-400" />
                      failed: {liveRecap.failed}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-1">
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${
                      liveRecap.failed > 0
                        ? 'bg-gradient-to-r from-amber-500 to-red-500'
                        : 'bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                  <span>Progress: {progressPercent}%</span>
                  <span>{targets.length} target host{targets.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>

            {/* Console Toolbar */}
            <div className="flex items-center justify-between mb-2 gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Live Execution Console
                </span>
                {executing && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Streaming logs" />
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {/* Search / Filter Input */}
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter logs..."
                    className="pl-7 pr-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-32 focus:w-48 transition-all"
                  />
                  {filterText && (
                    <button
                      onClick={() => setFilterText('')}
                      className="absolute right-1 text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Auto-scroll toggle */}
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-0.5 rounded text-xs font-medium border transition flex items-center gap-1 ${
                    autoScroll
                      ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Toggle automatic scrolling to latest log line"
                >
                  <ArrowDown className={`w-3 h-3 ${autoScroll ? 'text-indigo-400' : 'text-slate-500'}`} />
                  Auto-scroll
                </button>

                {/* Copy logs button */}
                <button
                  onClick={handleCopyLogs}
                  disabled={logs.length === 0}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-medium flex items-center gap-1 border border-slate-700 transition"
                  title="Copy full console output to clipboard"
                >
                  {copiedLogs ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                {/* Clear button */}
                <button
                  onClick={() => setLogs([])}
                  disabled={logs.length === 0}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-700"
                >
                  Clear
                </button>

                {/* Export Manifest button */}
                {completedManifest && (
                  <button
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(completedManifest, null, 2));
                      const a = document.createElement('a');
                      a.setAttribute('href', dataStr);
                      a.setAttribute('download', `run-manifest-${completedManifest.run_id}.json`);
                      a.click();
                    }}
                    className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1 shadow"
                  >
                    <Download className="w-3 h-3" />
                    Manifest
                  </button>
                )}
              </div>
            </div>

            {/* Console Log Scroll Viewport */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-y-auto space-y-0.5 select-text">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 italic">
                  Fleet execution stream idle. Configure targets and click Launch.
                </div>
              ) : (
                (() => {
                  const filtered = logs.filter((line) => {
                    if (!filterText.trim()) return true;
                    return line.toLowerCase().includes(filterText.toLowerCase());
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-4 text-center text-slate-500 italic text-xs">
                        No logs matching "{filterText}"
                      </div>
                    );
                  }

                  return (
                    <>
                      {filtered.map((line, idx) => {
                        const trimmed = line.trimStart();

                        // Header banners
                        if (trimmed.startsWith('PLAY [')) {
                          return (
                            <div
                              key={idx}
                              className="text-cyan-400 font-bold bg-cyan-950/40 px-2 py-1 rounded border-l-2 border-cyan-400 my-1 font-mono tracking-tight"
                            >
                              {line}
                            </div>
                          );
                        }
                        if (trimmed.startsWith('TASK [')) {
                          return (
                            <div
                              key={idx}
                              className="text-sky-300 font-bold bg-sky-950/30 px-2 py-0.5 rounded border-l-2 border-sky-400 mt-2 mb-0.5 font-mono tracking-tight"
                            >
                              {line}
                            </div>
                          );
                        }
                        if (trimmed.startsWith('PLAY RECAP')) {
                          return (
                            <div
                              key={idx}
                              className="text-indigo-300 font-bold bg-indigo-950/50 px-2 py-1 rounded border-l-2 border-indigo-400 mt-3 mb-1 font-mono tracking-tight"
                            >
                              {line}
                            </div>
                          );
                        }

                        // Status lines
                        if (trimmed.startsWith('ok:')) {
                          return (
                            <div key={idx} className="text-emerald-400 font-medium pl-2 leading-relaxed">
                              {line}
                            </div>
                          );
                        }
                        if (trimmed.startsWith('changed:')) {
                          return (
                            <div key={idx} className="text-amber-400 font-medium pl-2 leading-relaxed">
                              {line}
                            </div>
                          );
                        }
                        if (trimmed.startsWith('fatal:') || trimmed.includes('FAILED!')) {
                          return (
                            <div key={idx} className="text-red-400 font-bold pl-2 bg-red-950/40 py-0.5 rounded border-l-2 border-red-500">
                              {line}
                            </div>
                          );
                        }

                        // Recap columns
                        if (line.includes(': ok=') || line.includes('unreachable=')) {
                          return (
                            <div key={idx} className="text-slate-100 font-semibold pl-2 bg-slate-900/60 py-0.5 rounded">
                              {line}
                            </div>
                          );
                        }

                        // Indented JSON content
                        if (line.startsWith('    ') || line.startsWith('  ') || line === '{' || line === '}') {
                          return (
                            <div key={idx} className="text-slate-400 pl-4 whitespace-pre font-mono text-[11px] leading-snug">
                              {line}
                            </div>
                          );
                        }

                        // General logs
                        return (
                          <div
                            key={idx}
                            className={`leading-relaxed pl-2 ${
                              line.includes('[FINISHED]')
                                ? 'text-emerald-300 font-semibold'
                                : line.includes('[INIT]')
                                ? 'text-sky-300 font-semibold'
                                : line.includes('[HALT]')
                                ? 'text-red-400 font-bold'
                                : 'text-slate-300'
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                      <div ref={consoleBottomRef} />
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Target Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-indigo-500/40 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Target Authentication</h3>
                  <p className="text-xs text-slate-400">
                    Execution credentials for {targets.length} target host(s)
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Vault dropdown if available */}
              {vaultCredentials.length > 0 && (
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Use Password from Vault:</label>
                  <select
                    value={selectedVaultId}
                    onChange={(e) => {
                      setSelectedVaultId(e.target.value);
                      if (e.target.value) {
                        const match = vaultCredentials.find((v) => v.id === e.target.value);
                        if (match?.password) setSshPassword(match.password);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 outline-none font-mono"
                  >
                    <option value="">-- Select from Vault or enter below --</option>
                    {vaultCredentials.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SSH Password Input */}
              <div>
                <label className="text-slate-300 block mb-1 font-medium">SSH Login Password:</label>
                <div className="relative">
                  <input
                    type={showSshPassword ? 'text' : 'password'}
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="Enter SSH password for targets..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 pr-10 outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSshPassword(!showSshPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showSshPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sudo / Become Option */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
                  <input
                    type="checkbox"
                    checked={elevateSudo}
                    onChange={(e) => setElevateSudo(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                  />
                  <span>Privilege Escalation (sudo become: yes)</span>
                </label>

                {elevateSudo && (
                  <div className="pl-5 space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-[11px]">
                      <input
                        type="checkbox"
                        checked={sudoSameAsSsh}
                        onChange={(e) => setSudoSameAsSsh(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                      />
                      <span>Sudo password is same as SSH password</span>
                    </label>

                    {!sudoSameAsSsh && (
                      <div className="relative">
                        <input
                          type={showSudoPassword ? 'text' : 'password'}
                          value={sudoPassword}
                          onChange={(e) => setSudoPassword(e.target.value)}
                          placeholder="Enter separate sudo password..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 pr-10 outline-none focus:border-indigo-500 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSudoPassword(!showSudoPassword)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                        >
                          {showSudoPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAuthModal(false);
                    const effPass = sshPassword;
                    const effBecome = sudoSameAsSsh ? effPass : sudoPassword;
                    handleStartRun({ password: effPass, becomePassword: effBecome });
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Authenticate & Run Playbook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playbook Library Modal */}
      {showPlaybookModal && (
        <PlaybookModal
          isOpen={showPlaybookModal}
          onClose={() => {
            setShowPlaybookModal(false);
            setEditingPlaybook(null);
          }}
          onSave={handleSavePlaybook}
          initialPlaybook={editingPlaybook}
          initialContent={editingPlaybook ? undefined : customPlaybookYaml}
        />
      )}
    </div>
  );
};
