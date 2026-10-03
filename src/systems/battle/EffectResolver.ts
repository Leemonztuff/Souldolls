import { CreatureInstance } from '../../types';
import { Move, MoveEffect } from '../../types/moves';
import { BattleStatStages, BattleEvent, BattleSide } from './BattleTypes';
import { Rng } from '../../core/Rng';
import { StatCalculator } from './StatCalculator';

export class EffectResolver {
  /**
   * Applies secondary / primary move effects (stat changes, status, drain, recoil, heal)
   */
  public static applyMoveEffects(
    move: Move,
    user: CreatureInstance,
    userStages: BattleStatStages,
    target: CreatureInstance,
    targetStages: BattleStatStages,
    damageDealt: number,
    userSide: BattleSide,
    targetSide: BattleSide,
    events: BattleEvent[],
    rng: Rng
  ): { targetFlinched: boolean } {
    let targetFlinched = false;

    if (!move.effect || move.effect.length === 0) {
      return { targetFlinched };
    }

    move.effect.forEach((eff: MoveEffect) => {
      // 1. Stat Stage Modifications
      if (eff.type === 'statStage') {
        const chance = eff.chance !== undefined ? eff.chance : 1.0;
        if (rng.next() < chance) {
          const isUserTarget = eff.target === 'user';
          const affectedStages = isUserTarget ? userStages : targetStages;
          const affectedName = isUserTarget
            ? user.nickname || user.speciesId
            : target.nickname || target.speciesId;
          const affectedSide = isUserTarget ? userSide : targetSide;

          const currentStage = affectedStages[eff.stat as keyof BattleStatStages] || 0;
          const newStage = Math.max(-6, Math.min(6, currentStage + eff.stages));
          const delta = newStage - currentStage;

          if (delta !== 0) {
            affectedStages[eff.stat as keyof BattleStatStages] = newStage;
            events.push({
              type: 'STAT_STAGE_CHANGED',
              side: affectedSide,
              sourceName: affectedName,
              stat: eff.stat as keyof BattleStatStages,
              stages: delta,
              message: `¡${eff.stat.toUpperCase()} de ${affectedName} ${delta > 0 ? 'subió' : 'bajó'}!`,
            });
          }
        }
      }

      // 2. Status Condition Application
      if (eff.type === 'status') {
        const chance = eff.chance !== undefined ? eff.chance : 1.0;
        if (rng.next() < chance) {
          if (!target.status && target.currentHp > 0) {
            target.status = eff.condition;
            target.statusTurnsRemaining =
              eff.condition === 'sleep' ? rng.rangeInt(1, 3) : undefined;

            events.push({
              type: 'STATUS_APPLIED',
              side: targetSide,
              targetName: target.nickname || target.speciesId,
              status: eff.condition,
              message: `¡${target.nickname || target.speciesId} ha sido afectado por ${eff.condition.toUpperCase()}!`,
            });
          }
        }
      }

      // 3. Drain Effect (Heal user based on damage dealt, distributed among parts)
      if (eff.type === 'drain' && damageDealt > 0) {
        const healAmount = Math.max(1, Math.floor((damageDealt * eff.percentOfDamage) / 100));
        const healRes = StatCalculator.distributeHeal(user, healAmount);

        if (healRes.actualHealed > 0) {
          events.push({
            type: 'DRAIN',
            side: userSide,
            sourceName: user.nickname || user.speciesId,
            healAmount: healRes.actualHealed,
            currentHp: user.currentHp,
            maxHp: user.maxHp,
            message: `¡${user.nickname || user.speciesId} recuperó salud con la energía drenada!`,
          });
        }
      }

      // 4. Recoil Effect (Damage user)
      if (eff.type === 'recoil') {
        let recoilDamage = 0;
        if (damageDealt > 0) {
          recoilDamage = Math.max(1, Math.floor((damageDealt * eff.percentOfDamage) / 100));
        } else {
          recoilDamage = Math.max(1, Math.floor((user.maxHp * eff.percentOfDamage) / 100));
        }

        const partRes = StatCalculator.applyPartDamage(user, 'torso', recoilDamage);

        events.push({
          type: 'RECOIL',
          side: userSide,
          sourceName: user.nickname || user.speciesId,
          damage: recoilDamage,
          currentHp: user.currentHp,
          maxHp: user.maxHp,
          message: `¡${user.nickname || user.speciesId} recibió daño de retroceso!`,
        });

        if (partRes.faintReason || user.currentHp <= 0) {
          user.currentHp = 0;
          events.push({
            type: 'FAINTED',
            side: userSide,
            targetName: user.nickname || user.speciesId,
            faintReason: partRes.faintReason || 'total_hp',
            message: `¡${user.nickname || user.speciesId} se debilitó por el retroceso!`,
          });
        }
      }

      // 5. Self-Healing Moves (e.g. Síntesis)
      if (eff.type === 'heal') {
        const healAmount = Math.max(1, Math.floor((user.maxHp * eff.percent) / 100));
        const healRes = StatCalculator.distributeHeal(user, healAmount);

        events.push({
          type: 'HEAL',
          side: userSide,
          sourceName: user.nickname || user.speciesId,
          healAmount: healRes.actualHealed,
          currentHp: user.currentHp,
          maxHp: user.maxHp,
          message: `¡${user.nickname || user.speciesId} recuperó salud!`,
        });
      }

      // 6. Flinch Effect
      if (eff.type === 'flinch' && rng.next() < eff.chance) {
        targetFlinched = true;
      }
    });

    return { targetFlinched };
  }

  /**
   * Resolves end-of-turn damage (burn, poison) and turn countdowns
   */
  public static resolveEndOfTurnStatus(
    creature: CreatureInstance,
    side: BattleSide,
    events: BattleEvent[]
  ): void {
    if (creature.currentHp <= 0 || !creature.status) return;

    const name = creature.nickname || creature.speciesId;

    // Burn damage (1/16 max HP)
    if (creature.status === 'burn') {
      const damage = Math.max(1, Math.floor(creature.maxHp / 16));
      const partRes = StatCalculator.applyPartDamage(creature, 'torso', damage);

      events.push({
        type: 'STATUS_DAMAGE',
        side,
        targetName: name,
        damage,
        currentHp: creature.currentHp,
        maxHp: creature.maxHp,
        status: 'burn',
        message: `¡${name} sufre por sus quemaduras! (-${damage} PS)`,
      });

      if (partRes.faintReason || creature.currentHp <= 0) {
        creature.currentHp = 0;
        events.push({
          type: 'FAINTED',
          side,
          targetName: name,
          faintReason: partRes.faintReason || 'total_hp',
          message: `¡${name} se debilitó por quemaduras!`,
        });
      }
    }

    // Poison damage (1/8 max HP)
    if (creature.status === 'poison') {
      const damage = Math.max(1, Math.floor(creature.maxHp / 8));
      const partRes = StatCalculator.applyPartDamage(creature, 'torso', damage);

      events.push({
        type: 'STATUS_DAMAGE',
        side,
        targetName: name,
        damage,
        currentHp: creature.currentHp,
        maxHp: creature.maxHp,
        status: 'poison',
        message: `¡${name} sufre los estragos del veneno! (-${damage} PS)`,
      });

      if (partRes.faintReason || creature.currentHp <= 0) {
        creature.currentHp = 0;
        events.push({
          type: 'FAINTED',
          side,
          targetName: name,
          faintReason: partRes.faintReason || 'total_hp',
          message: `¡${name} se debilitó por el veneno!`,
        });
      }
    }
  }
}

