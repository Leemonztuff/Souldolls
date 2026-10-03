import { CreatureInstance } from '../../types';
import { CreatureSpecies } from '../../types/creatures';
import { Move } from '../../types/moves';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { MOVES_DATA } from '../../data/moves/moves';
import { ITEMS_DATA } from '../../data/items/items';
import {
  BattleAction,
  BattleEvent,
  BattleSide,
  BattleStatStages,
  BattleType,
} from './BattleTypes';
import { StatCalculator, BATTLE_CONFIG, PARTS_CONFIG } from './StatCalculator';
import { DamageCalculator } from './DamageCalculator';
import { EffectResolver } from './EffectResolver';
import { CaptureCalculator } from './CaptureCalculator';
import { ExpCalculator } from './ExpCalculator';
import { BattleAI } from './BattleAI';
import { Rng } from '../../core/Rng';
import { GlobalSaveService } from '../../services/SaveService';
import { getAbility } from '../../data/abilities/abilities';
import { WeatherState } from '../../types/weather';

export interface BattleEngineConfig {
  playerParty: CreatureInstance[];
  opponentParty: CreatureInstance[];
  battleType: BattleType;
  trainerName?: string;
  moneyReward?: number;
  seed?: number;
  isDoubleBattle?: boolean;
}

export class BattleEngine {
  public playerParty: CreatureInstance[];
  public opponentParty: CreatureInstance[];
  public battleType: BattleType;
  public trainerName?: string;
  public moneyReward: number;
  public isDoubleBattle: boolean;
  public weather: WeatherState = { type: 'none', turnsRemaining: 0 };

  public playerActiveIndex = 0;
  public opponentActiveIndex = 0;
  public playerActiveIndex2 = -1;
  public opponentActiveIndex2 = -1;

  public playerStages: BattleStatStages = StatCalculator.createInitialStages();
  public opponentStages: BattleStatStages = StatCalculator.createInitialStages();
  public playerStages2: BattleStatStages = StatCalculator.createInitialStages();
  public opponentStages2: BattleStatStages = StatCalculator.createInitialStages();

  public turnCount = 0;
  public fleeAttempts = 0;
  public isBattleOver = false;
  public victory = false;

  public rng: Rng;

  constructor(config: BattleEngineConfig) {
    this.playerParty = config.playerParty;
    this.opponentParty = config.opponentParty;
    this.battleType = config.battleType;
    this.trainerName = config.trainerName;
    this.moneyReward = config.moneyReward || 0;
    this.rng = new Rng(config.seed !== undefined ? config.seed : Date.now());

    const pIdx = this.playerParty.findIndex((c) => c.currentHp > 0);
    this.playerActiveIndex = pIdx >= 0 ? pIdx : 0;

    const oIdx = this.opponentParty.findIndex((c) => c.currentHp > 0);
    this.opponentActiveIndex = oIdx >= 0 ? oIdx : 0;
    this.isDoubleBattle = config.isDoubleBattle || false;

    if (this.isDoubleBattle) {
      const pIdx2 = this.playerParty.findIndex((c, i) => i !== this.playerActiveIndex && c.currentHp > 0);
      this.playerActiveIndex2 = pIdx2 >= 0 ? pIdx2 : -1;

      const oIdx2 = this.opponentParty.findIndex((c, i) => i !== this.opponentActiveIndex && c.currentHp > 0);
      this.opponentActiveIndex2 = oIdx2 >= 0 ? oIdx2 : -1;
    }
  }

  public getPlayerActive(): CreatureInstance {
    return this.playerParty[this.playerActiveIndex];
  }

  public getOpponentActive(): CreatureInstance {
    return this.opponentParty[this.opponentActiveIndex];
  }

  public getActiveCreatures(side: BattleSide): Array<{ creature: CreatureInstance; slot: number; stages: BattleStatStages }> {
    const party = side === 'player' ? this.playerParty : this.opponentParty;
    const idx1 = side === 'player' ? this.playerActiveIndex : this.opponentActiveIndex;
    const idx2 = side === 'player' ? this.playerActiveIndex2 : this.opponentActiveIndex2;
    const st1 = side === 'player' ? this.playerStages : this.opponentStages;
    const st2 = side === 'player' ? this.playerStages2 : this.opponentStages2;

    const list: Array<{ creature: CreatureInstance; slot: number; stages: BattleStatStages }> = [];
    if (party[idx1] && party[idx1].currentHp > 0) {
      list.push({ creature: party[idx1], slot: idx1, stages: st1 });
    }
    if (this.isDoubleBattle && idx2 >= 0 && party[idx2] && party[idx2].currentHp > 0) {
      list.push({ creature: party[idx2], slot: idx2, stages: st2 });
    }
    return list;
  }

  public getPlayerSpecies(): CreatureSpecies {
    return CREATURES_DATA[this.getPlayerActive().speciesId];
  }

  public getOpponentSpecies(): CreatureSpecies {
    return CREATURES_DATA[this.getOpponentActive().speciesId];
  }

