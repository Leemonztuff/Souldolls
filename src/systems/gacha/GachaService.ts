import { GameState } from '../../types';
import {
  GachaRarity,
  GachaResult,
  GachaRewardItem,
  GachaTable,
  TechniqueScroll,
} from '../../types/gacha';
import { Souldoll } from '../../types/souldolls';
import {
  GACHA_CONFIG,
  BODY_PIECES_DATA,
  TECHNIQUE_SCROLLS_DATA,
  GACHA_TABLES_DATA,
} from '../../data/gacha/gachaData';
import { ITEMS_DATA } from '../../data/items/items';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { SOUL_SPECIES_DATA } from '../../data/souldolls/souls';
import { MOVES_DATA } from '../../data/moves/moves';
import { StatCalculator } from '../battle/StatCalculator';
import { Rng } from '../../core/Rng';
import { GlobalEventBus } from '../../core/EventBus';

const RARITY_RANK: Record<GachaRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
};

const ORDERED_RARITIES: GachaRarity[] = ['common', 'uncommon', 'rare', 'epic'];

export interface ScrollTeachResult {
  ok: boolean;
  status: 'LEARNED' | 'NEEDS_REPLACEMENT' | 'ALREADY_KNOWN' | 'INCOMPATIBLE' | 'NO_SCROLL' | 'INVALID';
  message: string;
  moveId?: string;
  moveName?: string;
  replacedMoveId?: string;
  replacedMoveName?: string;
}

/**
 * BLOQUE 28A: Sistema puro de Fragmentos de alma y gacha (sin render, en /systems/gacha)
 */
export class GachaService {
  /**
   * 2. SEMILLA DETERMINISTA (cyrb53):
   * Convierte una cadena de QR (payload) en un hash estable de 53 bits y su semilla de 32 bits.
   * El mismo QR siempre produce el mismo resultado base independientemente del dispositivo.
   */
  public static hashPayload(payload: string, seed = 0): { hash: string; numericSeed: number } {
    const clean = (payload || '').trim();
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < clean.length; i++) {
      ch = clean.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    const val53 = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    const hex = val53.toString(16).padStart(14, '0');
    const numericSeed = (h1 ^ h2) >>> 0;
    return { hash: hex, numericSeed };
  }

  /**
   * Calcula la semilla combinando el hash del QR con el "salt" del GameState (saveId) si está activo en config.
   */
  public static computeDeterministicSeed(
    payload: string,
    gameState: GameState,
    useSaveSalt = GACHA_CONFIG.useSaveSalt
  ): { baseHash: string; combinedSeed: number } {
    const { hash: baseHash, numericSeed: baseSeed } = this.hashPayload(payload, 0);
    if (!useSaveSalt) {
      return { baseHash, combinedSeed: baseSeed };
    }
    const saltStr = gameState.saveId || gameState.player?.name || 'default_salt';
    const { numericSeed: saltSeed } = this.hashPayload(`${ payload.trim() }::${ saltStr }`, 0x9e3779b9);
    return {
      baseHash,
      combinedSeed: (baseSeed ^ saltSeed) >>> 0,
    };
  }

  /**
   * Inicializa los campos de gacha en el GameState si no existen.
   */
  public static ensureStateInitialized(gameState: GameState): void {
    if (!gameState.saveId) {
      const initRng = new Rng((gameState.timestamp || 1337) >>> 0);
      gameState.saveId = `save_${initRng.rangeInt(100000, 999999)}`;
    }
    if (gameState.rngSeed === undefined) {
      gameState.rngSeed = ((gameState.timestamp || 1337) ^ 0x5bd1e995) >>> 0;
    }
    if (!gameState.bodyPieces) {
      gameState.bodyPieces = {};
    }
    if (gameState.kiDust === undefined) {
      gameState.kiDust = 0;
    }
    if (!gameState.scanLedger) {
      gameState.scanLedger = [];
    }
    if (!gameState.gachaPity) {
      gameState.gachaPity = {};
    }
    const today = this.getDateKey(Date.now());
    if (!gameState.gachaDailyRedeems || gameState.gachaDailyRedeems.dateKey !== today) {
      gameState.gachaDailyRedeems = { dateKey: today, count: 0 };
    }
    if (!gameState.gachaDiscoveries) {
      gameState.gachaDiscoveries = [];
    }
    if (!gameState.inventory) {
      gameState.inventory = {};
    }
    if (!gameState.bodies) {
      gameState.bodies = {};
    }
  }

