/**
 * BLOQUE 47/48 — Escenarios de medición de rendimiento reproducibles.
 *
 * Uso:
 *   npx tsx scripts/perf-scenarios.ts [grupos] [--label NOMBRE] [opciones]
 *
 * Grupos (coma-separados o "all"):
 *   boot         carga inicial con throttlign 4G + CPU 4x (bytes + ms hasta Title)
 *   walk         30-60 s caminando en 3 mapas representativos
 *   stand        INMOVIL en el spawn de cada mapa (contenido determinista → comparar builds)
 *   battle       N batallas con VFX reales
 *   menus        abrir/cerrar cada menú
 *   transitions  6 cambios de mapa + prueba de fugas (geo/texturas antes vs después)
 *
 * Opciones:
 *   --label <n>        nombre de la corrida (baseline, p1-three, ...) → docs/perf/raw/<n>.json
 *   --base <url>       usar un servidor ya levantado (no levanta ni compila)
 *   --no-build         no re-ejecutar `npm run build` antes del modo preview
 *   --dev              correr contra `vite dev` (solo para depuración; NO para métricas)
 *   --walk-secs <n>    duración del escenario de caminata (def. 30)
 *   --battles <n>      nº de batallas (def. 5)
 *   --w <px> --h <px>  viewport (def. 1280x720)
 *   --maps a,b,c       mapas del grupo walk (def. ruta_claro,bosque_eco,villa_brote)
 *
 * Nota de método: headless Chromium usa SwiftShader (sin GPU). Los FPS absolutos
 * NO son representativos de un dispositivo; sí lo son (y se comparan contra el
 * presupuesto) draw calls, triángulos, objetos vivos, bytes de bundle, tiempo de
 * carga con throttlign y los deltas de memoria. Todos los grupos corren con
 * `?perf=1` y debug OFF para que todas las corridas sean comparables.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const GROUPS_ALL = ['boot', 'walk', 'stand', 'battle', 'menus', 'transitions'] as const;
type Group = (typeof GROUPS_ALL)[number];

interface Options {
  groups: Group[];
  label: string;
  base: string | null;
  build: boolean;
  dev: boolean;
  outDir: string;
  walkSecs: number;
  battles: number;
  width: number;
  height: number;
  maps: string[] | null;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    groups: [...GROUPS_ALL],
    label: 'run',
    base: null,
    build: true,
    dev: false,
    outDir: path.join(ROOT, 'docs', 'perf', 'raw'),
    walkSecs: 30,
    battles: 5,
    width: 1280,
    height: 720,
    maps: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--label') opts.label = next();
    else if (a.startsWith('--label=')) opts.label = a.slice(8);
    else if (a === '--base') opts.base = next();
    else if (a.startsWith('--base=')) opts.base = a.slice(7);
    else if (a === '--no-build') opts.build = false;
    else if (a === '--dev') opts.dev = true;
    else if (a === '--walk-secs') opts.walkSecs = Number(next());
    else if (a === '--battles') opts.battles = Number(next());
    else if (a === '--w') opts.width = Number(next());
    else if (a === '--h') opts.height = Number(next());
    else if (a === '--maps') opts.maps = next().split(',').filter(Boolean);
    else if (a === '--out') opts.outDir = path.resolve(next());
    else if (!a.startsWith('--')) {
      const list = a.split(',').filter(Boolean);
      if (list[0] === 'all') opts.groups = [...GROUPS_ALL];
      else opts.groups = list as Group[];
    }
  }
  return opts;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T = any>(page: Page, fn: string, ...args: any[]): Promise<T> {
  return (page.evaluate(
    ([f, a]) => (window as any).__perf[f](...(a as any[])),
    [fn, args]
  )) as Promise<T>;
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = {}): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, out };
}

class Server {
  private proc: ChildProcess | null = null;
  constructor(
    public url: string,
    private stopFn: () => void
  ) {}
  stop() {
    this.stopFn();
  }
}

async function startServer(opts: Options): Promise<Server> {
  if (opts.base) return new Server(opts.base, () => {});

  if (opts.dev) {
    const proc = spawn('node', ['node_modules/vite/bin/vite.js', '--port', '3000', '--host', '127.0.0.1'], {
      cwd: ROOT,
      env: { ...process.env, DISABLE_HMR: 'true' },
      stdio: 'ignore',
      detached: true,
    });
    const url = 'http://127.0.0.1:3000';
    await waitHttp(url, 45000);
    return new Server(url, () => killTree(proc));
  }

  if (opts.build || !existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    process.stdout.write('[perf] npm run build ...\n');
    const b = run('npm', ['run', 'build']);
    if (!b.ok) {
      console.error(b.out.slice(-4000));
      throw new Error('build falló');
    }
  }
  const proc = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  const url = 'http://127.0.0.1:4173';
  await waitHttp(url, 30000);
  return new Server(url, () => killTree(proc));
}

function killTree(proc: ChildProcess) {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    try {
      proc.kill('SIGTERM');
    } catch {
      /* noop */
    }
  }
}

