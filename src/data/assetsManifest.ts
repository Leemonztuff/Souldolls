import souldollsSpritesManifest from './art/souldolls_sprites_manifest.json';

export interface AssetManifestEntry {
  id: string;
  type: 'creature' | 'character' | 'tile' | 'vfx';
  pngPath: string;
  jsonPath?: string;
  element?: string;
  views?: string[];
  idleSupported?: boolean;
}

export interface SouldollSpriteManifestEntry {
  speciesId: string;
  name: string;
  element: string;
  sheetPath: string;
  atlasPath: string;
  size: [number, number];
  views: string[];
  idleSupported: boolean;
}

export const SOULDOLLS_SPRITES_MANIFEST: Record<string, SouldollSpriteManifestEntry> =
  (souldollsSpritesManifest as any).species || {};

export const ASSETS_MANIFEST: AssetManifestEntry[] = Object.values(
  SOULDOLLS_SPRITES_MANIFEST
).map((entry) => ({
  id: entry.speciesId,
  type: 'creature' as const,
  pngPath: entry.sheetPath,
  jsonPath: entry.atlasPath,
  element: entry.element,
  views: entry.views,
  idleSupported: entry.idleSupported,
}));

export function getSoulDollSpriteConfig(
  speciesId: string
): SouldollSpriteManifestEntry | undefined {
  return SOULDOLLS_SPRITES_MANIFEST[speciesId];
}
