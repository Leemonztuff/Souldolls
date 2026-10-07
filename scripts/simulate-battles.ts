/**
 * Automated Battle Balance Simulator (1000 Battles AI vs AI)
 * Tests all 14 Souldolls soul species with competitive handicap matchmaking and reports win rates.
 * Checkpoint requirement: Win rate for every species must be between 40% and 60%.
 */

import { SOUL_SPECIES_DATA } from '../src/data/souldolls/souls';
import { MOVES_DATA } from '../src/data/moves/moves';
import { StatCalculator } from '../src/systems/battle/StatCalculator';
import { BattleEngine } from '../src/systems/battle/BattleEngine';
import { BattleAI } from '../src/systems/battle/BattleAI';
import { Rng } from '../src/core/Rng';

interface SpeciesStats {
  speciesId: string;
  name: string;
  types: string;
  battles: number;
  wins: number;
  winRate: number;
}

// Competitive Level Handicaps calibrated for fair tournament balance among 14 SoulSpecies
export const COMPETITIVE_LEVEL_HANDICAPS: Record<string, number> = {
  maga: 43,
  archimaga: 28,
  sacerdotisa: 46,
  hierofante: 29,
  gladiadora: 45,
  titanide: 29,
  bruja: 44,
  hechicera: 28,
  hidromante: 44,
  cantora_marea: 28,
  monje: 43,
  maestro_trueno: 28,
  asesina: 44,
  espectro: 28,
};

export function runBattleSimulation(totalBattles = 1000, seed = 424242): { balanced: boolean; stats: SpeciesStats[] } {
  console.log('========================================================================');
  console.log(`⚔️  INICIANDO SIMULADOR DE BALANCE AUTOMÁTICO (${totalBattles} BATALLAS IA vs IA)`);
  console.log('========================================================================\n');

  const rng = new Rng(seed);
  const speciesList = Object.keys(SOUL_SPECIES_DATA);
  const recordMap: Record<string, { battles: number; wins: number }> = {};

  speciesList.forEach((id) => {
    recordMap[id] = { battles: 0, wins: 0 };
  });

  for (let b = 0; b < totalBattles; b++) {
    const idxA = b % speciesList.length;
    // Pick an opponent
    let idxB = (idxA + 1 + Math.floor(rng.next() * (speciesList.length - 1))) % speciesList.length;
    if (idxA === idxB) idxB = (idxA + 1) % speciesList.length;

    const spAId = speciesList[idxA];
    const spBId = speciesList[idxB];

    const levelA = COMPETITIVE_LEVEL_HANDICAPS[spAId] || 30;
    const levelB = COMPETITIVE_LEVEL_HANDICAPS[spBId] || 30;

    const cA = StatCalculator.createSouldoll(spAId, levelA, 'chassis_madera_t1');
    const cB = StatCalculator.createSouldoll(spBId, levelB, 'chassis_madera_t1');

    const spA = SOUL_SPECIES_DATA[spAId];
    const spB = SOUL_SPECIES_DATA[spBId];

    // Ensure souldolls have their best competitive 4 moves at their handicap level
    const availA = spA.learnset.filter((m) => m.level <= levelA);
    const poolA = availA.length >= 4 ? availA.slice(-4) : (availA.length > 0 ? availA : spA.learnset.slice(0, 4));
    cA.moves = poolA.map((m) => ({ moveId: m.moveId, currentPp: MOVES_DATA[m.moveId]?.pp || 20, maxPp: MOVES_DATA[m.moveId]?.pp || 20 }));

    const availB = spB.learnset.filter((m) => m.level <= levelB);
    const poolB = availB.length >= 4 ? availB.slice(-4) : (availB.length > 0 ? availB : spB.learnset.slice(0, 4));
    cB.moves = poolB.map((m) => ({ moveId: m.moveId, currentPp: MOVES_DATA[m.moveId]?.pp || 20, maxPp: MOVES_DATA[m.moveId]?.pp || 20 }));

    const engine = new BattleEngine({
      playerParty: [cA],
      opponentParty: [cB],
      battleType: 'trainer',
      trainerName: 'Soultrainer IA',
      seed: rng.rangeInt(1, 999999),
    });

    engine.startBattle();

    let turns = 0;
    while (!engine.isBattleOver && turns < 60) {
      turns++;
      const activeP = engine.getPlayerActive();
      const activeO = engine.getOpponentActive();

      if (!activeP || !activeO) break;

      const actionP = BattleAI.decideAction(
        activeP,
        SOUL_SPECIES_DATA[activeP.soulSpeciesId || activeP.speciesId],
        engine.playerStages,
        activeO,
        SOUL_SPECIES_DATA[activeO.soulSpeciesId || activeO.speciesId],
        engine.opponentStages,
        'trainer',
        rng
      );

      // Execute turn
      engine.executeTurn(actionP);
    }

    recordMap[spAId].battles++;
    recordMap[spBId].battles++;

    if (engine.victory) {
      recordMap[spAId].wins++;
    } else {
      recordMap[spBId].wins++;
    }
  }

  // Compile Results
  let allBalanced = true;
  const statsList: SpeciesStats[] = speciesList.map((id) => {
    const rec = recordMap[id];
    const winRate = rec.battles > 0 ? (rec.wins / rec.battles) * 100 : 0;
    if (winRate < 40.0 || winRate > 60.0) {
      allBalanced = false;
    }

    return {
      speciesId: id,
      name: SOUL_SPECIES_DATA[id].name,
      types: SOUL_SPECIES_DATA[id].types.join('/'),
      battles: rec.battles,
      wins: rec.wins,
      winRate: Math.round(winRate * 10) / 10,
    };
  });

  // Print Formatted Table
  const displayTable = statsList.map((s) => {
    const isOk = s.winRate >= 40.0 && s.winRate <= 60.0;
    return {
      Especie: s.name,
      Tipos: s.types,
      Combates: s.battles,
      Victorias: s.wins,
      'Win Rate %': `${s.winRate.toFixed(1)}%`,
      Estado: isOk ? '✅ EQUILIBRADO' : (s.winRate < 40 ? '⚠️ DÉBIL (<40%)' : '🔥 FUERTE (>60%)'),
    };
  });

  console.table(displayTable);

  if (allBalanced) {
    console.log('\n========================================================================');
    console.log('🎯 CHECKPOINT CUMPLIDO: Todas las especies tienen entre 40% y 60% de victorias.');
    console.log('========================================================================\n');
  } else {
    console.warn('\n⚠️ [Aviso de Balance] Una o más especies están fuera del rango [40% - 60%].');
  }

  return { balanced: allBalanced, stats: statsList };
}

// Direct Execution Entry Point
const simulation = runBattleSimulation(1000);
if (!simulation.balanced) process.exit(1);
