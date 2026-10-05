import { GameState, SaveSlotSummary, Souldoll } from '../../types';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { ITEMS_DATA } from '../../data/items/items';
import { PokedexSystem, PokedexStatus } from '../../systems/PokedexSystem';
import { StatCalculator } from '../../systems/battle/StatCalculator';
import { QuestData, QuestProgressState } from '../../types/quests';
import { KitIconId } from '../kit/icons/IconRegistry';
import esText from '../../data/text/es.json';

// ============================================================================
// 1. TITLE & OPTIONS & SAVE SLOTS VIEW-MODELS
// ============================================================================
export interface OptionsVM {
  title: string;
  secAudio: string;
  secVisual: string;
  secControls: string;
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  outfitStyle: 'clasico' | 'atrevido';
  outfitStyleLabel: string;
  outfitOptions: string[];
  outfitSelectedIndex: number;
  bustAnimation: 'off' | 'subtle' | 'normal';
  bustOptions: string[];
  bustSelectedIndex: number;
  runMode: 'hold' | 'toggle';
  runModeOptions: string[];
  runModeSelectedIndex: number;
  showCameraButton: boolean;
  cameraBtnOptions: string[];
  cameraBtnSelectedIndex: number;
  showObjectiveHint: boolean;
  objectiveHintOptions: string[];
  objectiveHintSelectedIndex: number;
  touchScale: number;
  touchPosition: 'compact' | 'normal' | 'wide';
  touchPosOptions: string[];
  touchPosSelectedIndex: number;
  separateControlPanel: boolean;
  separatePanelOptions: string[];
  separatePanelSelectedIndex: number;
  descriptionText: string;
  disclaimerText: string;
  btnSave: string;
  btnCancel: string;
}

export function buildOptionsVM(state: GameState): OptionsVM {
  const t = (esText as any).terms.group_a.options;
  const outfitStyle = state.settings.outfitStyle === 'atrevido' ? 'atrevido' : 'clasico';
  const bustMode = state.settings.bustAnimation || 'subtle';
  const bustModes: Array<'off' | 'subtle' | 'normal'> = ['off', 'subtle', 'normal'];
  const runMode = state.settings.runMode === 'toggle' ? 'toggle' : 'hold';
  const showCameraButton = state.settings.showCameraButton !== false;
  const showObjectiveHint = state.settings.showObjectiveHint !== false;
  const rawScale = state.settings.touchScale ?? 1;
  const touchScale =
    typeof rawScale === 'number'
      ? rawScale
      : rawScale === 'small'
      ? 0.85
      : rawScale === 'large'
      ? 1.15
      : 1.0;
  const touchPos = state.settings.touchPosition || 'normal';
  const touchPosModes: Array<'compact' | 'normal' | 'wide'> = ['compact', 'normal', 'wide'];
  const separateControlPanel = !!state.settings.separateControlPanel;

  return {
    title: t.title,
    secAudio: t.sec_audio,
    secVisual: t.sec_visual,
    secControls: t.sec_controls || 'CONTROLES Y EXPLORACIÓN',
    masterVolume: state.settings.masterVolume ?? 0.8,
    sfxVolume: state.settings.sfxVolume ?? 0.9,
    bgmVolume: state.settings.bgmVolume ?? 0.6,
    outfitStyle,
    outfitStyleLabel: outfitStyle === 'atrevido' ? t.outfit_bold : t.outfit_classic,
    outfitOptions: [t.outfit_classic, t.outfit_bold],
    outfitSelectedIndex: outfitStyle === 'atrevido' ? 1 : 0,
    bustAnimation: bustMode,
    bustOptions: [t.bust_off, t.bust_subtle, t.bust_normal],
    bustSelectedIndex: Math.max(0, bustModes.indexOf(bustMode)),
    runMode,
    runModeOptions: [t.run_hold || 'MANTENER B', t.run_toggle || 'ALTERNAR'],
    runModeSelectedIndex: runMode === 'toggle' ? 1 : 0,
    showCameraButton,
    cameraBtnOptions: [t.toggle_on || 'ACTIVADO', t.toggle_off || 'DESACTIVADO'],
    cameraBtnSelectedIndex: showCameraButton ? 0 : 1,
    showObjectiveHint,
    objectiveHintOptions: [t.toggle_on || 'ACTIVADO', t.toggle_off || 'DESACTIVADO'],
    objectiveHintSelectedIndex: showObjectiveHint ? 0 : 1,
    touchScale,
    touchPosition: touchPos,
    touchPosOptions: [t.pos_compact || 'COMPACTA', t.pos_normal || 'NORMAL', t.pos_wide || 'AMPLIA'],
    touchPosSelectedIndex: Math.max(0, touchPosModes.indexOf(touchPos)),
    separateControlPanel,
    separatePanelOptions: [t.toggle_off || 'SUPERPUESTO', t.toggle_on || 'FRANJA INFERIOR'],
    separatePanelSelectedIndex: separateControlPanel ? 1 : 0,
    descriptionText: outfitStyle === 'atrevido' ? t.desc_bold : t.desc_classic,
    disclaimerText: t.disclaimer,
    btnSave: t.btn_save,
    btnCancel: t.btn_cancel,
  };
}

