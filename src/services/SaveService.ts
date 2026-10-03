import { GameState, SaveSlotSummary } from '../types';
import { GlobalEventBus } from '../core/EventBus';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { BodyInstance } from '../types/bodies';

export const CURRENT_SAVE_VERSION = 2;
const STORAGE_PREFIX = 'souldolls_25d_save_slot_';
const LEGACY_STORAGE_PREFIX = 'pokemon_25d_save_slot_';

export class SaveService {
  private static instance: SaveService;
  private activeSlot = 1;
  private currentState: GameState | null = null;

  private constructor() {}

  public static getInstance(): SaveService {
    if (!SaveService.instance) {
      SaveService.instance = new SaveService();
    }
    return SaveService.instance;
  }

  public getActiveSlot(): number {
    return this.activeSlot;
  }

  public createInitialState(playerName = 'Soultrainer'): GameState {
    const starterBody = StatCalculator.createBodyInstance('chassis_madera_t1', 'Cuerpo de Inicio');
    const starterSouldoll = StatCalculator.createSouldoll('maga', 5, 'chassis_madera_t1', 'Maga');
    starterSouldoll.bodyInstanceId = starterBody.instanceId;

    const bodies: Record<string, BodyInstance> = {
      [starterBody.instanceId]: starterBody,
    };

    return {
      version: CURRENT_SAVE_VERSION,
      timestamp: Date.now(),
      playtimeSeconds: 0,
      player: {
        name: playerName,
        position: { x: 6, y: 0.5, z: 8 },
        direction: 'down',
        mapId: 'villa_brote',
        money: 3000,
        badges: [], // Sellos de Gremio
      },
      party: [starterSouldoll],
      storage: [],
      bodies,
      inventory: {
        soul_bottle_comun: 10,
        elixir_ki: 5,
        purga_ki: 2,
        // Compatibility aliases
        pokeball: 10,
        potion: 5,
        antidote: 2,
      },
      flags: {
        intro_completed: false,
        received_starter: true,
      },
      vars: {
        reputation: 0,
      },
      quests: {
        main_1_starter: { status: 'active', currentObjectiveIndex: 0, objectiveProgress: {} },
      },
      soulCodex: {
        maga: { seen: true, caught: true },
      },
      pokedex: {
        maga: { seen: true, caught: true },
      },
      keyItems: [],
      settings: {
        masterVolume: 0.8,
        sfxVolume: 0.9,
        bgmVolume: 0.4,
        textSpeed: 'mid',
        showTouchControls: true,
        outfitStyle: 'clasico',
      },
    };
  }

  public getCurrentState(): GameState {
    if (!this.currentState) {
      const loaded = this.load(this.activeSlot);
      if (loaded) {
        this.currentState = loaded;
      } else {
        this.currentState = this.createInitialState();
      }
    }
    return this.currentState;
  }

  public save(slot = this.activeSlot, state: GameState = this.currentState || this.createInitialState()): boolean {
    try {
      this.activeSlot = slot;
      state.timestamp = Date.now();
      state.version = CURRENT_SAVE_VERSION;
      this.currentState = state;

      const serialized = JSON.stringify(state);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${STORAGE_PREFIX}${slot}`, serialized);
      }
      GlobalEventBus.emit('save:saved', { slot });
      return true;
    } catch (err) {
      console.error(`[SaveService] Failed to save slot ${slot}:`, err);
      return false;
    }
  }

  public load(slot = this.activeSlot): GameState | null {
    try {
      if (typeof localStorage === 'undefined') return null;

      // Check current v2 storage or fallback to legacy v1 storage
      let raw = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
      if (!raw) {
        raw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${slot}`);
      }
      if (!raw) return null;

      let data = JSON.parse(raw);
      data = this.migrate(data);

