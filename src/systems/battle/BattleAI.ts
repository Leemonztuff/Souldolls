import { CreatureInstance } from '../../types';
import { CreatureSpecies } from '../../types/creatures';
import { Move } from '../../types/moves';
import { MOVES_DATA } from '../../data/moves/moves';
import { BattleAction, BattleStatStages, BattleType } from './BattleTypes';
import { DamageCalculator } from './DamageCalculator';
import { Rng } from '../../core/Rng';

export class BattleAI {
  /**
   * Selects an action for the opponent
   */
  public static decideAction(
    aiCreature: CreatureInstance,
    aiSpecies: CreatureSpecies,
    aiStages: BattleStatStages,
    playerCreature: CreatureInstance,
    playerSpecies: CreatureSpecies,
    playerStages: BattleStatStages,
    battleType: BattleType,
    rng: Rng,
    inventory?: Record<string, number>
  ): BattleAction {
    // 1. Boss Logic: Use healing item if critical HP
    if (battleType === 'boss' && inventory) {
      if (aiCreature.currentHp < aiCreature.maxHp * 0.25) {
        if (inventory['potion'] && inventory['potion'] > 0) {
          inventory['potion']--;
          return { type: 'item', itemId: 'potion' };
        }
      }
    }

    // 2. Filter available moves with PP > 0
    const availableMoveIndices: number[] = [];
    aiCreature.moves.forEach((m, idx) => {
      if (m.currentPp > 0) {
        availableMoveIndices.push(idx);
      }
    });

    // If no PP remains, use struggle (move index -1)
    if (availableMoveIndices.length === 0) {
      return { type: 'move', moveIndex: -1 };
    }

    // 3. Wild AI: Weighted random selection
    if (battleType === 'wild') {
      const chosen = rng.pick(availableMoveIndices);
      return { type: 'move', moveIndex: chosen !== null ? chosen : 0 };
    }

    // 4. Trainer & Boss AI: Smart damage and effectiveness evaluation
    let bestScore = -999;
    let bestIndex = availableMoveIndices[0];

    availableMoveIndices.forEach((idx) => {
      const moveEntry = aiCreature.moves[idx];
      const moveDef: Move | undefined = MOVES_DATA[moveEntry.moveId];
      if (!moveDef) return;

      let score = 0;

      // Status moves
      if (moveDef.category === 'status') {
        const hasStatusEffect = moveDef.effect.some((e) => e.type === 'status');
        const hasStatChange = moveDef.effect.some((e) => e.type === 'statStage');
        const hasHeal = moveDef.effect.some((e) => e.type === 'heal');

        if (hasStatusEffect && !playerCreature.status) {
          score += 60;
        } else if (hasStatChange) {
          score += 35;
        } else if (hasHeal && aiCreature.currentHp < aiCreature.maxHp * 0.5) {
          score += 80;
        } else {
          score += 10;
        }
      } else {
        // Damaging moves: Calculate predicted damage
        const damageResult = DamageCalculator.calculateDamage(
          aiCreature,
          aiSpecies,
          aiStages,
          playerCreature,
          playerSpecies,
          playerStages,
          moveDef,
          rng
        );

        if (damageResult.typeMultiplier === 0) {
          score = -500; // Avoid immune moves completely
        } else {
          score += damageResult.damage;

          // Bonus for Super Effective
          if (damageResult.effectivenessRating === 'super_effective') {
            score += 40;
          } else if (damageResult.effectivenessRating === 'not_very_effective') {
            score -= 20;
          }

          // Tactical Part Targeting Bonus (Bloque 17):
          const targeting = moveDef.partTargeting;
          if (targeting && playerCreature.partHP) {
            // 1. If rival is physical attacker / monk / assassin and arms intact, aim for arms to cripple
            const isPhysicalRival = playerSpecies.baseStats.atk >= playerSpecies.baseStats.spAtk;
            if (isPhysicalRival && playerCreature.partHP.arms > 0 && (targeting.arms || 0) >= 0.25) {
              score += 25;
            }

            // 2. If rival is faster and legs intact, aim for legs to slow down
            const isFasterRival = playerSpecies.baseStats.speed > aiSpecies.baseStats.speed;
            if (isFasterRival && playerCreature.partHP.legs > 0 && (targeting.legs || 0) >= 0.25) {
              score += 20;
            }

            // 3. Head / Torso finisher bonus
            if (playerCreature.partHP.head > 0 && playerCreature.partHP.head <= damageResult.damage && (targeting.head || 0) >= 0.25) {
              score += 120;
            }
            if (playerCreature.partHP.torso > 0 && playerCreature.partHP.torso <= damageResult.damage && (targeting.torso || 0) >= 0.40) {
              score += 150;
            }
          }

          // Bonus if this move is guaranteed to knock out the player
          if (damageResult.damage >= playerCreature.currentHp) {
            score += 200;
          }
        }
      }

      score += rng.rangeFloat(-5, 5);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = idx;
      }
    });

    return { type: 'move', moveIndex: bestIndex };
  }
}