  public triggerSwitchInAbilities(creature: CreatureInstance, side: BattleSide, events: BattleEvent[]): void {
    if (!creature || creature.currentHp <= 0) return;
    const ability = getAbility(creature.abilityId);
    if (ability && ability.onSwitchIn) {
      const oppStages = side === 'player' ? this.opponentStages : this.playerStages;
      const res = ability.onSwitchIn({ user: creature, side });
      if (res) {
        events.push({ type: 'MESSAGE', message: res.message });
        if (res.statChanges) {
          res.statChanges.forEach((sc) => {
            if (sc.target === 'target') {
              const currentVal = oppStages[sc.stat as keyof BattleStatStages] || 0;
              oppStages[sc.stat as keyof BattleStatStages] = Math.max(-6, Math.min(6, currentVal + sc.stages));
              events.push({
                type: 'STAT_STAGE_CHANGED',
                side: side === 'player' ? 'opponent' : 'player',
                stat: sc.stat as keyof BattleStatStages,
                stages: sc.stages,
                message: `¡El ${sc.stat} del adversario ${sc.stages < 0 ? 'bajó' : 'subió'}!`,
              });
            }
          });
        }
      }
    }
  }

  public startBattle(): BattleEvent[] {
    const events: BattleEvent[] = [];
    const playerCreature = this.getPlayerActive();
    const opponentCreature = this.getOpponentActive();

    events.push({
      type: 'BATTLE_START',
      message:
        this.battleType === 'wild'
          ? `¡Un ${opponentCreature.nickname || opponentCreature.speciesId} salvaje apareció!`
          : `¡${this.trainerName || 'Entrenador'} te desafió a un combate!`,
    });

    events.push({
      type: 'SWITCH_IN',
      side: 'player',
      sourceName: playerCreature.nickname || playerCreature.speciesId,
      currentHp: playerCreature.currentHp,
      maxHp: playerCreature.maxHp,
      message: `¡Adelante, ${playerCreature.nickname || playerCreature.speciesId}!`,
    });

    this.triggerSwitchInAbilities(opponentCreature, 'opponent', events);
    this.triggerSwitchInAbilities(playerCreature, 'player', events);

    return events;
  }

  public executeTurn(playerAction: BattleAction): BattleEvent[] {
    if (this.isBattleOver) return [];
    this.turnCount++;
    const events: BattleEvent[] = [];

    const player = this.getPlayerActive();
    const opponent = this.getOpponentActive();
    const pSpecies = this.getPlayerSpecies();
    const oSpecies = this.getOpponentSpecies();

    events.push({
      type: 'TURN_START',
      message: `--- Turno ${this.turnCount} ---`,
    });

    // 1. AI Decision
    const opponentAction = BattleAI.decideAction(
      opponent,
      oSpecies,
      this.opponentStages,
      player,
      pSpecies,
      this.playerStages,
      this.battleType,
      this.rng
    );

    // 2. Immediate Non-Attack Player Actions
    if (playerAction.type === 'flee') {
      return this.handleFleeAction(events);
    }

    if (playerAction.type === 'capture') {
      return this.handleCaptureAction(playerAction.capsuleItemId, events, opponentAction);
    }

    if (playerAction.type === 'item') {
      this.handleItemAction(playerAction.itemId, 'player', events);
      this.executeSingleAction(opponentAction, 'opponent', events);
      this.resolveEndOfTurn(events);
      return events;
    }

    if (playerAction.type === 'switch') {
      this.handleSwitchAction(playerAction.targetPartyIndex, 'player', events);
      this.executeSingleAction(opponentAction, 'opponent', events);
      this.resolveEndOfTurn(events);
      return events;
    }

    // 3. Move Order Determination
    const pMove = this.getMoveFromAction(playerAction, player);
    const oMove = this.getMoveFromAction(opponentAction, opponent);

    const pPriority = pMove.priority || 0;
    const oPriority = oMove.priority || 0;

    const pEffectiveSpeed = this.getEffectiveSpeed(player, this.playerStages);
    const oEffectiveSpeed = this.getEffectiveSpeed(opponent, this.opponentStages);

    let playerFirst = true;
    if (pPriority !== oPriority) {
      playerFirst = pPriority > oPriority;
    } else if (pEffectiveSpeed !== oEffectiveSpeed) {
      playerFirst = pEffectiveSpeed > oEffectiveSpeed;
    } else {
      playerFirst = this.rng.next() < 0.5;
    }

    const firstActor = playerFirst ? 'player' : 'opponent';
    const firstAction = playerFirst ? playerAction : opponentAction;
    const secondActor = playerFirst ? 'opponent' : 'player';
    const secondAction = playerFirst ? opponentAction : playerAction;

    // 4. Execute First Action
    const firstResult = this.executeSingleAction(firstAction, firstActor, events);

    // 5. Execute Second Action if target survives and is not flinched
    const targetOfFirst = firstActor === 'player' ? this.getOpponentActive() : this.getPlayerActive();
    if (targetOfFirst.currentHp > 0 && !firstResult.targetFlinched && !this.isBattleOver) {
      this.executeSingleAction(secondAction, secondActor, events);
    }

    // 6. End of Turn Status & Ticks
    if (!this.isBattleOver) {
      this.resolveEndOfTurn(events);
    }

    return events;
  }

