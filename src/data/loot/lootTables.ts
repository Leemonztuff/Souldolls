import { LootTable } from '../../types/loot';

export const LOOT_TABLES_DATA: Record<string, LootTable> = {
  loot_soultrainer_novato: {
    id: 'loot_soultrainer_novato',
    name: 'Botín de Soultrainer Novato',
    entries: [
      { kind: 'item', id: 'elixir_ki', weight: 45 },
      { kind: 'bottle', id: 'soul_bottle_comun', weight: 35 },
      { kind: 'item', id: 'purga_ki', weight: 15 },
      { kind: 'body', id: 'chassis_madera_t1', weight: 5, minTier: 1 },
    ],
  },
  loot_soultrainer_veterano: {
    id: 'loot_soultrainer_veterano',
    name: 'Botín de Soultrainer Veterano',
    entries: [
      { kind: 'item', id: 'elixir_ki_mayor', weight: 30 },
      { kind: 'bottle', id: 'soul_bottle_plata', weight: 25 },
      { kind: 'item', id: 'reencarnacion', weight: 15 },
      { kind: 'body', id: 'chassis_hierro_forjado_t2', weight: 15, minTier: 2 },
      { kind: 'body', id: 'chassis_madera_reforzada_t2', weight: 15, minTier: 2 },
    ],
  },
  loot_boss_guardian: {
    id: 'loot_boss_guardian',
    name: 'Botín del Guardián del Eco',
    entries: [
      { kind: 'bottle', id: 'soul_bottle_oro', weight: 30 },
      { kind: 'item', id: 'nucleo_resonancia', weight: 25 },
      { kind: 'item', id: 'reliquia_sincronia', weight: 20 },
      { kind: 'body', id: 'chassis_guardian_piedra_t3', weight: 15, minTier: 3 },
      { kind: 'body', id: 'chassis_berserker_t3', weight: 10, minTier: 3 },
    ],
  },
  loot_chest_tier1: {
    id: 'loot_chest_tier1',
    name: 'Cofre de Villa Brote (Tier 1)',
    entries: [
      { kind: 'bottle', id: 'soul_bottle_comun', weight: 40 },
      { kind: 'item', id: 'elixir_ki', weight: 35 },
      { kind: 'body', id: 'chassis_madera_t1', weight: 25, minTier: 1 },
    ],
  },
  loot_chest_tier2: {
    id: 'loot_chest_tier2',
    name: 'Cofre del Bosque del Eco (Tier 2)',
    entries: [
      { kind: 'bottle', id: 'soul_bottle_plata', weight: 35 },
      { kind: 'item', id: 'elixir_ki_mayor', weight: 30 },
      { kind: 'body', id: 'chassis_madera_reforzada_t2', weight: 20, minTier: 2 },
      { kind: 'item', id: 'cristal_mana_planta', weight: 15 },
    ],
  },
  loot_chest_tier3: {
    id: 'loot_chest_tier3',
    name: 'Cofre de Cueva del Eco (Tier 3)',
    entries: [
      { kind: 'bottle', id: 'soul_bottle_oro', weight: 30 },
      { kind: 'body', id: 'chassis_acrobata_t3', weight: 25, minTier: 3 },
      { kind: 'item', id: 'nucleo_resonancia', weight: 25 },
      { kind: 'body', id: 'chassis_cristalino_t4', weight: 20, minTier: 4 },
    ],
  },
};
