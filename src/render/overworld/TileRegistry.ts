import * as THREE from 'three';
import artConfigJson from '../../data/config/art.json';
import legacyMapJson from '../../data/tilesets/legacy_map.json';
import animaCoreJson from '../../data/tilesets/anima_core.json';
import animaCoreBakedJson from '../../data/tilesets/anima_core_baked.json';
import {
  TileType,
  MigrationCategory,
  TileFlagDefinition,
  TileSheetDefinition,
  BakedAtlasIndex,
  BakedVariantRect,
} from '../../types/tilesets';
import { UVRegion } from './TallerAtlas';
import { GlobalTallerAtlas } from './TallerAtlas';
import { GlobalMercadoAtlas } from './MercadoAtlas';
import { GlobalOverworldDecor } from './DecorRenderer';

export type TileOriginType = 'pack' | 'atlas' | 'proc';

export interface ResolvedTileReference {
  origin: TileOriginType;
  canonicalRef: string; // e.g., "pack:anima_core:Outside_A2:0" or "atlas:taller:floor_wood_dark" or "proc:grass"
  packId?: string;
  sheetId?: string;
  tileIndex?: number;
  shortKey?: string; // e.g., "Outside_A2:0"
  atlasId?: string;
  frameName?: string;
  flags: TileFlagDefinition;
}

/**
 * BLOQUE 44 Req. 4 & 6: TileRegistry
 * - Resuelve tres orígenes:
 *   1. "pack:" (hojas RPG Maker A1-A5 y B-E horneadas en atlas)
 *   2. "atlas:" (atlas por rectángulos de los Bloques 33/34/36: Taller, Mercado, decorados)
 *   3. "proc:" (fallback a canvas sólido/estilizado únicamente cuando una categoría tiene su flag de migración desactivado)
 * - Gestiona los flags por tile (passable 4 direcciones, bush, counter, ladder, damage, terrainTag, star)
 *   aplicando los valores por defecto por tipo de hoja (A1 no transitable, A2/A5 transitables, B-E no transitables salvo marcados).
 * - Reutiliza el contrato `AtlasRegion` de los Bloques 33/34/36 para devolver coordenadas UV normalizadas desde el atlas horneado.
 */
export class TileRegistry {
  private static instance: TileRegistry;

  private migrationFlags: Record<MigrationCategory, boolean> = {
    ground: Boolean(artConfigJson.migrationFlags?.ground ?? true),
    water: Boolean(artConfigJson.migrationFlags?.water ?? true),
    vegetation_rocks: Boolean(artConfigJson.migrationFlags?.vegetation_rocks ?? true),
    facades: Boolean(artConfigJson.migrationFlags?.facades ?? true),
    interiors: Boolean(artConfigJson.migrationFlags?.interiors ?? true),
  };

  private sheetsById: Map<string, TileSheetDefinition> = new Map();
  private tilesByShortKey: Map<string, TileFlagDefinition> = new Map();
  private bakedIndex: BakedAtlasIndex = animaCoreBakedJson as unknown as BakedAtlasIndex;
  private fallbackCanvases: Map<string, HTMLCanvasElement> = new Map();
  private fallbackThreeTextures: Map<string, THREE.CanvasTexture> = new Map();

  private constructor() {
    this.initPackData();
  }

  public static getInstance(): TileRegistry {
    if (!TileRegistry.instance) {
      TileRegistry.instance = new TileRegistry();
    }
    return TileRegistry.instance;
  }

  private initPackData(): void {
    const sheets = (animaCoreJson.sheets || []) as TileSheetDefinition[];
    for (const s of sheets) {
      this.sheetsById.set(s.id, s);
    }

    const rawTiles = (animaCoreJson.tiles || {}) as unknown as Record<string, Partial<TileFlagDefinition>>;
    for (const [shortKey, def] of Object.entries(rawTiles)) {
      const [sheetId] = shortKey.split(':');
      const sheet = this.sheetsById.get(sheetId);
      const kind = sheet?.kind || 'A2';

      // Valores por defecto por tipo de hoja según Bloque 44 Req. 4:
      // - agua A1: no transitable
      // - A2 y A5: transitables salvo los marcados
      // - A3, A4 y B-E: no transitables salvo los marcados
      const defaultPassable =
        kind === 'A2' || kind === 'A5'
          ? ([true, true, true, true] as [boolean, boolean, boolean, boolean])
          : ([false, false, false, false] as [boolean, boolean, boolean, boolean]);

      const defaultCategory: MigrationCategory =
        kind === 'A1'
          ? 'water'
          : kind === 'A3' || kind === 'A4'
          ? 'facades'
          : kind === 'B' || kind === 'C' || kind === 'D' || kind === 'E'
          ? 'vegetation_rocks'
          : 'ground';

      this.tilesByShortKey.set(shortKey, {
        name: def.name || shortKey,
        category: (def.category as MigrationCategory) || defaultCategory,
        autotile: Boolean(def.autotile ?? (kind === 'A1' || kind === 'A2' || kind === 'A3' || kind === 'A4')),
        animatedFrames: def.animatedFrames || (kind === 'A1' ? 3 : 1),
        wallHeight: def.wallHeight,
        passable: (def.passable as [boolean, boolean, boolean, boolean]) || defaultPassable,
        bush: Boolean(def.bush ?? false),
        counter: Boolean(def.counter ?? false),
        ladder: Boolean(def.ladder ?? false),
        damage: Boolean(def.damage ?? false),
        star: Boolean(def.star ?? false),
        terrainTag: def.terrainTag ?? 0,
        upperStarTile: def.upperStarTile,
        multiTile: def.multiTile,
      });
    }
  }

