#!/usr/bin/env node
/**
 * BLOQUE 44 Req. 2 & 3: Generador de hojas PNG de referencia para el pack original aprobado "anima_core".
 * Cumple el formato exacto de hojas RPG Maker (A1..A5 y B-E) con TILE_PX configurable en /src/data/config/art.json (48 px por defecto),
 * transparencia real (RGBA) y dimensiones exactas = cols * TILE_PX x rows * TILE_PX.
 * Cero assets de RTP de RPG Maker y cero munokura/MZ-tilesets-MV-style.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = process.cwd();
const artConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config/art.json'), 'utf8'));
const packConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/tilesets/anima_core.json'), 'utf8'));

const TILE_PX = artConfig.tilePx || 48;
const OUT_DIR = path.join(ROOT, 'assets/tilesets/anima_core');
const PUBLIC_OUT_DIR = path.join(ROOT, 'public/assets/tilesets/anima_core');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_OUT_DIR, { recursive: true });

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b, alpha];
}

function setPixel(png, x, y, rgba) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = rgba[0];
  png.data[idx + 1] = rgba[1];
  png.data[idx + 2] = rgba[2];
  png.data[idx + 3] = rgba[3];
}

function fillRect(png, x, y, w, h, rgba) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(png, px, py, rgba);
    }
  }
}

function drawAutotileBlockA1A2(png, blockX, blockY, baseHex, edgeHex, highlightHex, animFrame = 0, isWater = false, isBush = false) {
  const bw = TILE_PX * 2;
  const bh = TILE_PX * 3;
  const base = hexToRgba(baseHex, 255);
  const edge = hexToRgba(edgeHex, 255);
  const high = hexToRgba(highlightHex, 255);

  // Fill entire 2x3 tile block with base color + organic pixel speckles
  for (let ly = 0; ly < bh; ly++) {
    for (let lx = 0; lx < bw; lx++) {
      const hash = ((lx * 37 + ly * 17 + animFrame * 13) % 29);
      let col = base;
      if (hash === 0) col = high;
      else if (hash === 1 || hash === 2) col = edge;

      if (isWater) {
        const wave = (lx + ly * 2 + animFrame * Math.floor(TILE_PX / 4)) % 16;
        if (wave === 0 || wave === 1) col = high;
      }
      if (isBush) {
        const blade = (lx % 8 < 3) && (ly % 12 > 3);
        if (blade) col = (ly % 12 < 6) ? high : edge;
      }
      setPixel(png, blockX + lx, blockY + ly, col);
    }
  }

  // Outer border rim on the 4x4 subtile matrix (rows 2..5 in quarter units => y from TILE_PX to 3*TILE_PX)
  const rim = Math.max(3, Math.floor(TILE_PX / 10));
  const areaY = blockY + TILE_PX;
  const areaH = TILE_PX * 2;
  // Top & Bottom border of the 2x2 autotile body
  fillRect(png, blockX, areaY, bw, rim, edge);
  fillRect(png, blockX, areaY + areaH - rim, bw, rim, edge);
  // Left & Right border
  fillRect(png, blockX, areaY, rim, areaH, edge);
  fillRect(png, blockX + bw - rim, areaY, rim, areaH, edge);

  // Inner corners block at top-right of block (x: blockX + TILE_PX, y: blockY, size: TILE_PX x TILE_PX)
  const icX = blockX + TILE_PX;
  const icY = blockY;
  const half = TILE_PX / 2;
  // TL inner corner
  fillRect(png, icX, icY, rim, rim, edge);
  // TR inner corner
  fillRect(png, icX + TILE_PX - rim, icY, rim, rim, edge);
  // BL inner corner
  fillRect(png, icX, icY + half + half - rim, rim, rim, edge);
  // BR inner corner
  fillRect(png, icX + TILE_PX - rim, icY + half + half - rim, rim, rim, edge);
}

function drawWallAutotileBlockA3A4(png, blockX, blockY, wallHex, trimHex, darkHex) {
  const bw = TILE_PX * 2;
  const bh = TILE_PX * 2;
  const wall = hexToRgba(wallHex, 255);
  const trim = hexToRgba(trimHex, 255);
  const dark = hexToRgba(darkHex, 255);

  for (let ly = 0; ly < bh; ly++) {
    for (let lx = 0; lx < bw; lx++) {
      const brickRow = Math.floor(ly / 8);
      const brickOffset = (brickRow % 2) * 8;
      const isMortar = (ly % 8 === 0) || ((lx + brickOffset) % 16 === 0);
      setPixel(png, blockX + lx, blockY + ly, isMortar ? dark : wall);
    }
  }

  const rim = Math.max(3, Math.floor(TILE_PX / 12));
  fillRect(png, blockX, blockY, bw, rim, trim);
  fillRect(png, blockX, blockY + bh - rim, bw, rim, trim);
  fillRect(png, blockX, blockY, rim, bh, trim);
  fillRect(png, blockX + bw - rim, blockY, rim, bh, trim);
}

function drawSingleTile(png, tx, ty, baseHex, accentHex, pattern = 'solid') {
  const x0 = tx * TILE_PX;
  const y0 = ty * TILE_PX;
  const base = hexToRgba(baseHex, 255);
  const acc = hexToRgba(accentHex, 255);

  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      let col = base;
      if (pattern === 'planks') {
        if (y % 8 === 0 || (x + (Math.floor(y / 8) * 13)) % 24 === 0) col = acc;
      } else if (pattern === 'carpet') {
        const border = x < 4 || x >= TILE_PX - 4 || y < 4 || y >= TILE_PX - 4;
        if (border) col = acc;
      } else if (pattern === 'cave') {
        if (((x * 19 + y * 31) % 23) === 0) col = acc;
      } else {
        if (x === 0 || y === 0) col = acc;
      }
      setPixel(png, x0 + x, y0 + y, col);
    }
  }
}

function drawObjectSpriteTile(png, tx, ty, kind) {
  const x0 = tx * TILE_PX;
  const y0 = ty * TILE_PX;
  const cx = Math.floor(TILE_PX / 2);
  const cy = Math.floor(TILE_PX / 2);

  if (kind === 'tree_trunk') {
    const bark = hexToRgba('#6b4226', 255);
    const darkBark = hexToRgba('#422815', 255);
    const leaf = hexToRgba('#1f7a38', 255);
    // Lower trunk with transparent sides (real alpha!)
    for (let y = 6; y < TILE_PX; y++) {
      for (let x = Math.floor(TILE_PX * 0.28); x < Math.floor(TILE_PX * 0.72); x++) {
        setPixel(png, x0 + x, y0 + y, (x % 4 === 0) ? darkBark : bark);
      }
    }
    // Lower foliage skirt at top of trunk tile
    for (let y = 0; y < Math.floor(TILE_PX * 0.45); y++) {
      for (let x = 4; x < TILE_PX - 4; x++) {
        setPixel(png, x0 + x, y0 + y, leaf);
      }
    }
  } else if (kind === 'tree_canopy') {
    const leaf = hexToRgba('#258f42', 255);
    const hiLeaf = hexToRgba('#5cd66f', 255);
    const shLeaf = hexToRgba('#165928', 255);
    const rMax = TILE_PX * 0.46;
    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist <= rMax) {
          const col = y < cy - 4 ? hiLeaf : y > cy + 6 ? shLeaf : leaf;
          setPixel(png, x0 + x, y0 + y, col);
        }
      }
    }
  } else if (kind === 'rock') {
    const stone = hexToRgba('#64748b', 255);
    const hiStone = hexToRgba('#94a3b8', 255);
    const darkStone = hexToRgba('#334155', 255);
    for (let y = 8; y < TILE_PX - 2; y++) {
      for (let x = 6; x < TILE_PX - 6; x++) {
        const dist = Math.hypot(x - cx, (y - cy) * 1.15);
        if (dist <= TILE_PX * 0.4) {
          setPixel(png, x0 + x, y0 + y, y < cy ? hiStone : darkStone && (x + y) % 5 === 0 ? darkStone : stone);
        }
      }
    }
  } else if (kind === 'flowers') {
    const stem = hexToRgba('#22c55e', 255);
    const petal = hexToRgba('#f472b6', 255);
    const gold = hexToRgba('#facc15', 255);
    const spots = [
      [Math.floor(TILE_PX * 0.28), Math.floor(TILE_PX * 0.35)],
      [Math.floor(TILE_PX * 0.68), Math.floor(TILE_PX * 0.42)],
      [Math.floor(TILE_PX * 0.46), Math.floor(TILE_PX * 0.72)],
    ];
    for (const [fx, fy] of spots) {
      fillRect(png, x0 + fx - 1, y0 + fy, 2, 7, stem);
      fillRect(png, x0 + fx - 3, y0 + fy - 3, 6, 6, petal);
      fillRect(png, x0 + fx - 1, y0 + fy - 1, 2, 2, gold);
    }
  } else if (kind === 'door') {
    const wood = hexToRgba('#78350f', 255);
    const frame = hexToRgba('#d97706', 255);
    const gold = hexToRgba('#facc15', 255);
    fillRect(png, x0 + 6, y0 + 2, TILE_PX - 12, TILE_PX - 2, frame);
    fillRect(png, x0 + 9, y0 + 5, TILE_PX - 18, TILE_PX - 5, wood);
    fillRect(png, x0 + TILE_PX - 15, y0 + cy, 3, 3, gold);
  } else {
    // Generic indoor prop (counter, vitrine, mannequin, crystals, etc.)
    const wood = hexToRgba('#5c3a21', 255);
    const brass = hexToRgba('#d4af37', 255);
    const glow = hexToRgba('#38bdf8', 255);
    fillRect(png, x0 + 4, y0 + 6, TILE_PX - 8, TILE_PX - 8, wood);
    fillRect(png, x0 + 4, y0 + 6, TILE_PX - 8, 4, brass);
    fillRect(png, x0 + cx - 4, y0 + cy - 4, 8, 8, glow);
  }
}

export function generateAnimaCorePackSheets() {
  for (const sheet of packConfig.sheets) {
    const outPath = path.join(OUT_DIR, sheet.file);
    const pubPath = path.join(PUBLIC_OUT_DIR, sheet.file);

    // Si la hoja PNG real ya existe en /assets/tilesets/anima_core, la respetamos y sincronizamos con /public
    if (fs.existsSync(outPath)) {
      fs.copyFileSync(outPath, pubPath);
      continue;
    }

    const width = sheet.cols * TILE_PX;
    const height = sheet.rows * TILE_PX;
    const png = new PNG({ width, height, colorType: 6 }); // RGBA with real transparency

    // Default: leave at least top-right corner transparent so validator confirms real alpha channel
    if (sheet.kind === 'A1') {
      // Water animated 3 frames across columns (blocks 0, 1, 2 each 2x3 tiles)
      for (let f = 0; f < 3; f++) {
        drawAutotileBlockA1A2(png, f * 2 * TILE_PX, 0, '#0284c7', '#0369a1', '#7dd3fc', f, true, false);
        drawAutotileBlockA1A2(png, f * 2 * TILE_PX, 3 * TILE_PX, '#0ea5e9', '#0284c7', '#e0f2fe', f, true, false);
      }
    } else if (sheet.kind === 'A2') {
      // 0: Grass, 1: Tall Grass (Bush), 2: Dirt Path, 3: Sand, 4: Flower Meadow
      drawAutotileBlockA1A2(png, 0 * TILE_PX, 0, '#5cbf5a', '#469e44', '#7ae078', 0, false, false);
      drawAutotileBlockA1A2(png, 2 * TILE_PX, 0, '#2f855a', '#1e4e38', '#68d391', 0, false, true);
      drawAutotileBlockA1A2(png, 4 * TILE_PX, 0, '#d97706', '#92400e', '#fcd34d', 0, false, false);
      drawAutotileBlockA1A2(png, 6 * TILE_PX, 0, '#eab308', '#ca8a04', '#fef08a', 0, false, false);
      drawAutotileBlockA1A2(png, 8 * TILE_PX, 0, '#4ade80', '#16a34a', '#f472b6', 0, false, false);
    } else if (sheet.kind === 'A3') {
      // 0: Building wall, 1: Roof
      drawWallAutotileBlockA3A4(png, 0, 0, '#fef3c7', '#78350f', '#d6c79c');
      drawWallAutotileBlockA3A4(png, 2 * TILE_PX, 0, '#0f766e', '#115e59', '#134e4a');
    } else if (sheet.kind === 'A4') {
      // 0: Dungeon/Cave stone wall
      drawWallAutotileBlockA3A4(png, 0, 0, '#475569', '#1e293b', '#334155');
    } else if (sheet.kind === 'A5') {
      if (sheet.id === 'Inside_A5') {
        drawSingleTile(png, 0, 0, '#5c3a21', '#3d2514', 'planks');
        drawSingleTile(png, 1, 0, '#7f1d1d', '#facc15', 'carpet');
      } else if (sheet.id === 'Dungeon_A5') {
        drawSingleTile(png, 0, 0, '#292524', '#1c1917', 'cave');
      } else {
        drawSingleTile(png, 0, 0, '#94a3b8', '#64748b', 'solid');
      }
    } else if (sheet.kind === 'B') {
      if (sheet.id === 'Outside_B') {
        drawObjectSpriteTile(png, 0, 0, 'tree_trunk');
        drawObjectSpriteTile(png, 1, 0, 'tree_canopy');
        drawObjectSpriteTile(png, 2, 0, 'rock');
        drawObjectSpriteTile(png, 3, 0, 'flowers');
        drawObjectSpriteTile(png, 4, 0, 'door');
      } else {
        for (let i = 0; i <= 9; i++) {
          drawObjectSpriteTile(png, i, 0, 'indoor_prop');
        }
      }
    }

    const buf = PNG.sync.write(png);
    fs.writeFileSync(path.join(OUT_DIR, sheet.file), buf);
    fs.writeFileSync(path.join(PUBLIC_OUT_DIR, sheet.file), buf);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateAnimaCorePackSheets();
  console.log(`[generate-pack-sheets] Generated ${packConfig.sheets.length} PNG sheets (TILE_PX=${TILE_PX}) in ${OUT_DIR}`);
}