  private executeSingleAction(
    action: BattleAction,
    side: BattleSide,
    events: BattleEvent[]
  ): { targetFlinched: boolean } {
    if (action.type !== 'move') return { targetFlinched: false };

    const user = side === 'player' ? this.getPlayerActive() : this.getOpponentActive();
    const target = side === 'player' ? this.getOpponentActive() : this.getPlayerActive();
    const userSpecies = side === 'player' ? this.getPlayerSpecies() : this.getOpponentSpecies();
    const targetSpecies = side === 'player' ? this.getOpponentSpecies() : this.getPlayerSpecies();
    const userStages = side === 'player' ? this.playerStages : this.opponentStages;
    const targetStages = side === 'player' ? this.opponentStages : this.playerStages;
    const targetSide: BattleSide = side === 'player' ? 'opponent' : 'player';

    if (user.currentHp <= 0) return { targetFlinched: false };

    const move = this.getMoveFromAction(action, user);

    // 0. Check Broken Arms Blocking Weapon Moves
    if (user.partHP && user.partHP.arms <= 0 && move.tags?.includes('weapon')) {
      events.push({
        type: 'MOVE_BLOCKED',
        side,
        sourceName: user.nickname || user.speciesId,
        moveId: move.id,
        moveName: move.name,
        reason: 'arms_broken',
        message: `¡${user.nickname || user.speciesId} no puede usar ${move.name} porque sus brazos están destruidos!`,
      });
      return { targetFlinched: false };
    }

    // 1. Status Interference Checks (Sleep, Paralysis)
    if (user.status === 'sleep') {
      if (user.statusTurnsRemaining && user.statusTurnsRemaining > 1) {
        user.statusTurnsRemaining--;
        events.push({
          type: 'STATUS_PREVENTED_ACTION',
          side,
          sourceName: user.nickname || user.speciesId,
          message: `¡${user.nickname || user.speciesId} está profundamente dormido!`,
        });
        return { targetFlinched: false };
      } else {
        user.status = null;
        user.statusTurnsRemaining = undefined;
        events.push({
          type: 'STATUS_CURED',
          side,
          sourceName: user.nickname || user.speciesId,
          message: `¡${user.nickname || user.speciesId} se ha despertado!`,
        });
      }
    }

    if (user.status === 'paralysis') {
      if (this.rng.next() < 0.25) {
        events.push({
          type: 'STATUS_PREVENTED_ACTION',
          side,
          sourceName: user.nickname || user.speciesId,
          message: `¡${user.nickname || user.speciesId} está paralizado y no puede moverse!`,
        });
        return { targetFlinched: false };
      }
    }

    // 2. Announce Move
    events.push({
      type: 'MOVE_USED',
      side,
      sourceName: user.nickname || user.speciesId,
      moveId: move.id,
      moveName: move.name,
      message: `¡${user.nickname || user.speciesId} usó ${move.name}!`,
    });

    if (action.moveIndex >= 0 && user.moves[action.moveIndex]) {
      user.moves[action.moveIndex].currentPp = Math.max(
        0,
        user.moves[action.moveIndex].currentPp - 1
      );
    }

    // 3. Weather summoning moves
    if (move.id === 'danza_lluvia') {
      this.weather = { type: 'rain', turnsRemaining: 5 };
      events.push({ type: 'MESSAGE', message: '¡Comenzó a caer una lluvia torrencial!' });
    } else if (move.id === 'dia_soleado') {
      this.weather = { type: 'sun', turnsRemaining: 5 };
      events.push({ type: 'MESSAGE', message: '¡El sol brilla con fuerza abrasadora!' });
    } else if (move.id === 'tormenta_arena') {
      this.weather = { type: 'sandstorm', turnsRemaining: 5 };
      events.push({ type: 'MESSAGE', message: '¡Se desató una feroz tormenta de arena!' });
    } else if (move.id === 'paisaje_nevado') {
      this.weather = { type: 'snow', turnsRemaining: 5 };
      events.push({ type: 'MESSAGE', message: '¡Comenzó a nevar intensamente!' });
    }

    // Determine targets based on move.target ('single' | 'all_opponents' | 'all' | 'ally' | 'self')
    const targetMode = move.target || 'single';
    let targetsToHit: Array<{ target: CreatureInstance; targetSide: BattleSide; targetStages: BattleStatStages }> = [];

    if (targetMode === 'all_opponents') {
      const actives = this.getActiveCreatures(targetSide);
      targetsToHit = actives.map((a) => ({ target: a.creature, targetSide, targetStages: a.stages }));
    } else if (targetMode === 'all') {
      const oppActives = this.getActiveCreatures(targetSide).map((a) => ({ target: a.creature, targetSide, targetStages: a.stages }));
      const allyActives = this.getActiveCreatures(side).filter((a) => a.creature.uid !== user.uid).map((a) => ({ target: a.creature, targetSide: side, targetStages: a.stages }));
      targetsToHit = [...oppActives, ...allyActives];
    } else if (targetMode === 'ally') {
      const ally = this.getActiveCreatures(side).find((a) => a.creature.uid !== user.uid);
      if (ally) {
        targetsToHit = [{ target: ally.creature, targetSide: side, targetStages: ally.stages }];
      } else {
        targetsToHit = [{ target: user, targetSide: side, targetStages: userStages }];
      }
    } else if (targetMode === 'self') {
      targetsToHit = [{ target: user, targetSide: side, targetStages: userStages }];
    } else {
      targetsToHit = [{ target, targetSide, targetStages }];
    }

    let anyFlinched = false;
    const spreadMultiplier = targetsToHit.length > 1 ? 0.75 : 1.0;

    for (const tInfo of targetsToHit) {
      const curTarget = tInfo.target;
      const curTargetSide = tInfo.targetSide;
      const curTargetStages = tInfo.targetStages;
      const curTargetSpecies = CREATURES_DATA[curTarget.speciesId] || CREATURES_DATA['flamin'];

      if (curTarget.currentHp <= 0) continue;

      const result = DamageCalculator.calculateDamage(
        user,
        userSpecies,
        userStages,
        curTarget,
        curTargetSpecies,
        curTargetStages,
        move,
        this.rng,
        false,
        this.weather.type
      );

      if (spreadMultiplier < 1.0 && result.damage > 0) {
        result.damage = Math.max(1, Math.floor(result.damage * spreadMultiplier));
      }

      if (!result.isHit) {
        events.push({
          type: 'MOVE_MISSED',
          side,
          sourceName: user.nickname || user.speciesId,
          message: `¡El ataque contra ${curTarget.nickname || curTarget.speciesId} falló!`,
        });
        continue;
      }

      if (result.damage > 0) {
        // 1. Pick target part
        const chosenTargetPart = StatCalculator.pickTargetPart(move.partTargeting, this.rng, result.isCritical);

        // 2. Apply part damage with redirection & overflow
        const partResult = StatCalculator.applyPartDamage(curTarget, chosenTargetPart, result.damage);

        events.push({
          type: 'DAMAGE_DEALT',
          side: curTargetSide,
          targetName: curTarget.nickname || curTarget.speciesId,
          damage: result.damage,
          currentHp: curTarget.currentHp,
          maxHp: curTarget.maxHp,
          isCritical: result.isCritical,
          effectiveness: result.effectivenessRating,
        });

        // 3. Emit PART_DAMAGED event
        events.push({
          type: 'PART_DAMAGED',
          side: curTargetSide,
          targetName: curTarget.nickname || curTarget.speciesId,
          part: partResult.chosenPart,
          damage: partResult.damageToPart,
          partHp: curTarget.partHP[partResult.chosenPart],
          partMaxHp: curTarget.maxPartHP ? curTarget.maxPartHP[partResult.chosenPart] : undefined,
          currentHp: curTarget.currentHp,
          maxHp: curTarget.maxHp,
        });

        // 4. Emit PART_BROKEN event if part broke on this strike
        if (partResult.isNowBroken) {
          const partDef = (PARTS_CONFIG.parts as any)?.[partResult.chosenPart];
          events.push({
            type: 'PART_BROKEN',
            side: curTargetSide,
            targetName: curTarget.nickname || curTarget.speciesId,
            part: partResult.chosenPart,
            message: `¡La parte [${partDef?.name || partResult.chosenPart}] de ${curTarget.nickname || curTarget.speciesId} ha sido destruida!`,
          });
        }

        if (result.isCritical) {
          events.push({
            type: 'CRITICAL_HIT',
            message: '¡Un golpe crítico!',
          });
        }

        if (result.effectivenessRating === 'super_effective') {
          events.push({
            type: 'EFFECTIVENESS',
            effectiveness: 'super_effective',
            message: '¡Es súper eficaz!',
          });
        } else if (result.effectivenessRating === 'not_very_effective') {
          events.push({
            type: 'EFFECTIVENESS',
            effectiveness: 'not_very_effective',
            message: 'No es muy eficaz...',
          });
        }

        // Auto-consume held Mana Crystals & Berries
        const heldItem = curTarget.heldItemId || curTarget.equipped?.relic;
        if (heldItem && curTarget.currentHp > 0) {
          if ((heldItem === 'cristal_mana_planta' || heldItem === 'baya_arand') && curTarget.currentHp <= curTarget.maxHp / 2) {
            const healRes = StatCalculator.distributeHeal(curTarget, 30);
            if (curTarget.heldItemId === heldItem) curTarget.heldItemId = null;
            if (curTarget.equipped?.relic === heldItem) curTarget.equipped.relic = null;
            events.push({
              type: 'HEAL',
              side: curTargetSide,
              healAmount: healRes.actualHealed,
              currentHp: curTarget.currentHp,
              maxHp: curTarget.maxHp,
              message: `¡${curTarget.nickname || curTarget.speciesId} consumió su ${ITEMS_DATA[heldItem]?.name || 'Cristal de Maná'} y recuperó ${healRes.actualHealed} PS!`,
            });
          } else if (heldItem === 'cristal_mana_fuego' && curTarget.currentHp <= curTarget.maxHp / 2) {
            if (curTarget.heldItemId === heldItem) curTarget.heldItemId = null;
            if (curTarget.equipped?.relic === heldItem) curTarget.equipped.relic = null;
            const stages = curTargetSide === 'player' ? this.playerStages : this.opponentStages;
            stages.spAtk = Math.min(6, stages.spAtk + 1);
            events.push({
              type: 'STAT_STAGE_CHANGED',
              side: curTargetSide,
              stat: 'spAtk',
              stages: 1,
              message: `¡${curTarget.nickname || curTarget.speciesId} consumió su Cristal de Maná: Fuego! ¡Su Ataque Especial subió!`,
            });
          } else if (heldItem === 'cristal_mana_tierra' && move.category === 'physical') {
            if (curTarget.heldItemId === heldItem) curTarget.heldItemId = null;
            if (curTarget.equipped?.relic === heldItem) curTarget.equipped.relic = null;
            const stages = curTargetSide === 'player' ? this.playerStages : this.opponentStages;
            stages.def = Math.min(6, stages.def + 1);
            events.push({
              type: 'STAT_STAGE_CHANGED',
              side: curTargetSide,
              stat: 'def',
              stages: 1,
              message: `¡${curTarget.nickname || curTarget.speciesId} consumió su Cristal de Maná: Tierra! ¡Su Defensa física subió!`,
            });
          } else if (heldItem === 'cristal_mana_sombra' && result.effectivenessRating === 'super_effective') {
            if (curTarget.heldItemId === heldItem) curTarget.heldItemId = null;
            if (curTarget.equipped?.relic === heldItem) curTarget.equipped.relic = null;
            const stages = curTargetSide === 'player' ? this.playerStages : this.opponentStages;
            stages.evasion = Math.min(6, stages.evasion + 2);
            events.push({
              type: 'STAT_STAGE_CHANGED',
              side: curTargetSide,
              stat: 'evasion',
              stages: 2,
              message: `¡${curTarget.nickname || curTarget.speciesId} consumió su Cristal de Maná: Sombra al recibir daño súper eficaz! ¡Evasión aumentada!`,
            });
          }
        }

        // 5. Synchrony Survival Hook & Fatal / KO check
        const currentSync = curTarget.sync !== undefined ? curTarget.sync : (curTarget.friendship || 0);
        let survivedWithSync = false;
        if ((partResult.faintReason || curTarget.currentHp <= 0) && currentSync >= 150) {
          if (this.rng.next() < 0.25) {
            survivedWithSync = true;
            curTarget.currentHp = 1;
            if (curTarget.partHP.head <= 0) curTarget.partHP.head = 1;
            if (curTarget.partHP.torso <= 0) curTarget.partHP.torso = 1;
            events.push({
              type: 'MESSAGE',
              message: `¡${curTarget.nickname || curTarget.speciesId} aguantó el K.O. con 1 PS gracias a la Sincronía con su Soultrainer!`,
            });
          }
        }

        if (!survivedWithSync && (partResult.faintReason || curTarget.currentHp <= 0)) {
          curTarget.currentHp = 0;
          let faintMsg = `¡${curTarget.nickname || curTarget.speciesId} se debilitó!`;
          if (partResult.faintReason === 'head_broken') {
            faintMsg = `¡${curTarget.nickname || curTarget.speciesId} cayó K.O. al perder la Cabeza!`;
          } else if (partResult.faintReason === 'torso_broken') {
            faintMsg = `¡${curTarget.nickname || curTarget.speciesId} cayó K.O. al colapsar su Torso!`;
          }

          events.push({
            type: 'FAINTED',
            side: curTargetSide,
            targetName: curTarget.nickname || curTarget.speciesId,
            faintReason: partResult.faintReason || 'total_hp',
            message: faintMsg,
          });

          if (curTargetSide === 'opponent') {
            this.handleOpponentFainted(events);
          } else {
            this.handlePlayerFainted(events);
          }
          return { targetFlinched: false };
        }
      } else if (result.effectivenessRating === 'immune') {
        events.push({
          type: 'EFFECTIVENESS',
          effectiveness: 'immune',
          message: `No afecta a ${curTarget.nickname || curTarget.speciesId}...`,
        });
        continue;
      }

      const { targetFlinched } = EffectResolver.applyMoveEffects(
        move,
        user,
        userStages,
        curTarget,
        curTargetStages,
        result.damage,
        side,
        curTargetSide,
        events,
        this.rng
      );

      if (targetFlinched) anyFlinched = true;

      if (curTarget.currentHp <= 0) {
        events.push({
          type: 'FAINTED',
          side: curTargetSide,
          targetName: curTarget.nickname || curTarget.speciesId,
          message: `¡${curTarget.nickname || curTarget.speciesId} se debilitó!`,
        });

        if (curTargetSide === 'opponent') {
          this.handleOpponentFainted(events);
        } else {
          this.handlePlayerFainted(events);
        }
      }
    }

    return { targetFlinched: anyFlinched };
  }

