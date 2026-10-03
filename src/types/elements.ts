/**
 * 7 Elemental Types for Souldolls RPG
 */

export type ElementType =
  | 'Neutro'
  | 'Fuego'
  | 'Agua'
  | 'Planta'
  | 'Eléctrico'
  | 'Tierra'
  | 'Sombra'
  // Compatibility aliases
  | 'Normal';

export const ALL_ELEMENT_TYPES: ElementType[] = [
  'Neutro',
  'Fuego',
  'Agua',
  'Planta',
  'Eléctrico',
  'Tierra',
  'Sombra',
];

export type TypeMultiplier = 0 | 0.5 | 1 | 2;

export type TypeChart = Record<string, Record<string, TypeMultiplier>>;
