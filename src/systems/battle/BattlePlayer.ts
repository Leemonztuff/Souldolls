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

        // Play move VFX from weapon hotspot to defender torso hotspot (both reflected with flipX)
        const attackerPos = this.scene.getPartHotspotWorldPos(side, 'weapon');
        const defenderPos = this.scene.getPartHotspotWorldPos(side === 'player' ? 'opponent' : 'player', 'torso');

        const preset = move?.vfx?.preset || 'burst';
        const colA = move?.vfx?.colorA || '#38bdf8';
        const colB = move?.vfx?.colorB || '#ffffff';

        GlobalAudioService.playSfx('attack_normal');
        await GlobalVFXSystem.playPresetVfx(
          preset,
          attackerPos.x,
          attackerPos.y,
          defenderPos.x,
          defenderPos.y,
          colA,
          colB
        );
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
        GlobalAudioService.playSfx('hit_super');
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
        GlobalVFXSystem.spawnStatChangeArrow(pos.x, pos.y - 20, event.stat || 'atk', stages);
        await GlobalVFXSystem.playPresetVfx(
          'aura',
          pos.x,
          pos.y,
          pos.x,
          pos.y,
          stages > 0 ? '#4ade80' : '#f43f5e',
          '#ffffff'
        );
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
        await this.scene.updateExpBarAnimated(event.currentExp || 0, event.maxExp || 100);
        break;
      }

      case 'LEVEL_UP': {
        GlobalAudioService.playSfx('levelUp');
        await GlobalVFXSystem.screenFlash(0xfcd34d, 250);
        this.scene.updateLevelBadge('player', event.newLevel || 1);
        await this.sleep(500);
        break;
      }

      case 'CAPTURE_ATTEMPT':
      case 'CAPTURE_SHAKES': {
        GlobalAudioService.playSfx('confirm');
        await this.scene.animateCaptureSequence(event.shakes || 0, !!event.success);
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