async function waitHttp(url: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* aún no levanta */
    }
    await sleep(250);
  }
  throw new Error(`servidor no respondió: ${url}`);
}

async function openApp(server: Server, opts: Options, browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`${server.url}/?perf=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).__perf?.ready, null, { timeout: 40000 });
  // esperar a que Game.init() termine (Title registrado y en pantalla)
  await page.waitForFunction(
    () => {
      try {
        return (window as any).__perf.scene().name === 'Title';
      } catch {
        return false;
      }
    },
    null,
    { timeout: 60000 }
  );
  return { ctx, page };
}

async function initGame(page: Page, mapId = 'villa_brote') {
  await call(page, 'init', { mapId, seed: 133742 });
  await sleep(600);
}

// --------------------------------------------------------------------- groups

async function groupBoot(server: Server, opts: Options, browser: Browser): Promise<any> {
  const ctx = await browser.newContext({ viewport: { width: opts.width, height: opts.height } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const p = (window as any).__perf;
      if (p && p.scene && p.scene().name === 'Title') {
        (window as any).__bootMs = Math.round(performance.now());
        clearInterval(iv);
      } else if (performance.now() - t0 > 60000) {
        (window as any).__bootMs = -1;
        clearInterval(iv);
      }
    }, 10);
  });
  const cdp = await ctx.newCDPSession(page);
  const bytesByType: Record<string, number> = {};
  const perfChunkBytes = { v: 0 };
  let reqUrl: Record<string, string> = {};
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', (e: any) => {
    reqUrl[e.requestId] = e.request.url;
  });
  cdp.on('Network.loadingFinished', (e: any) => {
    const url = reqUrl[e.requestId] || '';
    if (!url) return;
    if (url.includes('/perf') && url.endsWith('.js')) {
      perfChunkBytes.v += e.encodedDataLength;
      return;
    }
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'other';
    const kind = ['js', 'css', 'html', 'woff2', 'png', 'json', 'webp', 'jpg'].includes(ext) ? ext : 'other';
    bytesByType[kind] = (bytesByType[kind] || 0) + e.encodedDataLength;
  });
  // 4G rápido (9/3 Mbps, 150 ms) + CPU 4x (gama media)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (9_000_000 / 8) | 0,
    uploadThroughput: (3_000_000 / 8) | 0,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const t0 = Date.now();
  await page.goto(`${server.url}/?perf=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__bootMs !== undefined, null, { timeout: 90000 });
  const bootMs = await page.evaluate(() => (window as any).__bootMs as number);
  const wallMs = Date.now() - t0;
  const total = Object.values(bytesByType).reduce((a, b) => a + b, 0);
  const result = {
    scenario: 'boot_4g_cpu4x',
    bootMsToTitle: bootMs,
    wallMs,
    bytesByType,
    totalBytesSansPerfChunk: total,
    perfChunkBytes: perfChunkBytes.v,
    meta: await call(page, 'meta'),
  };
  await ctx.close();
  return result;
}

async function groupWalk(server: Server, opts: Options, browser: Browser): Promise<any> {
  const { ctx, page } = await openApp(server, opts, browser);
  const maps = opts.maps ?? ['ruta_claro', 'bosque_eco', 'villa_brote'];
  await initGame(page, maps[0]);
  await sleep(1500);
  const out: any[] = [];
  for (const map of maps) {
    if (map !== maps[0]) {
      const g = await call(page, 'gotoMap', map);
      if (!g.ok) {
        console.warn(`[walk] gotoMap falló → se omite ${map}`, g);
        continue;
      }
    }
    await call(page, 'setEncounters', false);
    await sleep(500);
    await call(page, 'begin', `walk_${map}`);
    await walkUntil(page, opts.walkSecs, 90, 70000);
    const stats = await call(page, 'end');
    await call(page, 'setEncounters', true);
    out.push(stats);
    console.log(
      `[walk] ${map}: fps=${stats.fps.mean} p95=${stats.frameMs.p95}ms calls=${stats.three.callsMax} tris=${stats.three.trisMax}`
    );
  }
  await ctx.close();
  return out;
}

