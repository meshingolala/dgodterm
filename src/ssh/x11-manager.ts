import net from 'net';
import fs from 'fs';
import cp from 'child_process';
import path from 'path';

export interface X11ServerInfo {
  isRunning: boolean;
  port: number;
  display: string;
  detectedServers: Array<{ name: string; path: string; exists: boolean }>;
}

export class X11Manager {
  private static instance: X11Manager;
  private x11Process: cp.ChildProcess | null = null;

  private constructor() {}

  public static getInstance(): X11Manager {
    if (!X11Manager.instance) {
      X11Manager.instance = new X11Manager();
    }
    return X11Manager.instance;
  }

  /**
   * Check if an X11 server is actively listening on TCP port 6000 (Display :0.0)
   */
  public async isX11ServerRunning(port: number = 6000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      try {
        socket.connect(port, '127.0.0.1');
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Detect installed Windows X11 display servers
   */
  public getDetectedServers(): Array<{ name: string; path: string; exists: boolean }> {
    const candidates = [
      { name: 'VcXsrv Windows X Server', path: 'C:\\Program Files\\VcXsrv\\vcxsrv.exe' },
      { name: 'VcXsrv Windows X Server (x86)', path: 'C:\\Program Files (x86)\\VcXsrv\\vcxsrv.exe' },
      { name: 'Xming X Server', path: 'C:\\Program Files (x86)\\Xming\\Xming.exe' },
      { name: 'Xming X Server', path: 'C:\\Program Files\\Xming\\Xming.exe' },
      { name: 'Cygwin/X (XWin)', path: 'C:\\cygwin64\\bin\\XWin.exe' },
      { name: 'Cygwin/X (XWin)', path: 'C:\\cygwin\\bin\\XWin.exe' },
      { name: 'MSYS2 XWin Server', path: 'C:\\msys64\\mingw64\\bin\\XWin.exe' }
    ];

    return candidates.map((c) => ({
      ...c,
      exists: fs.existsSync(c.path)
    }));
  }

  /**
   * Retrieve full diagnostic status for UI
   */
  public async getStatus(): Promise<X11ServerInfo> {
    const isRunning = await this.isX11ServerRunning(6000);
    const detectedServers = this.getDetectedServers();

    return {
      isRunning,
      port: 6000,
      display: '127.0.0.1:0.0',
      detectedServers
    };
  }

  /**
   * Launch a local X11 display server in background multiwindow mode
   */
  public async launchServer(customPath?: string): Promise<{ success: boolean; message: string }> {
    const alreadyRunning = await this.isX11ServerRunning(6000);
    if (alreadyRunning) {
      return { success: true, message: 'X11 Display Server is already active on 127.0.0.1:6000 (:0.0)' };
    }

    let targetExe = customPath;
    if (!targetExe || !fs.existsSync(targetExe)) {
      const detected = this.getDetectedServers().find((s) => s.exists);
      if (detected) {
        targetExe = detected.path;
      }
    }

    if (!targetExe || !fs.existsSync(targetExe)) {
      return {
        success: false,
        message: 'No installed X11 server executable found (e.g., VcXsrv, Xming, or Cygwin/X). Please install VcXsrv or specify path.'
      };
    }

    try {
      // VcXsrv / Xming standard multi-window rootless launch arguments
      const args = [':0', '-multiwindow', '-clipboard', '-ac', '-wgl'];
      const proc = cp.spawn(targetExe, args, {
        detached: true,
        stdio: 'ignore'
      });
      proc.unref();
      this.x11Process = proc;

      // Wait up to 3 seconds for server to start listening
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.isX11ServerRunning(6000)) {
          return { success: true, message: `X11 Server successfully launched (${path.basename(targetExe)}) on 127.0.0.1:6000` };
        }
      }

      return { success: true, message: `X11 Server launched (${path.basename(targetExe)}). Initializing display :0...` };
    } catch (err: any) {
      return { success: false, message: `Failed to launch X11 server: ${err.message}` };
    }
  }

  /**
   * Automatically install VcXsrv Windows X Server via winget
   */
  public async installVcXsrv(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const cmd = 'winget install marha.VcXsrv --silent --accept-package-agreements --accept-source-agreements';
      cp.exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          try {
            cp.exec('start https://sourceforge.net/projects/vcxsrv/');
          } catch {}
          resolve({
            success: false,
            message: `Winget installation encountered an error. Opened VcXsrv official download page in browser: ${err.message}`
          });
          return;
        }

        const servers = this.getDetectedServers();
        const found = servers.find((s) => s.exists);
        if (found) {
          resolve({
            success: true,
            message: `VcXsrv installed successfully at ${found.path}! Click 'Start Local X Server' to activate.`
          });
        } else {
          resolve({
            success: true,
            message: 'VcXsrv installation command executed. Check status in a few moments.'
          });
        }
      });
    });
  }
}