  public getMigrationFlags(): Record<MigrationCategory, boolean> {
    return { ...this.migrationFlags };
  }

  public setMigrationFlag(category: MigrationCategory, enabled: boolean): void {
    this.migrationFlags[category] = enabled;
  }

  public isCategoryMigrated(category: MigrationCategory): boolean {
    return this.migrationFlags[category] !== false;
  }

  public getBakedAtlasIndex(): BakedAtlasIndex {
    return this.bakedIndex;
  }

  /**
   * Traduce cualquier id de mapa (legacy como "grass", "water", "tree" o explícito como "pack:anima_core:Outside_A2:0",
   * "atlas:taller:house_exterior", "proc:grass") a su descriptor `ResolvedTileReference`.
   */
  public resolveTile(rawId: string, layer: 'ground' | 'decor' = 'ground', mapCategory?: string): ResolvedTileReference {
    let ref = rawId || (layer === 'ground' ? 'grass' : '');

    // 1. Si no lleva prefijo de origen, traducir mediante legacy_map.json
    if (!ref.startsWith('pack:') && !ref.startsWith('atlas:') && !ref.startsWith('proc:')) {
      if (layer === 'ground' && ref === 'path' && mapCategory === 'town') {
        ref = (legacyMapJson.ground as Record<string, string>).cobble || (legacyMapJson.ground as Record<string, string>).path;
      } else {
        const table = layer === 'ground' ? (legacyMapJson.ground as Record<string, string>) : (legacyMapJson.decor as Record<string, string>);
        ref = table[ref] || (legacyMapJson.ground as Record<string, string>)[ref] || (legacyMapJson.decor as Record<string, string>)[ref] || `pack:anima_core:Outside_A2:0`;
      }
    }

    // 2. Origen "atlas:<atlasName>:<frameName>" (Coexistencia con Bloques 33/34/36)
    if (ref.startsWith('atlas:')) {
      const [, atlasId, frameName] = ref.split(':');
      return {
        origin: 'atlas',
        canonicalRef: ref,
        atlasId,
        frameName,
        flags: {
          name: `${atlasId}:${frameName}`,
          category: atlasId === 'decor' ? 'vegetation_rocks' : 'interiors',
          passable: [false, false, false, false],
          bush: false,
          counter: false,
          ladder: false,
          damage: false,
          star: false,
          terrainTag: 0,
        },
      };
    }

    // 3. Origen "pack:<packId>:<sheetId>:<index>"
    if (ref.startsWith('pack:')) {
      const parts = ref.split(':');
      const packId = parts[1] || 'anima_core';
      const sheetId = parts[2] || 'Outside_A2';
      const tileIndex = Number(parts[3] ?? 0);
      const shortKey = `${sheetId}:${tileIndex}`;
      const flags = this.tilesByShortKey.get(shortKey) || {
        name: shortKey,
        category: 'ground',
        autotile: false,
        passable: [true, true, true, true],
        bush: false,
        counter: false,
        ladder: false,
        damage: false,
        star: false,
        terrainTag: 0,
      };

      // Si la categoría de este tile está desactivada por flag de migración, hacer fallback a "proc:"
      if (!this.isCategoryMigrated(flags.category)) {
        return {
          origin: 'proc',
          canonicalRef: `proc:${rawId}`,
          packId,
          sheetId,
          tileIndex,
          shortKey,
          flags,
        };
      }

      return {
        origin: 'pack',
        canonicalRef: `pack:${packId}:${shortKey}`,
        packId,
        sheetId,
        tileIndex,
        shortKey,
        flags,
      };
    }

    // 4. Origen "proc:<id>"
    return {
      origin: 'proc',
      canonicalRef: ref.startsWith('proc:') ? ref : `proc:${ref}`,
      flags: {
        name: ref,
        category: 'ground',
        passable: [true, true, true, true],
        bush: false,
        counter: false,
        ladder: false,
        damage: false,
        star: false,
        terrainTag: 0,
      },
    };
  }

