import React, { useEffect, useState } from 'react';
import { ConnectionProfile, SFTPItem } from '../../domain/types';
import {
  Folder,
  File,
  ArrowRight,
  ArrowLeft,
  Trash2,
  FolderPlus,
  RefreshCw,
  HardDrive,
  Server,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCheck2,
  KeyRound,
  ShieldCheck,
  Lock,
  ArrowUp,
  CornerLeftUp,
  FolderOpen,
  Search,
  Home,
  Eye,
  EyeOff,
  ExternalLink,
  Upload,
  Download,
  GripVertical,
  Minimize2,
  Maximize2,
  Copy,
  ClipboardPaste,
  FileEdit,
  FileCode
} from 'lucide-react';
import { PasswordPromptModal } from './PasswordPromptModal';
import { copyTextToClipboard } from '../utils/clipboard-utils';
import { RemoteFileEditorModal } from './RemoteFileEditorModal';

const copyToClipboard = copyTextToClipboard;

interface SftpViewProps {
  sessionId: string;
  profile: ConnectionProfile;
}

interface ActiveTransferModal {
  isOpen: boolean;
  isMinimized: boolean;
  id: string;
  name: string;
  direction: 'download' | 'upload';
  sourcePath: string;
  destPath: string;
  transferredBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  progressPercent: number;
  status: 'transferring' | 'completed' | 'failed' | 'needs_sudo';
  errorMessage?: string;
  sha256?: string;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
};

