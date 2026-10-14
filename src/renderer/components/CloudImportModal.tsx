import React, { useState } from 'react';
import {
  Cloud,
  Search,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Server,
  FolderPlus,
  Key,
  Globe
} from 'lucide-react';

interface CloudInstanceItem {
  id: string;
  name: string;
  publicIp?: string;
  privateIp?: string;
  region: string;
  status: string;
  tags: string[];
  os?: string;
  provider: 'digitalocean' | 'hetzner' | 'linode' | 'aws';
}

interface CloudImportModalProps {
  onClose: () => void;
  onImported?: () => void;
}

export const CloudImportModal: React.FC<CloudImportModalProps> = ({ onClose, onImported }) => {
  const [provider, setProvider] = useState<'digitalocean' | 'hetzner' | 'linode' | 'aws'>('digitalocean');
  const [token, setToken] = useState('');
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('us-east-1');

  // Discovery results & import settings
  const [instances, setInstances] = useState<CloudInstanceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('root');
  const [port, setPort] = useState(22);
  const [folderName, setFolderName] = useState('DigitalOcean Droplets');
  const [useIp, setUseIp] = useState<'public' | 'private'>('public');
  const [search, setSearch] = useState('');
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null);

  const handleProviderChange = (p: 'digitalocean' | 'hetzner' | 'linode' | 'aws') => {
    setProvider(p);
    setInstances([]);
    setSelectedIds([]);
    setError(null);
    setImportSummary(null);
    if (p === 'digitalocean') setFolderName('DigitalOcean Droplets');
    else if (p === 'hetzner') setFolderName('Hetzner Cloud');
    else if (p === 'linode') setFolderName('Linode Servers');
    else if (p === 'aws') setFolderName('AWS EC2');
  };

  const handleDiscover = async () => {
    setLoading(true);
    setError(null);
    setImportSummary(null);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('cloud:discover', {
        provider,
        token: token.trim() || undefined,
        accessKeyId: awsAccessKey.trim() || undefined,
        secretAccessKey: awsSecretKey.trim() || undefined,
        region: awsRegion
      });

      if (res?.error) {
        setError(res.error);
      } else {
        setInstances(res?.instances || []);
        setSelectedIds((res?.instances || []).map((i: any) => i.id));
      }
    } catch (err: any) {
      setError(err.message || 'Discovery failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const toImport = instances.filter((i) => selectedIds.includes(i.id));
    if (toImport.length === 0) return;

    setLoading(true);
    try {
      const res = await (window as any).dgodterm?.invokeFeature('cloud:import', {
        instances: toImport,
        username,
        port,
        folderName,
        useIp
      });

      setImportSummary(res);
      if (onImported) onImported();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const filtered = instances.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.publicIp && i.publicIp.includes(search)) ||
    (i.privateIp && i.privateIp.includes(search))
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl max-w-4xl w-full shadow-2xl flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-800/80 text-sky-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                Cloud Provider Auto-Discovery & VM Importer
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 uppercase font-mono">
                  {provider}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Connect your cloud provider to auto-discover droplets/instances and organize into connection profiles
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provider Tabs */}
        <div className="px-5 py-2 border-b border-slate-800 bg-slate-950/40 flex gap-1 shrink-0">
          {(['digitalocean', 'hetzner', 'linode', 'aws'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={`px-3 py-1.5 rounded uppercase font-semibold text-[11px] transition cursor-pointer ${
                provider === p
                  ? 'bg-sky-600 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {p === 'digitalocean' ? 'DigitalOcean' : p === 'hetzner' ? 'Hetzner' : p === 'linode' ? 'Linode' : 'AWS EC2'}
            </button>
          ))}
        </div>

        {/* Credentials Form */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3 shrink-0">
          {provider !== 'aws' ? (
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                {provider === 'digitalocean' ? 'DigitalOcean Personal Access Token' : provider === 'hetzner' ? 'Hetzner Cloud API Token' : 'Linode Personal Access Token'} *
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste read-only API token..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-sky-500"
                />
                <button
                  onClick={handleDiscover}
                  disabled={loading || !token.trim()}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{loading ? 'Discovering...' : 'Discover'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">AWS Access Key ID *</label>
                  <input
                    type="text"
                    value={awsAccessKey}
                    onChange={(e) => setAwsAccessKey(e.target.value)}
                    placeholder="AKIA..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">AWS Secret Key *</label>
                  <input
                    type="password"
                    value={awsSecretKey}
                    onChange={(e) => setAwsSecretKey(e.target.value)}
                    placeholder="wJalr..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 text-[11px]">Region</label>
                  <input
                    type="text"
                    value={awsRegion}
                    onChange={(e) => setAwsRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleDiscover}
                  disabled={loading || !awsAccessKey || !awsSecretKey}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{loading ? 'Querying EC2...' : 'Discover Instances'}</span>
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-500">
            Note: Tokens are used strictly in-memory during discovery and are never stored to disk or SQLite.
          </p>
        </div>

        {/* Error / Summary Banner */}
        {error && (
          <div className="px-5 py-2.5 bg-rose-950/40 border-b border-rose-900/60 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {importSummary && (
          <div className="px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-900/60 text-emerald-300 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Successfully imported {importSummary.imported} host(s) ({importSummary.skipped} skipped duplicates).</span>
            </div>
          </div>
        )}

        {/* Body Split */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Instance List */}
          <div className="flex-1 overflow-y-auto border-r border-slate-800">
            {instances.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Enter your credentials above and click "Discover" to fetch instances.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === instances.length && instances.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(instances.map((i) => i.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th className="py-2 px-3 font-medium">Instance Name</th>
                    <th className="py-2 px-3 font-medium">IP Addresses</th>
                    <th className="py-2 px-3 font-medium">Region / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filtered.map((inst) => {
                    const isChecked = selectedIds.includes(inst.id);
                    return (
                      <tr key={inst.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, inst.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== inst.id));
                            }}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-200">{inst.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{inst.os || inst.id}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {inst.publicIp && <div className="text-emerald-400">pub: {inst.publicIp}</div>}
                          {inst.privateIp && <div className="text-slate-400">priv: {inst.privateIp}</div>}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-slate-300">{inst.region}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{inst.status}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Import Config Sidebar */}
          <div className="w-80 p-4 bg-slate-950/60 flex flex-col space-y-3 shrink-0">
            <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4 text-sky-400" />
              <span>Import Configuration</span>
            </h3>

            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">Folder Destination</label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">Default Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ubuntu"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 text-[11px]">SSH Port</label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">Target IP Address</label>
              <div className="flex gap-2 text-slate-300 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="useIp"
                    checked={useIp === 'public'}
                    onChange={() => setUseIp('public')}
                  />
                  <span>Public IP</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="useIp"
                    checked={useIp === 'private'}
                    onChange={() => setUseIp('private')}
                  />
                  <span>Private IP</span>
                </label>
              </div>
            </div>

            <div className="pt-4 mt-auto">
              <button
                onClick={handleImport}
                disabled={loading || selectedIds.length === 0}
                className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-slate-950 font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md text-xs"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Import {selectedIds.length} Selected VM(s)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
