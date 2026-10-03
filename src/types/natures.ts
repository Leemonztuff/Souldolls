export type NatureType =
  | 'firme'     // +Atk, -SpAtk
  | 'modesta'   // +SpAtk, -Atk
  | 'miedosa'   // +Speed, -Atk
  | 'alegre'    // +Speed, -SpAtk
  | 'osada'     // +Def, -Atk
  | 'serena'    // +SpDef, -Atk
  | 'docil'     // Neutral
  | 'activa'    // +Speed, -Def
  | 'brava'     // +Atk, -Speed
  | 'mansa';    // +SpAtk, -Speed

export interface NatureModifier {
  increasedStat?: 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed';
  decreasedStat?: 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed';
}

export const NATURES_DATA: Record<NatureType, NatureModifier> = {
  firme: { increasedStat: 'atk', decreasedStat: 'spAtk' },
  modesta: { increasedStat: 'spAtk', decreasedStat: 'atk' },
  miedosa: { increasedStat: 'speed', decreasedStat: 'atk' },
  alegre: { increasedStat: 'speed', decreasedStat: 'spAtk' },
  osada: { increasedStat: 'def', decreasedStat: 'atk' },
  serena: { increasedStat: 'spDef', decreasedStat: 'atk' },
  docil: {},
  activa: { increasedStat: 'speed', decreasedStat: 'def' },
  brava: { increasedStat: 'atk', decreasedStat: 'speed' },
  mansa: { increasedStat: 'spAtk', decreasedStat: 'speed' },
};