const formatSpeed = (bps: number): string => {
  if (!bps || bps <= 0) return '0 KB/s';
  if (bps >= 1024 * 1024) {
    return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bps / 1024).toFixed(0)} KB/s`;
};

const formatEta = (total: number, transferred: number, speed: number): string => {
  if (!speed || speed <= 0 || total <= transferred) return '--';
  const remainingSeconds = Math.round((total - transferred) / speed);
  if (remainingSeconds < 60) return `${remainingSeconds}s remaining`;
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  return `${m}m ${s}s remaining`;
};

export const SftpView: React.FC<SftpViewProps> = ({ sessionId, profile }) => {
  const [localPath, setLocalPath] = useState('');
  const [remotePath, setRemotePath] = useState('/home/' + profile.username);
  const [localItems, setLocalItems] = useState<SFTPItem[]>([]);
  const [remoteItems, setRemoteItems] = useState<SFTPItem[]>([]);
  const [selectedLocal, setSelectedLocal] = useState<SFTPItem | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<SFTPItem | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordPromptText, setPasswordPromptText] = useState('');
  const [localFilter, setLocalFilter] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('');
  const [showHiddenLocal, setShowHiddenLocal] = useState(true);
  const [showHiddenRemote, setShowHiddenRemote] = useState(true);
  const [localHomeDir, setLocalHomeDir] = useState<string>('');
  const [failedPermItem, setFailedPermItem] = useState<{ path: string; name: string } | null>(null);
  const [elevatingPerms, setElevatingPerms] = useState(false);

  // Drag and drop states
  const [draggedItem, setDraggedItem] = useState<{ source: 'local' | 'remote'; item: SFTPItem } | null>(null);
  const [dragOverPane, setDragOverPane] = useState<'local' | 'remote' | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<{ pane: 'local' | 'remote'; path: string; name: string } | null>(null);

  // Confirmation modal states
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'overwrite' | 'delete' | 'mkdir';
    title: string;
    message: string;
    action: () => void;
  } | null>(null);

  // Transfers
  const [transfers, setTransfers] = useState<Array<{
    id: string;
    name: string;
    direction: 'upload' | 'download';
    progress: number;
    sha256?: string;
    status: 'transferring' | 'completed' | 'failed';
  }>>([]);

  // Active Transfer Progress Dialogue Modal
  const [activeModal, setActiveModal] = useState<ActiveTransferModal | null>(null);
  const [inlineSudoPass, setInlineSudoPass] = useState('');
  const [showSudoPass, setShowSudoPass] = useState(false);

  // Active Remote File Editor Modal
  const [editingRemotePath, setEditingRemotePath] = useState<string | null>(null);

  // Create Folder / Directory Modal
  const [createFolderModal, setCreateFolderModal] = useState<{
    target: 'local' | 'remote';
    parentDir: string;
  } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderCreationError, setFolderCreationError] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    pane: 'local' | 'remote';
    item: SFTPItem | null;
  } | null>(null);

  // SFTP Clipboard State (for file & folder Copy and Paste)
  const [clipboardItem, setClipboardItem] = useState<{
    pane: 'local' | 'remote';
    item: SFTPItem;
  } | null>(null);

  useEffect(() => {
    refreshLocal('');
    connectAndLoad();
    const handleGlobalClick = () => setContextMenu(null);
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalKeyDown);

    const unsub = (window as any).dgodterm.onTransferProgress?.((p: any) => {
      if (!p) return;
      const pct = p.total > 0 ? Math.min(100, Math.round((p.transferred / p.total) * 100)) : 0;
      setTransfers((prev) =>
        prev.map((t) =>
          t.name === p.name && t.status === 'transferring'
            ? { ...t, progress: pct }
            : t
        )
      );
      setActiveModal((prev) => {
        if (!prev || prev.name !== p.name || prev.status !== 'transferring') return prev;
        return {
          ...prev,
          transferredBytes: p.transferred,
          totalBytes: p.total || prev.totalBytes,
          speedBytesPerSec: p.speed || 0,
          progressPercent: pct
        };
      });
    });
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (typeof unsub === 'function') unsub();
      (window as any).dgodterm.disconnectSFTP(sessionId);
    };
  }, [sessionId, profile.id]);

  const connectAndLoad = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await (window as any).dgodterm.connectSFTP(sessionId, profile.id);
      setConnected(true);
      await refreshRemote(remotePath || '.');
    } catch (err: any) {
      setErrorMsg(`SFTP connection failed: ${err.message}`);
      setConnected(false);
      if (err.message.toLowerCase().includes('auth') || err.message.toLowerCase().includes('password')) {
        setPasswordPromptText(`Enter SFTP password for ${profile.username}@${profile.hostname}:`);
        setShowPasswordModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (pass: string) => {
    setShowPasswordModal(false);
    let ttl = -1;
    try {
      const saved = localStorage.getItem('dgodterm_session_settings');
      if (saved) ttl = JSON.parse(saved).passwordRetentionMinutes ?? -1;
    } catch (e) {}
    await (window as any).dgodterm.submitTransientPassword(sessionId, pass, ttl, profile.id);
    connectAndLoad();
  };

  const refreshLocal = async (p?: string) => {
    const target = p !== undefined ? p : localPath;
    try {
      const res = await (window as any).dgodterm.listLocalDir(target);
      const items: SFTPItem[] = Array.isArray(res) ? res : (res?.items || []);
      const resolvedPath: string = (!Array.isArray(res) && res?.currentPath) ? res.currentPath : (target || '');
      if (!Array.isArray(res) && res?.homeDir) {
        setLocalHomeDir(res.homeDir);
      }
      setLocalItems(items);
      if (resolvedPath) {
        setLocalPath(resolvedPath);
      } else if (items.length > 0) {
        const first = items[0].path;
        const parent = first.substring(0, first.lastIndexOf(first.includes('\\') ? '\\' : '/'));
        setLocalPath(parent || '/');
      }
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg(`Local directory read error: ${e.message}`);
    }
  };

  const refreshRemote = async (targetPath: string) => {
    try {
      const items = await (window as any).dgodterm.listRemoteDir(sessionId, targetPath);
      setRemoteItems(items);
      setRemotePath(targetPath);
    } catch (e: any) {
      if (targetPath !== '.') {
        try {
          const fallbackItems = await (window as any).dgodterm.listRemoteDir(sessionId, '.');
          setRemoteItems(fallbackItems);
          setRemotePath('.');
          return;
        } catch (e2) {}
      }
      setErrorMsg(`Remote directory read error: ${e.message}`);
    }
  };

  const navigateRemoteUp = () => {
    if (!remotePath || remotePath === '/' || remotePath === '.') return;
    const parent = remotePath.substring(0, remotePath.lastIndexOf('/')) || '/';
    refreshRemote(parent);
  };

  const navigateLocalUp = () => {
    if (!localPath) return;
    const sep = localPath.includes('\\') ? '\\' : '/';
    const trimmed = localPath.replace(/[/\\]+$/, '');
    const lastIndex = trimmed.lastIndexOf(sep);
    if (lastIndex >= 0) {
      let parent = trimmed.substring(0, lastIndex);
      if (parent.endsWith(':')) {
        parent = parent + sep;
      }
      if (!parent && sep === '/') {
        parent = '/';
      }
      if (parent) {
        refreshLocal(parent);
      }
    }
  };

  const remoteQuickJumps = [
    { label: '~ Home', path: profile.username ? `/home/${profile.username}` : '.' },
    { label: '/ Root', path: '/' },
    { label: '/etc', path: '/etc' },
    { label: '/var', path: '/var' },
    { label: '/tmp', path: '/tmp' },
    { label: '/opt', path: '/opt' }
  ];

  const localSep = (localHomeDir && localHomeDir.includes('\\')) || localPath.includes('\\') || (!localHomeDir && typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')) ? '\\' : '/';
  const baseLocalHome = localHomeDir || (localPath ? (localPath.startsWith('/') ? '/home' : 'C:\\Users\\Administrator') : 'C:\\Users\\Administrator');
  const cleanHome = baseLocalHome.replace(/[/\\]+$/, '');
  const localQuickJumps = [
    { label: '~ Home', path: cleanHome },
    { label: 'Documents', path: `${cleanHome}${localSep}Documents` },
    { label: 'Downloads', path: `${cleanHome}${localSep}Downloads` },
    { label: 'Music', path: `${cleanHome}${localSep}Music` },
    { label: 'Pictures', path: `${cleanHome}${localSep}Pictures` },
    { label: 'Videos', path: `${cleanHome}${localSep}Videos` },
    { label: 'Desktop', path: `${cleanHome}${localSep}Desktop` }
  ];

  const filteredLocalItems = localItems.filter((i) => {
    if (!showHiddenLocal && i.name.startsWith('.')) return false;
    return i.name.toLowerCase().includes(localFilter.toLowerCase());
  });

  const filteredRemoteItems = remoteItems.filter((i) => {
    if (!showHiddenRemote && i.name.startsWith('.')) return false;
    return i.name.toLowerCase().includes(remoteFilter.toLowerCase());
  });

  const handleLocalNavigate = (item: SFTPItem) => {
    if (item.isDirectory) {
      refreshLocal(item.path);
    }
  };

  const handleRemoteNavigate = (item: SFTPItem) => {
    if (item.isDirectory) {
      refreshRemote(item.path);
    }
  };

  const handleUploadItem = (item: SFTPItem) => {
    const destRemote = `${remotePath.replace(/\/$/, '')}/${item.name}`;
    const exists = remoteItems.some((i) => i.name === item.name);
    if (exists) {
      setConfirmDialog({
        type: 'overwrite',
        title: 'Confirm Remote File Overwrite',
        message: `Remote file "${destRemote}" already exists. Do you want to overwrite it?`,
        action: () => executeUpload(item.path, destRemote, item.name)
      });
      return;
    }
    executeUpload(item.path, destRemote, item.name);
  };

  const handleUpload = async () => {
    if (!selectedLocal) return;
    handleUploadItem(selectedLocal);
  };

  const executeUpload = async (src: string, dst: string, name: string) => {
    setConfirmDialog(null);
    const transferId = Math.random().toString();
    const localItem = localItems.find((i) => i.path === src || i.name === name);
    const totalSize = localItem?.size || 0;

    setActiveModal({
      isOpen: true,
      isMinimized: false,
      id: transferId,
      name,
      direction: 'upload',
      sourcePath: src,
      destPath: dst,
      transferredBytes: 0,
      totalBytes: totalSize,
      speedBytesPerSec: 0,
      progressPercent: 0,
      status: 'transferring'
    });

    setTransfers((prev) => [
      ...prev,
      { id: transferId, name, direction: 'upload', progress: 0, status: 'transferring' }
    ]);

    try {
      const res = await (window as any).dgodterm.uploadFile(sessionId, src, dst);
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, progress: 100, status: 'completed', sha256: res.sha256 } : t))
      );
      setActiveModal((prev) => (prev?.id === transferId ? {
        ...prev,
        progressPercent: 100,
        transferredBytes: prev.totalBytes,
        status: 'completed',
        sha256: res.sha256
      } : prev));
      refreshRemote(remotePath);
    } catch (e: any) {
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, status: 'failed' } : t))
      );
      setActiveModal((prev) => (prev?.id === transferId ? {
        ...prev,
        status: 'failed',
        errorMessage: e.message
      } : prev));
      const isPerm = e.message && e.message.toLowerCase().includes('permission denied');
      if (isPerm) {
        setErrorMsg(`Upload failed (Permission denied): User '${profile.username}' lacks write access to remote destination. Run in SSH terminal: sudo chmod 777 "${remotePath}"`);
      } else {
        setErrorMsg(`Upload failed: ${e.message}`);
      }
    }
  };

  const handleDownloadItem = (item: SFTPItem) => {
    const sep = localPath.includes('\\') ? '\\' : '/';
    const destLocal = `${localPath.replace(/[/\\]$/, '')}${sep}${item.name}`;

    const exists = localItems.some((i) => i.name === item.name);
    if (exists) {
      setConfirmDialog({
        type: 'overwrite',
        title: 'Confirm Local File Overwrite',
        message: `Local file "${destLocal}" already exists. Overwrite?`,
        action: () => executeDownload(item.path, destLocal, item.name)
      });
      return;
    }

    executeDownload(item.path, destLocal, item.name);
  };

  const handleDownload = async () => {
    if (!selectedRemote) return;
    handleDownloadItem(selectedRemote);
  };

  const executeDownload = async (src: string, dst: string, name: string, sudoPassword?: string) => {
    setConfirmDialog(null);
    const transferId = Math.random().toString();
    const remoteItem = remoteItems.find((i) => i.path === src || i.name === name);
    const totalSize = remoteItem?.size || 0;

    setActiveModal({
      isOpen: true,
      isMinimized: false,
      id: transferId,
      name,
      direction: 'download',
      sourcePath: src,
      destPath: dst,
      transferredBytes: 0,
      totalBytes: totalSize,
      speedBytesPerSec: 0,
      progressPercent: 0,
      status: 'transferring'
    });

    setTransfers((prev) => [
      ...prev,
      { id: transferId, name, direction: 'download', progress: 0, status: 'transferring' }
    ]);

    try {
      const res = await (window as any).dgodterm.downloadFile(sessionId, src, dst, sudoPassword);
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, progress: 100, status: 'completed', sha256: res.sha256 } : t))
      );
      setActiveModal((prev) => (prev?.id === transferId ? {
        ...prev,
        progressPercent: 100,
        transferredBytes: prev.totalBytes,
        status: 'completed',
        sha256: res.sha256
      } : prev));
      setFailedPermItem(null);
      refreshLocal(localPath);
    } catch (e: any) {
      setTransfers((prev) =>
        prev.map((t) => (t.id === transferId ? { ...t, status: 'failed' } : t))
      );
      const isPerm = e.message && (
        e.message.toLowerCase().includes('permission denied') ||
        e.message.toLowerCase().includes('root privileges') ||
        e.message.toLowerCase().includes('timed out')
      );
      const item = remoteItems.find((r) => r.path === src || r.name === name);
      if (isPerm) {
        setFailedPermItem({ path: src, name });
        const perms = item?.permissions || '0711';
        setActiveModal((prev) => (prev?.id === transferId ? {
          ...prev,
          status: 'needs_sudo',
          errorMessage: `Permission denied: "${name}" (${perms}) requires root permissions to read.`
        } : prev));
        setErrorMsg(`Permission denied: Remote file "${name}" has permissions ${perms} and cannot be read by '${profile.username}'.`);
      } else {
        setActiveModal((prev) => (prev?.id === transferId ? {
          ...prev,
          status: 'failed',
          errorMessage: e.message
        } : prev));
        setErrorMsg(`Download failed: ${e.message}`);
      }
    }
  };

  const handleUnlockAndDownload = async () => {
    if (!failedPermItem) return;
    setElevatingPerms(true);
    try {
      await (window as any).dgodterm.fixPermissions(sessionId, failedPermItem.path, '0644');
      const itemToDownload = failedPermItem;
      setFailedPermItem(null);
      setErrorMsg('');
      await refreshRemote(remotePath);
      const sep = localPath.includes('\\') ? '\\' : '/';
      const destLocal = `${localPath.replace(/[/\\]$/, '')}${sep}${itemToDownload.name}`;
      executeDownload(itemToDownload.path, destLocal, itemToDownload.name);
    } catch (err: any) {
      setErrorMsg(`Failed to unlock with sudo: ${err.message}`);
    } finally {
      setElevatingPerms(false);
    }
  };

  // Drag-and-drop event handlers
  const handleDragStart = (e: React.DragEvent, source: 'local' | 'remote', item: SFTPItem) => {
    setDraggedItem({ source, item });
    e.dataTransfer.setData('application/json', JSON.stringify({ source, item }));
    e.dataTransfer.setData('text/plain', item.name);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverPane(null);
    setDropTargetFolder(null);
  };

  const handlePaneDragOver = (e: React.DragEvent, pane: 'local' | 'remote') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (dragOverPane !== pane) {
      setDragOverPane(pane);
    }
  };

  const handlePaneDragLeave = (e: React.DragEvent, pane: 'local' | 'remote') => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      if (dragOverPane === pane) {
        setDragOverPane(null);
      }
      setDropTargetFolder(null);
    }
  };

  const handleDropOnRemote = async (e: React.DragEvent, targetSubfolder?: SFTPItem | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPane(null);
    setDropTargetFolder(null);

    const destDir = (targetSubfolder && targetSubfolder.isDirectory)
      ? targetSubfolder.path
      : remotePath;

    // Check if dragging files from the OS (desktop / explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const destRemote = `${destDir.replace(/\/$/, '')}/${file.name}`;
        if ((file as any).path) {
          executeUpload((file as any).path, destRemote, file.name);
        } else {
          const buffer = await file.arrayBuffer();
          const transferId = Math.random().toString();
          setTransfers((prev) => [
            ...prev,
            { id: transferId, name: file.name, direction: 'upload', progress: 50, status: 'transferring' }
          ]);
          try {
            const res = await (window as any).dgodterm.uploadBuffer(sessionId, buffer, destRemote);
            setTransfers((prev) =>
              prev.map((t) => (t.id === transferId ? { ...t, progress: 100, status: 'completed', sha256: res.sha256 } : t))
            );
            refreshRemote(remotePath);
          } catch (err: any) {
            setTransfers((prev) =>
              prev.map((t) => (t.id === transferId ? { ...t, status: 'failed' } : t))
            );
            setErrorMsg(`Upload failed: ${err.message}`);
          }
        }
      }
      return;
    }

    // Check if dragging from Local pane
    let droppedLocalItem: SFTPItem | null = null;
    if (draggedItem && draggedItem.source === 'local') {
      droppedLocalItem = draggedItem.item;
    } else {
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data && data.source === 'local') droppedLocalItem = data.item;
      } catch {}
    }

    if (!droppedLocalItem) return;

    const destRemote = `${destDir.replace(/\/$/, '')}/${droppedLocalItem.name}`;
    const exists = remoteItems.some((i) => i.name === droppedLocalItem!.name && destDir === remotePath);
    if (exists) {
      setConfirmDialog({
        type: 'overwrite',
        title: 'Confirm Remote File Overwrite',
        message: `Remote file "${destRemote}" already exists. Do you want to overwrite it?`,
        action: () => executeUpload(droppedLocalItem!.path, destRemote, droppedLocalItem!.name)
      });
      return;
    }

    executeUpload(droppedLocalItem.path, destRemote, droppedLocalItem.name);
  };

  const handleDropOnLocal = async (e: React.DragEvent, targetSubfolder?: SFTPItem | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPane(null);
    setDropTargetFolder(null);

    const destDir = (targetSubfolder && targetSubfolder.isDirectory)
      ? targetSubfolder.path
      : localPath;

    let droppedRemoteItem: SFTPItem | null = null;
    if (draggedItem && draggedItem.source === 'remote') {
      droppedRemoteItem = draggedItem.item;
    } else {
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data && data.source === 'remote') droppedRemoteItem = data.item;
      } catch {}
    }

    if (!droppedRemoteItem) return;

    const sep = destDir.includes('\\') ? '\\' : '/';
    const destLocal = `${destDir.replace(/[/\\]$/, '')}${sep}${droppedRemoteItem.name}`;

    const exists = localItems.some((i) => i.name === droppedRemoteItem!.name && destDir === localPath);
    if (exists) {
      setConfirmDialog({
        type: 'overwrite',
        title: 'Confirm Local File Overwrite',
        message: `Local file "${destLocal}" already exists. Overwrite?`,
        action: () => executeDownload(droppedRemoteItem!.path, destLocal, droppedRemoteItem!.name)
      });
      return;
    }

    executeDownload(droppedRemoteItem.path, destLocal, droppedRemoteItem.name);
  };

  const handleDeleteRemote = (targetItem?: SFTPItem | null) => {
    const item = targetItem || selectedRemote;
    if (!item) return;
    setConfirmDialog({
      type: 'delete',
      title: item.isDirectory ? 'Confirm Remote Directory Deletion' : 'Confirm Remote File Deletion',
      message: `Are you sure you want to permanently delete remote ${item.isDirectory ? 'directory' : 'file'} "${item.name}"? This action is logged.`,
      action: async () => {
        setConfirmDialog(null);
        try {
          await (window as any).dgodterm.deleteRemoteFile(sessionId, item.path, item.isDirectory);
          refreshRemote(remotePath);
          if (selectedRemote?.path === item.path) setSelectedRemote(null);
        } catch (e: any) {
          setErrorMsg(`Delete failed: ${e.message}`);
        }
      }
    });
  };

  const handleDeleteLocal = (targetItem?: SFTPItem | null) => {
    const item = targetItem || selectedLocal;
    if (!item) return;
    setConfirmDialog({
      type: 'delete',
      title: item.isDirectory ? 'Confirm Local Folder Deletion' : 'Confirm Local File Deletion',
      message: `Are you sure you want to permanently delete "${item.name}" from your local computer? This action cannot be undone.`,
      action: async () => {
        setConfirmDialog(null);
        try {
          await (window as any).dgodterm.deleteLocalItem(item.path);
          refreshLocal(localPath);
          if (selectedLocal?.path === item.path) setSelectedLocal(null);
        } catch (e: any) {
          setErrorMsg(`Delete failed: ${e.message}`);
        }
      }
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (e) {
      console.warn('Clipboard copy failed', e);
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    pane: 'local' | 'remote',
    item: SFTPItem | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (pane === 'local') {
      if (item) setSelectedLocal(item);
    } else {
      if (item) setSelectedRemote(item);
    }

    const menuWidth = 230;
    const menuHeight = 290;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

    setContextMenu({
      visible: true,
      x: Math.max(8, x),
      y: Math.max(8, y),
      pane,
      item
    });
  };

  const handlePaste = async (targetPane: 'local' | 'remote', targetSubfolder?: string) => {
    if (!clipboardItem) return;
    setErrorMsg('');
    const src = clipboardItem.item;

    const destDir = targetSubfolder
      ? targetSubfolder
      : (targetPane === 'local' ? localPath : remotePath);

    try {
      // 1. Local -> Local
      if (clipboardItem.pane === 'local' && targetPane === 'local') {
        await (window as any).dgodterm.copyLocalItem(src.path, destDir);
        await refreshLocal(localPath);
      }
      // 2. Remote -> Remote
      else if (clipboardItem.pane === 'remote' && targetPane === 'remote') {
        await (window as any).dgodterm.copyRemoteItem(sessionId, src.path, destDir);
        await refreshRemote(remotePath);
      }
      // 3. Local -> Remote (Upload to remote directory)
      else if (clipboardItem.pane === 'local' && targetPane === 'remote') {
        const destRemote = `${destDir.replace(/\/$/, '')}/${src.name}`;
        const exists = remoteItems.some((i) => i.name === src.name && destDir === remotePath);
        if (exists) {
          setConfirmDialog({
            type: 'overwrite',
            title: 'Confirm Remote Overwrite',
            message: `Remote item "${destRemote}" already exists. Do you want to overwrite it?`,
            action: () => executeUpload(src.path, destRemote, src.name)
          });
          return;
        }
        executeUpload(src.path, destRemote, src.name);
      }
      // 4. Remote -> Local (Download to local directory)
      else if (clipboardItem.pane === 'remote' && targetPane === 'local') {
        const sep = destDir.includes('\\') ? '\\' : '/';
        const destLocal = `${destDir.replace(/[/\\]$/, '')}${sep}${src.name}`;
        const exists = localItems.some((i) => i.name === src.name && destDir === localPath);
        if (exists) {
          setConfirmDialog({
            type: 'overwrite',
            title: 'Confirm Local Overwrite',
            message: `Local file "${destLocal}" already exists. Overwrite?`,
            action: () => executeDownload(src.path, destLocal, src.name)
          });
          return;
        }
        executeDownload(src.path, destLocal, src.name);
      }
    } catch (err: any) {
      setErrorMsg(`Paste failed: ${err.message}`);
    }
  };

  const handleOpenCreateFolderModal = (target: 'local' | 'remote') => {
    const parentDir = target === 'local' ? localPath : remotePath;
    setNewFolderName('');
    setFolderCreationError('');
    setCreateFolderModal({ target, parentDir });
  };

  const handleCreateFolderSubmit = async () => {
    if (!createFolderModal) return;
    const name = newFolderName.trim();
    if (!name) {
      setFolderCreationError('Please enter a folder name.');
      return;
    }
    if (createFolderModal.target === 'local' && /[<>:"/\\|?*]/.test(name)) {
      setFolderCreationError('Folder name contains invalid characters (< > : " / \\ | ? *)');
      return;
    }
    if (createFolderModal.target === 'remote' && name.includes('/')) {
      setFolderCreationError('Directory name cannot contain "/"');
      return;
    }

    setCreatingFolder(true);
    setFolderCreationError('');
    try {
      if (createFolderModal.target === 'local') {
        const sep = createFolderModal.parentDir.includes('\\') ? '\\' : '/';
        const target = `${createFolderModal.parentDir.replace(/[/\\]$/, '')}${sep}${name}`;
        await (window as any).dgodterm.createLocalDir(target);
        setCreateFolderModal(null);
        await refreshLocal(createFolderModal.parentDir);
      } else {
        const target = `${createFolderModal.parentDir.replace(/\/$/, '')}/${name}`;
        await (window as any).dgodterm.createRemoteDir(sessionId, target);
        setCreateFolderModal(null);
        await refreshRemote(createFolderModal.parentDir);
      }
    } catch (err: any) {
      setFolderCreationError(err.message || 'Failed to create directory');
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#090d16] text-slate-200">
      {/* Header Context Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            SFTP Session: {profile.display_name}
          </span>
          <span className="text-slate-400 font-mono">({profile.username}@{profile.hostname})</span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
            connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}>
            {connected ? 'SFTP ACTIVE' : 'CONNECTING...'}
          </span>
        </div>

        {errorMsg && (
          <div className="text-xs text-red-300 bg-red-950/70 px-3 py-1.5 rounded border border-red-700/80 flex items-center gap-2 max-w-2xl">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{errorMsg}</span>
            {failedPermItem && (
              <button
                onClick={handleUnlockAndDownload}
                disabled={elevatingPerms}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shadow transition disabled:opacity-50"
                title="Uses sudo privileges to grant read permissions (0644) and start download"
              >
                {elevatingPerms ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Unlock with Sudo & Download</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {!connected && (
            <button
              onClick={() => {
                setPasswordPromptText(`Enter SFTP password for ${profile.username}@${profile.hostname}:`);
                setShowPasswordModal(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-sky-200 text-xs font-semibold shadow-sm transition"
              title="Authenticate / Enter Password"
            >
              <KeyRound className="w-3.5 h-3.5 text-sky-300" />
              <span>Enter Password</span>
            </button>
          )}

          <button
            onClick={() => { refreshLocal(); refreshRemote(remotePath); }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Refresh Panes"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dual Pane Layout */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-slate-800 min-h-0 overflow-hidden">
        {/* Left Pane: LOCAL */}
        <div
          onDragOver={(e) => handlePaneDragOver(e, 'local')}
          onDragLeave={(e) => handlePaneDragLeave(e, 'local')}
          onDrop={(e) => handleDropOnLocal(e, null)}
          className={`relative flex flex-col h-full min-h-0 overflow-hidden bg-slate-950/40 transition-colors ${
            dragOverPane === 'local' ? 'ring-2 ring-sky-500/80 bg-sky-950/20' : ''
          }`}
        >
          {/* Local Drop Overlay */}
          {dragOverPane === 'local' && (
            <div className="absolute inset-0 bg-sky-950/85 backdrop-blur-[2px] flex flex-col items-center justify-center border-2 border-dashed border-sky-400 rounded z-30 pointer-events-none p-4 text-center">
              <Download className="w-10 h-10 text-sky-400 animate-bounce mb-2" />
              <span className="font-bold text-sky-200 text-sm">
                Drop here to download {draggedItem ? `"${draggedItem.item.name}"` : 'from Remote'}
              </span>
              <span className="text-sky-300/70 text-xs font-mono mt-1 max-w-full truncate px-4">
                Target: {dropTargetFolder?.pane === 'local' ? dropTargetFolder.path : localPath}
              </span>
            </div>
          )}

          {/* Local Path Header */}
          <div className="p-2 border-b border-slate-800 bg-slate-900/60 flex items-center gap-1.5 text-xs shrink-0">
            <HardDrive className="w-4 h-4 text-sky-400 shrink-0 ml-1" />
            <span className="font-bold text-sky-400 uppercase tracking-wider text-[11px] mr-1">LOCAL</span>
            <button
              onClick={navigateLocalUp}
              title="Go to parent directory"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshLocal(localPath)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
            />
            <button
              onClick={() => refreshLocal(localPath)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700"
            >
              Go
            </button>
            <button
              onClick={() => handleOpenCreateFolderModal('local')}
              className="flex items-center gap-1 px-2 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-sky-200 text-[11px] font-semibold transition shrink-0"
              title="Create new folder in current local directory"
            >
              <FolderPlus className="w-3.5 h-3.5 text-sky-300" />
              <span>New Folder</span>
            </button>
          </div>

          {/* Local Quick Jumps Bar */}
          <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-1">Jump:</span>
            {localQuickJumps.map((jump) => (
              <button
                key={jump.label}
                onClick={() => refreshLocal(jump.path)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono transition shrink-0 ${
                  localPath.toLowerCase() === jump.path.toLowerCase()
                    ? 'bg-sky-600/30 border-sky-500/50 text-sky-300 font-semibold'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {jump.label}
              </button>
            ))}
          </div>

          {/* Local Filter Bar */}
          <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-950/70 flex items-center gap-2 text-xs shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Filter local files..."
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
              className="flex-1 bg-transparent text-slate-300 font-mono text-[11px] placeholder:text-slate-600 focus:outline-none"
            />
            {localFilter && (
              <button onClick={() => setLocalFilter('')} className="text-slate-500 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowHiddenLocal(!showHiddenLocal)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition flex items-center gap-1 ${
                showHiddenLocal
                  ? 'bg-sky-600/20 border-sky-500/40 text-sky-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
              title={showHiddenLocal ? 'Hidden dotfiles shown. Click to hide.' : 'Hidden dotfiles hidden. Click to show.'}
            >
              {showHiddenLocal ? <Eye className="w-3 h-3 text-sky-400" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
              <span>{showHiddenLocal ? 'Hidden' : 'Show Hidden'}</span>
            </button>
          </div>

          <div
            onContextMenu={(e) => handleContextMenu(e, 'local', null)}
            className="flex-1 min-h-0 overflow-y-auto p-1 font-mono text-xs select-none"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800/60 text-[11px]">
                  <th className="py-1 px-2">Name</th>
                  <th className="py-1 px-2 text-right">Size</th>
                  <th className="py-1 px-2 text-right">Modified</th>
                  <th className="py-1 px-2 text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {localPath && (
                  <tr
                    onClick={navigateLocalUp}
                    onDoubleClick={navigateLocalUp}
                    onContextMenu={(e) => handleContextMenu(e, 'local', null)}
                    className="cursor-pointer hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
                  >
                    <td colSpan={4} className="py-1.5 px-2 flex items-center gap-2 font-semibold">
                      <CornerLeftUp className="w-3.5 h-3.5 text-sky-400" />
                      <span>.. (Parent Directory)</span>
                    </td>
                  </tr>
                )}
                {filteredLocalItems.map((item) => (
                  <tr
                    key={item.path}
                    draggable={true}
                    onContextMenu={(e) => handleContextMenu(e, 'local', item)}
                    onDragStart={(e) => handleDragStart(e, 'local', item)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if (draggedItem?.source === 'remote' && item.isDirectory) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropTargetFolder({ pane: 'local', path: item.path, name: item.name });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (dropTargetFolder?.path === item.path) {
                        e.stopPropagation();
                        setDropTargetFolder(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (draggedItem?.source === 'remote' && item.isDirectory) {
                        e.stopPropagation();
                        handleDropOnLocal(e, item);
                      }
                    }}
                    onClick={() => setSelectedLocal(item)}
                    onDoubleClick={() => handleLocalNavigate(item)}
                    className={`group cursor-pointer hover:bg-slate-800/60 transition ${
                      selectedLocal?.path === item.path ? 'bg-sky-600/20 text-sky-300' : ''
                    } ${
                      dropTargetFolder?.pane === 'local' && dropTargetFolder?.path === item.path
                        ? 'bg-sky-500/30 ring-2 ring-sky-400 font-semibold'
                        : ''
                    } ${
                      draggedItem?.source === 'local' && draggedItem?.item.path === item.path
                        ? 'opacity-40 border-dashed border-sky-500/50'
                        : ''
                    }`}
                  >
                    <td className="py-1 px-2 flex items-center gap-1.5 truncate">
                      <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-60 cursor-grab shrink-0" />
                      {item.isDirectory ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                      {item.isSymlink && (
                        <ExternalLink className="w-2.5 h-2.5 text-sky-400 shrink-0 opacity-70" title={`Links to: ${item.path}`} />
                      )}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-400 text-[11px]">
                      {item.isDirectory ? '-' : `${(item.size / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-500 text-[11px]">
                      {new Date(item.modifyTime).toLocaleDateString()}
                    </td>
                    <td className="py-1 px-2 text-right">
                      {item.isDirectory && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLocalNavigate(item);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] bg-sky-600/30 hover:bg-sky-600/60 text-sky-300 border border-sky-500/40"
                        >
                          Open
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Local Count Footer */}
          <div className="px-2.5 py-1 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between font-mono shrink-0">
            <span>{filteredLocalItems.filter((i) => i.isDirectory).length} dirs, {filteredLocalItems.filter((i) => !i.isDirectory).length} files</span>
            <span className="text-slate-500">{filteredLocalItems.length} items</span>
          </div>
        </div>

        {/* Right Pane: REMOTE */}
        <div
          onDragOver={(e) => handlePaneDragOver(e, 'remote')}
          onDragLeave={(e) => handlePaneDragLeave(e, 'remote')}
          onDrop={(e) => handleDropOnRemote(e, null)}
          className={`relative flex flex-col h-full min-h-0 overflow-hidden bg-slate-950/40 transition-colors ${
            dragOverPane === 'remote' ? 'ring-2 ring-emerald-500/80 bg-emerald-950/20' : ''
          }`}
        >
          {/* Remote Drop Overlay */}
          {dragOverPane === 'remote' && (
            <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-[2px] flex flex-col items-center justify-center border-2 border-dashed border-emerald-400 rounded z-30 pointer-events-none p-4 text-center">
              <Upload className="w-10 h-10 text-emerald-400 animate-bounce mb-2" />
              <span className="font-bold text-emerald-200 text-sm">
                Drop here to upload {draggedItem ? `"${draggedItem.item.name}"` : 'to Remote'}
              </span>
              <span className="text-emerald-300/70 text-xs font-mono mt-1 max-w-full truncate px-4">
                Target: {dropTargetFolder?.pane === 'remote' ? dropTargetFolder.path : remotePath}
              </span>
            </div>
          )}

          {/* Remote Path Header */}
          <div className="p-2 border-b border-slate-800 bg-slate-900/60 flex items-center gap-1.5 text-xs shrink-0">
            <Server className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-[11px] mr-1">REMOTE</span>
            <button
              onClick={navigateRemoteUp}
              disabled={!remotePath || remotePath === '/' || remotePath === '.'}
              title="Go to parent directory"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white border border-slate-700"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refreshRemote(remotePath)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => refreshRemote(remotePath)}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold border border-slate-700"
            >
              Go
            </button>
            <button
              onClick={() => handleOpenCreateFolderModal('remote')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold transition shrink-0"
              title="Create new directory in current remote directory"
            >
              <FolderPlus className="w-3.5 h-3.5 text-emerald-300" />
              <span>New Folder</span>
            </button>
          </div>

          {/* Remote Quick Jumps Bar */}
          <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-1">Jump:</span>
            {remoteQuickJumps.map((jump) => (
              <button
                key={jump.label}
                onClick={() => refreshRemote(jump.path)}
                className={`px-2 py-0.5 rounded border text-[11px] font-mono transition ${
                  remotePath === jump.path
                    ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {jump.label}
              </button>
            ))}
          </div>

          {/* Remote Filter Bar */}
          <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-950/70 flex items-center gap-2 text-xs shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Filter remote files..."
              value={remoteFilter}
              onChange={(e) => setRemoteFilter(e.target.value)}
              className="flex-1 bg-transparent text-slate-300 font-mono text-[11px] placeholder:text-slate-600 focus:outline-none"
            />
            {remoteFilter && (
              <button onClick={() => setRemoteFilter('')} className="text-slate-500 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowHiddenRemote(!showHiddenRemote)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition flex items-center gap-1 ${
                showHiddenRemote
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
              title={showHiddenRemote ? 'Hidden dotfiles shown. Click to hide.' : 'Hidden dotfiles hidden. Click to show.'}
            >
              {showHiddenRemote ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3 text-slate-500" />}
              <span>{showHiddenRemote ? 'Hidden' : 'Show Hidden'}</span>
            </button>
          </div>

          <div
            onContextMenu={(e) => handleContextMenu(e, 'remote', null)}
            className="flex-1 min-h-0 overflow-y-auto p-1 font-mono text-xs select-none"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800/60 text-[11px]">
                  <th className="py-1 px-2">Name</th>
                  <th className="py-1 px-2 text-right">Size</th>
                  <th className="py-1 px-2 text-right">Perms</th>
                  <th className="py-1 px-2 text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {remotePath !== '/' && remotePath !== '.' && (
                  <tr
                    onClick={navigateRemoteUp}
                    onDoubleClick={navigateRemoteUp}
                    onContextMenu={(e) => handleContextMenu(e, 'remote', null)}
                    className="cursor-pointer hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
                  >
                    <td colSpan={4} className="py-1.5 px-2 flex items-center gap-2 font-semibold">
                      <CornerLeftUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>.. (Parent Directory)</span>
                    </td>
                  </tr>
                )}
                {filteredRemoteItems.map((item) => (
                  <tr
                    key={item.path}
                    draggable={true}
                    onContextMenu={(e) => handleContextMenu(e, 'remote', item)}
                    onDragStart={(e) => handleDragStart(e, 'remote', item)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => {
                      if ((draggedItem?.source === 'local' || !draggedItem) && item.isDirectory) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDropTargetFolder({ pane: 'remote', path: item.path, name: item.name });
                      }
                    }}
                    onDragLeave={(e) => {
                      if (dropTargetFolder?.path === item.path) {
                        e.stopPropagation();
                        setDropTargetFolder(null);
                      }
                    }}
                    onDrop={(e) => {
                      if (item.isDirectory) {
                        e.stopPropagation();
                        handleDropOnRemote(e, item);
                      }
                    }}
                    onClick={() => setSelectedRemote(item)}
                    onDoubleClick={() => handleRemoteNavigate(item)}
                    className={`group cursor-pointer hover:bg-slate-800/60 transition ${
                      selectedRemote?.path === item.path ? 'bg-emerald-600/20 text-emerald-300' : ''
                    } ${
                      dropTargetFolder?.pane === 'remote' && dropTargetFolder?.path === item.path
                        ? 'bg-emerald-500/30 ring-2 ring-emerald-400 font-semibold'
                        : ''
                    } ${
                      draggedItem?.source === 'remote' && draggedItem?.item.path === item.path
                        ? 'opacity-40 border-dashed border-emerald-500/50'
                        : ''
                    }`}
                  >
                    <td className="py-1 px-2 flex items-center gap-1.5 truncate">
                      <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-60 cursor-grab shrink-0" />
                      {item.isDirectory ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </td>
                    <td className="py-1 px-2 text-right text-slate-400 text-[11px]">
                      {item.isDirectory ? '-' : `${(item.size / 1024).toFixed(1)} KB`}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-500 text-[11px]">
                      {item.permissions}
                    </td>
                    <td className="py-1 px-2 text-right">
                      {item.isDirectory ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoteNavigate(item);
                          }}
                          className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded text-[10px] bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-500/40"
                        >
                          Open
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                          {(item.permissions?.startsWith('070') || item.permissions?.startsWith('071') || item.permissions === '0711' || item.permissions === '0700') && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await (window as any).dgodterm.fixPermissions(sessionId, item.path, '0644');
                                  refreshRemote(remotePath);
                                } catch (err: any) {
                                  setErrorMsg(`Failed to fix permissions: ${err.message}`);
                                }
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 font-semibold"
                              title="Grant Read Permission (sudo chmod 644)"
                            >
                              Sudo Chmod
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const sep = localPath.includes('\\') ? '\\' : '/';
                              const destLocal = `${localPath.replace(/[/\\]$/, '')}${sep}${item.name}`;
                              executeDownload(item.path, destLocal, item.name);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-sky-600/30 hover:bg-sky-600/60 text-sky-200 border border-sky-500/40"
                          >
                            Download
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Remote Count Footer */}
          <div className="px-2.5 py-1 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400 flex items-center justify-between font-mono shrink-0">
            <span>{filteredRemoteItems.filter((i) => i.isDirectory).length} dirs, {filteredRemoteItems.filter((i) => !i.isDirectory).length} files</span>
            <span className="text-slate-500">{filteredRemoteItems.length} items</span>
          </div>
        </div>
      </div>

      {/* Clean Footer Status Bar */}
      <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs min-h-[38px]">
        <div className="flex items-center gap-3">
          {clipboardItem ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-950/60 border border-emerald-700/60 rounded-lg text-xs animate-in fade-in">
              <span className="text-[11px] text-emerald-300">
                Copied: <span className="font-semibold text-white font-mono">{clipboardItem.item.name}</span> ({clipboardItem.pane})
              </span>
              <span className="text-slate-400 text-[10px]">&bull; Right-click anywhere to Paste</span>
              <button
                onClick={() => setClipboardItem(null)}
                className="p-0.5 rounded text-emerald-400 hover:text-white"
                title="Clear clipboard"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              <span>Right-click any file, folder, or empty space to perform actions</span>
            </div>
          )}
        </div>

        {/* Transfer status list */}
        <div className="flex items-center gap-2">
          {transfers.slice(-2).map((t) => (
            <div
              key={t.id}
              onClick={() => {
                const isDl = t.direction === 'download';
                setActiveModal({
                  isOpen: true,
                  isMinimized: false,
                  id: t.id,
                  name: t.name,
                  direction: t.direction,
                  sourcePath: isDl ? `${remotePath.replace(/\/$/, '')}/${t.name}` : `${localPath}/${t.name}`,
                  destPath: isDl ? `${localPath}/${t.name}` : `${remotePath.replace(/\/$/, '')}/${t.name}`,
                  transferredBytes: (t.progress / 100) * 1024 * 1024,
                  totalBytes: 1024 * 1024,
                  speedBytesPerSec: 0,
                  progressPercent: t.progress,
                  status: t.status,
                  sha256: t.sha256
                });
              }}
              className={`flex items-center gap-2 px-2.5 py-1 rounded border text-[11px] cursor-pointer hover:brightness-125 transition ${
                t.status === 'completed'
                  ? 'bg-slate-950 border-emerald-900/60 text-slate-200'
                  : t.status === 'failed'
                  ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
              title="Click to view full transfer details"
            >
              {t.status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : t.status === 'failed' ? (
                <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-sky-400 border-t-transparent animate-spin shrink-0" />
              )}
              <span className="truncate max-w-[130px]" title={t.name}>{t.name}</span>
              {t.status === 'transferring' && (
                <span className="text-[10px] text-sky-400 font-mono font-semibold">
                  {t.progress}%
                </span>
              )}
              {t.status === 'completed' && t.sha256 && (
                <span className="text-[9px] text-emerald-400 font-mono" title={`SHA256: ${t.sha256}`}>
                  SHA-OK
                </span>
              )}
              {t.status === 'failed' && (
                <span className="text-[9px] text-rose-400 font-mono font-semibold">
                  FAILED
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Progress Dialogue Modal */}
      {activeModal && activeModal.isOpen && !activeModal.isMinimized && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl p-6 text-slate-200 backdrop-blur-md">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  activeModal.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : activeModal.status === 'failed'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : activeModal.status === 'needs_sudo'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                }`}>
                  {activeModal.status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : activeModal.status === 'failed' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : activeModal.status === 'needs_sudo' ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : activeModal.direction === 'upload' ? (
                    <Upload className="w-6 h-6 animate-pulse" />
                  ) : (
                    <Download className="w-6 h-6 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {activeModal.status === 'completed'
                      ? 'Transfer Complete'
                      : activeModal.status === 'failed'
                      ? 'Transfer Failed'
                      : activeModal.status === 'needs_sudo'
                      ? 'Root Privileges Required'
                      : activeModal.direction === 'upload'
                      ? 'Uploading to Remote...'
                      : 'Downloading from Remote...'}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono truncate max-w-[340px]" title={activeModal.name}>
                    {activeModal.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeModal.status === 'transferring' && (
                  <button
                    onClick={() => setActiveModal((prev) => prev ? { ...prev, isMinimized: true } : null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Minimize to background"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Path routing display */}
            <div className="my-4 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs font-mono flex items-center justify-between">
              <div className="truncate max-w-[45%]" title={activeModal.sourcePath}>
                <span className="text-slate-500 block text-[10px] font-sans font-bold uppercase tracking-wider">From</span>
                <span className="text-slate-300 truncate">{activeModal.sourcePath}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 mx-2" />
              <div className="truncate max-w-[45%]" title={activeModal.destPath}>
                <span className="text-slate-500 block text-[10px] font-sans font-bold uppercase tracking-wider">To</span>
                <span className="text-slate-300 truncate">{activeModal.destPath}</span>
              </div>
            </div>

            {/* Sudo Password Input Prompt (if status === 'needs_sudo') */}
            {activeModal.status === 'needs_sudo' ? (
              <div className="my-4 p-4 rounded-xl bg-amber-950/30 border border-amber-600/50 space-y-3">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>File is protected on remote system. Enter sudo password to unlock and continue:</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSudoPass ? 'text' : 'password'}
                      value={inlineSudoPass}
                      onChange={(e) => setInlineSudoPass(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          executeDownload(activeModal.sourcePath, activeModal.destPath, activeModal.name, inlineSudoPass.trim());
                          setInlineSudoPass('');
                        }
                      }}
                      placeholder="Enter sudo password for elevation"
                      className="w-full bg-slate-950 border border-amber-600/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowSudoPass(!showSudoPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showSudoPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      executeDownload(activeModal.sourcePath, activeModal.destPath, activeModal.name, inlineSudoPass.trim());
                      setInlineSudoPass('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Unlock & Transfer</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Large Progress Indicator */}
                <div className="my-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-3xl font-black font-mono tracking-tight text-white">
                      {activeModal.progressPercent}%
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {formatBytes(activeModal.transferredBytes)} / {formatBytes(activeModal.totalBytes)}
                    </span>
                  </div>

                  {/* High Performance Glowing Progress Bar */}
                  <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        activeModal.status === 'completed'
                          ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                          : activeModal.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400 shadow-[0_0_12px_rgba(56,189,248,0.5)] animate-pulse'
                      }`}
                      style={{ width: `${Math.max(2, activeModal.progressPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Performance Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 my-4">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block tracking-wider">Transfer Rate</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {activeModal.status === 'completed'
                        ? 'Transfer Finished'
                        : formatSpeed(activeModal.speedBytesPerSec)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block tracking-wider">Estimated Time</span>
                    <span className="text-sm font-bold font-mono text-sky-300">
                      {activeModal.status === 'completed'
                        ? '0s remaining'
                        : formatEta(activeModal.totalBytes, activeModal.transferredBytes, activeModal.speedBytesPerSec)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 col-span-2">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block tracking-wider">Engine & Algorithm</span>
                    <span className="text-xs font-mono text-slate-300 flex items-center justify-between">
                      <span>OpenSSH Concurrent Pipelining</span>
                      <span className="text-emerald-400 text-[11px] font-bold">64 Streams @ 32KB Payloads</span>
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Error Message if Failed */}
            {activeModal.status === 'failed' && activeModal.errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="break-all">{activeModal.errorMessage}</span>
              </div>
            )}

            {/* SHA256 Verification if Completed */}
            {activeModal.status === 'completed' && activeModal.sha256 && (
              <div className="p-3 mb-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-xs text-emerald-300">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SHA-256 Checksum Verified:</span>
                </div>
                <div className="font-mono text-[10px] text-slate-300 break-all select-all bg-slate-950/80 p-1.5 rounded border border-slate-800">
                  {activeModal.sha256}
                </div>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                {activeModal.status === 'transferring' ? 'Transfer in progress...' : ''}
              </span>
              <div className="flex items-center gap-2">
                {activeModal.status === 'transferring' && (
                  <button
                    onClick={() => setActiveModal((prev) => prev ? { ...prev, isMinimized: true } : null)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                  >
                    Minimize
                  </button>
                )}
                {(activeModal.status === 'completed' || activeModal.status === 'failed') && (
                  <button
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overwrite / Delete Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-500/50 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-300 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.action}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder / Directory Modal */}
      {createFolderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => !creatingFolder && setCreateFolderModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl p-6 text-slate-200 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
              <div className={`p-2.5 rounded-xl ${
                createFolderModal.target === 'local'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                <FolderPlus className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-white truncate">
                  {createFolderModal.target === 'local' ? 'Create Local Folder' : 'Create Remote Directory'}
                </h3>
                <p className="text-xs text-slate-400 truncate" title={createFolderModal.parentDir}>
                  Inside: <span className="font-mono text-slate-300">{createFolderModal.parentDir}</span>
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateFolderSubmit();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {createFolderModal.target === 'local' ? 'Folder Name:' : 'Directory Name:'}
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. projects, new-dir, backup"
                  value={newFolderName}
                  onChange={(e) => {
                    setNewFolderName(e.target.value);
                    if (folderCreationError) setFolderCreationError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !creatingFolder) {
                      setCreateFolderModal(null);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>

              {folderCreationError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="break-all">{folderCreationError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={creatingFolder}
                  onClick={() => setCreateFolderModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition flex items-center gap-1.5 shadow ${
                    createFolderModal.target === 'local'
                      ? 'bg-sky-600 hover:bg-sky-500 disabled:opacity-50'
                      : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50'
                  }`}
                >
                  {creatingFolder && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{creatingFolder ? 'Creating...' : 'Create Folder'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && contextMenu.visible && (
        <div
          className="fixed inset-0 z-50 select-none"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`
            }}
            onClick={(e) => e.stopPropagation()}
            className="absolute min-w-[220px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 z-50 animate-in fade-in duration-100"
          >
            {/* Header info */}
            <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between gap-2">
              <span className="truncate max-w-[140px] font-semibold text-slate-200" title={contextMenu.item ? contextMenu.item.name : (contextMenu.pane === 'local' ? localPath : remotePath)}>
                {contextMenu.item ? contextMenu.item.name : (contextMenu.pane === 'local' ? 'Local Directory' : 'Remote Directory')}
              </span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${
                contextMenu.pane === 'local' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {contextMenu.pane}
              </span>
            </div>

            {/* Context menu for an item (file or folder) */}
            {contextMenu.item && (
              <>
                {/* Open directory */}
                {contextMenu.item.isDirectory && (
                  <button
                    onClick={() => {
                      if (contextMenu.pane === 'local') {
                        handleLocalNavigate(contextMenu.item!);
                      } else {
                        handleRemoteNavigate(contextMenu.item!);
                      }
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open {contextMenu.pane === 'local' ? 'Folder' : 'Directory'}</span>
                  </button>
                )}

                {/* Transfer Actions */}
                {contextMenu.pane === 'local' ? (
                  <button
                    onClick={() => {
                      handleUploadItem(contextMenu.item!);
                      setContextMenu(null);
                    }}
                    disabled={contextMenu.item.isDirectory}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white disabled:opacity-40 transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Upload to Remote</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        handleDownloadItem(contextMenu.item!);
                        setContextMenu(null);
                      }}
                      disabled={contextMenu.item.isDirectory}
                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white disabled:opacity-40 transition"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download to Local</span>
                    </button>
                    {!contextMenu.item.isDirectory && (
                      <button
                        onClick={() => {
                          const sep = localPath.includes('\\') ? '\\' : '/';
                          const dest = `${localPath.replace(/[/\\]$/, '')}${sep}${contextMenu.item!.name}`;
                          executeDownload(contextMenu.item!.path, dest, contextMenu.item!.name, inlineSudoPass || undefined);
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 text-amber-300 transition"
                        title="Download with sudo privileges"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Unlock with Sudo & Download</span>
                      </button>
                    )}
                  </>
                )}

                {/* New folder inside directory */}
                {contextMenu.item.isDirectory && (
                  <button
                    onClick={() => {
                      setCreateFolderModal({
                        target: contextMenu.pane,
                        parentDir: contextMenu.item!.path
                      });
                      setNewFolderName('');
                      setFolderCreationError('');
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-slate-400" />
                    <span>New Folder Inside...</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    handleOpenCreateFolderModal(contextMenu.pane);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                >
                  <FolderPlus className={`w-3.5 h-3.5 ${contextMenu.pane === 'local' ? 'text-sky-400' : 'text-emerald-400'}`} />
                  <span>New {contextMenu.pane === 'local' ? 'Folder' : 'Directory'} in Current Path...</span>
                </button>

                {/* Edit Remote File */}
                {contextMenu.pane === 'remote' && !contextMenu.item.isDirectory && (
                  <button
                    onClick={() => {
                      setEditingRemotePath(contextMenu.item!.path);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition font-medium text-amber-300"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit File (Remote Editor)</span>
                  </button>
                )}

                <div className="h-px bg-slate-800/80 my-1" />

                {/* File / Folder Copy & Paste */}
                <button
                  onClick={() => {
                    setClipboardItem({
                      pane: contextMenu.pane,
                      item: contextMenu.item!
                    });
                    copyToClipboard(contextMenu.item!.path);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition font-medium text-sky-300"
                >
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>Copy {contextMenu.item.isDirectory ? 'Folder' : 'File'}</span>
                </button>

                {clipboardItem ? (
                  <button
                    onClick={() => {
                      handlePaste(contextMenu.pane, contextMenu.item?.isDirectory ? contextMenu.item.path : undefined);
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition font-medium text-emerald-300"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate">
                      {contextMenu.item.isDirectory
                        ? `Paste into "${contextMenu.item.name}"`
                        : `Paste "${clipboardItem.item.name}" Here`}
                    </span>
                  </button>
                ) : (
                  <div className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-slate-500 cursor-not-allowed text-[11px]">
                    <ClipboardPaste className="w-3.5 h-3.5 text-slate-600" />
                    <span>Paste (Clipboard empty)</span>
                  </div>
                )}

                <div className="h-px bg-slate-800/80 my-1" />

                {/* Path Copy Actions */}
                <button
                  onClick={() => {
                    copyToClipboard(contextMenu.item!.path);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition text-slate-300"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Full Path</span>
                </button>
                <button
                  onClick={() => {
                    copyToClipboard(contextMenu.item!.name);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition text-slate-300"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Name</span>
                </button>

                <div className="h-px bg-slate-800/80 my-1" />

                {/* Delete Item */}
                <button
                  onClick={() => {
                    if (contextMenu.pane === 'local') {
                      handleDeleteLocal(contextMenu.item!);
                    } else {
                      handleDeleteRemote(contextMenu.item!);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Delete {contextMenu.item.isDirectory ? 'Folder' : 'File'}</span>
                </button>
              </>
            )}

            {/* Context menu for empty area */}
            {!contextMenu.item && (
              <>
                {clipboardItem ? (
                  <>
                    <button
                      onClick={() => {
                        handlePaste(contextMenu.pane);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition font-medium text-emerald-300"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="truncate">Paste &ldquo;{clipboardItem.item.name}&rdquo; Here</span>
                    </button>
                    <div className="h-px bg-slate-800/80 my-1" />
                  </>
                ) : (
                  <>
                    <div className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-slate-500 cursor-not-allowed text-[11px]">
                      <ClipboardPaste className="w-3.5 h-3.5 text-slate-600" />
                      <span>Paste (Clipboard empty)</span>
                    </div>
                    <div className="h-px bg-slate-800/80 my-1" />
                  </>
                )}

                <button
                  onClick={() => {
                    handleOpenCreateFolderModal(contextMenu.pane);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                >
                  <FolderPlus className={`w-3.5 h-3.5 ${contextMenu.pane === 'local' ? 'text-sky-400' : 'text-emerald-400'}`} />
                  <span>New {contextMenu.pane === 'local' ? 'Folder' : 'Directory'}...</span>
                </button>

                <button
                  onClick={() => {
                    if (contextMenu.pane === 'local') refreshLocal();
                    else refreshRemote(remotePath);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={() => {
                    copyToClipboard(contextMenu.pane === 'local' ? localPath : remotePath);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Directory Path</span>
                </button>

                <button
                  onClick={() => {
                    if (contextMenu.pane === 'local') navigateLocalUp();
                    else navigateRemoteUp();
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-800 hover:text-white transition"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Go Up One Level</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* In-SFTP Password Modal */}
      {showPasswordModal && (
        <PasswordPromptModal
          profile={profile}
          promptText={passwordPromptText}
          onSubmit={handlePasswordSubmit}
          onCancel={() => setShowPasswordModal(false)}
        />
      )}

      {/* Remote File Editor Modal */}
      {editingRemotePath && (
        <RemoteFileEditorModal
          sessionId={sessionId}
          remotePath={editingRemotePath}
          onClose={() => setEditingRemotePath(null)}
          onSaveSuccess={() => refreshRemote(remotePath)}
        />
      )}
    </div>
  );
};
