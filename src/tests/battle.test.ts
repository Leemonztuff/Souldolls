import { StatCalculator } from '../systems/battle/StatCalculator';
import { DamageCalculator } from '../systems/battle/DamageCalculator';
import { ExpCalculator } from '../systems/battle/ExpCalculator';
import { CaptureCalculator } from '../systems/battle/CaptureCalculator';
import { BattleEngine } from '../systems/battle/BattleEngine';
import { SOUL_SPECIES_DATA } from '../data/souldolls/souls';
import { MOVES_DATA } from '../data/moves/moves';
import { Souldoll } from '../types/souldolls';
import { Rng } from '../core/Rng';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function createTestSouldoll(speciesId: string, level: number, customNickname?: string): Souldoll {
  const species = SOUL_SPECIES_DATA[speciesId];
  if (!species) throw new Error(`Unknown species: ${speciesId}`);

  return StatCalculator.createSouldoll(
    speciesId,
    level,
    'chassis_madera_t1',
    customNickname,
    'docil',
    { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, speed: 15 }
  );
}

export function runAllBattleTests() {
  console.log('\n========================================');
  console.log('🧪 EJECUTANDO SUITE DE TESTS: SOULDOLLS BATTLE ENGINE');
  console.log('========================================\n');

  // TEST 1: Stats, Part HP & Experience Calculation
  console.log('🔹 TEST 1: Cálculo de Stats, Part HP y Curvas de Experiencia');
  {
    const maga = SOUL_SPECIES_DATA['maga'];
    const hpLv5 = StatCalculator.calculateMaxHp(maga.baseStats.hp, 5);
    const hpLv50 = StatCalculator.calculateMaxHp(maga.baseStats.hp, 50);

    assert(hpLv5 === 19, `HP Maga Nv. 5 es 19 (obtenido ${hpLv5})`);
    assert(hpLv50 === 104, `HP Maga Nv. 50 es 104 (obtenido ${hpLv50})`);

    const partHp = StatCalculator.calculatePartHp(100, 'chassis_madera_t1');
    assert(partHp.head === 15, `Cabeza reparto 15% = 15 (obtenido ${partHp.head})`);
    assert(partHp.torso === 40, `Torso reparto 40% = 40 (obtenido ${partHp.torso})`);
    assert(partHp.arms === 20, `Brazos reparto 20% = 20 (obtenido ${partHp.arms})`);
    assert(partHp.legs === 25, `Piernas reparto 25% = 25 (obtenido ${partHp.legs})`);
    assert(partHp.head + partHp.torso + partHp.arms + partHp.legs === 100, `Suma de partes = 100 PS`);

    const expLv5 = ExpCalculator.getExpForLevel(5, 'medium_fast');
    const expLv6 = ExpCalculator.getExpForLevel(6, 'medium_fast');
    assert(expLv5 === 125, `Exp Nv. 5 medium_fast = 125 (obtenido ${expLv5})`);
    assert(expLv6 === 216, `Exp Nv. 6 medium_fast = 216 (obtenido ${expLv6})`);

    const evalResult = ExpCalculator.evaluateExp(220, 5, 'medium_fast');
    assert(evalResult.newLevel === 6, `220 EXP en Nv 5 sube a Nv 6`);
    assert(evalResult.didLevelUp === true, `didLevelUp es true`);
  }

  // TEST 2: Type Effectiveness Multipliers (7 Types)
  console.log('\n🔹 TEST 2: Multiplicadores de Efectividad Elemental (7 Tipos)');
  {
    const fireVsGrass = DamageCalculator.calculateTypeEffectiveness('Fuego', ['Planta']);
    assert(fireVsGrass.multiplier === 2.0, `Fuego contra Planta es 2.0x (Súper eficaz)`);
    assert(fireVsGrass.rating === 'super_effective', `Rating es super_effective`);

    const waterVsFire = DamageCalculator.calculateTypeEffectiveness('Agua', ['Fuego']);
    assert(waterVsFire.multiplier === 2.0, `Agua contra Fuego es 2.0x`);

    const electricVsGround = DamageCalculator.calculateTypeEffectiveness('Eléctrico', ['Tierra']);
    assert(electricVsGround.multiplier === 0.0, `Eléctrico contra Tierra es 0.0x (Inmune)`);
    assert(electricVsGround.rating === 'immune', `Rating es immune`);

    const shadowVsNeutral = DamageCalculator.calculateTypeEffectiveness('Sombra', ['Neutro']);
    assert(shadowVsNeutral.multiplier === 2.0, `Sombra contra Neutro es 2.0x`);
  }

  // TEST 3: Damage Formula, STAB, Critical Hits & Stat Stages
  console.log('\n🔹 TEST 3: Fórmula de Daño, STAB y Críticos');
  {
    const rng = new Rng(42);
    const maga = createTestSouldoll('maga', 10);
    const sacerdotisa = createTestSouldoll('sacerdotisa', 10);
    const pStages = StatCalculator.createInitialStages();
    const oStages = StatCalculator.createInitialStages();
    const emberMove = MOVES_DATA['ascuas'];

    const damageRes = DamageCalculator.calculateDamage(
      maga,
      SOUL_SPECIES_DATA['maga'],
      pStages,
      sacerdotisa,
      SOUL_SPECIES_DATA['sacerdotisa'],
      oStages,
      emberMove,
      rng
    );

    assert(damageRes.isHit, `Ataque Ascuas acertó`);
    assert(damageRes.stabMultiplier === 1.5, `STAB de Maga usando Ascuas es 1.5x`);
    assert(damageRes.typeMultiplier === 2.0, `Multiplicador de tipo contra Sacerdotisa es 2.0x`);
    assert(damageRes.damage > 10, `Daño calculado es significativo (${damageRes.damage} PS)`);

    pStages.spAtk = 2; // +2 stage = 2.0x
    const boostedRes = DamageCalculator.calculateDamage(
      maga,
      SOUL_SPECIES_DATA['maga'],
      pStages,
      sacerdotisa,
      SOUL_SPECIES_DATA['sacerdotisa'],
      oStages,
      emberMove,
      rng
    );
    assert(boostedRes.damage > damageRes.damage, `Daño con +2 SpAtk (${boostedRes.damage}) > daño normal (${damageRes.damage})`);
  }

  // TEST 4: Capture Formula: Low HP vs Full HP + Soul Bottles
  console.log('\n🔹 TEST 4: Probabilidad de Captura con Soul Bottles a HP Bajo vs Completo');
  {
    const targetFullHp = createTestSouldoll('asesina', 8);
    const targetLowHp = createTestSouldoll('asesina', 8);
    targetLowHp.currentHp = 1;
    targetLowHp.status = 'sleep';

    const rng1 = new Rng(100);
    const rng2 = new Rng(100);

    let fullHpCatches = 0;
    let lowHpCatches = 0;
    const trials = 500;

    for (let i = 0; i < trials; i++) {
      if (CaptureCalculator.calculateCapture(targetFullHp, SOUL_SPECIES_DATA['asesina'], 'soul_bottle_comun', rng1).success) {
        fullHpCatches++;
      }
      if (CaptureCalculator.calculateCapture(targetLowHp, SOUL_SPECIES_DATA['asesina'], 'soul_bottle_comun', rng2).success) {
        lowHpCatches++;
      }
    }

    assert(
      lowHpCatches > fullHpCatches,
      `Tasa de captura con 1 HP + Sueño (${lowHpCatches}/${trials}) es mucho mayor que a HP completo (${fullHpCatches}/${trials})`
    );
  }

  // TEST 5: Full Simulated Deterministic Battle with Seed Reproducibility
  console.log('\n🔹 TEST 5: Simulación Completa y Reproducibilidad Determinista por Semilla');
  {
    const makeEngine = (seed: number) => {
      const playerParty = [createTestSouldoll('maga', 10, 'Maga')];
      const enemyParty = [createTestSouldoll('sacerdotisa', 8, 'Sacerdotisa Salvaje')];
      return new BattleEngine({
        playerParty,
        opponentParty: enemyParty,
        battleType: 'wild',
        seed,
      });
    };

    const engine1 = makeEngine(9999);
    const engine2 = makeEngine(9999);

    const log1: string[] = [];
    const log2: string[] = [];

    const start1 = engine1.startBattle();
    const start2 = engine2.startBattle();
    start1.forEach((e) => log1.push(JSON.stringify(e)));
    start2.forEach((e) => log2.push(JSON.stringify(e)));

    let turn = 0;
    while (!engine1.isBattleOver && turn < 15) {
      turn++;
      const evs1 = engine1.executeTurn({ type: 'move', moveIndex: 0 });
      const evs2 = engine2.executeTurn({ type: 'move', moveIndex: 0 });
      evs1.forEach((e) => log1.push(JSON.stringify(e)));
      evs2.forEach((e) => log2.push(JSON.stringify(e)));
    }

    assert(engine1.isBattleOver, `La batalla concluyó en ${turn} turnos`);
    assert(engine1.victory === true, `El jugador Maga venció a la Sacerdotisa salvaje`);
    assert(log1.length === log2.length, `Ambas simulaciones generaron exactamente ${log1.length} eventos`);
    assert(
      JSON.stringify(log1) === JSON.stringify(log2),
      `Reproducibilidad 100% idéntica carácter por carácter con semilla (Seed 9999)`
    );
  }

  // TEST 6: Part HP Formula with Chassis PartShare, IVs and EVs
  console.log('\n🔹 TEST 6: Fórmula de Reparto de Vida por Partes (Chassis + IVs + EVs)');
  {
    const poolHp = 100;
    const ivs = { head: 31, torso: 24, arms: 16, legs: 8 };
    const evs = { head: 64, torso: 32, arms: 0, legs: 16 };
    // Chassis Madera T1: head 15%, torso 40%, arms 20%, legs 25%
    // partMax[head] = floor(100*0.15) + floor(31/4) + floor(64/16) = 15 + 7 + 4 = 26
    // partMax[torso] = floor(100*0.40) + floor(24/4) + floor(32/16) = 40 + 6 + 2 = 48
    // partMax[arms] = floor(100*0.20) + floor(16/4) + floor(0/16) = 20 + 4 + 0 = 24
    // partMax[legs] = floor(100*0.25) + floor(8/4) + floor(16/16) = 25 + 2 + 1 = 28
    const partMax = StatCalculator.calculatePartMaxHp(poolHp, 'chassis_madera_t1', ivs, evs);
    assert(partMax.head === 26, `Cabeza con IVs y EVs = 26 (obtenido ${partMax.head})`);
    assert(partMax.torso === 48, `Torso con IVs y EVs = 48 (obtenido ${partMax.torso})`);
    assert(partMax.arms === 24, `Brazos con IVs y EVs = 24 (obtenido ${partMax.arms})`);
    assert(partMax.legs === 28, `Piernas con IVs y EVs = 28 (obtenido ${partMax.legs})`);
    const sumPartMax = partMax.head + partMax.torso + partMax.arms + partMax.legs;
    assert(sumPartMax === 126, `Suma total de partes = 126 PS`);
  }

  // TEST 7: Part Damage, Redirection and Overflow
  console.log('\n🔹 TEST 7: Daño por Parte, Redirección de Partes Rotas y Desborde');
  {
    const paladin = createTestSouldoll('gladiadora', 15);
    StatCalculator.ensurePartHp(paladin);

    const initialArms = paladin.partHP.arms;
    const initialTorso = paladin.partHP.torso;

    // 1. Damage arms
    const hit1 = StatCalculator.applyPartDamage(paladin, 'arms', 5);
    assert(hit1.chosenPart === 'arms', `Golpe dirigido a brazos`);
    assert(paladin.partHP.arms === initialArms - 5, `Brazos recibieron 5 de daño`);

    // 2. Break arms completely
    const armsRemaining = paladin.partHP.arms;
    const hit2 = StatCalculator.applyPartDamage(paladin, 'arms', armsRemaining);
    assert(paladin.partHP.arms === 0, `Brazos reducidos a 0 PS`);
    assert(hit2.isNowBroken === true, `Brazos marcados como destruidos`);
    assert(hit2.faintReason === undefined, `Pérdida de brazos NO causa K.O.`);

    // 3. Redirection to torso because arms are already broken
    const hit3 = StatCalculator.applyPartDamage(paladin, 'arms', 10);
    assert(hit3.chosenPart === 'torso', `Ataque a brazos rotos redirigido automáticamente a Torso`);
    assert(hit3.damageToPart === 10, `Torso absorbió el daño redirigido`);
  }

  // TEST 8: Immediate Fatal K.O. via Head or Torso Break
  console.log('\n🔹 TEST 8: K.O. Inmediato por Cabeza o Torso a 0 PS');
  {
    // Test Head Fatal
    const dollHead = createTestSouldoll('maga', 10);
    StatCalculator.ensurePartHp(dollHead);
    const headHit = StatCalculator.applyPartDamage(dollHead, 'head', 999);
    assert(dollHead.partHP.head === 0, `Cabeza reducida a 0`);
    assert(headHit.faintReason === 'head_broken', `faintReason es 'head_broken'`);
    assert(dollHead.currentHp === 0, `HP total queda en 0 (K.O.)`);

    // Test Torso Fatal
    const dollTorso = createTestSouldoll('maga', 10);
    StatCalculator.ensurePartHp(dollTorso);
    const torsoHit = StatCalculator.applyPartDamage(dollTorso, 'torso', 999);
    assert(dollTorso.partHP.torso === 0, `Torso reducido a 0`);
    assert(torsoHit.faintReason === 'torso_broken', `faintReason es 'torso_broken'`);
    assert(dollTorso.currentHp === 0, `HP total queda en 0 (K.O.)`);
  }

  // TEST 9: Broken Parts Derived Modifiers (Arms Physical & Weapon Tag, Legs Speed & Evasion)
  console.log('\n🔹 TEST 9: Modificadores Derivados de Partes Rotas (Brazos y Piernas)');
  {
    const monje = createTestSouldoll('monje', 10);
    StatCalculator.ensurePartHp(monje);
    const dummyRival = createTestSouldoll('bruja', 10);
    const rng = new Rng(123);
    const stages = StatCalculator.createInitialStages();
    const punchMove = MOVES_DATA['punio_trueno'] || MOVES_DATA['placaje'];

    // Normal damage with intact arms
    const normalDmg = DamageCalculator.calculateDamage(
      monje,
      SOUL_SPECIES_DATA['monje'],
      stages,
      dummyRival,
      SOUL_SPECIES_DATA['bruja'],
      stages,
      punchMove,
      rng
    );

    // Break arms
    monje.partHP.arms = 0;
    const rng2 = new Rng(123);
    const brokenArmsDmg = DamageCalculator.calculateDamage(
      monje,
      SOUL_SPECIES_DATA['monje'],
      stages,
      dummyRival,
      SOUL_SPECIES_DATA['bruja'],
      stages,
      punchMove,
      rng2
    );

    assert(
      brokenArmsDmg.damage < normalDmg.damage,
      `Daño físico con brazos rotos (${brokenArmsDmg.damage} PS) es menor que normal (${normalDmg.damage} PS)`
    );

    // Speed penalty when legs broken
    const fullSpeed = monje.stats.speed;
    const engine = new BattleEngine({
      playerParty: [monje],
      opponentParty: [dummyRival],
      battleType: 'wild',
    });

    monje.partHP.legs = 10;
    const normalEffSpeed = engine.getEffectiveSpeed(monje, stages);
    monje.partHP.legs = 0;
    const brokenLegsSpeed = engine.getEffectiveSpeed(monje, stages);

    assert(
      brokenLegsSpeed === Math.floor(normalEffSpeed * 0.5),
      `Velocidad con piernas rotas (${brokenLegsSpeed}) es exactamente 50% de normal (${normalEffSpeed})`
    );
  }

  // TEST 10: Priority-Based Healing and Reincarnation
  console.log('\n🔹 TEST 10: Curación por Prioridad y Reencarnación');
  {
    const doll = createTestSouldoll('sacerdotisa', 12);
    StatCalculator.ensurePartHp(doll);
    // Damage all parts
    doll.partHP.torso = 2;
    doll.partHP.head = 1;
    doll.partHP.legs = 1;
    doll.partHP.arms = 1;
    doll.currentHp = 5;

    // Heal 15 PS -> Torso has priority 1, then head
    const healResult = StatCalculator.distributeHeal(doll, 15);
    assert(healResult.actualHealed === 15, `Se curaron exactamente 15 PS`);
    assert(healResult.partHeals[0].part === 'torso', `Primera parte curada fue Torso (prioridad 1)`);

    // Reencarnación
    doll.partHP.head = 0;
    doll.currentHp = 0;
    const engine = new BattleEngine({
      playerParty: [doll],
      opponentParty: [createTestSouldoll('bruja', 10)],
      battleType: 'wild',
    });
    const evs: any[] = [];
    (engine as any).handleItemAction('reencarnacion', 'player', evs);
    assert(doll.partHP.head > 0, `Cabeza revivida con Reencarnación`);
    assert(doll.partHP.torso > 0, `Torso revivido con Reencarnación`);
    assert(doll.currentHp > 0, `Souldoll revivió exitosamente`);
  }

  // TEST 11: Checkpoint Simulation: Part Breakdown, Lost Arms Continuing Fight & Torso KO
  console.log('\n🔹 TEST 11: Checkpoint Simulado por Consola (Daño por partes, brazos rotos y KO por torso)');
  {
    console.log('  ────────────────────────────────────────────────────────────────────────');
    console.log('  ⚔️ SIMULACIÓN 1: Monje pierde los brazos y continúa luchando');
    const fighter = createTestSouldoll('monje', 20, 'Monje Valiente');
    const rival = createTestSouldoll('bruja', 15, 'Bruja Sombría');
    StatCalculator.ensurePartHp(fighter);
    StatCalculator.ensurePartHp(rival);

    // Break fighter's arms manually to test combat continuation
    fighter.partHP.arms = 0;
    fighter.currentHp = fighter.partHP.head + fighter.partHP.torso + fighter.partHP.arms + fighter.partHP.legs;

    console.log(`    • Souldoll inicial: ${fighter.nickname} (Cabeza:${fighter.partHP.head}, Torso:${fighter.partHP.torso}, Brazos:${fighter.partHP.arms}, Piernas:${fighter.partHP.legs}, Total:${fighter.currentHp})`);
    console.log(`    ⚠️ ¡Los brazos de ${fighter.nickname} han sido destruidos! (Brazos: 0 PS)`);

    const simEngine = new BattleEngine({
      playerParty: [fighter],
      opponentParty: [rival],
      battleType: 'trainer',
      trainerName: 'Maestro Artífice',
      seed: 7777,
    });
    
    // Fighter attacks with move index 0
    const turn1Events = simEngine.executeTurn({ type: 'move', moveIndex: 0 });
    const blockedEv = turn1Events.find((e) => e.type === 'MOVE_BLOCKED');
    const damageEv = turn1Events.find((e) => e.type === 'PART_DAMAGED');
    
    if (blockedEv) {
      console.log(`    🛡️ Evento MOVE_BLOCKED recibido: ${blockedEv.message}`);
    }
    if (damageEv) {
      console.log(`    💥 Daño por parte aplicado a [${damageEv.part}]: ${damageEv.damage} PS infligidos`);
    }

    assert(fighter.currentHp > 0, `El Monje con brazos rotos sigue con vida (${fighter.currentHp} PS) y en combate`);

    console.log('\n  ⚔️ SIMULACIÓN 2: K.O. Fatal al destruir el Torso');
    const target = createTestSouldoll('gladiadora', 10, 'Gladiadora Guardián');
    StatCalculator.ensurePartHp(target);
    const fatalTorsoHit = StatCalculator.applyPartDamage(target, 'torso', target.partHP.torso + 10);
    console.log(`    💥 Ataque directo al Torso! Daño: ${fatalTorsoHit.damageToPart} PS. Torso restante: ${target.partHP.torso} PS`);
    console.log(`    💀 Resultado: ${fatalTorsoHit.faintReason} (HP total: ${target.currentHp} PS)`);
    assert(fatalTorsoHit.faintReason === 'torso_broken', `K.O. por Torso verificado`);
    assert(target.currentHp === 0, `HP en 0 confirmado`);
    console.log('  ────────────────────────────────────────────────────────────────────────');
  }

  console.log('\n========================================');
  console.log('✅ TODOS LOS TESTS DEL MOTOR DE BATALLA (BLOQUE 17) HAN PASADO EXITOSAMENTE!');
  console.log('========================================\n');
}

runAllBattleTests();

