import { GameState } from '../../types';
import { SOUL_SPECIES_DATA } from '../../data/souldolls/souls';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { MOVES_DATA } from '../../data/moves/moves';
import { ABILITIES_DATA } from '../../data/abilities/abilities';
import { ITEMS_DATA } from '../../data/items/items';
import { StatCalculator } from '../../systems/battle/StatCalculator';
import defaultStartersJson from '../../data/starters.json';
import esText from '../../data/text/es.json';
import { SOULDOLLS_SPRITES_MANIFEST } from '../../data/assetsManifest';

export interface StarterMoveEntryVM {
  id: string;
  name: string;
  type: string;
}

export interface StarterSpriteFramesVM {
  sheetPath: string;
  atlasPath: string;
  front: string;
  front34: string;
  back: string;
  back34: string;
  bottle: string;
}

export interface StarterOptionVM {
  soulSpeciesId: string;
  name: string;
  element: string;
  roleText: string;
  roleIconId: 'sword' | 'heart' | 'compass';
  weaponId: string;
  weaponName: string;
  level: number;
  stats: {
    hp: number;
    atk: number;
    spAtk: number;
    primaryAtk: number;
    primaryAtkLabel: string;
    isSpAtk: boolean;
    speed: number;
  };
  abilityId: string;
  abilityName: string;
  abilityDescription: string;
  flavor: string;
  soulBottleFlavor: string;
  moves: StarterMoveEntryVM[];
  spriteFrames: StarterSpriteFramesVM;
}

export interface StarterRewardsVM {
  level: number;
  bodyId: string;
  bodyName: string;
  bottlesCount: number;
  elixirCount: number;
}

export interface StarterSelectVM {
  title: string;
  step: string;
  options: StarterOptionVM[];
  focusIndex: number;
  rewards: StarterRewardsVM;
}

export interface StartersConfigData {
  version?: string;
  level?: number;
  chassisId?: string;
  bodyIvs?: {
    head: number;
    torso: number;
    arms: number;
    legs: number;
  };
  rewards?: {
    bottlesItemId?: string;
    bottlesCount?: number;
    elixirItemId?: string;
    elixirCount?: number;
  };
  starters: Array<{
    soulSpeciesId: string;
    roleKey?: string;
    bottleFrame?: string;
    previewMoves?: string[];
  }>;
}

export interface BuildStarterVMOptions {
  focusIndex?: number;
  debugLongNames?: boolean;
  debugExtraStarters?: boolean;
}

/**
 * BLOQUE 46 (Req. 1): View-Model puro de la pantalla de elección del primer Souldoll.
 * Sin imports de Pixi, Three ni DOM.
 * Calcula los stats reales a Nv.5 con el Cuerpo de Madera T1 y las fórmulas de StatCalculator,
 * leyendo orden e ids de /data/starters.json, y textos/movimientos/arma de SoulSpecies y es.json.
 */
