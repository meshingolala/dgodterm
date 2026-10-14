import React from 'react';
import ReactDOM from 'react-dom/client';
import './browser-shim';
import { App } from './App';
import './index.css';

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message);
  const root = document.getElementById('root');
  if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
    root.innerHTML = `<div style="padding:32px;background:#1e1014;color:#f87171;font-family:monospace">
      <h2>Global Script Error</h2>
      <pre>${event.message}\n${event.filename}:${event.lineno}:${event.colno}\n${event.error?.stack || ''}</pre>
    </div>`;
  }
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[React Error Boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, background: '#1e1014', color: '#f87171', fontFamily: 'monospace' }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold' }}>Application Render Error</h2>
          <pre style={{ marginTop: 12, padding: 12, background: '#0f0507', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
