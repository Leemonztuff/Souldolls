import { GameState, Souldoll, BodyPart, ElementType } from '../../types';
import { SOUL_SPECIES_DATA } from '../../data/souldolls/souls';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { MOVES_DATA } from '../../data/moves/moves';
import { ITEMS_DATA } from '../../data/items/items';
import { ABILITIES_DATA } from '../../data/abilities/abilities';
import { NATURES_DATA } from '../../types/natures';
import { ExpCalculator } from '../../systems/battle/ExpCalculator';
import { StatCalculator } from '../../systems/battle/StatCalculator';
import esText from '../../data/text/es.json';

export type SheetStatId = 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed';
export type SheetPartState = 'ok' | 'low' | 'broken';

export interface SheetHeaderVM {
  trainerName: string;
  playTime: string;
  guildSeals: number;
  money: number;
  soulFragments: number;
  kiDust: number;
}

export interface SheetIdentityVM {
  nickname: string;
  speciesName: string;
  dexNo: string;
  classId: string;
  className: string;
  element: ElementType;
  level: number;
  maxLevel: number;
  exp: number;
  expToNext: number;
  expProgressRatio: number;
  stars: number; // = tier del cuerpo, 0 si es Alma sellada
  isKO: boolean;
  isSealed: boolean;
}

export interface SheetStatItemVM {
  id: SheetStatId;
  label: string;
  value: number;
  baseValue: number;
  bonusFromIV: number;
  bonusFromEV: number;
  modifier: number; // e.g. 1.0, 1.1, 0.9, or 0.5 when arms/legs broken
  penaltyNote?: string;
}

export interface SheetAbilityVM {
  name: string;
  description: string;
}

export interface SheetPartEntryVM {
  cur: number;
  max: number;
  state: SheetPartState;
}

export interface SheetPartsVM {
  head: SheetPartEntryVM;
  torso: SheetPartEntryVM;
  arms: SheetPartEntryVM;
  legs: SheetPartEntryVM;
}

export interface SheetBodyVM {
  chassisName: string;
  material: string;
  materialRaw: string;
  tier: number;
  ivStars: number; // 0-5
  durabilityPct: number;
  hasBody: boolean;
}

export interface SheetMoveItemVM {
  moveId: string;
  name: string;
  type: ElementType;
  category: string;
  power: number;
  accuracy: number;
  pp: number;
  ppMax: number;
  likelyParts: BodyPart[];
  likelyPartsLabels: string[];
  tags: string[];
  description: string;
  blockedReason?: string;
}

export interface SheetEquipSlotVM {
  slotKey: 'weapon' | 'relic' | 'accessory';
  slotLabel: string;
  itemId: string | null;
  name: string;
  icon: string;
  iconColor: string;
  effectSummary: string;
}

export interface SheetEquipmentVM {
  weapon: SheetEquipSlotVM;
  relic: SheetEquipSlotVM;
  accessory: SheetEquipSlotVM;
}

export interface SheetSyncVM {
  value: number;
  max: number;
  hearts: number; // 0-5
}

export interface SheetAscensionVM {
  known: boolean;
  targetName?: string;
  level?: number;
  minTier?: number;
  itemName?: string;
  bodyOk?: boolean;
  levelOk?: boolean;
  hint: string;
}

export interface SheetNavVM {
  index: number;
  total: number;
}

export interface SoulDollSheetVM {
  uid: string;
  speciesId: string;
  header: SheetHeaderVM;
  identity: SheetIdentityVM;
  stats: SheetStatItemVM[];
  ability: SheetAbilityVM | null;
  parts: SheetPartsVM;
  body: SheetBodyVM;
  moves: SheetMoveItemVM[];
  equipment: SheetEquipmentVM;
  sync: SheetSyncVM;
  ascension: SheetAscensionVM;
  nav: SheetNavVM;
}

const CLASS_DISPLAY_NAMES: Record<string, string> = {
  maga: 'Maga',
  archimaga: 'Archimaga',
  sacerdotisa: 'Sacerdotisa',
  hierofante: 'Hierofante',
  paladin: 'Paladín',
  templario: 'Templario',
  gladiadora: 'Gladiadora',
  titanide: 'Titánide',
  bruja: 'Bruja',
  hechicera: 'Hechicera',
  hidromante: 'Hidromante',
  cantora_marea: 'Cantora de Marea',
  monje: 'Monje',
  maestro_trueno: 'Maestro del Trueno',
  asesina: 'Asesina',
  espectro: 'Espectro',
};

