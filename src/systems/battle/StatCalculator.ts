import { BaseStats, SoulSpecies, Souldoll } from '../../types/souldolls';
import { BodyInstance, BodyChassis, PartBlock, BodyPart, PartShare } from '../../types/bodies';
import { BattleStatStages } from './BattleTypes';
import { SOUL_SPECIES_DATA } from '../../data/souldolls/souls';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { MOVES_DATA } from '../../data/moves/moves';
import { ExpCalculator } from './ExpCalculator';
import { NatureType, NATURES_DATA } from '../../types/natures';
import { Rng } from '../../core/Rng';
import battleConfigJson from '../../data/config/battle.json';
import partsConfigJson from '../../data/config/parts.json';

export const BATTLE_CONFIG = battleConfigJson;
export const PARTS_CONFIG = partsConfigJson;

export class StatCalculator {
  /**
   * Calculates maximum HP pool for a soul and level
   */
  public static calculateMaxHp(baseHp: number, level: number, iv = 0, ev = 0): number {
    return Math.floor(((2 * baseHp + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }

  /**
   * Calculates a regular combat stat (Atk, Def, SpAtk, SpDef, Speed)
   */
  public static calculateStat(
    baseStat: number,
    level: number,
    iv = 0,
    ev = 0,
    natureMult = 1.0
  ): number {
    const raw = Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(raw * natureMult);
  }

  /**
   * Returns nature multiplier for a given stat ('atk', 'def', 'spAtk', 'spDef', 'speed')
   */
  public static getNatureMultiplier(
    nature: NatureType | undefined,
    stat: 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed'
  ): number {
    if (!nature) return 1.0;
    const mod = NATURES_DATA[nature];
    if (!mod) return 1.0;
    if (mod.increasedStat === stat) return 1.1;
    if (mod.decreasedStat === stat) return 0.9;
    return 1.0;
  }

  /**
   * Calculates all combat stats for a given species and level, applying equipment bonuses
   */
  public static calculateAllStats(
    species: SoulSpecies,
    level: number,
    ivs?: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number },
    evs?: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number },
    nature?: NatureType,
    equipped?: { weapon?: string | null; relic?: string | null }
  ): {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  } {
    const i = ivs || { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };
    const e = evs || { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };

    let baseHp = this.calculateMaxHp(species.baseStats.hp, level, i.hp, e.hp);
    let atk = this.calculateStat(species.baseStats.atk, level, i.atk, e.atk, this.getNatureMultiplier(nature, 'atk'));
    let def = this.calculateStat(species.baseStats.def, level, i.def, e.def, this.getNatureMultiplier(nature, 'def'));
    let spAtk = this.calculateStat(species.baseStats.spAtk, level, i.spAtk, e.spAtk, this.getNatureMultiplier(nature, 'spAtk'));
    let spDef = this.calculateStat(species.baseStats.spDef, level, i.spDef, e.spDef, this.getNatureMultiplier(nature, 'spDef'));
    let speed = this.calculateStat(species.baseStats.speed, level, i.speed, e.speed, this.getNatureMultiplier(nature, 'speed'));

    // Apply Weapon & Relic Bonuses
    if (equipped) {
      if (equipped.weapon) {
        if (equipped.weapon.includes('baculo') || equipped.weapon.includes('cetro') || equipped.weapon.includes('tomo')) {
          spAtk = Math.floor(spAtk * 1.15);
        } else if (equipped.weapon.includes('mandoble') || equipped.weapon.includes('espada') || equipped.weapon.includes('guadana') || equipped.weapon.includes('nunchaku')) {
          atk = Math.floor(atk * 1.15);
        }
      }
      if (equipped.relic) {
        if (equipped.relic === 'reliquia_vigor') baseHp = Math.floor(baseHp * 1.15);
        if (equipped.relic === 'reliquia_foco') spAtk = Math.floor(spAtk * 1.10);
        if (equipped.relic === 'reliquia_escudo') def = Math.floor(def * 1.10);
        if (equipped.relic === 'reliquia_celeridad') speed = Math.floor(speed * 1.12);
      }
    }

    return { hp: baseHp, atk, def, spAtk, spDef, speed };
  }

  /**
   * Convenience method to calculate all combat stats directly from a Souldoll instance
   */
  public static calculateStats(souldoll: Souldoll): {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  } {
    this.ensurePartHp(souldoll);
    const species = SOUL_SPECIES_DATA[souldoll.speciesId || souldoll.soulSpeciesId] || SOUL_SPECIES_DATA['maga'];
    const calc = this.calculateAllStats(
      species,
      souldoll.level || 1,
      souldoll.ivs,
      souldoll.evs,
      souldoll.nature,
      souldoll.equipped
    );
    return {
      ...calc,
      hp: souldoll.maxHp || calc.hp,
    };
  }

  /**
   * Calculates per-part maximum HP according to chassis partShare, part IVs and part EVs
   * Formula: partMax[p] = max(1, floor(poolHP * chassis.partShare[p])) + floor(iv[p] / 4) + floor(ev[p] / 16)
   */
  public static calculatePartMaxHp(
    poolHp: number,
    chassisId = 'chassis_madera_t1',
    ivs?: Partial<PartBlock>,
    evs?: Partial<PartBlock>
  ): PartBlock {
    const chassis: BodyChassis = BODY_CHASSIS_DATA[chassisId] || BODY_CHASSIS_DATA['chassis_madera_t1'];
    const share = chassis?.partShare || { head: 0.15, torso: 0.40, arms: 0.20, legs: 0.25 };
    const i = ivs || {};
    const e = evs || {};

    const headIv = i.head ?? (i as any).hp ?? 0;
    const torsoIv = i.torso ?? (i as any).def ?? 0;
    const armsIv = i.arms ?? (i as any).atk ?? 0;
    const legsIv = i.legs ?? (i as any).speed ?? 0;

    const headEv = e.head ?? (e as any).hp ?? 0;
    const torsoEv = e.torso ?? (e as any).def ?? 0;
    const armsEv = e.arms ?? (e as any).atk ?? 0;
    const legsEv = e.legs ?? (e as any).speed ?? 0;

    const head = Math.max(1, Math.floor(poolHp * (share.head ?? 0.15))) + Math.floor(headIv / 4) + Math.floor(headEv / 16);
    const torso = Math.max(1, Math.floor(poolHp * (share.torso ?? 0.40))) + Math.floor(torsoIv / 4) + Math.floor(torsoEv / 16);
    const arms = Math.max(1, Math.floor(poolHp * (share.arms ?? 0.20))) + Math.floor(armsIv / 4) + Math.floor(armsEv / 16);
    const legs = Math.max(1, Math.floor(poolHp * (share.legs ?? 0.25))) + Math.floor(legsIv / 4) + Math.floor(legsEv / 16);

    return { head, torso, arms, legs };
  }

  /**
   * Calculates per-part HP for Souldolls
   */
  public static calculatePartHp(
    poolHp: number,
    chassisId = 'chassis_madera_t1',
    ivs?: Partial<PartBlock>,
    evs?: Partial<PartBlock>
  ): PartBlock {
    return this.calculatePartMaxHp(poolHp, chassisId, ivs, evs);
  }

  /**
   * Helper to resolve the correct chassis ID from a Souldoll's bodyInstanceId
   */
  public static getChassisId(souldoll: Souldoll): string {
    if (souldoll.bodyInstanceId && souldoll.bodyInstanceId.startsWith('body_')) {
      const parts = souldoll.bodyInstanceId.split('_');
      if (parts.length >= 4) {
        const potentialChassisId = parts.slice(1, 4).join('_');
        if (BODY_CHASSIS_DATA[potentialChassisId]) {
          return potentialChassisId;
        }
      }
    }
    return 'chassis_madera_t1';
  }

  /**
   * Recalculates stats and part max/current HPs on level up or stats modification,
   * applying proper IVs, EVs, nature and equipment.
   */
  public static recalculateStatsAndParts(souldoll: Souldoll): void {
    const species = SOUL_SPECIES_DATA[souldoll.speciesId || souldoll.soulSpeciesId] || SOUL_SPECIES_DATA['maga'];
    
    // 1. Recalculate base combat stats
    const newStats = this.calculateAllStats(
      species,
      souldoll.level || 1,
      souldoll.ivs,
      souldoll.evs,
      souldoll.nature,
      souldoll.equipped
    );
    souldoll.stats = newStats;

    // 2. Resolve chassis ID and recalculate part max HPs
    const chassisId = this.getChassisId(souldoll);
    const partIVs = souldoll.ivs ? { head: souldoll.ivs.hp, torso: souldoll.ivs.def, arms: souldoll.ivs.atk, legs: souldoll.ivs.speed } : undefined;
    const partEVs = souldoll.evs ? { head: souldoll.evs.hp, torso: souldoll.evs.def, arms: souldoll.evs.atk, legs: souldoll.evs.speed } : undefined;
    const newMaxPartHP = this.calculatePartMaxHp(newStats.hp, chassisId, partIVs, partEVs);

    if (!souldoll.maxPartHP) {
      souldoll.maxPartHP = { ...newMaxPartHP };
    }
    if (!souldoll.partHP) {
      souldoll.partHP = { ...newMaxPartHP };
    }

    // 3. Adjust current part HP by the difference in max part HP
    const parts: Array<'head' | 'torso' | 'arms' | 'legs'> = ['head', 'torso', 'arms', 'legs'];
    parts.forEach((p) => {
      const diff = newMaxPartHP[p] - souldoll.maxPartHP[p];
      if (diff > 0) {
        souldoll.partHP[p] += diff;
      }
      souldoll.partHP[p] = Math.min(newMaxPartHP[p], Math.max(0, souldoll.partHP[p]));
    });

    souldoll.maxPartHP = newMaxPartHP;

    // 4. Update overall maxHp and currentHp
    souldoll.maxHp = souldoll.maxPartHP.head + souldoll.maxPartHP.torso + souldoll.maxPartHP.arms + souldoll.maxPartHP.legs;
    souldoll.currentHp = Math.max(0, souldoll.partHP.head + souldoll.partHP.torso + souldoll.partHP.arms + souldoll.partHP.legs);
  }

  /**
   * Ensures that a Souldoll has valid partHP and maxPartHP objects
   */
  public static ensurePartHp(souldoll: Souldoll): void {
    const chassisId = this.getChassisId(souldoll);
    const partIVs = souldoll.ivs ? { head: souldoll.ivs.hp, torso: souldoll.ivs.def, arms: souldoll.ivs.atk, legs: souldoll.ivs.speed } : undefined;
    const partEVs = souldoll.evs ? { head: souldoll.evs.hp, torso: souldoll.evs.def, arms: souldoll.evs.atk, legs: souldoll.evs.speed } : undefined;
    const defaultMax = this.calculatePartMaxHp(souldoll.stats?.hp || 20, chassisId, partIVs, partEVs);

    if (!souldoll.maxPartHP) {
      souldoll.maxPartHP = { ...defaultMax };
    } else {
      souldoll.maxPartHP = {
        head: souldoll.maxPartHP.head ?? defaultMax.head,
        torso: souldoll.maxPartHP.torso ?? defaultMax.torso,
        arms: souldoll.maxPartHP.arms ?? defaultMax.arms,
        legs: souldoll.maxPartHP.legs ?? defaultMax.legs,
      };
    }

    if (!souldoll.partHP) {
      souldoll.partHP = { ...souldoll.maxPartHP };
    } else {
      souldoll.partHP = {
        head: souldoll.partHP.head ?? souldoll.maxPartHP.head,
        torso: souldoll.partHP.torso ?? souldoll.maxPartHP.torso,
        arms: souldoll.partHP.arms ?? souldoll.maxPartHP.arms,
        legs: souldoll.partHP.legs ?? souldoll.maxPartHP.legs,
      };
    }

    // Keep total HP synced to sum of parts
    souldoll.maxHp = souldoll.maxPartHP.head + souldoll.maxPartHP.torso + souldoll.maxPartHP.arms + souldoll.maxPartHP.legs;
    souldoll.currentHp = Math.max(0, souldoll.partHP.head + souldoll.partHP.torso + souldoll.partHP.arms + souldoll.partHP.legs);
  }

  /**
   * Distributes healing points across damaged parts according to priority (torso -> head -> legs -> arms)
   */
  public static distributeHeal(
    souldoll: Souldoll,
    healAmount: number
  ): { actualHealed: number; partHeals: Array<{ part: BodyPart; amount: number; remainingHp: number }> } {
    this.ensurePartHp(souldoll);
    let remaining = healAmount;
    let totalHealed = 0;
    const partHeals: Array<{ part: BodyPart; amount: number; remainingHp: number }> = [];

    const priority = (BATTLE_CONFIG.healPartPriority || ['torso', 'head', 'legs', 'arms']) as BodyPart[];

    for (const p of priority) {
      if (remaining <= 0) break;
      const maxP = souldoll.maxPartHP[p];
      const curP = souldoll.partHP[p];
      const needed = maxP - curP;

      if (needed > 0) {
        const toHeal = Math.min(needed, remaining);
        souldoll.partHP[p] += toHeal;
        remaining -= toHeal;
        totalHealed += toHeal;
        partHeals.push({
          part: p,
          amount: toHeal,
          remainingHp: souldoll.partHP[p],
        });
      }
    }

    souldoll.currentHp = souldoll.partHP.head + souldoll.partHP.torso + souldoll.partHP.arms + souldoll.partHP.legs;
    return { actualHealed: totalHealed, partHeals };
  }

  /**
   * Applies damage to a specific part, handling broken part redirection and optional overflow to torso
   */
  public static applyPartDamage(
    souldoll: Souldoll,
    targetPart: BodyPart,
    rawDamage: number
  ): {
    chosenPart: BodyPart;
    damageToPart: number;
    excessDamage: number;
    overflowToTorso: number;
    wasBroken: boolean;
    isNowBroken: boolean;
    faintReason?: 'head_broken' | 'torso_broken' | 'total_hp';
  } {
    this.ensurePartHp(souldoll);

    let chosenPart = targetPart;
    // 1. Redirection if target part is already broken (0 HP)
    if (souldoll.partHP[chosenPart] <= 0) {
      chosenPart = (BATTLE_CONFIG.brokenRedirectTarget || 'torso') as BodyPart;
    }

    const prevHp = souldoll.partHP[chosenPart];
    const damageToPart = Math.min(prevHp, rawDamage);
    const excessDamage = rawDamage - damageToPart;

    souldoll.partHP[chosenPart] = Math.max(0, souldoll.partHP[chosenPart] - damageToPart);

    const wasBroken = prevHp <= 0;
    const isNowBroken = prevHp > 0 && souldoll.partHP[chosenPart] <= 0;

    // 2. Overflow damage to torso if enabled
    let overflowToTorso = 0;
    if (
      BATTLE_CONFIG.overflowEnabled &&
      excessDamage > 0 &&
      chosenPart !== 'torso' &&
      souldoll.partHP.torso > 0
    ) {
      const overflowPercent = BATTLE_CONFIG.overflowPercentToTorso ?? 0.25;
      const desiredOverflow = Math.floor(excessDamage * overflowPercent);
      if (desiredOverflow > 0) {
        overflowToTorso = Math.min(souldoll.partHP.torso, desiredOverflow);
        souldoll.partHP.torso = Math.max(0, souldoll.partHP.torso - overflowToTorso);
      }
    }

    // 3. Recalculate total current HP
    souldoll.currentHp = souldoll.partHP.head + souldoll.partHP.torso + souldoll.partHP.arms + souldoll.partHP.legs;

    // 4. Fatal Part Check: Head = 0 or Torso = 0 results in instant KO
    let faintReason: 'head_broken' | 'torso_broken' | 'total_hp' | undefined;
    if (souldoll.partHP.head <= 0) {
      faintReason = 'head_broken';
      souldoll.currentHp = 0;
    } else if (souldoll.partHP.torso <= 0) {
      faintReason = 'torso_broken';
      souldoll.currentHp = 0;
    } else if (souldoll.currentHp <= 0) {
      faintReason = 'total_hp';
    }

    return {
      chosenPart,
      damageToPart,
      excessDamage,
      overflowToTorso,
      wasBroken,
      isNowBroken,
      faintReason,
    };
  }

  /**
   * Weighted target part selection with optional critical bonus on head
   */
  public static pickTargetPart(
    targeting: Partial<PartShare> | undefined,
    rng: Rng,
    isCritical = false
  ): BodyPart {
    const defaults = BATTLE_CONFIG.defaultPartTargeting || {
      head: 0.15,
      torso: 0.5,
      arms: 0.2,
      legs: 0.15,
    };

    const weights = {
      head: targeting?.head !== undefined ? targeting.head : defaults.head,
      torso: targeting?.torso !== undefined ? targeting.torso : defaults.torso,
      arms: targeting?.arms !== undefined ? targeting.arms : defaults.arms,
      legs: targeting?.legs !== undefined ? targeting.legs : defaults.legs,
    };

    if (isCritical) {
      const critMult = BATTLE_CONFIG.criticalHeadWeightMultiplier || 2.0;
      weights.head *= critMult;
    }

    const totalWeight = weights.head + weights.torso + weights.arms + weights.legs;
    if (totalWeight <= 0) return 'torso';

    const roll = rng.next() * totalWeight;
    if (roll < weights.head) return 'head';
    if (roll < weights.head + weights.torso) return 'torso';
    if (roll < weights.head + weights.torso + weights.arms) return 'arms';
    return 'legs';
  }

  /**
   * Generates a new BodyInstance with seedable or random IVs
   */
  public static createBodyInstance(
    chassisId = 'chassis_madera_t1',
    nickname?: string,
    rng?: Rng
  ): BodyInstance {
    const chassis = BODY_CHASSIS_DATA[chassisId] || BODY_CHASSIS_DATA['chassis_madera_t1'];
    const minIv = chassis.ivRange?.min || 0;
    const maxIv = chassis.ivRange?.max || 31;
    const diff = maxIv - minIv + 1;
    const rollIv = () => (rng ? rng.rangeInt(minIv, maxIv) : minIv + Math.floor(Math.random() * diff));

    return {
      instanceId: `body_${chassisId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      chassisId: chassis.id,
      ivs: {
        head: rollIv(),
        torso: rollIv(),
        arms: rollIv(),
        legs: rollIv(),
      },
      evs: { head: 0, torso: 0, arms: 0, legs: 0 },
      partDurability: { head: 100, torso: 100, arms: 100, legs: 100 },
      nickname: nickname || chassis.name,
    };
  }

  /**
   * Multiplier for regular stats (atk, def, spAtk, spDef, speed) based on stage [-6..+6]
   */
  public static getStatStageMultiplier(stage: number): number {
    const clamped = Math.max(-6, Math.min(6, stage));
    if (clamped >= 0) {
      return (2 + clamped) / 2;
    } else {
      return 2 / (2 - clamped);
    }
  }

  /**
   * Multiplier for accuracy and evasion based on stage [-6..+6]
   */
  public static getAccuracyStageMultiplier(stage: number): number {
    const clamped = Math.max(-6, Math.min(6, stage));
    if (clamped >= 0) {
      return (3 + clamped) / 3;
    } else {
      return 3 / (3 - clamped);
    }
  }

  public static createSouldoll(
    speciesId: string,
    level: number,
    bodyChassisId: string | null = 'chassis_madera_t1',
    customNickname?: string,
    nature?: NatureType,
    customIvs?: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number }
  ): Souldoll {
    const species = SOUL_SPECIES_DATA[speciesId] || SOUL_SPECIES_DATA['maga'];

    const natures: NatureType[] = ['firme', 'modesta', 'miedosa', 'alegre', 'osada', 'serena', 'docil'];
    const chosenNature = nature || natures[Math.floor(Math.random() * natures.length)];

    const ivs = customIvs || {
      hp: Math.floor(Math.random() * 32),
      atk: Math.floor(Math.random() * 32),
      def: Math.floor(Math.random() * 32),
      spAtk: Math.floor(Math.random() * 32),
      spDef: Math.floor(Math.random() * 32),
      speed: Math.floor(Math.random() * 32),
    };

    const evs = { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };
    const stats = this.calculateAllStats(species, level, ivs, evs, chosenNature);

    const availableMoves = species.learnset.filter((m) => m.level <= level);
    const movesPool =
      availableMoves.length >= 4
        ? availableMoves.slice(-4)
        : availableMoves.length > 0
        ? availableMoves
        : species.learnset.slice(0, 4);

    const moves = movesPool.map((m) => {
      const def = MOVES_DATA[m.moveId];
      return {
        moveId: m.moveId,
        currentPp: def ? def.pp : 20,
        maxPp: def ? def.pp : 20,
      };
    });

    const abilityId = species.abilityId || 'mar_llamas';
    const bodyInstanceId = bodyChassisId ? `body_${bodyChassisId}_${Math.random().toString(36).substr(2, 6)}` : null;

    const partIVs = { head: ivs.hp, torso: ivs.def, arms: ivs.atk, legs: ivs.speed };
    const partHP = this.calculatePartMaxHp(stats.hp, bodyChassisId || 'chassis_madera_t1', partIVs);
    const totalMaxHp = partHP.head + partHP.torso + partHP.arms + partHP.legs;

    return {
      uid: `${species.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      soulSpeciesId: species.id,
      speciesId: species.id,
      nickname: customNickname || species.name,
      level,
      currentExp: ExpCalculator.getExpForLevel(level, species.expGroup),
      sync: 70, // Sincronía inicial
      friendship: 70,
      bodyInstanceId,
      currentHp: totalMaxHp,
      maxHp: totalMaxHp,
      partHP: { ...partHP },
      maxPartHP: { ...partHP },
      moves,
      equipped: {
        relic: null,
        weapon: species.weaponId || null,
        accessory: null,
      },
      heldItemId: null,
      status: null,
      stats: {
        ...stats,
        hp: totalMaxHp,
      },
      abilityId,
      nature: chosenNature,
      ivs,
      evs,
    };
  }

  // Alias for compatibility
  public static createCreatureInstance(
    speciesId: string,
    level: number,
    customNickname?: string,
    nature?: NatureType,
    customIvs?: { hp: number; atk: number; def: number; spAtk: number; spDef: number; speed: number }
  ): Souldoll {
    // Map any old creature species id to new souls
    const legacyMap: Record<string, string> = {
      flamin: 'maga',
      pirolon: 'archimaga',
      brotin: 'sacerdotisa',
      frondoso: 'hierofante',
      rocalin: 'gladiadora',
      gravelon: 'titanide',
      umbrito: 'asesina',
      noctarro: 'espectro',
      aquilo: 'hidromante',
      marejon: 'cantora_marea',
      chispin: 'monje',
      voltaro: 'maestro_trueno',
      piropio: 'bruja',
      plumaveloz: 'hechicera',
    };
    const resolvedId = legacyMap[speciesId] || speciesId;
    return this.createSouldoll(resolvedId, level, 'chassis_madera_t1', customNickname, nature, customIvs);
  }

  /**
   * Creates initial stat stages (all 0)
   */
  public static createInitialStages(): BattleStatStages {
    return {
      atk: 0,
      def: 0,
      spAtk: 0,
      spDef: 0,
      speed: 0,
      accuracy: 0,
      evasion: 0,
    };
  }
}

