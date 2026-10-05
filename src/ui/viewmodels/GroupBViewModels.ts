import { GameState } from '../../types';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { ITEMS_DATA } from '../../data/items/items';
import { BodyInstance, BodyPart } from '../../types/bodies';
import { StatCalculator } from '../../systems/battle/StatCalculator';
import { KitIconId } from '../kit/icons/IconRegistry';
import esText from '../../data/text/es.json';

export type WorkshopTabId = 'heal' | 'repair' | 'purge' | 'upgrade' | 'bind' | 'unbind';

export interface WorkshopPartyMemberVM {
  index: number;
  uid: string;
  name: string;
  speciesName: string;
  level: number;
  hpCur: number;
  hpMax: number;
  status: string | null;
  hasBody: boolean;
  chassisName: string;
  tier: number;
  durability: number;
  maxDurability: number;
  repairCostGold: number;
  needsRepair: boolean;
  parts: Record<BodyPart, { cur: number; max: number; ev: number }>;
  totalEv: number;
  maxTotalEv: number;
  canUpgradeTier: boolean;
  nextTierCostGold: number;
  nextTierCostFragments: number;
}

export interface WorkshopVM {
  money: number;
  soulFragments: number;
  kiDust: number;
  sealedSoulsCount: number;
  freeBodiesCount: number;
  party: WorkshopPartyMemberVM[];
}

export function resolveDollBody(state: GameState, bodyInstanceId: string | null): BodyInstance | null {
  if (!bodyInstanceId) return null;
  if (state.bodies && state.bodies[bodyInstanceId]) {
    return state.bodies[bodyInstanceId];
  }
  return null;
}

export function buildWorkshopVM(state: GameState): WorkshopVM {
  const party = state.party || [];
  const partyVMs: WorkshopPartyMemberVM[] = party.map((sd, index) => {
    const sp = CREATURES_DATA[sd.speciesId];
    const hasBody = Boolean(sd.bodyInstanceId);
    const bodyInst = resolveDollBody(state, sd.bodyInstanceId);
    const chId = bodyInst?.chassisId || 'chassis_madera_t1';
    const ch = hasBody ? BODY_CHASSIS_DATA[chId] || BODY_CHASSIS_DATA['chassis_madera_t1'] : null;

    const pDur = bodyInst?.partDurability || { head: 100, torso: 100, arms: 100, legs: 100 };
    const dur = Math.round((pDur.head + pDur.torso + pDur.arms + pDur.legs) / 4);
    const maxDur = 100;

    const pCur = sd.partHP || { head: 20, torso: 30, arms: 20, legs: 20 };
    const pMax = sd.maxPartHP || { head: 20, torso: 30, arms: 20, legs: 20 };
    const pEv = bodyInst?.evs || { head: 0, torso: 0, arms: 0, legs: 0 };

    const anyPartDamaged =
      pCur.head < pMax.head ||
      pCur.torso < pMax.torso ||
      pCur.arms < pMax.arms ||
      pCur.legs < pMax.legs ||
      dur < maxDur;

    const repairCost = anyPartDamaged ? Math.max(25, (100 - dur) * 4 + (sd.maxHp - sd.currentHp) * 2) : 0;
    const totalEv = pEv.head + pEv.torso + pEv.arms + pEv.legs;
    const tier = ch?.tier || 1;
    const nextTierCostGold = tier * 600;
    const nextTierCostFragments = tier * 2;

    return {
      index,
      uid: sd.uid,
      name: sd.nickname || sp?.name || sd.speciesId,
      speciesName: sp?.name || sd.speciesId,
      level: sd.level,
      hpCur: sd.currentHp,
      hpMax: sd.maxHp,
      status: sd.status,
      hasBody,
      chassisName: ch?.name || (esText as any).terms.sheet.no_body,
      tier,
      durability: dur,
      maxDurability: maxDur,
      repairCostGold: repairCost,
      needsRepair: anyPartDamaged,
      parts: {
        head: { cur: pCur.head, max: pMax.head, ev: pEv.head },
        torso: { cur: pCur.torso, max: pMax.torso, ev: pEv.torso },
        arms: { cur: pCur.arms, max: pMax.arms, ev: pEv.arms },
        legs: { cur: pCur.legs, max: pMax.legs, ev: pEv.legs },
      },
      totalEv,
      maxTotalEv: 256,
      canUpgradeTier: hasBody && tier < 5,
      nextTierCostGold,
      nextTierCostFragments,
    };
  });

  const allStorage = state.storage || [];
  const sealedSoulsCount = allStorage.filter((s) => !s.bodyInstanceId).length;
  const usedBodyIds = new Set(
    [...party, ...allStorage].map((s) => s.bodyInstanceId).filter(Boolean) as string[]
  );
  const freeBodiesCount = Object.keys(state.bodies || {}).filter((id) => !usedBodyIds.has(id)).length;

  return {
    money: state.player?.money || 0,
    soulFragments: Number(
      state.inventory?.['soul_fragment'] ??
        state.vars?.soulFragments ??
        state.inventory?.['fragmento_alma'] ??
        0
    ),
    kiDust: Number(
      state.kiDust ??
        state.inventory?.['ki_dust'] ??
        state.vars?.kiDust ??
        state.inventory?.['polvo_ki'] ??
        0
    ),
    sealedSoulsCount,
    freeBodiesCount,
    party: partyVMs,
  };
}

