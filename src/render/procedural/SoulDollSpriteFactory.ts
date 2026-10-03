import { PartBlock } from '../../types/bodies';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { GlobalSaveService } from '../../services/SaveService';

export type ChassisMaterial = 'wood' | 'iron' | 'crystal' | 'stone' | 'clay' | 'bone';
export type SpriteView = 'front' | 'back' | 'icon' | 'attack';

export interface LayeredRenderConfig {
  speciesId: string;
  chassisMaterial?: ChassisMaterial;
  weaponId?: string;
  equippedWeaponId?: string | null;
  brokenParts?: PartBlock;
  view?: SpriteView;
  frame?: number; // 0 or 1 for attack
  statusCondition?: string | null;
  outfitStyle?: 'clasico' | 'atrevido';
}

export interface CreatureSpriteSet {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  icon: HTMLCanvasElement;
  attack?: HTMLCanvasElement;
}

export class SoulDollSpriteFactory {
  private static cache: Map<string, HTMLCanvasElement> = new Map();
  private static customSpritesheet: HTMLImageElement | null = null;
  private static customSpritesheetLoaded = false;

  static {
    // Preload custom spritesheet if running in browser
    if (typeof window !== 'undefined') {
      const img = new Image();
      img.src = '/Assets/524060170_1790895365875586.jpg';
      img.onload = () => {
        this.customSpritesheet = img;
        this.customSpritesheetLoaded = true;
        // Clear cache so that it re-renders using the real spritesheet
        this.cache.clear();
      };
      img.onerror = () => {
        // Retry with relative lowercase fallback
        const fallbackImg = new Image();
        fallbackImg.src = './Assets/524060170_1790895365875586.jpg';
        fallbackImg.onload = () => {
          this.customSpritesheet = fallbackImg;
          this.customSpritesheetLoaded = true;
          this.cache.clear();
        };
      };
    }
  }

