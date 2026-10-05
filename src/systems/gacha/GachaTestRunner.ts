import { GameState } from '../../types';
import { GachaRarity } from '../../types/gacha';
import {
  GACHA_CONFIG,
  GACHA_TABLES_DATA,
  TECHNIQUE_SCROLLS_DATA,
} from '../../data/gacha/gachaData';
import { DataValidator } from '../../data/validation/DataValidator';
import { StatCalculator } from '../battle/StatCalculator';
import { Rng } from '../../core/Rng';
import { GachaService } from './GachaService';

export interface GachaTestSuiteReport {
  allPassed: boolean;
  results: Array<{ name: string; passed: boolean; details: string }>;
  simulationStats: {
    totalRolls: number;
    configuredRates: Record<GachaRarity, number>;
    empiricalRatesWithoutPity: Record<GachaRarity, number>;
    empiricalRatesWithPity: Record<GachaRarity, number>;
    maxDeviationWithoutPity: number;
  };
}

/**
 * BLOQUE 28A Req 7 & Checkpoint:
 * Suite de pruebas automatizadas y simulación de consola (10.000 tiradas) para el sistema de Fragmentos de alma y Gacha.
 */
export class GachaTestRunner {
  private static createMockState(saveId = 'save_test_alpha'): GameState {
    const starterBody = StatCalculator.createBodyInstance('chassis_madera_t1', 'Cuerpo Inicial');
    const maga = StatCalculator.createSouldoll('maga', 10, 'chassis_madera_t1', 'Ignia');
    maga.bodyInstanceId = starterBody.instanceId;

    return {
      version: 2,
      timestamp: 1700000000000,
      playtimeSeconds: 120,
      saveId,
      rngSeed: 987654321,
      player: {
        name: 'Tester',
        position: { x: 6, y: 0.5, z: 8 },
        direction: 'down',
        mapId: 'villa_brote',
        money: 5000,
        badges: ['sello_eco'],
      },
      party: [maga],
      storage: [],
      bodies: {
        [starterBody.instanceId]: starterBody,
      },
      inventory: {
        soul_fragment: 50,
        soul_fragment_brilliant: 10,
      },
      bodyPieces: {},
      kiDust: 0,
      scanLedger: [],
      gachaPity: {},
      gachaDailyRedeems: { dateKey: '2026-10-03', count: 0 },
      gachaDiscoveries: [],
      flags: {},
      vars: {},
      quests: {},
      soulCodex: {},
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

  public static runAllTests(): GachaTestSuiteReport {
    const results: Array<{ name: string; passed: boolean; details: string }> = [];

    // 1. Suma de rarezas = 1 y validación de datos
    const table = GACHA_TABLES_DATA[GACHA_CONFIG.defaultTableId];
    const sumRates =
      table.rarityRates.common +
      table.rarityRates.uncommon +
      table.rarityRates.rare +
      table.rarityRates.epic;
    const sumValid = Math.abs(sumRates - 1.0) < 0.0001;
    results.push({
      name: '1. Suma de probabilidades de rareza = 1.0',
      passed: sumValid,
      details: `Suma configurada en ${table.id}: ${sumRates.toFixed(4)}`,
    });

    // 2. Determinismo por payload y diferenciación por salt de partida
    const stateA1 = this.createMockState('save_partida_1');
    const stateA2 = this.createMockState('save_partida_1');
    const stateB = this.createMockState('save_partida_2');

    const payload = 'https://souldolls.anima/qr/RELIC-ALPHA-001';
    const rollA1 = GachaService.rollFromScan(payload, stateA1, { nowMs: 1700000000000 });
    const rollA2 = GachaService.rollFromScan(payload, stateA2, { nowMs: 1700000000000 });
    const seedB = GachaService.computeDeterministicSeed(payload, stateB, true);

    const sameSaveDeterministic =
      rollA1.ok &&
      rollA2.ok &&
      rollA1.hash === rollA2.hash &&
      rollA1.seedUsed === rollA2.seedUsed &&
      rollA1.rarity === rollA2.rarity &&
      rollA1.rewards[0]?.id === rollA2.rewards[0]?.id;
    const diffSaltChangesSeed = rollA1.seedUsed !== seedB.combinedSeed;

    results.push({
      name: '2. Determinismo por payload y variación por salt de partida',
      passed: sameSaveDeterministic && diffSaltChangesSeed,
      details: `Hash=${rollA1.hash} | Seed(P1)=${rollA1.seedUsed} === ${rollA2.seedUsed} | Seed(P2)=${seedB.combinedSeed} | Premio=${rollA1.rewards[0]?.name}`,
    });

    // 3. QR repetido rechazado sin consumir fragmento
    const fragsBeforeRepeat = stateA1.inventory['soul_fragment'];
    const repeatRoll = GachaService.rollFromScan(payload, stateA1, { nowMs: 1700000005000 });
    const fragsAfterRepeat = stateA1.inventory['soul_fragment'];
    const repeatRejected =
      !repeatRoll.ok &&
      repeatRoll.errorCode === 'ALREADY_REDEEMED' &&
      repeatRoll.message === 'Este código ya fue resonado' &&
      fragsBeforeRepeat === fragsAfterRepeat;

    results.push({
      name: '3. QR repetido rechazado ("Este código ya fue resonado") sin gastar fragmento',
      passed: repeatRejected,
      details: `Mensaje="${repeatRoll.message}" | Fragmentos antes=${fragsBeforeRepeat}, después=${fragsAfterRepeat}`,
    });

    // 4. Pity se activa en el umbral (threshold = 10)
    const statePity = this.createMockState('save_pity_test');
    statePity.gachaPity![table.id] = table.pity.threshold - 1; // 9 tiradas previas sin raro
    // Buscamos un payload cuya tirada base sería common, para verificar que el umbral #10 fuerza rare
    let pityPayload = 'QR-PITY-FORCE-TEST-1';
    for (let i = 0; i < 100; i++) {
      const candidate = `QR-PITY-CANDIDATE-${i}`;
      const { combinedSeed } = GachaService.computeDeterministicSeed(candidate, statePity, true);
      const baseRarity = GachaService.pickRarity(table, new Rng(combinedSeed));
      if (baseRarity === 'common' || baseRarity === 'uncommon') {
        pityPayload = candidate;
        break;
      }
    }
    const pityRoll = GachaService.rollFromScan(pityPayload, statePity, { nowMs: 1700000010000 });
    const pityWorked =
      pityRoll.ok &&
      pityRoll.wasPityTriggered === true &&
      (pityRoll.rarity === 'rare' || pityRoll.rarity === 'epic') &&
      pityRoll.pityCounterAfter === 0;

    results.push({
      name: `4. Pity garantizado se activa en el umbral (${table.pity.threshold} tiradas)`,
      passed: pityWorked,
      details: `wasPityTriggered=${pityRoll.wasPityTriggered} | Rareza obtenida=${pityRoll.rarity} | Contador tras pity=${pityRoll.pityCounterAfter}`,
    });

    // 5. 5 piezas forman el cuerpo completo con IVs y las sobrantes se conservan
    const statePieces = this.createMockState('save_pieces_test');
    statePieces.bodyPieces!['chassis_madera_t1'] = 4; // Ya tiene 4 piezas
    const bodiesBefore = Object.keys(statePieces.bodies).length;
    // Simulamos ganar 2 piezas (4 + 2 = 6 -> 1 cuerpo ensamblado + 1 pieza sobrante)
    const entryTwoPieces = {
      kind: 'bodyPiece' as const,
      id: 'piece_madera_t1',
      weight: 30,
      rarity: 'common' as const,
      quantity: 2,
    };
    const pieceReward = (GachaService as any).applyRewardEntry(entryTwoPieces, statePieces);
    const bodiesAfter = Object.keys(statePieces.bodies).length;
    const leftoverPieces = statePieces.bodyPieces!['chassis_madera_t1'];
    const createdBody = pieceReward.assembledBodyInstanceId
      ? statePieces.bodies[pieceReward.assembledBodyInstanceId]
      : undefined;

    const piecesPassed =
      bodiesAfter === bodiesBefore + 1 &&
      leftoverPieces === 1 &&
      Boolean(createdBody && createdBody.ivs.head >= 0 && createdBody.ivs.torso >= 0);

    results.push({
      name: '5. 5 piezas ensamblan un BodyInstance con IVs y conservan sobrantes (4 + 2 -> 1 cuerpo + 1 sobrante)',
      passed: piecesPassed,
      details: `Cuerpos: ${bodiesBefore}->${bodiesAfter} | Sobrantes: ${leftoverPieces}/5 | BodyID: ${pieceReward.assembledBodyInstanceId}`,
    });

    // 6. Pergamino incompatible rechazado sin consumir, y pergamino compatible enseña o pide reemplazo
    const stateScroll = this.createMockState('save_scroll_test');
    stateScroll.inventory['scroll_impacto_telurico'] = 1; // Solo para Paladín/Tierra/Monje
    stateScroll.inventory['scroll_orbe_flamigero'] = 1; // Compatible con Maga (Fuego)

    const magaDoll = stateScroll.party[0];
    const incompRes = GachaService.useTechniqueScroll(
      'scroll_impacto_telurico',
      magaDoll,
      stateScroll
    );
    const incompNotConsumed = stateScroll.inventory['scroll_impacto_telurico'] === 1;

    // Aseguramos que tenga menos de 4 movimientos para aprender directo
    magaDoll.moves = magaDoll.moves.slice(0, 2);
    const compRes = GachaService.useTechniqueScroll('scroll_orbe_flamigero', magaDoll, stateScroll);
    const compConsumed = stateScroll.inventory['scroll_orbe_flamigero'] === 0;
    const alreadyKnownRes = GachaService.useTechniqueScroll(
      'scroll_orbe_flamigero',
      magaDoll,
      { ...stateScroll, inventory: { scroll_orbe_flamigero: 1 } }
    );

    const scrollTestPassed =
      !incompRes.ok &&
      incompRes.status === 'INCOMPATIBLE' &&
      incompNotConsumed &&
      compRes.ok &&
      compRes.status === 'LEARNED' &&
      compConsumed &&
      !alreadyKnownRes.ok &&
      alreadyKnownRes.status === 'ALREADY_KNOWN';

    results.push({
      name: '6. Pergamino incompatible o repetido se rechaza sin consumir; compatible enseña técnica',
      passed: scrollTestPassed,
      details: `Incompatible=${incompRes.status} (inv=${stateScroll.inventory['scroll_impacto_telurico']}) | Compatible=${compRes.status} | Ya conocido=${alreadyKnownRes.status}`,
    });

    // 7. Simulación de 10.000 tiradas que verifica tasas dentro de ±2% de lo configurado
    const totalRolls = 10000;
    const simRng = new Rng(20261003);
    const countsNoPity: Record<GachaRarity, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
    };
    const countsWithPity: Record<GachaRarity, number> = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
    };

    let simPity = 0;
    for (let i = 0; i < totalRolls; i++) {
      const r = GachaService.pickRarity(table, simRng);
      countsNoPity[r]++;

      simPity++;
      let effectiveR = r;
      if (simPity >= table.pity.threshold && (r === 'common' || r === 'uncommon')) {
        effectiveR = table.pity.guaranteedRarity;
      }
      if (effectiveR === 'rare' || effectiveR === 'epic') {
        simPity = 0;
      }
      countsWithPity[effectiveR]++;
    }

    const empiricalRatesWithoutPity: Record<GachaRarity, number> = {
      common: countsNoPity.common / totalRolls,
      uncommon: countsNoPity.uncommon / totalRolls,
      rare: countsNoPity.rare / totalRolls,
      epic: countsNoPity.epic / totalRolls,
    };
    const empiricalRatesWithPity: Record<GachaRarity, number> = {
      common: countsWithPity.common / totalRolls,
      uncommon: countsWithPity.uncommon / totalRolls,
      rare: countsWithPity.rare / totalRolls,
      epic: countsWithPity.epic / totalRolls,
    };

    const deviations = (['common', 'uncommon', 'rare', 'epic'] as GachaRarity[]).map((rar) =>
      Math.abs(empiricalRatesWithoutPity[rar] - table.rarityRates[rar])
    );
    const maxDeviationWithoutPity = Math.max(...deviations);
    const ratesWithinTolerance = maxDeviationWithoutPity <= 0.02;

    results.push({
      name: '7. Simulación de 10.000 tiradas dentro de ±2% de las tasas configuradas',
      passed: ratesWithinTolerance,
      details: `Max desviación=${(maxDeviationWithoutPity * 100).toFixed(2)}% (Límite ±2.00%) | Base: C=${(
        empiricalRatesWithoutPity.common * 100
      ).toFixed(1)}% U=${(empiricalRatesWithoutPity.uncommon * 100).toFixed(1)}% R=${(
        empiricalRatesWithoutPity.rare * 100
      ).toFixed(1)}% E=${(empiricalRatesWithoutPity.epic * 100).toFixed(1)}%`,
    });

    const allPassed = results.every((r) => r.passed);

    console.log('\n========================================================================');
    console.log('🔮 [BLOQUE 28A] CHECKPOINT DE CONSOLA: FRAGMENTOS DE ALMA Y GACHA');
    console.log('========================================================================');
    if (console.table) {
      console.table(
        results.map((r) => ({
          Prueba: r.name,
          Estado: r.passed ? 'PASS' : 'FAIL',
          Detalle: r.details,
        }))
      );
      console.table({
        Configurado: {
          Common: `${(table.rarityRates.common * 100).toFixed(1)}%`,
          Uncommon: `${(table.rarityRates.uncommon * 100).toFixed(1)}%`,
          Rare: `${(table.rarityRates.rare * 100).toFixed(1)}%`,
          Epic: `${(table.rarityRates.epic * 100).toFixed(1)}%`,
        },
        'Empírico Base (10k)': {
          Common: `${(empiricalRatesWithoutPity.common * 100).toFixed(2)}%`,
          Uncommon: `${(empiricalRatesWithoutPity.uncommon * 100).toFixed(2)}%`,
          Rare: `${(empiricalRatesWithoutPity.rare * 100).toFixed(2)}%`,
          Epic: `${(empiricalRatesWithoutPity.epic * 100).toFixed(2)}%`,
        },
        'Empírico Con Pity (10k)': {
          Common: `${(empiricalRatesWithPity.common * 100).toFixed(2)}%`,
          Uncommon: `${(empiricalRatesWithPity.uncommon * 100).toFixed(2)}%`,
          Rare: `${(empiricalRatesWithPity.rare * 100).toFixed(2)}%`,
          Epic: `${(empiricalRatesWithPity.epic * 100).toFixed(2)}%`,
        },
      });
    }
    console.log('========================================================================\n');

    return {
      allPassed,
      results,
      simulationStats: {
        totalRolls,
        configuredRates: table.rarityRates,
        empiricalRatesWithoutPity,
        empiricalRatesWithPity,
        maxDeviationWithoutPity,
      },
    };
  }
}
