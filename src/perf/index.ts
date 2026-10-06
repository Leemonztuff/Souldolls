import { GlobalPerfProbe } from './PerfProbe';
import { PerfOverlay } from './PerfOverlay';
import { installPerfHarness } from './harness';

/**
 * BLOQUE 47/48 — punto de entrada del módulo de rendimiento.
 * Se carga de forma diferida desde `src/main.ts` sólo si `?perf=1` o en DEV,
 * para no inflar el bundle inicial de producción.
 */
GlobalPerfProbe.start();
PerfOverlay.mount(GlobalPerfProbe);
installPerfHarness(GlobalPerfProbe);
