import React, { useEffect, useState, useRef } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  RefreshCw,
  X,
  Server,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { SystemHealthMetrics } from '../../domain/types';

interface HealthMonitorWidgetProps {
  sessionId: string;
  hostname: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const HealthMonitorWidget: React.FC<HealthMonitorWidgetProps> = ({
  sessionId,
  hostname,
  isExpanded,
  onToggleExpand
}) => {
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPoll, setAutoPoll] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await (window as any).dgodterm.getSystemHealth(sessionId);
      if (res) {
        setMetrics(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    if (!autoPoll) return;
    const interval = setInterval(() => {
      fetchMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId, autoPoll]);

  if (!metrics && !loading && error) {
    return (
      <div className="px-3 py-1 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="flex items-center gap-1 text-slate-400">
          <Activity className="w-3 h-3 text-slate-500" /> Remote metrics idle
        </span>
        <button
          onClick={fetchMetrics}
          className="text-sky-400 hover:text-white underline cursor-pointer"
        >
          Sample Telemetry
        </button>
      </div>
    );
  }

  const cpu = metrics?.cpuUsagePercent ?? 0;
  const mem = metrics?.memory?.usagePercent ?? 0;
  const disk = metrics?.disk?.usagePercent ?? 0;

  return (
    <div className="bg-slate-950/80 border-b border-slate-800 text-xs text-slate-300 transition-all select-none">
      {/* Top Telemetry Strip */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Uptime */}
          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{metrics?.uptime || 'up --'}</span>
          </div>

          {/* Load Avg */}
          {metrics && (
            <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
              <span className="text-slate-500 font-semibold">Load:</span>
              <span className="text-slate-200">
                {metrics.loadAverage[0].toFixed(2)}, {metrics.loadAverage[1].toFixed(2)}, {metrics.loadAverage[2].toFixed(2)}
              </span>
            </div>
          )}

          {/* CPU Sparkline / Bar */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] text-slate-400">CPU</span>
            <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  cpu > 80 ? 'bg-rose-500' : cpu > 50 ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, cpu))}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-slate-200 font-semibold w-7 text-right">
              {cpu}%
            </span>
          </div>

          {/* Memory Sparkline / Bar */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] text-slate-400">RAM</span>
            <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  mem > 85 ? 'bg-rose-500' : mem > 60 ? 'bg-amber-400' : 'bg-indigo-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, mem))}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-slate-200 font-semibold w-7 text-right">
              {mem}%
            </span>
            {metrics?.memory && (
              <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                ({formatBytes(metrics.memory.usedBytes)}/{formatBytes(metrics.memory.totalBytes)})
              </span>
            )}
          </div>

          {/* Disk Space */}
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-400">Disk /</span>
            <div className="w-14 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  disk > 90 ? 'bg-rose-500' : disk > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, disk))}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-slate-200 font-semibold w-7 text-right">
              {disk}%
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title="Refresh System Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
          <button
            onClick={onToggleExpand}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1 text-[11px]"
            title={isExpanded ? 'Collapse Process View' : 'Expand Top Processes'}
          >
            <span>{isExpanded ? 'Processes' : 'Processes'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Top Processes Table */}
      {isExpanded && metrics?.topProcesses && (
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
            <span className="font-bold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" /> Top Active Remote Processes
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Polled agentlessly via POSIX batch
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800/60 pb-1">
                  <th className="py-1">PID</th>
                  <th>USER</th>
                  <th>CPU %</th>
                  <th>MEM %</th>
                  <th>COMMAND</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {metrics.topProcesses.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-slate-800/40 text-slate-300">
                    <td className="py-1 text-slate-400 font-semibold">{proc.pid}</td>
                    <td className="text-slate-400">{proc.user}</td>
                    <td className={`font-bold ${proc.cpuPercent > 50 ? 'text-rose-400' : 'text-sky-300'}`}>
                      {proc.cpuPercent.toFixed(1)}%
                    </td>
                    <td className="text-slate-400">{proc.memPercent.toFixed(1)}%</td>
                    <td className="text-white truncate max-w-xs">{proc.command}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