const MATERIAL_DISPLAY_NAMES: Record<string, string> = {
  madera: 'Madera Espiritual',
  hierro: 'Hierro Forjado',
  piedra: 'Piedra Rúnica',
  cristal: 'Cristal de Maná',
  arcano: 'Aleación Arcana',
};

function formatPlayTime(seconds: number): string {
  const totalSec = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const padH = String(hrs).padStart(2, '0');
  const padM = String(mins).padStart(2, '0');
  return `${padH}:${padM}`;
}

function computePartState(cur: number, max: number, hasBody: boolean): SheetPartState {
  if (!hasBody || max <= 0 || cur <= 0) return 'broken';
  const ratio = cur / max;
  if (ratio < 0.45) return 'low';
  return 'ok';
}

function summarizeItemEffect(itemId: string | null): { name: string; icon: string; iconColor: string; effectSummary: string } {
  const t = (esText as any).terms.sheet;
  if (!itemId || !ITEMS_DATA[itemId]) {
    return {
      name: t.empty_slot,
      icon: '—',
      iconColor: '#6E667A',
      effectSummary: t.empty_slot,
    };
  }
  const item = ITEMS_DATA[itemId];
  const eff = item.effect;
  let summary = item.description;
  if (eff.type === 'weapon_stat') {
    const parts: string[] = [];
    if (eff.atkBonus > 0) parts.push(`+${eff.atkBonus} ATQ`);
    if (eff.spAtkBonus > 0) parts.push(`+${eff.spAtkBonus} ATQ.E`);
    summary = parts.length > 0 ? parts.join(' / ') : item.description;
  } else if (eff.type === 'relic_passive') {
    summary = item.description;
  } else if (eff.type === 'mana_crystal') {
    summary = item.description;
  }

  let icon = '◆';
  if (item.category === 'weapon') icon = '⚔';
  else if (item.category === 'relic') icon = '❖';
  else if (item.category === 'crystal') icon = '◈';

  return {
    name: item.name,
    icon,
    iconColor: item.iconColor || '#D9A441',
    effectSummary: summary,
  };
}

/**
 * BLOQUE 40: View-Model puro para la Ficha de Souldoll (sin imports de Pixi/Three).
 * Extrae y transforma todos los datos desde GameState, tablas de /data y es.json.
 */