  private handleOpponentFainted(events: BattleEvent[]): void {
    const defeated = this.getOpponentActive();
    const defeatedSpecies = this.getOpponentSpecies();
    const player = this.getPlayerActive();
    const playerSpecies = this.getPlayerSpecies();

    const exp = ExpCalculator.calculateExpYield(
      defeatedSpecies,
      defeated.level,
      this.battleType !== 'wild'
    );
    player.currentExp += exp;

    events.push({
      type: 'EXP_GAINED',
      side: 'player',
      sourceName: player.nickname || player.speciesId,
      expGained: exp,
      message: `¡${player.nickname || player.speciesId} ganó ${exp} puntos de experiencia!`,
    });

    const evalResult = ExpCalculator.evaluateExp(
      player.currentExp,
      player.level,
      playerSpecies.expGroup
    );

    if (evalResult.didLevelUp) {
      player.level = evalResult.newLevel;
      const newStats = StatCalculator.calculateAllStats(playerSpecies, player.level);
      const hpDiff = newStats.hp - player.maxHp;
      player.maxHp = newStats.hp;
      player.currentHp += Math.max(0, hpDiff);
      player.stats = newStats;

      events.push({
        type: 'LEVEL_UP',
        side: 'player',
        sourceName: player.nickname || player.speciesId,
        newLevel: player.level,
        message: `¡${player.nickname || player.speciesId} subió al nivel ${player.level}!`,
      });

      playerSpecies.learnset.forEach((lm) => {
        if (lm.level === player.level) {
          const moveDef = MOVES_DATA[lm.moveId];
          if (moveDef && player.moves.length < 4) {
            player.moves.push({
              moveId: lm.moveId,
              currentPp: moveDef.pp,
              maxPp: moveDef.pp,
            });
            events.push({
              type: 'MOVE_LEARNED',
              side: 'player',
              moveName: moveDef.name,
              message: `¡${player.nickname || player.speciesId} aprendió ${moveDef.name}!`,
            });
          }
        }
      });
    }

    const nextOpponentIdx = this.opponentParty.findIndex(
      (c, idx) => idx > this.opponentActiveIndex && c.currentHp > 0
    );

    if (nextOpponentIdx >= 0) {
      this.opponentActiveIndex = nextOpponentIdx;
      this.opponentStages = StatCalculator.createInitialStages();
      const nextCreature = this.getOpponentActive();

      events.push({
        type: 'SWITCH_IN',
        side: 'opponent',
        sourceName: nextCreature.nickname || nextCreature.speciesId,
        currentHp: nextCreature.currentHp,
        maxHp: nextCreature.maxHp,
        message: `¡${this.trainerName} envió a ${nextCreature.nickname || nextCreature.speciesId}!`,
      });
      this.triggerSwitchInAbilities(nextCreature, 'opponent', events);
    } else {
      this.isBattleOver = true;
      this.victory = true;
      this.playerParty.forEach((c) => {
        if (c.currentHp > 0) {
          c.friendship = Math.min(255, (c.friendship || 70) + 5);
        }
      });
      events.push({
        type: 'BATTLE_VICTORY',
        moneyGained: this.moneyReward,
        message: `¡Has ganado el combate! ${this.moneyReward > 0 ? `Ganaste $${this.moneyReward}.` : ''}`,
      });
    }
  }