  /**
   * Helper to darken / lighten hex colors
   */
  public static adjustColor(hex: string, percent: number): string {
    const cleanHex = (hex || '#6366f1').replace('#', '');
    const num = parseInt(cleanHex, 16) || 0x6366f1;
    let r = (num >> 16) + Math.round(255 * (percent / 100));
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
    let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  private static createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  /**
   * Generates or retrieves from cache a single layered sprite canvas
   */
  public static generateLayeredCanvas(config: LayeredRenderConfig): HTMLCanvasElement {
    const speciesId = config.speciesId || 'maga';
    const mat = config.chassisMaterial || 'wood';
    const weaponId = config.equippedWeaponId || config.weaponId || 'default';
    const brokenKey = config.brokenParts
      ? `${config.brokenParts.head}_${config.brokenParts.torso}_${config.brokenParts.arms}_${config.brokenParts.legs}`
      : 'ok';
    const view = config.view || 'front';
    const frame = config.frame || 0;
    const status = config.statusCondition || 'none';

    // Get current Outfit Style setting from GlobalSaveService
    let styleSetting: 'clasico' | 'atrevido' = 'clasico';
    try {
      const state = GlobalSaveService.getCurrentState();
      if (state && state.settings && state.settings.outfitStyle) {
        styleSetting = state.settings.outfitStyle;
      }
    } catch (_) {
      // Ignore
    }

    const outfitStyle = config.outfitStyle || styleSetting;

    const cacheKey = `${speciesId}_${mat}_${weaponId}_${brokenKey}_${view}_${frame}_${status}_${outfitStyle}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const size = view === 'icon' ? 32 : 64;
    const { canvas, ctx } = this.createCanvas(size, size);

    // CHECK IF CUSTOM REAL SPRITESHEET IS PRESENT AND PREFERRED
    // We map custom spritesheet to the starter species ('maga' or 'archimaga') for a fantastic visual showcase
    const useRealSpritesheet = this.customSpritesheetLoaded && this.customSpritesheet && (speciesId === 'maga' || speciesId === 'starter');

    if (useRealSpritesheet && view !== 'icon' && this.customSpritesheet) {
      ctx.save();
      const img = this.customSpritesheet;
      const totalWidth = img.width;
      const totalHeight = img.height;
      const frameWidth = totalWidth / 4;
      const frameHeight = totalHeight;

      let colIndex = 0; // default front 3/4
      if (view === 'front') {
        colIndex = 0; // Frente 3/4
      } else if (view === 'back') {
        colIndex = 3; // Atrás 3/4 (espaldas 3/4 for player)
      } else if (view === 'attack') {
        colIndex = 0; // Frente 3/4 as fallback
      }

      // Draw custom spritesheet frame resized into 64x64
      ctx.drawImage(
        img,
        colIndex * frameWidth,
        0,
        frameWidth,
        frameHeight,
        0,
        0,
        size,
        size
      );

      // Render custom glamour layers / overlay depending on the 'atrevido' mode
      if (outfitStyle === 'atrevido') {
        // Glamour magic aura overlay (soft pink / gold sparks)
        ctx.fillStyle = '#ff8fbb';
        ctx.shadowColor = '#9b6bff';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(32, 34, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      // Overlay status condition on top
      this.drawAccessoryAndStatusLayer(ctx, { classId: 'maga' }, status, view);

      // Overlay broken parts cracks
      if (config.brokenParts) {
        this.drawDamageLayer(ctx, config.brokenParts, view);
      }

      ctx.restore();
    } else {
      // FALLBACK TO PROCEDURAL LAYERS
      const species = CREATURES_DATA[speciesId] || CREATURES_DATA['maga'];

      if (view === 'icon') {
        this.drawIconView(ctx, species, mat);
      } else {
        ctx.save();
        // Apply posture tilt if legs broken
        const isLegsBroken = config.brokenParts && config.brokenParts.legs <= 0;
        if (isLegsBroken) {
          ctx.translate(32, 40);
          ctx.rotate(view === 'back' ? -0.12 : 0.12);
          ctx.translate(-32, -36);
        }

        // Layer 1: Chassis / Material Body
        this.drawChassisLayer(ctx, mat, view, config.brokenParts);

        // Layer 2: Class Outfit (respecting classic vs bold outfitStyle)
        this.drawClassOutfitLayer(ctx, species, view, outfitStyle);

        // Layer 3: Weapon
        this.drawWeaponLayer(ctx, species, weaponId, view, frame, config.brokenParts);

        // Layer 4: Accessories & Status
        this.drawAccessoryAndStatusLayer(ctx, species, status, view);

        // Layer 5: Damage / Broken parts overlays
        if (config.brokenParts) {
          this.drawDamageLayer(ctx, config.brokenParts, view);
        }

        ctx.restore();
      }
    }

    this.cache.set(cacheKey, canvas);
    return canvas;
  }

  /**
   * Generates full sprite set (front, back, icon, attack)
   */
  public static generateSpriteSet(species: any, mat: ChassisMaterial = 'wood'): CreatureSpriteSet {
    return {
      front: this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'front' }),
      back: this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'back' }),
      icon: this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'icon' }),
      attack: this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'attack', frame: 1 }),
    };
  }

  // -------------------------------------------------------------
  // LAYER 1: CHASSIS / MATERIAL BODY
  // -------------------------------------------------------------
  private static drawChassisLayer(
    ctx: CanvasRenderingContext2D,
    mat: ChassisMaterial,
    view: SpriteView,
    brokenParts?: PartBlock
  ): void {
    const isArmsBroken = brokenParts && brokenParts.arms <= 0;

    let baseCol = '#874c26'; // Wood
    let shadowCol = '#422513';
    let lightCol = '#a3623b';
    let jointCol = '#291407';

    if (mat === 'iron') {
      baseCol = '#64748b'; shadowCol = '#334155'; lightCol = '#94a3b8'; jointCol = '#1e293b';
    } else if (mat === 'crystal') {
      baseCol = '#0284c7'; shadowCol = '#0369a1'; lightCol = '#38bdf8'; jointCol = '#0f172a';
    } else if (mat === 'stone') {
      baseCol = '#475569'; shadowCol = '#1e293b'; lightCol = '#64748b'; jointCol = '#0f172a';
    } else if (mat === 'clay') {
      baseCol = '#b45309'; shadowCol = '#78350f'; lightCol = '#d97706'; jointCol = '#451a03';
    } else if (mat === 'bone') {
      baseCol = '#fef3c7'; shadowCol = '#d97706'; lightCol = '#ffffff'; jointCol = '#92400e';
    }

    const cx = 32;
    const cy = 34;

    ctx.fillStyle = '#090d16'; // Outline

    // Head base
    ctx.fillRect(cx - 9, cy - 23, 18, 18);
    ctx.fillStyle = baseCol;
    ctx.fillRect(cx - 8, cy - 22, 16, 16);
    ctx.fillStyle = lightCol;
    ctx.fillRect(cx - 7, cy - 21, 6, 4);

    // Neck joint
    ctx.fillStyle = jointCol;
    ctx.fillRect(cx - 3, cy - 5, 6, 4);

    // Torso container box
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 11, cy - 1, 22, 22);
    ctx.fillStyle = baseCol;
    ctx.fillRect(cx - 10, cy, 20, 20);
    ctx.fillStyle = shadowCol;
    ctx.fillRect(cx - 8, cy + 12, 16, 6);

    // Core ki gem in center of torso
    ctx.fillStyle = '#5fe3d2'; // Cyan ki glow gem
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 9, cy + 20, 7, 18);
    ctx.fillRect(cx + 2, cy + 20, 7, 18);
    ctx.fillStyle = baseCol;
    ctx.fillRect(cx - 8, cy + 20, 5, 16);
    ctx.fillRect(cx + 3, cy + 20, 5, 16);

    // Knee joints
    ctx.fillStyle = jointCol;
    ctx.fillRect(cx - 8, cy + 27, 5, 3);
    ctx.fillRect(cx + 3, cy + 27, 5, 3);

    // Arms
    if (isArmsBroken) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - 15, cy + 4, 5, 16);
      ctx.fillRect(cx + 10, cy + 4, 5, 16);
      ctx.fillStyle = shadowCol;
      ctx.fillRect(cx - 14, cy + 5, 3, 14);
      ctx.fillRect(cx + 11, cy + 5, 3, 14);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - 15, cy + 1, 5, 18);
      ctx.fillRect(cx + 10, cy + 1, 5, 18);
      ctx.fillStyle = baseCol;
      ctx.fillRect(cx - 14, cy + 2, 3, 16);
      ctx.fillRect(cx + 11, cy + 2, 3, 16);

      // Shoulder joints
      ctx.fillStyle = jointCol;
      ctx.fillRect(cx - 14, cy + 1, 4, 4);
      ctx.fillRect(cx + 10, cy + 1, 4, 4);
    }

    // Material specific texture marks
    if (mat === 'wood') {
      ctx.fillStyle = jointCol;
      ctx.fillRect(cx - 4, cy + 3, 2, 8);
      ctx.fillRect(cx + 2, cy + 10, 2, 6);
    } else if (mat === 'iron') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 9, cy + 2, 2, 2);
      ctx.fillRect(cx + 7, cy + 2, 2, 2);
    } else if (mat === 'stone') {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(cx - 6, cy + 14, 3, 2);
    }
  }

  // -------------------------------------------------------------
  // LAYER 2: CLASS OUTFIT
  // -------------------------------------------------------------
  private static drawClassOutfitLayer(
    ctx: CanvasRenderingContext2D,
    species: any,
    view: SpriteView,
    outfitStyle: 'clasico' | 'atrevido' = 'clasico'
  ): void {
    const isEvo = species.dexNumber % 2 === 0;
    const classId = species.classId || 'maga';

    const cx = 32;
    const cy = 34;

    const classPalettes: Record<string, { main: string; sec: string; gold: string }> = {
      maga: { main: '#ea580c', sec: '#f97316', gold: '#fef08a' },
      archimaga: { main: '#c2410c', sec: '#ef4444', gold: '#facc15' },
      sacerdotisa: { main: '#16a34a', sec: '#22c55e', gold: '#fef08a' },
      hierofante: { main: '#15803d', sec: '#4ade80', gold: '#facc15' },
      gladiadora: { main: '#b45309', sec: '#d97706', gold: '#fef08a' },
      titanide: { main: '#92400e', sec: '#f59e0b', gold: '#facc15' },
      paladin: { main: '#b45309', sec: '#d97706', gold: '#fef08a' },
      templario: { main: '#92400e', sec: '#f59e0b', gold: '#facc15' },
      bruja: { main: '#7e22ce', sec: '#a855f7', gold: '#fef08a' },
      hechicera: { main: '#6b21a8', sec: '#c084fc', gold: '#facc15' },
      hidromante: { main: '#0284c7', sec: '#38bdf8', gold: '#fef08a' },
      cantora_marea: { main: '#0369a1', sec: '#7dd3fc', gold: '#facc15' },
      monje: { main: '#ca8a04', sec: '#eab308', gold: '#fef08a' },
      maestro_trueno: { main: '#a16207', sec: '#fde047', gold: '#facc15' },
      asesina: { main: '#334155', sec: '#64748b', gold: '#cbd5e1' },
      espectro: { main: '#1e1b4b', sec: '#7e22ce', gold: '#c084fc' },
    };

    const pal = classPalettes[classId] || classPalettes['maga'];

    ctx.fillStyle = pal.main;

    // Adjust parameters for bold vs classic garment cuts
    const isAtrevido = outfitStyle === 'atrevido';
    const robeOffset = isAtrevido ? 3 : 0; // Higher cut / corset look

    if (classId.includes('maga')) {
      ctx.fillRect(cx - 9, cy + 2 + robeOffset, 18, 18 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 7, cy + 4 + robeOffset, 14, 14 - robeOffset);
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 3, cy - 22, 6, 3); // Tiara

      if (isAtrevido) {
        // Glamour accent: high thigh trims and fancy sash
        ctx.fillStyle = '#ff8fbb'; // Porcelain pink lace accents
        ctx.fillRect(cx - 9, cy + 18, 3, 2);
        ctx.fillRect(cx + 6, cy + 18, 3, 2);
      }

      if (isEvo) {
        ctx.fillStyle = pal.sec;
        ctx.fillRect(cx - 14, cy, 4, 22);
        ctx.fillRect(cx + 10, cy, 4, 22);
      }
    } else if (classId.includes('sacerdotisa') || classId.includes('hierofante')) {
      ctx.fillRect(cx - 9, cy + 2 + robeOffset, 18, 18 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 3, cy + 2 + robeOffset, 6, 18 - robeOffset); // Stole
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 5, cy - 23, 10, 3); // Root Crown
    } else if (classId.includes('paladin') || classId.includes('templario') || classId.includes('gladiadora') || classId.includes('titanide')) {
      ctx.fillRect(cx - 9, cy + 1 + robeOffset, 18, 12 - robeOffset);
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 4, cy + 4, 8, 6); // Crest
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 12, cy + 1, 4, 6); // Shoulder pads
      ctx.fillRect(cx + 8, cy + 1, 4, 6);
    } else if (classId.includes('bruja') || classId.includes('hechicera')) {
      ctx.fillRect(cx - 8, cy + 4 + robeOffset, 16, 16 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 32);
      ctx.lineTo(cx - 12, cy - 20);
      ctx.lineTo(cx + 12, cy - 20);
      ctx.closePath();
      ctx.fill();
    } else if (classId.includes('hidromante') || classId.includes('cantora')) {
      ctx.fillRect(cx - 9, cy + 3 + robeOffset, 18, 16 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 11, cy + 6, 22, 8);
    } else if (classId.includes('monje') || classId.includes('maestro')) {
      ctx.fillRect(cx - 8, cy + 2 + robeOffset, 16, 16 - robeOffset);
      ctx.fillStyle = '#0f172a'; // Black belt
      ctx.fillRect(cx - 8, cy + 12, 16, 3);
      if (isEvo) {
        ctx.fillStyle = pal.gold;
        ctx.fillRect(cx - 7, cy + 3, 3, 3);
        ctx.fillRect(cx + 4, cy + 3, 3, 3);
      }
    } else if (classId.includes('asesina') || classId.includes('espectro')) {
      ctx.fillRect(cx - 9, cy + 2 + robeOffset, 18, 18 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 8, cy - 22, 16, 6); // Cowl mask
    }

    // Eyes
    if (view !== 'back') {
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 4, cy - 16, 3, 3);
      ctx.fillRect(cx + 1, cy - 16, 3, 3);
    }
  }

  // -------------------------------------------------------------
  // LAYER 3: WEAPON
  // -------------------------------------------------------------
  private static drawWeaponLayer(
    ctx: CanvasRenderingContext2D,
    species: any,
    weaponId: string,
    view: SpriteView,
    frame = 0,
    brokenParts?: PartBlock
  ): void {
    if (brokenParts && brokenParts.arms <= 0) return;

    const cx = 32;
    const cy = 34;

    const isAttack = view === 'attack' || frame === 1;
    const wx = isAttack ? cx + 18 : cx + 14;
    const wy = isAttack ? cy + 2 : cy + 8;

    const weaponName = weaponId.toLowerCase();

    ctx.save();

    if (weaponName.includes('baculo') || weaponName.includes('basto') || weaponName.includes('escoba')) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(wx - 2, wy - 18, 4, 28);
      ctx.fillStyle = weaponName.includes('fuego') || weaponName.includes('solaria') ? '#ea580c' : '#22c55e';
      ctx.beginPath();
      ctx.arc(wx, wy - 20, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (weaponName.includes('martillo') || weaponName.includes('titan')) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(wx - 3, wy - 16, 6, 24);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(wx - 8, wy - 20, 16, 8);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cx - 20, cy + 4, 8, 12);
    } else if (weaponName.includes('tridente') || weaponName.includes('cetro')) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(wx - 2, wy - 18, 4, 28);
      ctx.fillRect(wx - 6, wy - 22, 12, 3);
      ctx.fillRect(wx - 6, wy - 26, 3, 5);
      ctx.fillRect(wx - 1, wy - 28, 3, 7);
      ctx.fillRect(wx + 4, wy - 26, 3, 5);
    } else if (weaponName.includes('guante') || weaponName.includes('nunchaku')) {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(wx - 4, wy, 8, 8);
      ctx.fillRect(cx - 18, cy + 6, 8, 8);
    } else if (weaponName.includes('daga') || weaponName.includes('espectral')) {
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(wx - 1, wy - 12, 3, 16);
      ctx.fillRect(cx - 17, cy, 3, 16);
    } else {
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(wx - 2, wy - 16, 4, 24);
      ctx.fillRect(wx - 4, wy - 20, 8, 5);
    }

    if (isAttack) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 16, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // LAYER 4: ACCESSORY & STATUS EFFECT
  // -------------------------------------------------------------
  private static drawAccessoryAndStatusLayer(
    ctx: CanvasRenderingContext2D,
    species: any,
    status: string,
    view: SpriteView
  ): void {
    const cx = 32;
    const cy = 34;

    if (!status || status === 'none') return;

    ctx.save();
    if (status === 'burn') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 12, cy + 18, 4, 4);
      ctx.fillRect(cx + 8, cy + 16, 4, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(cx - 10, cy + 16, 3, 3);
    } else if (status === 'poison') {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 10, 3, 0, Math.PI * 2);
      ctx.arc(cx + 10, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (status === 'paralysis') {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 4); ctx.lineTo(cx - 10, cy + 4); ctx.lineTo(cx - 6, cy);
      ctx.stroke();
    } else if (status === 'sleep') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 12px monospace';
      ctx.fillText('Zzz', cx + 12, cy - 18);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // LAYER 5: DAMAGE & BROKEN PARTS OVERLAY
  // -------------------------------------------------------------
  private static drawDamageLayer(
    ctx: CanvasRenderingContext2D,
    broken: PartBlock,
    view: SpriteView
  ): void {
    const cx = 32;
    const cy = 34;

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;

    if (broken.head <= 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 20);
      ctx.lineTo(cx + 2, cy - 14);
      ctx.lineTo(cx - 2, cy - 8);
      ctx.stroke();
    }

    if (broken.torso <= 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 2);
      ctx.lineTo(cx + 6, cy + 10);
      ctx.lineTo(cx - 4, cy + 18);
      ctx.stroke();
    }

    if (broken.arms <= 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 15, cy + 2, 6, 2);
      ctx.fillRect(cx + 9, cy + 2, 6, 2);
    }

    if (broken.legs <= 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 8, cy + 26, 5, 2);
      ctx.fillRect(cx + 3, cy + 26, 5, 2);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // ICON VIEW (32x32)
  // -------------------------------------------------------------
  private static drawIconView(ctx: CanvasRenderingContext2D, species: any, mat: ChassisMaterial): void {
    const classId = species.classId || 'maga';
    const cx = 16;
    const cy = 16;

    let col = '#f97316';
    if (classId.includes('sacerdotisa') || classId.includes('hierofante')) col = '#22c55e';
    if (classId.includes('paladin') || classId.includes('templario') || classId.includes('gladiadora') || classId.includes('titanide')) col = '#b45309';
    if (classId.includes('bruja') || classId.includes('hechicera')) col = '#a855f7';
    if (classId.includes('hidromante') || classId.includes('cantora')) col = '#38bdf8';
    if (classId.includes('monje') || classId.includes('maestro')) col = '#eab308';
    if (classId.includes('asesina') || classId.includes('espectro')) col = '#7e22ce';

    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 10, cy - 10, 20, 20);

    ctx.fillStyle = col;
    ctx.fillRect(cx - 8, cy - 8, 16, 16);

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cx - 4, cy - 4, 3, 3);
    ctx.fillRect(cx + 1, cy - 4, 3, 3);
  }
}
