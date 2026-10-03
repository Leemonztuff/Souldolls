export interface AssetManifestEntry {
  id: string;
  type: 'creature' | 'character' | 'tile' | 'vfx';
  pngPath: string;
  jsonPath?: string;
}

export const ASSETS_MANIFEST: AssetManifestEntry[] = [
  // Ejemplo de criatura con soporte de arte real (si existe el archivo PNG, se usará; de lo contrario fallback procedural)
  { id: 'flamin', type: 'creature', pngPath: '/assets/creatures/flamin.png', jsonPath: '/assets/creatures/flamin.json' },
  { id: 'aquilo', type: 'creature', pngPath: '/assets/creatures/aquilo.png', jsonPath: '/assets/creatures/aquilo.json' },
  { id: 'brotin', type: 'creature', pngPath: '/assets/creatures/brotin.png', jsonPath: '/assets/creatures/brotin.json' },
];