export type ShopCategoryFilter = 'all' | 'bodies' | 'weapons' | 'crystals' | 'souls';

export interface ShopCatalogItemVM {
  id: string;
  isChassis: boolean;
  chassisId?: string;
  name: string;
  subtitle: string;
  description: string;
  iconId: KitIconId;
  unitPrice: number;
  ownedQty: number;
  affordable: boolean;
  partShare?: { head: number; torso: number; arms: number; legs: number };
}

export function buildShopCatalogVM(
  state: GameState,
  mode: 'buy' | 'sell',
  category: ShopCategoryFilter
): ShopCatalogItemVM[] {
  const money = state.player?.money || 0;
  const inv = state.inventory || {};
  const bodiesMap = state.bodies || {};
  const items: ShopCatalogItemVM[] = [];

  if (mode === 'buy') {
    if (category === 'all' || category === 'bodies') {
      for (const ch of Object.values(BODY_CHASSIS_DATA)) {
        const ownedBodies = Object.values(bodiesMap).filter((b) => b.chassisId === ch.id).length;
        items.push({
          id: `buy_body_${ch.id}`,
          isChassis: true,
          chassisId: ch.id,
          name: ch.name,
          subtitle: `${ch.material.toUpperCase()} · Tier ${ch.tier}`,
          description: ch.description,
          iconId: 'body_chassis',
          unitPrice: ch.price,
          ownedQty: ownedBodies,
          affordable: money >= ch.price,
          partShare: ch.partShare,
        });
      }
    }

    const allItemIds = Object.keys(ITEMS_DATA);
    for (const id of allItemIds) {
      const it = ITEMS_DATA[id];
      if (!it || it.price <= 0) continue;
      if (category === 'bodies') continue;
      const cat = it.category as string;
      const isEquip = cat === 'relic' || cat === 'weapon' || cat === 'equipment';
      const isMedicine =
        cat === 'elixir' ||
        cat === 'purge' ||
        cat === 'reincarnation' ||
        cat === 'crystal' ||
        cat === 'repair_kit' ||
        cat === 'potion' ||
        cat === 'status_heal' ||
        cat === 'mana_crystal' ||
        cat === 'medicine';
      const isCapture = cat === 'bottle' || cat === 'capture';

      if (category === 'weapons' && !isEquip) continue;
      if (category === 'crystals' && !isMedicine) continue;
      if (category === 'souls' && !isCapture) continue;

      let iconId: KitIconId = 'bag';
      if (isCapture) iconId = 'soul_bottle';
      else if (isMedicine) iconId = 'potion';
      else if (isEquip) iconId = cat === 'weapon' ? 'weapon' : 'relic';

      items.push({
        id: it.id,
        isChassis: false,
        name: it.name,
        subtitle: `${it.price} Oro`,
        description: it.description,
        iconId,
        unitPrice: it.price,
        ownedQty: inv[it.id] || 0,
        affordable: money >= it.price,
      });
    }
  } else {
    for (const [itemId, qty] of Object.entries(inv)) {
      if (qty <= 0) continue;
      const it = ITEMS_DATA[itemId];
      if (!it || it.category === 'key' || it.price <= 0) continue;
      const sellPrice = Math.max(1, Math.floor(it.price / 2));
      const cat = it.category as string;
      items.push({
        id: itemId,
        isChassis: false,
        name: it.name,
        subtitle: `x${qty} · Venta: ${sellPrice} Oro`,
        description: it.description,
        iconId: cat === 'bottle' ? 'soul_bottle' : cat === 'elixir' || cat === 'potion' ? 'potion' : 'weapon',
        unitPrice: sellPrice,
        ownedQty: qty,
        affordable: true,
      });
    }
  }

  return items;
}