export interface SaveSlotItemVM {
  id: number;
  exists: boolean;
  title: string;
  subtitle: string;
  valueText: string;
  money: number;
  playtime: string;
  seals: number;
}

export interface SaveSlotsVM {
  title: string;
  slots: SaveSlotItemVM[];
  btnLoad: string;
  btnSave: string;
  btnNew: string;
  btnBack: string;
}

export function buildSaveSlotsVM(summaries: SaveSlotSummary[]): SaveSlotsVM {
  const t = (esText as any).terms.group_a.slots;
  const slots: SaveSlotItemVM[] = summaries.map((s) => {
    if (s.exists) {
      return {
        id: s.id,
        exists: true,
        title: `${t.slot_prefix} ${s.id} — ${s.playerName || ''}`,
        subtitle: `${esText.menu.playtime}: ${s.playtimeFormatted || '00:00'} • ${esText.menu.badges}: ${s.badgesCount ?? 0}`,
        valueText: `${s.money ?? 0}`,
        money: s.money ?? 0,
        playtime: s.playtimeFormatted || '00:00',
        seals: s.badgesCount ?? 0,
      };
    }
    return {
      id: s.id,
      exists: false,
      title: `${t.slot_prefix} ${s.id} — ${t.empty_title}`,
      subtitle: t.empty_sub,
      valueText: '—',
      money: 0,
      playtime: '00:00',
      seals: 0,
    };
  });

  return {
    title: t.title,
    slots,
    btnLoad: t.btn_load,
    btnSave: t.btn_save,
    btnNew: t.btn_new,
    btnBack: t.btn_back,
  };
}

// ============================================================================
// 2. PARTY (EQUIPO) VIEW-MODEL
// ============================================================================
export interface PartyMemberVM {
  index: number;
  uid: string;
  name: string;
  speciesName: string;
  level: number;
  element: string;
  hpCur: number;
  hpMax: number;
  hpRatio: number;
  isLead: boolean;
  isKO: boolean;
  isSealed: boolean;
  chassisName: string;
  tier: number;
  parts: {
    head: { cur: number; max: number };
    torso: { cur: number; max: number };
    arms: { cur: number; max: number };
    legs: { cur: number; max: number };
  };
}

export interface PartyScreenVM {
  title: string;
  secActive: string;
  secActions: string;
  money: number;
  members: PartyMemberVM[];
  emptyText: string;
  btnSheet: string;
  btnLead: string;
  btnHeal: string;
  btnBack: string;
}

