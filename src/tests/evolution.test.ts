import { StatCalculator } from '../systems/battle/StatCalculator';
import { GlobalEvolutionSystem } from '../systems/evolution/EvolutionSystem';
import { SOUL_SPECIES_DATA } from '../data/souldolls/souls';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export function runAllEvolutionTests() {
  console.log('\n========================================');
  console.log('🧪 EJECUTANDO SUITE DE TESTS: ASCENSIÓN DE SOULDOLLS');
  console.log('========================================\n');

  // TEST 1: Check Level Requirements for all 7 Soul Lines
  console.log('🔹 TEST 1: Verificación de Requisitos de Nivel y Chasis para las 7 Líneas');
  {
    const lines = [
      { base: 'maga', level: 16, target: 'archimaga' },
      { base: 'sacerdotisa', level: 16, target: 'hierofante' },
      { base: 'gladiadora', level: 20, target: 'titanide' },
      { base: 'bruja', level: 18, target: 'hechicera' },
      { base: 'hidromante', level: 16, target: 'cantora_marea' },
      { base: 'monje', level: 18, target: 'maestro_trueno' },
      { base: 'asesina', level: 20, target: 'espectro' },
    ];

    lines.forEach(({ base, level, target }) => {
      const underLevel = StatCalculator.createSouldoll(base, level - 1);
      const readyLevel = StatCalculator.createSouldoll(base, level);

      const checkUnder = GlobalEvolutionSystem.checkAscension(underLevel, 'level_up');
      const checkReady = GlobalEvolutionSystem.checkAscension(readyLevel, 'level_up');

      assert(checkUnder === null, `${SOUL_SPECIES_DATA[base].name} Nv. ${level - 1} NO puede ascender`);
      assert(
        checkReady !== null && checkReady.targetSpeciesId === target,
        `${SOUL_SPECIES_DATA[base].name} Nv. ${level} puede ascender a ${SOUL_SPECIES_DATA[target].name}`
      );
    });
  }

  // TEST 2: Proportional HP Retention & Part HP recalculation
  console.log('\n🔹 TEST 2: Preservación Proporcional de HP y Recálculo por Partes');
  {
    const maga = StatCalculator.createSouldoll('maga', 16);
    // Set HP to exactly 50%
    maga.currentHp = Math.floor(maga.maxHp / 2);
    const initialRatio = maga.currentHp / maga.maxHp;

    const res = GlobalEvolutionSystem.ascendSoul(maga, 'archimaga');

    assert(maga.soulSpeciesId === 'archimaga', `Especie actualizada a 'archimaga'`);
    assert(maga.maxHp >= 50, `Max HP recalculado para Archimaga (${maga.maxHp} PS)`);
    assert(maga.partHP.torso > 0, `Torso HP recalculado (${maga.partHP.torso} PS)`);

    const finalRatio = maga.currentHp / maga.maxHp;
    const ratioDiff = Math.abs(finalRatio - initialRatio);
    assert(
      ratioDiff < 0.05,
      `Ratio de HP mantenido proporcionalmente (~${Math.round(finalRatio * 100)}% de ${maga.maxHp} PS)`
    );
  }

  // TEST 3: Learning New Moves and Equipping Class Weapon Upon Ascension
  console.log('\n🔹 TEST 3: Aprendizaje de Movimientos y Equipamiento de Arma');
  {
    const sacerdotisa = StatCalculator.createSouldoll('sacerdotisa', 16);
    sacerdotisa.moves = [sacerdotisa.moves[0]];

    const res = GlobalEvolutionSystem.ascendSoul(sacerdotisa, 'hierofante');

    assert(sacerdotisa.moves.length > 1, `Hierofante aprendió nuevos movimientos de su learnset (Total: ${sacerdotisa.moves.length})`);
    assert(res.learnedMoves.length > 0, `Nombres de movimientos aprendidos: ${res.learnedMoves.join(', ')}`);
    assert(sacerdotisa.equipped.weapon === 'baculo_solaria', `Arma actualizada a Báculo Solaria`);
  }

  // TEST 4: Body Requirement & Resonance Core Ascension
  console.log('\n🔹 TEST 4: Requisito de Cuerpos y Núcleo de Resonancia');
  {
    const maga = StatCalculator.createSouldoll('maga', 16, 'chassis_madera_t1');
    
    // Check ascension via Resonance Core
    const itemCheck = GlobalEvolutionSystem.checkAscension(maga, 'item', 'nucleo_resonancia');
    assert(itemCheck !== null && itemCheck.targetSpeciesId === 'archimaga', `Núcleo de Resonancia permite gatillar el Ascenso de Maga`);

    // Check body eligibility for Tier 1 chassis vs Tier 2 requirement
    assert(itemCheck !== null && itemCheck.requiredTier === 2, `Archimaga requiere Chasis Tier 2`);
    assert(itemCheck !== null && itemCheck.bodyEligible === false, `Chasis Tier 1 bloquea el Ascenso por ser de menor rango ("el cuerpo no soporta este ki")`);

    // Upgrade body to Tier 2 and verify eligibility
    const magaTier2 = StatCalculator.createSouldoll('maga', 16, 'chassis_madera_reforzada_t2');
    const itemCheckT2 = GlobalEvolutionSystem.checkAscension(magaTier2, 'item', 'nucleo_resonancia');
    assert(itemCheckT2 !== null && itemCheckT2.bodyEligible === true, `Chasis Tier 2 permite el Ascenso a Archimaga`);

    // Enforced gate: checkEvolution (used by the level-up hook) must refuse Tier 1
    assert(
      GlobalEvolutionSystem.checkEvolution(maga, 'item', 'nucleo_resonancia') === null,
      `checkEvolution bloquea el Ascenso con Chasis Tier 1 (minBodyTier aplicado)`
    );
    assert(
      GlobalEvolutionSystem.checkEvolution(magaTier2, 'item', 'nucleo_resonancia') !== null,
      `checkEvolution permite el Ascenso con Chasis Tier 2`
    );
  }
}

runAllEvolutionTests();
