import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Texture,
  Filter,
  GlProgram,
} from 'pixi.js';
import skillFxJson from '../../data/moves/skillFx.json';

export interface FXPoint {
  x: number;
  y: number;
}

export type CombatFXLayerName =
  | 'backFX'
  | 'frontFX'
  | 'projectileFX'
  | 'impactFX'
  | 'uiFX';

export type CombatFXElement =
  | 'Fuego'
  | 'Hielo'
  | 'Rayo'
  | 'Oscuridad'
  | 'Sombra'
  | 'Luz'
  | 'Viento'
  | 'Tierra'
  | 'Agua'
  | 'Planta'
  | 'Eléctrico'
  | 'Neutro';

export interface CombatFXOptions {
  position?: FXPoint;
  from?: FXPoint;
  to?: FXPoint;
  color?: number;
  secondaryColor?: number;
  coreColor?: number;
  scale?: number;
  duration?: number;
  direction?: number;
  layer?: CombatFXLayerName;
  count?: number;
  radius?: number;
  shake?: { intensity: number; duration: number };
  onHit?: () => void;
}

export interface UpdatableFX {
  container: Container;
  update(dt: number): boolean;
  destroy(): void;
}

// ============================================================================
// ELEMENTAL PALETTES (0% external assets, 100% procedural colors)
// ============================================================================
export const ELEMENT_FX_PALETTES: Record<
  string,
  { primary: number; secondary: number; core: number }
> = {
  Fuego: { primary: 0xff4d17, secondary: 0xffaa00, core: 0xffffff },
  Hielo: { primary: 0x38bdf8, secondary: 0xa5f3fc, core: 0xffffff },
  Rayo: { primary: 0xfacc15, secondary: 0x60a5fa, core: 0xffffff },
  Eléctrico: { primary: 0xfacc15, secondary: 0xfef08a, core: 0xffffff },
  Oscuridad: { primary: 0xa855f7, secondary: 0x4c1d95, core: 0xf3e8ff },
  Sombra: { primary: 0x9333ea, secondary: 0x3b0764, core: 0xe9d5ff },
  Luz: { primary: 0xfde047, secondary: 0xfef08a, core: 0xffffff },
  Viento: { primary: 0x34d399, secondary: 0xa7f3d0, core: 0xffffff },
  Planta: { primary: 0x22c55e, secondary: 0x86efac, core: 0xfef08a },
  Tierra: { primary: 0xd97706, secondary: 0x78350f, core: 0xfde047 },
  Agua: { primary: 0x0284c7, secondary: 0x7dd3fc, core: 0xffffff },
  Neutro: { primary: 0xc084fc, secondary: 0x94a3b8, core: 0xffffff },
};

// ============================================================================
// PROCEDURAL TEXTURE GENERATOR (In-memory 0-asset textures for luminous particles)
// ============================================================================
class ProceduralTextureCache {
  private static glowTexture: Texture | null = null;
  private static starTexture: Texture | null = null;
  private static shardTexture: Texture | null = null;
  private static ringTexture: Texture | null = null;

  public static getGlow(): Texture {
    if (this.glowTexture) return this.glowTexture;
    if (typeof document === 'undefined') return Texture.WHITE;

    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(32, 32, 32, 0, Math.PI * 2);
        ctx.fill();
      }
      this.glowTexture = Texture.from(c);
      return this.glowTexture;
    } catch {
      return Texture.WHITE;
    }
  }

  public static getStar(): Texture {
    if (this.starTexture) return this.starTexture;
    if (typeof document === 'undefined') return Texture.WHITE;

    try {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        // Center glow
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 18);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        // Horizontal lens flare streak
        const hGrad = ctx.createLinearGradient(0, 32, 64, 32);
        hGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
        hGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 30, 64, 4);

        // Vertical lens flare streak
        const vGrad = ctx.createLinearGradient(32, 0, 32, 64);
        vGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
        vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
        vGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(30, 0, 4, 64);

        // Center diamond
        ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
        ctx.beginPath();
        ctx.moveTo(32, 22);
        ctx.lineTo(42, 32);
        ctx.lineTo(32, 42);
        ctx.lineTo(22, 32);
        ctx.closePath();
        ctx.fill();
      }
      this.starTexture = Texture.from(c);
      return this.starTexture;
    } catch {
      return Texture.WHITE;
    }
  }

  public static getShard(): Texture {
    if (this.shardTexture) return this.shardTexture;
    if (typeof document === 'undefined') return Texture.WHITE;

    try {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 48;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.moveTo(24, 4);
        ctx.lineTo(32, 24);
        ctx.lineTo(24, 44);
        ctx.lineTo(16, 24);
        ctx.closePath();
        ctx.fill();
      }
      this.shardTexture = Texture.from(c);
      return this.shardTexture;
    } catch {
      return Texture.WHITE;
    }
  }
}

