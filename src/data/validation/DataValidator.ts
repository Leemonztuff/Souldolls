import { ALL_ELEMENT_TYPES } from '../../types/elements';
import { TYPE_CHART } from '../types/typeChart';
import { MOVES_DATA } from '../moves/moves';
import { ITEMS_DATA } from '../items/items';
import { SOUL_SPECIES_DATA } from '../souldolls/souls';
import { BODY_CHASSIS_DATA } from '../bodies/chassis';
import { LOOT_TABLES_DATA } from '../loot/lootTables';
import { STATUS_EFFECT_RULES } from '../status/statusEffects';
import { WorldGraph } from '../maps/worldGraph';
import { QUESTS_DATA } from '../quests/quests';

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalTypes: number;
    totalMoves: number;
    totalItems: number;
    totalSoulSpecies: number;
    totalBodyChassis: number;
    totalLootTables: number;
  };
}

export class DataValidator {
  public static validateAll(): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate Type Chart
    ALL_ELEMENT_TYPES.forEach((atkType) => {
      if (!TYPE_CHART[atkType]) {
        errors.push(`[TypeChart] Missing row for attacking type: "${atkType}"`);
      } else {
        ALL_ELEMENT_TYPES.forEach((defType) => {
          if (TYPE_CHART[atkType][defType] === undefined) {
            errors.push(
              `[TypeChart] Missing multiplier for [${atkType} -> ${defType}] in TYPE_CHART`
            );
          }
        });
      }
    });

    // 2. Validate Body Chassis (partShare sum = 1.0, tiers, prices, descriptions)
    Object.entries(BODY_CHASSIS_DATA).forEach(([chassisId, chassis]) => {
      if (chassis.id !== chassisId) {
        errors.push(`[BodyChassis] Chassis key mismatch: "${chassisId}" !== "${chassis.id}"`);
      }
      if (!chassis.name || chassis.name.trim() === '') {
        errors.push(`[BodyChassis] Chassis "${chassisId}" has missing or empty name.`);
      }
      if (!chassis.description || chassis.description.trim() === '') {
        errors.push(`[BodyChassis] Chassis "${chassisId}" must have a non-empty description.`);
      }
      if (chassis.price === undefined || chassis.price < 0) {
        errors.push(`[BodyChassis] Chassis "${chassisId}" has invalid price: ${chassis.price}`);
      }
      if (chassis.tier < 1 || chassis.tier > 5) {
        errors.push(`[BodyChassis] Chassis "${chassisId}" has invalid tier ${chassis.tier} (must be 1-5).`);
      }

      const share = chassis.partShare;
      if (!share) {
        errors.push(`[BodyChassis] Chassis "${chassisId}" is missing partShare.`);
      } else {
        const sum = share.head + share.torso + share.arms + share.legs;
        if (Math.abs(sum - 1.0) > 0.0001) {
          errors.push(
            `[BodyChassis] Chassis "${chassisId}" partShare (${share.head} + ${share.torso} + ${share.arms} + ${share.legs} = ${sum}) does NOT sum to 1.0!`
          );
        }
      }
    });

    // 3. Validate Items (price, description, weaponClass)
    Object.entries(ITEMS_DATA).forEach(([itemId, item]) => {
      if (item.id !== itemId) {
        errors.push(`[Items] Item key mismatch: "${itemId}" !== "${item.id}"`);
      }
      if (!item.name || item.name.trim() === '') {
        errors.push(`[Items] Item "${itemId}" has missing name.`);
      }
      if (!item.description || item.description.trim() === '') {
        errors.push(`[Items] Item "${itemId}" must have a non-empty description.`);
      }
      if (item.price === undefined || item.price < 0) {
        errors.push(`[Items] Item "${itemId}" has invalid or missing price: ${item.price}`);
      }
      if (item.category === 'weapon' && !item.weaponClass) {
        warnings.push(`[Items] Weapon "${itemId}" has no weaponClass specified.`);
      }
    });

    // 4. Validate SoulSpecies & Ascension Chains
    const dexNumbersSeen = new Set<number>();
    const chassisTiersAvailable = new Set(Object.values(BODY_CHASSIS_DATA).map((c) => c.tier));

