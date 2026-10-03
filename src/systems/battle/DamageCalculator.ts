import { CreatureInstance } from '../../types';
import { CreatureSpecies } from '../../types/creatures';
import { Move } from '../../types/moves';
import { TYPE_CHART } from '../../data/types/typeChart';
import { StatCalculator, PARTS_CONFIG } from './StatCalculator';
import { BattleStatStages, EffectivenessRating } from './BattleTypes';
import { Rng } from '../../core/Rng';
import { getAbility } from '../../data/abilities/abilities';

export interface DamageCalculationResult {
  damage: number;
  isHit: boolean;
  isCritical: boolean;
  effectivenessRating: EffectivenessRating;
  typeMultiplier: number;
  stabMultiplier: number;
  randomFactor: number;
}

export class DamageCalculator {
  /**
   * Evaluates whether a move hits its target
   */
  public static checkAccuracy(
    move: Move,
    attackerStages: BattleStatStages,
    defenderStages: BattleStatStages,
    rng: Rng,
    defender?: CreatureInstance
  ): boolean {
    if (move.accuracy === null || move.accuracy >= 100) {
      return true;
    }

    const accMultiplier = StatCalculator.getAccuracyStageMultiplier(attackerStages.accuracy);
    let defenderEvasionStage = defenderStages.evasion;
    // Derived modifier: if legs are broken, -1 evasion stage
    if (defender && defender.partHP && defender.partHP.legs <= 0) {
      const evasionMod = PARTS_CONFIG.parts?.legs?.evasionStageModifier ?? -1;
      defenderEvasionStage += evasionMod;
    }
    const evaMultiplier = StatCalculator.getAccuracyStageMultiplier(defenderEvasionStage);
    const hitChance = move.accuracy * (accMultiplier / evaMultiplier);

    const roll = rng.next() * 100;
    return roll < hitChance;
  }

  /**
   * Computes type effectiveness multiplier against single or dual-type defender
   */
  public static calculateTypeEffectiveness(
    moveType: import('../../types/elements').ElementType,
    defenderTypes: import('../../types/elements').ElementType[]
  ): { multiplier: number; rating: EffectivenessRating } {
    let multiplier = 1.0;

    defenderTypes.forEach((defType) => {
      const chartRow = TYPE_CHART[moveType];
      if (chartRow && chartRow[defType] !== undefined) {
        multiplier *= chartRow[defType];
      }
    });

    let rating: EffectivenessRating = 'normal';
    if (multiplier === 0) {
      rating = 'immune';
    } else if (multiplier < 1.0) {
      rating = 'not_very_effective';
    } else if (multiplier > 1.0) {
      rating = 'super_effective';
    }

    return { multiplier, rating };
  }