// ============================================================================
// CUSTOM PROCEDURAL GLSL FILTER (PixiJS v8 Filter + GlProgram)
// ============================================================================
const PROCEDURAL_VERTEX_GLSL = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const PROCEDURAL_FRAGMENT_GLSL = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main(void)
{
    vec4 color = texture(uTexture, vTextureCoord);
    if (color.a <= 0.001) {
        finalColor = vec4(0.0);
        return;
    }
    float pulse = 0.92 + 0.28 * sin(uTime * 18.0 + vTextureCoord.x * 12.0 + vTextureCoord.y * 12.0);
    float shimmer = 0.96 + 0.14 * hash(vTextureCoord * 80.0 + vec2(uTime * 2.0));
    vec3 boosted = color.rgb * pulse * shimmer * (1.0 + uIntensity * 0.5);
    finalColor = vec4(min(vec3(1.0), boosted), color.a);
}
`;

export function createProceduralEnergyFilter(intensity = 0.6): Filter | null {
  try {
    if (typeof window === 'undefined' || typeof WebGLRenderingContext === 'undefined') {
      return null;
    }
    const glProgram = GlProgram.from({
      vertex: PROCEDURAL_VERTEX_GLSL,
      fragment: PROCEDURAL_FRAGMENT_GLSL,
    });
    return new Filter({
      glProgram,
      resources: {
        energyUniforms: {
          uTime: { value: 0, type: 'f32' },
          uIntensity: { value: intensity, type: 'f32' },
        },
      },
    });
  } catch {
    return null;
  }
}

// ============================================================================
// 1. 🌀 EnergyRingFX (Runic Astral Seal & Hyper Shockwave)
// ============================================================================
export class EnergyRingFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private maxRadius: number;
  private ringsCount: number;

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.2, opts.duration ?? 0.45);
    this.color = opts.color ?? 0x38bdf8;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.maxRadius = (opts.radius ?? 76) * (opts.scale ?? 1);
    this.ringsCount = opts.count ?? 3;
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const alphaFade = Math.max(0, 1 - Math.pow(t, 1.8));

    // Phase 1: Initial blinding diamond star flash (t < 0.28)
    if (t < 0.28) {
      const flashT = t / 0.28;
      const flashR = this.maxRadius * 0.4 * (1 - flashT);
      const flashAlpha = (1 - flashT) * 0.95;
      this.g.circle(0, 0, flashR);
      this.g.fill({ color: 0xffffff, alpha: flashAlpha });
      // 4-point star spike
      const spikeLen = this.maxRadius * 0.85 * (1 - flashT);
      this.g.moveTo(-spikeLen, 0);
      this.g.lineTo(spikeLen, 0);
      this.g.stroke({ color: this.secondaryColor, width: 3, alpha: flashAlpha });
      this.g.moveTo(0, -spikeLen);
      this.g.lineTo(0, spikeLen);
      this.g.stroke({ color: this.secondaryColor, width: 3, alpha: flashAlpha });
    }

    // Outer supersonic shockwave ring (snappy quintic ease-out)
    const shockEase = 1 - Math.pow(1 - t, 4);
    const outerR = Math.max(4, this.maxRadius * shockEase);
    const outerAlpha = (1 - t) * 0.85;
    this.g.circle(0, 0, outerR);
    this.g.stroke({
      color: this.color,
      width: Math.max(1.5, (1 - t) * 7),
      alpha: outerAlpha,
    });

    // Secondary crisp white halo
    this.g.circle(0, 0, outerR * 0.92);
    this.g.stroke({
      color: this.secondaryColor,
      width: Math.max(1, (1 - t) * 3),
      alpha: outerAlpha * 0.9,
    });

    // Inner Arcane Magic Circle array with spinning runes
    for (let i = 0; i < this.ringsCount; i++) {
      const delay = i * 0.12;
      const localT = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
      if (localT <= 0 || localT >= 1) continue;

      const ease = 1 - Math.pow(1 - localT, 3);
      const r = Math.max(3, this.maxRadius * (0.45 + 0.5 * (i / this.ringsCount)) * ease);
      const alpha = (1 - localT) * 0.9;
      const col = i % 2 === 0 ? this.color : this.secondaryColor;

      // Base ring
      this.g.circle(0, 0, r);
      this.g.stroke({ color: col, width: Math.max(1, (1 - localT) * 4), alpha });

      // Arcane segmented glyph arcs (spin alternating clockwise / counter-clockwise)
      const dir = i % 2 === 0 ? 1 : -1;
      const spin = t * 6.0 * dir;
      const segs = 8;
      for (let s = 0; s < segs; s++) {
        const a0 = (s / segs) * Math.PI * 2 + spin;
        const a1 = a0 + 0.38;
        this.g.arc(0, 0, r * 0.82, a0, a1);
        this.g.stroke({ color: this.secondaryColor, width: 2, alpha: alpha * 0.85 });

        // Radial rune tick marks
        const tx0 = Math.cos(a0) * (r * 0.76);
        const ty0 = Math.sin(a0) * (r * 0.76);
        const tx1 = Math.cos(a0) * (r * 0.94);
        const ty1 = Math.sin(a0) * (r * 0.94);
        this.g.moveTo(tx0, ty0);
        this.g.lineTo(tx1, ty1);
        this.g.stroke({ color: this.color, width: 1.5, alpha: alpha * 0.75 });
      }

      // Inscribed rotating geometric polygon (hexagram / triangle)
      const polyPts = 6;
      for (let p = 0; p < polyPts; p++) {
        const theta0 = (p / polyPts) * Math.PI * 2 - spin * 0.7;
        const theta1 = ((p + 1) / polyPts) * Math.PI * 2 - spin * 0.7;
        const px0 = Math.cos(theta0) * (r * 0.65);
        const py0 = Math.sin(theta0) * (r * 0.65);
        const px1 = Math.cos(theta1) * (r * 0.65);
        const py1 = Math.sin(theta1) * (r * 0.65);
        this.g.moveTo(px0, py0);
        this.g.lineTo(px1, py1);
        this.g.stroke({ color: this.secondaryColor, width: 1, alpha: alpha * 0.6 });
      }
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 2. ⚡ SpiralRibbonFX (Twin Helix Dragon Vortex / Ascending Ki Spiral)
// ============================================================================
export class SpiralRibbonFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private scale: number;
  private strands: number;

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.25, opts.duration ?? 0.58);
    this.color = opts.color ?? 0x66ff88;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.scale = opts.scale ?? 1;
    this.strands = opts.count ?? 3;
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const fade = Math.sin(t * Math.PI);
    const height = 110 * this.scale;
    const baseRadius = 44 * this.scale;

    // Ground ki vortex base ring
    const groundPulse = (0.7 + 0.3 * Math.sin(t * Math.PI * 4)) * baseRadius;
    this.g.ellipse(0, 16 * this.scale, groundPulse, groundPulse * 0.38);
    this.g.stroke({ color: this.color, width: 3, alpha: fade * 0.7 });

    // Helical Ribbons with width tapering & hot cores
    for (let s = 0; s < this.strands; s++) {
      const phaseOffset = (s / this.strands) * Math.PI * 2;
      const steps = 32;

      // Outer wide glow ribbon
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const angle = u * Math.PI * 4.2 - t * 14 + phaseOffset;
        const r = baseRadius * (1 - u * 0.45) * (0.65 + 0.35 * Math.sin(t * Math.PI));
        const px = Math.cos(angle) * r;
        const py = (0.5 - u) * height - t * 36 * this.scale;

        if (i === 0) this.g.moveTo(px, py);
        else this.g.lineTo(px, py);
      }
      this.g.stroke({
        color: s % 2 === 0 ? this.color : this.secondaryColor,
        width: Math.max(2, (7 - s * 1.5) * fade * this.scale),
        alpha: fade * 0.85,
      });

      // Inner razor-sharp white hot core
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const angle = u * Math.PI * 4.2 - t * 14 + phaseOffset;
        const r = baseRadius * (1 - u * 0.45) * (0.65 + 0.35 * Math.sin(t * Math.PI));
        const px = Math.cos(angle) * r;
        const py = (0.5 - u) * height - t * 36 * this.scale;

        if (i === 0) this.g.moveTo(px, py);
        else this.g.lineTo(px, py);
      }
      this.g.stroke({
        color: 0xffffff,
        width: Math.max(1, 2 * fade * this.scale),
        alpha: fade * 0.95,
      });

      // Swirling orbital energy motes along the helix
      for (let m = 0; m < 3; m++) {
        const moteU = ((t * 2.2 + m * 0.33 + s * 0.2) % 1);
        const moteAngle = moteU * Math.PI * 4.2 - t * 14 + phaseOffset;
        const moteR = baseRadius * (1 - moteU * 0.45) * 1.15;
        const mx = Math.cos(moteAngle) * moteR;
        const my = (0.5 - moteU) * height - t * 36 * this.scale;

        this.g.circle(mx, my, Math.max(1.5, 3.5 * fade * this.scale));
        this.g.fill({ color: 0xffffff, alpha: fade * 0.9 });
      }
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 3. 💨 TrailFX (Calamity Anime Crescent Slash Blade)
// ============================================================================
export class TrailFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private from: FXPoint;
  private to: FXPoint;
  private color: number;
  private secondaryColor: number;
  private scale: number;

  constructor(opts: CombatFXOptions) {
    this.from = opts.from || opts.position || { x: 0, y: 0 };
    this.to = opts.to || { x: this.from.x + 90, y: this.from.y - 45 };
    this.container.blendMode = 'add';
    this.duration = Math.max(0.18, opts.duration ?? 0.34);
    this.color = opts.color ?? 0xff3355;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.scale = opts.scale ?? 1;
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const headT = Math.min(1, Math.pow(t * 1.4, 0.8));
    const tailT = Math.max(0, (t - 0.22) / 0.78);
    const dx = this.to.x - this.from.x;
    const dy = this.to.y - this.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const arcBulge = 28 * this.scale;

    // Draw swept crescent slash polygon (wide in center, sharp tips)
    const steps = 18;
    const outerPts: FXPoint[] = [];
    const innerPts: FXPoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const u = tailT + (headT - tailT) * (i / steps);
      const curve = Math.sin(u * Math.PI);
      const halfWidth = Math.max(1, curve * 14 * this.scale * (1 - t * 0.45));

      const cx = this.from.x + dx * u + nx * curve * arcBulge;
      const cy = this.from.y + dy * u + ny * curve * arcBulge;

      outerPts.push({ x: cx + nx * halfWidth, y: cy + ny * halfWidth });
      innerPts.push({ x: cx - nx * halfWidth, y: cy - ny * halfWidth });
    }

    const alpha = Math.max(0, 1 - Math.pow(t, 1.5));

    // Outer plasma aura fill
    if (outerPts.length > 2) {
      this.g.moveTo(outerPts[0].x, outerPts[0].y);
      for (let i = 1; i < outerPts.length; i++) {
        this.g.lineTo(outerPts[i].x, outerPts[i].y);
      }
      for (let i = innerPts.length - 1; i >= 0; i--) {
        this.g.lineTo(innerPts[i].x, innerPts[i].y);
      }
      this.g.closePath();
      this.g.fill({ color: this.color, alpha: alpha * 0.65 });
    }

    // Incandescent inner razor spine
    this.g.moveTo(outerPts[0].x, outerPts[0].y);
    for (let i = 0; i < outerPts.length; i++) {
      const u = tailT + (headT - tailT) * (i / steps);
      const curve = Math.sin(u * Math.PI);
      const cx = this.from.x + dx * u + nx * curve * arcBulge;
      const cy = this.from.y + dy * u + ny * curve * arcBulge;
      if (i === 0) this.g.moveTo(cx, cy);
      else this.g.lineTo(cx, cy);
    }
    this.g.stroke({ color: 0xffffff, width: Math.max(1.5, 4 * this.scale * (1 - t * 0.5)), alpha: alpha * 0.95 });

    // Sparks spraying off the blade cutting tangent
    const sparkCount = 8;
    for (let s = 0; s < sparkCount; s++) {
      const su = (s / sparkCount) * 0.8 + 0.1;
      const curve = Math.sin(su * Math.PI);
      const sparkDist = (t * 45 + s * 8) * this.scale;
      const sx = this.from.x + dx * su + nx * (curve * arcBulge + sparkDist);
      const sy = this.from.y + dy * su + ny * (curve * arcBulge + sparkDist);
      this.g.circle(sx, sy, Math.max(1, 2.5 * (1 - t) * this.scale));
      this.g.fill({ color: s % 2 === 0 ? this.secondaryColor : 0xffffff, alpha: alpha * 0.8 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 4. ✨ ParticleBurstFX (Velocity-Stretched Anime Sparks & Luminous Embers)
// ============================================================================
interface FastParticleData {
  particle: Particle;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  vRot: number;
  baseScale: number;
  life: number;
  maxLife: number;
  isSpark: boolean;
}

export class ParticleBurstFX implements UpdatableFX {
  public container: Container = new Container();
  private pContainer: ParticleContainer;
  private items: FastParticleData[] = [];
  private elapsed = 0;
  private duration: number;

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.25, opts.duration ?? 0.55);
    const count = opts.count ?? 42;
    const color = opts.color ?? 0xffaa00;
    const secondaryColor = opts.secondaryColor ?? 0xffffff;
    const scale = opts.scale ?? 1;

    this.pContainer = new ParticleContainer({
      dynamicProperties: {
        position: true,
        scale: true,
        rotation: true,
        color: true,
      },
    });
    this.pContainer.blendMode = 'add';
    this.container.addChild(this.pContainer);

    const sparkTex = ProceduralTextureCache.getStar();
    const glowTex = ProceduralTextureCache.getGlow();

    for (let i = 0; i < count; i++) {
      const isSpark = i % 2 === 0;
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const speed = (isSpark ? 120 + Math.random() * 220 : 60 + Math.random() * 140) * scale;
      const pScale = (isSpark ? 0.35 + Math.random() * 0.45 : 0.5 + Math.random() * 0.6) * scale;
      const tex = isSpark ? sparkTex : glowTex;

      const p = new Particle({
        texture: tex,
        x: 0,
        y: 0,
        scaleX: pScale,
        scaleY: pScale,
        rotation: angle,
        tint: i % 3 === 0 ? 0xffffff : (i % 3 === 1 ? secondaryColor : color),
        alpha: 1,
      });

      this.pContainer.addParticle(p);
      this.items.push({
        particle: p,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ax: 0,
        ay: (isSpark ? 45 : -25) * scale, // Sparks drop slightly, glowing embers rise
        drag: isSpark ? 2.8 : 1.5,
        vRot: (Math.random() - 0.5) * 12,
        baseScale: pScale,
        life: 0,
        maxLife: this.duration * (0.65 + Math.random() * 0.35),
        isSpark,
      });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    let aliveCount = 0;

    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      it.life += dt;
      if (it.life >= it.maxLife) {
        it.particle.alpha = 0;
        continue;
      }
      aliveCount++;
      const t = it.life / it.maxLife;
      const damp = Math.max(0, 1 - it.drag * dt);
      it.vx = (it.vx + it.ax * dt) * damp;
      it.vy = (it.vy + it.ay * dt) * damp;
      it.particle.x += it.vx * dt;
      it.particle.y += it.vy * dt;

      const currentSpeed = Math.hypot(it.vx, it.vy);

      if (it.isSpark && currentSpeed > 30) {
        // Industry secret: Velocity-aligned stretched anime sparks!
        it.particle.rotation = Math.atan2(it.vy, it.vx);
        it.particle.scaleX = it.baseScale * (1 + currentSpeed * 0.007) * (1 - t * 0.6);
        it.particle.scaleY = it.baseScale * 0.6 * (1 - t * 0.6);
      } else {
        it.particle.rotation += it.vRot * dt;
        const curScale = Math.max(0.05, it.baseScale * (1 - t * 0.7));
        it.particle.scaleX = curScale;
        it.particle.scaleY = curScale;
      }

      it.particle.alpha = Math.max(0, 1 - Math.pow(t, 1.8));
    }

    return aliveCount > 0 && this.elapsed < this.duration * 1.15;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 5. 🔥 EnergySphereFX (Plasma Singularity & Solar Corona Orb)
// ============================================================================
export class EnergySphereFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private maxRadius: number;

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.25, opts.duration ?? 0.52);
    this.color = opts.color ?? 0x9b55ff;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.maxRadius = (opts.radius ?? 52) * (opts.scale ?? 1);
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const envelope = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
    const pulse = 1 + 0.16 * Math.sin(t * Math.PI * 12);
    const r = Math.max(3, this.maxRadius * envelope * pulse);
    const alpha = Math.max(0, envelope);

    // Layer 1: Ethereal radiant aura halo
    this.g.circle(0, 0, r * 1.5);
    this.g.fill({ color: this.color, alpha: alpha * 0.25 });

    // Layer 2: Roiling solar corona / plasma lobes
    const lobeCount = 8;
    const lobePts: FXPoint[] = [];
    for (let i = 0; i <= lobeCount * 3; i++) {
      const angle = (i / (lobeCount * 3)) * Math.PI * 2;
      const turbulence = 1 + 0.18 * Math.sin(angle * 6 + t * 22);
      const lr = r * turbulence;
      lobePts.push({ x: Math.cos(angle) * lr, y: Math.sin(angle) * lr });
    }
    if (lobePts.length > 2) {
      this.g.moveTo(lobePts[0].x, lobePts[0].y);
      for (let i = 1; i < lobePts.length; i++) {
        this.g.lineTo(lobePts[i].x, lobePts[i].y);
      }
      this.g.closePath();
      this.g.fill({ color: this.color, alpha: alpha * 0.7 });
    }

    // Layer 3: Secondary hot elemental body
    this.g.circle(0, 0, r * 0.85);
    this.g.fill({ color: this.secondaryColor, alpha: alpha * 0.85 });

    // Layer 4: Incandescent pure white singularity core
    this.g.circle(0, 0, r * 0.52);
    this.g.fill({ color: 0xffffff, alpha: alpha * 0.98 });

    // Layer 5: Crackling erratic lightning arcs arcing across the perimeter
    for (let arc = 0; arc < 3; arc++) {
      const baseA = t * 14 + (arc * Math.PI * 2) / 3;
      const arcR = r * 1.18;
      const segments = 5;
      for (let s = 0; s <= segments; s++) {
        const theta = baseA + (s / segments) * 1.1;
        const jitter = (Math.sin(s * 7 + t * 30) - 0.5) * 10;
        const ax = Math.cos(theta) * (arcR + jitter);
        const ay = Math.sin(theta) * (arcR + jitter);
        if (s === 0) this.g.moveTo(ax, ay);
        else this.g.lineTo(ax, ay);
      }
      this.g.stroke({ color: 0xffffff, width: 2, alpha: alpha * 0.9 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 6. 🌊 ShockwaveFX (Ground Rupture & Dimensional Distortion Wave)
// ============================================================================
export class ShockwaveFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private maxRadius: number;

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.2, opts.duration ?? 0.45);
    this.color = opts.color ?? 0xffeab0;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.maxRadius = (opts.radius ?? 94) * (opts.scale ?? 1);
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const ease = 1 - Math.pow(1 - t, 4);
    const rx = Math.max(6, this.maxRadius * ease);
    const ry = Math.max(3, rx * 0.44);
    const alpha = Math.max(0, 1 - Math.pow(t, 1.4));
    const strokeW = Math.max(1.5, (1 - t) * 10);

    // Primary Ground compression wave
    this.g.ellipse(0, 0, rx, ry);
    this.g.stroke({ color: this.color, width: strokeW, alpha: alpha * 0.95 });

    // Secondary intense crisp white shock boundary
    this.g.ellipse(0, 0, rx * 0.88, ry * 0.88);
    this.g.stroke({ color: this.secondaryColor, width: Math.max(1, strokeW * 0.5), alpha: alpha * 0.9 });

    // Inner refraction fill
    this.g.ellipse(0, 0, rx * 0.65, ry * 0.65);
    this.g.fill({ color: this.secondaryColor, alpha: alpha * 0.18 });

    // Ground rupture cracks radiating outward
    const cracks = 10;
    for (let c = 0; c < cracks; c++) {
      const angle = (c / cracks) * Math.PI * 2 + (c % 2) * 0.15;
      const innerD = rx * 0.3 * t;
      const outerD = rx * (0.7 + (c % 3) * 0.2) * ease;
      const x0 = Math.cos(angle) * innerD;
      const y0 = Math.sin(angle) * innerD * 0.44;
      const x1 = Math.cos(angle) * outerD;
      const y1 = Math.sin(angle) * outerD * 0.44;

      this.g.moveTo(x0, y0);
      this.g.lineTo(x1, y1);
      this.g.stroke({ color: c % 2 === 0 ? this.secondaryColor : this.color, width: 2, alpha: alpha * 0.75 });

      // Vertical energy spikes thrown up by the ground blast
      const vHeight = (18 + (c % 3) * 14) * (1 - t);
      this.g.moveTo(x1, y1);
      this.g.lineTo(x1, y1 - vHeight);
      this.g.stroke({ color: 0xffffff, width: 1.5, alpha: alpha * 0.85 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 7. 🟢 AuraFX (Resonance Ki Pillar & Sacred Awakening)
// ============================================================================
export class AuraFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private scale: number;
  private pillars: Array<{ offsetX: number; width: number; speed: number; phase: number }> = [];

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.from || opts.to || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.28, opts.duration ?? 0.65);
    this.color = opts.color ?? 0x4ade80;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.scale = opts.scale ?? 1;

    for (let i = 0; i < 10; i++) {
      this.pillars.push({
        offsetX: (i / 9 - 0.5) * 78 * this.scale,
        width: (8 + (i % 3) * 5) * this.scale,
        speed: 1.4 + (i % 4) * 0.45,
        phase: i * 0.62,
      });
    }

    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();
    const fade = Math.sin(t * Math.PI);

    // Ground summoning array with rotating marks
    const baseRx = (46 + Math.sin(t * Math.PI * 6) * 8) * this.scale;
    const baseRy = baseRx * 0.36;
    this.g.ellipse(0, 16 * this.scale, baseRx, baseRy);
    this.g.stroke({ color: this.color, width: 4, alpha: fade * 0.85 });
    this.g.ellipse(0, 16 * this.scale, baseRx * 0.7, baseRy * 0.7);
    this.g.stroke({ color: this.secondaryColor, width: 2, alpha: fade * 0.9 });

    // Towering vertical beam of radiance piercing upward
    const beamH = 140 * this.scale;
    this.g.rect(-24 * this.scale, -beamH + 16 * this.scale, 48 * this.scale, beamH);
    this.g.fill({ color: this.color, alpha: fade * 0.22 });

    // Intense central white spine
    this.g.rect(-8 * this.scale, -beamH + 16 * this.scale, 16 * this.scale, beamH);
    this.g.fill({ color: 0xffffff, alpha: fade * 0.55 });

    // Rising wavering flame tongues
    for (let i = 0; i < this.pillars.length; i++) {
      const p = this.pillars[i];
      const u = (t * p.speed + p.phase) % 1;
      const h = (45 + Math.sin(u * Math.PI) * 75) * this.scale;
      const yBottom = 16 * this.scale - u * 50 * this.scale;
      const wave = Math.sin(u * 8 + t * 10) * 8 * this.scale;
      const col = i % 2 === 0 ? this.color : this.secondaryColor;

      this.g.moveTo(p.offsetX, yBottom);
      this.g.quadraticCurveTo(p.offsetX + wave, yBottom - h * 0.5, p.offsetX, yBottom - h);
      this.g.stroke({ color: col, width: p.width * (1 - u * 0.5), alpha: fade * (1 - u) * 0.8 });
    }

    // Floating ascending stardust motes
    for (let m = 0; m < 6; m++) {
      const mu = (t * 2 + m * 0.16) % 1;
      const mx = (Math.sin(m * 3 + t * 8) * 36) * this.scale;
      const my = 16 * this.scale - mu * beamH;
      this.g.circle(mx, my, Math.max(1.5, 3.5 * fade * this.scale));
      this.g.fill({ color: 0xffffff, alpha: fade * 0.95 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 8. 💥 ExplosionFX (Cinematic Anime Blast & Supernova Detonation)
// ============================================================================
export class ExplosionFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private maxRadius: number;
  private lobes: Array<{ angle: number; dist: number; size: number }> = [];
  private sparks: Array<{ angle: number; speed: number; size: number }> = [];

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.25, opts.duration ?? 0.52);
    this.color = opts.color ?? 0xff5522;
    this.secondaryColor = opts.secondaryColor ?? 0xfef08a;
    this.maxRadius = (opts.radius ?? 72) * (opts.scale ?? 1);

    const count = opts.count ?? 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.22;
      this.lobes.push({
        angle,
        dist: 0.5 + (i % 3) * 0.24,
        size: 0.42 + ((i + 1) % 3) * 0.18,
      });
    }

    // Shrapnel ember sparks
    for (let s = 0; s < 16; s++) {
      this.sparks.push({
        angle: (s / 16) * Math.PI * 2 + Math.random() * 0.3,
        speed: 0.7 + Math.random() * 0.6,
        size: 2 + Math.random() * 3,
      });
    }

    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const ease = 1 - Math.pow(1 - t, 3);
    const alpha = Math.max(0, 1 - Math.pow(t, 1.6));

    // Phase 0: Instant blinding white core flash & star spikes (t < 0.35)
    if (t < 0.35) {
      const coreT = t / 0.35;
      const coreR = this.maxRadius * (1 - coreT) * 1.1;
      this.g.circle(0, 0, coreR);
      this.g.fill({ color: 0xffffff, alpha: (1 - coreT) * 0.98 });

      // Star spikes radiating outward
      const spikeCount = 8;
      for (let s = 0; s < spikeCount; s++) {
        const theta = (s / spikeCount) * Math.PI * 2;
        const sLen = this.maxRadius * 1.4 * (1 - coreT);
        this.g.moveTo(0, 0);
        this.g.lineTo(Math.cos(theta) * sLen, Math.sin(theta) * sLen);
        this.g.stroke({ color: 0xffffff, width: 3, alpha: (1 - coreT) });
      }
    }

    // Supersonic shockwave ring
    const ringR = this.maxRadius * 1.35 * ease;
    this.g.circle(0, 0, ringR);
    this.g.stroke({ color: this.secondaryColor, width: Math.max(1.5, (1 - t) * 6), alpha: alpha * 0.85 });

    // Volumetric expanding fireball lobes
    for (let i = 0; i < this.lobes.length; i++) {
      const l = this.lobes[i];
      const d = this.maxRadius * l.dist * ease;
      const lx = Math.cos(l.angle) * d;
      const ly = Math.sin(l.angle) * d;
      const r = Math.max(3, this.maxRadius * l.size * (1 - t * 0.42));
      const col = i % 2 === 0 ? this.color : this.secondaryColor;

      // Outer lobe
      this.g.circle(lx, ly, r);
      this.g.fill({ color: col, alpha: alpha * 0.85 });

      // Inner incandescent highlight
      this.g.circle(lx, ly, r * 0.55);
      this.g.fill({ color: 0xffffff, alpha: alpha * 0.75 });
    }

    // Flying incandescent shrapnel sparks
    for (let s = 0; s < this.sparks.length; s++) {
      const sp = this.sparks[s];
      const sd = this.maxRadius * sp.speed * ease * 1.25;
      const sx = Math.cos(sp.angle) * sd;
      const sy = Math.sin(sp.angle) * sd + t * t * 30; // Gravity drop

      this.g.circle(sx, sy, sp.size * (1 - t * 0.5));
      this.g.fill({ color: 0xffffff, alpha: alpha * 0.95 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 9. 🌪️ VortexFX (Black Hole Singularity & Cyclone of Annihilation)
// ============================================================================
export class VortexFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private maxRadius: number;
  private armsCount: number;

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.28, opts.duration ?? 0.62);
    this.color = opts.color ?? 0x66ff88;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.maxRadius = (opts.radius ?? 76) * (opts.scale ?? 1);
    this.armsCount = opts.count ?? 5;
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const env = t < 0.22 ? t / 0.22 : 1 - (t - 0.22) / 0.78;
    const spin = t * Math.PI * 8.5;

    // Outer distortion ring
    this.g.circle(0, 0, this.maxRadius * env * 1.15);
    this.g.stroke({ color: this.color, width: 2, alpha: env * 0.55 });

    // Accretion disk glow
    this.g.circle(0, 0, this.maxRadius * env * 0.65);
    this.g.fill({ color: this.color, alpha: env * 0.35 });

    // Central Singularity core
    this.g.circle(0, 0, Math.max(3, 16 * env));
    this.g.fill({ color: 0xffffff, alpha: env * 0.98 });

    // Logarithmic Spiral Arms
    for (let a = 0; a < this.armsCount; a++) {
      const baseAngle = (a / this.armsCount) * Math.PI * 2 + spin;
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const r = u * this.maxRadius * env;
        const theta = baseAngle + u * Math.PI * 2.3;
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r * 0.76;
        if (i === 0) this.g.moveTo(px, py);
        else this.g.lineTo(px, py);
      }
      this.g.stroke({
        color: a % 2 === 0 ? this.color : this.secondaryColor,
        width: Math.max(2, 5.5 * env),
        alpha: env * 0.9,
      });

      // Swirling in-sucking energy sparks
      const sparkU = (t * 3.5 + a * 0.2) % 1;
      const sr = (1 - sparkU) * this.maxRadius * env; // Inward suction
      const stheta = baseAngle + (1 - sparkU) * Math.PI * 2.3;
      const sx = Math.cos(stheta) * sr;
      const sy = Math.sin(stheta) * sr * 0.76;
      this.g.circle(sx, sy, Math.max(1.5, 3.5 * env));
      this.g.fill({ color: 0xffffff, alpha: env * 0.95 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 10. 🎯 ProjectileFX (Blazing Elemental Lance & Comet)
// ============================================================================
export class ProjectileFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private from: FXPoint;
  private to: FXPoint;
  private color: number;
  private secondaryColor: number;
  private scale: number;
  private onHit?: () => void;
  private hitTriggered = false;
  private history: FXPoint[] = [];

  constructor(opts: CombatFXOptions) {
    this.from = opts.from || opts.position || { x: 0, y: 0 };
    this.to = opts.to || { x: this.from.x + 130, y: this.from.y - 65 };
    this.container.blendMode = 'add';
    this.duration = Math.max(0.16, opts.duration ?? 0.35);
    this.color = opts.color ?? 0xff5522;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.scale = opts.scale ?? 1;
    this.onHit = opts.onHit;
    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const arcLift = Math.sin(t * Math.PI) * -26 * this.scale;
    const curX = this.from.x + (this.to.x - this.from.x) * ease;
    const curY = this.from.y + (this.to.y - this.from.y) * ease + arcLift;

    this.history.push({ x: curX, y: curY });
    if (this.history.length > 12) this.history.shift();

    // Layer 1: Wide tapered plasma comet tail
    for (let i = 0; i < this.history.length - 1; i++) {
      const p0 = this.history[i];
      const p1 = this.history[i + 1];
      const ratio = (i + 1) / this.history.length;
      this.g.moveTo(p0.x, p0.y);
      this.g.lineTo(p1.x, p1.y);
      this.g.stroke({
        color: this.color,
        width: Math.max(2, 16 * ratio * this.scale),
        alpha: ratio * 0.8,
      });

      // Razor white core line inside tail
      this.g.moveTo(p0.x, p0.y);
      this.g.lineTo(p1.x, p1.y);
      this.g.stroke({
        color: 0xffffff,
        width: Math.max(1, 4 * ratio * this.scale),
        alpha: ratio * 0.95,
      });
    }

    // Corkscrew double-helix energy ribbons twisting around the projectile head
    const helixRadius = 14 * this.scale;
    for (let h = 0; h < 2; h++) {
      const hAngle = t * 24 + h * Math.PI;
      const hx = curX + Math.cos(hAngle) * helixRadius;
      const hy = curY + Math.sin(hAngle) * helixRadius * 0.5;
      this.g.circle(hx, hy, 2.5 * this.scale);
      this.g.fill({ color: 0xffffff, alpha: 0.9 });
    }

    // Radiant Diamond Star Head
    const headR = 15 * this.scale;
    this.g.circle(curX, curY, headR * 1.8);
    this.g.fill({ color: this.color, alpha: 0.35 });

    this.g.circle(curX, curY, headR);
    this.g.fill({ color: this.secondaryColor, alpha: 0.95 });

    this.g.circle(curX, curY, headR * 0.52);
    this.g.fill({ color: 0xffffff, alpha: 0.98 });

    // Anamorphic cross spike on head
    const spikeL = headR * 2.2;
    this.g.moveTo(curX - spikeL, curY);
    this.g.lineTo(curX + spikeL, curY);
    this.g.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });

    this.g.moveTo(curX, curY - spikeL);
    this.g.lineTo(curX, curY + spikeL);
    this.g.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = Math.min(1, this.elapsed / this.duration);
    this.draw(t);
    if (t >= 1) {
      if (!this.hitTriggered) {
        this.hitTriggered = true;
        this.onHit?.();
      }
      return false;
    }
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// 11. 💫 RadialImpactFX (Hyper-Impact Starburst & Critical Flash)
// ============================================================================
export class RadialImpactFX implements UpdatableFX {
  public container: Container = new Container();
  private g: Graphics = new Graphics();
  private elapsed = 0;
  private duration: number;
  private color: number;
  private secondaryColor: number;
  private maxRadius: number;
  private rays: Array<{ angle: number; lenFactor: number; width: number }> = [];

  constructor(opts: CombatFXOptions) {
    const pos = opts.position || opts.to || opts.from || { x: 0, y: 0 };
    this.container.position.set(Math.round(pos.x), Math.round(pos.y));
    this.container.blendMode = 'add';
    this.duration = Math.max(0.18, opts.duration ?? 0.38);
    this.color = opts.color ?? 0xffeab0;
    this.secondaryColor = opts.secondaryColor ?? 0xffffff;
    this.maxRadius = (opts.radius ?? 88) * (opts.scale ?? 1);

    const rayCount = opts.count ?? 16;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + (i % 2) * 0.12;
      this.rays.push({
        angle,
        lenFactor: i % 2 === 0 ? 1.0 : (i % 4 === 1 ? 0.72 : 0.48),
        width: i % 2 === 0 ? 5.5 : 3.0,
      });
    }

    this.container.addChild(this.g);
    this.draw(0);
  }

  private draw(t: number): void {
    if (this.g.destroyed) return;
    this.g.clear();

    const ease = 1 - Math.pow(1 - t, 4);
    const alpha = Math.max(0, 1 - Math.pow(t, 1.4));

    // Anamorphic horizontal lens flare bar
    if (t < 0.6) {
      const flareT = t / 0.6;
      const flareLen = this.maxRadius * 2.2 * (1 - flareT * 0.3);
      const flareAlpha = (1 - flareT) * 0.95;
      this.g.moveTo(-flareLen, 0);
      this.g.lineTo(flareLen, 0);
      this.g.stroke({ color: 0xffffff, width: 4 * (1 - flareT), alpha: flareAlpha });
    }

    // Expanding diamond impact ring
    const diamondR = this.maxRadius * 0.75 * ease;
    this.g.moveTo(0, -diamondR);
    this.g.lineTo(diamondR, 0);
    this.g.lineTo(0, diamondR);
    this.g.lineTo(-diamondR, 0);
    this.g.closePath();
    this.g.stroke({ color: this.color, width: Math.max(1, (1 - t) * 4), alpha: alpha * 0.85 });

    // Razor-sharp impact rays shooting outward
    for (let i = 0; i < this.rays.length; i++) {
      const ray = this.rays[i];
      const innerR = this.maxRadius * 0.25 * t;
      const outerR = this.maxRadius * ray.lenFactor * ease;
      const x0 = Math.cos(ray.angle) * innerR;
      const y0 = Math.sin(ray.angle) * innerR;
      const x1 = Math.cos(ray.angle) * outerR;
      const y1 = Math.sin(ray.angle) * outerR;

      this.g.moveTo(x0, y0);
      this.g.lineTo(x1, y1);
      this.g.stroke({
        color: i % 2 === 0 ? 0xffffff : this.secondaryColor,
        width: Math.max(1.5, ray.width * (1 - t * 0.65)),
        alpha,
      });
    }

    // Blinding central star flash
    if (t < 0.45) {
      const starR = this.maxRadius * 0.35 * (1 - t / 0.45);
      this.g.circle(0, 0, starR);
      this.g.fill({ color: 0xffffff, alpha: (1 - t / 0.45) * 0.98 });
    }
  }

  public update(dt: number): boolean {
    this.elapsed += dt;
    const t = this.elapsed / this.duration;
    if (t >= 1) return false;
    this.draw(t);
    return true;
  }

  public destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }
}

// ============================================================================
// DATA-DRIVEN SKILL SEQUENCE DEFINITION
// skill.json -> charge -> cast -> projectile -> hit -> explosion
// ============================================================================
export interface SkillFXStageConfig {
  preset: string;
  duration?: number;
  scale?: number;
  color?: number | string;
  secondaryColor?: number | string;
  layer?: CombatFXLayerName;
}

export interface DataDrivenSkillFXSequence {
  element?: CombatFXElement;
  color?: number | string;
  secondaryColor?: number | string;
  scale?: number;
  direction?: number;
  cameraShake?: { intensity: number; duration: number };
  charge?: SkillFXStageConfig | string;
  cast?: SkillFXStageConfig | string;
  projectile?: SkillFXStageConfig | string;
  hit?: SkillFXStageConfig | string;
  explosion?: SkillFXStageConfig | string;
}

// ============================================================================
// MASTER SYSTEM: CombatFXSystem (PixiJS v8)
// ============================================================================
export class CombatFXSystem {
  public root: Container;
  public layers: Record<CombatFXLayerName, Container>;
  private activeFX: UpdatableFX[] = [];
  private energyFilter: Filter | null = null;
  private elapsedTime = 0;
  private onScreenShake?: (intensity: number, duration: number) => void;

  constructor(
    stageOrRoot: Container,
    customLayers?: Partial<Record<CombatFXLayerName, Container>>,
    onScreenShake?: (intensity: number, duration: number) => void
  ) {
    this.root = stageOrRoot;
    this.onScreenShake = onScreenShake;

    this.layers = {
      backFX: customLayers?.backFX ?? new Container(),
      frontFX: customLayers?.frontFX ?? new Container(),
      projectileFX: customLayers?.projectileFX ?? new Container(),
      impactFX: customLayers?.impactFX ?? new Container(),
      uiFX: customLayers?.uiFX ?? new Container(),
    };

    (Object.keys(this.layers) as CombatFXLayerName[]).forEach((key) => {
      const layer = this.layers[key];
      layer.roundPixels = true;
      layer.blendMode = 'add'; // Global luminous additive blending for punchy action RPG combat
      if (!layer.parent && !this.root.destroyed) {
        this.root.addChild(layer);
      }
    });

    this.energyFilter = createProceduralEnergyFilter(0.55);
  }

  public setLayers(customLayers: Partial<Record<CombatFXLayerName, Container>>): void {
    (Object.keys(customLayers) as CombatFXLayerName[]).forEach((key) => {
      if (customLayers[key]) {
        this.layers[key] = customLayers[key]!;
      }
    });
  }

  public setScreenShakeHandler(handler: (intensity: number, duration: number) => void): void {
    this.onScreenShake = handler;
  }

  public get activeCount(): number {
    return this.activeFX.length;
  }

  private parseColor(col: number | string | undefined, fallback: number): number {
    if (typeof col === 'number') return col;
    if (typeof col === 'string') {
      const parsed = parseInt(col.replace('#', ''), 16);
      return Number.isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  }

  public spawnFX(effectType: string, opts: CombatFXOptions = {}): UpdatableFX | null {
    const layerName: CombatFXLayerName = opts.layer ?? 'frontFX';
    const targetLayer = this.layers[layerName] || this.root;
    if (!targetLayer || targetLayer.destroyed) return null;

    let fx: UpdatableFX | null = null;

    switch (effectType) {
      case 'energy_ring':
      case 'ring':
        fx = new EnergyRingFX(opts);
        break;
      case 'spiral':
      case 'ribbon':
        fx = new SpiralRibbonFX(opts);
        break;
      case 'trail':
        fx = new TrailFX(opts);
        break;
      case 'particles':
        fx = new ParticleBurstFX(opts);
        break;
      case 'sphere':
      case 'energy_sphere':
        fx = new EnergySphereFX(opts);
        break;
      case 'shockwave':
        fx = new ShockwaveFX(opts);
        break;
      case 'aura':
        fx = new AuraFX(opts);
        break;
      case 'explosion':
        fx = new ExplosionFX(opts);
        break;
      case 'vortex':
        fx = new VortexFX(opts);
        break;
      case 'projectile':
        fx = new ProjectileFX(opts);
        break;
      case 'impact':
      case 'radial_impact':
        fx = new RadialImpactFX(opts);
        break;
      default:
        fx = new RadialImpactFX(opts);
        break;
    }

    if (fx) {
      targetLayer.addChild(fx.container);
      this.activeFX.push(fx);
    }

    if (opts.shake && this.onScreenShake) {
      this.onScreenShake(opts.shake.intensity, opts.shake.duration);
    }

    return fx;
  }

  /**
   * High-level cinematic preset & composite attack trigger:
   * fx.attack("fireball", { from: player, to: enemy, color: 0xff5522 })
   * fx.attack("holy_impact", { position: enemy, color: 0xffeab0 })
   * fx.attack("lightning_strike", { position: enemy, color: 0xfacc15 })
   */
  public attack(preset: string, opts: CombatFXOptions = {}): Promise<void> {
    const color = opts.color ?? 0xff5522;
    const secondary = opts.secondaryColor ?? 0xffffff;
    const scale = opts.scale ?? 1;
    const from = opts.from || opts.position || { x: 250, y: 350 };
    const to = opts.to || opts.position || { x: 650, y: 240 };

    return new Promise((resolve) => {
      switch (preset) {
        case 'fireball':
        case 'projectile': {
          let hitResolved = false;
          const doResolve = () => {
            if (!hitResolved) {
              hitResolved = true;
              setTimeout(resolve, 260);
            }
          };

          // Cast ring & aura at caster
          this.spawnFX('energy_ring', {
            position: from,
            color,
            secondaryColor: secondary,
            scale: 0.65 * scale,
            duration: 0.28,
            layer: 'frontFX',
          });
          this.spawnFX('particles', {
            position: from,
            color,
            secondaryColor: secondary,
            scale: 0.6 * scale,
            count: 16,
            duration: 0.35,
            layer: 'frontFX',
          });

          // High-velocity blazing comet
          this.spawnFX('projectile', {
            from,
            to,
            color,
            secondaryColor: secondary,
            scale: 1.15 * scale,
            duration: opts.duration ?? 0.32,
            layer: 'projectileFX',
            onHit: () => {
              this.spawnFX('explosion', {
                position: to,
                color,
                secondaryColor: secondary,
                scale: 1.25 * scale,
                duration: 0.48,
                layer: 'impactFX',
              });
              this.spawnFX('particles', {
                position: to,
                color,
                secondaryColor: secondary,
                scale: 1.2 * scale,
                count: 48,
                duration: 0.55,
                layer: 'impactFX',
              });
              this.spawnFX('shockwave', {
                position: { x: to.x, y: to.y + 14 },
                color,
                secondaryColor: secondary,
                scale: 1.1 * scale,
                duration: 0.42,
                layer: 'backFX',
              });
              this.spawnFX('radial_impact', {
                position: to,
                color,
                secondaryColor: secondary,
                scale: 1.2 * scale,
                duration: 0.35,
                layer: 'impactFX',
              });
              this.onScreenShake?.(11, 0.25);
              doResolve();
            },
          });
          setTimeout(doResolve, Math.max(30, Math.round((opts.duration ?? 0.32) * 800)));
          break;
        }

        case 'holy_impact': {
          const pos = opts.position || to;
          this.spawnFX('aura', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.1 * scale,
            duration: 0.55,
            layer: 'backFX',
          });
          this.spawnFX('vortex', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.05 * scale,
            duration: 0.52,
            layer: 'backFX',
          });
          this.spawnFX('energy_ring', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.35 * scale,
            duration: 0.52,
            layer: 'frontFX',
          });
          this.spawnFX('shockwave', {
            position: { x: pos.x, y: pos.y + 20 },
            color,
            secondaryColor: secondary,
            scale: 1.4 * scale,
            duration: 0.48,
            layer: 'backFX',
          });
          this.spawnFX('radial_impact', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.3 * scale,
            duration: 0.42,
            layer: 'impactFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.25 * scale,
            count: 52,
            duration: 0.65,
            layer: 'impactFX',
          });
          this.onScreenShake?.(14, 0.32);
          setTimeout(resolve, 440);
          break;
        }

        case 'lightning_strike': {
          const pos = opts.position || to;
          // Celestial thunder bolt striking vertically
          this.spawnFX('trail', {
            from: { x: pos.x - 12 * scale, y: pos.y - 180 * scale },
            to: pos,
            color: 0xfacc15,
            secondaryColor: 0xffffff,
            scale: 1.4 * scale,
            duration: 0.22,
            layer: 'projectileFX',
          });
          this.spawnFX('radial_impact', {
            position: pos,
            color: 0xfacc15,
            secondaryColor: 0xffffff,
            scale: 1.45 * scale,
            duration: 0.36,
            layer: 'impactFX',
          });
          this.spawnFX('shockwave', {
            position: { x: pos.x, y: pos.y + 16 },
            color: 0x60a5fa,
            secondaryColor: 0xfacc15,
            scale: 1.35 * scale,
            duration: 0.42,
            layer: 'backFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color: 0xfacc15,
            secondaryColor: 0xffffff,
            scale: 1.3 * scale,
            count: 44,
            duration: 0.5,
            layer: 'impactFX',
          });
          this.onScreenShake?.(15, 0.35);
          setTimeout(resolve, 380);
          break;
        }

        case 'energy_blast':
        case 'beam': {
          const pos = opts.position || to;
          this.spawnFX('energy_sphere', {
            position: from,
            color,
            secondaryColor: secondary,
            scale: 0.85 * scale,
            duration: 0.32,
            layer: 'frontFX',
          });
          this.spawnFX('trail', {
            from,
            to: pos,
            color,
            secondaryColor: secondary,
            scale: 1.45 * scale,
            duration: 0.34,
            layer: 'projectileFX',
          });
          this.spawnFX('radial_impact', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.25 * scale,
            duration: 0.4,
            layer: 'impactFX',
          });
          this.spawnFX('explosion', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.15 * scale,
            duration: 0.45,
            layer: 'impactFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.1 * scale,
            count: 36,
            duration: 0.52,
            layer: 'impactFX',
          });
          this.onScreenShake?.(10, 0.24);
          setTimeout(resolve, 380);
          break;
        }

        case 'dark_sphere':
        case 'shadow_wave': {
          const pos = opts.position || to;
          this.spawnFX('vortex', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.25 * scale,
            duration: 0.56,
            layer: 'backFX',
          });
          this.spawnFX('energy_sphere', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.3 * scale,
            duration: 0.52,
            layer: 'frontFX',
          });
          this.spawnFX('shockwave', {
            position: { x: pos.x, y: pos.y + 16 },
            color,
            secondaryColor: secondary,
            scale: 1.2 * scale,
            duration: 0.45,
            layer: 'backFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.15 * scale,
            count: 40,
            duration: 0.55,
            layer: 'impactFX',
          });
          this.onScreenShake?.(11, 0.26);
          setTimeout(resolve, 450);
          break;
        }

        case 'slash':
        case 'dimension_slash': {
          const pos = opts.position || to;
          const slashFrom = { x: pos.x - 62 * scale, y: pos.y - 56 * scale };
          const slashTo = { x: pos.x + 62 * scale, y: pos.y + 52 * scale };
          this.spawnFX('trail', {
            from: slashFrom,
            to: slashTo,
            color,
            secondaryColor: secondary,
            scale: 1.35 * scale,
            duration: 0.28,
            layer: 'impactFX',
          });
          // Cross-cutting reverse slash for impactful double-cut
          const crossFrom = { x: pos.x + 58 * scale, y: pos.y - 52 * scale };
          const crossTo = { x: pos.x - 58 * scale, y: pos.y + 48 * scale };
          setTimeout(() => {
            this.spawnFX('trail', {
              from: crossFrom,
              to: crossTo,
              color: secondary,
              secondaryColor: color,
              scale: 1.25 * scale,
              duration: 0.26,
              layer: 'impactFX',
            });
          }, 60);

          this.spawnFX('radial_impact', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.25 * scale,
            duration: 0.35,
            layer: 'impactFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.1 * scale,
            count: 36,
            duration: 0.45,
            layer: 'impactFX',
          });
          this.onScreenShake?.(9, 0.22);
          setTimeout(resolve, 340);
          break;
        }

        case 'vortex':
        case 'cyclone':
        case 'leaf_storm': {
          const pos = opts.position || to;
          this.spawnFX('vortex', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.35 * scale,
            duration: 0.6,
            layer: 'frontFX',
          });
          this.spawnFX('spiral', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.2 * scale,
            duration: 0.58,
            layer: 'frontFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.2 * scale,
            count: 42,
            duration: 0.55,
            layer: 'impactFX',
          });
          this.onScreenShake?.(8, 0.2);
          setTimeout(resolve, 480);
          break;
        }

        case 'aura':
        case 'sparkle': {
          const pos = opts.position || from;
          this.spawnFX('aura', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.15 * scale,
            duration: 0.62,
            layer: 'backFX',
          });
          this.spawnFX('spiral', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.1 * scale,
            duration: 0.56,
            layer: 'frontFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.1 * scale,
            count: 32,
            duration: 0.55,
            layer: 'frontFX',
          });
          setTimeout(resolve, 450);
          break;
        }

        case 'quake': {
          const pos = opts.position || to;
          this.spawnFX('shockwave', {
            position: { x: pos.x, y: pos.y + 22 },
            color,
            secondaryColor: secondary,
            scale: 1.6 * scale,
            duration: 0.54,
            layer: 'backFX',
          });
          this.spawnFX('explosion', {
            position: { x: pos.x, y: pos.y + 12 },
            color,
            secondaryColor: secondary,
            scale: 1.35 * scale,
            duration: 0.48,
            layer: 'impactFX',
          });
          this.spawnFX('radial_impact', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.3 * scale,
            duration: 0.4,
            layer: 'impactFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.4 * scale,
            count: 48,
            duration: 0.55,
            layer: 'impactFX',
          });
          this.onScreenShake?.(16, 0.4);
          setTimeout(resolve, 440);
          break;
        }

        case 'explosion':
        case 'burst':
        default: {
          const pos = opts.position || to;
          this.spawnFX('explosion', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.3 * scale,
            duration: 0.48,
            layer: 'impactFX',
          });
          this.spawnFX('radial_impact', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.25 * scale,
            duration: 0.38,
            layer: 'impactFX',
          });
          this.spawnFX('shockwave', {
            position: { x: pos.x, y: pos.y + 16 },
            color,
            secondaryColor: secondary,
            scale: 1.2 * scale,
            duration: 0.42,
            layer: 'backFX',
          });
          this.spawnFX('particles', {
            position: pos,
            color,
            secondaryColor: secondary,
            scale: 1.2 * scale,
            count: 42,
            duration: 0.52,
            layer: 'impactFX',
          });
          this.onScreenShake?.(11, 0.26);
          setTimeout(resolve, 400);
          break;
        }
      }
    });
  }

  /**
   * Data-driven skill sequence pipeline:
   * charge -> cast -> projectile -> hit -> explosion
   */
  public async playSkillSequence(
    seq: DataDrivenSkillFXSequence,
    from: FXPoint,
    to: FXPoint
  ): Promise<void> {
    const palette = seq.element ? ELEMENT_FX_PALETTES[seq.element] : undefined;
    const baseColor = this.parseColor(seq.color, palette?.primary ?? 0x38bdf8);
    const secColor = this.parseColor(seq.secondaryColor, palette?.secondary ?? 0xffffff);
    const baseScale = seq.scale ?? 1;

    const runStage = (
      stage: SkillFXStageConfig | string | undefined,
      pos: FXPoint,
      defaultLayer: CombatFXLayerName,
      isProjectile = false
    ): Promise<void> => {
      if (!stage) return Promise.resolve();
      const cfg: SkillFXStageConfig = typeof stage === 'string' ? { preset: stage } : stage;
      const dur = cfg.duration ?? (isProjectile ? 0.34 : 0.3);
      const stColor = this.parseColor(cfg.color, baseColor);
      const stSec = this.parseColor(cfg.secondaryColor, secColor);
      const stScale = (cfg.scale ?? 1) * baseScale;
      const layer = cfg.layer ?? defaultLayer;

      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        if (isProjectile) {
          this.spawnFX(cfg.preset, {
            from,
            to,
            color: stColor,
            secondaryColor: stSec,
            scale: stScale,
            duration: dur,
            layer,
            onHit: finish,
          });
          setTimeout(finish, Math.max(20, Math.round(dur * 800)));
        } else {
          this.spawnFX(cfg.preset, {
            position: pos,
            from,
            to,
            color: stColor,
            secondaryColor: stSec,
            scale: stScale,
            duration: dur,
            layer,
          });
          setTimeout(finish, Math.max(20, Math.round(dur * 650)));
        }
      });
    };

    if (seq.charge) {
      await runStage(seq.charge, from, 'backFX');
    }
    if (seq.cast) {
      await runStage(seq.cast, from, 'frontFX');
    }
    if (seq.projectile) {
      await runStage(seq.projectile, to, 'projectileFX', true);
    }
    if (seq.cameraShake) {
      this.onScreenShake?.(seq.cameraShake.intensity, seq.cameraShake.duration);
    }
    if (seq.hit) {
      await runStage(seq.hit, to, 'impactFX');
    }
    if (seq.explosion) {
      await runStage(seq.explosion, to, 'impactFX');
    }
  }

  public update(dt: number): void {
    this.elapsedTime += dt;
    if (this.energyFilter) {
      const res = (this.energyFilter as any).resources?.energyUniforms?.uniforms;
      if (res) {
        res.uTime = this.elapsedTime;
      }
    }

    for (let i = this.activeFX.length - 1; i >= 0; i--) {
      const fx = this.activeFX[i];
      if (!fx.container || fx.container.destroyed) {
        this.activeFX.splice(i, 1);
        continue;
      }
      const alive = fx.update(dt);
      if (!alive) {
        fx.destroy();
        this.activeFX.splice(i, 1);
      }
    }
  }

  private skillDatabase: Record<string, DataDrivenSkillFXSequence> = { ...(skillFxJson as any) };

  public registerSkill(id: string, config: DataDrivenSkillFXSequence): void {
    this.skillDatabase[id] = config;
  }

  public getSkill(id: string): DataDrivenSkillFXSequence | undefined {
    return this.skillDatabase[id];
  }

  public async playSkill(
    skillId: string,
    from: FXPoint,
    to: FXPoint,
    fallbackMove?: { type?: string; category?: string; vfx?: { preset?: string; colorA?: string; colorB?: string } }
  ): Promise<void> {
    const configured = this.skillDatabase[skillId];
    if (configured) {
      await this.playSkillSequence(configured, from, to);
      return;
    }

    // Procedural fallback based on move parameters
    const elem = (fallbackMove?.type as CombatFXElement) || 'Neutro';
    const pal = ELEMENT_FX_PALETTES[elem] || ELEMENT_FX_PALETTES['Neutro'];
    const colA = fallbackMove?.vfx?.colorA ? this.parseColor(fallbackMove.vfx.colorA, pal.primary) : pal.primary;
    const colB = fallbackMove?.vfx?.colorB ? this.parseColor(fallbackMove.vfx.colorB, pal.secondary) : pal.secondary;
    const preset = fallbackMove?.vfx?.preset || (fallbackMove?.category === 'physical' ? 'slash' : 'projectile');

    await this.attack(preset, {
      from,
      to,
      color: colA,
      secondaryColor: colB,
    });
  }

  public clear(): void {
    for (let i = 0; i < this.activeFX.length; i++) {
      this.activeFX[i].destroy();
    }
    this.activeFX = [];
  }

  public destroy(): void {
    this.clear();
    (Object.values(this.layers) as Container[]).forEach((layer) => {
      if (!layer.destroyed) {
        layer.destroy({ children: true });
      }
    });
  }
}