export type StorageTabId = 'party' | 'box' | 'souls' | 'bodies';

export interface StorageEntryVM {
  index: number;
  id: string;
  title: string;
  subtitle: string;
  valueText: string;
  iconId: KitIconId;
  speciesId?: string;
  chassisId?: string;
  detailLines: string[];
}

export function buildStorageVM(state: GameState, tab: StorageTabId): StorageEntryVM[] {
  const bodiesMap = state.bodies || {};
  const storageList = state.storage || [];

  if (tab === 'party') {
    return (state.party || []).map((sd, idx) => {
      const sp = CREATURES_DATA[sd.speciesId];
      const bInst = sd.bodyInstanceId ? bodiesMap[sd.bodyInstanceId] : null;
      const ch = bInst ? BODY_CHASSIS_DATA[bInst.chassisId] : sd.bodyInstanceId ? BODY_CHASSIS_DATA['chassis_madera_t1'] : null;
      return {
        index: idx,
        id: sd.uid,
        title: sd.nickname || sp?.name || sd.speciesId,
        subtitle: `${sp?.classId?.toUpperCase() || ''} · ${ch?.name || 'Sin cuerpo'}`,
        valueText: `Nv.${sd.level} · PS ${sd.currentHp}/${sd.maxHp}`,
        iconId: 'party',
        speciesId: sd.speciesId,
        detailLines: [
          `Especie: ${sp?.name || sd.speciesId} (${(sp?.types || []).join('/')})`,
          `Chasis: ${ch?.name || 'Alma sellada'} (Tier ${ch?.tier || 0})`,
          `Sincronía: ${sd.sync ?? sd.friendship ?? 70}/255`,
        ],
      };
    });
  }

  if (tab === 'box') {
    return storageList
      .filter((s) => Boolean(s.bodyInstanceId))
      .map((sd, idx) => {
        const sp = CREATURES_DATA[sd.speciesId];
        const bInst = sd.bodyInstanceId ? bodiesMap[sd.bodyInstanceId] : null;
        const ch = bInst ? BODY_CHASSIS_DATA[bInst.chassisId] : BODY_CHASSIS_DATA['chassis_madera_t1'];
        return {
          index: idx,
          id: sd.uid,
          title: sd.nickname || sp?.name || sd.speciesId,
          subtitle: `Reserva · ${ch?.name || 'Sin cuerpo'}`,
          valueText: `Nv.${sd.level}`,
          iconId: 'storage',
          speciesId: sd.speciesId,
          detailLines: [
            `Especie: ${sp?.name || sd.speciesId}`,
            `PS: ${sd.currentHp}/${sd.maxHp}`,
            `Chasis: ${ch?.name || 'Alma sellada'}`,
          ],
        };
      });
  }

  if (tab === 'souls') {
    return storageList
      .filter((s) => !s.bodyInstanceId)
      .map((soul, idx) => {
        const sp = CREATURES_DATA[soul.speciesId];
        return {
          index: idx,
          id: soul.uid,
          title: soul.nickname || sp?.name || soul.speciesId,
          subtitle: `Alma Sellada · ${sp?.classId?.toUpperCase() || ''}`,
          valueText: `Nv.${soul.level}`,
          iconId: 'soul_bottle',
          speciesId: soul.speciesId,
          detailLines: [
            `Alma en Soul Bottle (${sp?.name || soul.speciesId})`,
            `Requiere un Cuerpo Contenedor en el Taller para combatir.`,
            `Sincronía: ${soul.sync ?? 70}/255`,
          ],
        };
      });
  }

  const usedBodyIds = new Set(
    [...(state.party || []), ...storageList].map((s) => s.bodyInstanceId).filter(Boolean) as string[]
  );
  const freeBodies = Object.values(bodiesMap).filter((b) => !usedBodyIds.has(b.instanceId));

  return freeBodies.map((body, idx) => {
    const ch = BODY_CHASSIS_DATA[body.chassisId] || BODY_CHASSIS_DATA['chassis_madera_t1'];
    const avgIv = Math.round(
      (body.ivs.head + body.ivs.torso + body.ivs.arms + body.ivs.legs) / 4
    );
    const avgDur = Math.round(
      (body.partDurability.head + body.partDurability.torso + body.partDurability.arms + body.partDurability.legs) / 4
    );
    return {
      index: idx,
      id: body.instanceId,
      title: body.nickname || ch.name,
      subtitle: `${ch.material.toUpperCase()} · Tier ${ch.tier}`,
      valueText: `Dur ${avgDur}%`,
      iconId: 'body_chassis',
      chassisId: body.chassisId,
      detailLines: [
        ch.description,
        `Calidad media IV: ${avgIv}/31 · Durabilidad: ${avgDur}%`,
        `Reparto PS: C:${Math.round(ch.partShare.head * 100)}% T:${Math.round(ch.partShare.torso * 100)}% B:${Math.round(ch.partShare.arms * 100)}% P:${Math.round(ch.partShare.legs * 100)}%`,
      ],
    };
  });
}

