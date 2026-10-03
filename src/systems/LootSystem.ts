import { LootTable, LootEntry } from '../types/loot';
import { BodyInstance } from '../types/bodies';
import { StatCalculator } from './battle/StatCalculator';
import { GlobalSaveService } from '../services/SaveService';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { ITEMS_DATA } from '../data/items/items';

export interface GeneratedLoot {
  money: number;
  items: Array<{ id: string; name: string; count: number }>;
  bodies: BodyInstance[];
}

export class LootSystem {
  public static generateLoot(moneyAmount = 500, chassisId?: string): GeneratedLoot {
    const state = GlobalSaveService.getCurrentState();
    if (!state.bodies) state.bodies = {};
    if (!state.inventory) state.inventory = {};

    // 1. Money
    state.player.money += moneyAmount;

    // 2. Items
    const items: Array<{ id: string; name: string; count: number }> = [
      { id: 'elixir_ki', name: 'Elixir de ki', count: 2 },
      { id: 'soul_bottle_comun', name: 'Soul Bottle Común', count: 1 },
    ];

    items.forEach((item) => {
      state.inventory[item.id] = (state.inventory[item.id] || 0) + item.count;
    });

    // 3. Body Chassis with Seedeable/Random IVs
    const bodies: BodyInstance[] = [];
    const targetChassis = chassisId || 'chassis_madera_reforzada_t2';
    const chassisDef = BODY_CHASSIS_DATA[targetChassis] || BODY_CHASSIS_DATA['chassis_madera_t1'];

    const newBody = StatCalculator.createBodyInstance(chassisDef.id, chassisDef.name);
    state.bodies[newBody.instanceId] = newBody;
    bodies.push(newBody);

    GlobalSaveService.save();

    return {
      money: moneyAmount,
      items,
      bodies,
    };
  }
}
