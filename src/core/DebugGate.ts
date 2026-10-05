const DEBUG_STORAGE_KEY = 'souldolls_debug_enabled';

/**
 * BLOQUE 43 Req. 2: Herramientas de desarrollo fuera del juego.
 * Solo devuelve true si:
 * - import.meta.env.DEV es true, o
 * - la URL contiene ?debug=1, o
 * - se ha activado explícitamente en localStorage (p.ej. mediante los 5 toques sobre la versión en Opciones).
 */
export function isDebugEnabled(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1') {
        localStorage.setItem(DEBUG_STORAGE_KEY, '1');
        return true;
      }
      if (params.get('debug') === '0') {
        localStorage.removeItem(DEBUG_STORAGE_KEY);
        return false;
      }
      const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
      if (stored === '1') return true;
      if (stored === '0') return false;
    }
  } catch (_) {}

  return Boolean((import.meta as any).env?.DEV);
}

export function setDebugEnabled(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? '1' : '0');
    }
  } catch (_) {}
}

export function toggleDebugEnabled(): boolean {
  const next = !isDebugEnabled();
  setDebugEnabled(next);
  return next;
}

let versionTapCount = 0;
let lastVersionTapTime = 0;

/**
 * BLOQUE 43 Req. 2: Gesto oculto de 5 toques sobre el número de versión en Opciones.
 * Devuelve true cuando se alcanza el 5º toque consecutivo y alterna el modo DEBUG.
 */
export function registerVersionTapForDebug(): boolean {
  const now = Date.now();
  if (now - lastVersionTapTime > 2200) {
    versionTapCount = 0;
  }
  lastVersionTapTime = now;
  versionTapCount++;

  if (versionTapCount >= 5) {
    versionTapCount = 0;
    const enabled = toggleDebugEnabled();
    return enabled;
  }
  return false;
}