    Object.entries(SOUL_SPECIES_DATA).forEach(([speciesId, soul]) => {
      if (soul.id !== speciesId) {
        errors.push(`[SoulSpecies] Species key mismatch: "${speciesId}" !== "${soul.id}"`);
      }

      if (dexNumbersSeen.has(soul.dexNumber)) {
        errors.push(
          `[SoulSpecies] Duplicate dexNumber #${soul.dexNumber} found in "${speciesId}"`
        );
      }
      dexNumbersSeen.add(soul.dexNumber);

      // Validate Weapon ID
      if (!soul.weaponId) {
        errors.push(`[SoulSpecies] Species "${speciesId}" must have a weaponId assigned.`);
      } else if (!ITEMS_DATA[soul.weaponId]) {
        errors.push(
          `[SoulSpecies] Species "${speciesId}" references nonexistent weaponId: "${soul.weaponId}"`
        );
      }

      // Validate Body Requirement
      if (!soul.bodyRequirement || typeof soul.bodyRequirement.minTier !== 'number') {
        errors.push(`[SoulSpecies] Species "${speciesId}" is missing bodyRequirement.minTier.`);
      } else if (!chassisTiersAvailable.has(soul.bodyRequirement.minTier as any)) {
        errors.push(
          `[SoulSpecies] Species "${speciesId}" requires minTier ${soul.bodyRequirement.minTier}, but no BodyChassis exists for that tier!`
        );
      }

      // Validate Soul Bottle Flavor Text
      if (!soul.soulBottleFlavor || soul.soulBottleFlavor.trim() === '') {
        errors.push(`[SoulSpecies] Species "${speciesId}" is missing soulBottleFlavor description.`);
      }

      // Check element types
      if (!soul.types || soul.types.length === 0) {
        errors.push(`[SoulSpecies] Species "${speciesId}" has no types assigned.`);
      } else {
        soul.types.forEach((t) => {
          if (!ALL_ELEMENT_TYPES.includes(t)) {
            errors.push(`[SoulSpecies] Species "${speciesId}" has invalid type: "${t}"`);
          }
        });
      }

      // Check base stats
      const stats = soul.baseStats;
      if (
        stats.hp <= 0 ||
        stats.atk <= 0 ||
        stats.def <= 0 ||
        stats.spAtk <= 0 ||
        stats.spDef <= 0 ||
        stats.speed <= 0
      ) {
        errors.push(`[SoulSpecies] Species "${speciesId}" has non-positive base stats.`);
      }

      // Check learnset
      if (!soul.learnset || soul.learnset.length === 0) {
        errors.push(`[SoulSpecies] Species "${speciesId}" has empty learnset.`);
      } else {
        soul.learnset.forEach((entry) => {
          if (!MOVES_DATA[entry.moveId]) {
            errors.push(
              `[SoulSpecies] Species "${speciesId}" references nonexistent moveId: "${entry.moveId}" (at level ${entry.level})`
            );
          }
          if (entry.level < 1 || entry.level > 100) {
            errors.push(
              `[SoulSpecies] Species "${speciesId}" has invalid learn level: ${entry.level} for move "${entry.moveId}"`
            );
          }
        });
      }

      // Check Evolution / Ascension & Body Tier Compatibility
      if (soul.evolution) {
        const evoTarget = soul.evolution.toSpeciesId;
        const targetSoul = SOUL_SPECIES_DATA[evoTarget];
        if (!targetSoul) {
          errors.push(
            `[SoulSpecies] Species "${speciesId}" evolves to nonexistent species: "${evoTarget}"`
          );
        } else if (evoTarget === speciesId) {
          errors.push(
            `[SoulSpecies] Species "${speciesId}" cannot evolve into itself!`
          );
        } else {
          // Check that there is a possible body tier for the ascension
          const minRequiredTier = soul.evolution.minBodyTier || targetSoul.bodyRequirement?.minTier || 1;
          const hasValidChassis = Object.values(BODY_CHASSIS_DATA).some((ch) => ch.tier >= minRequiredTier);
          if (!hasValidChassis) {
            errors.push(
              `[SoulSpecies] Evolution from "${speciesId}" -> "${evoTarget}" requires minBodyTier ${minRequiredTier}, but no suitable BodyChassis exists!`
            );
          }

          // Cycle detection (DFS path)
          const visited = new Set<string>([speciesId]);
          let curr = targetSoul;
          while (curr && curr.evolution) {
            if (visited.has(curr.evolution.toSpeciesId)) {
              errors.push(
                `[SoulSpecies] Evolution cycle detected: "${speciesId}" -> ... -> "${curr.evolution.toSpeciesId}"`
              );
              break;
            }
            visited.add(curr.id);
            curr = SOUL_SPECIES_DATA[curr.evolution.toSpeciesId];
          }
        }
      }
    });