export function buildSheetVM(
  souldoll: Souldoll,
  gameState: GameState,
  rosterList?: Souldoll[]
): SoulDollSheetVM {
  const t = (esText as any).terms.sheet;
  const speciesId = souldoll.soulSpeciesId || souldoll.speciesId || 'maga';
  const species = SOUL_SPECIES_DATA[speciesId] || SOUL_SPECIES_DATA['maga'];

  // 1. Header
  const inv = gameState.inventory || {};
  const soulFragments =
    Number(inv['soul_fragment'] || inv['fragmento_alma'] || gameState.vars?.['soulFragments'] || 0) +
    Number(inv['soul_bottle_comun'] || 0);
  const kiDust =
    Number(inv['ki_dust'] || inv['polvo_ki'] || gameState.vars?.['kiDust'] || 0) +
    Number(inv['cristal_mana_vigor'] || 0) +
    Number(inv['cristal_mana_eter'] || 0);

  const header: SheetHeaderVM = {
    trainerName: gameState.player?.name || 'Soultrainer',
    playTime: formatPlayTime(gameState.playtimeSeconds || 0),
    guildSeals: gameState.player?.badges?.length || 0,
    money: gameState.player?.money ?? 0,
    soulFragments,
    kiDust,
  };

  // 2. Body resolution
  const hasBody = Boolean(souldoll.bodyInstanceId);
  const bodyInst =
    souldoll.bodyInstanceId && gameState.bodies ? gameState.bodies[souldoll.bodyInstanceId] : undefined;
  let chassis = bodyInst ? BODY_CHASSIS_DATA[bodyInst.chassisId] : undefined;
  if (hasBody && !chassis && souldoll.bodyInstanceId) {
    const matchedKey = Object.keys(BODY_CHASSIS_DATA).find(
      (k) => souldoll.bodyInstanceId === k || souldoll.bodyInstanceId?.includes(k)
    );
    if (matchedKey) chassis = BODY_CHASSIS_DATA[matchedKey];
  }

  const bodyTier = hasBody ? (chassis?.tier ?? 1) : 0;
  let ivStars = 0;
  let durabilityPct = 0;

  if (hasBody) {
    if (bodyInst?.ivs) {
      const avgIv =
        (bodyInst.ivs.head + bodyInst.ivs.torso + bodyInst.ivs.arms + bodyInst.ivs.legs) / 4;
      ivStars = Math.max(1, Math.min(5, Math.round((avgIv / 31) * 5)));
    } else if (souldoll.ivs) {
      const avgIv =
        (souldoll.ivs.hp +
          souldoll.ivs.atk +
          souldoll.ivs.def +
          souldoll.ivs.spAtk +
          souldoll.ivs.spDef +
          souldoll.ivs.speed) /
        6;
      ivStars = Math.max(1, Math.min(5, Math.round((avgIv / 31) * 5)));
    } else {
      ivStars = Math.min(5, Math.max(1, bodyTier));
    }

    if (bodyInst?.partDurability) {
      const d = bodyInst.partDurability;
      durabilityPct = Math.round((d.head + d.torso + d.arms + d.legs) / 4);
    } else {
      const maxTot =
        (souldoll.maxPartHP?.head || 0) +
        (souldoll.maxPartHP?.torso || 0) +
        (souldoll.maxPartHP?.arms || 0) +
        (souldoll.maxPartHP?.legs || 0);
      const curTot =
        (souldoll.partHP?.head || 0) +
        (souldoll.partHP?.torso || 0) +
        (souldoll.partHP?.arms || 0) +
        (souldoll.partHP?.legs || 0);
      durabilityPct = maxTot > 0 ? Math.round((curTot / maxTot) * 100) : 100;
    }
  }

  const body: SheetBodyVM = {
    chassisName: hasBody ? chassis?.name || bodyInst?.nickname || 'Chasis Artífice' : t.sealed_soul,
    material: hasBody
      ? MATERIAL_DISPLAY_NAMES[chassis?.material || 'madera'] || chassis?.material || 'Madera'
      : '—',
    materialRaw: hasBody ? chassis?.material || 'madera' : 'none',
    tier: bodyTier,
    ivStars: hasBody ? ivStars : 0,
    durabilityPct: hasBody ? durabilityPct : 0,
    hasBody,
  };

  // 3. Parts
  const pCur = souldoll.partHP || { head: 0, torso: 0, arms: 0, legs: 0 };
  const pMax = souldoll.maxPartHP || { head: 1, torso: 1, arms: 1, legs: 1 };

  const parts: SheetPartsVM = {
    head: {
      cur: hasBody ? pCur.head : 0,
      max: hasBody ? pMax.head : 0,
      state: computePartState(pCur.head, pMax.head, hasBody),
    },
    torso: {
      cur: hasBody ? pCur.torso : 0,
      max: hasBody ? pMax.torso : 0,
      state: computePartState(pCur.torso, pMax.torso, hasBody),
    },
    arms: {
      cur: hasBody ? pCur.arms : 0,
      max: hasBody ? pMax.arms : 0,
      state: computePartState(pCur.arms, pMax.arms, hasBody),
    },
    legs: {
      cur: hasBody ? pCur.legs : 0,
      max: hasBody ? pMax.legs : 0,
      state: computePartState(pCur.legs, pMax.legs, hasBody),
    },
  };

  const isKO =
    !hasBody ||
    souldoll.currentHp <= 0 ||
    parts.head.cur <= 0 ||
    parts.torso.cur <= 0;

  // 4. Identity & EXP
  const maxLevel = 100;
  const level = Math.max(1, Math.min(maxLevel, souldoll.level || 1));
  const expGroup = species.expGroup || 'medium_fast';
  const baseLevelExp = ExpCalculator.getExpForLevel(level, expGroup);
  const nextLevelTotalExp =
    level >= maxLevel ? baseLevelExp : ExpCalculator.getExpForLevel(level + 1, expGroup);
  const rawExp = Math.max(baseLevelExp, souldoll.currentExp || baseLevelExp);
  const expIntoLevel = Math.max(0, rawExp - baseLevelExp);
  const expSpan = Math.max(1, nextLevelTotalExp - baseLevelExp);
  const expToNext = level >= maxLevel ? 0 : Math.max(0, nextLevelTotalExp - rawExp);
  const expProgressRatio = level >= maxLevel ? 1 : Math.max(0, Math.min(1, expIntoLevel / expSpan));

  const identity: SheetIdentityVM = {
    nickname: souldoll.nickname || species.name,
    speciesName: species.name,
    dexNo: `#${String(species.dexNumber || 1).padStart(3, '0')}`,
    classId: species.classId,
    className: CLASS_DISPLAY_NAMES[species.classId] || species.name,
    element: species.types[0] || 'Neutro',
    level,
    maxLevel,
    exp: rawExp,
    expToNext,
    expProgressRatio,
    stars: bodyTier,
    isKO,
    isSealed: !hasBody,
  };

  // 5. Six Stats (HP, ATK, DEF, SP.ATK, SP.DEF, SPEED) with IV/EV/Nature/Part breakdown
  const ivs = souldoll.ivs || { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, speed: 15 };
  const evs = souldoll.evs || { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };
  const natureMod = souldoll.nature ? NATURES_DATA[souldoll.nature] : undefined;

  const weaponItemId = souldoll.equipped?.weapon || species.weaponId || null;
  const weaponDef = weaponItemId ? ITEMS_DATA[weaponItemId] : null;
  const weaponAtkBonus =
    weaponDef?.effect.type === 'weapon_stat' ? weaponDef.effect.atkBonus : 0;
  const weaponSpAtkBonus =
    weaponDef?.effect.type === 'weapon_stat' ? weaponDef.effect.spAtkBonus : 0;

  const zeroIv = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };
  const zeroEv = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };
  const pureBaseStats = StatCalculator.calculateAllStats(species, level, zeroIv, zeroEv, 'docil');
  const withIvStats = StatCalculator.calculateAllStats(species, level, ivs, zeroEv, 'docil');
  const withIvEvStats = StatCalculator.calculateAllStats(species, level, ivs, evs, 'docil');
  const finalCalcStats = StatCalculator.calculateAllStats(species, level, ivs, evs, souldoll.nature);

  const armsBroken = hasBody && parts.arms.state === 'broken';
  const legsBroken = hasBody && parts.legs.state === 'broken';

  const makeStatItem = (
    id: SheetStatId,
    label: string,
    equipBonus = 0,
    partMultiplier = 1.0,
    penaltyNote?: string
  ): SheetStatItemVM => {
    const baseVal = pureBaseStats[id];
    const ivBonus = Math.max(0, withIvStats[id] - baseVal);
    const evBonus = Math.max(0, withIvEvStats[id] - withIvStats[id]);
    let natMult = 1.0;
    if (id !== 'hp' && natureMod) {
      if (natureMod.increasedStat === id) natMult = 1.1;
      if (natureMod.decreasedStat === id) natMult = 0.9;
    }
    const rawValue = (souldoll.stats?.[id] ?? finalCalcStats[id]) + equipBonus;
    const effectiveValue = Math.max(1, Math.floor(rawValue * partMultiplier));
    return {
      id,
      label,
      value: effectiveValue,
      baseValue: baseVal,
      bonusFromIV: ivBonus,
      bonusFromEV: evBonus,
      modifier: Number((natMult * partMultiplier).toFixed(2)),
      penaltyNote,
    };
  };

  const stats: SheetStatItemVM[] = [
    makeStatItem('hp', t.stat_hp),
    makeStatItem(
      'atk',
      t.stat_atk,
      armsBroken ? 0 : weaponAtkBonus,
      armsBroken ? 0.5 : 1.0,
      armsBroken ? '-50% (Brazos rotos)' : undefined
    ),
    makeStatItem('def', t.stat_def),
    makeStatItem('spAtk', t.stat_spAtk, weaponSpAtkBonus),
    makeStatItem('spDef', t.stat_spDef),
    makeStatItem(
      'speed',
      t.stat_speed,
      0,
      legsBroken ? 0.5 : 1.0,
      legsBroken ? '-50% (Piernas rotas)' : undefined
    ),
  ];

  // 6. Passive Ability
  const abilityId = souldoll.abilityId || species.abilityId || species.possibleAbilities?.[0];
  const abilityDef = abilityId ? ABILITIES_DATA[abilityId] : null;
  const ability: SheetAbilityVM | null = abilityDef
    ? { name: abilityDef.name, description: abilityDef.description }
    : null;

  // 7. Moves (up to 4)
  const partLabelMap: Record<BodyPart, string> = {
    head: t.part_head,
    torso: t.part_torso,
    arms: t.part_arms,
    legs: t.part_legs,
  };

  const moves: SheetMoveItemVM[] = (souldoll.moves || []).slice(0, 4).map((m) => {
    const def = MOVES_DATA[m.moveId];
    if (!def) {
      return {
        moveId: m.moveId,
        name: m.moveId,
        type: 'Neutro' as ElementType,
        category: 'physical',
        power: 0,
        accuracy: 100,
        pp: m.currentPp,
        ppMax: m.maxPp,
        likelyParts: ['torso'],
        likelyPartsLabels: [t.part_torso],
        tags: [],
        description: '',
      };
    }

    const pt = def.partTargeting || { head: 15, torso: 50, arms: 15, legs: 20 };
    const sortedParts = (['head', 'torso', 'arms', 'legs'] as BodyPart[])
      .filter((k) => (pt[k] || 0) >= 20)
      .sort((a, b) => (pt[b] || 0) - (pt[a] || 0));
    const likelyParts: BodyPart[] = sortedParts.length > 0 ? sortedParts.slice(0, 2) : ['torso'];

    const isWeaponMove = (def.tags || []).includes('weapon');
    const blockedReason =
      armsBroken && isWeaponMove ? t.move_blocked_arms : undefined;

    return {
      moveId: def.id,
      name: def.name,
      type: def.type,
      category: def.category,
      power: def.power,
      accuracy: def.accuracy,
      pp: m.currentPp,
      ppMax: m.maxPp,
      likelyParts,
      likelyPartsLabels: likelyParts.map((p) => partLabelMap[p]),
      tags: def.tags || [],
      description: def.description,
      blockedReason,
    };
  });

  // 8. Equipment (Weapon, Relic, Accessory)
  const weaponSlotId = souldoll.equipped?.weapon ?? species.weaponId ?? null;
  const relicSlotId = souldoll.equipped?.relic ?? souldoll.heldItemId ?? null;
  const accessorySlotId = souldoll.equipped?.accessory ?? null;

  const weaponSummary = summarizeItemEffect(weaponSlotId);
  const relicSummary = summarizeItemEffect(relicSlotId);
  const accessorySummary = summarizeItemEffect(accessorySlotId);

  const equipment: SheetEquipmentVM = {
    weapon: {
      slotKey: 'weapon',
      slotLabel: t.slot_weapon,
      itemId: weaponSlotId,
      ...weaponSummary,
    },
    relic: {
      slotKey: 'relic',
      slotLabel: t.slot_relic,
      itemId: relicSlotId,
      ...relicSummary,
    },
    accessory: {
      slotKey: 'accessory',
      slotLabel: t.slot_accessory,
      itemId: accessorySlotId,
      ...accessorySummary,
    },
  };

  // 9. Sync (Sincronía)
  const syncVal = Math.max(
    0,
    Math.min(255, souldoll.sync !== undefined ? souldoll.sync : souldoll.friendship ?? 70)
  );
  const syncMax = 255;
  const hearts = Math.max(0, Math.min(5, Math.round((syncVal / syncMax) * 5)));
  const sync: SheetSyncVM = {
    value: syncVal,
    max: syncMax,
    hearts,
  };

  // 10. Ascension
  let ascension: SheetAscensionVM;
  if (!species.evolution) {
    ascension = {
      known: false,
      hint: t.ascension_unknown,
    };
  } else {
    const evo = species.evolution;
    const targetSpec = SOUL_SPECIES_DATA[evo.toSpeciesId];
    const targetName = targetSpec?.name || evo.toSpeciesId;
    const minTier = evo.minBodyTier || targetSpec?.bodyRequirement?.minTier || 2;
    const reqLevel = evo.level || 16;
    const bodyOk = hasBody && bodyTier >= minTier;
    const levelOk = level >= reqLevel;
    const itemName = evo.item && ITEMS_DATA[evo.item] ? ITEMS_DATA[evo.item].name : t.ascension_core_req;

    let hint = t.ascension_ready;
    if (!hasBody) {
      hint = t.ascension_no_body.replace('{minTier}', String(minTier));
    } else if (!bodyOk) {
      hint = t.ascension_body_low.replace('{minTier}', String(minTier));
    }

    ascension = {
      known: true,
      targetName,
      level: reqLevel,
      minTier,
      itemName,
      bodyOk,
      levelOk,
      hint,
    };
  }

  // 11. Navigation
  const list = rosterList && rosterList.length > 0 ? rosterList : gameState.party || [souldoll];
  const foundIdx = list.findIndex((d) => d.uid === souldoll.uid);
  const nav: SheetNavVM = {
    index: foundIdx >= 0 ? foundIdx : 0,
    total: Math.max(1, list.length),
  };

  return {
    uid: souldoll.uid,
    speciesId,
    header,
    identity,
    stats,
    ability,
    parts,
    body,
    moves,
    equipment,
    sync,
    ascension,
    nav,
  };
}
