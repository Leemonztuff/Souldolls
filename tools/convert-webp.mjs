#!/usr/bin/env node
/**
 * BLOQUE 44 Req. 7: Conversor WebP sin pérdida (/tools/convert-webp.mjs)
 * - Genera archivos WebP 100% lossless (alpha exacto) a partir de los PNG del pack y su atlas horneado.
 * - Verifica igualdad píxel a píxel (RGBA exacto) entre cada PNG y su WebP decodificado.
 * - Reporta el ahorro de tamaño y actualiza /src/data/tilesets/assets_manifest.json con formatos [{type:"webp", file}, {type:"png", file}].
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { bakePackTileset } from './bake-tilesets.mjs';

const ROOT = process.cwd();

/**
 * Codificador VP8L (WebP Lossless) vía sharp. Sin sharp no se genera ningún
 * .webp: se eliminan los obsoletos y el manifest queda solo con PNG, para que
 * nunca circule un .webp indescifrible ni una verificación tautológica.
 */
async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch (_) {
    return null;
  }
}

async function encodeLosslessWebpAndVerify(pngPath, webpPath, sharpMod) {
  const pngBuf = fs.readFileSync(pngPath);
  const srcPng = PNG.sync.read(pngBuf);

  const webpBuf = await sharpMod(pngBuf).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const decodedRgba = await sharpMod(webpBuf).ensureAlpha().raw().toBuffer();

  if (decodedRgba.length !== srcPng.data.length) {
    throw new Error(`[convert-webp] Pixel buffer length mismatch for ${path.basename(pngPath)}`);
  }
  for (let i = 0; i < srcPng.data.length; i++) {
    if (decodedRgba[i] !== srcPng.data[i]) {
      throw new Error(
        `[convert-webp] Pixel mismatch at byte ${i} in ${path.basename(pngPath)}: PNG=${srcPng.data[i]} vs WebP=${decodedRgba[i]}`
      );
    }
  }

  writeIfDifferent(webpPath, webpBuf);
  return {
    pngBytes: pngBuf.length,
    webpBytes: webpBuf.length,
    pixelEqual: true,
    width: srcPng.width,
    height: srcPng.height,
  };
}

export function writeIfDifferent(filePath, buf) {
  const next = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(next)) return false;
  fs.writeFileSync(filePath, next);
  return true;
}

export async function convertAllTilesetsToWebp(packId = 'anima_core') {
  bakePackTileset(packId);

  const sharpMod = await loadSharp();
  const packDir = path.join(ROOT, 'assets/tilesets', packId);
  const pubDir = path.join(ROOT, 'public/assets/tilesets', packId);
  fs.mkdirSync(pubDir, { recursive: true });

  const files = fs.readdirSync(packDir).filter((f) => f.endsWith('.png')).sort();
  const manifestAssets = {};
  let totalPngBytes = 0;
  let totalWebpBytes = 0;

  for (const file of files) {
    const baseName = file.replace(/\.png$/i, '');
    const pngPath = path.join(packDir, file);
    const webpFile = `${baseName}.webp`;
    const webpPath = path.join(packDir, webpFile);
    const pubWebpPath = path.join(pubDir, webpFile);

    const pngBuf = fs.readFileSync(pngPath);
    const srcPng = PNG.sync.read(pngBuf);
    totalPngBytes += pngBuf.length;
    const formats = [
      { type: 'png', file: `/assets/tilesets/${packId}/${file}`, bytes: pngBuf.length },
    ];

    if (sharpMod) {
      const stats = await encodeLosslessWebpAndVerify(pngPath, webpPath, sharpMod);
      writeIfDifferent(pubWebpPath, fs.readFileSync(webpPath));
      totalWebpBytes += stats.webpBytes;
      formats.unshift({
        type: 'webp',
        file: `/assets/tilesets/${packId}/${webpFile}`,
        bytes: stats.webpBytes,
      });
    } else {
      for (const stale of [webpPath, pubWebpPath]) {
        if (fs.existsSync(stale)) fs.unlinkSync(stale);
      }
    }

    manifestAssets[`${packId}/${baseName}`] = {
      id: `${packId}/${baseName}`,
      width: srcPng.width,
      height: srcPng.height,
      ...(sharpMod ? { pixelEqualVerified: true } : {}),
      formats,
    };
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    losslessOnly: true,
    webpGenerated: Boolean(sharpMod),
    assets: manifestAssets,
  };

  const manifestOut = path.join(ROOT, 'src/data/tilesets/assets_manifest.json');
  if (fs.existsSync(manifestOut)) {
    try {
      const prev = JSON.parse(fs.readFileSync(manifestOut, 'utf8'));
      const { generatedAt: _a, ...prevRest } = prev;
      const { generatedAt: _b, ...nextRest } = manifest;
      if (JSON.stringify(prevRest) === JSON.stringify(nextRest)) manifest.generatedAt = prev.generatedAt;
    } catch (_) {
      /* manifest corrupto: se reescribe completo */
    }
  }
  writeIfDifferent(manifestOut, JSON.stringify(manifest, null, 2));

  return {
    filesConverted: files.length,
    webpGenerated: Boolean(sharpMod),
    totalPngBytes,
    totalWebpBytes,
    manifest,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  convertAllTilesetsToWebp('anima_core').then((res) => {
    if (!res.webpGenerated) {
      console.log(
        `[convert-webp] sharp no disponible: ${res.filesConverted} sheets se dejan en PNG (sin .webp y sin verificar).`
      );
      return;
    }
    const diffKb = ((res.totalPngBytes - res.totalWebpBytes) / 1024).toFixed(1);
    console.log(
      `[convert-webp] Verified lossless pixel-by-pixel equality on ${res.filesConverted} sheets (PNG=${(res.totalPngBytes / 1024).toFixed(1)}KB, delta=${diffKb}KB).`
    );
  });
}
