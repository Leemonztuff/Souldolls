import { GlobalSaveService } from '../services/SaveService';
import { GlobalEventBus } from '../core/EventBus';
import { SOUL_SPECIES_DATA } from '../data/souldolls/souls';

export type CodexStatus = 'unknown' | 'seen' | 'caught';

export class SoulCodexSystem {
  private static listenersInitialized = false;

  public static initEventListeners(): void {
    if (this.listenersInitialized) return;
    this.listenersInitialized = true;

    GlobalEventBus.on('GachaRolled', ({ result }) => {
      if (!GlobalSaveService.hasActiveState()) return;
      if (result.ok && result.newDiscoveries.length > 0) {
        const state = GlobalSaveService.getCurrentState();
        if (!state.gachaDiscoveries) state.gachaDiscoveries = [];
        result.newDiscoveries.forEach((disc) => {
          if (!state.gachaDiscoveries!.includes(disc)) {
            state.gachaDiscoveries!.push(disc);
          }
        });
        GlobalSaveService.save();
      }
    });

    GlobalEventBus.on('BodyAssembled', ({ chassisId }) => {
      if (!GlobalSaveService.hasActiveState()) return;
      const state = GlobalSaveService.getCurrentState();
      if (!state.gachaDiscoveries) state.gachaDiscoveries = [];
      const key = `assembled:${chassisId}`;
      if (!state.gachaDiscoveries.includes(key)) {
        state.gachaDiscoveries.push(key);
        GlobalSaveService.save();
      }
    });

    GlobalEventBus.on('TechniqueLearned', ({ moveId }) => {
      if (!GlobalSaveService.hasActiveState()) return;
      const state = GlobalSaveService.getCurrentState();
      if (!state.gachaDiscoveries) state.gachaDiscoveries = [];
      const key = `technique:${moveId}`;
      if (!state.gachaDiscoveries.includes(key)) {
        state.gachaDiscoveries.push(key);
        GlobalSaveService.save();
      }
    });
  }

  public static getStatus(speciesId: string): CodexStatus {
    const state = GlobalSaveService.getCurrentState();
    const codex = state.soulCodex || state.pokedex || {};
    const entry = codex[speciesId];
    if (!entry) return 'unknown';
    if (entry.caught) return 'caught';
    if (entry.seen) return 'seen';
    return 'unknown';
  }

  public static markSeen(speciesId: string): void {
    const state = GlobalSaveService.getCurrentState();
    if (!state.soulCodex) state.soulCodex = {};
    if (!state.pokedex) state.pokedex = state.soulCodex;

    const current = state.soulCodex[speciesId];
    if (!current || !current.caught) {
      state.soulCodex[speciesId] = {
        seen: true,
        caught: current ? current.caught : false,
      };
      state.pokedex[speciesId] = state.soulCodex[speciesId];
      GlobalSaveService.save();
      GlobalEventBus.emit('soulcodex:updated', { speciesId, status: 'seen' });
      GlobalEventBus.emit('pokedex:updated', { speciesId, status: 'seen' });
      this.checkMilestones();
    }
  }

  public static markCaught(speciesId: string): void {
    const state = GlobalSaveService.getCurrentState();
    if (!state.soulCodex) state.soulCodex = {};
    if (!state.pokedex) state.pokedex = state.soulCodex;

    const current = state.soulCodex[speciesId];
    if (!current || !current.caught) {
      state.soulCodex[speciesId] = {
        seen: true,
        caught: true,
      };
      state.pokedex[speciesId] = state.soulCodex[speciesId];
      GlobalSaveService.save();
      GlobalEventBus.emit('soulcodex:updated', { speciesId, status: 'caught' });
      GlobalEventBus.emit('pokedex:updated', { speciesId, status: 'caught' });
      this.checkMilestones();
    }
  }

  public static getCounts(): { seenCount: number; caughtCount: number; totalCount: number } {
    const state = GlobalSaveService.getCurrentState();
    const codex = state.soulCodex || state.pokedex || {};
    const totalCount = Object.keys(SOUL_SPECIES_DATA).length;

    let seenCount = 0;
    let caughtCount = 0;

    Object.values(codex).forEach((entry) => {
      if (entry.seen || entry.caught) seenCount++;
      if (entry.caught) caughtCount++;
    });

    return { seenCount, caughtCount, totalCount };
  }

  private static checkMilestones(): void {
    const { caughtCount, totalCount } = this.getCounts();
    const state = GlobalSaveService.getCurrentState();

    if (caughtCount >= 5 && !state.flags?.milestone_5_caught) {
      state.flags.milestone_5_caught = true;
      GlobalEventBus.emit('toast:message', {
        text: '🏆 ¡Hito de Soultrainer! Has registrado 5 Almas en el Códice.',
        duration: 3500,
      });
    }

    if (caughtCount >= totalCount && !state.flags?.milestone_all_caught) {
      state.flags.milestone_all_caught = true;
      GlobalEventBus.emit('toast:message', {
        text: '🌟 ¡CÓDICE DE ALMAS COMPLETO! Eres un Gran Maestro Artífice de Anima.',
        duration: 5000,
      });
    }
  }
}

// Aliases for compatibility
export const PokedexSystem = SoulCodexSystem;
export type PokedexStatus = CodexStatus;
