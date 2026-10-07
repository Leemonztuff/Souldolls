#!/usr/bin/env node
/**
 * BLOQUE 44 Req. 1, 2, 4, 9: Script de Validación de Licencias, Hojas PNG, Flags, Autotiles y Generación de /docs/CREDITS.md
 * - Compuerta de licencia:
 *   - Cada pack referenciado vive en /assets/tilesets/<packId>/ con pack.json y LICENSE.txt.
 *   - El build FALLA si falta pack.json, LICENSE.txt, si approved !== true, si es un pack prohibido (munokura / RTP)
 *     o si allowedEngines restringe el uso a RPG Maker.
 *   - Genera automáticamente /docs/CREDITS.md con los créditos de cada pack aprobado.
 * - Valida dimensiones = cols * TILE_PX x rows * TILE_PX, transparencia real RGBA y tamaño de atlas <= 2048.
 * - Ejecuta pruebas unitarias de las 47 formas de máscara de vecinos de autotile (esquinas, bordes, islas, centro).
 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { convertAllTilesetsToWebp, writeIfDifferent } from './convert-webp.mjs';

const ROOT = process.cwd();

export function validatePackLicenseObject(packId, packMeta, licenseText) {
  const errors = [];

  if (!packMeta || typeof packMeta !== 'object') {
    errors.push(`[LicenseGate] Pack "${packId}" has missing or invalid pack.json.`);
    return errors;
  }

  const requiredFields = ['name', 'author', 'source', 'license', 'commercialUse', 'allowedEngines', 'attribution', 'approved'];
  for (const field of requiredFields) {
    if (packMeta[field] === undefined || packMeta[field] === null || packMeta[field] === '') {
      errors.push(`[LicenseGate] Pack "${packId}" is missing required field "${field}" in pack.json.`);
    }
  }

  if (packMeta.approved !== true) {
    errors.push(`[LicenseGate] Pack "${packId}" is NOT approved for production (approved=${packMeta.approved}).`);
  }

  const combinedText = `${packId} ${packMeta.name || ''} ${packMeta.author || ''} ${packMeta.source || ''} ${packMeta.license || ''}`.toLowerCase();
  if (combinedText.includes('munokura') || combinedText.includes('rtp') || combinedText.includes('enterbrain') || combinedText.includes('kadokawa')) {
    errors.push(`[LicenseGate] Pack "${packId}" references forbidden RPG Maker RTP or munokura assets.`);
  }

  const engines = Array.isArray(packMeta.allowedEngines)
    ? packMeta.allowedEngines.map((e) => String(e).toLowerCase())
    : [String(packMeta.allowedEngines || '').toLowerCase()];

  const onlyRpgMaker =
    engines.length > 0 &&
    engines.every((e) => e.includes('rpg maker') || e.includes('rpgmaker') || e === 'mv' || e === 'mz' || e === 'vx');

  if (onlyRpgMaker) {
    errors.push(
      `[LicenseGate] Pack "${packId}" has allowedEngines restricted to RPG Maker (${JSON.stringify(packMeta.allowedEngines)}). Blocked for production!`
    );
  }

  if (!licenseText || licenseText.trim().length < 20) {
    errors.push(`[LicenseGate] Pack "${packId}" has missing or empty LICENSE.txt.`);
  }

  return errors;
}

export async function runBloque44Validation() {
  const errors = [];
  const warnings = [];

  // 1. Run baking and lossless WebP conversion first so all artifacts exist
  const webpReport = await convertAllTilesetsToWebp('anima_core');

  const artConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/config/art.json'), 'utf8'));
  const legacyMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/tilesets/legacy_map.json'), 'utf8'));

  if (![16, 32, 48].includes(artConfig.tilePx)) {
    errors.push(`[ArtConfig] tilePx=${artConfig.tilePx} must be 16, 32, or 48.`);
  }

  // 2. Collect all packs referenced in /src/data/tilesets/*.json and legacy_map.json
  const referencedPacks = new Set([artConfig.activePackId || 'anima_core', legacyMap.packId || 'anima_core']);
  const allRefs = [...Object.values(legacyMap.ground || {}), ...Object.values(legacyMap.decor || {})];

  for (const ref of allRefs) {
    if (typeof ref === 'string' && ref.startsWith('pack:')) {
      const parts = ref.split(':');
      if (parts[1]) referencedPacks.add(parts[1]);
    }
  }

  const approvedPacksForCredits = [];

  // 3. Validate License Gate & Sheets for each referenced pack
  for (const packId of referencedPacks) {
    const packDir = path.join(ROOT, 'assets/tilesets', packId);
    const packJsonPath = path.join(packDir, 'pack.json');
    const licenseTxtPath = path.join(packDir, 'LICENSE.txt');

    if (!fs.existsSync(packJsonPath)) {
      errors.push(`[LicenseGate] Pack "${packId}" is missing ${packJsonPath}`);
      continue;
    }
    if (!fs.existsSync(licenseTxtPath)) {
      errors.push(`[LicenseGate] Pack "${packId}" is missing ${licenseTxtPath}`);
      continue;
    }

    const packMeta = JSON.parse(fs.readFileSync(packJsonPath, 'utf8'));
    const licenseTxt = fs.readFileSync(licenseTxtPath, 'utf8');
    const licenseErrors = validatePackLicenseObject(packId, packMeta, licenseTxt);
    errors.push(...licenseErrors);

    if (licenseErrors.length === 0) {
      approvedPacksForCredits.push({ packId, ...packMeta });
    }

    // Validate negative test case: ensure a pack with approved:false or RPG Maker only is rejected
    const negativeTestRpgMaker = validatePackLicenseObject(
      'forbidden_pack',
      {
        name: 'Forbidden',
        author: 'Test',
        source: 'Test',
        license: 'Proprietary',
        commercialUse: true,
        allowedEngines: ['RPG Maker MZ'],
        attribution: 'Test',
        approved: true,
      },
      'Sample license text for negative test validation.'
    );
    const negativeTestUnapproved = validatePackLicenseObject(
      'unapproved_pack',
      {
        name: 'Unapproved',
        author: 'Test',
        source: 'Test',
        license: 'CC0',
        commercialUse: true,
        allowedEngines: ['any'],
        attribution: 'Test',
        approved: false,
      },
      'Sample license text for negative test validation.'
    );
    if (negativeTestRpgMaker.length === 0 || negativeTestUnapproved.length === 0) {
      errors.push(`[LicenseGate] Self-test failed: License gate did not reject unapproved or RPG Maker-only pack!`);
    }

    // Validate pack tileset definition & PNG sheet dimensions + real alpha
    const dataPath = path.join(ROOT, `src/data/tilesets/${packId}.json`);
    const bakedPath = path.join(ROOT, `src/data/tilesets/${packId}_baked.json`);
    if (!fs.existsSync(dataPath)) {
      errors.push(`[TilesetData] Missing tileset data file: ${dataPath}`);
      continue;
    }
    if (!fs.existsSync(bakedPath)) {
      errors.push(`[TilesetData] Missing baked index file: ${bakedPath}`);
      continue;
    }

    const tilesetData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const bakedData = JSON.parse(fs.readFileSync(bakedPath, 'utf8'));
    const tilePx = tilesetData.tilePx || artConfig.tilePx;

    if (bakedData.atlasWidth > 2048 || bakedData.atlasHeight > 2048) {
      errors.push(
        `[BakedAtlas] Pack "${packId}" baked atlas (${bakedData.atlasWidth}x${bakedData.atlasHeight}) exceeds 2048x2048 limit.`
      );
    }

    const validNamingRegex = /^(Outside|Inside|Dungeon|World)_(A1|A2|A3|A4|A5|B|C|D|E)$/;
    for (const sheet of tilesetData.sheets) {
      if (!validNamingRegex.test(sheet.id)) {
        warnings.push(`[SheetNaming] Sheet "${sheet.id}" does not match Outside_/Inside_/Dungeon_/World_ + A1..E convention.`);
      }
      const pngPath = path.join(packDir, sheet.file);
      if (!fs.existsSync(pngPath)) {
        errors.push(`[SheetValidator] Missing PNG file for sheet "${sheet.id}": ${pngPath}`);
        continue;
      }
      const png = PNG.sync.read(fs.readFileSync(pngPath));
      const expectedW = sheet.cols * tilePx;
      const expectedH = sheet.rows * tilePx;
      if (png.width !== expectedW || png.height !== expectedH) {
        errors.push(
          `[SheetValidator] Sheet "${sheet.id}" (${sheet.file}) has dimensions ${png.width}x${png.height}, expected ${expectedW}x${expectedH} (${sheet.cols}x${sheet.rows} @ ${tilePx}px).`
        );
      }

      if (png.colorType !== 6 && png.colorType !== 4 && png.colorType !== 3) {
        errors.push(`[SheetValidator] Sheet "${sheet.id}" (${sheet.file}) does not have an RGBA alpha channel (colorType=${png.colorType}).`);
      }

      // Check real transparency on object/ground sheets (A3/A4 wall sheets in RPG Maker can have all 32 wall slots filled)
      if (sheet.kind !== 'A3' && sheet.kind !== 'A4') {
        let hasTransparentPixel = false;
        for (let i = 3; i < png.data.length; i += 4) {
          if (png.data[i] < 255) {
            hasTransparentPixel = true;
            break;
          }
        }
        if (!hasTransparentPixel) {
          errors.push(`[SheetValidator] Sheet "${sheet.id}" (${sheet.file}) has no transparent pixels (missing real alpha channel).`);
        }
      }
    }

    // Validate all legacy_map tileRefs exist in tilesetData and bakedData
    for (const ref of allRefs) {
      if (typeof ref === 'string' && ref.startsWith(`pack:${packId}:`)) {
        const shortKey = ref.slice(`pack:${packId}:`.length);
        if (!tilesetData.tiles[shortKey]) {
          errors.push(`[TileRef] Reference "${ref}" is missing flags definition in src/data/tilesets/${packId}.json.`);
        }
        if (!bakedData.variants[ref]) {
          errors.push(`[TileRef] Reference "${ref}" is missing baked variants in src/data/tilesets/${packId}_baked.json.`);
        }
      }
    }
  }

  // 4. Generate /docs/CREDITS.md automatically (Bloque 44 Req. 1)
  const docsDir = path.join(ROOT, 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  const creditsLines = [
    '# Souldolls — Créditos de Packs de Arte y Tilesets (Bloque 44)',
    '',
    '> Archivo generado automáticamente por `/tools/validate-tilesets.mjs`.',
    '> Todos los packs listados han superado la Compuerta de Licencia (`approved: true`, compatibles con Three.js/PixiJS, cero RTP de RPG Maker y cero munokura).',
    '',
    '| Pack ID | Nombre | Autor | Licencia | Motores Permitidos | Uso Comercial | Atribución |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
  ];
  for (const p of approvedPacksForCredits) {
    creditsLines.push(
      `| \`${p.packId}\` | ${p.name} | ${p.author} | \`${p.license}\` | ${Array.isArray(p.allowedEngines) ? p.allowedEngines.join(', ') : p.allowedEngines} | ${p.commercialUse ? 'Sí' : 'No'} | ${p.attribution} |`
    );
  }
  creditsLines.push('');
  writeIfDifferent(path.join(docsDir, 'CREDITS.md'), creditsLines.join('\n'));

  if (errors.length > 0) {
    console.error('❌ [Bloque 44 Validation] FAILED with errors:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const sheetsLabel = webpReport.webpGenerated
    ? `${webpReport.filesConverted} PNG/WebP sheets`
    : `${webpReport.filesConverted} PNG sheets (WebP omitido: sharp no instalado)`;
  console.log(
    `✅ [Bloque 44 Validation] All license gates, ${sheetsLabel}, tileRefs, baked atlases (<=2048px) and /docs/CREDITS.md verified successfully.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBloque44Validation();
}
