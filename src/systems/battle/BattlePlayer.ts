import { BattleEvent, BattleSide } from './BattleTypes';
import { BattleScene } from '../../scenes/BattleScene';
import { GlobalVFXSystem } from '../../render/vfx/VFXSystem';
import { GlobalAudioService } from '../../services/AudioService';
import { MOVES_DATA } from '../../data/moves/moves';

export class BattlePlayer {
  private scene: BattleScene;
  private isCancelled = false;

  constructor(scene: BattleScene) {
    this.scene = scene;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Sequentially plays through an array of BattleEvents produced by BattleEngine
   */
  public async playEvents(events: BattleEvent[]): Promise<void> {
    this.isCancelled = false;

    for (let i = 0; i < events.length; i++) {
      if (this.isCancelled) break;
      const event = events[i];
      await this.processEvent(event);
    }
  }

  private async processEvent(event: BattleEvent): Promise<void> {
    if (event.message) {
      await this.scene.showNarratorMessage(event.message);
    }

    const side: BattleSide = event.side || 'player';

    switch (event.type) {
      case 'MOVE_USED': {
        const move = event.moveId ? MOVES_DATA[event.moveId] : undefined;

        // Lunge animation
        await this.scene.animateAttackerLunge(side);

        // Play move VFX from weapon hotspot to target torso hotspot (both reflected with flipX)
        const attackerPos = this.scene.getPartHotspotWorldPos(side, 'weapon');
        const isSelfTarget = move?.target === 'self';
        const defenderPos = isSelfTarget
          ? this.scene.getPartHotspotWorldPos(side, 'torso')
          : this.scene.getPartHotspotWorldPos(side === 'player' ? 'opponent' : 'player', 'torso');

        const preset = move?.vfx?.preset || 'burst';
        const colA = move?.vfx?.colorA || '#38bdf8';
        const colB = move?.vfx?.colorB || '#ffffff';

        GlobalAudioService.playSfx('attack_normal');
        await this.scene.playMoveCombatFX(event.moveId || '', attackerPos, defenderPos);
        break;
      }

      case 'DAMAGE_DEALT': {
        const defenderPos = this.scene.getPartHotspotWorldPos(side, 'torso');

        GlobalAudioService.playSfx('hit_normal');
        GlobalVFXSystem.spawnDamageText(
          defenderPos.x,
          defenderPos.y - 20,
          event.damage || 0,
          !!event.isCritical
        );

        // Defender blinks and retreats 1-2px away from attacker
        await this.scene.animateDefenderHitBlink(side);

        // Update animated HP bar & silhouettes
        await this.scene.updateHpBarAnimated(side, event.currentHp || 0, event.maxHp || 100);
        this.scene.updateSilhouettes();
        break;
      }

      case 'PART_DAMAGED': {
        const targetPart = (event.part as 'head' | 'torso' | 'arms' | 'legs') || 'torso';
        const partPos = this.scene.getPartHotspotWorldPos(side, targetPart);

        if (event.part) {
          this.scene.flashPartZone(side, event.part);
        }

        GlobalVFXSystem.spawnDamageText(
          partPos.x,
          partPos.y,
          event.damage || 0,
          false
        );
        this.scene.updateSilhouettes();
        await this.sleep(150);
        break;
      }

      case 'PART_BROKEN': {
        const targetPart = (event.part as 'head' | 'torso' | 'arms' | 'legs') || 'torso';
        const partPos = this.scene.getPartHotspotWorldPos(side, targetPart);
        GlobalAudioService.playSfx('hit_super');
        if (event.part) {
          this.scene.flashPartZone(side, event.part, 0xef4444);
        }
        await GlobalVFXSystem.playPresetVfx('ki_burst', partPos.x, partPos.y, partPos.x, partPos.y);
        this.scene.updateSilhouettes();
        await this.sleep(300);
        break;
      }

      case 'MOVE_BLOCKED': {
        GlobalAudioService.playSfx('cancel');
        await this.sleep(400);
        break;
      }

      case 'PART_REPAIRED': {
        const pos = this.scene.getSpritePosition(side);
        GlobalAudioService.playSfx('confirm');
        await GlobalVFXSystem.playPresetVfx('aura', pos.x, pos.y - 30, pos.x, pos.y - 30, '#38bdf8', '#ffffff');
        this.scene.updateSilhouettes();
        await this.sleep(200);
        break;
      }

      case 'CRITICAL_HIT': {
        const defenderPos = this.scene.getSpritePosition(side);
        GlobalAudioService.playSfx('hit_super');
        GlobalVFXSystem.emitCriticalHitFeedback(defenderPos.x, defenderPos.y);
        await this.sleep(300);
        break;
      }

      case 'EFFECTIVENESS': {
        const defenderPos = this.scene.getSpritePosition(side);
        const rating = event.rating || event.effectiveness || 'normal';
        if (rating === 'super_effective') {
          GlobalAudioService.playSfx('hit_super');
        }
        if (rating !== 'normal') {
          GlobalVFXSystem.spawnEffectivenessBadge(defenderPos.x, defenderPos.y, rating);
        }
        await this.sleep(350);
        break;
      }

      case 'STAT_STAGE_CHANGED': {
        const pos = this.scene.getSpritePosition(side);
        const stages = event.stages || 1;
        GlobalAudioService.playSfx(stages > 0 ? 'levelUp' : 'cancel');
        GlobalVFXSystem.emitStatChangeFeedback(pos.x, pos.y, event.stat || 'atk', stages);
        await this.sleep(450);
        break;
      }

      case 'STATUS_APPLIED': {
        GlobalAudioService.playSfx('status');
        this.scene.setStatusBadge(side, event.status || '');
        await this.sleep(400);
        break;
      }

      case 'STATUS_DAMAGE': {
        const pos = this.scene.getSpritePosition(side);
        GlobalAudioService.playSfx('hit_normal');
        await this.scene.animateDefenderHitBlink(side);
        await this.scene.updateHpBarAnimated(side, event.currentHp || 0, event.maxHp || 100);
        break;
      }

      case 'HEAL':
      case 'DRAIN': {
        const pos = this.scene.getSpritePosition(side);
        GlobalAudioService.playSfx('confirm');
        await GlobalVFXSystem.playPresetVfx('aura', pos.x, pos.y, pos.x, pos.y, '#4ade80', '#ffffff');
        await this.scene.updateHpBarAnimated(side, event.currentHp || 0, event.maxHp || 100);
        break;
      }

      case 'RECOIL': {
        await this.scene.animateDefenderHitBlink(side);
        await this.scene.updateHpBarAnimated(side, event.currentHp || 0, event.maxHp || 100);
        break;
      }

      case 'FAINTED': {
        const pos = this.scene.getSpritePosition(side);
        GlobalAudioService.playSfx('faint');
        await GlobalVFXSystem.playPresetVfx('soul_flame', pos.x, pos.y, pos.x, pos.y - 40);
        await this.scene.animateFaint(side);
        break;
      }

      case 'SWITCH_IN': {
        GlobalAudioService.playSfx('confirm');
        await this.scene.animateSwitchIn(
          side,
          event.sourceName || 'Criatura',
          event.currentHp || 100,
          event.maxHp || 100
        );
        break;
      }

      case 'EXP_GAINED': {
        GlobalAudioService.playSfx('exp_gain');
        await this.scene.updateExpBarAnimated(event.currentExp ?? 0, event.maxExp ?? 100);
        break;
      }

      case 'LEVEL_UP': {
        GlobalAudioService.playSfx('levelUp');
        await GlobalVFXSystem.screenFlash(0xfcd34d, 250);
        this.scene.updateLevelBadge('player', event.newLevel || 1);
        await this.sleep(450);
        break;
      }

      case 'LOOT_GAINED': {
        // Loot items are displayed in the post-battle summary component after the victory animation completes
        break;
      }

      case 'BATTLE_VICTORY': {
        this.scene.setCombatPose('player', 'victory');
        await this.sleep(250);
        break;
      }

      case 'CAPTURE_ATTEMPT':
      case 'CAPTURE_SHAKES': {
        GlobalAudioService.playSfx('confirm');
        await this.scene.animateCaptureSequence(event.shakes || 0, !!event.success);
        break;
      }

      case 'CAPTURE_SUCCESS': {
        GlobalAudioService.playSfx('catch');
        await GlobalVFXSystem.screenFlash(0xfacc15, 300);
        const defenderPos = this.scene.getSpritePosition('opponent');
        await GlobalVFXSystem.playPresetVfx(
          'ki_burst',
          defenderPos.x,
          defenderPos.y,
          defenderPos.x,
          defenderPos.y
        );
        break;
      }

      case 'CAPTURE_FAIL': {
        GlobalAudioService.playSfx('cancel');
        await GlobalVFXSystem.screenFlash(0xf43f5e, 150);
        break;
      }

      case 'FLEE':
      case 'FLEE_SUCCESS': {
        GlobalAudioService.playSfx('select');
        await this.sleep(400);
        break;
      }

      default:
        await this.sleep(200);
        break;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
