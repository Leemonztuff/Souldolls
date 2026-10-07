import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalEventBus } from '../core/EventBus';
import { GlobalRng } from '../core/Rng';
import { GlobalSaveService } from '../services/SaveService';
import { MAP_REGISTRY } from '../data/maps/worldGraph';
import { EncounterSystem } from '../systems/EncounterSystem';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import type { PerfProbe, PerfStats, RollingStats } from './PerfProbe';

/**
 * BLOQUE 47 — Harness de medición reproducible.
 *
 * Expone `window.__perf` para que el driver de Playwright
 * (`scripts/perf-scenarios.ts`) pueda conducir escenarios con semilla fija
 * sin tocar la lógica de juego: sólo llama a las mismas APIs públicas que
 * usaría la UI (EventBus, SceneManager, SaveService, EncounterSystem).
 *
 * NO es código de juego: se carga sólo con `?perf=1` o en DEV (ver main.ts).
 */

export interface LeakSnapshot {
  geometries: number;
  textures: number;
  pixiObjects: number;
  heapMB: number;
  threeCalls: number;
  pixiCalls: number;
  scene: string;
}

export interface BattleInfo {
  inBattle: boolean;
  menuState: string | null;
  playerHp: number;
  opponentHp: number;
  opponentSpecies: string;
  isAnimating: boolean;
}

const DEFAULT_MAPS_PARAMS: Record<string, any> = {
  Shop: { mode: 'buy' },
  Workshop: { tab: 'heal' },
  StorageBox: { tab: 'all' },
  QuestLog: {},
  Party: {},
  Bag: {},
  Pokedex: {},
  Options: {},
};

const PERF_SLOT = 9;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 15000, label = 'condición'): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await sleep(50);
  }
  console.warn(`[perf-harness] timeout esperando: ${label}`);
  return false;
}

function currentSceneName(): string {
  return GlobalSceneManager.getCurrentScene()?.name || '?';
}

function overworldScene(): any | null {
  const s: any = GlobalSceneManager.getCurrentScene();
  return s && s.name === 'Overworld' ? s : null;
}

function battleScene(): any | null {
  const s: any = GlobalSceneManager.getCurrentScene();
  return s && s.name === 'Battle' ? s : null;
}

