# ADR-002: Desktop Shell and Narrow Typed IPC Architecture

## Status
Accepted

## Context
Section 4 and 8.5 require a sandboxed renderer with a narrow typed IPC boundary, preventing arbitrary remote terminal output or compromised UI views from escaping the browser sandbox or executing system commands.

## Decision
1. We configure Electron with strict security headers:
   - `nodeIntegration: false`
   - `contextIsolation: true`
   - `sandbox: true`
   - Content Security Policy (CSP) blocking external scripts, objects, and unsafe evals.
2. The renderer only accesses the backend via `window.dgodterm`, exposed via `contextBridge.exposeInMainWorld()`.
3. Every IPC message is strictly validated with schema and type checking before execution.
4. Remote terminal output is strictly treated as untrusted data; clipboard pasting includes multi-line inspection and bracketed paste defense.

## Consequences
- The UI layer cannot read files, initiate sockets, or spawn child processes directly.
- The attack surface is limited exclusively to the typed API methods.