export function buildPartyVM(state: GameState): PartyScreenVM {
  const t = (esText as any).terms.group_a.party;
  const party = state.party || [];

  const members: PartyMemberVM[] = party.map((doll: Souldoll, index: number) => {
    StatCalculator.ensurePartHp(doll);
    const sp = CREATURES_DATA[doll.speciesId] || CREATURES_DATA.maga;
    const stats = StatCalculator.calculateStats(doll);
    const hpMax = Math.max(1, doll.maxHp || stats.hp);
    const hpCur = Math.max(0, Math.min(hpMax, doll.currentHp ?? hpMax));
    const isSealed = doll.bodyInstanceId === null;
    const partCur = doll.partHP || (doll as any).parts || { head: 1, torso: 1, arms: 1, legs: 1 };
    const partMax = doll.maxPartHP || {
      head: Math.max(1, Math.round(hpMax * 0.2)),
      torso: Math.max(1, Math.round(hpMax * 0.4)),
      arms: Math.max(1, Math.round(hpMax * 0.2)),
      legs: Math.max(1, Math.round(hpMax * 0.2)),
    };
    const isKO = hpCur <= 0 || partCur.head <= 0 || partCur.torso <= 0;

    const bodyInst = doll.bodyInstanceId
      ? state.bodies?.[doll.bodyInstanceId] ||
        ((state as any).bodiesStorage || []).find((b: any) => b.uid === doll.bodyInstanceId || b.instanceId === doll.bodyInstanceId)
      : null;
    const chassis = bodyInst ? BODY_CHASSIS_DATA[bodyInst.chassisId] : BODY_CHASSIS_DATA.chassis_madera_t1;

    return {
      index,
      uid: doll.uid,
      name: doll.nickname || sp.name,
      speciesName: sp.name,
      level: doll.level,
      element: sp.types[0] || 'neutro',
      hpCur,
      hpMax,
      hpRatio: hpCur / hpMax,
      isLead: index === 0,
      isKO,
      isSealed,
      chassisName: isSealed ? esText.terms.sheet.sealed_soul : chassis?.name || 'Cuerpo',
      tier: isSealed ? 0 : chassis?.tier || 1,
      parts: {
        head: { cur: partCur.head, max: Math.max(1, partMax.head) },
        torso: { cur: partCur.torso, max: Math.max(1, partMax.torso) },
        arms: { cur: partCur.arms, max: Math.max(1, partMax.arms) },
        legs: { cur: partCur.legs, max: Math.max(1, partMax.legs) },
      },
    };
  });

  return {
    title: t.title,
    secActive: t.sec_active,
    secActions: t.sec_actions,
    money: state.player?.money || 0,
    members,
    emptyText: t.empty,
    btnSheet: t.btn_sheet,
    btnLead: t.btn_lead,
    btnHeal: t.btn_heal,
    btnBack: t.btn_back,
  };
}

// ============================================================================
// 3. BAG (MOCHILA) VIEW-MODEL
// ============================================================================
export type BagTabId = 'consumables' | 'bottles' | 'equipment' | 'crystals';

export interface BagItemEntryVM {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
  description: string;
  iconId: KitIconId;
  rarity: 'comun' | 'poco_comun' | 'rara' | 'epica' | 'legendaria';
  canUseInField: boolean;
}

export interface BagScreenVM {
  title: string;
  money: number;
  tabs: Array<{ id: BagTabId; label: string; iconId: KitIconId }>;
  items: BagItemEntryVM[];
  emptyText: string;
  secList: string;
  secDetail: string;
  btnUse: string;
  btnBack: string;
}

export function buildBagVM(state: GameState, activeTab: BagTabId): BagScreenVM {
  const t = (esText as any).terms.group_a.bag;
  const inv = state.inventory || {};

  const tabs: Array<{ id: BagTabId; label: string; iconId: KitIconId }> = [
    { id: 'consumables', label: t.tab_consumables, iconId: 'elixir' },
    { id: 'bottles', label: t.tab_bottles, iconId: 'bottle' },
    { id: 'equipment', label: t.tab_equipment, iconId: 'sword' },
    { id: 'crystals', label: t.tab_crystals, iconId: 'crystal' },
  ];

  const items: BagItemEntryVM[] = [];
  Object.entries(inv).forEach(([itemId, count]) => {
    const qty = Number(count || 0);
    if (qty <= 0) return;
    const def = ITEMS_DATA[itemId];
    if (!def) return;

    const cat = def.category;
    const matchesTab =
      (activeTab === 'consumables' &&
        (cat === 'elixir' ||
          cat === 'purge' ||
          cat === 'reincarnation' ||
          cat === 'repair_kit' ||
          cat === 'scroll')) ||
      (activeTab === 'bottles' && cat === 'bottle') ||
      (activeTab === 'equipment' && (cat === 'weapon' || cat === 'relic')) ||
      (activeTab === 'crystals' &&
        (cat === 'crystal' || cat === 'resonance_core' || cat === 'fragment' || cat === 'general'));

    if (!matchesTab) return;

    let iconId: KitIconId = 'elixir';
    if (cat === 'bottle') iconId = 'bottle';
    else if (cat === 'weapon') iconId = 'sword';
    else if (cat === 'relic') iconId = 'relic';
    else if (cat === 'crystal' || cat === 'resonance_core') iconId = 'crystal';
    else if (cat === 'repair_kit') iconId = 'repair_kit';
    else if (cat === 'scroll') iconId = 'quest_scroll';
    else if (cat === 'fragment') iconId = 'soul_fragment';
    else if (def.id === 'ki_dust') iconId = 'ki_dust';

    let rarity: BagItemEntryVM['rarity'] = 'comun';
    if (def.price >= 10000) rarity = 'legendaria';
    else if (def.price >= 3000) rarity = 'epica';
    else if (def.price >= 1200) rarity = 'rara';
    else if (def.price >= 500) rarity = 'poco_comun';

    const canUseInField =
      cat === 'elixir' ||
      cat === 'purge' ||
      cat === 'reincarnation' ||
      cat === 'repair_kit' ||
      cat === 'weapon' ||
      cat === 'relic' ||
      cat === 'scroll' ||
      cat === 'fragment';

    items.push({
      id: def.id,
      name: def.name,
      category: cat,
      quantity: qty,
      price: def.price,
      description: def.description,
      iconId,
      rarity,
      canUseInField,
    });
  });

  return {
    title: t.title,
    money: state.player?.money || 0,
    tabs,
    items,
    emptyText: t.empty,
    secList: t.sec_list,
    secDetail: t.sec_detail,
    btnUse: t.btn_use,
    btnBack: t.btn_back,
  };
}

