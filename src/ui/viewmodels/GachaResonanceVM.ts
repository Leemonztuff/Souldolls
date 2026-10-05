import { GameState } from '../../types';
import { GachaRarity } from '../../types/gacha';
import { GACHA_CONFIG, BODY_PIECES_DATA } from '../../data/gacha/gachaData';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { GachaService } from '../../systems/gacha/GachaService';
import esText from '../../data/text/es.json';

export type GachaResonanceTabId = 'scan' | 'pieces' | 'rates';

export interface BodyPieceProgressVM {
  pieceId: string;
  chassisId: string;
  chassisName: string;
  pieceName: string;
  rarity: GachaRarity;
  currentPieces: number;
  requiredPieces: number;
  ratio: number;
  canAssemble: boolean;
}

export interface GachaRateEntryVM {
  rarity: GachaRarity;
  rarityLabel: string;
  ratePercent: string;
  kiDustYield: number;
}

export interface ScanLedgerEntryVM {
  hashShort: string;
  tableId: string;
  rarity: GachaRarity;
  dateFormatted: string;
}

export interface GachaResonanceVM {
  activeTableId: 'standard_resonance' | 'brilliant_resonance';
  tableName: string;
  fragmentItemId: 'soul_fragment' | 'soul_fragment_brilliant';
  standardFragments: number;
  brilliantFragments: number;
  activeFragmentsCount: number;
  kiDust: number;
  money: number;
  currentPity: number;
  pityThreshold: number;
  pityRatio: number;
  guaranteedRarity: GachaRarity;
  dailyUsed: number;
  dailyLimit: number;
  privacyNotice: string;
  rates: GachaRateEntryVM[];
  bodyPieces: BodyPieceProgressVM[];
  recentScans: ScanLedgerEntryVM[];
}

const RARITY_LABELS: Record<GachaRarity, string> = {
  common: 'COMÚN',
  uncommon: 'POCO COMÚN',
  rare: 'RARA',
  epic: 'ÉPICA',
};

/**
 * BLOQUE 28B R3 & R6: ViewModel de la Cámara de Resonancia QR (Probabilidades, Pity, Piezas x/5 y ScanLedger).
 */
export function buildGachaResonanceVM(
  state: GameState,
  activeTableId: 'standard_resonance' | 'brilliant_resonance' = 'standard_resonance'
): GachaResonanceVM {
  GachaService.ensureStateInitialized(state);

  const tGacha = (esText as any).terms.gacha;
  const info = GachaService.getTableTransparencyInfo(activeTableId);
  const inv = state.inventory || {};

  const standardFragments = Number(inv['soul_fragment'] || 0);
  const brilliantFragments = Number(inv['soul_fragment_brilliant'] || 0);
  const activeFragmentsCount =
    activeTableId === 'brilliant_resonance' ? brilliantFragments : standardFragments;

  const currentPity = Number(state.gachaPity?.[activeTableId] || 0);
  const pityThreshold = info.pityThreshold;
  const pityRatio = Math.min(1, currentPity / Math.max(1, pityThreshold));

  const dailyUsed = Number(state.gachaDailyRedeems?.count || 0);
  const dailyLimit = GACHA_CONFIG.dailyRedeemLimit;

  const rates: GachaRateEntryVM[] = info.formattedRates.map((r) => ({
    rarity: r.rarity,
    rarityLabel: RARITY_LABELS[r.rarity],
    ratePercent: r.ratePercent,
    kiDustYield: GACHA_CONFIG.duplicateScrollKiDustYield[r.rarity] || 15,
  }));

  const reqPieces = GACHA_CONFIG.piecesRequired || 5;
  const bodyPieces: BodyPieceProgressVM[] = Object.values(BODY_PIECES_DATA).map((pieceDef) => {
    const cur = Number(
      state.bodyPieces?.[pieceDef.chassisId] ?? state.bodyPieces?.[pieceDef.id] ?? 0
    );
    const chassis = BODY_CHASSIS_DATA[pieceDef.chassisId];
    return {
      pieceId: pieceDef.id,
      chassisId: pieceDef.chassisId,
      chassisName: chassis?.name || pieceDef.name,
      pieceName: pieceDef.name,
      rarity: pieceDef.rarity,
      currentPieces: cur,
      requiredPieces: reqPieces,
      ratio: Math.min(1, cur / reqPieces),
      canAssemble: cur >= reqPieces,
    };
  });

  const ledger = state.scanLedger || [];
  const recentScans: ScanLedgerEntryVM[] = ledger
    .slice(-10)
    .reverse()
    .map((entry) => {
      const d = new Date(entry.redeemedAt || Date.now());
      const dateStr = `${String(d.getUTCDate()).padStart(2, '0')}/${String(
        d.getUTCMonth() + 1
      ).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(
        d.getUTCMinutes()
      ).padStart(2, '0')}`;
      return {
        hashShort: `SELLO-${(entry.hash || '').slice(0, 8).toUpperCase()}`,
        tableId: entry.tableId,
        rarity: entry.tableId === 'brilliant_resonance' ? 'rare' : 'common',
        dateFormatted: dateStr,
      };
    });

  return {
    activeTableId,
    tableName: info.table.name,
    fragmentItemId: info.table.fragmentItemId,
    standardFragments,
    brilliantFragments,
    activeFragmentsCount,
    kiDust: Number(state.kiDust || 0),
    money: Number(state.player?.money || 0),
    currentPity,
    pityThreshold,
    pityRatio,
    guaranteedRarity: info.guaranteedRarity,
    dailyUsed,
    dailyLimit,
    privacyNotice: tGacha.privacy_notice,
    rates,
    bodyPieces,
    recentScans,
  };
}
