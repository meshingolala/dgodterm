import os from 'os';
import fs from 'fs';

export interface HostSystemResources {
  cpuPercent: number;
  ramUsedGB: number;
  ramTotalGB: number;
  ramPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  diskPercent: number;
}

let lastCpuMeasure: { idle: number; total: number } | null = null;

export function getHostSystemResources(): HostSystemResources {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const ramTotalGB = parseFloat((totalMem / (1024 ** 3)).toFixed(1));
  const ramUsedGB = parseFloat((usedMem / (1024 ** 3)).toFixed(1));
  const ramPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t in cpu.times) {
      total += (cpu.times as any)[t];
    }
    idle += cpu.times.idle;
  }

  let cpuPercent = 0;
  if (lastCpuMeasure) {
    const idleDiff = idle - lastCpuMeasure.idle;
    const totalDiff = total - lastCpuMeasure.total;
    cpuPercent = totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
  } else {
    const load = os.loadavg();
    if (load && load[0] > 0 && cpus.length > 0) {
      cpuPercent = Math.round((load[0] / cpus.length) * 100);
    }
  }
  lastCpuMeasure = { idle, total };

  let diskTotalGB = 0;
  let diskUsedGB = 0;
  let diskPercent = 0;
  try {
    const root = process.platform === 'win32' ? process.cwd().slice(0, 3) : '/';
    const stat = fs.statfsSync(root);
    const totalBytes = stat.blocks * stat.bsize;
    const freeBytes = stat.bavail * stat.bsize;
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    diskTotalGB = parseFloat((totalBytes / (1024 ** 3)).toFixed(1));
    diskUsedGB = parseFloat((usedBytes / (1024 ** 3)).toFixed(1));
    diskPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
  } catch {
    // fallback if drive root is inaccessible
  }

  return {
    cpuPercent: Math.max(0, Math.min(100, cpuPercent)),
    ramUsedGB,
    ramTotalGB,
    ramPercent,
    diskUsedGB,
    diskTotalGB,
    diskPercent
  };
}
