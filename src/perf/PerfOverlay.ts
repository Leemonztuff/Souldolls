import { isDebugEnabled } from '../core/DebugGate';
import type { LiveInfo, PerfProbe, RollingStats } from './PerfProbe';

/**
 * BLOQUE 47 — Overlay de rendimiento (F3).
 *
 * Solo se monta si el módulo `src/perf` fue cargado explícitamente
 * (`?perf=1`) o si arrancamos en DEV (ver hook en `src/main.ts`).
 * La tecla F3 se captura en fase de captura para que el resto del juego
 * no la reciba; Shift+F3 se deja pasar a OverworldScene (telemetría de
 * cámara, Bloque 43) para no pisar esa funcionalidad.
 */
export class PerfOverlay {
  private static el: HTMLDivElement | null = null;
  private static visible = false;
  private static probe: PerfProbe | null = null;
  private static listenerInstalled = false;

  public static isEnabledByFlag(): boolean {
    try {
      return new URLSearchParams(window.location.search).get('perf') === '1';
    } catch {
      return false;
    }
  }

  public static mount(probe: PerfProbe): void {
    PerfOverlay.probe = probe;
    if (PerfOverlay.listenerInstalled) return;
    PerfOverlay.listenerInstalled = true;

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.code !== 'F3') return;
        if (!isDebugEnabled() && !PerfOverlay.isEnabledByFlag()) return;
        if (e.shiftKey) return; // Shift+F3 → overlay de cámara de OverworldScene
        e.preventDefault();
        e.stopImmediatePropagation();
        PerfOverlay.toggle();
      },
      true
    );

    probe.setOverlayPaint((live, rolling) => {
      if (PerfOverlay.visible && PerfOverlay.el) {
        PerfOverlay.paint(live, rolling);
      }
    });
  }

  public static toggle(): void {
    if (PerfOverlay.visible) PerfOverlay.hide();
    else PerfOverlay.show();
  }

  public static show(): void {
    if (!PerfOverlay.el) {
      const el = document.createElement('div');
      el.id = 'perf-overlay';
      el.style.cssText = [
        'position:fixed',
        'left:8px',
        'top:8px',
        'z-index:99999',
        'pointer-events:none',
        'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
        'color:#5FE3D2',
        'background:rgba(10,8,16,0.82)',
        'border:1px solid #9B6BFF',
        'border-radius:6px',
        'padding:7px 9px',
        'white-space:pre',
        'min-width:250px',
      ].join(';');
      document.body.appendChild(el);
      PerfOverlay.el = el;
    }
    PerfOverlay.el.style.display = 'block';
    PerfOverlay.visible = true;
    const live = PerfOverlay.probe?.live();
    const rolling = PerfOverlay.probe?.rolling();
    if (live && rolling) PerfOverlay.paint(live, rolling);
  }

  public static hide(): void {
    PerfOverlay.visible = false;
    if (PerfOverlay.el) PerfOverlay.el.style.display = 'none';
  }

  private static paint(live: LiveInfo, rolling: RollingStats): void {
    const el = PerfOverlay.el;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    el.textContent = [
      `PERF B47 — F3 oculta · Shift+F3 cámara`,
      `escena     ${live.sceneName}   ${w}x${h}@${dpr}x`,
      `FPS        ${rolling.fps.toFixed(1)}`,
      `frame ms   media ${rolling.frameMs.mean.toFixed(2)}  p95 ${rolling.frameMs.p95.toFixed(2)}  p99 ${rolling.frameMs.p99.toFixed(2)}`,
      `three      calls ${live.threeCalls}  tris ${fmt(live.threeTris)}`,
      `vivas      geo ${live.geometries}  tex ${live.textures}`,
      `pixi       calls ${rolling.pixiCalls}  objetos ${live.pixiObjects}`,
      `JS heap    ${live.heapMB.toFixed(1)} MB  Δ ${live.allocKB.toFixed(2)} KB/frame`,
    ].join('\n');
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
