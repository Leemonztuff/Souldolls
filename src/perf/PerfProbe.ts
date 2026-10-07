import * as THREE from 'three';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';

/**
 * BLOQUE 47 — Auditoría de rendimiento (instrumentación, NO lógica de juego).
 *
 * Sonda de muestreo por frame: intervalo de frame, draw calls / triángulos /
 * geometrías / texturas vivas de Three (renderer.info), draw calls de Pixi
 * (parcheo del contexto WebGL), objetos Pixi vivos, memoria JS y asignaciones
 * por frame (delta positivo de usedJSHeapSize).
 *
 * Coste por frame: ~1 lectura de renderer.info + 1 lectura de performance.memory
 * + un recorrido de stage Pixi (cada 10 frames) + empuje a un Float64Array
 * (sin asignaciones por frame, para que la métrica de "alloc/frame" no se
 * contamine a sí misma).
 */

export interface PerfStats {
  scenario: string;
  durationSec: number;
  frames: number;
  fps: { mean: number; min: number };
  frameMs: { mean: number; p50: number; p95: number; p99: number; max: number };
  three: {
    callsMean: number;
    callsMax: number;
    trisMax: number;
    geometries: number;
    textures: number;
    materials: number;
  };
  pixi: { callsMean: number; callsMax: number; objectsMax: number };
  heap: { startMB: number; endMB: number; maxMB: number };
  resolution: { threeScale: number; threePixelRatio: number; pixiResolution: number };
  allocPerFrameKB: number;
  allocPerSecondKB: number;
}

export interface LiveInfo {
  frameMs: number;
  fps: number;
  threeCalls: number;
  threeTris: number;
  geometries: number;
  textures: number;
  pixiCalls: number;
  pixiObjects: number;
  heapMB: number;
  allocKB: number;
  allocPerSecondKB: number;
  sceneName: string;
}

/** [frameMs, threeCalls, threeTris, geo, tex, pixiCalls, pixiObjs, heapMB, allocKB] */
const STRIDE = 9;
const RING_FRAMES = 900; // ~15 s a 60 fps para el rolling window del overlay
const SCEN_MAX_FRAMES = 60000; // ~16 min a 60 fps por escenario

function percentile(sortedAsc: ArrayLike<number>, p: number, len = sortedAsc.length): number {
  if (len === 0) return 0;
  const idx = Math.max(0, Math.min(len - 1, Math.ceil(p * len) - 1));
  return sortedAsc[idx];
}

function collect(buf: Float64Array, count: number, field: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(buf[i * STRIDE + field]);
  return out;
}

function maxOf(values: number[]): number {
  let m = 0;
  for (const v of values) if (v > m) m = v;
  return m;
}

function minOf(values: number[]): number {
  if (values.length === 0) return 0;
  let m = values[0];
  for (const v of values) if (v < m) m = v;
  return m;
}

export class PerfProbe {
  private static instance: PerfProbe | null = null;
  public static getInstance(): PerfProbe {
    if (!PerfProbe.instance) PerfProbe.instance = new PerfProbe();
    return PerfProbe.instance;
  }

  private running = false;
  private rafId: number | null = null;
  private lastTs = 0;

  private ring = new Float64Array(RING_FRAMES * STRIDE);
  private ringCount = 0;
  private ringWrite = 0;

  private scen = new Float64Array(SCEN_MAX_FRAMES * STRIDE);
  private scenCount = 0;
  private scenarioName: string | null = null;
  private scenStartTs = 0;
  private scenEndTs = 0;

  private prevHeap = 0;
  private pixiGl: WebGLRenderingContext | null = null;
  private pixiObjectCache = 0;
  private pixiObjectFrameCounter = 0;
  private allocEMA = 0;
  private allocRateEMA = 0;
  private lastLive: LiveInfo | null = null;
  private lastOverlayPaint = 0;
  private overlayPaint: ((live: LiveInfo, rolling: RollingStats) => void) | null = null;
  private readonly scratch = new Array<number>(STRIDE);
  private readonly rollSort = new Float64Array(RING_FRAMES);
  private readonly objStack: any[] = [];
  private readonly threeMaterialSet = new Set<THREE.Material>();
  private readonly liveBox: LiveInfo = {
    frameMs: 0,
    fps: 0,
    threeCalls: 0,
    threeTris: 0,
    geometries: 0,
    textures: 0,
    pixiCalls: 0,
    pixiObjects: 0,
    heapMB: 0,
    allocKB: 0,
    allocPerSecondKB: 0,
    sceneName: '?',
  };