  private handlePlayerFainted(events: BattleEvent[]): void {
    const nextPlayerIdx = this.playerParty.findIndex((c) => c.currentHp > 0);

    if (nextPlayerIdx >= 0) {
      this.playerActiveIndex = nextPlayerIdx;
      this.playerStages = StatCalculator.createInitialStages();
      const nextCreature = this.getPlayerActive();

      events.push({
        type: 'SWITCH_IN',
        side: 'player',
        sourceName: nextCreature.nickname || nextCreature.speciesId,
        currentHp: nextCreature.currentHp,
        maxHp: nextCreature.maxHp,
        message: `¡Adelante, ${nextCreature.nickname || nextCreature.speciesId}!`,
      });
      this.triggerSwitchInAbilities(nextCreature, 'player', events);
    } else {
      this.isBattleOver = true;
      this.victory = false;
      events.push({
        type: 'BATTLE_DEFEAT',
        message: '¡A Red no le quedan criaturas sanas! Fuiste transportado a un lugar seguro...',
      });
    }
  }

  private resolveEndOfTurn(events: BattleEvent[]): void {
    EffectResolver.resolveEndOfTurnStatus(this.getPlayerActive(), 'player', events);
    if (this.getPlayerActive().currentHp <= 0) {
      this.handlePlayerFainted(events);
    }

    EffectResolver.resolveEndOfTurnStatus(this.getOpponentActive(), 'opponent', events);
    if (this.getOpponentActive().currentHp <= 0) {
      this.handleOpponentFainted(events);
    }

    if (this.isBattleOver) return;

    // Weather duration & sandstorm damage
    if (this.weather.type !== 'none') {
      this.weather.turnsRemaining--;
      if (this.weather.type === 'sandstorm') {
        const pCreature = this.getPlayerActive();
        if (pCreature.currentHp > 0 && !this.getPlayerSpecies().types.includes('Tierra')) {
          const dmg = Math.max(1, Math.floor(pCreature.maxHp / 16));
          pCreature.currentHp = Math.max(0, pCreature.currentHp - dmg);
          events.push({
            type: 'DAMAGE_DEALT',
            side: 'player',
            damage: dmg,
            currentHp: pCreature.currentHp,
            message: `¡La tormenta de arena daña a ${pCreature.nickname || pCreature.speciesId}!`,
          });
          if (pCreature.currentHp <= 0) this.handlePlayerFainted(events);
        }

        const oCreature = this.getOpponentActive();
        if (oCreature.currentHp > 0 && !this.getOpponentSpecies().types.includes('Tierra')) {
          const dmg = Math.max(1, Math.floor(oCreature.maxHp / 16));
          oCreature.currentHp = Math.max(0, oCreature.currentHp - dmg);
          events.push({
            type: 'DAMAGE_DEALT',
            side: 'opponent',
            damage: dmg,
            currentHp: oCreature.currentHp,
            message: `¡La tormenta de arena daña a ${oCreature.nickname || oCreature.speciesId}!`,
          });
          if (oCreature.currentHp <= 0) this.handleOpponentFainted(events);
        }
      }
      if (this.weather.turnsRemaining <= 0) {
        events.push({ type: 'MESSAGE', message: '¡El clima ha vuelto a la normalidad!' });
        this.weather = { type: 'none', turnsRemaining: 0 };
      }
    }

    // Held item: Restos & End of turn abilities
    [
      { c: this.getPlayerActive(), side: 'player' as BattleSide },
      { c: this.getOpponentActive(), side: 'opponent' as BattleSide }
    ].forEach(({ c, side }) => {
      if (c.currentHp <= 0) return;

      if (c.heldItemId === 'restos' && c.currentHp < c.maxHp) {
        const healAmt = Math.max(1, Math.floor(c.maxHp / 16));
        c.currentHp = Math.min(c.maxHp, c.currentHp + healAmt);
        events.push({
          type: 'HEAL',
          side,
          healAmount: healAmt,
          currentHp: c.currentHp,
          maxHp: c.maxHp,
          message: `¡Los Restos de ${c.nickname || c.speciesId} le restauran PS!`,
        });
      }

      const ability = getAbility(c.abilityId);
      if (ability && ability.onTurnEnd) {
        const res = ability.onTurnEnd({ user: c, side, weather: this.weather.type });
        if (res && res.healPercent && c.currentHp < c.maxHp) {
          const healAmt = Math.max(1, Math.floor(c.maxHp * res.healPercent));
          c.currentHp = Math.min(c.maxHp, c.currentHp + healAmt);
          events.push({
            type: 'HEAL',
            side,
            healAmount: healAmt,
            currentHp: c.currentHp,
            maxHp: c.maxHp,
            message: res.message || `¡${c.nickname || c.speciesId} recuperó PS!`,
          });
        }
      }
    });
  }