  /**
   * Reutiliza la convención `AtlasRegion` (de los Bloques 33/34/36) para devolver las coordenadas UV
   * normalizadas de una variante precalculada en el atlas horneado (`anima_core_baked.json`),
   * o bien de los atlas propios (`TallerAtlas`, `MercadoAtlas`, `DecorRenderer`).
   */
  public getAtlasRegion(canonicalRef: string, shapeIndex = 0, animFrame = 0): UVRegion | null {
    if (canonicalRef.startsWith('atlas:')) {
      const [, atlasId, frameName] = canonicalRef.split(':');
      if (atlasId === 'taller') return GlobalTallerAtlas.AtlasRegion(frameName);
      if (atlasId === 'mercado') return GlobalMercadoAtlas.AtlasRegion(frameName);
      if (atlasId === 'decor') {
        const reg = GlobalOverworldDecor.AtlasRegion(frameName);
        if (!reg) return null;
        return {
          u0: reg.u0,
          v0: reg.v0,
          u1: reg.u1,
          v1: reg.v1,
          w: reg.w,
          h: reg.h,
          pivot: reg.pivot,
        };
      }
      return null;
    }

    const entry = this.bakedIndex.variants[canonicalRef];
    if (!entry) return null;

    const rect: BakedVariantRect | undefined = entry.shapes[String(shapeIndex)] || entry.shapes['0'];
    if (!rect) return null;

    const W = this.bakedIndex.atlasWidth;
    const H = this.bakedIndex.atlasHeight;
    const frameOffsetPx = animFrame > 0 && entry.animatedFrames > 1 ? animFrame * this.bakedIndex.stride : 0;

    const u0 = (rect.x + frameOffsetPx) / W;
    const u1 = (rect.x + frameOffsetPx + rect.w) / W;
    const v0 = 1 - (rect.y + rect.h) / H;
    const v1 = 1 - rect.y / H;

    return {
      u0,
      v0,
      u1,
      v1,
      w: rect.w,
      h: rect.h,
      pivot: [0.5, 1.0],
    };
  }

  public getFrameStrideU(canonicalRef: string): { animatedFrames: number; frameStrideU: number } {
    const entry = this.bakedIndex.variants[canonicalRef];
    if (!entry) return { animatedFrames: 1, frameStrideU: 0 };
    return {
      animatedFrames: entry.animatedFrames || 1,
      frameStrideU: entry.frameStrideU || 0,
    };
  }

  /**
   * Provee un canvas de tile para compatibilidad o cuando un flag de migración está en false ("proc:").
   * Sustituye por completo al antiguo TileFactory procedural eliminado en el paso final del Bloque 44.
   */
  public getTileCanvas(type: TileType): HTMLCanvasElement {
    const key = String(type);
    if (this.fallbackCanvases.has(key)) {
      return this.fallbackCanvases.get(key)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const palette: Record<string, [string, string]> = {
      grass: ['#5cbf5a', '#4da84b'],
      tall_grass: ['#3b8e3e', '#28662b'],
      path: ['#d4a359', '#b8863d'],
      water: ['#2295d6', '#38bdf8'],
      sand: ['#f2d58c', '#dec076'],
      flowers: ['#5cbf5a', '#f472b6'],
      cave_floor: ['#3b3648', '#2a2636'],
      interior_floor: ['#7a4c2a', '#5e381d'],
      wall: ['#475569', '#334155'],
      building_wall: ['#f3e5c8', '#6e4726'],
      roof: ['#1e7a6d', '#135249'],
      door: ['#6b3e23', '#d97706'],
      tree: ['#1e6f40', '#144a2a'],
      rock: ['#64748b', '#475569'],
    };

    const [bg, accent] = palette[key] || ['#5cbf5a', '#4da84b'];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = accent;
    ctx.fillRect(6, 6, 8, 8);
    ctx.fillRect(28, 24, 10, 10);

    this.fallbackCanvases.set(key, canvas);
    return canvas;
  }

  public getTileThree(type: TileType): THREE.CanvasTexture {
    const key = String(type);
    if (this.fallbackThreeTextures.has(key)) {
      return this.fallbackThreeTextures.get(key)!;
    }
    const canvas = this.getTileCanvas(type);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.fallbackThreeTextures.set(key, tex);
    return tex;
  }
}

export const GlobalTileRegistry = TileRegistry.getInstance();