export function buildStarterVM(
  _gameState?: GameState | null,
  startersData: StartersConfigData = defaultStartersJson as StartersConfigData,
  opts: number | BuildStarterVMOptions = 0
): StarterSelectVM {
  const optionsObj: BuildStarterVMOptions =
    typeof opts === 'number' ? { focusIndex: opts } : opts || {};

  const t = (esText as any).terms.starter_select;
  const level = startersData.level ?? 5;
  const chassisId = startersData.chassisId || 'chassis_madera_t1';
  const chassis = BODY_CHASSIS_DATA[chassisId] || BODY_CHASSIS_DATA.chassis_madera_t1;
  const bodyIvs = startersData.bodyIvs || { head: 15, torso: 15, arms: 15, legs: 15 };

  const rawList = [...(startersData.starters || [])];
  if (optionsObj.debugExtraStarters) {
    rawList.push(
      {
        soulSpeciesId: 'gladiadora',
        roleKey: 'role_default',
        bottleFrame: 'starter_bottle_ember',
      },
      {
        soulSpeciesId: 'monje',
        roleKey: 'role_default',
        bottleFrame: 'starter_bottle_leaf',
      }
    );
  }

  const options: StarterOptionVM[] = rawList.map((entry) => {
    const speciesId = entry.soulSpeciesId;
    const species = SOUL_SPECIES_DATA[speciesId] || SOUL_SPECIES_DATA.maga;

    const balancedSoulIvs = {
      hp: bodyIvs.head,
      atk: bodyIvs.arms,
      def: bodyIvs.torso,
      spAtk: 15,
      spDef: 15,
      speed: bodyIvs.legs,
    };

    const previewDoll = StatCalculator.createSouldoll(
      species.id,
      level,
      chassis.id,
      species.name,
      'docil',
      balancedSoulIvs
    );
    StatCalculator.ensurePartHp(previewDoll);

    const isSpAtk = species.baseStats.spAtk >= species.baseStats.atk;
    const primaryAtk = isSpAtk ? previewDoll.stats.spAtk : previewDoll.stats.atk;
    const primaryAtkLabel = isSpAtk ? t.stat_spatk : t.stat_atk;

    const weaponId = species.weaponId || 'baston_ignis';
    const weaponItem = ITEMS_DATA[weaponId];
    const weaponName = weaponItem?.name || weaponId;

    const abilityId = species.abilityId || 'mar_llamas';
    const abilityDef = ABILITIES_DATA[abilityId];
    const abilityName = abilityDef?.name || abilityId;
    const abilityDescription = abilityDef?.description || '';

    const roleKey = entry.roleKey || `role_${species.id}`;
    const roleText = t[roleKey] || t.role_default;

    const roleIconId: 'sword' | 'heart' | 'compass' =
      species.id === 'maga'
        ? 'sword'
        : species.id === 'sacerdotisa'
        ? 'heart'
        : 'compass';

    // 4 movimientos de vista previa: de starters.json o los primeros 4 del learnset de SoulSpecies
    const moveIds =
      entry.previewMoves && entry.previewMoves.length >= 4
        ? entry.previewMoves.slice(0, 4)
        : species.learnset.slice(0, 4).map((l) => l.moveId);

    const moves: StarterMoveEntryVM[] = moveIds.map((mId) => {
      const mDef = MOVES_DATA[mId];
      return {
        id: mId,
        name: mDef?.name || mId,
        type: mDef?.type || species.types[0] || 'Neutro',
      };
    });

    const displayName = optionsObj.debugLongNames
      ? `${species.name} de la Orden Arcana`
      : species.name;

    const spriteManifest = SOULDOLLS_SPRITES_MANIFEST[species.id];

    return {
      soulSpeciesId: species.id,
      name: displayName,
      element: species.types[0] || 'Neutro',
      roleText,
      roleIconId,
      weaponId,
      weaponName,
      level,
      stats: {
        hp: previewDoll.maxHp,
        atk: previewDoll.stats.atk,
        spAtk: previewDoll.stats.spAtk,
        primaryAtk,
        primaryAtkLabel,
        isSpAtk,
        speed: previewDoll.stats.speed,
      },
      abilityId,
      abilityName,
      abilityDescription,
      flavor: species.description,
      soulBottleFlavor: species.soulBottleFlavor,
      moves,
      spriteFrames: {
        sheetPath:
          spriteManifest?.sheetPath ||
          `/assets/souldolls/${species.id}_battle_sheet.png`,
        atlasPath:
          spriteManifest?.atlasPath ||
          `/data/art/souldolls/${species.id}_battle_atlas.json`,
        front: `${species.id}_view_front`,
        front34: `${species.id}_view_front34`,
        back: `${species.id}_view_back`,
        back34: `${species.id}_view_back34`,
        bottle: entry.bottleFrame || 'starter_bottle_ember',
      },
    };
  });

  const safeCount = Math.max(1, options.length);
  const rawFocus = optionsObj.focusIndex ?? 0;
  const focusIndex = ((rawFocus % safeCount) + safeCount) % safeCount;

  const rewards: StarterRewardsVM = {
    level,
    bodyId: chassis.id,
    bodyName: chassis.name,
    bottlesCount: startersData.rewards?.bottlesCount ?? 5,
    elixirCount: startersData.rewards?.elixirCount ?? 1,
  };

  return {
    title: t.title,
    step: t.step_subtitle,
    options,
    focusIndex,
    rewards,
  };
}
