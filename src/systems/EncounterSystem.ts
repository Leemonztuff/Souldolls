import { EncounterEntry, MapData } from '../types/maps';
import { GlobalRng } from '../core/Rng';

export interface WildEncounterResult {
  speciesId: string;
  level: number;
}

export class EncounterSystem {
  /**
   * Checks if an encounter triggers on stepping onto tall grass and picks a creature
   */
  public static checkEncounter(map: MapData): WildEncounterResult | null {
    if (!map.encounterTable || map.encounterTable.length === 0) {
      return null;
    }

    const rate = map.encounterRate || 0.12;
    const roll = Math.random();

    if (roll > rate) {
      return null;
    }

    return this.pickEncounter(map.encounterTable);
  }

  /**
   * Weighted random selection from map's encounter table
   */
  public static pickEncounter(table: EncounterEntry[]): WildEncounterResult {
    const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
    let rand = Math.random() * totalWeight;

    for (const entry of table) {
      if (rand < entry.weight) {
        const level = GlobalRng.rangeInt(entry.minLevel, entry.maxLevel);
        return {
          speciesId: entry.speciesId,
          level,
        };
      }
      rand -= entry.weight;
    }

    // Fallback to first entry
    const fallback = table[0];
    return {
      speciesId: fallback.speciesId,
      level: fallback.minLevel,
    };
  }
}