export function installPerfHarness(probe: PerfProbe): void {
  const api = {
    ready: true,
    version: 'b47-1',

    meta() {
      return {
        ua: navigator.userAgent,
        dpr: window.devicePixelRatio,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        mode: (import.meta as any).env?.DEV ? 'dev' : 'prod',
        url: location.search,
      };
    },

    // ---------------------------------------------------------- semilla / estado
    setSeed(seed: number): void {
      GlobalRng.setSeed(seed);
    },

    async init(opts: { mapId?: string; seed?: number } = {}): Promise<{ scene: string }> {
      // El módulo perf carga antes de que Game.init() registre las escenas:
      // esperar a que haya escena Overworld disponible.
      await waitFor(
        () => GlobalSceneManager.hasScene('Overworld') && GlobalSceneManager.hasScene('Title'),
        40000,
        'escenas registradas por Game.init'
      );
      const seed = opts.seed ?? 133742;
      const mapId = opts.mapId || 'villa_brote';
      const state = GlobalSaveService.createInitialState('PerfRunner');
      state.flags = {
        ...state.flags,
        intro_completed: true,
        received_starter: true,
        starter_chosen: true,
        has_starter: true,
        body_linked: true,
        guide_escort_done: true,
        rival_tutorial_done: true,
      };
      const spawn = MAP_REGISTRY[mapId]?.spawnPoints?.default || { x: 6, y: 8, direction: 'down' as const };
      state.player.mapId = mapId;
      state.player.position = { x: spawn.x, y: 0.5, z: spawn.y };
      state.player.direction = spawn.direction;
      GlobalSaveService.deleteSave(PERF_SLOT);
      GlobalSaveService.save(PERF_SLOT, state);
      GlobalRng.setSeed(seed);
      await GlobalSceneManager.changeScene('Overworld', {
        mapId,
        x: spawn.x,
        y: spawn.y,
        dir: spawn.direction,
      });
      await waitFor(() => currentSceneName() === 'Overworld', 20000, 'Overworld');
      await sleep(400); // deja terminar la construcción del mapa
      return { scene: currentSceneName() };
    },

    scene(): { name: string; stack: number; mapId: string | null } {
      const ow = overworldScene();
      return {
        name: currentSceneName(),
        stack: (GlobalSceneManager as any).sceneStack?.length ?? 0,
        mapId: ow?.currentMap?.id ?? null,
      };
    },

    /** Acceso crudo a singletons para experimentación de medición (no usar desde juego). */
    raw() {
      return {
        three: GlobalThreeRenderer as any,
        pixi: GlobalPixiRenderer as any,
        sm: GlobalSceneManager as any,
        save: GlobalSaveService as any,
      };
    },

    // ---------------------------------------------------------- métricas
    begin(scenario: string): void {
      probe.begin(scenario);
    },

    end(): PerfStats {
      return probe.end();
    },

    live() {
      return probe.live();
    },

    /** Nº de frames muestreados en el escenario en curso. */
    frames(): number {
      return probe.scenFrames();
    },

    rolling(): RollingStats {
      return probe.rolling();
    },

    baseline(): LeakSnapshot {
      const b = probe.baseline();
      return {
        geometries: b.geometries,
        textures: b.textures,
        pixiObjects: b.pixiObjects,
        heapMB: b.heapMB,
        threeCalls: b.threeCalls,
        pixiCalls: b.pixiCalls,
        scene: b.scene,
      };
    },

    async gc(): Promise<void> {
      const w: any = window;
      if (typeof w.gc === 'function') {
        w.gc();
        await sleep(120);
        w.gc();
      }
      await sleep(120);
    },

    // ---------------------------------------------------------- mapa
    async gotoMap(mapId: string): Promise<{ ok: boolean; ms: number; error?: string }> {
      const ow = overworldScene();
      if (!ow) return { ok: false, ms: 0, error: 'no-oworld' };
      if (!MAP_REGISTRY[mapId]) return { ok: false, ms: 0, error: 'map-unknown' };
      const spawn = MAP_REGISTRY[mapId].spawnPoints?.default || { x: 6, y: 8, direction: 'down' as const };
      const start = performance.now();
      GlobalEventBus.emit('map:warp', {
        targetMapId: mapId,
        targetX: spawn.x,
        targetY: spawn.y,
        targetDirection: spawn.direction,
      });
      const ok = await waitFor(
        () => {
          const cur = overworldScene();
          if (!cur) return false;
          return !cur.isWarping && cur.currentMap?.id === mapId;
        },
        20000,
        `warp->${mapId}`
      );
      await sleep(250); // deja asentarse cámara/luz
      return { ok, ms: Math.round(performance.now() - start), error: ok ? undefined : 'timeout' };
    },

    setEncounters(enabled: boolean): void {
      const ow = overworldScene();
      const map: any = ow?.currentMap;
      if (!map) return;
      if (map.__perfEncounterRate === undefined) {
        map.__perfEncounterRate = map.encounterRate ?? 0.12;
      }
      // OJO: EncounterSystem usa `map.encounterRate || 0.12`, así que 0 se interpreta
      // como "sin valor" y vuelve al 12%. Usar un valor mínimo positivo.
      map.encounterRate = enabled ? map.__perfEncounterRate : 1e-9;
    },

    // ---------------------------------------------------------- combate
    async forceBattle(
      opts: { speciesId?: string; level?: number } = {}
    ): Promise<{ ok: boolean; speciesId?: string; level?: number; error?: string }> {
      const ow = overworldScene();
      if (!ow) return { ok: false, error: 'no-overworld' };
      const map = ow.currentMap;
      let speciesId = opts.speciesId;
      let level = opts.level ?? 6;
      if (!speciesId) {
        const table = EncounterSystem.getEffectiveEncounterTable(map);
        if (table.length > 0) {
          const enc = EncounterSystem.pickEncounter(table);
          speciesId = enc.speciesId;
          level = enc.level;
        } else {
          speciesId = 'espectro';
        }
      }
      this.healParty();
      GlobalEventBus.emit('battle:encounter', { speciesId, level });
      const ok = await waitFor(() => currentSceneName() === 'Battle', 15000, 'Battle');
      if (!ok) return { ok: false, speciesId, error: 'no-battle' };
      const bs = battleScene();
      await waitFor(() => bs && bs.currentMenuState === 'main', 15000, 'menu main');
      return { ok: true, speciesId, level };
    },

    battleInfo(): BattleInfo {
      const bs = battleScene();
      if (!bs) {
        return {
          inBattle: false,
          menuState: null,
          playerHp: 0,
          opponentHp: 0,
          opponentSpecies: '',
          isAnimating: false,
        };
      }
      let playerHp = 0;
      let opponentHp = 0;
      let opponentSpecies = '';
      try {
        const pl = bs.engine?.getPlayerActive?.();
        const op = bs.engine?.getOpponentActive?.();
        playerHp = pl?.currentHp ?? 0;
        opponentHp = op?.currentHp ?? 0;
        opponentSpecies = op?.speciesId ?? '';
      } catch {
        /* engine aún no listo */
      }
      return {
        inBattle: true,
        menuState: bs.currentMenuState ?? null,
        playerHp,
        opponentHp,
        opponentSpecies,
        isAnimating: !!bs.isActionAnimating,
      };
    },

    battleMove(index = 0): { ok: boolean; state?: string; reason?: string } {
      const bs = battleScene();
      if (!bs) return { ok: false, reason: 'not-in-battle' };
      const state = bs.currentMenuState;
      if (state === 'summary') {
        bs.summaryDoneResolver?.();
        return { ok: true, state: 'summary-ack' };
      }
      if (state === 'busy') return { ok: false, reason: 'busy' };
      if (state === 'main') bs.openFightMenu();
      if (bs.currentMenuState === 'fight') {
        bs.submitPlayerAction({ type: 'move', moveIndex: index });
        return { ok: true, state: 'submitted' };
      }
      return { ok: false, reason: `state=${bs.currentMenuState}` };
    },

    async endBattle(): Promise<{ ok: boolean }> {
      if (!battleScene()) return { ok: false };
      await GlobalSceneManager.popScene();
      await waitFor(() => currentSceneName() === 'Overworld', 10000, 'back-to-overworld');
      return { ok: true };
    },

    healParty(): void {
      const state = GlobalSaveService.getCurrentState();
      for (const c of state.party) {
        if (c.maxPartHP) c.partHP = { ...c.maxPartHP };
        c.currentHp = c.maxHp;
        c.status = null;
        for (const m of c.moves) m.currentPp = m.maxPp;
      }
    },

    // ---------------------------------------------------------- menús
    async openMenu(name: string): Promise<{ ok: boolean; error?: string }> {
      if (!GlobalSceneManager.hasScene(name)) return { ok: false, error: 'scene-not-registered' };
      if (currentSceneName() !== 'Overworld') return { ok: false, error: 'not-overworld' };
      const params = DEFAULT_MAPS_PARAMS[name] ?? {};
      await GlobalSceneManager.pushScene(name, params);
      await sleep(350);
      return { ok: currentSceneName() === name };
    },

    async closeMenu(): Promise<{ ok: boolean }> {
      const before = currentSceneName();
      if (before === 'Overworld') return { ok: true };
      await GlobalSceneManager.popScene();
      await waitFor(() => currentSceneName() === 'Overworld', 8000, 'pop-menu');
      return { ok: currentSceneName() === 'Overworld' };
    },
  };

  (window as any).__perf = api;
}