  // ---------------------------------------------------------------- lifecycle

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = 0;
    this.patchPixiGl();
    const loop = (ts: number) => {
      if (!this.running) return;
      this.tick(ts);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  public setOverlayPaint(fn: ((live: LiveInfo, rolling: RollingStats) => void) | null): void {
    this.overlayPaint = fn;
  }

  // ------------------------------------------------------------------ sampling

  private patchPixiGl(): void {
    if (this.pixiGl) return;
    let gl: any = null;
    try {
      const renderer: any = (GlobalPixiRenderer as any).app?.renderer;
      gl = renderer?.gl ?? null;
      if (!gl) {
        const canvas: HTMLCanvasElement | undefined = (GlobalPixiRenderer as any).app?.canvas;
        gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl') || null;
      }
    } catch {
      gl = null;
    }
    if (!gl || gl.__perfPatched) {
      if (gl?.__perfPatched) this.pixiGl = gl;
      return;
    }
    gl.__perfPatched = true;
    gl.__perfCalls = 0;
    const fns = [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
      'drawRangeElements',
    ];
    for (const name of fns) {
      const orig = gl[name];
      if (typeof orig !== 'function') continue;
      gl[name] = function patched(
        a?: number,
        b?: number,
        c?: number,
        d?: number,
        e?: number,
        f?: number
      ) {
        gl.__perfCalls++;
        return orig.call(gl, a, b, c, d, e, f);
      };
    }
    this.pixiGl = gl;
  }

  private tick(ts: number): void {
    if (this.lastTs === 0) {
      this.lastTs = ts;
      return;
    }
    const frameMs = ts - this.lastTs;
    this.lastTs = ts;

    // --- Three.js (renderer.info se reinicia en cada render(): lee el frame actual)
    let threeCalls = 0;
    let threeTris = 0;
    let geo = 0;
    let tex = 0;
    try {
      const info = (GlobalThreeRenderer as any).renderer?.info;
      if (info) {
        threeCalls = info.render?.calls ?? 0;
        threeTris = info.render?.triangles ?? 0;
        geo = info.memory?.geometries ?? 0;
        tex = info.memory?.textures ?? 0;
      }
    } catch {
      /* renderer aún no listo */
    }

    // --- PixiJS (draw calls contados parcheando el contexto WebGL propio)
    if (!this.pixiGl) this.patchPixiGl();
    const pixiCalls = this.pixiGl ? ((this.pixiGl as any).__perfCalls as number) || 0 : 0;
    if (this.pixiGl) (this.pixiGl as any).__perfCalls = 0;

    // Objetos Pixi: recorrido caro => solo 1 de cada 10 frames
    if (this.pixiObjectFrameCounter <= 0) {
      this.pixiObjectCache = this.countPixiObjects();
      this.pixiObjectFrameCounter = 10;
    }
    this.pixiObjectFrameCounter--;
    const pixiObjects = this.pixiObjectCache;

    // --- Memoria JS + asignaciones por frame (solo deltas positivos)
    const mem: any = (performance as any).memory;
    const heapMB = mem?.usedJSHeapSize ? mem.usedJSHeapSize / (1024 * 1024) : 0;
    let allocKB = 0;
    if (mem?.usedJSHeapSize) {
      const delta = mem.usedJSHeapSize - this.prevHeap;
      if (delta > 0) allocKB = delta / 1024;
      this.prevHeap = mem.usedJSHeapSize;
      this.allocEMA = this.allocEMA * 0.95 + allocKB * 0.05;
      const rate = frameMs > 0 ? (allocKB * 1000) / frameMs : 0;
      this.allocRateEMA = this.allocRateEMA * 0.95 + rate * 0.05;
    }

    // scratch reutilizable: la sonda NO debe asignar memoria por frame
    const values = this.scratch;
    values[0] = frameMs;
    values[1] = threeCalls;
    values[2] = threeTris;
    values[3] = geo;
    values[4] = tex;
    values[5] = pixiCalls;
    values[6] = pixiObjects;
    values[7] = heapMB;
    values[8] = allocKB;

    const ringBase = this.ringWrite * STRIDE;
    for (let i = 0; i < STRIDE; i++) this.ring[ringBase + i] = values[i];
    this.ringWrite = (this.ringWrite + 1) % RING_FRAMES;
    this.ringCount = Math.min(this.ringCount + 1, RING_FRAMES);

    if (this.scenarioName && this.scenCount < SCEN_MAX_FRAMES) {
      const base = this.scenCount * STRIDE;
      for (let i = 0; i < STRIDE; i++) this.scen[base + i] = values[i];
      this.scenCount++;
      this.scenEndTs = ts;
    }

    const live = this.liveBox;
    live.frameMs = frameMs;
    live.fps = frameMs > 0 ? 1000 / frameMs : 0;
    live.threeCalls = threeCalls;
    live.threeTris = threeTris;
    live.geometries = geo;
    live.textures = tex;
    live.pixiCalls = pixiCalls;
    live.pixiObjects = pixiObjects;
    live.heapMB = heapMB;
    live.allocKB = this.allocEMA;
    live.allocPerSecondKB = this.allocRateEMA;
    live.sceneName = this.currentSceneName();
    this.lastLive = live;

    if (this.overlayPaint && ts - this.lastOverlayPaint > 250) {
      this.lastOverlayPaint = ts;
      this.overlayPaint(live, this.rolling());
    }
  }

  private countPixiObjects(): number {
    try {
      const stage: any = (GlobalPixiRenderer as any).stage;
      if (!stage) return 0;
      const stack = this.objStack;
      stack.length = 0;
      stack.push(stage);
      let n = 0;
      while (stack.length > 0) {
        const node = stack.pop();
        n++;
        if (n > 200000) return n;
        const children = node.children;
        if (children && children.length > 0) {
          for (let i = 0; i < children.length; i++) stack.push(children[i]);
        }
      }
      return n;
    } catch {
      return 0;
    }
  }

  private currentSceneName(): string {
    try {
      return GlobalSceneManager.getCurrentScene()?.name || '?';
    } catch {
      return '?';
    }
  }

  private countThreeMaterials(): number {
    const scene = GlobalThreeRenderer.scene;
    if (!scene) return 0;

    const materials = this.threeMaterialSet;
    materials.clear();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of meshMaterials) materials.add(material);
    });
    return materials.size;
  }

  // -------------------------------------------------------------- scenarios

  public begin(scenario: string): void {
    this.scenarioName = scenario;
    this.scenCount = 0;
    this.scenStartTs = performance.now();
    this.scenEndTs = this.scenStartTs;
    if (this.prevHeap === 0) {
      const mem: any = (performance as any).memory;
      this.prevHeap = mem?.usedJSHeapSize || 0;
    }
  }

  public end(): PerfStats {
    const name = this.scenarioName || 'unknown';
    const n = this.scenCount;
    const durationSec = Math.max(0, (this.scenEndTs - this.scenStartTs) / 1000);
    this.scenarioName = null;

    const frameMs = collect(this.scen, n, 0);
    const threeCalls = collect(this.scen, n, 1);
    const threeTris = collect(this.scen, n, 2);
    const geo = collect(this.scen, n, 3);
    const tex = collect(this.scen, n, 4);
    const pixiCalls = collect(this.scen, n, 5);
    const pixiObjs = collect(this.scen, n, 6);
    const heap = collect(this.scen, n, 7);
    const alloc = collect(this.scen, n, 8);

    const sortedFrame = [...frameMs].sort((a, b) => a - b);
    const sortedThree = [...threeCalls].sort((a, b) => a - b);
    const sortedPixiC = [...pixiCalls].sort((a, b) => a - b);

    const fpsValues = frameMs.map((f) => (f > 0 ? 1000 / f : 0));
    const fpsMean = fpsValues.length ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length : 0;
    const fpsMin = minOf(fpsValues);

    const frameSum = frameMs.reduce((a, b) => a + b, 0);
    const allocSum = alloc.reduce((a, b) => a + b, 0);

    return {
      scenario: name,
      durationSec: round(durationSec, 2),
      frames: n,
      fps: { mean: round(fpsMean, 1), min: round(fpsMin, 1) },
      frameMs: {
        mean: round(n ? frameSum / n : 0, 2),
        p50: round(percentile(sortedFrame, 0.5), 2),
        p95: round(percentile(sortedFrame, 0.95), 2),
        p99: round(percentile(sortedFrame, 0.99), 2),
        max: round(sortedFrame.length ? sortedFrame[sortedFrame.length - 1] : 0, 2),
      },
      three: {
        callsMean: round(mean(threeCalls), 1),
        callsMax: sortedThree.length ? sortedThree[sortedThree.length - 1] : 0,
        trisMax: maxOf(threeTris),
        geometries: geo.length ? geo[geo.length - 1] : 0,
        textures: tex.length ? tex[tex.length - 1] : 0,
        materials: this.countThreeMaterials(),
      },
      pixi: {
        callsMean: round(mean(pixiCalls), 1),
        callsMax: sortedPixiC.length ? sortedPixiC[sortedPixiC.length - 1] : 0,
        objectsMax: maxOf(pixiObjs),
      },
      heap: {
        startMB: round(heap.length ? heap[0] : 0, 1),
        endMB: round(heap.length ? heap[heap.length - 1] : 0, 1),
        maxMB: heap.length ? round(maxOf(heap), 1) : 0,
      },
      resolution: {
        threeScale: GlobalThreeRenderer.getResolutionScale(),
        threePixelRatio: GlobalThreeRenderer.renderer?.getPixelRatio() ?? 1,
        pixiResolution: GlobalPixiRenderer.resolution,
      },
      allocPerFrameKB: round(n ? allocSum / n : 0, 2),
      allocPerSecondKB: round(durationSec > 0 ? allocSum / durationSec : 0, 1),
    };
  }

  /** Nº de frames muestreados en el escenario en curso (para "muestrear hasta N frames"). */
  public scenFrames(): number {
    return this.scenCount;
  }

  public live(): LiveInfo | null {
    return this.lastLive;
  }

  /** Punto de referencia para la prueba de fugas (geometrías/texturas/objetos/heap). */
  public baseline(): {
    geometries: number;
    textures: number;
    pixiObjects: number;
    heapMB: number;
    threeCalls: number;
    pixiCalls: number;
    scene: string;
  } {
    const live = this.lastLive;
    return {
      geometries: live?.geometries ?? 0,
      textures: live?.textures ?? 0,
      pixiObjects: live?.pixiObjects ?? 0,
      heapMB: round(live?.heapMB ?? 0, 2),
      threeCalls: live?.threeCalls ?? 0,
      pixiCalls: live?.pixiCalls ?? 0,
      scene: live?.sceneName ?? '?',
    };
  }

  public rolling(): RollingStats {
    const n = this.ringCount;
    if (n === 0) {
      return {
        fps: 0,
        frameMs: { mean: 0, p95: 0, p99: 0 },
        threeCalls: 0,
        threeTris: 0,
        geometries: 0,
        textures: 0,
        pixiCalls: 0,
        pixiObjects: 0,
        heapMB: 0,
        allocKB: 0,
        allocPerSecondKB: 0,
      };
    }
    const start = (this.ringWrite - n + RING_FRAMES) % RING_FRAMES;
    const sortBuf = this.rollSort;
    let frameSum = 0;
    let threeCalls = 0;
    let threeTris = 0;
    let pixiCalls = 0;
    let geo = 0;
    let tex = 0;
    let pixiObjs = 0;
    let heap = 0;
    let alloc = 0;
    let allocSum = 0;
    for (let i = 0; i < n; i++) {
      const idx = ((start + i) % RING_FRAMES) * STRIDE;
      const f = this.ring[idx];
      sortBuf[i] = f;
      frameSum += f;
      const c = this.ring[idx + 1];
      if (c > threeCalls) threeCalls = c;
      const t = this.ring[idx + 2];
      if (t > threeTris) threeTris = t;
      const p = this.ring[idx + 5];
      if (p > pixiCalls) pixiCalls = p;
      geo = this.ring[idx + 3];
      tex = this.ring[idx + 4];
      pixiObjs = this.ring[idx + 6];
      heap = this.ring[idx + 7];
      alloc = this.ring[idx + 8];
      allocSum += alloc;
    }
    for (let i = n; i < RING_FRAMES; i++) sortBuf[i] = Number.POSITIVE_INFINITY;
    sortBuf.sort();
    const meanMs = frameSum / n;
    return {
      fps: meanMs > 0 ? 1000 / meanMs : 0,
      frameMs: {
        mean: round(meanMs, 2),
        p95: round(percentile(sortBuf, 0.95, n), 2),
        p99: round(percentile(sortBuf, 0.99, n), 2),
      },
      threeCalls,
      threeTris,
      geometries: geo,
      textures: tex,
      pixiCalls,
      pixiObjects: pixiObjs,
      heapMB: round(heap, 1),
      allocKB: round(alloc, 2),
      allocPerSecondKB: round(frameSum > 0 ? (allocSum * 1000) / frameSum : 0, 1),
    };
  }
}

export interface RollingStats {
  fps: number;
  frameMs: { mean: number; p95: number; p99: number };
  threeCalls: number;
  threeTris: number;
  geometries: number;
  textures: number;
  pixiCalls: number;
  pixiObjects: number;
  heapMB: number;
  allocKB: number;
  allocPerSecondKB: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export const GlobalPerfProbe = PerfProbe.getInstance();