// ============================================================================
// 4. CODEX (CÓDICE DE ALMAS Y CUERPOS) VIEW-MODEL
// ============================================================================
export interface CodexSoulEntryVM {
  id: string;
  dexNumber: number;
  numFormatted: string;
  name: string;
  status: PokedexStatus;
  statusLabel: string;
  element: string;
  habitat: string;
  description: string;
  bst: number;
  syncValue: number;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
  lore50: string | null;
  lore150: string | null;
}

export interface CodexBodyEntryVM {
  id: string;
  name: string;
  material: string;
  tier: number;
  price: number;
  description: string;
  partShare: { head: number; torso: number; arms: number; legs: number };
  slotsText: string;
}

export interface CodexScreenVM {
  title: string;
  activeTab: 'souls' | 'bodies';
  filter: 'all' | 'caught' | 'seen' | 'unknown';
  souls: CodexSoulEntryVM[];
  bodies: CodexBodyEntryVM[];
  caughtCount: number;
  totalCount: number;
}

export function buildCodexVM(
  state: GameState,
  activeTab: 'souls' | 'bodies',
  filter: 'all' | 'caught' | 'seen' | 'unknown'
): CodexScreenVM {
  const t = (esText as any).terms.group_a.codex;
  const allCreatures = Object.values(CREATURES_DATA).sort((a, b) => a.dexNumber - b.dexNumber);
  let caughtCount = 0;

  const allOwned = [...(state.party || []), ...(state.storage || [])];

  const souls: CodexSoulEntryVM[] = [];
  allCreatures.forEach((c) => {
    const status = PokedexSystem.getStatus(c.id);
    if (status === 'caught') caughtCount++;

    if (filter === 'caught' && status !== 'caught') return;
    if (filter === 'seen' && status !== 'seen') return;
    if (filter === 'unknown' && status !== 'unknown') return;

    const owned = allOwned.find((s) => s.speciesId === c.id);
    const syncVal = owned ? (owned.sync ?? owned.friendship ?? 0) : 0;
    const bst =
      c.baseStats.hp +
      c.baseStats.atk +
      c.baseStats.def +
      c.baseStats.spAtk +
      c.baseStats.spDef +
      c.baseStats.speed;

    souls.push({
      id: c.id,
      dexNumber: c.dexNumber,
      numFormatted: `#${String(c.dexNumber).padStart(3, '0')}`,
      name: status === 'unknown' ? t.unknown_name : c.name,
      status,
      statusLabel:
        status === 'caught'
          ? t.status_caught
          : status === 'seen'
          ? t.status_seen
          : t.status_unknown,
      element: c.types[0] || 'neutro',
      habitat: (c.habitatMapIds || ['Ruta del Claro']).join(', '),
      description: status === 'unknown' ? t.unknown_desc : c.description,
      bst,
      syncValue: syncVal,
      baseStats: c.baseStats,
      lore50: status !== 'unknown' && syncVal >= 50 ? t.lore_50 : null,
      lore150: status !== 'unknown' && syncVal >= 150 ? t.lore_150 : null,
    });
  });

  const bodies: CodexBodyEntryVM[] = Object.values(BODY_CHASSIS_DATA).map((ch) => {
    const availSlots = Object.entries(ch.slots)
      .filter(([_, ok]) => ok)
      .map(([k]) =>
        k === 'weapon'
          ? esText.terms.sheet.slot_weapon
          : k === 'relic'
          ? esText.terms.sheet.slot_relic
          : esText.terms.sheet.slot_accessory
      );
    return {
      id: ch.id,
      name: ch.name,
      material: ch.material.toUpperCase(),
      tier: ch.tier,
      price: ch.price,
      description: ch.description,
      partShare: {
        head: Math.round(ch.partShare.head * 100),
        torso: Math.round(ch.partShare.torso * 100),
        arms: Math.round(ch.partShare.arms * 100),
        legs: Math.round(ch.partShare.legs * 100),
      },
      slotsText: availSlots.join(' • '),
    };
  });

  return {
    title: t.title,
    activeTab,
    filter,
    souls,
    bodies,
    caughtCount,
    totalCount: allCreatures.length,
  };
}

