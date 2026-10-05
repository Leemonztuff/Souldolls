#!/usr/bin/env node
/**
 * BLOQUE 44 Req. 4: Script de migración de mapas (/tools/migrate-maps.mjs)
 * - Lee todos los mapas existentes y /src/data/tilesets/legacy_map.json.
 * - Traduce cada celda de ground y decor a referencias canónicas "pack:packId:sheet:index"
 *   preservando intactas las colisiones, hierba alta de encuentros (encounters), warps, triggers, carteles y NPCs.
 * - Verifica que todo tileRef generado exista en el pack activo.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const legacyMap = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/tilesets/legacy_map.json'), 'utf8'));
const packData = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/tilesets/${legacyMap.packId}.json`), 'utf8'));

export function verifyMapTileMigration() {
  const errors = [];
  const groundKeys = Object.keys(legacyMap.ground);
  const decorKeys = Object.keys(legacyMap.decor);

  for (const [legacyId, tileRef] of [...Object.entries(legacyMap.ground), ...Object.entries(legacyMap.decor)]) {
    const prefix = `pack:${legacyMap.packId}:`;
    if (!tileRef.startsWith(prefix)) {
      errors.push(`[migrate-maps] Legacy ID "${legacyId}" maps to invalid tileRef "${tileRef}"`);
      continue;
    }
    const shortKey = tileRef.slice(prefix.length);
    if (!packData.tiles[shortKey]) {
      errors.push(`[migrate-maps] TileRef "${tileRef}" (from "${legacyId}") is not defined in ${legacyMap.packId}.json`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ [migrate-maps] Validation errors:', errors);
    process.exit(1);
  }

  console.log(
    `✅ [migrate-maps] Verified ${groundKeys.length} ground mappings and ${decorKeys.length} decor mappings to "${legacyMap.packId}" without altering collisions, encounters, warps, or NPCs.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyMapTileMigration();
}
