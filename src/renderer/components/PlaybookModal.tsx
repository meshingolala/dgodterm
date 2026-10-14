import React, { useState, useEffect, useRef } from 'react';
import { SavedPlaybook } from '../../domain/types';
import {
  X,
  FileCode,
  Save,
  Upload,
  Sparkles,
  AlertTriangle,
  Check,
  Tag,
  Palette,
  FileText
} from 'lucide-react';

interface PlaybookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (playbook: Partial<SavedPlaybook> & { name: string; content: string }) => Promise<void>;
  initialPlaybook?: SavedPlaybook | null;
  initialContent?: string;
}

const TEMPLATE_PRESETS: { label: string; description: string; badge: string; badgeVariant: SavedPlaybook['badge_variant']; yaml: string }[] = [
  {
    label: 'User Creation & Sudo Access',
    description: 'Create user with bash shell, supplementary groups, and passwordless sudo.',
    badge: 'USER',
    badgeVariant: 'purple',
    yaml: `---
- name: Create user and grant sudo access
  hosts: all
  become: yes
  tasks:
    - name: Create operator user with sudo privileges
      user:
        name: meshingo
        groups: sudo
        shell: /bin/bash
        state: present

    - name: Ensure passwordless sudo access for operator
      lineinfile:
        path: /etc/sudoers.d/meshingo
        line: "meshingo ALL=(ALL) NOPASSWD:ALL"
        create: yes
`
  },
  {
    label: 'Docker Engine & Compose Setup',
    description: 'Install official Docker container runtime, plugins, and verify daemon.',
    badge: 'DOCKER',
    badgeVariant: 'sky',
    yaml: `---
- name: Install and configure Docker CE
  hosts: all
  become: yes
  tasks:
    - name: Install prerequisite packages
      command: apt-get update -y && apt-get install -y ca-certificates curl gnupg

    - name: Add Docker official GPG key
      command: install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc

    - name: Install Docker CE packages
      command: apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    - name: Verify Docker service is active
      service:
        name: docker
        state: started
`
  },
  {
    label: 'Nginx Web Server & TLS Proxy',
    description: 'Install Nginx, enable service, and verify HTTP daemon status.',
    badge: 'WEB',
    badgeVariant: 'emerald',
    yaml: `---
- name: Install and configure Nginx
  hosts: all
  become: yes
  tasks:
    - name: Install Nginx web server
      apt:
        name: nginx
        state: present

    - name: Ensure Nginx service is running
      service:
        name: nginx
        state: started

    - name: Check Nginx syntax configuration
      command: nginx -t
`
  },
  {
    label: 'System Health & Disk Telemetry',
    description: 'Gather facts, inspect disk partition capacity, memory and CPU uptime.',
    badge: 'METRICS',
    badgeVariant: 'amber',
    yaml: `---
- name: System Health and Resource Telemetry
  hosts: all
  become: no
  tasks:
    - name: Gathering Facts
      setup:

    - name: Inspect root disk free space
      command: df -h /

    - name: Check host memory utilization
      command: free -m

    - name: Display system uptime and load averages
      command: uptime
`
  },
  {
    label: 'CIS Security Benchmark Hardening',
    description: 'Harden SSH daemon, apply UFW firewall limits, and configure Fail2ban.',
    badge: 'SECURITY',
    badgeVariant: 'red',
    yaml: `---
- name: CIS Benchmark Baseline Security Hardening
  hosts: all
  become: yes
  tasks:
    - name: Disable root login over SSH
      lineinfile:
        path: /etc/ssh/sshd_config
        line: "PermitRootLogin no"

    - name: Configure UFW firewall default incoming deny
      command: ufw default deny incoming && ufw default allow outgoing

    - name: Allow SSH port 22 with rate limiting
      command: ufw limit 22/tcp

    - name: Install and start Fail2ban intrusion daemon
      apt:
        name: fail2ban
        state: present
`
  }
];

