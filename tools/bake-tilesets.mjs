#!/usr/bin/env node
/**
 * BLOQUE 44 Req. 3: Horneado offline de Tilesets (/tools/bake-tilesets.mjs)
 * - Descompone cada autotile en cuartos de tile (TILE_PX/2) y genera TODAS las variantes de forma una sola vez:
 *   - Suelo A2: 47 formas canónicas por autotile
 *   - Agua A1: 47 formas x 3 frames animados por autotile
 *   - Muros y Fachadas A3/A4: 16 formas por autotile
 *   - Tiles normales A5 y objetos B-E: empaquetados directamente
 * - Añade extrusión de 1 px alrededor de cada tile del atlas para evitar sangrado entre celdas vecinas.
 * - Garantiza que ningún atlas horneado supere 2048x2048 px (apto para GPU móvil).
 * - Emite el atlas PNG horneado y el índice JSON de variantes en /public/assets/tilesets/<packId>/baked_atlas.png
 *   y /src/data/tilesets/<packId>_baked.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { generateAnimaCorePackSheets } from './generate-pack-sheets.mjs';

const ROOT = process.cwd();
const artConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config/art.json'), 'utf8'));

const NEIGHBOR_BIT = { N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128 };

function normalizeAutotileMask8(rawMask) {
  const n = (rawMask & NEIGHBOR_BIT.N) !== 0;
  const e = (rawMask & NEIGHBOR_BIT.E) !== 0;
  const s = (rawMask & NEIGHBOR_BIT.S) !== 0;
  const w = (rawMask & NEIGHBOR_BIT.W) !== 0;
  let canonical = 0;
  if (n) canonical |= NEIGHBOR_BIT.N;
  if (e) canonical |= NEIGHBOR_BIT.E;
  if (s) canonical |= NEIGHBOR_BIT.S;
  if (w) canonical |= NEIGHBOR_BIT.W;
  if (n && e && (rawMask & NEIGHBOR_BIT.NE) !== 0) canonical |= NEIGHBOR_BIT.NE;
  if (s && e && (rawMask & NEIGHBOR_BIT.SE) !== 0) canonical |= NEIGHBOR_BIT.SE;
  if (s && w && (rawMask & NEIGHBOR_BIT.SW) !== 0) canonical |= NEIGHBOR_BIT.SW;
  if (n && w && (rawMask & NEIGHBOR_BIT.NW) !== 0) canonical |= NEIGHBOR_BIT.NW;
  return canonical;
}

const CANONICAL_47_MASKS = (() => {
  const set = new Set();
  for (let m = 0; m < 256; m++) set.add(normalizeAutotileMask8(m));
  return Array.from(set).sort((a, b) => {
    if (a === 255) return -1;
    if (b === 255) return 1;
    if (a === 0) return 1;
    if (b === 0) return -1;
    return b - a;
  });
})();

function getFloorAutotileQuarters(shapeIndex) {
  const mask = CANONICAL_47_MASKS[Math.max(0, Math.min(46, shapeIndex))] ?? 0;
  const n = (mask & NEIGHBOR_BIT.N) !== 0;
  const ne = (mask & NEIGHBOR_BIT.NE) !== 0;
  const e = (mask & NEIGHBOR_BIT.E) !== 0;
  const se = (mask & NEIGHBOR_BIT.SE) !== 0;
  const s = (mask & NEIGHBOR_BIT.S) !== 0;
  const sw = (mask & NEIGHBOR_BIT.SW) !== 0;
  const w = (mask & NEIGHBOR_BIT.W) !== 0;
  const nw = (mask & NEIGHBOR_BIT.NW) !== 0;

  const tl = !n && !w ? [0, 2] : !n && w ? [2, 2] : n && !w ? [0, 4] : !nw ? [2, 0] : [2, 4];
  const tr = !n && !e ? [3, 2] : !n && e ? [1, 2] : n && !e ? [3, 4] : !ne ? [3, 0] : [1, 4];
  const bl = !s && !w ? [0, 5] : !s && w ? [2, 5] : s && !w ? [0, 3] : !sw ? [2, 1] : [2, 3];
  const br = !s && !e ? [3, 5] : !s && e ? [1, 5] : s && !e ? [3, 3] : !se ? [3, 1] : [1, 3];
  return { tl, tr, bl, br };
}

function getWallAutotileQuarters(shape16Index) {
  const mask4 = 15 - Math.max(0, Math.min(15, shape16Index));
  const n = (mask4 & 1) !== 0;
  const e = (mask4 & 2) !== 0;
  const s = (mask4 & 4) !== 0;
  const w = (mask4 & 8) !== 0;
  return {
    tl: [w ? 2 : 0, n ? 2 : 0],
    tr: [e ? 1 : 3, n ? 2 : 0],
    bl: [w ? 2 : 0, s ? 1 : 3],
    br: [e ? 1 : 3, s ? 1 : 3],
  };
}

function getPixel(png, x, y) {
  const cx = Math.max(0, Math.min(png.width - 1, x));
  const cy = Math.max(0, Math.min(png.height - 1, y));
  const idx = (png.width * cy + cx) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]];
}

function setPixel(png, x, y, rgba) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = rgba[0];
  png.data[idx + 1] = rgba[1];
  png.data[idx + 2] = rgba[2];
  png.data[idx + 3] = rgba[3];
}

function blitQuarter(srcPng, blockOriginX, blockOriginY, qCoord, dstTileBuf, dstX, dstY, halfPx) {
  const srcX0 = blockOriginX + qCoord[0] * halfPx;
  const srcY0 = blockOriginY + qCoord[1] * halfPx;
  for (let y = 0; y < halfPx; y++) {
    for (let x = 0; x < halfPx; x++) {
      const rgba = getPixel(srcPng, srcX0 + x, srcY0 + y);
      setPixel(dstTileBuf, dstX + x, dstY + y, rgba);
    }
  }
}

/**
 * Copia un tile de tamaño tilePx x tilePx al atlas en (cellCol, cellRow) dejando 1 px de extrusión alrededor.
 */
