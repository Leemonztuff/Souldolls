import { Souldoll, SoulSpecies } from '../../types/souldolls';
import { SOUL_SPECIES_DATA } from '../../data/souldolls/souls';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { MOVES_DATA } from '../../data/moves/moves';
import { StatCalculator } from '../battle/StatCalculator';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalEventBus } from '../../core/EventBus';
import { SoulCodexSystem } from '../SoulCodexSystem';

export interface AscensionResult {
  ascended: boolean;
  oldSpecies: SoulSpecies;
  newSpecies: SoulSpecies;
  learnedMoves: string[];
}

// Alias for compatibility
export type EvolutionResult = AscensionResult;

export class EvolutionSystem {
  private static instance: EvolutionSystem;

  private constructor() {}

  public static getInstance(): EvolutionSystem {
    if (!EvolutionSystem.instance) {
      EvolutionSystem.instance = new EvolutionSystem();
    }
    return EvolutionSystem.instance;
  }

  /**
   * Checks if a souldoll meets ascension requirements
   */
  public checkAscension(
    souldoll: Souldoll,
    trigger: 'level_up' | 'item' = 'level_up',
    itemId?: string
  ): { targetSpeciesId: string; requiredLevel: number; requiredTier: number; requiredSync: number; bodyEligible: boolean; syncEligible: boolean } | null {
    const species = SOUL_SPECIES_DATA[souldoll.soulSpeciesId || souldoll.speciesId];
    if (!species || !species.evolution) return null;

    const evo = species.evolution;
    const targetSpecies = SOUL_SPECIES_DATA[evo.toSpeciesId];
    const minBodyTier = evo.minBodyTier || targetSpecies?.bodyRequirement?.minTier || 1;
    const requiredSync = evo.sync || 0;

    // Check body tier
    const save = GlobalSaveService.getCurrentState();
    let currentChassisTier = 1;
    if (souldoll.bodyInstanceId) {
      if (save?.bodies && save.bodies[souldoll.bodyInstanceId]) {
        const body = save.bodies[souldoll.bodyInstanceId];
        const chassis = BODY_CHASSIS_DATA[body.chassisId];
        if (chassis) currentChassisTier = chassis.tier;
      } else {
        const foundKey = Object.keys(BODY_CHASSIS_DATA).find(
          (key) => souldoll.bodyInstanceId?.includes(key) || souldoll.bodyInstanceId === key
        );
        if (foundKey && BODY_CHASSIS_DATA[foundKey]) {
          currentChassisTier = BODY_CHASSIS_DATA[foundKey].tier;
        }
      }
    }
    const bodyEligible = currentChassisTier >= minBodyTier;

    const currentSync = souldoll.sync !== undefined ? souldoll.sync : (souldoll.friendship || 0);
    const syncEligible = currentSync >= requiredSync;

    if (trigger === 'level_up') {
      if (evo.sync && currentSync >= evo.sync && (!evo.level || souldoll.level >= evo.level)) {
        return { targetSpeciesId: evo.toSpeciesId, requiredLevel: evo.level || souldoll.level, requiredTier: minBodyTier, requiredSync, bodyEligible, syncEligible };
      }
      if (evo.level && souldoll.level >= evo.level) {
        return { targetSpeciesId: evo.toSpeciesId, requiredLevel: evo.level, requiredTier: minBodyTier, requiredSync, bodyEligible, syncEligible };
      }
    } else if (trigger === 'item' && itemId) {
      if (itemId === 'nucleo_resonancia' || itemId === 'resonance_core' || (evo.item && evo.item === itemId)) {
        return { targetSpeciesId: evo.toSpeciesId, requiredLevel: evo.level || souldoll.level, requiredTier: minBodyTier, requiredSync, bodyEligible, syncEligible };
      }
    }

    return null;
  }

  // Alias for compatibility
  public checkEvolution(
    souldoll: Souldoll,
    trigger: 'level_up' | 'item' = 'level_up',
    itemId?: string
  ): { targetSpeciesId: string; requiredLevel: number } | null {
    const result = this.checkAscension(souldoll, trigger, itemId);
    if (!result) return null;
    return { targetSpeciesId: result.targetSpeciesId, requiredLevel: result.requiredLevel };
  }