  public static getDateKey(timestampMs: number): string {
    const d = new Date(timestampMs);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Devuelve las probabilidades y configuración de una tabla para mostrar con transparencia en pantalla.
   */
  public static getTableTransparencyInfo(tableId = GACHA_CONFIG.defaultTableId): {
    table: GachaTable;
    formattedRates: Array<{ rarity: GachaRarity; ratePercent: string }>;
    pityThreshold: number;
    guaranteedRarity: GachaRarity;
  } {
    const table = GACHA_TABLES_DATA[tableId] || GACHA_TABLES_DATA[GACHA_CONFIG.defaultTableId];
    const formattedRates: Array<{ rarity: GachaRarity; ratePercent: string }> = ORDERED_RARITIES.map(
      (r) => ({
        rarity: r,
        ratePercent: `${(table.rarityRates[r] * 100).toFixed(1)}%`,
      })
    );
    return {
      table,
      formattedRates,
      pityThreshold: table.pity.threshold,
      guaranteedRarity: table.pity.guaranteedRarity,
    };
  }

  /**
   * 3 & 4. RESOLUCIÓN DE RECOMPENSAS Y ANTI-ABUSO:
   * rollFromScan(payload, gameState, options) → GachaResult
   */
  public static rollFromScan(
    payload: string,
    gameState: GameState,
    options?: {
      tableId?: string;
      nowMs?: number;
      redeemPolicyOverride?: 'once_forever' | 'cooldown_hours';
      cooldownHoursOverride?: number;
      dailyLimitOverride?: number;
      useSaveSaltOverride?: boolean;
    }
  ): GachaResult {
    this.ensureStateInitialized(gameState);

    const nowMs = options?.nowMs ?? Date.now();
    const tableId = options?.tableId || GACHA_CONFIG.defaultTableId;
    const table = GACHA_TABLES_DATA[tableId];

    if (!table) {
      return {
        ok: false,
        errorCode: 'INVALID_TABLE',
        message: `Tabla de resonancia inválida: ${tableId}`,
        hash: '',
        seedUsed: 0,
        tableId,
        rarity: 'common',
        wasPityTriggered: false,
        pityCounterAfter: 0,
        rewards: [],
        newDiscoveries: [],
      };
    }

    const trimmed = (payload || '').trim();
    if (!trimmed) {
      return {
        ok: false,
        errorCode: 'EMPTY_PAYLOAD',
        message: 'El código escaneado está vacío o es inválido. No se consumió ningún Fragmento de alma.',
        hash: '',
        seedUsed: 0,
        tableId,
        rarity: 'common',
        wasPityTriggered: false,
        pityCounterAfter: gameState.gachaPity![tableId] || 0,
        rewards: [],
        newDiscoveries: [],
      };
    }

    const useSalt = options?.useSaveSaltOverride ?? GACHA_CONFIG.useSaveSalt;
    const { baseHash, combinedSeed } = this.computeDeterministicSeed(trimmed, gameState, useSalt);

    // Verificar Fragmentos disponibles antes de cualquier otra cosa o después del ledger
    const fragmentId = table.fragmentItemId || 'soul_fragment';
    const currentFragments = gameState.inventory[fragmentId] || 0;
    if (currentFragments <= 0) {
      return {
        ok: false,
        errorCode: 'NO_FRAGMENTS',
        message: `No tienes ningún ${ITEMS_DATA[fragmentId]?.name || 'Fragmento de alma'} para resonar este código.`,
        hash: baseHash,
        seedUsed: combinedSeed,
        tableId,
        rarity: 'common',
        wasPityTriggered: false,
        pityCounterAfter: gameState.gachaPity![tableId] || 0,
        rewards: [],
        newDiscoveries: [],
      };
    }

    // Verificar ScanLedger (anti-abuso de QR repetido)
    const policy = options?.redeemPolicyOverride || GACHA_CONFIG.redeemPolicy;
    const cooldownHours = options?.cooldownHoursOverride ?? GACHA_CONFIG.cooldownHours;
    const existingScan = [...gameState.scanLedger!]
      .reverse()
      .find((entry) => entry.hash === baseHash);

    if (existingScan) {
      if (policy === 'once_forever') {
        return {
          ok: false,
          errorCode: 'ALREADY_REDEEMED',
          message: 'Este código ya fue resonado',
          hash: baseHash,
          seedUsed: combinedSeed,
          tableId,
          rarity: 'common',
          wasPityTriggered: false,
          pityCounterAfter: gameState.gachaPity![tableId] || 0,
          rewards: [],
          newDiscoveries: [],
        };
      } else if (policy === 'cooldown_hours') {
        const elapsedHours = (nowMs - existingScan.redeemedAt) / (1000 * 60 * 60);
        if (elapsedHours < cooldownHours) {
          const remainingHours = Math.ceil(cooldownHours - elapsedHours);
          return {
            ok: false,
            errorCode: 'ALREADY_REDEEMED',
            message: `Este código ya fue resonado (disponible de nuevo en ${remainingHours}h)`,
            hash: baseHash,
            seedUsed: combinedSeed,
            tableId,
            rarity: 'common',
            wasPityTriggered: false,
            pityCounterAfter: gameState.gachaPity![tableId] || 0,
            rewards: [],
            newDiscoveries: [],
          };
        }
      }
    }

    // Verificar límite diario de canjes
    const todayKey = this.getDateKey(nowMs);
    if (gameState.gachaDailyRedeems!.dateKey !== todayKey) {
      gameState.gachaDailyRedeems = { dateKey: todayKey, count: 0 };
    }
    const dailyLimit = options?.dailyLimitOverride ?? GACHA_CONFIG.dailyRedeemLimit;
    if (gameState.gachaDailyRedeems!.count >= dailyLimit) {
      return {
        ok: false,
        errorCode: 'DAILY_LIMIT_REACHED',
        message: `Has alcanzado el límite diario de ${dailyLimit} resonancias de código. Vuelve mañana.`,
        hash: baseHash,
        seedUsed: combinedSeed,
        tableId,
        rarity: 'common',
        wasPityTriggered: false,
        pityCounterAfter: gameState.gachaPity![tableId] || 0,
        rewards: [],
        newDiscoveries: [],
      };
    }

    // Consumir 1 Fragmento de alma y registrar en el ScanLedger
    gameState.inventory[fragmentId] = currentFragments - 1;
    gameState.scanLedger!.push({
      hash: baseHash,
      redeemedAt: nowMs,
      tableId,
    });
    gameState.gachaDailyRedeems!.count += 1;

    GlobalEventBus.emit('FragmentUsed', {
      itemId: fragmentId,
      remaining: gameState.inventory[fragmentId],
    });
    GlobalEventBus.emit('QrScanned', {
      hash: baseHash,
      payload: trimmed,
    });

    // Determinar rareza y entrada usando RNG determinista derivado del QR (+ salt)
    const rollRng = new Rng(combinedSeed);
    const currentPity = (gameState.gachaPity![tableId] || 0) + 1;
    const pityThreshold = table.pity.threshold;
    const minGuaranteedRarity = table.pity.guaranteedRarity;

    let chosenRarity = this.pickRarity(table, rollRng);
    let wasPityTriggered = false;

    if (currentPity >= pityThreshold && RARITY_RANK[chosenRarity] < RARITY_RANK[minGuaranteedRarity]) {
      chosenRarity = minGuaranteedRarity;
      wasPityTriggered = true;
    }

    // Si el resultado alcanza o supera la rareza garantizada del pity, se reinicia el contador
    if (RARITY_RANK[chosenRarity] >= RARITY_RANK[minGuaranteedRarity]) {
      gameState.gachaPity![tableId] = 0;
    } else {
      gameState.gachaPity![tableId] = currentPity;
    }

    const playerProgress = gameState.player?.badges?.length || 0;
    const chosenEntry = this.pickEntryForRarity(table, chosenRarity, playerProgress, rollRng);

    const rewards: GachaRewardItem[] = [];
    const newDiscoveries: string[] = [];

    if (chosenEntry) {
      const rewardItem = this.applyRewardEntry(chosenEntry, gameState);
      rewards.push(rewardItem);

      const discoveryKey = `${chosenEntry.kind}:${chosenEntry.id}`;
      if (!gameState.gachaDiscoveries!.includes(discoveryKey)) {
        gameState.gachaDiscoveries!.push(discoveryKey);
        newDiscoveries.push(discoveryKey);
      }
    }

    const result: GachaResult = {
      ok: true,
      message: wasPityTriggered
        ? `¡Resonancia garantizada (Pity) activada! Obtuviste recompensa [${chosenRarity.toUpperCase()}].`
        : `¡Resonancia completada! Obtuviste recompensa [${chosenRarity.toUpperCase()}].`,
      hash: baseHash,
      seedUsed: combinedSeed,
      tableId,
      rarity: chosenRarity,
      wasPityTriggered,
      pityCounterAfter: gameState.gachaPity![tableId],
      rewards,
      newDiscoveries,
    };

    GlobalEventBus.emit('GachaRolled', { result });

    return result;
  }

  /**
   * Selecciona una rareza según las probabilidades de la tabla.
   */
  public static pickRarity(table: GachaTable, rng: Rng): GachaRarity {
    const r = rng.next();
    let acc = 0;
    for (const rarity of ORDERED_RARITIES) {
      acc += table.rarityRates[rarity] || 0;
      if (r < acc) {
        return rarity;
      }
    }
    return 'common';
  }

  /**
   * Selecciona una entrada dentro de la rareza elegida respetando pesos y progreso mínimo del jugador.
   */
  public static pickEntryForRarity(
    table: GachaTable,
    rarity: GachaRarity,
    playerProgress: number,
    rng: Rng
  ) {
    let candidates = table.entries.filter(
      (e) =>
        e.rarity === rarity &&
        (e.minPlayerProgress === undefined || playerProgress >= e.minPlayerProgress)
    );
    if (candidates.length === 0) {
      candidates = table.entries.filter((e) => e.rarity === rarity);
    }
    if (candidates.length === 0) {
      candidates = table.entries;
    }

    const totalWeight = candidates.reduce((acc, e) => acc + e.weight, 0);
    let roll = rng.next() * totalWeight;
    for (const entry of candidates) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry;
      }
    }
    return candidates[candidates.length - 1];
  }

  /**
   * Aplica la recompensa al GameState y emite los eventos correspondientes.
   */
  private static applyRewardEntry(
    entry: GachaTable['entries'][number],
    gameState: GameState
  ): GachaRewardItem {
    const qty = entry.quantity || 1;

    if (entry.kind === 'item') {
      const itemDef = ITEMS_DATA[entry.id];
      gameState.inventory[entry.id] = (gameState.inventory[entry.id] || 0) + qty;
      GlobalEventBus.emit('item:obtained', { itemId: entry.id, count: qty });

      return {
        kind: 'item',
        id: entry.id,
        name: itemDef?.name || entry.id,
        rarity: entry.rarity,
        quantity: qty,
      };
    }

    if (entry.kind === 'bodyPiece') {
      const pieceDef = BODY_PIECES_DATA[entry.id];
      const chassisId = pieceDef?.chassisId || 'chassis_madera_t1';
      const required = GACHA_CONFIG.piecesRequired || 5;

      const prevCount = gameState.bodyPieces![chassisId] || 0;
      let newCount = prevCount + qty;
      let assembledBodyInstanceId: string | undefined;

      GlobalEventBus.emit('BodyPieceGained', {
        chassisId,
        count: qty,
        totalForChassis: newCount,
      });

      // Al llegar a 5 piezas se fabrica un BodyInstance completo con IVs tirados por rng seedeable (guardado en el GameState)
      // y se descuentan 5 piezas (los sobrantes se conservan).
      const stateRng = new Rng(gameState.rngSeed ?? 1337);
      while (newCount >= required) {
        newCount -= required;
        const assembled = this.assembleBodyFromPieces(chassisId, gameState, stateRng);
        assembledBodyInstanceId = assembled.instanceId;
      }
      gameState.rngSeed = stateRng.getSeed();
      gameState.bodyPieces![chassisId] = newCount;

      return {
        kind: 'bodyPiece',
        id: entry.id,
        name: pieceDef?.name || entry.id,
        rarity: entry.rarity,
        quantity: qty,
        chassisId,
        piecesCurrent: newCount,
        piecesRequired: required,
        assembledBodyInstanceId,
      };
    }

    // kind === 'scroll'
    const scrollDef = TECHNIQUE_SCROLLS_DATA[entry.id];
    const currentOwned = gameState.inventory[entry.id] || 0;
    const partyOrStorageKnowsMove = [...(gameState.party || []), ...(gameState.storage || [])].some(
      (doll) => doll.moves?.some((m) => m.moveId === scrollDef?.moveId)
    );

    const isDuplicate = currentOwned > 0 || partyOrStorageKnowsMove;
    let convertedToKiDust: number | undefined;

    if (isDuplicate && GACHA_CONFIG.duplicateScrollPolicy === 'convert_ki_dust') {
      const dustYield = GACHA_CONFIG.duplicateScrollKiDustYield[entry.rarity] || 15;
      convertedToKiDust = dustYield * qty;
      gameState.kiDust = (gameState.kiDust || 0) + convertedToKiDust;
      gameState.inventory['ki_dust'] = gameState.kiDust;
    } else {
      gameState.inventory[entry.id] = currentOwned + qty;
    }

    GlobalEventBus.emit('ScrollGained', {
      scrollId: entry.id,
      moveId: scrollDef?.moveId || '',
      convertedToKiDust,
    });

    return {
      kind: 'scroll',
      id: entry.id,
      name: scrollDef?.name || entry.id,
      rarity: entry.rarity,
      quantity: qty,
      moveId: scrollDef?.moveId,
      convertedToKiDust,
    };
  }

  /**
   * Fabrica un BodyInstance completo con IVs tirados por el Rng seedeable guardado en GameState.
   */
  public static assembleBodyFromPieces(chassisId: string, gameState: GameState, rng: Rng) {
    const chassis = BODY_CHASSIS_DATA[chassisId] || BODY_CHASSIS_DATA['chassis_madera_t1'];
    const bodyInstance = StatCalculator.createBodyInstance(
      chassis.id,
      `${chassis.name} (Ensamblado)`,
      rng
    );
    gameState.bodies[bodyInstance.instanceId] = bodyInstance;

    GlobalEventBus.emit('BodyAssembled', {
      chassisId: chassis.id,
      bodyInstanceId: bodyInstance.instanceId,
    });

    return bodyInstance;
  }

  /**
   * Comprueba si una Souldoll es compatible con un Pergamino de técnica (por classId, tipo o tag).
   */
  public static isSouldollCompatibleWithScroll(
    souldoll: Souldoll,
    scroll: TechniqueScroll
  ): boolean {
    const species = SOUL_SPECIES_DATA[souldoll.speciesId];
    if (!species) return false;

    const comp = scroll.compatibility;
    if (!comp) return true;

    if (comp.classIds && comp.classIds.includes(species.classId)) {
      return true;
    }
    if (comp.types && species.types.some((t) => comp.types!.includes(t))) {
      return true;
    }
    if (comp.tags && comp.tags.length > 0) {
      // Comprobar si la especie aprende movimientos con ese tag
      const hasMatchingTagInLearnset = species.learnset.some((lm) => {
        const mDef = MOVES_DATA[lm.moveId];
        return mDef?.tags?.some((tag) => comp.tags!.includes(tag));
      });
      if (hasMatchingTagInLearnset) return true;
    }

    return false;
  }

  /**
   * 4. PERGAMINOS DE TÉCNICA:
   * Usarlos sobre una Souldoll compatible aprende el movimiento reutilizando la lógica/pantalla "aprender/olvidar" (Bloque 9).
   * Si ya lo sabe o es incompatible, se rechaza sin consumir el pergamino.
   */
  public static useTechniqueScroll(
    scrollId: string,
    souldoll: Souldoll,
    gameState: GameState,
    replaceMoveIndex?: number
  ): ScrollTeachResult {
    this.ensureStateInitialized(gameState);

    const scroll = TECHNIQUE_SCROLLS_DATA[scrollId];
    if (!scroll) {
      return {
        ok: false,
        status: 'INVALID',
        message: 'Pergamino de técnica desconocido.',
      };
    }

    const invCount = gameState.inventory[scrollId] || 0;
    if (invCount <= 0) {
      return {
        ok: false,
        status: 'NO_SCROLL',
        message: `No tienes ningún ${scroll.name} en tu inventario.`,
      };
    }

    const moveDef = MOVES_DATA[scroll.moveId];
    if (!moveDef) {
      return {
        ok: false,
        status: 'INVALID',
        message: `Movimiento inválido en el pergamino: ${scroll.moveId}`,
      };
    }

    const species = SOUL_SPECIES_DATA[souldoll.speciesId];
    const dollName = souldoll.nickname || species?.name || souldoll.speciesId;

    // 1. Verificar si ya conoce el movimiento
    if (souldoll.moves.some((m) => m.moveId === scroll.moveId)) {
      return {
        ok: false,
        status: 'ALREADY_KNOWN',
        message: `${dollName} ya conoce la técnica ${moveDef.name}. No se consumió el pergamino.`,
        moveId: moveDef.id,
        moveName: moveDef.name,
      };
    }

    // 2. Verificar compatibilidad (por classId, tipo o tag)
    if (!this.isSouldollCompatibleWithScroll(souldoll, scroll)) {
      return {
        ok: false,
        status: 'INCOMPATIBLE',
        message: `${dollName} (${species?.name || souldoll.speciesId}) no es compatible con ${scroll.name}. No se consumió el pergamino.`,
        moveId: moveDef.id,
        moveName: moveDef.name,
      };
    }

    // 3. Si tiene menos de 4 movimientos, lo aprende directamente
    if (souldoll.moves.length < 4) {
      souldoll.moves.push({
        moveId: moveDef.id,
        currentPp: moveDef.pp,
        maxPp: moveDef.pp,
      });
      gameState.inventory[scrollId] = invCount - 1;

      GlobalEventBus.emit('TechniqueLearned', {
        souldollUid: souldoll.uid,
        speciesId: souldoll.speciesId,
        moveId: moveDef.id,
      });

      return {
        ok: true,
        status: 'LEARNED',
        message: `¡${dollName} estudió el pergamino y aprendió ${moveDef.name}!`,
        moveId: moveDef.id,
        moveName: moveDef.name,
      };
    }

    // 4. Si ya tiene 4 movimientos y no se especificó cuál olvidar, solicitar pantalla aprender/olvidar (Bloque 9)
    if (replaceMoveIndex === undefined || replaceMoveIndex < 0 || replaceMoveIndex >= 4) {
      return {
        ok: false,
        status: 'NEEDS_REPLACEMENT',
        message: `${dollName} ya conoce 4 técnicas. Elige cuál técnica olvidar para aprender ${moveDef.name}.`,
        moveId: moveDef.id,
        moveName: moveDef.name,
      };
    }

    // 5. Reemplazar el movimiento seleccionado y consumir 1 pergamino
    const oldMove = souldoll.moves[replaceMoveIndex];
    const oldMoveDef = MOVES_DATA[oldMove.moveId];
    souldoll.moves[replaceMoveIndex] = {
      moveId: moveDef.id,
      currentPp: moveDef.pp,
      maxPp: moveDef.pp,
    };
    gameState.inventory[scrollId] = invCount - 1;

    GlobalEventBus.emit('TechniqueLearned', {
      souldollUid: souldoll.uid,
      speciesId: souldoll.speciesId,
      moveId: moveDef.id,
      replacedMoveId: oldMove.moveId,
    });

    return {
      ok: true,
      status: 'LEARNED',
      message: `¡1, 2 y... puf! ¡${dollName} olvidó ${oldMoveDef?.name || oldMove.moveId} y aprendió ${moveDef.name}!`,
      moveId: moveDef.id,
      moveName: moveDef.name,
      replacedMoveId: oldMove.moveId,
      replacedMoveName: oldMoveDef?.name || oldMove.moveId,
    };
  }
}