  /**
   * Main Pokémon standard damage formula calculation
   */
  public static calculateDamage(
    attacker: CreatureInstance,
    attackerSpecies: CreatureSpecies,
    attackerStages: BattleStatStages,
    defender: CreatureInstance,
    defenderSpecies: CreatureSpecies,
    defenderStages: BattleStatStages,
    move: Move,
    rng: Rng,
    forceCritical = false,
    weather?: import('../../types/weather').WeatherType
  ): DamageCalculationResult {
    // 1. Check Accuracy
    const isHit = this.checkAccuracy(move, attackerStages, defenderStages, rng, defender);
    if (!isHit) {
      return {
        damage: 0,
        isHit: false,
        isCritical: false,
        effectivenessRating: 'normal',
        typeMultiplier: 1.0,
        stabMultiplier: 1.0,
        randomFactor: 1.0,
      };
    }

    // Status moves deal 0 direct damage
    if (move.category === 'status' || move.power === null || move.power <= 0) {
      return {
        damage: 0,
        isHit: true,
        isCritical: false,
        effectivenessRating: 'normal',
        typeMultiplier: 1.0,
        stabMultiplier: 1.0,
        randomFactor: 1.0,
      };
    }

    // 2. Type Effectiveness
    const { multiplier: typeMultiplier, rating: effectivenessRating } =
      this.calculateTypeEffectiveness(move.type, defenderSpecies.types);

    if (typeMultiplier === 0) {
      return {
        damage: 0,
        isHit: true,
        isCritical: false,
        effectivenessRating: 'immune',
        typeMultiplier: 0,
        stabMultiplier: 1.0,
        randomFactor: 1.0,
      };
    }

    // 3. Critical Hit Check (1/16 chance base = 6.25%)
    const isCritical = forceCritical || rng.next() < 1 / 16;

    // 4. Attack and Defense Stats
    let attackStat = 0;
    let defenseStat = 0;

    if (move.category === 'physical') {
      const atkStage = isCritical
        ? Math.max(0, attackerStages.atk)
        : attackerStages.atk;
      const defStage = isCritical
        ? Math.min(0, defenderStages.def)
        : defenderStages.def;

      attackStat = Math.floor(
        attacker.stats.atk * StatCalculator.getStatStageMultiplier(atkStage)
      );
      defenseStat = Math.floor(
        defender.stats.def * StatCalculator.getStatStageMultiplier(defStage)
      );

      // Arms broken penalty: -50% physical attack
      if (attacker.partHP && attacker.partHP.arms <= 0) {
        const armsMult = PARTS_CONFIG.parts?.arms?.physicalAtkMultiplier ?? 0.5;
        attackStat = Math.max(1, Math.floor(attackStat * armsMult));
      }

      // Burn status penalty (halves physical attack)
      if (attacker.status === 'burn') {
        attackStat = Math.max(1, Math.floor(attackStat * 0.5));
      }
    } else {
      // Special move
      const spAtkStage = isCritical
        ? Math.max(0, attackerStages.spAtk)
        : attackerStages.spAtk;
      const spDefStage = isCritical
        ? Math.min(0, defenderStages.spDef)
        : defenderStages.spDef;

      attackStat = Math.floor(
        attacker.stats.spAtk * StatCalculator.getStatStageMultiplier(spAtkStage)
      );
      defenseStat = Math.floor(
        defender.stats.spDef * StatCalculator.getStatStageMultiplier(spDefStage)
      );
    }

    attackStat = Math.max(1, attackStat);
    defenseStat = Math.max(1, defenseStat);

    // 5. Base Damage Formula
    const level = attacker.level;
    const power = move.power;
    const baseDamage = Math.floor(
      (((2 * level) / 5 + 2) * power * (attackStat / defenseStat)) / 50 + 2
    );

    // 6. Multipliers: Critical, Random (0.85 to 1.00), STAB
    const critMultiplier = isCritical ? 1.5 : 1.0;
    const randomFactor = 0.85 + 0.15 * rng.next();

    // STAB (Same-Type Attack Bonus)
    const hasStab = attackerSpecies.types.includes(move.type);
    const stabMultiplier = hasStab ? 1.5 : 1.0;

    // 7. Weather Multiplier
    let weatherMult = 1.0;
    if (weather === 'sun') {
      if (move.type === 'Fuego') weatherMult = 1.5;
      else if (move.type === 'Agua') weatherMult = 0.5;
    } else if (weather === 'rain') {
      if (move.type === 'Agua') weatherMult = 1.5;
      else if (move.type === 'Fuego') weatherMult = 0.5;
    }

    // 8. Held Item Multiplier
    let itemMult = 1.0;
    if (attacker.heldItemId === 'cinta_elegida' && move.category === 'physical') {
      itemMult = 1.15;
    }
    if (defender.heldItemId === 'mineral_evolutivo' && defenderSpecies.evolution !== null) {
      itemMult *= 0.83; // 20% effective defense boost for unevolved creatures
    }

    // 9. Ability Multipliers & Immunities
    let abilityMult = 1.0;
    const attackerAbility = attacker.abilityId ? getAbility(attacker.abilityId) : null;
    if (attackerAbility && attackerAbility.onDamage) {
      const mod = attackerAbility.onDamage({ user: attacker, target: defender, side: 'player', move, weather });
      if (mod?.damageMultiplier) abilityMult *= mod.damageMultiplier;
    }

    const defenderAbility = defender.abilityId ? getAbility(defender.abilityId) : null;
    if (defenderAbility && defenderAbility.onDamage) {
      const mod = defenderAbility.onDamage({ user: defender, target: attacker, side: 'opponent', move, weather, damage: baseDamage });
      if (mod?.immune) {
        return {
          damage: 0,
          isHit: true,
          isCritical: false,
          effectivenessRating: 'immune',
          typeMultiplier: 0,
          stabMultiplier: 1.0,
          randomFactor: 1.0,
        };
      }
      if (mod?.damageMultiplier) abilityMult *= mod.damageMultiplier;
    }

    let finalDamage = Math.floor(
      baseDamage * critMultiplier * randomFactor * stabMultiplier * typeMultiplier * weatherMult * itemMult * abilityMult
    );

    // Banda Focus: survives lethal blow with 1 HP if at max HP
    if (defender.heldItemId === 'banda_focus' && defender.currentHp === defender.maxHp && finalDamage >= defender.currentHp) {
      finalDamage = defender.currentHp - 1;
    }

    finalDamage = Math.max(1, finalDamage);

    return {
      damage: finalDamage,
      isHit: true,
      isCritical,
      effectivenessRating,
      typeMultiplier,
      stabMultiplier,
      randomFactor,
    };
  }

  /**
   * Creates the default "Struggle" (Forcejeo) move used when no PP remains
   */
  public static getStruggleMove(): Move {
    return {
      id: 'struggle',
      name: 'Forcejeo',
      type: 'Normal',
      category: 'physical',
      power: 50,
      accuracy: 100,
      pp: 1,
      priority: 0,
      partTargeting: { head: 0.15, torso: 0.5, arms: 0.2, legs: 0.15 },
      tags: ['contact'],
      effect: [{ type: 'recoil', percentOfDamage: 25 }],
      vfx: {
        preset: 'burst',
        colorA: '#ffffff',
        colorB: '#64748b',
      },
      description: 'Ataque desesperado cuando no quedan PP. Causa daño de retroceso al usuario.',
    };
  }
}
