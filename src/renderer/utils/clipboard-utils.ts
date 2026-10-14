/**
 * Robust cross-platform clipboard helpers for DgodTerm
 * Supports Electron desktop IPC bridge with seamless web fallback
 */

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try Desktop Electron native clipboard bridge
  try {
    const api = (window as any).dgodterm;
    if (api && typeof api.writeClipboard === 'function') {
      const ok = await api.writeClipboard(text);
      if (ok) return true;
    }
  } catch (err) {
    console.warn('Native clipboard write failed, trying navigator:', err);
  }

  // 2. Try Standard browser navigator.clipboard
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, trying execCommand fallback:', err);
  }

  // 3. Fallback: Hidden textarea copy
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '-9999px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(el);
    if (successful) return true;
  } catch (err) {
    console.error('All clipboard write attempts failed:', err);
  }

  return false;
}

export async function readTextFromClipboard(): Promise<string> {
  // 1. Try Desktop Electron native clipboard bridge (never blocked by permissions or focus)
  try {
    const api = (window as any).dgodterm;
    if (api && typeof api.readClipboard === 'function') {
      const text = await api.readClipboard();
      if (typeof text === 'string') return text;
    }
  } catch (err) {
    console.warn('Native clipboard read failed, trying navigator:', err);
  }

  // 2. Try Standard browser navigator.clipboard
  try {
    if (navigator?.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (typeof text === 'string') return text;
    }
  } catch (err) {
    console.warn('navigator.clipboard.readText failed or was denied:', err);
  }

  return '';
}
