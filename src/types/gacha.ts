import { ElementType } from './elements';
import { SoulClassId } from './souldolls';

export type GachaRarity = 'common' | 'uncommon' | 'rare' | 'epic';

export type GachaRewardKind = 'item' | 'bodyPiece' | 'scroll';

export type ScanRedeemPolicy = 'once_forever' | 'cooldown_hours';

export type DuplicateScrollPolicy = 'convert_ki_dust' | 'accumulate';

export interface BodyPiece {
  id: string;
  name: string;
  chassisId: string;
  rarity: GachaRarity;
  description: string;
}

export interface TechniqueScrollCompatibility {
  classIds?: SoulClassId[];
  types?: ElementType[];
  tags?: string[];
}

export interface TechniqueScroll {
  id: string;
  name: string;
  moveId: string;
  rarity: GachaRarity;
  compatibility: TechniqueScrollCompatibility;
  price: number;
  description: string;
}

export interface GachaEntry {
  kind: GachaRewardKind;
  id: string;
  weight: number;
  rarity: GachaRarity;
  minPlayerProgress?: number; // Minimum guild seals (badges) required
  quantity?: number;
}

export interface GachaPityConfig {
  threshold: number;
  guaranteedRarity: GachaRarity;
}

export interface GachaRarityRates {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
}

export interface GachaTable {
  id: string;
  name: string;
  fragmentItemId: 'soul_fragment' | 'soul_fragment_brilliant';
  entries: GachaEntry[];
  pity: GachaPityConfig;
  rarityRates: GachaRarityRates;
}

export interface GachaConfigData {
  piecesRequired: number;
  useSaveSalt: boolean;
  redeemPolicy: ScanRedeemPolicy;
  cooldownHours: number;
  dailyRedeemLimit: number;
  duplicateScrollPolicy: DuplicateScrollPolicy;
  duplicateScrollKiDustYield: Record<GachaRarity, number>;
  defaultTableId: string;
  brilliantTableId: string;
}

export interface ScanLedgerEntry {
  hash: string;
  redeemedAt: number; // Timestamp (ms)
  tableId: string;
}

export interface GachaRewardItem {
  kind: GachaRewardKind;
  id: string;
  name: string;
  rarity: GachaRarity;
  quantity: number;
  chassisId?: string;
  piecesCurrent?: number;
  piecesRequired?: number;
  assembledBodyInstanceId?: string;
  moveId?: string;
  convertedToKiDust?: number;
}

export interface GachaResult {
  ok: boolean;
  errorCode?: 'EMPTY_PAYLOAD' | 'ALREADY_REDEEMED' | 'DAILY_LIMIT_REACHED' | 'NO_FRAGMENTS' | 'INVALID_TABLE';
  message: string;
  hash: string;
  seedUsed: number;
  tableId: string;
  rarity: GachaRarity;
  wasPityTriggered: boolean;
  pityCounterAfter: number;
  rewards: GachaRewardItem[];
  newDiscoveries: string[];
}
