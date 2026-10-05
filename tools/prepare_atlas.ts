/**
 * Script de Preparación y Validación de Atlas (Bloque 33: Taller & Bloque 34: Mercado)
 * - Taller: Chroma-key tablero de ajedrez
 * - Mercado: Chroma-key fondo gris liso, limpieza de halo y máscara de texto 'PUERTA'
 * - Guarda PNGs con canal alfa real y valida frames
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number];
  tile?: boolean;
  flat?: boolean;
  glow?: boolean;
  ppu?: number;
}

interface AtlasJson {
  image: string;
  size: [number, number] | { w: number; h: number };
  ppu?: number;
  frames: Record<string, AtlasFrame>;
}

export function prepareTallerAtlas(): boolean {
  const rootDir = process.cwd();
  const inputJpg = path.resolve(rootDir, 'Assets/Build1.jpg');
  const outputPngPublic = path.resolve(rootDir, 'public/Assets/Build1.png');
  const outputPngAssets = path.resolve(rootDir, 'Assets/Build1.png');
  const outputAtlasPublic = path.resolve(rootDir, 'public/Assets/taller_atlas.png');
  const outputAtlasAssets = path.resolve(rootDir, 'Assets/taller_atlas.png');
  const outputAtlasRootPublic = path.resolve(rootDir, 'public/taller_atlas.png');
  const atlasJsonPath = path.resolve(rootDir, 'data/art/taller_atlas.json');

  if (!fs.existsSync(inputJpg)) {
    console.error(`❌ [prepareTallerAtlas] No se encontró el archivo de entrada: ${inputJpg}`);
    return false;
  }

  console.log(`\n🔍 [prepareTallerAtlas] Procesando atlas Taller: ${inputJpg}...`);
  const rawJpg = fs.readFileSync(inputJpg);
  const decoded = jpeg.decode(rawJpg, { useTArray: true });
  const { width, height, data } = decoded;

  console.log(`📐 [prepareTallerAtlas] Dimensiones: ${width}x${height} px`);

  function isCheckerboard(r: number, g: number, b: number): boolean {
    const isNeutral = Math.abs(r - g) <= 18 && Math.abs(g - b) <= 18 && Math.abs(r - b) <= 18;
    const isLightSquare = r >= 200 && g >= 200 && b >= 200;
    const isMidSquare = r >= 115 && r <= 165 && g >= 115 && g <= 165 && b >= 115 && b <= 165;
    return isNeutral && (isLightSquare || isMidSquare);
  }

  const png = new PNG({ width, height });
  let transparentCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (isCheckerboard(r, g, b)) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
      transparentCount++;
    } else {
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }

  const totalPixels = width * height;
  const transparentPct = Math.round((transparentCount / totalPixels) * 100);
  console.log(`🎨 [prepareTallerAtlas] Píxeles eliminados: ${transparentCount}/${totalPixels} (${transparentPct}%)`);

  const pngBuffer = PNG.sync.write(png);
  [outputPngPublic, outputPngAssets, outputAtlasPublic, outputAtlasAssets, outputAtlasRootPublic].forEach((file) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pngBuffer);
  });
  console.log(`💾 [prepareTallerAtlas] Guardado en taller_atlas.png y Build1.png`);

  return validateAtlasFrames('Taller', atlasJsonPath, png);
}

export function prepareMercadoAtlas(): boolean {
  const rootDir = process.cwd();
  const inputJpg = path.resolve(rootDir, 'Assets/Shop.jpg');
  const outputAtlasPublic = path.resolve(rootDir, 'public/Assets/mercado_atlas.png');
  const outputAtlasAssets = path.resolve(rootDir, 'Assets/mercado_atlas.png');
  const outputAtlasRootPublic = path.resolve(rootDir, 'public/mercado_atlas.png');
  const atlasJsonPath = path.resolve(rootDir, 'data/art/mercado_atlas.json');

  if (!fs.existsSync(inputJpg)) {
    console.error(`❌ [prepareMercadoAtlas] No se encontró el archivo de entrada: ${inputJpg}`);
    return false;
  }

  console.log(`\n🔍 [prepareMercadoAtlas] Procesando atlas Mercado: ${inputJpg}...`);
  const rawJpg = fs.readFileSync(inputJpg);
  const decoded = jpeg.decode(rawJpg, { useTArray: true });
  const { width, height, data } = decoded;

  console.log(`📐 [prepareMercadoAtlas] Dimensiones: ${width}x${height} px`);

  // 1. Sustitución de rótulo 'PUERTA' por versión sin texto (máscara de textura de madera)
  // Rótulo PUERTA en dintel de puerta: x: 314..410, y: 270..284
  for (let y = 270; y <= 284; y++) {
    for (let x = 314; x <= 410; x++) {
      const srcIdx = (268 * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      data[dstIdx] = data[srcIdx];
      data[dstIdx + 1] = data[srcIdx + 1];
      data[dstIdx + 2] = data[srcIdx + 2];
    }
  }

  // 2. Chroma-key de fondo gris liso (r≈195, g≈195, b≈195) con tolerancia y limpieza de halo
  function isSmoothGrey(r: number, g: number, b: number): boolean {
    const isNeutral = Math.abs(r - g) <= 15 && Math.abs(g - b) <= 15 && Math.abs(r - b) <= 15;
    const isTargetGrey = r >= 170 && r <= 220 && g >= 170 && g <= 220 && b >= 170 && b <= 220;
    return isNeutral && isTargetGrey;
  }

  const png = new PNG({ width, height });
  let transparentCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (isSmoothGrey(r, g, b)) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
      transparentCount++;
    } else {
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }

  const totalPixels = width * height;
  const transparentPct = Math.round((transparentCount / totalPixels) * 100);
  console.log(`🎨 [prepareMercadoAtlas] Píxeles de fondo gris eliminados: ${transparentCount}/${totalPixels} (${transparentPct}%)`);

  const pngBuffer = PNG.sync.write(png);
  [outputAtlasPublic, outputAtlasAssets, outputAtlasRootPublic].forEach((file) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pngBuffer);
  });
  console.log(`💾 [prepareMercadoAtlas] Guardado en mercado_atlas.png`);

  return validateAtlasFrames('Mercado', atlasJsonPath, png);
}

function validateAtlasFrames(name: string, atlasJsonPath: string, png: PNG): boolean {
  if (!fs.existsSync(atlasJsonPath)) {
    console.warn(`⚠️ [${name}] No se encontró el JSON del atlas en: ${atlasJsonPath}`);
    return false;
  }

  const rawJson: AtlasJson = JSON.parse(fs.readFileSync(atlasJsonPath, 'utf-8'));
  const frames = rawJson.frames;
  const { width, height } = png;
  let allFramesValid = true;

  console.log(`\n📋 [${name}] Validando ${Object.keys(frames).length} frames del atlas:`);

  for (const [frameName, frame] of Object.entries(frames)) {
    if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > width || frame.y + frame.h > height) {
      console.error(`❌ Frame '${frameName}' se sale de los límites de la imagen (${width}x${height}): x=${frame.x}, y=${frame.y}, w=${frame.w}, h=${frame.h}`);
      allFramesValid = false;
      continue;
    }

    let nonTransparentPixels = 0;
    for (let py = 0; py < frame.h; py++) {
      for (let px = 0; px < frame.w; px++) {
        const idx = ((frame.y + py) * width + (frame.x + px)) * 4;
        if (png.data[idx + 3] > 30) {
          nonTransparentPixels++;
        }
      }
    }

    const totalFramePx = frame.w * frame.h;
    const solidRatio = Math.round((nonTransparentPixels / totalFramePx) * 100);

    if (nonTransparentPixels === 0) {
      console.warn(`⚠️ Frame '${frameName}' está completamente transparente o vacío (0 px sólidos).`);
      allFramesValid = false;
    } else {
      console.log(`  ✓ '${frameName}': ${frame.w}x${frame.h} px en (${frame.x}, ${frame.y}) - ${solidRatio}% sólido (${nonTransparentPixels} px)`);
    }
  }

  if (allFramesValid) {
    console.log(`✅ [${name}] Todos los frames han sido validados con éxito.\n`);
  }
  return allFramesValid;
}

export function prepareOverworldDecorAtlas(
  targetGrey: [number, number, number] = [191, 191, 191],
  tolerance = 18,
  haloRange = 46
): boolean {
  const rootDir = process.cwd();
  const inputJpg = path.resolve(rootDir, 'Assets/Floresypasto.jpg');
  const outputAtlasPublic = path.resolve(rootDir, 'public/Assets/overworld_decor_atlas.png');
  const outputAtlasAssets = path.resolve(rootDir, 'Assets/overworld_decor_atlas.png');
  const outputAtlasRootPublic = path.resolve(rootDir, 'public/overworld_decor_atlas.png');
  const atlasJsonPath = path.resolve(rootDir, 'data/art/overworld_decor_atlas.json');

  if (!fs.existsSync(inputJpg)) {
    console.error(`❌ [prepareOverworldDecorAtlas] No se encontró el archivo de entrada: ${inputJpg}`);
    return false;
  }

  console.log(`\n🔍 [prepareOverworldDecorAtlas] Procesando atlas Decorados Overworld: ${inputJpg}...`);
  const rawJpg = fs.readFileSync(inputJpg);
  const decoded = jpeg.decode(rawJpg, { useTArray: true });
  const { width, height, data } = decoded;

  console.log(`📐 [prepareOverworldDecorAtlas] Dimensiones: ${width}x${height} px`);

  const [bgR, bgG, bgB] = targetGrey;
  const png = new PNG({ width, height });
  let transparentCount = 0;
  let haloCleanedCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const saturation = maxC - minC;

    // Pure background grey
    if (dist <= tolerance && saturation <= 16) {
      png.data[i] = 0;
      png.data[i + 1] = 0;
      png.data[i + 2] = 0;
      png.data[i + 3] = 0;
      transparentCount++;
    } else if (dist < haloRange && saturation < 38) {
      // Halo de-spill: alpha proportional to distance from background grey
      const rawAlpha = Math.max(0, Math.min(1, (dist - tolerance) / (haloRange - tolerance)));
      // Unmix background grey from RGB so glowing mushrooms/fireflies don't have muddy grey borders
      const invA = Math.max(0.25, rawAlpha);
      const cleanR = Math.max(0, Math.min(255, Math.round((r - bgR * (1 - invA)) / invA)));
      const cleanG = Math.max(0, Math.min(255, Math.round((g - bgG * (1 - invA)) / invA)));
      const cleanB = Math.max(0, Math.min(255, Math.round((b - bgB * (1 - invA)) / invA)));

      // If alpha is very weak and mostly grey halo, discard so additive glow sprite handles it cleanly
      if (rawAlpha < 0.45 && saturation < 26) {
        png.data[i] = 0;
        png.data[i + 1] = 0;
        png.data[i + 2] = 0;
        png.data[i + 3] = 0;
        transparentCount++;
      } else {
        png.data[i] = cleanR;
        png.data[i + 1] = cleanG;
        png.data[i + 2] = cleanB;
        png.data[i + 3] = Math.round(rawAlpha * 255);
        haloCleanedCount++;
      }
    } else {
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }

  const totalPixels = width * height;
  const transparentPct = Math.round((transparentCount / totalPixels) * 100);
  console.log(
    `🎨 [prepareOverworldDecorAtlas] Fondo eliminado: ${transparentCount}/${totalPixels} (${transparentPct}%), píxeles de halo limpiados: ${haloCleanedCount}`
  );

  const pngBuffer = PNG.sync.write(png);
  [outputAtlasPublic, outputAtlasAssets, outputAtlasRootPublic].forEach((file) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pngBuffer);
  });
  console.log(`💾 [prepareOverworldDecorAtlas] Guardado en overworld_decor_atlas.png`);

  return validateAtlasFrames('OverworldDecor', atlasJsonPath, png);
}

export function prepareBattleSpritesheet(
  targetGreen: [number, number, number] = [26, 174, 6],
  tolerance = 58,
  targetNativeHeight = 160
): boolean {
  const rootDir = process.cwd();
  const inputJpg = path.resolve(rootDir, 'Assets/524060170_1790895365875586.jpg');
  const outputAtlasPublic = path.resolve(rootDir, 'public/Assets/maga_battle_sheet.png');
  const outputAtlasAssets = path.resolve(rootDir, 'Assets/maga_battle_sheet.png');
  const outputAtlasRootPublic = path.resolve(rootDir, 'public/maga_battle_sheet.png');
  const outputJsonPath = path.resolve(rootDir, 'data/art/maga_battle_atlas.json');
  const outputPublicJsonPath = path.resolve(rootDir, 'public/data/art/maga_battle_atlas.json');

  if (!fs.existsSync(inputJpg)) {
    console.error(`❌ [prepareBattleSpritesheet] No se encontró el archivo de entrada: ${inputJpg}`);
    return false;
  }

  console.log(`\n🔍 [prepareBattleSpritesheet] Procesando hoja de combate: ${inputJpg}...`);
  const rawJpg = fs.readFileSync(inputJpg);
  const decoded = jpeg.decode(rawJpg, { useTArray: true });
  const { width, height, data } = decoded;
  console.log(`📐 [prepareBattleSpritesheet] Dimensiones fuente: ${width}x${height} px`);

  const [bgR, bgG, bgB] = targetGreen;

  // 1. Chroma-key del verde + Despill de halo (en bordes, g = max(r, b))
  const keyed = new Uint8Array(width * height * 4);
  let transparentCount = 0;
  let despilledCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
    const greenExcess = g - Math.max(r, b);

    if (dist <= tolerance || (greenExcess > 48 && g > 95 && r < 115 && b < 115)) {
      keyed[i] = 0;
      keyed[i + 1] = 0;
      keyed[i + 2] = 0;
      keyed[i + 3] = 0;
      transparentCount++;
    } else {
      let cleanG = g;
      // Despill: si el píxel tiene contaminación de halo verde en bordes, g = max(r, b)
      if (greenExcess > 12) {
        cleanG = Math.max(r, b);
        despilledCount++;
      }
      keyed[i] = r;
      keyed[i + 1] = cleanG;
      keyed[i + 2] = b;
      keyed[i + 3] = 255;
    }
  }

  // Segunda pasada de despill en píxeles adyacentes a transparentes (borde de 2 px)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      if (keyed[idx + 3] === 0) continue;

      let nearTransparent = false;
      for (let dy = -2; dy <= 2 && !nearTransparent; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (keyed[(ny * width + nx) * 4 + 3] === 0) {
              nearTransparent = true;
              break;
            }
          }
        }
      }

      if (nearTransparent) {
        const r = keyed[idx];
        const g = keyed[idx + 1];
        const b = keyed[idx + 2];
        if (g > Math.max(r, b)) {
          keyed[idx + 1] = Math.max(r, b);
          despilledCount++;
        }
      }
    }
  }

  console.log(
    `🎨 [prepareBattleSpritesheet] Chroma-key verde completado: ${transparentCount} px transparentes, ${despilledCount} px con despill (g = max(r,b)).`
  );

  // 2. Detectar las 4 vistas por componentes conectados del canal alpha (sin cajas fijas)
  // Primero agrupamos columnas no vacías y luego filtramos el componente conectado principal de cada vista
  const colOpaqueCounts = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (keyed[(y * width + x) * 4 + 3] > 0) count++;
    }
    colOpaqueCounts[x] = count;
  }

  const colSegments: Array<[number, number]> = [];
  let inSeg = false;
  let segStart = 0;
  for (let x = 0; x < width; x++) {
    if (colOpaqueCounts[x] > 5) {
      if (!inSeg) {
        inSeg = true;
        segStart = x;
      }
    } else if (inSeg) {
      if (x - segStart > 20) colSegments.push([segStart, x - 1]);
      inSeg = false;
    }
  }
  if (inSeg && width - segStart > 20) {
    colSegments.push([segStart, width - 1]);
  }

  console.log(`✂️ [prepareBattleSpritesheet] Vistas detectadas por componentes conectados / columnas: ${colSegments.length}`);

  // 3. Detectar tamaño de "píxel" del arte y verificar uniformidad (mixels)
  const runHistogram = new Map<number, number>();
  for (let y = 150; y < height - 150; y += 4) {
    let run = 1;
    for (let x = 90; x < width - 90; x++) {
      const i1 = (y * width + x) * 4;
      const i2 = (y * width + x - 1) * 4;
      if (keyed[i1 + 3] === 0) {
        run = 1;
        continue;
      }
      const d =
        Math.abs(keyed[i1] - keyed[i2]) +
        Math.abs(keyed[i1 + 1] - keyed[i2 + 1]) +
        Math.abs(keyed[i1 + 2] - keyed[i2 + 2]);
      if (d < 22) {
        run++;
      } else {
        if (run >= 3 && run <= 18) {
          runHistogram.set(run, (runHistogram.get(run) || 0) + 1);
        }
        run = 1;
      }
    }
  }

  const topRuns = [...runHistogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const hasMixels = topRuns.length > 1 && topRuns[1][1] > topRuns[0][1] * 0.45;

  const rawViewHeight = 1412;
  const blockSizeFloat = rawViewHeight / targetNativeHeight;
  console.log(
    `🔬 [prepareBattleSpritesheet] Tamaño de bloque detectado: ~${blockSizeFloat.toFixed(2)} px (runs dominantes: ${topRuns
      .map(([r, c]) => `${r}px:${c}`)
      .join(', ')})`
  );
  if (hasMixels) {
    console.warn(
      `⚠️ [prepareBattleSpritesheet] AVISO MIXELS: El arte fuente presenta bloques de píxel de tamaño no uniforme (ej. runs de ${topRuns
        .map((r) => r[0] + 'px')
        .join(' y ')}). Se normalizará por mediana/moda de bloque a cuadrícula uniforme de ~${targetNativeHeight} px de alto.`
    );
  }

  // Bloque 38 Req 1:
  // Col 0: view_front34 (rostro y pecho visibles, mira hacia la DERECHA en el arte original)
  // Col 1: view_front (perfil/frontal secundaria)
  // Col 2: view_back (espalda simétrica)
  // Col 3: view_back34 (de espaldas, nuca visible, mira hacia la IZQUIERDA en el arte original)
  const viewNames = ['view_front34', 'view_front', 'view_back', 'view_back34'];

  interface CroppedView {
    name: string;
    width: number;
    height: number;
    pixels: Uint8Array;
    sourceRect: [number, number, number, number];
  }

  const processedViews: CroppedView[] = [];

  for (let vIdx = 0; vIdx < colSegments.length; vIdx++) {
    const [minCol, maxCol] = colSegments[vIdx];
    const viewName = viewNames[vIdx] || `view_${vIdx}`;

    // Encontrar el bounding box del componente conectado de píxeles opacos dentro de este segmento
    let minX = maxCol;
    let maxX = minCol;
    let minY = height - 1;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = minCol; x <= maxCol; x++) {
        if (keyed[(y * width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const srcW = maxX - minX + 1;
    const srcH = maxY - minY + 1;

    // Reducción por bloques (mediana/moda por bloque, NUNCA bilineal) a alto nativo ~160 px
    const scaleFactor = srcH / targetNativeHeight;
    const nativeW = Math.max(1, Math.round(srcW / scaleFactor));
    const nativeH = Math.max(1, Math.round(srcH / scaleFactor));

    // Añadimos 1 px de padding transparente alrededor (Req 1: "con 1 px de padding")
    const outW = nativeW + 2;
    const outH = nativeH + 2;
    const outPixels = new Uint8Array(outW * outH * 4);

    for (let ny = 0; ny < nativeH; ny++) {
      const sy0 = minY + Math.floor(ny * scaleFactor);
      const sy1 = Math.min(maxY, minY + Math.floor((ny + 1) * scaleFactor));

      for (let nx = 0; nx < nativeW; nx++) {
        const sx0 = minX + Math.floor(nx * scaleFactor);
        const sx1 = Math.min(maxX, minX + Math.floor((nx + 1) * scaleFactor));

        let opaqueCount = 0;
        let totalCount = 0;
        const rList: number[] = [];
        const gList: number[] = [];
        const bList: number[] = [];
        const colorBuckets = new Map<number, { count: number; r: number; g: number; b: number }>();

        for (let sy = sy0; sy <= sy1; sy++) {
          for (let sx = sx0; sx <= sx1; sx++) {
            totalCount++;
            const idx = (sy * width + sx) * 4;
            if (keyed[idx + 3] > 128) {
              opaqueCount++;
              const r = keyed[idx];
              const g = keyed[idx + 1];
              const b = keyed[idx + 2];
              rList.push(r);
              gList.push(g);
              bList.push(b);

              const qKey = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
              const bucket = colorBuckets.get(qKey);
              if (bucket) {
                bucket.count++;
              } else {
                colorBuckets.set(qKey, { count: 1, r, g, b });
              }
            }
          }
        }

        const dstIdx = ((ny + 1) * outW + (nx + 1)) * 4;
        if (opaqueCount * 2 >= totalCount && opaqueCount > 0) {
          let bestBucket: { count: number; r: number; g: number; b: number } | null = null;
          for (const bkt of colorBuckets.values()) {
            if (!bestBucket || bkt.count > bestBucket.count) {
              bestBucket = bkt;
            }
          }

          if (bestBucket && bestBucket.count >= opaqueCount * 0.4) {
            outPixels[dstIdx] = bestBucket.r;
            outPixels[dstIdx + 1] = bestBucket.g;
            outPixels[dstIdx + 2] = bestBucket.b;
            outPixels[dstIdx + 3] = 255;
          } else {
            rList.sort((a, b) => a - b);
            gList.sort((a, b) => a - b);
            bList.sort((a, b) => a - b);
            const mid = Math.floor(rList.length / 2);
            outPixels[dstIdx] = rList[mid];
            outPixels[dstIdx + 1] = gList[mid];
            outPixels[dstIdx + 2] = bList[mid];
            outPixels[dstIdx + 3] = 255;
          }
        }
      }
    }

    processedViews.push({
      name: viewName,
      width: outW,
      height: outH,
      pixels: outPixels,
      sourceRect: [minX, minY, srcW, srcH],
    });

    console.log(
      `  ✓ Vista '${viewName}': fuente (${minX}..${maxX}, ${minY}..${maxY}) [${srcW}x${srcH}] -> nativo ${outW}x${outH} px (con 1px padding)`
    );
  }

  // Empaquetar las vistas en un atlas PNG limpio con separación de 2 px
  const gap = 2;
  const totalOutWidth = processedViews.reduce((acc, v) => acc + v.width, 0) + gap * Math.max(0, processedViews.length - 1);
  const totalOutHeight = Math.max(...processedViews.map((v) => v.height));

  const outPng = new PNG({ width: totalOutWidth, height: totalOutHeight });
  const framesMeta: Record<
    string,
    {
      x: number;
      y: number;
      w: number;
      h: number;
      anchor: [number, number];
      sourceRect: [number, number, number, number];
      mirrorSafe: boolean;
      native: boolean;
      note?: string;
      idle: {
        neck: number;
        waist: number;
        bust?: { y0: number; y1: number; x0: number; x1: number };
      };
    }
  > = {};

  const defaultIdleByView: Record<
    string,
    { neck: number; waist: number; bust?: { y0: number; y1: number; x0: number; x1: number } }
  > = {
    view_front: {
      neck: 0.31,
      waist: 0.48,
      bust: { y0: 0.34, y1: 0.46, x0: 0.30, x1: 0.70 },
    },
    view_front34: {
      neck: 0.30,
      waist: 0.48,
      bust: { y0: 0.33, y1: 0.46, x0: 0.28, x1: 0.72 },
    },
    view_back: {
      neck: 0.30,
      waist: 0.48,
    },
    view_back34: {
      neck: 0.30,
      waist: 0.48,
    },
  };

  let cursorX = 0;
  for (const view of processedViews) {
    for (let y = 0; y < view.height; y++) {
      for (let x = 0; x < view.width; x++) {
        const srcIdx = (y * view.width + x) * 4;
        const dstIdx = (y * totalOutWidth + (cursorX + x)) * 4;
        outPng.data[dstIdx] = view.pixels[srcIdx];
        outPng.data[dstIdx + 1] = view.pixels[srcIdx + 1];
        outPng.data[dstIdx + 2] = view.pixels[srcIdx + 2];
        outPng.data[dstIdx + 3] = view.pixels[srcIdx + 3];
      }
    }

    // Req 3 (Bloque 38) & Req 1 (Bloque 39): idle neck/waist/bust per view
    framesMeta[view.name] = {
      x: cursorX,
      y: 0,
      w: view.width,
      h: view.height,
      anchor: [0.5, 1.0],
      sourceRect: view.sourceRect,
      mirrorSafe: false,
      native: false,
      note: 'Asimetría de diseño: el brazo del guantelete/arma cambia de lado al aplicar flipX.',
      idle: defaultIdleByView[view.name] || { neck: 0.30, waist: 0.48 },
    };
    cursorX += view.width + gap;
  }

  const pngBuffer = PNG.sync.write(outPng);
  [outputAtlasPublic, outputAtlasAssets, outputAtlasRootPublic].forEach((file) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pngBuffer);
  });

  const atlasJson = {
    image: '/Assets/maga_battle_sheet.png',
    size: [totalOutWidth, totalOutHeight],
    nativeTargetHeightPx: targetNativeHeight,
    hasMixelsInSource: hasMixels,
    sourcePixelBlockApprox: Number(blockSizeFloat.toFixed(2)),
    mirrorSafe: false,
    asymmetryNote: 'El brazo del guantelete cambia de lado al espejar horizontalmente (flipX: true).',
    frames: framesMeta,
  };

  [outputJsonPath, outputPublicJsonPath].forEach((jsonFile) => {
    fs.mkdirSync(path.dirname(jsonFile), { recursive: true });
    fs.writeFileSync(jsonFile, JSON.stringify(atlasJson, null, 2));
  });

  console.log(`💾 [prepareBattleSpritesheet] Guardado en maga_battle_sheet.png (${totalOutWidth}x${totalOutHeight} px) y maga_battle_atlas.json\n`);
  return true;
}

export function prepareAtlas(): boolean {
  const tallerOk = prepareTallerAtlas();
  const mercadoOk = prepareMercadoAtlas();
  const decorOk = prepareOverworldDecorAtlas();
  const battleOk = prepareBattleSpritesheet();
  return tallerOk && mercadoOk && decorOk && battleOk;
}

// Ejecución CLI directa
if (import.meta.url === `file://${process.argv[1]}`) {
  prepareAtlas();
}