  private handleFleeAction(events: BattleEvent[]): BattleEvent[] {
    if (this.battleType !== 'wild') {
      events.push({
        type: 'FLEE_FAIL',
        message: '¡No puedes huir de un combate contra un entrenador!',
      });
      return events;
    }

    this.fleeAttempts++;
    const pSpeed = this.getEffectiveSpeed(this.getPlayerActive(), this.playerStages);
    const oSpeed = this.getEffectiveSpeed(this.getOpponentActive(), this.opponentStages);

    const f = Math.floor((pSpeed * 128) / Math.max(1, oSpeed)) + 30 * this.fleeAttempts;

    if (f > 255 || this.rng.rangeInt(0, 255) < f) {
      this.isBattleOver = true;
      events.push({
        type: 'FLEE_SUCCESS',
        message: '¡Escapaste sin problemas!',
      });
    } else {
      events.push({
        type: 'FLEE_FAIL',
        message: '¡No pudiste escapar!',
      });
      const opponentAction = BattleAI.decideAction(
        this.getOpponentActive(),
        this.getOpponentSpecies(),
        this.opponentStages,
        this.getPlayerActive(),
        this.getPlayerSpecies(),
        this.playerStages,
        this.battleType,
        this.rng
      );
      this.executeSingleAction(opponentAction, 'opponent', events);
      this.resolveEndOfTurn(events);
    }

    return events;
  }

