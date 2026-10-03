import { TextStyle } from 'pixi.js';

// Base Colors (Hex Strings)
export const COLOR_HEX = {
  inkCrypt: '#14101C',
  smokedWood: '#2A1F2D',
  bronze: '#8A6A3B',
  gold: '#E8B84A',
  parchment: '#F2E6C9',
  smoke: '#A89BB0',
  cyan: '#5FE3D2',
  soulViolet: '#9B6BFF',
  rift: '#C2234B',
  porcelainPink: '#FF8FB8',
  white: '#FFFFFF',
  disabledText: '#71717A',
};

// Base Colors (Numeric representations for PixiJS graphics)
export const COLOR_NUM = {
  inkCrypt: 0x14101C,
  smokedWood: 0x2A1F2D,
  bronze: 0x8A6A3B,
  gold: 0xE8B84A,
  parchment: 0xF2E6C9,
  smoke: 0xA89BB0,
  cyan: 0x5FE3D2,
  soulViolet: 0x9B6BFF,
  rift: 0xC2234B,
  porcelainPink: 0xFF8FB8,
  white: 0xFFFFFF,
  disabledBg: 0x27272A,
  disabledBorder: 0x52525B,
};

// Semantic status colors for HP, stats, etc.
export const COLOR_SEMANTIC = {
  ok: 0x10B981,       // Green
  warning: 0xF59E0B,  // Yellow/Orange
  danger: 0xEF4444,   // Red
};

// Rarezas
export const COLOR_RARITY = {
  comun: 0xB8B8C4,
  pocoComun: 0x4C8DFF,
  rara: 0xB05CFF,
  epica: 0xFFB020,
};

// Elementos
export const COLOR_ELEMENT = {
  fuego: { primary: 0xFF6B35, secondary: 0xFFC15E },
  agua: { primary: 0x3FA9F5, secondary: 0xA8E6FF },
  planta: { primary: 0x5CBF5A, secondary: 0xC8F28A },
  electrico: { primary: 0xFFD93D, secondary: 0xFFF6B0 },
  tierra: { primary: 0xB07A45, secondary: 0xE0C28C },
  sombra: { primary: 0x6B3FA0, secondary: 0xC79BFF },
  neutro: { primary: 0xC9C3D6, secondary: 0xFFFFFF },
};

// Typographies
export const FONTS = {
  title: "'Cinzel Decorative', 'Cinzel', serif",
  body: "'Nunito', sans-serif",
  hud: "'Pixelify Sans', monospace",
  damage: "'Cinzel', serif",
};

// Preset TextStyles for consistent look and feel
export const TEXT_STYLES = {
  logo: new TextStyle({
    fontFamily: FONTS.title,
    fontSize: 48,
    fontWeight: '900',
    fill: COLOR_HEX.parchment,
    letterSpacing: 4,
  }),
  button: new TextStyle({
    fontFamily: FONTS.hud,
    fontSize: 14,
    fontWeight: 'bold',
    fill: COLOR_HEX.parchment,
  }),
  dialogueSpeaker: new TextStyle({
    fontFamily: FONTS.title,
    fontSize: 14,
    fontWeight: 'bold',
    fill: COLOR_HEX.gold,
  }),
  dialogueBody: new TextStyle({
    fontFamily: FONTS.body,
    fontSize: 14,
    fill: COLOR_HEX.parchment,
    lineHeight: 20,
  }),
};

// Spacing scale
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Corners Radii
export const RADII = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
};
