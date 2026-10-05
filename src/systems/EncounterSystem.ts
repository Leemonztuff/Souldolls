import { EncounterEntry, MapData } from '../types/maps';
import { GameState } from '../types';
import { GlobalRng } from '../core/Rng';
import { StarterLabSystem } from './lab/StarterLabSystem';
import { GlobalSaveService } from '../services/SaveService';

export interface WildEncounterResult {
  speciesId: string;
  level: number;
}

export class EncounterSystem {
  /**
   * Returns the effective encounter table for a map, merging the 2 unchosen starter souls
   * on ruta_claro and bosque_eco when wild_starters_released is active (Bloque 35 R4.4).
   */
  public static getEffectiveEncounterTable(map: MapData, state?: GameState | null): EncounterEntry[] {
    const baseTable = map.encounterTable ? [...map.encounterTable] : [];
    const currentState = state ?? (GlobalSaveService.hasActiveState() ? GlobalSaveService.getCurrentState() : null);

    if (map.id === 'ruta_claro' || map.id === 'bosque_eco') {
      const wildStarters = StarterLabSystem.getWildStarterEntries(currentState);
      for (const ws of wildStarters) {
        if (!baseTable.some((e) => e.speciesId === ws.speciesId)) {
          baseTable.push(ws);
        }
      }
    }

    return baseTable;
  }

  /**
   * Checks if an encounter triggers on stepping onto tall grass and picks a creature
   */
  public static checkEncounter(map: MapData, state?: GameState | null): WildEncounterResult | null {
    const table = this.getEffectiveEncounterTable(map, state);
    if (table.length === 0) {
      return null;
    }

    const rate = map.encounterRate || 0.12;
    const roll = GlobalRng.next();

    if (roll > rate) {
      return null;
    }

    return this.pickEncounter(table);
  }

  /**
   * Weighted random selection from map's encounter table
   */
  public static pickEncounter(table: EncounterEntry[]): WildEncounterResult {
    const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
    let rand = GlobalRng.next() * totalWeight;

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