  private handleCaptureAction(
    capsuleItemId: string,
    events: BattleEvent[],
    opponentAction: BattleAction
  ): BattleEvent[] {
    if (this.battleType !== 'wild') {
      events.push({
        type: 'CAPTURE_FAIL',
        message: '¡No puedes capturar las criaturas de otro entrenador!',
      });
      return events;
    }

    const opponent = this.getOpponentActive();
    const oSpecies = this.getOpponentSpecies();

    events.push({
      type: 'ITEM_USED',
      side: 'player',
      itemId: capsuleItemId,
      message: `¡Lanzaste una ${capsuleItemId.toUpperCase()}!`,
    });

    const state = GlobalSaveService.getCurrentState();
    if (!state.flags?.tutorial_capture_shown) {
      state.flags.tutorial_capture_shown = true;
      GlobalSaveService.save();
      events.push({
        type: 'MESSAGE',
        message: '💡 ¡Consejo: Debilitar a la criatura salvaje aumenta las probabilidades de captura!',
      });
    }

    const result = CaptureCalculator.calculateCapture(
      opponent,
      oSpecies,
      capsuleItemId,
      this.rng
    );

    events.push({
      type: 'CAPTURE_SHAKES',
      shakes: result.shakes,
    });

    if (result.success) {
      this.isBattleOver = true;
      this.victory = true;
      events.push({
        type: 'CAPTURE_SUCCESS',
        targetName: opponent.nickname || opponent.speciesId,
        message: `¡Ya está! ¡${opponent.nickname || opponent.speciesId} fue capturado!`,
      });
    } else {
      events.push({
        type: 'CAPTURE_FAIL',
        message: '¡Oh, no! ¡La criatura se ha escapado!',
      });
      this.executeSingleAction(opponentAction, 'opponent', events);
      this.resolveEndOfTurn(events);
    }

    return events;
  }

