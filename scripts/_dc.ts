import { chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';

const ROOT = '/workspaces/Souldolls';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const DIAG = (mapId: string) => {
  const raw = (window as any).__perf.raw();
  const r = raw.three.renderer;
  const scene = raw.three.scene;
  const byRoot: Record<string, { mesh: number; instanced: number; castShadow: number; mat: Set<string> }> = {};
  let mesh = 0;
  let instanced = 0;
  let cast = 0;
  const mats = new Set<string>();
  const geos = new Set<string>();
  scene.traverse((o: any) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    let p = o;
    let root = o.name || '(sin-nombre)';
    while (p.parent && p.parent !== scene) {
      p = p.parent;
      if (p.name) root = p.name;
    }
    byRoot[root] ||= { mesh: 0, instanced: 0, castShadow: 0, mat: new Set() };
    if (o.isInstancedMesh) {
      instanced++;
      byRoot[root].instanced++;
    } else {
      mesh++;
      byRoot[root].mesh++;
    }
    if (o.castShadow) {
      cast++;
      byRoot[root].castShadow++;
    }
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (!m) continue;
      mats.add(m.uuid);
      byRoot[root].mat.add(m.uuid);
    }
    if (o.geometry) geos.add(o.geometry.uuid);
  });
  const hist: Record<string, number> = {};
  const matUse: Record<string, { n: number; color: string; map: boolean }> = {};
  scene.traverse((o: any) => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const vc = o.geometry?.attributes?.position?.count ?? 0;
    const key = o.isInstancedMesh ? 'instanced' : `${vc}v`;
    hist[key] = (hist[key] || 0) + 1;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m) {
      const mk = `${m.type}|${m.color?.getHexString?.() ?? ''}|map=${!!m.map}|em=${m.emissive?.getHexString?.()}|t=${m.transparent}|ro=${o.renderOrder}`;
      matUse[mk] ||= { n: 0, color: m.color?.getHexString?.() ?? '', map: !!m.map };
      matUse[mk].n++;
    }
  });
  const topMats = Object.entries(matUse)
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .map(([k, v]) => ({ mat: k, meshes: v.n }));
  const rows = Object.entries(byRoot)
    .map(([k, v]) => ({ root: k, ...v, mats: v.mat.size }))
    .sort((a, b) => b.mesh + b.instanced - (a.mesh + a.instanced));
  return {
    mapId,
    calls: r.info.render.calls,
    triangles: r.info.render.triangles,
    geometries: r.info.memory.geometries,
    textures: r.info.memory.textures,
    mesh,
    instanced,
    castShadow: cast,
    materials: mats.size,
    geoCount: geos.size,
    shadowEnabled: r.shadowMap.enabled,
    hist,
    topMats,
    top: rows.slice(0, 18),
  };
};

const SET_SHADOWS = (on: boolean) => {
  const raw = (window as any).__perf.raw();
  const r = raw.three.renderer;
  r.shadowMap.enabled = on;
  raw.three.scene.traverse((o: any) => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => (m.needsUpdate = true));
  });
  return on;
};

async function sampleCalls(page: any, n = 8) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(await page.evaluate(() => (window as any).__perf.raw().three.renderer.info.render.calls));
    await sleep(350);
  }
  return out;
}

async function main() {
  const maps = process.argv.slice(2);
  const proc: ChildProcess = spawn(
    'node',
    ['node_modules/vite/bin/vite.js', 'preview', '--port', '4176', '--strictPort'],
    { cwd: ROOT, stdio: 'ignore', detached: true }
  );
  const url = 'http://127.0.0.1:4176';
  try {
    await waitHttp(url);
    const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => console.log('[pageerror]', String(e.message).slice(0, 300)));
    await page.goto(`${url}/?perf=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__perf?.ready, null, { timeout: 40000 });
    const first = maps[0] || 'villa_brote';
    await page.evaluate(
      (mm: string) => (window as any).__perf.init({ mapId: mm, seed: 133742 }),
      first
    );
    for (const m of maps.length ? maps : ['villa_brote']) {
      if (m !== first) {
        const g = await page.evaluate((mm: string) => (window as any).__perf.gotoMap(mm), m);
        if (!g.ok) console.log('gotoMap falló', m, JSON.stringify(g));
        await sleep(2500);
      }
      await sleep(2500);
      const diag: any = await page.evaluate(DIAG, m);
      const on = await sampleCalls(page);
      await page.evaluate(SET_SHADOWS, false);
      await sleep(1200);
      const off = await sampleCalls(page);
      await page.evaluate(SET_SHADOWS, true);
      await sleep(1200);
      const back = await sampleCalls(page);
      diag.callsShadowOn = on;
      diag.callsShadowOff = off;
      diag.callsBack = back;
      console.log('=== ' + m + ' ===');
      console.log(JSON.stringify(diag, null, 1));
    }
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
