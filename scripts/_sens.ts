/**
 * Experimento de sensibilidad (no forma parte del deliverable):
 * ¿dónde se va el tiempo de frame en el entorno headless SwiftShader?
 * Variantes: base / sin sombras / pixelRatio 0.5 / solo Three / solo Pixi.
 */
import { chromium } from '@playwright/test';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/workspaces/Souldolls';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(page: any, fn: string, ...args: any[]) {
  return page.evaluate(([f, a]: any) => (window as any).__perf[f](...a), [fn, args]);
}

async function waitHttp(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('no server');
}

async function measure(page: any, label: string, seconds: number) {
  await call(page, 'begin', label);
  await sleep(seconds * 1000);
  const s = await call(page, 'end');
  console.log(
    `${label.padEnd(18)} frames=${String(s.frames).padStart(4)} dur=${s.durationSec}s fps=${s.fps.mean} p95=${s.frameMs.p95}ms threeCalls=${s.three.callsMax} pixiCalls=${s.pixi.callsMax}`
  );
  return s;
}

async function main() {
  if (!existsSync(path.join(ROOT, 'dist/index.html'))) {
    spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  }
  const W = Number(process.argv[2] || 1280);
  const H = Number(process.argv[3] || 720);
  const secs = Number(process.argv[4] || 10);

  const proc: ChildProcess = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--port', '4174', '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  const url = 'http://127.0.0.1:4174';
  try {
    await waitHttp(url);
    const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-unsafe-swiftshader'] });
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${url}/?perf=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__perf?.ready, null, { timeout: 40000 });
    await call(page, 'init', { mapId: 'ruta_claro', seed: 133742 });
    await call(page, 'setEncounters', false);
    await sleep(3000);

    await measure(page, `A_base_${W}x${H}`, secs);

    await page.evaluate(() => {
      const raw = (window as any).__perf.raw();
      const r = raw.three.renderer;
      r.shadowMap.enabled = false;
      raw.three.scene.traverse((o: any) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m: any) => (m.needsUpdate = true));
        }
      });
    });
    await sleep(1000);
    await measure(page, 'B_sin_sombras', secs);

    await page.evaluate(() => {
      const raw = (window as any).__perf.raw();
      const r = raw.three.renderer;
      r.setPixelRatio(0.5);
      r.setSize(window.innerWidth, window.innerHeight, false);
    });
    await sleep(1000);
    await measure(page, 'C_pr0.5_sinSh', secs);

    // restaurar sombras + pr1
    await page.evaluate(() => {
      const raw = (window as any).__perf.raw();
      const r = raw.three.renderer;
      r.shadowMap.enabled = true;
      r.setPixelRatio(1);
      raw.three.scene.traverse((o: any) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m: any) => (m.needsUpdate = true));
        }
      });
      r.setSize(window.innerWidth, window.innerHeight, false);
    });
    await sleep(1500);
    await measure(page, 'A2_base_otros', secs);

    // solo Three (esconder Pixi)
    await page.evaluate(() => {
      const raw = (window as any).__perf.raw();
      raw.pixi.app.canvas.style.display = 'none';
    });
    await sleep(800);
    await measure(page, 'D_solo_three', secs);

    // solo Pixi (esconder Three)
    await page.evaluate(() => {
      const raw = (window as any).__perf.raw();
      raw.pixi.app.canvas.style.display = '';
      raw.three.renderer.domElement.style.display = 'none';
    });
    await sleep(800);
    await measure(page, 'E_solo_pixi', secs);

    // ambos ocultos (sólo JS+composición)
    await page.evaluate(() => {
      const raw = (window as any).__perf.raw();
      raw.pixi.app.canvas.style.display = 'none';
    });
    await sleep(800);
    await measure(page, 'F_ninguno', secs);

    await browser.close();
  } finally {
    try {
      process.kill(-(proc as any).pid!, 'SIGTERM');
    } catch {
      try {
        proc.kill('SIGTERM');
      } catch {}
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