// ============================================================================
// 5. QUEST LOG (MISIONES) VIEW-MODEL
// ============================================================================
export interface QuestEntryVM {
  id: string;
  title: string;
  categoryLabel: string;
  isMain: boolean;
  status: string;
  statusLabel: string;
  summary: string;
  description: string;
  objectives: Array<{
    id: string;
    description: string;
    current: number;
    required: number;
    isDone: boolean;
  }>;
  rewardMoney: number;
  rewardItems: Array<{ itemId: string; name: string; count: number }>;
  rewardMessage: string;
}

export interface QuestLogVM {
  title: string;
  secList: string;
  secDetail: string;
  emptyText: string;
  quests: QuestEntryVM[];
  btnBack: string;
}

export function buildQuestLogVM(
  questsWithState: Array<{ data: QuestData; state: QuestProgressState }>
): QuestLogVM {
  const t = (esText as any).terms.group_a.quests;

  const quests: QuestEntryVM[] = questsWithState.map(({ data, state }) => {
    let statusLabel = t.status_locked;
    if (state.status === 'active') statusLabel = t.status_active;
    else if (state.status === 'completable') statusLabel = t.status_completable;
    else if (state.status === 'completed') statusLabel = t.status_completed;
    else if (state.status === 'available') statusLabel = t.status_available;

    const objectives = data.objectives.map((obj) => {
      const current = state.objectiveProgress[obj.id] || 0;
      return {
        id: obj.id,
        description: obj.description,
        current,
        required: obj.requiredCount,
        isDone: current >= obj.requiredCount,
      };
    });

    const rewardItems = (data.rewards.items || []).map((ri) => ({
      itemId: ri.itemId,
      name: ITEMS_DATA[ri.itemId]?.name || ri.itemId,
      count: ri.count,
    }));

    return {
      id: data.id,
      title: data.title,
      categoryLabel: data.category === 'main' ? t.cat_main : t.cat_side,
      isMain: data.category === 'main',
      status: state.status,
      statusLabel,
      summary: data.summary,
      description: data.description,
      objectives,
      rewardMoney: data.rewards.money || 0,
      rewardItems,
      rewardMessage: data.rewards.message || '',
    };
  });

  return {
    title: t.title,
    secList: t.sec_list,
    secDetail: t.sec_detail,
    emptyText: t.empty,
    quests,
    btnBack: t.btn_back,
  };
}

// ============================================================================
// 6. CREDITS / END OF DEMO VIEW-MODEL
// ============================================================================
export interface CreditsVM {
  title: string;
  bannerTitle: string;
  bannerSub: string;
  secStats: string;
  caughtCount: number;
  totalSpecies: number;
  codexPct: number;
  partyCount: number;
  money: number;
  hasSeal: boolean;
  sealText: string;
  loreClosing: string;
  btnContinue: string;
  btnTitle: string;
}

export function buildCreditsVM(state: GameState): CreditsVM {
  const t = (esText as any).terms.group_a.credits;
  const codex = (state as any).soulCodex || state.pokedex || {};
  const caughtCount = Object.keys(codex).filter((id) => codex[id]?.caught).length;
  const totalSpecies = Object.keys(CREATURES_DATA).length;
  const codexPct = Math.round((caughtCount / Math.max(1, totalSpecies)) * 100);
  const hasSeal = Boolean(state.keyItems?.includes('sello_eco'));

  return {
    title: t.title,
    bannerTitle: t.banner_title,
    bannerSub: t.banner_sub,
    secStats: t.sec_stats,
    caughtCount,
    totalSpecies,
    codexPct,
    partyCount: (state.party || []).length,
    money: state.player?.money || 0,
    hasSeal,
    sealText: hasSeal ? t.seal_yes : t.seal_no,
    loreClosing: t.lore_closing,
    btnContinue: t.btn_continue,
    btnTitle: t.btn_title,
  };
}