    // 5. Validate Moves (accuracy, pp, partTargeting, tags)
    Object.entries(MOVES_DATA).forEach(([moveId, move]) => {
      if (move.id !== moveId) {
        errors.push(`[Moves] Move key mismatch: "${moveId}" !== "${move.id}"`);
      }
      if (!ALL_ELEMENT_TYPES.includes(move.type)) {
        errors.push(`[Moves] Move "${moveId}" has invalid element type: "${move.type}"`);
      }
      if (move.accuracy < 0 || move.accuracy > 100) {
        errors.push(`[Moves] Move "${moveId}" has out-of-range accuracy: ${move.accuracy}`);
      }
      if (move.pp <= 0) {
        errors.push(`[Moves] Move "${moveId}" has non-positive PP: ${move.pp}`);
      }
      if (!move.effect || move.effect.length === 0) {
        errors.push(`[Moves] Move "${moveId}" must have at least one effect defined.`);
      }
      if (!move.partTargeting) {
        errors.push(`[Moves] Move "${moveId}" is missing partTargeting definition.`);
      } else {
        const ptSum =
          move.partTargeting.head +
          move.partTargeting.torso +
          move.partTargeting.arms +
          move.partTargeting.legs;
        if (ptSum <= 0) {
          errors.push(`[Moves] Move "${moveId}" partTargeting sum must be > 0.`);
        }
      }
      if (!move.tags || !Array.isArray(move.tags) || move.tags.length === 0) {
        errors.push(`[Moves] Move "${moveId}" must have at least one tag in tags[].`);
      }

      // Check status effect conditions
      move.effect.forEach((eff) => {
        if (eff.type === 'status') {
          if (!STATUS_EFFECT_RULES[eff.condition]) {
            errors.push(
              `[Moves] Move "${moveId}" references invalid status condition: "${eff.condition}"`
            );
          }
        }
      });
    });

    // 6. Validate LootTables
    Object.entries(LOOT_TABLES_DATA).forEach(([tableId, table]) => {
      if (table.id !== tableId) {
        errors.push(`[LootTable] Table key mismatch: "${tableId}" !== "${table.id}"`);
      }
      if (!table.entries || table.entries.length === 0) {
        errors.push(`[LootTable] Table "${tableId}" has no entries.`);
      } else {
        table.entries.forEach((entry, idx) => {
          if (entry.weight <= 0) {
            errors.push(`[LootTable] Table "${tableId}" entry #${idx} has non-positive weight: ${entry.weight}`);
          }
          if (entry.kind === 'body') {
            if (!BODY_CHASSIS_DATA[entry.id]) {
              errors.push(`[LootTable] Table "${tableId}" references nonexistent body ID: "${entry.id}"`);
            }
          } else if (entry.kind === 'item' || entry.kind === 'bottle') {
            if (!ITEMS_DATA[entry.id]) {
              errors.push(`[LootTable] Table "${tableId}" references nonexistent item ID: "${entry.id}"`);
            }
          } else {
            errors.push(`[LootTable] Table "${tableId}" has invalid entry kind: "${(entry as any).kind}"`);
          }
        });
      }
    });

