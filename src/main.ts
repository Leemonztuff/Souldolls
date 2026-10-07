import { GlobalGame } from './core/Game';
import { GlobalSaveService } from './services/SaveService';
import './index.css';

// B47/B48: overlay de rendimiento (F3) + harness de medición.
// Carga diferida para que el bundle inicial de producción no crezca:
// sólo se pide con `?perf=1` (o siempre en DEV).
if (new URLSearchParams(window.location.search).get('perf') === '1' || import.meta.env.DEV) {
  void import('./perf/index');
}

// Clean up and unregister any stale/cached service workers to ensure we bypass caching issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    let unregisteredAny = false;
    const promises = registrations.map((registration) => {
      return registration.unregister().then((success) => {
        if (success) {
          unregisteredAny = true;
          console.log('[PWA] Unregistered stale service worker successfully.');
        }
      });
    });
    Promise.all(promises).then(() => {
      if (unregisteredAny) {
        window.location.reload();
      }
    });
  });
}

// Entry point: Initialize the game engine once DOM is ready
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await GlobalGame.init();

    // Background auto-save & visibility recovery
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        GlobalSaveService.save();
      }
    });

    window.addEventListener('pagehide', () => {
      GlobalSaveService.save();
    });

  } catch (err) {
    console.error('[Main] Critical error during game initialization:', err);
  }
});
