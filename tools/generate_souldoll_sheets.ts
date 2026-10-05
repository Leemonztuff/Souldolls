/**
 * Generador y configurador de Hojas de Batalla y Atlas para las 14 especies de Souldolls.
 * Produce para cada especie (maga, archimaga, sacerdotisa, hierofante, gladiadora, titanide,
 * bruja, hechicera, hidromante, cantora_marea, monje, maestro_trueno, asesina, espectro):
 * - /public/assets/souldolls/<speciesId>_battle_sheet.png
 * - /src/data/art/souldolls/<speciesId>_battle_atlas.json
 * - /public/data/art/souldolls/<speciesId>_battle_atlas.json
 * - /public/data/art/souldolls_sprites_manifest.json y /src/data/art/souldolls_sprites_manifest.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import { prepareBattleSpritesheet } from './prepare_atlas';

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
  idle: IdleBandMeta;
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

      // 1. Piel cálida / durazno (en el spritesheet de 5 vistas: R ~235..255, G ~135..200, B ~85..135)
      const isWarmSkin = r > 228 && g >= 132 && g <= 210 && b >= 80 && b <= 142 && r > g + 35 && g > b + 20;
      // En la parte superior de la cabeza (sombrero puntiagudo, y < 13% del alto), ese tono naranja es el sombrero, no piel
      const isTopHatCone = y < frame.y + Math.round(frame.h * 0.13);
      if (isWarmSkin && !isTopHatCone) {
        continue;
      }

      // 2. Blanco/crema del atuendo (corsé/top y falda: R>215, G>215, B>205) y pliegues grises (R~145..195, G~150..195, B~145..195)
      // Excluir la esclerótica de los ojos en la zona de la cara (y < 25%)
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

      // 3. Rojo/carmesí del cabello, cintas y bordes del sombrero (R ~175..238, G ~65..118, B ~60..98)
      const isCrimsonHairOrRibbon = r > 165 && g < 122 && b < 105 && r > g * 1.55;
      const isDarkHatOrCape = r > 55 && b > 50 && g < Math.min(r, b) * 0.88;

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 185;

      if (isWhiteGarment || isGreyGarmentFold) {
        // Teñir el atuendo blanco/gris con una mezcla luminosa del color secundario y primario de la clase
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
  const isBack = frameName === 'view_back' || frameName === 'view_back34';
  const handX =
    frameName === 'view_side'
      ? frame.x + Math.round(frame.w * 0.72)
      : frameName === 'view_front34'
      ? frame.x + Math.round(frame.w * 0.78)
      : frame.x + Math.round(frame.w * 0.82);
  const handY = frame.y + Math.round(frame.h * 0.56);
  const headX = frame.x + Math.round(frame.w * 0.5);
  const headY = frame.y + Math.round(frame.h * 0.14);

  const woodShaft: [number, number, number] = [72, 42, 22];
  const bronzeMetal: [number, number, number] = [138, 106, 59];
  const goldMetal: [number, number, number] = [232, 184, 74];
  const darkOutline: [number, number, number] = [20, 16, 28];

  // 1. Tocado / Corona distintiva por especie
  if (!isBack) {
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

  // 2. Arma característica en la mano
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
      // Tomo arcano / grimorio flotante con páginas iluminadas y sello de ki
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

export function generateAllSoulDollSheets(): boolean {
  const rootDir = process.cwd();

  // 1. Regenerar maga_battle_sheet.png y maga_battle_atlas.json desde el spritesheet fuente actual (5 vistas WebP)
  prepareBattleSpritesheet();
  const basePngPath = path.resolve(rootDir, 'public/assets/souldolls/maga_battle_sheet.png');
  const baseJsonPath = path.resolve(rootDir, 'src/data/art/souldolls/maga_battle_atlas.json');

  const baseBuffer = fs.readFileSync(basePngPath);
  const basePng = PNG.sync.read(baseBuffer);
  const baseAtlas = JSON.parse(fs.readFileSync(baseJsonPath, 'utf-8'));

  const manifestEntries: Array<{
    speciesId: string;
    name: string;
    element: string;
    sheetPath: string;
    atlasPath: string;
    size: [number, number];
    views: string[];
    idleSupported: boolean;
  }> = [];

  for (const profile of SPECIES_PROFILES) {
    // Clonar PNG base
    const outPng = new PNG({ width: basePng.width, height: basePng.height });
    basePng.data.copy(outPng.data);

    const frames: Record<string, FrameMeta> = JSON.parse(JSON.stringify(baseAtlas.frames));

    for (const [viewName, frame] of Object.entries(frames)) {
      applyPaletteTransformToRegion(outPng, frame, profile);
      drawSignatureEquipmentOnFrame(outPng, viewName, frame, profile);
    }

    const outBuffer = PNG.sync.write(outPng);
    const relSheetUrl = `/assets/souldolls/${profile.speciesId}_battle_sheet.png`;
    const relAtlasUrl = `/data/art/souldolls/${profile.speciesId}_battle_atlas.json`;

    const pngTarget = path.resolve(
      rootDir,
      `public/assets/souldolls/${profile.speciesId}_battle_sheet.png`
    );
    fs.mkdirSync(path.dirname(pngTarget), { recursive: true });
    fs.writeFileSync(pngTarget, outBuffer);

    const speciesAtlas = {
      speciesId: profile.speciesId,
      name: profile.name,
      element: profile.element,
      image: relSheetUrl,
      size: [outPng.width, outPng.height],
      nativeTargetHeightPx: baseAtlas.nativeTargetHeightPx || 160,
      mirrorSafe: false,
      asymmetryNote: baseAtlas.asymmetryNote,
      frames,
    };

    const jsonTargets = [
      path.resolve(rootDir, `public/data/art/souldolls/${profile.speciesId}_battle_atlas.json`),
      path.resolve(rootDir, `src/data/art/souldolls/${profile.speciesId}_battle_atlas.json`),
    ];
    for (const j of jsonTargets) {
      fs.mkdirSync(path.dirname(j), { recursive: true });
      fs.writeFileSync(j, JSON.stringify(speciesAtlas, null, 2));
    }

    manifestEntries.push({
      speciesId: profile.speciesId,
      name: profile.name,
      element: profile.element,
      sheetPath: relSheetUrl,
      atlasPath: relAtlasUrl,
      size: [outPng.width, outPng.height],
      views: Object.keys(frames),
      idleSupported: true,
    });

    console.log(
      `✅ [generateAllSoulDollSheets] ${profile.speciesId} (${profile.name}): ${relSheetUrl} + ${relAtlasUrl}`
    );
  }

  const manifestJson = {
    version: '1.1.0',
    totalSpecies: manifestEntries.length,
    defaultViews: Object.keys(baseAtlas.frames),
    species: Object.fromEntries(manifestEntries.map((e) => [e.speciesId, e])),
  };

  const manifestTargets = [
    path.resolve(rootDir, 'public/data/art/souldolls_sprites_manifest.json'),
    path.resolve(rootDir, 'src/data/art/souldolls_sprites_manifest.json'),
  ];
  for (const m of manifestTargets) {
    fs.mkdirSync(path.dirname(m), { recursive: true });
    fs.writeFileSync(m, JSON.stringify(manifestJson, null, 2));
  }

  console.log(
    `\n🎨 [generateAllSoulDollSheets] 14/14 hojas de Souldolls y manifiesto guardados correctamente.`
  );
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllSoulDollSheets();
}
