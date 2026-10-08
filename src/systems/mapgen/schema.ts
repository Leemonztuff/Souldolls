/**
 * BLOQUE 47 (Paso 1.1): Esquema y validador en runtime para mapas fuente (Schema 1)
 * Cumple invariantes:
 * - I-03 (/systems puro): cero imports de DOM, Three ni Pixi.
 * - I-02 (data-driven): valida la estructura del JSON fuente en runtime con mensajes claros.
 */

export type BiomeId = 'meadow' | 'forest' | 'coastal' | 'mountain' | 'town' | 'cave';
export type BorderMaterial = 'tree' | 'rock' | 'water' | 'cliff';
export type PathRank = 'main' | 'secondary' | 'trail';
export type PathSurface = 'cobble' | 'path' | 'dirt' | 'sand' | 'wood';
export type PatchType = 'tall_grass' | 'flowers' | 'clearing' | 'garden' | 'lake';
export type StampRotation = 0 | 90 | 180 | 270;
export type LandmarkRole = 'spawn' | 'exit' | 'focus' | 'secret' | 'rest' | 'danger';

export interface MapGenMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  seed: number;
  defaultBiome: BiomeId;
}

export interface MapGenBorder {
  thickness: number;
  material: BorderMaterial;
}

export interface MapGenRegion {
  id: string;
  biome: BiomeId;
  points: [number, number][];
  edgeNoise: number;
  noiseScale: number;
}

export interface MapGenPath {
  id: string;
  rank: PathRank;
  surface: PathSurface;
  points: [number, number][];
  widthJitter: number;
}

export interface MapGenPatch {
  id: string;
  type: PatchType;
  center: [number, number];
  radius: number;
  aspect: number;
  rotation: number;
  noise: number;
}

export interface MapGenStampInstance {
  id: string;
  stampId: string;
  x: number;
  y: number;
  rot: StampRotation;
  label?: string;
}

export interface MapGenLandmark {
  id: string;
  role: LandmarkRole;
  x: number;
  y: number;
  label: string;
  targetMap?: string;
}

export interface MapSourceSchemaV1 {
  schema: 1;
  meta: MapGenMeta;
  border: MapGenBorder;
  regions: MapGenRegion[];
  paths: MapGenPath[];
  patches: MapGenPatch[];
  stamps: MapGenStampInstance[];
  landmarks: MapGenLandmark[];
  npcs?: Array<{
    id: string;
    name: string;
    paletteId: string;
    x: number;
    y: number;
    direction: 'up' | 'down' | 'left' | 'right';
    interactLabel?: string;
    dialogueLines: string[];
    isTrainer?: boolean;
    trainerData?: {
      trainerClass: string;
      creatureSpeciesId: string;
      creatureLevel: number;
    };
  }>;
  signs?: Array<{
    x: number;
    y: number;
    text: string;
    interactLabel?: string;
  }>;
  encounterRate?: number;
  encounterTable?: Array<{
    speciesId: string;
    minLevel: number;
    maxLevel: number;
    weight: number;
  }>;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_BIOMES = new Set<string>(['meadow', 'forest', 'coastal', 'mountain', 'town', 'cave']);
const VALID_BORDER_MATERIALS = new Set<string>(['tree', 'rock', 'water', 'cliff']);
const VALID_PATH_RANKS = new Set<string>(['main', 'secondary', 'trail']);
const VALID_PATCH_TYPES = new Set<string>(['tall_grass', 'flowers', 'clearing', 'garden', 'lake']);
const VALID_ROTATIONS = new Set<number>([0, 90, 180, 270]);
const VALID_LANDMARK_ROLES = new Set<string>(['spawn', 'exit', 'focus', 'secret', 'rest', 'danger']);

export function isMapSourceSchemaV1(raw: unknown): raw is MapSourceSchemaV1 {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      (raw as any).schema === 1 &&
      typeof (raw as any).meta === 'object' &&
      typeof (raw as any).border === 'object'
  );
}

/**
 * Valida en runtime un objeto contra el formato MapSourceSchemaV1 (schema 1) con mensajes claros:
 * - IDs únicos en regions, paths, patches, stamps y landmarks
 * - Polígonos de >= 3 puntos en regions y caminos de >= 2 puntos en paths
 * - Límites numéricos de ancho, alto, espesor de borde, radios y rotaciones
 */