  public executeEvolution(souldoll: Souldoll, targetSpeciesId: string): AscensionResult {
    return this.ascendSoul(souldoll, targetSpeciesId);
  }

  /**
   * Performs soul ascension while recalculating stats, part HP, and learning new class moves
   */
  public ascendSoul(souldoll: Souldoll, targetSpeciesId: string): AscensionResult {
    const oldSpecies = SOUL_SPECIES_DATA[souldoll.soulSpeciesId || souldoll.speciesId];
    const newSpecies = SOUL_SPECIES_DATA[targetSpeciesId];

    if (!oldSpecies || !newSpecies) {
      throw new Error(`[EvolutionSystem] Invalid species transition from "${souldoll.speciesId}" to "${targetSpeciesId}"`);
    }

    // 1. Calculate Proportional HP Ratio
    const hpRatio = souldoll.maxHp > 0 ? souldoll.currentHp / souldoll.maxHp : 1.0;

    // 2. Recalculate Stats for New Species & Level
    const newStats = StatCalculator.calculateAllStats(newSpecies, souldoll.level, souldoll.ivs, souldoll.evs, souldoll.nature);
    souldoll.stats = newStats;
    souldoll.maxHp = newStats.hp;
    souldoll.currentHp = Math.max(1, Math.round(newStats.hp * hpRatio));

    // 3. Recalculate Part HP
    const partHp = StatCalculator.calculatePartHp(souldoll.maxHp);
    souldoll.maxPartHP = { ...partHp };
    souldoll.partHP = {
      head: Math.max(1, Math.round(partHp.head * hpRatio)),
      torso: Math.max(1, Math.round(partHp.torso * hpRatio)),
      arms: Math.max(1, Math.round(partHp.arms * hpRatio)),
      legs: Math.max(1, Math.round(partHp.legs * hpRatio)),
    };

    // 4. Update Weapon & Species ID
    if (!souldoll.nickname || souldoll.nickname === oldSpecies.name) {
      souldoll.nickname = newSpecies.name;
    }
    souldoll.soulSpeciesId = newSpecies.id;
    souldoll.speciesId = newSpecies.id;
    if (newSpecies.weaponId) {
      souldoll.equipped.weapon = newSpecies.weaponId;
    }

    // 5. Learn New Moves for Current Level from New Learnset
    const learnedMoves: string[] = [];
    newSpecies.learnset.forEach((m) => {
      if (m.level <= souldoll.level) {
        const hasMove = souldoll.moves.some((existing) => existing.moveId === m.moveId);
        if (!hasMove) {
          const moveDef = MOVES_DATA[m.moveId];
          const maxPp = moveDef ? moveDef.pp : 20;

          if (souldoll.moves.length < 4) {
            souldoll.moves.push({
              moveId: m.moveId,
              currentPp: maxPp,
              maxPp,
            });
            learnedMoves.push(moveDef ? moveDef.name : m.moveId);
          }
        }
      }
    });

    // 6. Update SoulCodex & Save
    SoulCodexSystem.markCaught(newSpecies.id);
    GlobalSaveService.save();

    // 7. Emit Global Event
    GlobalEventBus.emit('soul:ascended', {
      speciesId: oldSpecies.id,
      newSpeciesId: newSpecies.id,
    });
    GlobalEventBus.emit('creature:evolved', {
      speciesId: oldSpecies.id,
      newSpeciesId: newSpecies.id,
    });

    return {
      ascended: true,
      oldSpecies,
      newSpecies,
      learnedMoves,
    };
  }

  // Alias for compatibility
  public evolveCreature(souldoll: Souldoll, targetSpeciesId: string): EvolutionResult {
    return this.ascendSoul(souldoll, targetSpeciesId);
  }
}

export const GlobalEvolutionSystem = EvolutionSystem.getInstance();
