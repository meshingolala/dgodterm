import cp, { ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';

let ptyModule: typeof import('node-pty') | null = null;
try {
  ptyModule = require('node-pty');
} catch (err) {
  console.warn('[LocalTerminalManager] node-pty not available, will use fallback child_process:', err);
}

export interface LocalShellDescriptor {
  id: string;
  name: string;
  command: string;
  args: string[];
}

interface ActiveLocalSession {
  ptyProcess?: import('node-pty').IPty;
  fallbackProcess?: ChildProcessWithoutNullStreams;
  shellType: string;
}

export class LocalTerminalManager {
  private static instance: LocalTerminalManager;
  private sessions: Map<string, ActiveLocalSession> = new Map();

  private constructor() {}

  public static getInstance(): LocalTerminalManager {
    if (!LocalTerminalManager.instance) {
      LocalTerminalManager.instance = new LocalTerminalManager();
    }
    return LocalTerminalManager.instance;
  }

  public getAvailableShells(): LocalShellDescriptor[] {
    const isWin = process.platform === 'win32';
    if (!isWin) {
      return [
        { id: 'bash', name: 'Bash Shell', command: '/bin/bash', args: ['-i'] },
        { id: 'sh', name: 'Standard Shell', command: '/bin/sh', args: ['-i'] }
      ];
    }

    const shells: LocalShellDescriptor[] = [];

    // Check if PowerShell 7 (pwsh) is present
    let pwshAvailable = false;
    try {
      const check = cp.spawnSync('where.exe', ['pwsh'], { encoding: 'utf8' });
      pwshAvailable = check.status === 0;
    } catch {}

    // 1. PowerShell (Prefer pwsh.exe if installed, fallback to powershell.exe)
    shells.push({
      id: 'powershell',
      name: pwshAvailable ? 'PowerShell 7' : 'PowerShell',
      command: pwshAvailable ? 'pwsh.exe' : 'powershell.exe',
      args: ['-NoLogo']
    });

    // 2. Command Prompt (cmd)
    shells.push({
      id: 'cmd',
      name: 'Command Prompt',
      command: 'cmd.exe',
      args: []
    });

    // 3. WSL2 (Windows Subsystem for Linux)
    shells.push({
      id: 'wsl',
      name: 'WSL2 (Linux)',
      command: 'wsl.exe',
      args: ['--cd', '~']
    });

    return shells;
  }

  public spawnShell(
    sessionId: string,
    shellId: string,
    cols: number = 80,
    rows: number = 24,
    onData: (data: string) => void,
    onClose: (code: number) => void
  ): boolean {
    const shells = this.getAvailableShells();
    const targetShell = shells.find((s) => s.id === shellId) || shells[0];

    const safeCols = Math.max(10, cols || 80);
    const safeRows = Math.max(5, rows || 24);

    // 1. Primary: Use node-pty (ConPTY on Windows) for native terminal emulation
    if (ptyModule) {
      try {
        const ptyProc = ptyModule.spawn(targetShell.command, targetShell.args, {
          name: 'xterm-256color',
          cols: safeCols,
          rows: safeRows,
          cwd: os.homedir(),
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor'
          },
          useConpty: true
        });

        ptyProc.onData((data: string) => {
          onData(data);
        });

        ptyProc.onExit(({ exitCode }) => {
          this.sessions.delete(sessionId);
          onClose(exitCode ?? 0);
        });

        this.sessions.set(sessionId, {
          ptyProcess: ptyProc,
          shellType: targetShell.id
        });

        return true;
      } catch (ptyErr: any) {
        console.warn(`[LocalTerminalManager] node-pty failed to spawn ${targetShell.command}, falling back:`, ptyErr);
      }
    }

    // 2. Fallback: Standard child_process
    try {
      const proc = cp.spawn(targetShell.command, targetShell.args.length ? targetShell.args : ['/k'], {
        cwd: os.homedir(),
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.stdout.on('data', (chunk: Buffer) => {
        onData(chunk.toString('utf8'));
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        onData(chunk.toString('utf8'));
      });

      proc.on('close', (code) => {
        this.sessions.delete(sessionId);
        onClose(code || 0);
      });

      proc.on('error', (err) => {
        onData(`\r\n\x1b[31m[Local Shell Error: ${err.message}]\x1b[0m\r\n`);
        this.sessions.delete(sessionId);
        onClose(1);
      });

      this.sessions.set(sessionId, { fallbackProcess: proc, shellType: targetShell.id });
      return true;
    } catch (err: any) {
      onData(`\r\n\x1b[31m[Failed to spawn local shell: ${err.message}]\x1b[0m\r\n`);
      onClose(1);
      return false;
    }
  }

  public resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.ptyProcess && cols > 0 && rows > 0) {
      try {
        session.ptyProcess.resize(cols, rows);
      } catch (err) {
        console.warn(`[LocalTerminalManager] resizeSession error:`, err);
      }
    }
  }

  public sendData(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.ptyProcess) {
      session.ptyProcess.write(data);
    } else if (session.fallbackProcess && session.fallbackProcess.stdin.writable) {
      session.fallbackProcess.stdin.write(data);
    }
  }

  public closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (session.ptyProcess) {
          session.ptyProcess.kill();
        } else if (session.fallbackProcess) {
          session.fallbackProcess.kill();
        }
      } catch {}
      this.sessions.delete(sessionId);
    }
  }
}