function placeTileWithExtrusion(atlasPng, tilePng, cellCol, cellRow, tilePx, extrudePx) {
  const stride = tilePx + extrudePx * 2;
  const dstX0 = cellCol * stride + extrudePx;
  const dstY0 = cellRow * stride + extrudePx;

  // 1. Copy interior pixels
  for (let y = 0; y < tilePx; y++) {
    for (let x = 0; x < tilePx; x++) {
      setPixel(atlasPng, dstX0 + x, dstY0 + y, getPixel(tilePng, x, y));
    }
  }

  // 2. Extrude 1px border (top, bottom, left, right, and 4 corners)
  for (let e = 1; e <= extrudePx; e++) {
    for (let x = 0; x < tilePx; x++) {
      setPixel(atlasPng, dstX0 + x, dstY0 - e, getPixel(tilePng, x, 0));
      setPixel(atlasPng, dstX0 + x, dstY0 + tilePx - 1 + e, getPixel(tilePng, x, tilePx - 1));
    }
    for (let y = 0; y < tilePx; y++) {
      setPixel(atlasPng, dstX0 - e, dstY0 + y, getPixel(tilePng, 0, y));
      setPixel(atlasPng, dstX0 + tilePx - 1 + e, dstY0 + y, getPixel(tilePng, tilePx - 1, y));
    }
    setPixel(atlasPng, dstX0 - e, dstY0 - e, getPixel(tilePng, 0, 0));
    setPixel(atlasPng, dstX0 + tilePx - 1 + e, dstY0 - e, getPixel(tilePng, tilePx - 1, 0));
    setPixel(atlasPng, dstX0 - e, dstY0 + tilePx - 1 + e, getPixel(tilePng, 0, tilePx - 1));
    setPixel(atlasPng, dstX0 + tilePx - 1 + e, dstY0 + tilePx - 1 + e, getPixel(tilePng, tilePx - 1, tilePx - 1));
  }

  return {
    x: dstX0,
    y: dstY0,
    w: tilePx,
    h: tilePx,
  };
}