  private handleItemAction(itemId: string, side: BattleSide, events: BattleEvent[]): void {
    const item = ITEMS_DATA[itemId];
    const user = side === 'player' ? this.getPlayerActive() : this.getOpponentActive();
    if (!item) return;

    events.push({
      type: 'ITEM_USED',
      side,
      itemId,
      message: `¡Se usó ${item.name}!`,
    });

    if (item.category === 'elixir' || item.category === 'crystal' || item.category === 'repair_kit') {
      if (item.effect.type === 'heal_hp' || item.effect.type === 'repair') {
        const healAmt = item.effect.type === 'heal_hp' ? item.effect.amount : (item.effect as any).amount || 50;
        const healRes = StatCalculator.distributeHeal(user, healAmt);
        events.push({
          type: 'HEAL',
          side,
          sourceName: user.nickname || user.speciesId,
          healAmount: healRes.actualHealed,
          currentHp: user.currentHp,
          maxHp: user.maxHp,
          message: `¡${user.nickname || user.speciesId} recuperó ${healRes.actualHealed} PS!`,
        });

        healRes.partHeals.forEach((ph) => {
          events.push({
            type: 'PART_REPAIRED',
            side,
            part: ph.part,
            healAmount: ph.amount,
            partHp: ph.remainingHp,
            partMaxHp: user.maxPartHP ? user.maxPartHP[ph.part] : undefined,
          });
        });
      } else if (item.effect.type === 'cure_status') {
        user.status = null;
        events.push({
          type: 'STATUS_CURED',
          side,
          sourceName: user.nickname || user.speciesId,
          message: `¡${user.nickname || user.speciesId} purificó su ki!`,
        });
      }
    } else if (item.category === 'purge') {
      if (item.effect.type === 'cure_status') {
        user.status = null;
        events.push({
          type: 'STATUS_CURED',
          side,
          sourceName: user.nickname || user.speciesId,
          message: `¡${user.nickname || user.speciesId} purgó el ki corrupto!`,
        });
      }
    } else if (item.category === 'reincarnation') {
      StatCalculator.ensurePartHp(user);
      const revivePercent = (item.effect.type === 'revive' ? item.effect.hpPercent / 100 : BATTLE_CONFIG.reincarnationHpPercent) || 0.5;
      user.partHP.head = Math.max(1, Math.floor(user.maxPartHP.head * revivePercent));
      user.partHP.torso = Math.max(1, Math.floor(user.maxPartHP.torso * revivePercent));
      user.partHP.arms = Math.max(1, Math.floor(user.maxPartHP.arms * revivePercent));
      user.partHP.legs = Math.max(1, Math.floor(user.maxPartHP.legs * revivePercent));
      user.currentHp = user.partHP.head + user.partHP.torso + user.partHP.arms + user.partHP.legs;

      events.push({
        type: 'HEAL',
        side,
        sourceName: user.nickname || user.speciesId,
        healAmount: user.currentHp,
        currentHp: user.currentHp,
        maxHp: user.maxHp,
        message: `¡${user.nickname || user.speciesId} reencarnó con sus partes vitales restauradas!`,
      });
    }
  }

  private handleSwitchAction(
    targetIndex: number,
    side: BattleSide,
    events: BattleEvent[]
  ): void {
    const prevCreature = this.getPlayerActive();
    this.playerActiveIndex = targetIndex;
    this.playerStages = StatCalculator.createInitialStages();
    const newCreature = this.getPlayerActive();

    events.push({
      type: 'SWITCH_OUT',
      side,
      sourceName: prevCreature.nickname || prevCreature.speciesId,
      message: `¡Vuelve, ${prevCreature.nickname || prevCreature.speciesId}!`,
    });

    events.push({
      type: 'SWITCH_IN',
      side,
      sourceName: newCreature.nickname || newCreature.speciesId,
      currentHp: newCreature.currentHp,
      maxHp: newCreature.maxHp,
      message: `¡Adelante, ${newCreature.nickname || newCreature.speciesId}!`,
    });
  }

  private getMoveFromAction(action: BattleAction, creature: CreatureInstance): Move {
    if (action.type === 'move') {
      if (action.moveIndex >= 0 && creature.moves[action.moveIndex]) {
        const moveId = creature.moves[action.moveIndex].moveId;
        const def = MOVES_DATA[moveId];
        if (def) return def;
      }
      return DamageCalculator.getStruggleMove();
    }
    return DamageCalculator.getStruggleMove();
  }

  public getEffectiveSpeed(creature: CreatureInstance, stages: BattleStatStages): number {
    let speed = Math.floor(
      creature.stats.speed * StatCalculator.getStatStageMultiplier(stages.speed)
    );
    if (creature.status === 'paralysis') {
      speed = Math.max(1, Math.floor(speed * 0.5));
    }
    // Derived modifier: Legs broken penalty
    if (creature.partHP && creature.partHP.legs <= 0) {
      const legsMult = PARTS_CONFIG.parts?.legs?.speedMultiplier ?? 0.5;
      speed = Math.max(1, Math.floor(speed * legsMult));
    }
    return speed;
  }
}
