import { TextStyle } from 'pixi.js';
import themeTokens from '../data/theme/theme.json';

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// Base Colors (Hex Strings) derived strictly from /data/theme/theme.json (Bloque 41 Req 2)
export const COLOR_HEX = {
  inkCrypt: themeTokens.colors.base.inkCrypt,
  smokedWood: themeTokens.colors.base.smokedWood,
  bronze: themeTokens.colors.base.bronze,
  gold: themeTokens.colors.base.gold,
  parchment: themeTokens.colors.base.parchment,
  parchmentDark: themeTokens.colors.base.parchmentDark,
  smoke: themeTokens.colors.base.smoke,
  woodMid: themeTokens.colors.base.bronze,
  woodDark: themeTokens.colors.base.smokedWood,
  cyan: themeTokens.colors.ki.cyan,
  soulViolet: themeTokens.colors.ki.soulViolet,
  rift: themeTokens.colors.ki.rift,
  porcelainPink: themeTokens.colors.ki.porcelainPink,
  white: themeTokens.colors.base.white,
  black: themeTokens.colors.base.black,
  disabledBg: themeTokens.colors.base.disabledBg,
  disabledBorder: themeTokens.colors.base.disabledBorder,
  disabledText: themeTokens.colors.base.disabledText,
  ok: themeTokens.colors.semantic.ok,
  warning: themeTokens.colors.semantic.warning,
  danger: themeTokens.colors.semantic.danger,
};

// Base Colors (Numeric representations for PixiJS graphics) derived from theme.json
export const COLOR_NUM = {
  inkCrypt: hexToNum(themeTokens.colors.base.inkCrypt),
  smokedWood: hexToNum(themeTokens.colors.base.smokedWood),
  bronze: hexToNum(themeTokens.colors.base.bronze),
  gold: hexToNum(themeTokens.colors.base.gold),
  parchment: hexToNum(themeTokens.colors.base.parchment),
  parchmentDark: hexToNum(themeTokens.colors.base.parchmentDark),
  smoke: hexToNum(themeTokens.colors.base.smoke),
  woodMid: hexToNum(themeTokens.colors.base.bronze),
  woodDark: hexToNum(themeTokens.colors.base.smokedWood),
  cyan: hexToNum(themeTokens.colors.ki.cyan),
  soulViolet: hexToNum(themeTokens.colors.ki.soulViolet),
  rift: hexToNum(themeTokens.colors.ki.rift),
  porcelainPink: hexToNum(themeTokens.colors.ki.porcelainPink),
  white: hexToNum(themeTokens.colors.base.white),
  black: hexToNum(themeTokens.colors.base.black),
  disabledBg: hexToNum(themeTokens.colors.base.disabledBg),
  disabledBorder: hexToNum(themeTokens.colors.base.disabledBorder),
  disabledText: hexToNum(themeTokens.colors.base.disabledText),
};

// Semantic status colors for HP, stats, etc.
export const COLOR_SEMANTIC = {
  ok: hexToNum(themeTokens.colors.semantic.ok),
  warning: hexToNum(themeTokens.colors.semantic.warning),
  danger: hexToNum(themeTokens.colors.semantic.danger),
  info: hexToNum(themeTokens.colors.semantic.info),
};

// Stat box colors from theme.json
export const COLOR_STATS = {
  hp: {
    bg: hexToNum(themeTokens.colors.stats.hp.bg),
    border: hexToNum(themeTokens.colors.stats.hp.border),
    labelHex: themeTokens.colors.stats.hp.label,
  },
  atk: {
    bg: hexToNum(themeTokens.colors.stats.atk.bg),
    border: hexToNum(themeTokens.colors.stats.atk.border),
    labelHex: themeTokens.colors.stats.atk.label,
  },
  def: {
    bg: hexToNum(themeTokens.colors.stats.def.bg),
    border: hexToNum(themeTokens.colors.stats.def.border),
    labelHex: themeTokens.colors.stats.def.label,
  },
  spAtk: {
    bg: hexToNum(themeTokens.colors.stats.spAtk.bg),
    border: hexToNum(themeTokens.colors.stats.spAtk.border),
    labelHex: themeTokens.colors.stats.spAtk.label,
  },
  spDef: {
    bg: hexToNum(themeTokens.colors.stats.spDef.bg),
    border: hexToNum(themeTokens.colors.stats.spDef.border),
    labelHex: themeTokens.colors.stats.spDef.label,
  },
  speed: {
    bg: hexToNum(themeTokens.colors.stats.speed.bg),
    border: hexToNum(themeTokens.colors.stats.speed.border),
    labelHex: themeTokens.colors.stats.speed.label,
  },
};