export function bakePackTileset(packId = 'anima_core') {
  generateAnimaCorePackSheets();

  const packDataPath = path.join(ROOT, `src/data/tilesets/${packId}.json`);
  const packData = JSON.parse(fs.readFileSync(packDataPath, 'utf8'));
  const tilePx = packData.tilePx || artConfig.tilePx || 48;
  const extrudePx = artConfig.extrudePx || 1;
  const halfPx = Math.floor(tilePx / 2);
  const stride = tilePx + extrudePx * 2;

  // Load source PNG sheets
  const sheetPngs = new Map();
  for (const sheet of packData.sheets) {
    const p = path.join(ROOT, 'assets/tilesets', packId, sheet.file);
    const buf = fs.readFileSync(p);
    sheetPngs.set(sheet.id, { meta: sheet, png: PNG.sync.read(buf) });
  }

  // Collect all baked tile entries to pack
  const bakedTilesQueue = [];

  for (const [tileKey, tileDef] of Object.entries(packData.tiles)) {
    const [sheetId, idxStr] = tileKey.split(':');
    const index = parseInt(idxStr, 10);
    const sheetEntry = sheetPngs.get(sheetId);
    if (!sheetEntry) {
      throw new Error(`[bake-tilesets] Missing sheet "${sheetId}" for tile "${tileKey}"`);
    }
    const { meta, png } = sheetEntry;

    if (meta.kind === 'A1') {
      // Water autotile: 47 shapes x 3 animation frames
      // Important: For each shape s in 0..46, we place frame 0, frame 1, frame 2 in 3 consecutive columns
      // so the Three.js shader can animate water simply by offsetting U by frameIndex * (stride / atlasWidth)!
      const blockY = index * 3 * tilePx;
      for (let shape = 0; shape < 47; shape++) {
        const quarters = getFloorAutotileQuarters(shape);
        const frames = [];
        for (let f = 0; f < 3; f++) {
          const blockX = f * 2 * tilePx;
          const tileBuf = new PNG({ width: tilePx, height: tilePx });
          blitQuarter(png, blockX, blockY, quarters.tl, tileBuf, 0, 0, halfPx);
          blitQuarter(png, blockX, blockY, quarters.tr, tileBuf, halfPx, 0, halfPx);
          blitQuarter(png, blockX, blockY, quarters.bl, tileBuf, 0, halfPx, halfPx);
          blitQuarter(png, blockX, blockY, quarters.br, tileBuf, halfPx, halfPx, halfPx);
          frames.push(tileBuf);
        }
        bakedTilesQueue.push({
          type: 'animated3',
          key: `pack:${packId}:${tileKey}`,
          shape,
          frames,
        });
      }
    } else if (meta.kind === 'A2') {
      // Ground autotile: 47 shapes
      const blockX = (index % 8) * 2 * tilePx;
      const blockY = Math.floor(index / 8) * 3 * tilePx;
      for (let shape = 0; shape < 47; shape++) {
        const quarters = getFloorAutotileQuarters(shape);
        const tileBuf = new PNG({ width: tilePx, height: tilePx });
        blitQuarter(png, blockX, blockY, quarters.tl, tileBuf, 0, 0, halfPx);
        blitQuarter(png, blockX, blockY, quarters.tr, tileBuf, halfPx, 0, halfPx);
        blitQuarter(png, blockX, blockY, quarters.bl, tileBuf, 0, halfPx, halfPx);
        blitQuarter(png, blockX, blockY, quarters.br, tileBuf, halfPx, halfPx, halfPx);
        bakedTilesQueue.push({
          type: 'single',
          key: `pack:${packId}:${tileKey}`,
          shape,
          tileBuf,
        });
      }
    } else if (meta.kind === 'A3' || meta.kind === 'A4') {
      // Wall/Facade autotile: 16 shapes
      const blockX = (index % 8) * 2 * tilePx;
      const blockY = Math.floor(index / 8) * 2 * tilePx;
      for (let shape = 0; shape < 16; shape++) {
        const quarters = getWallAutotileQuarters(shape);
        const tileBuf = new PNG({ width: tilePx, height: tilePx });
        blitQuarter(png, blockX, blockY, quarters.tl, tileBuf, 0, 0, halfPx);
        blitQuarter(png, blockX, blockY, quarters.tr, tileBuf, halfPx, 0, halfPx);
        blitQuarter(png, blockX, blockY, quarters.bl, tileBuf, 0, halfPx, halfPx);
        blitQuarter(png, blockX, blockY, quarters.br, tileBuf, halfPx, halfPx, halfPx);
        bakedTilesQueue.push({
          type: 'single',
          key: `pack:${packId}:${tileKey}`,
          shape,
          tileBuf,
        });
      }
    } else {
      // A5 or B..E normal tile (single variant shape=0)
      const col = index % meta.cols;
      const row = Math.floor(index / meta.cols);
      const srcX0 = col * tilePx;
      const srcY0 = row * tilePx;
      const tileBuf = new PNG({ width: tilePx, height: tilePx });
      for (let y = 0; y < tilePx; y++) {
        for (let x = 0; x < tilePx; x++) {
          setPixel(tileBuf, x, y, getPixel(png, srcX0 + x, srcY0 + y));
        }
      }
      bakedTilesQueue.push({
        type: 'single',
        key: `pack:${packId}:${tileKey}`,
        shape: 0,
        tileBuf,
      });
    }
  }

  // Calculate compact atlas grid (<= 2048x2048)
  const atlasCols = 24; // 24 * 50 = 1200 px width
  let curCol = 0;
  let curRow = 0;

  const placements = [];
  for (const item of bakedTilesQueue) {
    const neededCols = item.type === 'animated3' ? 3 : 1;
    if (curCol + neededCols > atlasCols) {
      curCol = 0;
      curRow++;
    }
    placements.push({ item, col: curCol, row: curRow });
    curCol += neededCols;
  }

  const totalRows = curRow + 1;
  const atlasWidth = atlasCols * stride;
  const atlasHeight = totalRows * stride;

  if (atlasWidth > 2048 || atlasHeight > 2048) {
    throw new Error(`[bake-tilesets] Baked atlas size ${atlasWidth}x${atlasHeight} exceeds mobile limit 2048x2048!`);
  }

  const atlasPng = new PNG({ width: atlasWidth, height: atlasHeight, colorType: 6 });
  const variantsMap = {};

  for (const { item, col, row } of placements) {
    if (!variantsMap[item.key]) {
      variantsMap[item.key] = {
        animatedFrames: item.type === 'animated3' ? 3 : 1,
        frameStrideU: item.type === 'animated3' ? stride / atlasWidth : 0,
        shapes: {},
      };
    }

    if (item.type === 'animated3') {
      const f0Rect = placeTileWithExtrusion(atlasPng, item.frames[0], col, row, tilePx, extrudePx);
      placeTileWithExtrusion(atlasPng, item.frames[1], col + 1, row, tilePx, extrudePx);
      placeTileWithExtrusion(atlasPng, item.frames[2], col + 2, row, tilePx, extrudePx);
      variantsMap[item.key].shapes[item.shape] = f0Rect;
    } else {
      const rect = placeTileWithExtrusion(atlasPng, item.tileBuf, col, row, tilePx, extrudePx);
      variantsMap[item.key].shapes[item.shape] = rect;
    }
  }

  const pngOutBuffer = PNG.sync.write(atlasPng);
  const assetAtlasPath = path.join(ROOT, `assets/tilesets/${packId}/baked_atlas.png`);
  const publicAtlasPath = path.join(ROOT, `public/assets/tilesets/${packId}/baked_atlas.png`);
  fs.writeFileSync(assetAtlasPath, pngOutBuffer);
  fs.writeFileSync(publicAtlasPath, pngOutBuffer);

  const bakedIndexJson = {
    packId,
    tilePx,
    extrudePx,
    stride,
    atlasWidth,
    atlasHeight,
    imagePng: `/assets/tilesets/${packId}/baked_atlas.png`,
    imageWebp: `/assets/tilesets/${packId}/baked_atlas.webp`,
    variants: variantsMap,
  };

  const jsonOutPath = path.join(ROOT, `src/data/tilesets/${packId}_baked.json`);
  fs.writeFileSync(jsonOutPath, JSON.stringify(bakedIndexJson, null, 2));

  return bakedIndexJson;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = bakePackTileset('anima_core');
  console.log(
    `[bake-tilesets] Baked "${res.packId}" atlas (${res.atlasWidth}x${res.atlasHeight} px, tilePx=${res.tilePx}, extrude=${res.extrudePx}px) with ${Object.keys(res.variants).length} tile definitions.`
  );
}
