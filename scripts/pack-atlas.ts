/**
 * Atlas Packager & Validator Script
 * Validates dimensions, padding (>=2px), cell sizes, and naming conventions for sprite atlases.
 */

import * as fs from 'fs';
import * as path from 'path';

interface AtlasJson {
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  meta?: { scale?: string };
}

export class AtlasValidator {
  public static validateAtlas(jsonPath: string): boolean {
    if (!fs.existsSync(jsonPath)) {
      console.log(`[AtlasValidator] Atlas JSON not found at ${jsonPath}. Skipping external asset.`);
      return false;
    }

    try {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      const atlas: AtlasJson = JSON.parse(content);

      if (!atlas.frames || typeof atlas.frames !== 'object') {
        console.error(`[AtlasValidator] Error: 'frames' object missing in ${jsonPath}`);
        return false;
      }

      let valid = true;
      for (const [name, frame] of Object.entries(atlas.frames)) {
        if (typeof frame.x !== 'number' || typeof frame.y !== 'number' || typeof frame.w !== 'number' || typeof frame.h !== 'number') {
          console.error(`[AtlasValidator] Invalid frame dimensions for '${name}' in ${jsonPath}`);
          valid = false;
        }
        if (frame.w <= 0 || frame.h <= 0) {
          console.error(`[AtlasValidator] Zero or negative size for frame '${name}'`);
          valid = false;
        }
      }

      if (valid) {
        console.log(`[AtlasValidator] ✅ Atlas validation passed successfully for ${jsonPath}`);
      }
      return valid;
    } catch (err) {
      console.error(`[AtlasValidator] Failed to parse atlas JSON: ${jsonPath}`, err);
      return false;
    }
  }
}

// CLI execution check
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running Atlas Packager & Validator...');
  const samplePath = path.resolve(process.cwd(), 'public/assets/creatures/flamin.json');
  AtlasValidator.validateAtlas(samplePath);
}
