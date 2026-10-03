import { ElementType } from '../../types/elements';
import { StatusConditionType } from '../../types/status';
import { BodyPart } from '../../types/bodies';

export type BattleSide = 'player' | 'opponent';
export type BattleType = 'wild' | 'trainer' | 'boss';

export type EffectivenessRating = 'immune' | 'not_very_effective' | 'normal' | 'super_effective';

export interface BattleStatStages {
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  accuracy: number;
  evasion: number;
}

export type BattleAction =
  | { type: 'move'; moveIndex: number }
  | { type: 'item'; itemId: string; targetPartyIndex?: number; targetUid?: string }
  | { type: 'switch'; targetPartyIndex: number }
  | { type: 'flee' }
  | { type: 'catch'; itemId: string }
  | { type: 'capture'; capsuleItemId: string };

export type BattleEventType =
  | 'BATTLE_START'
  | 'MESSAGE'
  | 'TURN_START'
  | 'ACTION_ANNOUNCED'
  | 'MOVE_USED'
  | 'DAMAGE_DEALT'
  | 'PART_DAMAGED'
  | 'PART_BROKEN'
  | 'MOVE_BLOCKED'
  | 'PART_REPAIRED'
  | 'EFFECTIVENESS'
  | 'CRITICAL_HIT'
  | 'MOVE_MISSED'
  | 'HEAL'
  | 'DRAIN'
  | 'RECOIL'
  | 'STAT_STAGE_CHANGED'
  | 'STATUS_APPLIED'
  | 'STATUS_DAMAGE'
  | 'STATUS_CURED'
  | 'STATUS_PREVENTED_ACTION'
  | 'FLINCH'
  | 'FAINTED'
  | 'EXP_GAINED'
  | 'LEVEL_UP'
  | 'MOVE_LEARNED'
  | 'CAPTURE_ATTEMPT'
  | 'CAPTURE_SHAKES'
  | 'CAPTURE_SUCCESS'
  | 'CAPTURE_FAIL'
  | 'ITEM_USED'
  | 'SWITCH_OUT'
  | 'SWITCH_IN'
  | 'FLEE'
  | 'FLEE_SUCCESS'
  | 'FLEE_FAIL'
  | 'BATTLE_VICTORY'
  | 'BATTLE_DEFEAT';

export interface BattleEvent {
  type: BattleEventType;
  side?: BattleSide;
  sourceUid?: string;
  targetUid?: string;
  sourceName?: string;
  targetName?: string;
  moveId?: string;
  moveName?: string;
  damage?: number;
  currentHp?: number;
  maxHp?: number;
  part?: BodyPart;
  partHp?: number;
  partMaxHp?: number;
  reason?: string;
  faintReason?: 'head_broken' | 'torso_broken' | 'total_hp';
  healAmount?: number;
  effectiveness?: EffectivenessRating;
  rating?: EffectivenessRating;
  isCritical?: boolean;
  stat?: keyof BattleStatStages;
  stages?: number; // delta e.g. +1, -2
  status?: StatusConditionType;
  expGained?: number;
  currentExp?: number;
  maxExp?: number;
  newLevel?: number;
  shakes?: number; // 0, 1, 2, 3
  success?: boolean;
  itemId?: string;
  message?: string;
  moneyGained?: number;
}

