import { GlobalGame } from './core/Game';
import { GlobalSaveService } from './services/SaveService';
import './index.css';

// Clean up and unregister any stale/cached service workers without forcing a full page reload
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

// Entry point: Initialize the game engine once DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await GlobalGame.init();

    // BLOQUE 47 (I-12): Editor visual de primitivas de mapa (mapgen) — solo desarrollo
    // En producción (import.meta.env.DEV === false), este bloque es eliminado íntegramente por Vite/Rollup
    // y el código de /tools/mapgen/ui jamás entra en dist/.
    if (import.meta.env.DEV) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mapgen') === '1') {
        const mod = await import('../tools/mapgen/ui/index');
        mod.mountMapGenEditor();
      }
      window.addEventListener('keydown', async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
          e.preventDefault();
          const mod = await import('../tools/mapgen/ui/index');
          mod.mountMapGenEditor();
        }
      });
    }

    // Background auto-save & visibility recovery
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        GlobalSaveService.save();
      }
    });

    window.addEventListener('pagehide', () => {
      GlobalSaveService.save();
    });

    // WebGL Context Loss Recovery Handler
    const threeContainer = document.getElementById('three-container');
    threeContainer?.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[WebGL] Context lost. Attempting recovery...');
    }, false);

    threeContainer?.addEventListener('webglcontextrestored', () => {
      console.log('[WebGL] Context restored. Reinitializing renderers...');
      window.location.reload();
    }, false);

  } catch (err) {
    console.error('[Main] Critical error during game initialization:', err);
  }
});