export function getFreeBodiesList(state: GameState): BodyInstance[] {
  const bodiesMap = state.bodies || {};
  const storageList = state.storage || [];
  const usedBodyIds = new Set(
    [...(state.party || []), ...storageList].map((s) => s.bodyInstanceId).filter(Boolean) as string[]
  );
  return Object.values(bodiesMap).filter((b) => !usedBodyIds.has(b.instanceId));
}

export function getSealedSoulsList(state: GameState) {
  return (state.storage || []).filter((s) => !s.bodyInstanceId);
}

export interface BindingPreviewVM {
  hasSelection: boolean;
  soulName: string;
  soulSpeciesId: string;
  soulLevel: number;
  bodyName: string;
  bodyTier: number;
  isCompatible: boolean;
  hpMax: number;
  atk: number;
  def: number;
  spAtk: number;
  spDef: number;
  speed: number;
  partMaxHP: { head: number; torso: number; arms: number; legs: number };
}

export function buildBindingPreviewVM(
  state: GameState,
  soulIdx: number,
  bodyIdx: number
): BindingPreviewVM {
  const souls = getSealedSoulsList(state);
  const bodies = getFreeBodiesList(state);
  const soul = souls[soulIdx];
  const body = bodies[bodyIdx];
  if (!soul || !body) {
    return {
      hasSelection: false,
      soulName: '',
      soulSpeciesId: 'maga',
      soulLevel: 1,
      bodyName: '',
      bodyTier: 1,
      isCompatible: false,
      hpMax: 0,
      atk: 0,
      def: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      partMaxHP: { head: 20, torso: 30, arms: 20, legs: 20 },
    };
  }

  const sp = CREATURES_DATA[soul.speciesId];
  const ch = BODY_CHASSIS_DATA[body.chassisId] || BODY_CHASSIS_DATA['chassis_madera_t1'];
  const minTierReq = sp?.bodyRequirement?.minTier || 1;
  const isCompatible = ch.tier >= minTierReq;

  const partMaxHP = StatCalculator.calculatePartMaxHp(soul.stats.hp, ch.id, body.ivs, body.evs);
  const totalHp = partMaxHP.head + partMaxHP.torso + partMaxHP.arms + partMaxHP.legs;

  return {
    hasSelection: true,
    soulName: soul.nickname || sp?.name || soul.speciesId,
    soulSpeciesId: soul.speciesId,
    soulLevel: soul.level,
    bodyName: body.nickname || ch.name,
    bodyTier: ch.tier,
    isCompatible,
    hpMax: totalHp,
    atk: soul.stats.atk,
    def: soul.stats.def,
    spAtk: soul.stats.spAtk,
    spDef: soul.stats.spDef,
    speed: soul.stats.speed,
    partMaxHP,
  };
}