export function validateMapSourceSchema(raw: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['El documento del mapa fuente debe ser un objeto JSON válido.'] };
  }

  const doc = raw as Record<string, any>;

  if (doc.schema !== 1) {
    errors.push(`Versión de schema inválida: se esperaba 1 y se recibió ${JSON.stringify(doc.schema)}.`);
  }

  // 1. Meta
  if (!doc.meta || typeof doc.meta !== 'object') {
    errors.push('Falta el bloque "meta" { id, name, width, height, seed, defaultBiome }.');
  } else {
    const m = doc.meta;
    if (typeof m.id !== 'string' || m.id.trim().length === 0) {
      errors.push('meta.id debe ser un string no vacío.');
    }
    if (typeof m.name !== 'string' || m.name.trim().length === 0) {
      errors.push('meta.name debe ser un string no vacío.');
    }
    if (typeof m.width !== 'number' || !Number.isInteger(m.width) || m.width < 10 || m.width > 256) {
      errors.push(`meta.width (${m.width}) fuera de límites permitidos [10..256].`);
    }
    if (typeof m.height !== 'number' || !Number.isInteger(m.height) || m.height < 10 || m.height > 256) {
      errors.push(`meta.height (${m.height}) fuera de límites permitidos [10..256].`);
    }
    if (typeof m.seed !== 'number' || !Number.isFinite(m.seed)) {
      errors.push('meta.seed debe ser un número finito.');
    }
    if (typeof m.defaultBiome !== 'string' || !VALID_BIOMES.has(m.defaultBiome)) {
      errors.push(`meta.defaultBiome ("${m.defaultBiome}") inválido. Valores permitidos: ${Array.from(VALID_BIOMES).join(', ')}.`);
    }
  }

  // 2. Border
  if (!doc.border || typeof doc.border !== 'object') {
    errors.push('Falta el bloque "border" { thickness, material }.');
  } else {
    const b = doc.border;
    if (typeof b.thickness !== 'number' || !Number.isInteger(b.thickness) || b.thickness < 0 || b.thickness > 12) {
      errors.push(`border.thickness (${b.thickness}) fuera de límites permitidos [0..12].`);
    }
    if (typeof b.material !== 'string' || !VALID_BORDER_MATERIALS.has(b.material)) {
      errors.push(`border.material ("${b.material}") inválido. Valores permitidos: ${Array.from(VALID_BORDER_MATERIALS).join(', ')}.`);
    }
  }

  const seenIds = new Set<string>();
  const checkUniqueId = (kind: string, id: unknown, idx: number) => {
    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push(`${kind}[${idx}]: el campo "id" debe ser un string no vacío.`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`${kind}[${idx}]: id duplicado "${id}". Todos los ids del mapa deben ser únicos.`);
    }
    seenIds.add(id);
  };

  // 3. Regions
  if (!Array.isArray(doc.regions)) {
    errors.push('El campo "regions" debe ser un array.');
  } else {
    doc.regions.forEach((reg: any, idx: number) => {
      checkUniqueId('regions', reg?.id, idx);
      if (!VALID_BIOMES.has(reg?.biome)) {
        errors.push(`regions[${idx}] ("${reg?.id}"): biome "${reg?.biome}" inválido.`);
      }
      if (!Array.isArray(reg?.points) || reg.points.length < 3) {
        errors.push(`regions[${idx}] ("${reg?.id}"): un polígono de región requiere al menos 3 puntos (recibidos: ${reg?.points?.length ?? 0}).`);
      } else {
        reg.points.forEach((pt: any, pIdx: number) => {
          if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number') {
            errors.push(`regions[${idx}] ("${reg?.id}"): punto[${pIdx}] inválido.`);
          }
        });
      }
      if (typeof reg?.edgeNoise !== 'number' || reg.edgeNoise < 0 || reg.edgeNoise > 10) {
        errors.push(`regions[${idx}] ("${reg?.id}"): edgeNoise (${reg?.edgeNoise}) fuera de rango [0..10].`);
      }
      if (typeof reg?.noiseScale !== 'number' || reg.noiseScale <= 0 || reg.noiseScale > 10) {
        errors.push(`regions[${idx}] ("${reg?.id}"): noiseScale (${reg?.noiseScale}) fuera de rango (0..10].`);
      }
    });
  }

  // 4. Paths
  if (!Array.isArray(doc.paths)) {
    errors.push('El campo "paths" debe ser un array.');
  } else {
    doc.paths.forEach((p: any, idx: number) => {
      checkUniqueId('paths', p?.id, idx);
      if (!VALID_PATH_RANKS.has(p?.rank)) {
        errors.push(`paths[${idx}] ("${p?.id}"): rank "${p?.rank}" inválido (debe ser main | secondary | trail).`);
      }
      if (typeof p?.surface !== 'string' || p.surface.trim().length === 0) {
        errors.push(`paths[${idx}] ("${p?.id}"): surface debe ser un string no vacío.`);
      }
      if (!Array.isArray(p?.points) || p.points.length < 2) {
        errors.push(`paths[${idx}] ("${p?.id}"): un camino requiere al menos 2 puntos.`);
      }
      if (typeof p?.widthJitter !== 'number' || p.widthJitter < 0 || p.widthJitter > 3) {
        errors.push(`paths[${idx}] ("${p?.id}"): widthJitter (${p?.widthJitter}) fuera de rango [0..3].`);
      }
    });
  }

  // 5. Patches
  if (!Array.isArray(doc.patches)) {
    errors.push('El campo "patches" debe ser un array.');
  } else {
    doc.patches.forEach((pa: any, idx: number) => {
      checkUniqueId('patches', pa?.id, idx);
      if (!VALID_PATCH_TYPES.has(pa?.type)) {
        errors.push(`patches[${idx}] ("${pa?.id}"): type "${pa?.type}" inválido.`);
      }
      if (!Array.isArray(pa?.center) || pa.center.length !== 2 || typeof pa.center[0] !== 'number' || typeof pa.center[1] !== 'number') {
        errors.push(`patches[${idx}] ("${pa?.id}"): center debe ser [x, y].`);
      }
      if (typeof pa?.radius !== 'number' || pa.radius <= 0 || pa.radius > 64) {
        errors.push(`patches[${idx}] ("${pa?.id}"): radius (${pa?.radius}) fuera de rango (0..64].`);
      }
      if (typeof pa?.aspect !== 'number' || pa.aspect < 0.2 || pa.aspect > 5) {
        errors.push(`patches[${idx}] ("${pa?.id}"): aspect (${pa?.aspect}) fuera de rango [0.2..5].`);
      }
      if (typeof pa?.rotation !== 'number' || !Number.isFinite(pa.rotation)) {
        errors.push(`patches[${idx}] ("${pa?.id}"): rotation debe ser un número finito.`);
      }
      if (typeof pa?.noise !== 'number' || pa.noise < 0 || pa.noise > 2) {
        errors.push(`patches[${idx}] ("${pa?.id}"): noise (${pa?.noise}) fuera de rango [0..2].`);
      }
    });
  }

  // 6. Stamps
  if (!Array.isArray(doc.stamps)) {
    errors.push('El campo "stamps" debe ser un array.');
  } else {
    doc.stamps.forEach((st: any, idx: number) => {
      checkUniqueId('stamps', st?.id, idx);
      if (typeof st?.stampId !== 'string' || st.stampId.trim().length === 0) {
        errors.push(`stamps[${idx}] ("${st?.id}"): stampId debe ser un string no vacío.`);
      }
      if (typeof st?.x !== 'number' || !Number.isInteger(st.x) || typeof st?.y !== 'number' || !Number.isInteger(st.y)) {
        errors.push(`stamps[${idx}] ("${st?.id}"): coordenadas (x, y) deben ser enteros.`);
      }
      if (!VALID_ROTATIONS.has(st?.rot)) {
        errors.push(`stamps[${idx}] ("${st?.id}"): rot (${st?.rot}) inválida. Debe ser 0 | 90 | 180 | 270.`);
      }
    });
  }

  // 7. Landmarks
  if (!Array.isArray(doc.landmarks)) {
    errors.push('El campo "landmarks" debe ser un array.');
  } else {
    doc.landmarks.forEach((lm: any, idx: number) => {
      checkUniqueId('landmarks', lm?.id, idx);
      if (!VALID_LANDMARK_ROLES.has(lm?.role)) {
        errors.push(`landmarks[${idx}] ("${lm?.id}"): role "${lm?.role}" inválido.`);
      }
      if (typeof lm?.x !== 'number' || !Number.isInteger(lm.x) || typeof lm?.y !== 'number' || !Number.isInteger(lm.y)) {
        errors.push(`landmarks[${idx}] ("${lm?.id}"): coordenadas (x, y) deben ser enteros.`);
      }
      if (typeof lm?.label !== 'string' || lm.label.trim().length === 0) {
        errors.push(`landmarks[${idx}] ("${lm?.id}"): label debe ser un string no vacío.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