async function sampleAtLeast(page: Page, minFrames: number, hardMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < hardMs) {
    try {
      const f: number = await call(page, 'frames');
      if (f >= minFrames) return;
    } catch {
      return;
    }
    await sleep(500);
  }
}

/** Camina manteniendo teclas hasta cumplir duración mínima Y nº mínimo de frames (o tope duro). */
async function walkUntil(page: Page, seconds: number, minFrames: number, hardMs: number) {
  const t0 = Date.now();
  await walkLoop(page, seconds);
  while (Date.now() - t0 < hardMs) {
    let f = 0;
    try {
      f = await call(page, 'frames');
    } catch {
      break;
    }
    if (f >= minFrames) break;
    await walkLoop(page, Math.min(10, seconds));
  }
}

async function walkLoop(page: Page, seconds: number) {
  const dirs = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];
  const end = Date.now() + seconds * 1000;
  let i = 0;
  let held: string | null = null;
  try {
    while (Date.now() < end) {
      const key = dirs[i % dirs.length];
      i++;
      held = key;
      await page.keyboard.down(key);
      await sleep(3200);
      await page.keyboard.up(key);
      held = null;
    }
  } finally {
    if (held) await page.keyboard.up(held).catch(() => {});
  }
}

/**
 * Escenario determinista: el jugador NO se mueve, así que cámara, escena y
 * draw calls son idénticos entre corridas → sirve para comparar "antes/después".
 */
async function groupStand(server: Server, opts: Options, browser: Browser): Promise<any> {
  const { ctx, page } = await openApp(server, opts, browser);
  const maps = opts.maps ?? ['ruta_claro', 'bosque_eco', 'villa_brote'];
  await initGame(page, maps[0]);
  await sleep(1500);
  const out: any[] = [];
  for (const map of maps) {
    if (map !== maps[0]) {
      const g = await call(page, 'gotoMap', map);
      if (!g.ok) {
        console.warn('[stand] gotoMap falló → se omite ' + map, g);
        continue;
      }
    }
    await call(page, 'setEncounters', false);
    await sleep(800);
    await call(page, 'begin', 'stand_' + map);
    await sampleAtLeast(page, 70, 45000);
    const stats = await call(page, 'end');
    await call(page, 'setEncounters', true);
    out.push(stats);
    console.log(
      `[stand] ${map}: fps=${stats.fps.mean} p95=${stats.frameMs.p95}ms calls=${stats.three.callsMax} tris=${stats.three.trisMax} geo=${stats.three.geometries} tex=${stats.three.textures}`
    );
  }
  await ctx.close();
  return out;
}

async function groupBattle(server: Server, opts: Options, browser: Browser): Promise<any> {
  const { ctx, page } = await openApp(server, opts, browser);
  await initGame(page, 'ruta_claro');
  await call(page, 'setEncounters', false);
  await sleep(1500);
  await call(page, 'begin', `battle_vfx_x${opts.battles}`);
  const perBattle: any[] = [];
  for (let i = 1; i <= opts.battles; i++) {
    const start = Date.now();
    const b = await call(page, 'forceBattle', {});
    if (!b.ok) {
      perBattle.push({ i, error: b.error || 'force' });
      continue;
    }
    let moves = 0;
    let ended = false;
    const deadline = Date.now() + 75000;
    while (Date.now() < deadline) {
      const info = await call(page, 'battleInfo');
      if (!info.inBattle) {
        ended = true;
        break;
      }
      if (info.menuState === 'busy') {
        await sleep(400);
        continue;
      }
      if (info.menuState === 'summary') {
        await call(page, 'battleMove', 0);
        await sleep(300);
        continue;
      }
      if (info.menuState === 'main' || info.menuState === 'fight') {
        const r = await call(page, 'battleMove', moves % 4);
        if (r.ok) moves++;
        await sleep(600);
      } else {
        await sleep(200);
      }
    }
    if (!ended) {
      const still = await call(page, 'battleInfo');
      if (still.inBattle) await call(page, 'endBattle');
    }
    perBattle.push({ i, species: b.speciesId, moves, ms: Date.now() - start });
    console.log(`[battle] ${i}/${opts.battles} ${b.speciesId} moves=${moves} ${Date.now() - start}ms`);
  }
  await sampleAtLeast(page, 60, 25000);
  const stats = await call(page, 'end');
  const after = await call(page, 'baseline');
  await ctx.close();
  return { stats, perBattle, baselineAfterBattles: after };
}

