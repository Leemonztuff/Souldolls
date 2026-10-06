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

async function main() {
  const proc: ChildProcess = spawn(
    'node',
    ['node_modules/vite/bin/vite.js', 'preview', '--port', '4175', '--strictPort'],
    { cwd: ROOT, stdio: 'ignore', detached: true }
  );
  const url = 'http://127.0.0.1:4175';
  let seen = 0;
  try {
    await waitHttp(url);
    const browser = await chromium.launch({
      args: ['--js-flags=--expose-gc', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'],
    });
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on('pageerror', (e) => {
      if (seen++ < 3) console.log('[pageerror]', String(e.stack || e.message).slice(0, 2000));
    });
    await page.goto(`${url}/?perf=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as any).__perf?.ready, null, { timeout: 40000 });
    const res = await page.evaluate(() =>
      (window as any).__perf.init({ mapId: 'ruta_claro', seed: 133742 })
    );
    console.log('init ->', JSON.stringify(res));
    console.log('forceBattle ->', JSON.stringify(await page.evaluate(() => (window as any).__perf.forceBattle())));
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const info = await page.evaluate(() => (window as any).__perf.battleInfo());
      if (!info?.inBattle) {
        console.log('sin batalla:', JSON.stringify(info));
        break;
      }
      if (i % 6 === 0) console.log('menuState=', info.menuState, 'turn=', info.turn, 'ms=', i * 1000);
      if (info.menuState === 'main' || info.menuState === 'fight') {
        const r = await page.evaluate(() => (window as any).__perf.battleMove(0));
        console.log('battleMove ->', JSON.stringify(r), 't=', i * 1000);
        await sleep(1200);
      } else if (info.menuState === 'summary') {
        const r = await page.evaluate(() => (window as any).__perf.battleMove(0));
        console.log('summary ->', JSON.stringify(r));
        await sleep(1000);
      } else if (info.menuState !== 'busy') {
        console.log('otro estado:', info.menuState, '-> endBattle');
        console.log('endBattle ->', JSON.stringify(await page.evaluate(() => (window as any).__perf.endBattle())));
        await sleep(3000);
        console.log('scene:', JSON.stringify(await page.evaluate(() => (window as any).__perf.scene())));
        break;
      }
    }
    console.log('pageerrors totales:', seen);
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