      this.activeSlot = slot;
      this.currentState = data;
      GlobalEventBus.emit('save:loaded', { slot });
      return data;
    } catch (err) {
      console.error(`[SaveService] Failed to load slot ${slot}:`, err);
      return null;
    }
  }

  public hasSave(slot: number): boolean {
    if (typeof localStorage === 'undefined') return false;
    return !!(
      localStorage.getItem(`${STORAGE_PREFIX}${slot}`) ||
      localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${slot}`)
    );
  }

  public deleteSave(slot: number): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${slot}`);
      localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}${slot}`);
    }
    if (this.activeSlot === slot) {
      this.currentState = null;
    }
  }

  public getSlotSummary(slot: number): SaveSlotSummary {
    if (typeof localStorage === 'undefined') {
      return { id: slot, exists: false };
    }
    const raw =
      localStorage.getItem(`${STORAGE_PREFIX}${slot}`) ||
      localStorage.getItem(`${LEGACY_STORAGE_PREFIX}${slot}`);
    if (!raw) {
      return { id: slot, exists: false };
    }
    try {
      const state: GameState = JSON.parse(raw);
      const mins = Math.floor(state.playtimeSeconds / 60);
      const hrs = Math.floor(mins / 60);
      const formattedTime = `${hrs}h ${mins % 60}m`;

      return {
        id: slot,
        exists: true,
        playerName: state.player.name,
        money: state.player.money,
        badgesCount: state.player.badges.length,
        playtimeFormatted: formattedTime,
        timestamp: state.timestamp,
      };
    } catch (_) {
      return { id: slot, exists: false };
    }
  }

  public getSlotSummaries(): SaveSlotSummary[] {
    return [1, 2, 3].map((slot) => this.getSlotSummary(slot));
  }

  private migrate(state: any): GameState {
    if (!state.player) {
      state.player = this.createInitialState().player;
    }
    // Migrate old collision position
    if (state.player.position && state.player.position.x === 14 && state.player.position.z === 12) {
      state.player.position.x = 6;
      state.player.position.z = 8;
    }
    if (!state.inventory) {
      state.inventory = { soul_bottle_comun: 10, elixir_ki: 5, purga_ki: 2 };
    }
    if (!state.quests) {
      state.quests = {};
    }

    // Schema v1 -> v2 Souldolls Migration
    if (!state.bodies) {
      state.bodies = {};
    }

    if (!state.soulCodex) {
      state.soulCodex = state.pokedex || {};
    }

    // Convert party and storage to Souldoll format
    const legacySpeciesMap: Record<string, string> = {
      flamin: 'maga',
      pirolon: 'archimaga',
      brotin: 'sacerdotisa',
      frondoso: 'hierofante',
      rocalin: 'paladin',
      gravelon: 'templario',
      umbrito: 'asesina',
      noctarro: 'espectro',
      aquilo: 'hidromante',
      marejon: 'cantora_marea',
      chispin: 'monje',
      voltaro: 'maestro_trueno',
      piropio: 'bruja',
      plumaveloz: 'hechicera',
    };

    const convertCreatureToSouldoll = (item: any) => {
      const resolvedSpecies = legacySpeciesMap[item.speciesId] || item.speciesId || 'maga';
      const souldoll = StatCalculator.createSouldoll(resolvedSpecies, item.level || 5, 'chassis_madera_t1', item.nickname);
      
      // Keep existing body or create new
      let bodyId = item.bodyInstanceId;
      if (!bodyId || !state.bodies[bodyId]) {
        const body = StatCalculator.createBodyInstance('chassis_madera_t1', `Chasis de ${souldoll.nickname}`);
        state.bodies[body.instanceId] = body;
        bodyId = body.instanceId;
      }
      souldoll.bodyInstanceId = bodyId;
      souldoll.uid = item.uid || souldoll.uid;
      souldoll.currentHp = item.currentHp || souldoll.maxHp;
      souldoll.sync = item.sync || item.friendship || 70;
      souldoll.friendship = souldoll.sync;
      return souldoll;
    };

    if (Array.isArray(state.party)) {
      state.party = state.party.map(convertCreatureToSouldoll);
    } else {
      state.party = [];
    }

    if (Array.isArray(state.storage)) {
      state.storage = state.storage.map(convertCreatureToSouldoll);
    } else {
      state.storage = [];
    }

    // If party is empty after migration, give initial starter
    if (state.party.length === 0) {
      const init = this.createInitialState(state.player.name);
      state.party = init.party;
      state.bodies = init.bodies;
    }

    // Inventory migration
    if (state.inventory.potion && !state.inventory.elixir_ki) {
      state.inventory.elixir_ki = state.inventory.potion;
    }
    if (state.inventory.pokeball && !state.inventory.soul_bottle_comun) {
      state.inventory.soul_bottle_comun = state.inventory.pokeball;
    }
    if (state.inventory.antidote && !state.inventory.purga_ki) {
      state.inventory.purga_ki = state.inventory.antidote;
    }

    if (!state.settings) {
      state.settings = {
        masterVolume: 0.8,
        sfxVolume: 0.9,
        bgmVolume: 0.4,
        textSpeed: 'mid',
        showTouchControls: true,
        outfitStyle: 'clasico'
      };
    } else if (!state.settings.outfitStyle) {
      state.settings.outfitStyle = 'clasico';
    }

    state.version = CURRENT_SAVE_VERSION;
    return state as GameState;
  }
}

export const GlobalSaveService = SaveService.getInstance();