async function groupMenus(server: Server, opts: Options, browser: Browser): Promise<any> {
  const { ctx, page } = await openApp(server, opts, browser);
  await initGame(page, 'villa_brote');
  await sleep(1200);
  const names = ['Party', 'Bag', 'Pokedex', 'QuestLog', 'Shop', 'Workshop', 'StorageBox', 'Options'];
  const out: any[] = [];
  for (const name of names) {
    await call(page, 'begin', `menu_${name}`);
    const opened = await call(page, 'openMenu', name);
    await sampleAtLeast(page, 45, 15000);
    const stats = await call(page, 'end');
    await call(page, 'closeMenu');
    await sleep(300);
    out.push({ ...stats, opened: !!opened.ok, error: opened.error });
    console.log(`[menus] ${name}: p95=${stats.frameMs.p95}ms objetos=${stats.pixi.objectsMax}`);
  }
  await ctx.close();
  return out;
}

async function groupTransitions(server: Server, opts: Options, browser: Browser): Promise<any> {
  const { ctx, page } = await openApp(server, opts, browser);
  await initGame(page, 'villa_brote');
  await sleep(1500);
  await call(page, 'gc');
  const before = await call(page, 'baseline');

  const order = ['ruta_claro', 'villa_brote', 'ruta_claro', 'villa_brote', 'ruta_claro', 'villa_brote'];
  await call(page, 'begin', 'transitions_x6');
  const warps: any[] = [];
  for (const m of order) {
    const w = await call(page, 'gotoMap', m);
    warps.push({ to: m, ok: w.ok, ms: w.ms });
  }
  await sampleAtLeast(page, 45, 30000);
  const stats = await call(page, 'end');

  // Prueba de fugas: 10 viajes y vuelta a la línea base
  const leakOrder = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 'ruta_claro' : 'villa_brote'));
  for (const m of leakOrder) await call(page, 'gotoMap', m);
  await sleep(1200);
  await call(page, 'gc');
  const after = await call(page, 'baseline');
  const delta = {
    geometries: after.geometries - before.geometries,
    textures: after.textures - before.textures,
    pixiObjects: after.pixiObjects - before.pixiObjects,
    heapMB: Number((after.heapMB - before.heapMB).toFixed(2)),
  };
  await ctx.close();
  return { stats, warps, leak: { before, after, delta } };
}

// ------------------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  mkdirSync(opts.outDir, { recursive: true });
  const server = await startServer(opts);
  console.log(`[perf] servidor: ${server.url} · grupo(s): ${opts.groups.join(',')} · label=${opts.label}`);

  let browser: Browser | null = null;
  const results: Record<string, any> = {
    label: opts.label,
    when: new Date().toISOString(),
    server: server.url,
    viewport: `${opts.width}x${opts.height}`,
    options: {
      walkSecs: opts.walkSecs,
      battles: opts.battles,
      dev: opts.dev,
    },
    groups: {},
  };

  try {
    browser = await chromium.launch({
      args: [
        '--js-flags=--expose-gc',
        '--enable-unsafe-swiftshader',
        '--enable-precise-memory-info',
      ],
    });
    for (const g of opts.groups) {
      const t0 = Date.now();
      try {
        if (g === 'boot') results.groups.boot = await groupBoot(server, opts, browser);
        else if (g === 'walk') results.groups.walk = await groupWalk(server, opts, browser);
        else if (g === 'stand') results.groups.stand = await groupStand(server, opts, browser);
        else if (g === 'battle') results.groups.battle = await groupBattle(server, opts, browser);
        else if (g === 'menus') results.groups.menus = await groupMenus(server, opts, browser);
        else if (g === 'transitions') results.groups.transitions = await groupTransitions(server, opts, browser);
      } catch (err: any) {
        results.groups[g] = { error: String(err?.message || err) };
        console.error(`[perf] grupo ${g} falló:`, err);
      }
      console.log(`[perf] grupo ${g} listo en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  } finally {
    if (browser) await browser.close();
    server.stop();
  }

  const outFile = path.join(opts.outDir, `${opts.label}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`[perf] resultados → ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