const BADGE_COLOR_OPTIONS: { value: SavedPlaybook['badge_variant']; label: string; classNames: string }[] = [
  { value: 'sky', label: 'Sky Blue', classNames: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  { value: 'emerald', label: 'Emerald Green', classNames: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { value: 'indigo', label: 'Indigo Purple', classNames: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  { value: 'purple', label: 'Violet', classNames: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { value: 'amber', label: 'Amber Orange', classNames: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { value: 'red', label: 'Crimson Red', classNames: 'bg-red-500/20 text-red-300 border-red-500/40' },
];

export const PlaybookModal: React.FC<PlaybookModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPlaybook,
  initialContent
}) => {
  const [name, setName] = useState('');
  const [filename, setFilename] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState('CUSTOM');
  const [badgeVariant, setBadgeVariant] = useState<SavedPlaybook['badge_variant']>('sky');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialPlaybook) {
        setName(initialPlaybook.name);
        setFilename(initialPlaybook.filename);
        setDescription(initialPlaybook.description || '');
        setBadge(initialPlaybook.badge || 'CUSTOM');
        setBadgeVariant(initialPlaybook.badge_variant || 'sky');
        setContent(initialPlaybook.content || '');
      } else {
        setName('');
        setFilename('');
        setDescription('');
        setBadge('CUSTOM');
        setBadgeVariant('sky');
        setContent(initialContent || TEMPLATE_PRESETS[0].yaml);
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen, initialPlaybook, initialContent]);

  if (!isOpen) return null;

  // Auto-generate filename as name is typed if filename hasn't been manually edited
  const handleNameChange = (val: string) => {
    setName(val);
    if (!initialPlaybook && (!filename || filename === sanitizeFilename(name))) {
      setFilename(sanitizeFilename(val));
    }
  };

  const sanitizeFilename = (val: string) => {
    let base = val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!base) return '';
    return base + '.yml';
  };

  const handleApplyTemplate = (tpl: typeof TEMPLATE_PRESETS[0]) => {
    if (!name.trim()) setName(tpl.label);
    if (!filename.trim()) setFilename(sanitizeFilename(tpl.label));
    if (!description.trim()) setDescription(tpl.description);
    setBadge(tpl.badge);
    setBadgeVariant(tpl.badgeVariant);
    setContent(tpl.yaml);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setContent(text);
        if (!name.trim()) {
          const autoName = file.name.replace(/\.(ya?ml)$/i, '').replace(/[_-]+/g, ' ');
          setName(autoName.charAt(0).toUpperCase() + autoName.slice(1));
        }
        if (!filename.trim()) {
          setFilename(file.name);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Support Tab key in YAML textarea for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const next = val.substring(0, start) + '  ' + val.substring(end);
      setContent(next);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a playbook name.');
      return;
    }
    if (!content.trim()) {
      setError('Playbook YAML content cannot be empty.');
      return;
    }

    let finalFilename = filename.trim();
    if (!finalFilename) {
      finalFilename = sanitizeFilename(name);
    }
    if (!finalFilename.endsWith('.yml') && !finalFilename.endsWith('.yaml')) {
      finalFilename += '.yml';
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSave({
        id: initialPlaybook?.id,
        name: name.trim(),
        filename: finalFilename,
        description: description.trim(),
        badge: badge.trim().toUpperCase() || 'CUSTOM',
        badge_variant: badgeVariant,
        content: content.trim(),
        is_builtin: initialPlaybook?.is_builtin ?? false
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save playbook');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0b101b] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {initialPlaybook ? 'Edit Ansible Playbook' : 'Add New Ansible Playbook'}
              </h3>
              <p className="text-xs text-slate-400">
                Define reusable automation directives, tasks, and configurations for your fleet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {error && (
              <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-lg flex items-center gap-2 text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Templates Selector */}
            {!initialPlaybook && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Start from a Pre-built Template:
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-[11px] font-medium transition"
                  >
                    <Upload className="w-3 h-3" />
                    Import .yml File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".yml,.yaml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEMPLATE_PRESETS.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="text-left p-2 rounded bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-600/50 transition group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-200 group-hover:text-indigo-300 text-[11px] truncate">
                          {tpl.label}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{tpl.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Title & Filename */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Playbook Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Create Developer User"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1">
                  Filename (.yml) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. create_developer_user.yml"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {/* Badge & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-slate-400" />
                  Category Badge
                </label>
                <input
                  type="text"
                  placeholder="USER, SECURITY, DOCKER"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-slate-300 block mb-1 flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-slate-400" />
                  Badge Color
                </label>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {BADGE_COLOR_OPTIONS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setBadgeVariant(col.value)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition flex items-center gap-1 ${
                        col.classNames
                      } ${badgeVariant === col.value ? 'ring-2 ring-white/50' : 'opacity-70 hover:opacity-100'}`}
                    >
                      {badgeVariant === col.value && <Check className="w-3 h-3" />}
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">
                Description / Purpose
              </label>
              <input
                type="text"
                placeholder="Brief summary of what this automation executes across targets"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* YAML Code Editor */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  Playbook Directives & Tasks (YAML) *
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Press [Tab] for 2-space indentation
                </span>
              </div>
              <textarea
                ref={textareaRef}
                rows={11}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="---\n- name: My Automation Play\n  hosts: all\n  become: yes\n  tasks:\n    - name: Run command\n      command: uptime"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-[11px] text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed shadow-inner"
                required
                spellCheck={false}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500">
              Saved playbooks persist in your local database library and can be triggered on any fleet host.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSubmitting ? 'Saving...' : initialPlaybook ? 'Update Playbook' : 'Save Playbook'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
