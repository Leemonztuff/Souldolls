/**
 * Generador y configurador de Hojas de Batalla y Atlas para las 14 especies de Souldolls.
 * Procesa las 9 poses definitivas (idle, relaxed, attack, attack_impact, casting, casting_release, damage, down, victory)
 * y genera para cada especie:
 * - /public/assets/souldolls/<speciesId>_battle_sheet.png
 * - /src/data/art/souldolls/<speciesId>_battle_atlas.json
 * - /public/data/art/souldolls/<speciesId>_battle_atlas.json
 * - /public/data/art/souldolls_sprites_manifest.json y /src/data/art/souldolls_sprites_manifest.json
 *
 * Busca hojas individuales en assets/raw/spritesheets/<speciesId>_spritesheet.webp (o .png)
 * y si no existen, toma el master sheet (assets/raw/spritesheet.webp) aplicando paletas y equipo característico.
 * Deja preparada la configuración para la vista trasera cuando se añadan los sheets de espalda.
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PNG } from 'pngjs';

export const POSE_NAMES = [
  'idle',
  'relaxed',
  'attack',
  'attack_impact',
  'casting',
  'casting_release',
  'damage',
  'victory',
  'down',
] as const;

export type PoseName = (typeof POSE_NAMES)[number];

interface IdleBustBox {
  y0: number;
  y1: number;
  x0: number;
  x1: number;
}

interface IdleBandMeta {
  neck: number;
  waist: number;
  bust?: IdleBustBox;
}

interface FrameMeta {
  x: number;
  y: number;
  w: number;
  h: number;
  anchor: [number, number];
  sourceRect?: [number, number, number, number];
  mirrorSafe: boolean;
  native: boolean;
  note: string;
  isBackFallback?: boolean;
  idle?: IdleBandMeta;
}

interface SpeciesVisualProfile {
  speciesId: string;
  name: string;
  element: string;
  primaryRgb: [number, number, number];
  secondaryRgb: [number, number, number];
  accentHex: [number, number, number];
  darkTrimRgb: [number, number, number];
  weaponType:
    | 'baston_ignis'
    | 'cetro_piroclastico'
    | 'vara_sauce'
    | 'baculo_solaria'
    | 'guantelete_piedra'
    | 'guantelete_titan'
    | 'grimorio_polvo'
    | 'tomo_arcano'
    | 'tridente_coral'
    | 'arpa_abismal'
    | 'guantes_chispa'
    | 'nunchaku_rayo'
    | 'daga_penumbra'
    | 'guadana_vacio';
  headgearType:
    | 'witch_hat_fire'
    | 'tiara_ignis'
    | 'willow_wreath'
    | 'solar_crown'
    | 'bronze_crest'
    | 'titan_crown'
    | 'pointed_witch_hat'
    | 'star_veil_tiara'
    | 'coral_diadem'
    | 'pearl_crown'
    | 'monk_headband'
    | 'thunder_halo'
    | 'shadow_hood'
    | 'void_crown';
  isAscended: boolean;
}

const SPECIES_FRAME_INDEX_MAP: Record<string, number> = {
  maga: 8,
  archimaga: 1,
  sacerdotisa: 2,
  hierofante: 3,
  gladiadora: 4,
  titanide: 0,
  bruja: 6,
  hechicera: 7,
  hidromante: 5,
  cantora_marea: 9,
  monje: 10,
  maestro_trueno: 11,
  asesina: 12,
  espectro: 13,
};

const SPECIES_PROFILES: SpeciesVisualProfile[] = [
  {
    speciesId: 'maga',
    name: 'Maga',
    element: 'Fuego',
    primaryRgb: [235, 75, 42],
    secondaryRgb: [255, 165, 62],
    accentHex: [255, 214, 102],
    darkTrimRgb: [92, 34, 24],
    weaponType: 'baston_ignis',
    headgearType: 'witch_hat_fire',
    isAscended: false,
  },
  {
    speciesId: 'archimaga',
    name: 'Archimaga',
    element: 'Fuego',
    primaryRgb: [198, 34, 34],
    secondaryRgb: [245, 158, 11],
    accentHex: [254, 240, 138],
    darkTrimRgb: [69, 16, 16],
    weaponType: 'cetro_piroclastico',
    headgearType: 'tiara_ignis',
    isAscended: true,
  },
  {
    speciesId: 'sacerdotisa',
    name: 'Sacerdotisa',
    element: 'Planta',
    primaryRgb: [46, 178, 86],
    secondaryRgb: [164, 238, 130],
    accentHex: [242, 230, 201],
    darkTrimRgb: [22, 82, 42],
    weaponType: 'vara_sauce',
    headgearType: 'willow_wreath',
    isAscended: false,
  },
  {
    speciesId: 'hierofante',
    name: 'Hierofante',
    element: 'Planta',
    primaryRgb: [28, 148, 72],
    secondaryRgb: [232, 184, 74],
    accentHex: [200, 242, 138],
    darkTrimRgb: [16, 68, 34],
    weaponType: 'baculo_solaria',
    headgearType: 'solar_crown',
    isAscended: true,
  },
  {
    speciesId: 'gladiadora',
    name: 'Gladiadora',
    element: 'Tierra',
    primaryRgb: [176, 122, 69],
    secondaryRgb: [224, 194, 140],
    accentHex: [232, 184, 74],
    darkTrimRgb: [78, 48, 24],
    weaponType: 'guantelete_piedra',
    headgearType: 'bronze_crest',
    isAscended: false,
  },
  {
    speciesId: 'titanide',
    name: 'Titánide',
    element: 'Tierra',
    primaryRgb: [146, 88, 38],
    secondaryRgb: [232, 184, 74],
    accentHex: [255, 236, 160],
    darkTrimRgb: [58, 32, 14],
    weaponType: 'guantelete_titan',
    headgearType: 'titan_crown',
    isAscended: true,
  },
  {
    speciesId: 'bruja',
    name: 'Bruja',
    element: 'Neutro',
    primaryRgb: [148, 76, 224],
    secondaryRgb: [216, 180, 254],
    accentHex: [95, 227, 210],
    darkTrimRgb: [58, 26, 98],
    weaponType: 'grimorio_polvo',
    headgearType: 'pointed_witch_hat',
    isAscended: false,
  },
  {
    speciesId: 'hechicera',
    name: 'Hechicera',
    element: 'Neutro',
    primaryRgb: [122, 48, 208],
    secondaryRgb: [232, 184, 74],
    accentHex: [233, 213, 255],
    darkTrimRgb: [44, 16, 82],
    weaponType: 'tomo_arcano',
    headgearType: 'star_veil_tiara',
    isAscended: true,
  },
  {
    speciesId: 'hidromante',
    name: 'Hidromante',
    element: 'Agua',
    primaryRgb: [48, 158, 238],
    secondaryRgb: [168, 230, 255],
    accentHex: [95, 227, 210],
    darkTrimRgb: [20, 66, 112],
    weaponType: 'tridente_coral',
    headgearType: 'coral_diadem',
    isAscended: false,
  },
  {
    speciesId: 'cantora_marea',
    name: 'Cantora de Marea',
    element: 'Agua',
    primaryRgb: [24, 118, 204],
    secondaryRgb: [140, 224, 255],
    accentHex: [242, 230, 201],
    darkTrimRgb: [14, 48, 88],
    weaponType: 'arpa_abismal',
    headgearType: 'pearl_crown',
    isAscended: true,
  },
  {
    speciesId: 'monje',
    name: 'Monje',
    element: 'Eléctrico',
    primaryRgb: [238, 190, 44],
    secondaryRgb: [255, 246, 176],
    accentHex: [95, 227, 210],
    darkTrimRgb: [92, 64, 14],
    weaponType: 'guantes_chispa',
    headgearType: 'monk_headband',
    isAscended: false,
  },
  {
    speciesId: 'maestro_trueno',
    name: 'Maestro del Trueno',
    element: 'Eléctrico',
    primaryRgb: [214, 154, 24],
    secondaryRgb: [255, 242, 130],
    accentHex: [255, 255, 255],
    darkTrimRgb: [72, 46, 10],
    weaponType: 'nunchaku_rayo',
    headgearType: 'thunder_halo',
    isAscended: true,
  },
  {
    speciesId: 'asesina',
    name: 'Asesina',
    element: 'Sombra',
    primaryRgb: [86, 68, 128],
    secondaryRgb: [184, 148, 246],
    accentHex: [194, 35, 75],
    darkTrimRgb: [28, 22, 44],
    weaponType: 'daga_penumbra',
    headgearType: 'shadow_hood',
    isAscended: false,
  },
  {
    speciesId: 'espectro',
    name: 'Espectro',
    element: 'Sombra',
    primaryRgb: [64, 40, 116],
    secondaryRgb: [199, 155, 255],
    accentHex: [95, 227, 210],
    darkTrimRgb: [18, 12, 32],
    weaponType: 'guadana_vacio',
    headgearType: 'void_crown',
    isAscended: true,
  },
];

function setPixel(
  png: PNG,
  x: number,
  y: number,
  rgb: [number, number, number],
  alpha = 255
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= png.width || iy < 0 || iy >= png.height) return;
  const idx = (iy * png.width + ix) * 4;
  png.data[idx] = rgb[0];
  png.data[idx + 1] = rgb[1];
  png.data[idx + 2] = rgb[2];
  png.data[idx + 3] = alpha;
}

function fillRect(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
  alpha = 255
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const x1 = x0 + Math.round(w);
  const y1 = y0 + Math.round(h);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      setPixel(png, px, py, rgb, alpha);
    }
  }
}

function applyPaletteTransformToRegion(
  png: PNG,
  frame: FrameMeta,
  profile: SpeciesVisualProfile
): void {
  if (profile.speciesId === 'maga') return;

  const [pR, pG, pB] = profile.primaryRgb;
  const [sR, sG, sB] = profile.secondaryRgb;
  const [dR, dG, dB] = profile.darkTrimRgb;

  const headBottomY = frame.y + Math.round(frame.h * 0.25);

  for (let y = frame.y; y < frame.y + frame.h; y++) {
    for (let x = frame.x; x < frame.x + frame.w; x++) {
      const idx = (y * png.width + x) * 4;
      const a = png.data[idx + 3];
      if (a < 16) continue;

      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];

      const isWarmSkin = r > 228 && g >= 132 && g <= 210 && b >= 80 && b <= 142 && r > g + 35 && g > b + 20;
      const isTopHatCone = y < frame.y + Math.round(frame.h * 0.13);
      if (isWarmSkin && !isTopHatCone) {
        continue;
      }

      const isWhiteGarment = y >= headBottomY && r > 215 && g > 215 && b > 205 && Math.abs(r - g) < 20;
      const isGreyGarmentFold =
        y >= headBottomY &&
        r >= 135 &&
        r <= 205 &&
        g >= 140 &&
        g <= 205 &&
        b >= 135 &&
        b <= 205 &&
        Math.abs(r - g) < 18 &&
        Math.abs(g - b) < 18;

      const isCrimsonHairOrRibbon = r > 165 && g < 122 && b < 105 && r > g * 1.55;
      const isDarkHatOrCape = r > 55 && b > 50 && g < Math.min(r, b) * 0.88;

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 185;

      if (isWhiteGarment || isGreyGarmentFold) {
        const mixR = sR * 0.65 + pR * 0.35;
        const mixG = sG * 0.65 + pG * 0.35;
        const mixB = sB * 0.65 + pB * 0.35;
        const clothLum = (0.299 * r + 0.587 * g + 0.114 * b) / 235;
        png.data[idx] = Math.min(255, Math.max(0, Math.round(mixR * clothLum)));
        png.data[idx + 1] = Math.min(255, Math.max(0, Math.round(mixG * clothLum)));
        png.data[idx + 2] = Math.min(255, Math.max(0, Math.round(mixB * clothLum)));
      } else if (isTopHatCone && isWarmSkin) {
        png.data[idx] = Math.min(255, Math.max(0, Math.round(pR * lum)));
        png.data[idx + 1] = Math.min(255, Math.max(0, Math.round(pG * lum)));
        png.data[idx + 2] = Math.min(255, Math.max(0, Math.round(pB * lum)));
      } else if (isCrimsonHairOrRibbon) {
        png.data[idx] = Math.min(255, Math.max(0, Math.round(pR * lum)));
        png.data[idx + 1] = Math.min(255, Math.max(0, Math.round(pG * lum)));
        png.data[idx + 2] = Math.min(255, Math.max(0, Math.round(pB * lum)));
      } else if (isDarkHatOrCape) {
        png.data[idx] = Math.min(255, Math.max(0, Math.round((dR * 0.65 + pR * 0.35) * lum)));
        png.data[idx + 1] = Math.min(255, Math.max(0, Math.round((dG * 0.65 + pG * 0.35) * lum)));
        png.data[idx + 2] = Math.min(255, Math.max(0, Math.round((dB * 0.65 + pB * 0.35) * lum)));
      }
    }
  }
}

function drawSignatureEquipmentOnFrame(
  png: PNG,
  frameName: string,
  frame: FrameMeta,
  profile: SpeciesVisualProfile
): void {
  const isBack = frame.isBackFallback || frameName === 'view_back' || frameName === 'view_back34';
  const handX = frame.x + Math.round(frame.w * 0.76);
  const handY = frame.y + Math.round(frame.h * 0.56);
  const headX = frame.x + Math.round(frame.w * 0.5);
  const headY = frame.y + Math.round(frame.h * 0.14);

  const woodShaft: [number, number, number] = [72, 42, 22];
  const bronzeMetal: [number, number, number] = [138, 106, 59];
  const goldMetal: [number, number, number] = [232, 184, 74];
  const darkOutline: [number, number, number] = [20, 16, 28];

  // 1. Tocado / Corona distintiva por especie
  if (!isBack && frameName !== 'down') {
    switch (profile.headgearType) {
      case 'tiara_ignis':
      case 'solar_crown':
      case 'titan_crown':
      case 'star_veil_tiara':
      case 'pearl_crown':
      case 'void_crown': {
        fillRect(png, headX - 10, headY - 2, 20, 3, goldMetal);
        fillRect(png, headX - 7, headY - 5, 3, 3, profile.secondaryRgb);
        fillRect(png, headX - 1, headY - 7, 3, 5, profile.accentHex);
        fillRect(png, headX + 5, headY - 5, 3, 3, profile.secondaryRgb);
        break;
      }
      case 'willow_wreath': {
        fillRect(png, headX - 11, headY, 22, 3, profile.primaryRgb);
        fillRect(png, headX - 7, headY - 1, 3, 3, profile.secondaryRgb);
        fillRect(png, headX + 4, headY - 1, 3, 3, profile.accentHex);
        break;
      }
      case 'coral_diadem': {
        fillRect(png, headX - 9, headY, 18, 3, profile.primaryRgb);
        fillRect(png, headX - 2, headY - 3, 4, 5, profile.secondaryRgb);
        break;
      }
      case 'monk_headband':
      case 'thunder_halo': {
        fillRect(png, headX - 10, headY + 1, 20, 3, profile.secondaryRgb);
        if (profile.isAscended) {
          fillRect(png, headX - 12, headY - 6, 3, 4, profile.accentHex);
          fillRect(png, headX + 9, headY - 6, 3, 4, profile.accentHex);
        }
        break;
      }
      default:
        break;
    }
  }

  // 2. Arma característica en la mano (para poses activas)
  if (frameName === 'idle' || frameName === 'attack' || frameName === 'attack_impact' || frameName === 'casting' || frameName === 'victory') {
    switch (profile.weaponType) {
      case 'baston_ignis':
      case 'cetro_piroclastico': {
        fillRect(png, handX - 2, handY - 34, 4, 58, darkOutline);
        fillRect(png, handX - 1, handY - 33, 2, 56, woodShaft);
        fillRect(png, handX - 4, handY - 36, 8, 3, bronzeMetal);
        fillRect(png, handX - 5, handY - 45, 10, 9, profile.primaryRgb);
        fillRect(png, handX - 2, handY - 43, 4, 5, profile.secondaryRgb);
        if (profile.isAscended) {
          fillRect(png, handX - 8, handY - 42, 3, 5, goldMetal);
          fillRect(png, handX + 5, handY - 42, 3, 5, goldMetal);
        }
        break;
      }
      case 'vara_sauce':
      case 'baculo_solaria': {
        fillRect(png, handX - 2, handY - 32, 4, 56, woodShaft);
        fillRect(png, handX - 7, handY - 38, 10, 4, woodShaft);
        fillRect(png, handX - 10, handY - 41, 5, 4, profile.primaryRgb);
        fillRect(png, handX + 2, handY - 42, 5, 4, profile.primaryRgb);
        fillRect(png, handX - 4, handY - 44, 6, 6, profile.secondaryRgb);
        if (profile.isAscended) {
          fillRect(png, handX - 2, handY - 48, 4, 4, goldMetal);
        }
        break;
      }
      case 'tridente_coral':
      case 'arpa_abismal': {
        fillRect(png, handX - 2, handY - 30, 4, 54, profile.darkTrimRgb);
        fillRect(png, handX - 8, handY - 34, 16, 3, profile.primaryRgb);
        fillRect(png, handX - 8, handY - 45, 3, 12, profile.primaryRgb);
        fillRect(png, handX - 1, handY - 49, 3, 16, profile.secondaryRgb);
        fillRect(png, handX + 5, handY - 45, 3, 12, profile.primaryRgb);
        break;
      }
      case 'grimorio_polvo':
      case 'tomo_arcano': {
        fillRect(png, handX - 9, handY - 22, 16, 20, darkOutline);
        fillRect(png, handX - 8, handY - 21, 14, 18, profile.primaryRgb);
        fillRect(png, handX - 6, handY - 19, 10, 14, [242, 230, 201]);
        fillRect(png, handX - 3, handY - 15, 4, 6, profile.accentHex);
        if (profile.isAscended) {
          fillRect(png, handX - 10, handY - 28, 3, 3, goldMetal);
          fillRect(png, handX + 6, handY - 28, 3, 3, goldMetal);
        }
        break;
      }
      case 'guantelete_piedra':
      case 'guantelete_titan': {
        fillRect(png, handX - 7, handY - 10, 13, 16, darkOutline);
        fillRect(png, handX - 6, handY - 9, 11, 14, profile.primaryRgb);
        fillRect(png, handX - 4, handY - 7, 7, 5, goldMetal);
        break;
      }
      case 'guantes_chispa':
      case 'nunchaku_rayo': {
        fillRect(png, handX - 5, handY - 14, 9, 12, profile.primaryRgb);
        fillRect(png, handX - 3, handY - 22, 4, 8, profile.secondaryRgb);
        fillRect(png, handX + 2, handY - 26, 3, 6, profile.accentHex);
        break;
      }
      case 'daga_penumbra':
      case 'guadana_vacio': {
        fillRect(png, handX - 2, handY - 34, 3, 52, darkOutline);
        fillRect(png, handX - 1, handY - 38, 12, 5, profile.secondaryRgb);
        fillRect(png, handX + 6, handY - 35, 4, 10, profile.accentHex);
        break;
      }
    }
  }
}

interface RawSlice {
  name: PoseName;
  width: number;
  height: number;
  pixels: Uint8Array;
  sourceRect: [number, number, number, number];
}

async function loadAndSliceRawSheet(rawPath: string): Promise<RawSlice[]> {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;

  // Helper to extract and trim a rectangular region (rx0..rx1, ry0..ry1)
  const extractRectSlice = (
    name: PoseName,
    rx0: number,
    ry0: number,
    rx1: number,
    ry1: number
  ): RawSlice => {
    let minX = rx1;
    let maxX = rx0;
    let minY = ry1;
    let maxY = ry0;
    let hasPixels = false;

    for (let y = ry0; y <= ry1; y++) {
      for (let x = rx0; x <= rx1; x++) {
        const a = data[(y * W + x) * 4 + 3];
        if (a > 16) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) {
      minX = rx0;
      maxX = rx1;
      minY = ry0;
      maxY = ry1;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const padding = 1;
    const outW = cropW + padding * 2;
    const outH = cropH + padding * 2;
    const outPixels = new Uint8Array(outW * outH * 4);

    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const srcIdx = ((minY + py) * W + (minX + px)) * 4;
        const dstIdx = ((py + padding) * outW + (px + padding)) * 4;
        outPixels[dstIdx] = data[srcIdx];
        outPixels[dstIdx + 1] = data[srcIdx + 1];
        outPixels[dstIdx + 2] = data[srcIdx + 2];
        outPixels[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return {
      name,
      width: outW,
      height: outH,
      pixels: outPixels,
      sourceRect: [minX, minY, cropW, cropH],
    };
  };

  // 0. Si la hoja es una cuadrícula cuadrada 3x3 (ej. 388x388 con 3 filas x 3 columnas = 9 frames del 1 al 9):
  //    - Fila 1: Frame 1 (idle), Frame 2 (relaxed), Frame 3 (attack)
  //    - Fila 2: Frame 4 (attack_impact), Frame 5 (casting / reservado), Frame 6 (casting_release / reservado)
  //    - Fila 3: Frame 7 (damage), Frame 8 (victory), Frame 9 (down)
  if (Math.abs(W - H) <= 8 && W >= 300) {
    const cellW = Math.floor(W / 3);
    const cellH = Math.floor(H / 3);
    const gridSlices: RawSlice[] = [];
    for (let i = 0; i < 9; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const rx0 = col * cellW;
      const ry0 = row * cellH;
      const rx1 = col === 2 ? W - 1 : (col + 1) * cellW - 1;
      const ry1 = row === 2 ? H - 1 : (row + 1) * cellH - 1;
      gridSlices.push(extractRectSlice(POSE_NAMES[i], rx0, ry0, rx1, ry1));
    }
    return gridSlices;
  }

  // 1. Detect contiguous segments of non-transparent columns
  const colDensity = new Array(W).fill(0);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (data[(y * W + x) * 4 + 3] > 16) {
        colDensity[x]++;
      }
    }
  }

  const detectedSegments: Array<{ startX: number; endX: number; width: number }> = [];
  let inSeg = false;
  let startX = 0;
  for (let x = 0; x < W; x++) {
    if (colDensity[x] > 0) {
      if (!inSeg) {
        inSeg = true;
        startX = x;
      }
    } else {
      if (inSeg) {
        inSeg = false;
        // Ignore noise smaller than 3px wide
        if (x - startX >= 3) {
          detectedSegments.push({ startX, endX: x - 1, width: x - startX });
        }
      }
    }
  }
  if (inSeg && W - startX >= 3) {
    detectedSegments.push({ startX, endX: W - 1, width: W - startX });
  }

  // Fallback if no segments found or image is completely opaque background
  if (detectedSegments.length === 0) {
    const defaultCols = 9;
    const colW = W / defaultCols;
    for (let i = 0; i < defaultCols; i++) {
      detectedSegments.push({
        startX: Math.floor(i * colW),
        endX: Math.min(W - 1, Math.floor((i + 1) * colW) - 1),
        width: Math.floor(colW),
      });
    }
  }

  // Helper to extract a single slice from bounds
  const extractSlice = (name: PoseName, sx0: number, sx1: number): RawSlice => {
    let minX = sx1;
    let maxX = sx0;
    let minY = H - 1;
    let maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < H; y++) {
      for (let x = sx0; x <= sx1; x++) {
        const a = data[(y * W + x) * 4 + 3];
        if (a > 16) {
          hasPixels = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasPixels) {
      minX = sx0;
      maxX = sx1;
      minY = 0;
      maxY = H - 1;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const padding = 1;
    const outW = cropW + padding * 2;
    const outH = cropH + padding * 2;
    const outPixels = new Uint8Array(outW * outH * 4);

    for (let py = 0; py < cropH; py++) {
      for (let px = 0; px < cropW; px++) {
        const srcIdx = ((minY + py) * W + (minX + px)) * 4;
        const dstIdx = ((py + padding) * outW + (px + padding)) * 4;
        outPixels[dstIdx] = data[srcIdx];
        outPixels[dstIdx + 1] = data[srcIdx + 1];
        outPixels[dstIdx + 2] = data[srcIdx + 2];
        outPixels[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    return {
      name,
      width: outW,
      height: outH,
      pixels: outPixels,
      sourceRect: [minX, minY, cropW, cropH],
    };
  };

  const slices: RawSlice[] = [];
  const numSegs = detectedSegments.length;

  if (numSegs >= 9) {
    // 9 or more frames: 1:1 mapping for all 9 poses
    for (let f = 0; f < 9; f++) {
      const seg = detectedSegments[f];
      slices.push(extractSlice(POSE_NAMES[f], seg.startX, seg.endX));
    }
  } else if (numSegs === 5) {
    // 5 frames layout: idle, relaxed, attack, damage, down
    // Map to all 9 required poses cleanly
    const segIdle = detectedSegments[0];
    const segRelaxed = detectedSegments[1];
    const segAttack = detectedSegments[2];
    const segDamage = detectedSegments[3];
    const segDown = detectedSegments[4];

    slices.push(extractSlice('idle', segIdle.startX, segIdle.endX));
    slices.push(extractSlice('relaxed', segRelaxed.startX, segRelaxed.endX));
    slices.push(extractSlice('attack', segAttack.startX, segAttack.endX));
    slices.push(extractSlice('attack_impact', segAttack.startX, segAttack.endX));
    slices.push(extractSlice('casting', segAttack.startX, segAttack.endX));
    slices.push(extractSlice('casting_release', segDamage.startX, segDamage.endX));
    slices.push(extractSlice('damage', segDamage.startX, segDamage.endX));
    slices.push(extractSlice('victory', segIdle.startX, segIdle.endX));
    slices.push(extractSlice('down', segDown.startX, segDown.endX));
  } else {
    // Dynamic fallback for any other number of segments
    for (let f = 0; f < 9; f++) {
      const segIndex = Math.min(numSegs - 1, Math.floor((f / 9) * numSegs));
      const seg = detectedSegments[segIndex];
      slices.push(extractSlice(POSE_NAMES[f], seg.startX, seg.endX));
    }
  }

  return slices;
}

function packSlicesIntoPngAndFrames(slices: RawSlice[]): {
  png: PNG;
  frames: Record<string, FrameMeta>;
} {
  let totalW = 0;
  let maxH = 0;
  slices.forEach((s) => {
    totalW += s.width + 2;
    if (s.height > maxH) maxH = s.height;
  });

  const png = new PNG({ width: totalW, height: maxH });
  const frames: Record<string, FrameMeta> = {};

  let curX = 0;
  slices.forEach((s) => {
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const srcIdx = (y * s.width + x) * 4;
        const dstIdx = (y * totalW + (curX + x)) * 4;
        png.data[dstIdx] = s.pixels[srcIdx];
        png.data[dstIdx + 1] = s.pixels[srcIdx + 1];
        png.data[dstIdx + 2] = s.pixels[srcIdx + 2];
        png.data[dstIdx + 3] = s.pixels[srcIdx + 3];
      }
    }

    const isIdle = s.name === 'idle';
    const isRelaxed = s.name === 'relaxed';

    frames[s.name] = {
      x: curX,
      y: 0,
      w: s.width,
      h: s.height,
      anchor: [0.5, 1.0],
      sourceRect: s.sourceRect,
      mirrorSafe: false,
      native: true,
      note: `Pose ${s.name} definitiva`,
      idle: isIdle
        ? {
            neck: 0.31,
            waist: 0.48,
            bust: { y0: 0.34, y1: 0.46, x0: 0.3, x1: 0.7 },
          }
        : isRelaxed
        ? {
            neck: 0.3,
            waist: 0.48,
            bust: { y0: 0.33, y1: 0.46, x0: 0.28, x1: 0.72 },
          }
        : undefined,
    };

    curX += s.width + 2;
  });

  // Alias de compatibilidad hacia atrás:
  // El Frame 1 es idle (vista frontal 3/4). Ya no hay vista frontal plana ni de lado, sólo frontal 3/4.
  const idleFrame = frames['idle'];

  frames['view_front34'] = { ...idleFrame, note: '3/4 Frontal (Frame 1 idle)' };
  frames['view_front'] = { ...idleFrame, note: 'Frontal (alias a 3/4 frontal / Frame 1 idle)' };
  frames['view_side'] = { ...idleFrame, note: 'Lateral (alias a 3/4 frontal / Frame 1 idle)' };

  // Vista trasera temporalmente configurada con la delantera (frontal 3/4) pero lista para switch futuro (isBackFallback: true)
  frames['view_back'] = {
    ...idleFrame,
    isBackFallback: true,
    note: 'Vista trasera configurada provisionalmente con frontal 3/4 (preparada para switch futuro)',
  };
  frames['view_back34'] = {
    ...idleFrame,
    isBackFallback: true,
    note: 'Vista 3/4 trasera configurada provisionalmente con frontal 3/4 (preparada para switch futuro)',
  };

  frames['front'] = frames['view_front34'];
  frames['back'] = frames['view_back34'];
  frames['side_r'] = frames['view_front34'];
  frames['side_l'] = frames['view_back34'];

  return { png, frames };
}

export async function generateAllSoulDollSheets(): Promise<boolean> {
  const rootDir = process.cwd();
  const rawSpritesheetsDir = path.resolve(rootDir, 'assets/raw/spritesheets');
  if (!fs.existsSync(rawSpritesheetsDir)) {
    fs.mkdirSync(rawSpritesheetsDir, { recursive: true });
  }

  const manifestEntries: Array<{
    speciesId: string;
    name: string;
    element: string;
    sourceRawSheet: string;
    sheetPath: string;
    atlasPath: string;
    size: [number, number];
    views: string[];
    idleSupported: boolean;
  }> = [];

  for (const profile of SPECIES_PROFILES) {
    const frameIdx = SPECIES_FRAME_INDEX_MAP[profile.speciesId];
    const frameNumStr = frameIdx !== undefined ? String(frameIdx).padStart(3, '0') : null;
    const specificCandidates = [
      ...(frameNumStr
        ? [
            path.resolve(rawSpritesheetsDir, `frame_${frameNumStr}.png`),
            path.resolve(rawSpritesheetsDir, `frame_${frameNumStr}.webp`),
          ]
        : []),
      path.resolve(rawSpritesheetsDir, `${profile.speciesId}_spritesheet.webp`),
      path.resolve(rawSpritesheetsDir, `${profile.speciesId}_spritesheet.png`),
      path.resolve(rawSpritesheetsDir, `${profile.speciesId}.webp`),
      path.resolve(rawSpritesheetsDir, `${profile.speciesId}.png`),
    ];
    const specificPath = specificCandidates.find((p) => fs.existsSync(p));

    if (!specificPath) {
      console.error(
        `❌ [generateAllSoulDollSheets] No se encontró spritesheet dedicado para ${profile.speciesId}`
      );
      return false;
    }

    const relRawSheet = `assets/raw/spritesheets/${path.basename(specificPath)}`;
    console.log(
      `✨ [generateAllSoulDollSheets] ${profile.speciesId} -> ${relRawSheet}`
    );
    const specificSlices = await loadAndSliceRawSheet(specificPath);
    const packed = packSlicesIntoPngAndFrames(specificSlices);
    const speciesPng = packed.png;
    const speciesFrames = packed.frames;

    const outBuffer = PNG.sync.write(speciesPng);
    const relSheetUrl = `/assets/souldolls/${profile.speciesId}_battle_sheet.png`;
    const relAtlasUrl = `/data/art/souldolls/${profile.speciesId}_battle_atlas.json`;

    const pngTargets = [
      path.resolve(rootDir, `public/assets/souldolls/${profile.speciesId}_battle_sheet.png`),
      path.resolve(rootDir, `dist/assets/souldolls/${profile.speciesId}_battle_sheet.png`),
    ];
    for (const pTarget of pngTargets) {
      fs.mkdirSync(path.dirname(pTarget), { recursive: true });
      fs.writeFileSync(pTarget, outBuffer);
    }

    const speciesAtlas = {
      speciesId: profile.speciesId,
      name: profile.name,
      element: profile.element,
      sourceRawSheet: relRawSheet,
      image: relSheetUrl,
      size: [speciesPng.width, speciesPng.height],
      nativeTargetHeightPx: speciesPng.height,
      mirrorSafe: false,
      asymmetryNote: 'El brazo del arma cambia de lado al espejar horizontalmente (flipX: true).',
      hasBackSheet: false, // Flag que indica si ya se suministró vista trasera nativa
      frames: speciesFrames,
    };

    const jsonTargets = [
      path.resolve(rootDir, `public/data/art/souldolls/${profile.speciesId}_battle_atlas.json`),
      path.resolve(rootDir, `src/data/art/souldolls/${profile.speciesId}_battle_atlas.json`),
      path.resolve(rootDir, `dist/data/art/souldolls/${profile.speciesId}_battle_atlas.json`),
    ];
    for (const j of jsonTargets) {
      fs.mkdirSync(path.dirname(j), { recursive: true });
      fs.writeFileSync(j, JSON.stringify(speciesAtlas, null, 2));
    }

    // Copiar también maga_battle_atlas legacy si es maga
    if (profile.speciesId === 'maga') {
      const magaLegacyTargets = [
        path.resolve(rootDir, 'public/data/art/maga_battle_atlas.json'),
        path.resolve(rootDir, 'dist/data/art/maga_battle_atlas.json'),
      ];
      for (const mTarget of magaLegacyTargets) {
        fs.mkdirSync(path.dirname(mTarget), { recursive: true });
        fs.writeFileSync(mTarget, JSON.stringify(speciesAtlas, null, 2));
      }
    }

    manifestEntries.push({
      speciesId: profile.speciesId,
      name: profile.name,
      element: profile.element,
      sourceRawSheet: relRawSheet,
      sheetPath: relSheetUrl,
      atlasPath: relAtlasUrl,
      size: [speciesPng.width, speciesPng.height],
      views: Object.keys(speciesFrames),
      idleSupported: true,
    });

    console.log(`✅ [generateAllSoulDollSheets] ${profile.speciesId} (${profile.name}): ${speciesPng.width}x${speciesPng.height} px`);
  }

  const manifestJson = {
    version: '2.1.0',
    totalSpecies: manifestEntries.length,
    poses: POSE_NAMES,
    defaultViews: manifestEntries[0]?.views || POSE_NAMES,
    species: Object.fromEntries(manifestEntries.map((e) => [e.speciesId, e])),
  };

  const manifestTargets = [
    path.resolve(rootDir, 'public/data/art/souldolls_sprites_manifest.json'),
    path.resolve(rootDir, 'src/data/art/souldolls_sprites_manifest.json'),
    path.resolve(rootDir, 'dist/data/art/souldolls_sprites_manifest.json'),
  ];
  for (const m of manifestTargets) {
    fs.mkdirSync(path.dirname(m), { recursive: true });
    fs.writeFileSync(m, JSON.stringify(manifestJson, null, 2));
  }

  console.log(`\n🎨 [generateAllSoulDollSheets] 14/14 hojas de 9 poses y manifiesto generados con éxito.`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllSoulDollSheets();
}