    // 7. Validate WorldGraph & Map Warps
    if (!WorldGraph.validateConnections()) {
      errors.push('[WorldGraph] One or more invalid map warps or out-of-bound connections were found.');
    }

    // 8. Validate Quests
    Object.entries(QUESTS_DATA).forEach(([questId, quest]) => {
      if (quest.id !== questId) {
        errors.push(`[Quests] Key mismatch: "${questId}" !== "${quest.id}"`);
      }
      if (!quest.objectives || quest.objectives.length === 0) {
        errors.push(`[Quests] Quest "${questId}" has no objectives.`);
      }
    });

    const report: ValidationReport = {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalTypes: ALL_ELEMENT_TYPES.length,
        totalMoves: Object.keys(MOVES_DATA).length,
        totalItems: Object.keys(ITEMS_DATA).length,
        totalSoulSpecies: Object.keys(SOUL_SPECIES_DATA).length,
        totalBodyChassis: Object.keys(BODY_CHASSIS_DATA).length,
        totalLootTables: Object.keys(LOOT_TABLES_DATA).length,
      },
    };

    if (!report.isValid) {
      console.error('❌ [DataValidator] Data validation FAILED with errors:');
      errors.forEach((err) => console.error(`  - ${err}`));
      throw new Error(`Data validation failed with ${errors.length} error(s). See console for details.`);
    } else {
      console.log('✅ [DataValidator] All Souldolls game content validated successfully!');
      this.printSummaryTables();
    }

    return report;
  }

  public static printSummaryTables(): void {
    console.log('\n========================================================================');
    console.log('📜 TABLA 1: LAS 14 ALMAS DE ANIMA (SOUL SPECIES)');
    console.log('========================================================================');

    const soulsTable = Object.values(SOUL_SPECIES_DATA).map((s) => {
      const bst =
        s.baseStats.hp +
        s.baseStats.atk +
        s.baseStats.def +
        s.baseStats.spAtk +
        s.baseStats.spDef +
        s.baseStats.speed;

      return {
        '#': s.dexNumber,
        Alma: s.name,
        Clase: s.classId,
        Elemento: s.types.join('/'),
        BST: bst,
        HP: s.baseStats.hp,
        ATK: s.baseStats.atk,
        DEF: s.baseStats.def,
        SPATK: s.baseStats.spAtk,
        SPDEF: s.baseStats.spDef,
        SPD: s.baseStats.speed,
        Arma: ITEMS_DATA[s.weaponId]?.name || s.weaponId,
        TierMin: `T${s.bodyRequirement.minTier}`,
        Ascenso: s.evolution
          ? `-> ${SOUL_SPECIES_DATA[s.evolution.toSpeciesId]?.name || s.evolution.toSpeciesId} (Nv.${s.evolution.level})`
          : '— (Suprema)',
        Movs: s.learnset.length,
      };
    });

    if (console.table) {
      console.table(soulsTable);
    }

    console.log('\n========================================================================');
    console.log('🤖 TABLA 2: LOS 8 CHASIS CONTENEDORES (BODY CHASSIS)');
    console.log('========================================================================');

    const chassisTable = Object.values(BODY_CHASSIS_DATA).map((c) => {
      const s = c.partShare;
      const shareFormatted = `C:${Math.round(s.head * 100)}% T:${Math.round(s.torso * 100)}% B:${Math.round(s.arms * 100)}% P:${Math.round(s.legs * 100)}%`;
      return {
        ID: c.id,
        Nombre: c.name,
        Material: c.material.toUpperCase(),
        Tier: `Tier ${c.tier}`,
        'Reparto PS (C/T/B/P)': shareFormatted,
        Suma: `${Math.round((s.head + s.torso + s.arms + s.legs) * 100)}%`,
        Ranuras: [c.slots.relic ? 'Reliquia' : '', c.slots.weapon ? 'Arma' : '', c.slots.accessory ? 'Accesorio' : ''].filter(Boolean).join(', '),
        Etiquetas: c.tags.join(', '),
        Precio: `$${c.price}`,
      };
    });

    if (console.table) {
      console.table(chassisTable);
    }
    console.log('========================================================================\n');
  }
}