// Rarezas
export const COLOR_RARITY = {
  comun: hexToNum(themeTokens.colors.rarity.comun),
  pocoComun: hexToNum(themeTokens.colors.rarity.pocoComun),
  poco_comun: hexToNum(themeTokens.colors.rarity.pocoComun),
  rara: hexToNum(themeTokens.colors.rarity.rara),
  epica: hexToNum(themeTokens.colors.rarity.epica),
  legendaria: hexToNum(themeTokens.colors.rarity.legendaria),
};

// Elementos
export const COLOR_ELEMENT = {
  fuego: {
    primary: hexToNum(themeTokens.colors.elements.fuego.primary),
    secondary: hexToNum(themeTokens.colors.elements.fuego.secondary),
  },
  agua: {
    primary: hexToNum(themeTokens.colors.elements.agua.primary),
    secondary: hexToNum(themeTokens.colors.elements.agua.secondary),
  },
  planta: {
    primary: hexToNum(themeTokens.colors.elements.planta.primary),
    secondary: hexToNum(themeTokens.colors.elements.planta.secondary),
  },
  electrico: {
    primary: hexToNum(themeTokens.colors.elements.electrico.primary),
    secondary: hexToNum(themeTokens.colors.elements.electrico.secondary),
  },
  tierra: {
    primary: hexToNum(themeTokens.colors.elements.tierra.primary),
    secondary: hexToNum(themeTokens.colors.elements.tierra.secondary),
  },
  sombra: {
    primary: hexToNum(themeTokens.colors.elements.sombra.primary),
    secondary: hexToNum(themeTokens.colors.elements.sombra.secondary),
  },
  neutro: {
    primary: hexToNum(themeTokens.colors.elements.neutro.primary),
    secondary: hexToNum(themeTokens.colors.elements.neutro.secondary),
  },
};

// Typographies (strictly from theme.json, no generic monospace or system fonts)
export const FONTS = {
  title: themeTokens.typography.titleFont,
  body: themeTokens.typography.bodyFont,
  hud: themeTokens.typography.hudFont,
  damage: themeTokens.typography.damageFont,
};

// Preset TextStyles
export const TEXT_STYLES = {
  logo: new TextStyle({
    fontFamily: FONTS.title,
    fontSize: themeTokens.typography.sizes.title,
    fontWeight: '900',
    fill: COLOR_HEX.parchment,
    letterSpacing: 4,
  }),
  button: new TextStyle({
    fontFamily: FONTS.hud,
    fontSize: themeTokens.typography.sizes.md,
    fontWeight: 'bold',
    fill: COLOR_HEX.parchment,
  }),
  dialogueSpeaker: new TextStyle({
    fontFamily: FONTS.title,
    fontSize: themeTokens.typography.sizes.md,
    fontWeight: 'bold',
    fill: COLOR_HEX.gold,
  }),
  dialogueBody: new TextStyle({
    fontFamily: FONTS.body,
    fontSize: themeTokens.typography.sizes.sm,
    fill: COLOR_HEX.parchment,
    lineHeight: 20,
  }),
};

// Spacing scale
export const SPACING = themeTokens.spacing;

// Corners Radii
export const RADII = themeTokens.radii;

// Z-Order Layers
export const Z_LAYERS = themeTokens.layers;
