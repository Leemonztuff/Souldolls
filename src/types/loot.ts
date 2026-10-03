export type LootKind = 'body' | 'item' | 'bottle';

export interface LootEntry {
  kind: LootKind;
  id: string;
  weight: number;
  minTier?: number;
}

export interface LootTable {
  id: string;
  name: string;
  entries: LootEntry[];
}
