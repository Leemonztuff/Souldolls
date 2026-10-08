import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GlobalPixiRenderer } from '../PixiRenderer';
import { COLOR_HEX, COLOR_NUM, FONTS } from '../../ui/styles';
import {
  CombatFXSystem,
  EnergyRingFX,
  SpiralRibbonFX,
  TrailFX,
  ParticleBurstFX,
  EnergySphereFX,
  ShockwaveFX,
  AuraFX,
  ExplosionFX,
  VortexFX,
  ProjectileFX,
  RadialImpactFX,
  ELEMENT_FX_PALETTES,
} from './CombatFXSystem';

export type ParticleShape =
  | 'circle'
  | 'spark'
  | 'slash_spark'
  | 'star'
  | 'ring'
  | 'chevron_up'
  | 'chevron_down'
  | 'soul_orb'
  | 'smoke'
  | 'square';

export interface ParticleConfig {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  ax?: number;
  ay?: number;
  drag?: number;
  alpha?: number;
  scale?: number;
  scaleSpeed?: number;
  rotation?: number;
  vRot?: number;
  maxLife?: number;
  color?: number;
  shape?: ParticleShape;
  size?: number;
}

export class Particle {
  public graphic: Graphics;
  public x = 0;
  public y = 0;
  public vx = 0;
  public vy = 0;
  public ax = 0;
  public ay = 0;
  public drag = 0;
  public alpha = 1;
  public startAlpha = 1;
  public scale = 1;
  public scaleSpeed = 0;
  public rotation = 0;
  public vRot = 0;
  public maxLife = 1;
  public life = 0;
  public color = 0xffffff;
  public shape: ParticleShape = 'circle';
  public size = 4;
  public active = false;

  constructor(graphic: Graphics) {
    this.graphic = graphic;
  }

  public init(cfg: ParticleConfig): void {
    this.x = cfg.x;
    this.y = cfg.y;
    this.vx = cfg.vx ?? 0;
    this.vy = cfg.vy ?? 0;
    this.ax = cfg.ax ?? 0;
    this.ay = cfg.ay ?? 0;
    this.drag = cfg.drag ?? 0;
    this.startAlpha = cfg.alpha ?? 1;
    this.alpha = this.startAlpha;
    this.scale = cfg.scale ?? 1;
    this.scaleSpeed = cfg.scaleSpeed ?? 0;
    this.rotation = cfg.rotation ?? 0;
    this.vRot = cfg.vRot ?? 0;
    this.maxLife = Math.max(0.05, cfg.maxLife ?? 0.6);
    this.life = 0;
    this.color = cfg.color ?? 0xffffff;
    this.shape = cfg.shape ?? 'circle';
    this.size = cfg.size ?? 4;
    this.active = true;

    this.drawGraphic();
    this.graphic.visible = true;
    this.graphic.position.set(this.x, this.y);
    this.graphic.rotation = this.rotation;
    this.graphic.scale.set(this.scale);
    this.graphic.alpha = this.alpha;
  }

  public drawGraphic(): void {
    const g = this.graphic;
    if (!g || g.destroyed) return;
    g.clear();

    const sz = this.size;
    const col = this.color;

    switch (this.shape) {
      case 'circle':
        g.circle(0, 0, sz);
        g.fill({ color: col });
        break;

      case 'spark':
        // Diamond / sharp 4-point sparkle
        g.moveTo(0, -sz * 1.5);
        g.lineTo(sz * 0.4, -sz * 0.4);
        g.lineTo(sz * 1.5, 0);
        g.lineTo(sz * 0.4, sz * 0.4);
        g.lineTo(0, sz * 1.5);
        g.lineTo(-sz * 0.4, sz * 0.4);
        g.lineTo(-sz * 1.5, 0);
        g.lineTo(-sz * 0.4, -sz * 0.4);
        g.closePath();
        g.fill({ color: col });
        break;

      case 'slash_spark':
        // Elongated slash streak
        g.moveTo(-sz * 0.4, -sz * 2);
        g.lineTo(sz * 0.4, -sz * 2);
        g.lineTo(sz * 0.2, sz * 2);
        g.lineTo(-sz * 0.2, sz * 2);
        g.closePath();
        g.fill({ color: col });
        break;

      case 'star':
        // 5-point star
        {
          const points = 5;
          const outer = sz * 1.4;
          const inner = sz * 0.6;
          for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outer : inner;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.fill({ color: col });
        }
        break;

      case 'ring':
        // Expanding shockwave ring
        g.circle(0, 0, sz);
        g.stroke({ color: col, width: 2 });
        break;

      case 'chevron_up':
        // Upward buff arrow ▲
        g.moveTo(0, -sz * 1.2);
        g.lineTo(sz * 1.1, sz * 0.8);
        g.lineTo(0, sz * 0.2);
        g.lineTo(-sz * 1.1, sz * 0.8);
        g.closePath();
        g.fill({ color: col });
        break;

      case 'chevron_down':
        // Downward debuff arrow ▼
        g.moveTo(0, sz * 1.2);
        g.lineTo(sz * 1.1, -sz * 0.8);
        g.lineTo(0, -sz * 0.2);
        g.lineTo(-sz * 1.1, -sz * 0.8);
        g.closePath();
        g.fill({ color: col });
        break;

      case 'soul_orb':
        // Concentric glowing soul orb
        g.circle(0, 0, sz * 1.4);
        g.fill({ color: col, alpha: 0.35 });
        g.circle(0, 0, sz);
        g.fill({ color: col, alpha: 0.85 });
        g.circle(0, 0, sz * 0.5);
        g.fill({ color: 0xffffff, alpha: 0.95 });
        break;

      case 'smoke':
        // Soft puff
        g.circle(0, 0, sz);
        g.fill({ color: col, alpha: 0.75 });
        break;

      case 'square':
      default:
        g.rect(-sz / 2, -sz / 2, sz, sz);
        g.fill({ color: col });
        break;
    }
  }

  public update(dt: number): boolean {
    if (!this.active) return false;
    if (!this.graphic || this.graphic.destroyed) {
      this.active = false;
      return false;
    }

    this.life += dt;
    if (this.life >= this.maxLife) {
      this.active = false;
      this.graphic.visible = false;
      return false;
    }

    const t = this.life / this.maxLife;

    // Apply physics
    this.vx += this.ax * dt * 60;
    this.vy += this.ay * dt * 60;

    if (this.drag > 0) {
      const dragFactor = Math.max(0, 1 - this.drag * dt * 60);
      this.vx *= dragFactor;
      this.vy *= dragFactor;
    }

    this.x += this.vx * dt * 60;
    this.y += this.vy * dt * 60;

    this.rotation += this.vRot * dt * 60;
    this.scale += this.scaleSpeed * dt * 60;

    this.graphic.position.set(this.x, this.y);
    this.graphic.rotation = this.rotation;
    this.graphic.scale.set(Math.max(0.01, this.scale));

    // Smooth cubic/linear fade out
    this.graphic.alpha = this.startAlpha * (1 - t * t);
    return true;
  }
}

export class ParticlePool {
  private pool: Particle[] = [];
  private container: Container;

  constructor(container: Container, initialSize = 350) {
    this.container = container;
    for (let i = 0; i < initialSize; i++) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      this.pool.push(new Particle(g));
    }
  }

  public getParticle(): Particle | null {
    if (!this.container || this.container.destroyed) {
      return null;
    }
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) {
        if (!p.graphic || p.graphic.destroyed) {
          const g = new Graphics();
          g.visible = false;
          this.container.addChild(g);
          p.graphic = g;
        }
        return p;
      }
    }
    // Dynamic expansion if pool is exhausted under heavy VFX load
    if (this.pool.length < 600) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      const p = new Particle(g);
      this.pool.push(p);
      return p;
    }
    return null;
  }

  public emit(cfg: ParticleConfig): Particle | null {
    const p = this.getParticle();
    if (p && p.graphic && !p.graphic.destroyed) {
      p.init(cfg);
    }
    return p;
  }

  public update(dt: number): void {
    if (!this.container || this.container.destroyed) return;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt);
      }
    }
  }

  public clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      if (this.pool[i].graphic && !this.pool[i].graphic.destroyed) {
        this.pool[i].graphic.visible = false;
      }
    }
  }
}

interface VFXOverlay {
  container: Container;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  scaleSpeed?: number;
  update(dt: number): boolean;
}

export class VFXSystem {
  private static instance: VFXSystem;
  public vfxLayer: Container = new Container();
  public particlePool!: ParticlePool;
  public combatFX: CombatFXSystem | null = null;

  private shakeTimer = 0;
  private shakeIntensity = 0;
  private origStageX = 0;
  private origStageY = 0;
  private weatherTimer = 0;
  private activeOverlays: VFXOverlay[] = [];

  private constructor() {}

  public static getInstance(): VFXSystem {
    if (!VFXSystem.instance) {
      VFXSystem.instance = new VFXSystem();
    }
    return VFXSystem.instance;
  }

  public init(parentLayer: Container): void {
    this.activeOverlays = [];
    this.vfxLayer = new Container();
    this.vfxLayer.roundPixels = true;
    this.vfxLayer.zIndex = 800;
    parentLayer.addChild(this.vfxLayer);
    this.particlePool = new ParticlePool(this.vfxLayer, 350);
    this.combatFX = new CombatFXSystem(this.vfxLayer, undefined, (intensity, duration) => {
      this.screenShake(intensity, duration);
    });
  }

  public attachCombatFX(combatFX: CombatFXSystem): void {
    this.combatFX = combatFX;
  }

  public update(dt: number): void {
    if (!this.vfxLayer || this.vfxLayer.destroyed) return;
    this.particlePool?.update(dt);
    if (this.combatFX && this.combatFX.root === this.vfxLayer) {
      this.combatFX.update(dt);
    }

    // Update active overlays
    for (let i = this.activeOverlays.length - 1; i >= 0; i--) {
      const ov = this.activeOverlays[i];
      if (!ov.container || ov.container.destroyed) {
        this.activeOverlays.splice(i, 1);
        continue;
      }
      const alive = ov.update(dt);
      if (!alive) {
        if (!ov.container.destroyed) {
          ov.container.destroy({ children: true });
        }
        this.activeOverlays.splice(i, 1);
      }
    }

    // Screen Shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) {
        this.shakeTimer = 0;
        if (GlobalPixiRenderer.app?.stage) {
          GlobalPixiRenderer.app.stage.position.set(this.origStageX, this.origStageY);
        }
      } else {
        const dx = (Math.random() - 0.5) * this.shakeIntensity * 2;
        const dy = (Math.random() - 0.5) * this.shakeIntensity * 2;
        if (GlobalPixiRenderer.app?.stage) {
          GlobalPixiRenderer.app.stage.position.set(this.origStageX + dx, this.origStageY + dy);
        }
      }
    }
  }

  public screenShake(intensity = 12, duration = 0.35): void {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
    this.origStageX = 0;
    this.origStageY = 0;
  }

  public screenFlash(colorHex = 0xffffff, durationMs = 150): Promise<void> {
    return new Promise((resolve) => {
      if (!this.vfxLayer || this.vfxLayer.destroyed) {
        resolve();
        return;
      }
      const flashG = new Graphics();
      const w = GlobalPixiRenderer.width || 800;
      const h = GlobalPixiRenderer.height || 600;
      flashG.rect(0, 0, w, h);
      flashG.fill({ color: colorHex, alpha: 0.75 });
      this.vfxLayer.addChild(flashG);

      setTimeout(() => {
        if (!flashG.destroyed) {
          flashG.destroy();
        }
        resolve();
      }, durationMs);
    });
  }

  // =========================================================================
  // 1. CRITICAL HIT FEEDBACK SYSTEM (B37/B38/Combat Feedback)
  // =========================================================================

  /**
   * Emite un estallido radial de chispas doradas/ámbar, anillo de choque y banner de impacto crítico.
   */
  public emitCriticalHitFeedback(x: number, y: number): void {
    this.screenShake(15, 0.38);
    this.screenFlash(0xfef08a, 130);

    if (this.combatFX) {
      this.combatFX.spawnFX('radial_impact', {
        position: { x, y },
        color: 0xfacc15,
        secondaryColor: 0xffffff,
        scale: 1.45,
        duration: 0.42,
        layer: 'impactFX',
      });
      this.combatFX.spawnFX('shockwave', {
        position: { x, y: y + 8 },
        color: 0xf97316,
        secondaryColor: 0xfacc15,
        scale: 1.35,
        duration: 0.44,
        layer: 'backFX',
      });
      this.combatFX.spawnFX('energy_ring', {
        position: { x, y },
        color: 0xfacc15,
        secondaryColor: 0xffffff,
        scale: 1.25,
        duration: 0.38,
        layer: 'frontFX',
      });
      this.combatFX.spawnFX('particles', {
        position: { x, y },
        color: 0xfacc15,
        secondaryColor: 0xffffff,
        scale: 1.3,
        count: 42,
        duration: 0.58,
        layer: 'impactFX',
      });
    }

    // 1. Expanding Shockwave Ring
    this.particlePool.emit({
      x,
      y,
      shape: 'ring',
      color: 0xfacc15,
      size: 16,
      scale: 0.5,
      scaleSpeed: 5.5,
      alpha: 1.0,
      maxLife: 0.35,
    });

    // 2. Secondary White-hot Ring
    this.particlePool.emit({
      x,
      y,
      shape: 'ring',
      color: 0xffffff,
      size: 10,
      scale: 0.4,
      scaleSpeed: 4.0,
      alpha: 0.9,
      maxLife: 0.25,
    });

    // 3. Radial High-Velocity Angular Sparks (28 sparks)
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 4.5 + Math.random() * 6.5;
      const col = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xfacc15 : 0xf97316;
      const shape: ParticleShape = i % 4 === 0 ? 'star' : i % 2 === 0 ? 'slash_spark' : 'spark';

      this.particlePool.emit({
        x: x + Math.cos(angle) * 6,
        y: y + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.08,
        shape,
        size: shape === 'star' ? 6 : 4 + Math.random() * 3,
        color: col,
        rotation: angle + Math.PI / 2,
        vRot: (Math.random() - 0.5) * 0.3,
        maxLife: 0.45 + Math.random() * 0.25,
        alpha: 1.0,
      });
    }

    // 4. Floating Critical Banner Badge
    this.spawnCriticalBanner(x, y - 35);
  }

  private spawnCriticalBanner(x: number, y: number): void {
    const badge = new Container();
    badge.roundPixels = true;
    badge.position.set(x, y);

    const bg = new Graphics();
    bg.roundRect(-75, -16, 150, 32, 6);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.gold, width: 2 });
    // Inner gold trim
    bg.roundRect(-71, -12, 142, 24, 4);
    bg.stroke({ color: 0xf97316, width: 1, alpha: 0.7 });
    badge.addChild(bg);

    const txt = new Text({
      text: '¡GOLPE CRÍTICO!',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 14,
        fontWeight: '900',
        fill: '#facc15',
        letterSpacing: 1.5,
      }),
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    badge.addChild(txt);

    this.vfxLayer.addChild(badge);

    let life = 0;
    const maxLife = 0.95;
    this.activeOverlays.push({
      container: badge,
      x,
      y,
      vy: -1.2,
      life,
      maxLife,
      update: (dt: number) => {
        life += dt;
        badge.position.y += -1.2 * dt * 60;
        const progress = life / maxLife;
        if (progress < 0.2) {
          const pop = 1 + (1 - progress / 0.2) * 0.25;
          badge.scale.set(pop);
        } else {
          badge.scale.set(1.0);
        }
        badge.alpha = Math.max(0, 1 - Math.pow(progress, 2.5));
        return life < maxLife;
      },
    });
  }

  // =========================================================================
  // 2. SOUL CAPTURE FEEDBACK SYSTEM (Soul Bottle Capture Sequence)
  // =========================================================================

  /**
   * Emite el torbellino de succión etérea desde la criatura hacia la Soul Bottle.
   */
  public emitSoulCaptureStream(fromX: number, fromY: number, toX: number, toY: number, count = 24): void {
    if (this.combatFX) {
      // 1. Swirling ethereal vortex at target Soul Bottle mouth
      this.combatFX.spawnFX('vortex', {
        position: { x: toX, y: toY },
        color: COLOR_NUM.cyan,
        secondaryColor: COLOR_NUM.soulViolet,
        scale: 0.9,
        duration: 0.65,
        layer: 'backFX',
      });

      // 2. High-speed spiraling ribbon connecting soul to bottle
      this.combatFX.spawnFX('spiral', {
        position: { x: (fromX + toX) / 2, y: (fromY + toY) / 2 },
        color: COLOR_NUM.cyan,
        secondaryColor: COLOR_NUM.gold,
        scale: 0.95,
        duration: 0.6,
        layer: 'frontFX',
      });

      // 3. Luminous beam / trail from soul into the bottle
      this.combatFX.spawnFX('trail', {
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        color: COLOR_NUM.cyan,
        secondaryColor: 0xffffff,
        scale: 1.15,
        duration: 0.45,
        layer: 'projectileFX',
      });

      // 4. Converging soul sparks burst
      this.combatFX.spawnFX('particles', {
        position: { x: toX, y: toY },
        color: COLOR_NUM.cyan,
        secondaryColor: COLOR_NUM.soulViolet,
        scale: 0.95,
        count: 28,
        duration: 0.52,
        layer: 'impactFX',
      });
    }

    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const spread = (Math.random() - 0.5) * 36;
      const startX = fromX + (toX - fromX) * (t * 0.3) + spread;
      const startY = fromY + (toY - fromY) * (t * 0.3) + spread;

      const dirX = toX - startX;
      const dirY = toY - startY;
      const dist = Math.hypot(dirX, dirY) || 1;
      const speed = 4.0 + Math.random() * 4.0;

      const col = i % 2 === 0 ? COLOR_NUM.cyan : COLOR_NUM.soulViolet;

      this.particlePool.emit({
        x: startX,
        y: startY,
        vx: (dirX / dist) * speed,
        vy: (dirY / dist) * speed,
        ax: (dirX / dist) * 0.15,
        ay: (dirY / dist) * 0.15,
        drag: 0.01,
        shape: 'soul_orb',
        size: 3 + Math.random() * 2.5,
        color: col,
        maxLife: 0.45 + Math.random() * 0.2,
        alpha: 0.9,
      });
    }
  }

  /**
   * Emite ondas de resonancia y chispas ascendentes en cada sacudida de la Soul Bottle.
   */
  public emitSoulCaptureShake(x: number, y: number, shakeIndex: number): void {
    const col = shakeIndex >= 3 ? COLOR_NUM.gold : COLOR_NUM.cyan;
    const secCol = shakeIndex >= 3 ? 0xffffff : COLOR_NUM.soulViolet;

    if (this.combatFX) {
      this.combatFX.spawnFX('energy_ring', {
        position: { x, y },
        color: col,
        secondaryColor: secCol,
        scale: 0.7 + shakeIndex * 0.22,
        duration: 0.35,
        layer: 'frontFX',
      });

      this.combatFX.spawnFX('radial_impact', {
        position: { x, y },
        color: col,
        secondaryColor: 0xffffff,
        scale: 0.65 + shakeIndex * 0.15,
        duration: 0.3,
        layer: 'impactFX',
      });

      this.combatFX.spawnFX('particles', {
        position: { x, y: y - 6 },
        color: col,
        secondaryColor: 0xffffff,
        scale: 0.8 + shakeIndex * 0.15,
        count: 14 + shakeIndex * 6,
        duration: 0.45,
        layer: 'impactFX',
      });
    }

    // Pulse resonance ring
    this.particlePool.emit({
      x,
      y,
      shape: 'ring',
      color: shakeIndex >= 3 ? 0xfacc15 : 0x38bdf8,
      size: 10 + shakeIndex * 4,
      scale: 0.3,
      scaleSpeed: 2.8 + shakeIndex * 0.6,
      alpha: 0.9,
      maxLife: 0.3,
    });

    // Rising soul ki motes (sparkles)
    const sparks = 4 + shakeIndex * 3;
    for (let i = 0; i < sparks; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 2.0 + Math.random() * 3.0;
      this.particlePool.emit({
        x: x + (Math.random() - 0.5) * 12,
        y: y - 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ay: -0.05, // Float upwards
        shape: 'spark',
        size: 3 + Math.random() * 2,
        color: shakeIndex >= 3 ? 0xfde047 : 0x38bdf8,
        maxLife: 0.4 + Math.random() * 0.2,
        alpha: 0.95,
      });
    }
  }

  /**
   * Emite la apoteosis celestial cuando la Soul Bottle sella exitosamente el alma.
   */
  public emitSoulCaptureSuccess(x: number, y: number): void {
    this.screenFlash(0xfacc15, 260);
    this.screenShake(14, 0.45);

    if (this.combatFX) {
      // 1. Dual Concentric Golden Resonance Rings
      this.combatFX.spawnFX('energy_ring', {
        position: { x, y },
        color: COLOR_NUM.gold,
        secondaryColor: 0xffffff,
        scale: 1.45,
        duration: 0.52,
        layer: 'frontFX',
      });
      this.combatFX.spawnFX('energy_ring', {
        position: { x, y },
        color: COLOR_NUM.cyan,
        secondaryColor: COLOR_NUM.gold,
        scale: 1.05,
        duration: 0.42,
        layer: 'frontFX',
      });

      // 2. Massive Ground Shockwave
      this.combatFX.spawnFX('shockwave', {
        position: { x, y: y + 8 },
        color: COLOR_NUM.gold,
        secondaryColor: COLOR_NUM.cyan,
        scale: 1.55,
        duration: 0.54,
        layer: 'backFX',
      });

      // 3. Celestial Starburst with additive blend
      this.combatFX.spawnFX('radial_impact', {
        position: { x, y },
        color: COLOR_NUM.gold,
        secondaryColor: 0xffffff,
        scale: 1.4,
        duration: 0.46,
        layer: 'impactFX',
      });

      // 4. Massive 360-degree particle burst
      this.combatFX.spawnFX('particles', {
        position: { x, y },
        color: COLOR_NUM.gold,
        secondaryColor: 0xffffff,
        scale: 1.45,
        count: 54,
        duration: 0.72,
        layer: 'impactFX',
      });

      // 5. Ascending celestial spiral ribbon
      this.combatFX.spawnFX('spiral', {
        position: { x, y },
        color: COLOR_NUM.gold,
        secondaryColor: COLOR_NUM.cyan,
        scale: 1.25,
        duration: 0.68,
        layer: 'frontFX',
      });
    }

    // 1. Dual Concentric Golden Resonance Rings
    this.particlePool.emit({
      x,
      y,
      shape: 'ring',
      color: 0xfacc15,
      size: 20,
      scale: 0.4,
      scaleSpeed: 5.0,
      alpha: 1.0,
      maxLife: 0.45,
    });

    this.particlePool.emit({
      x,
      y,
      shape: 'ring',
      color: 0x38bdf8,
      size: 14,
      scale: 0.3,
      scaleSpeed: 3.5,
      alpha: 0.85,
      maxLife: 0.35,
    });

    // 2. 360-Degree Celestial Star Burst (36 particles)
    const count = 36;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const speed = 3.5 + Math.random() * 5.0;
      const isGold = i % 2 === 0;
      const col = isGold ? 0xfacc15 : 0x38bdf8;
      const shape: ParticleShape = i % 3 === 0 ? 'star' : 'spark';

      this.particlePool.emit({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.05,
        shape,
        size: shape === 'star' ? 5 : 3.5 + Math.random() * 2,
        color: col,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 0.2,
        maxLife: 0.6 + Math.random() * 0.3,
        alpha: 1.0,
      });
    }

    // 3. Ascending Pillar Ki Motes
    for (let i = 0; i < 14; i++) {
      this.particlePool.emit({
        x: x + (Math.random() - 0.5) * 28,
        y: y + 10,
        vx: (Math.random() - 0.5) * 1.0,
        vy: -3.5 - Math.random() * 3.0,
        ay: -0.08,
        shape: 'soul_orb',
        size: 3 + Math.random() * 2,
        color: 0xffffff,
        maxLife: 0.55 + Math.random() * 0.25,
        alpha: 0.9,
      });
    }

    // 4. Celebratory Capture Badge
    this.spawnCaptureSuccessBadge(x, y - 48);
  }

  private spawnCaptureSuccessBadge(x: number, y: number): void {
    const badge = new Container();
    badge.roundPixels = true;
    badge.position.set(x, y);

    const bg = new Graphics();
    bg.roundRect(-80, -18, 160, 36, 6);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.gold, width: 2 });
    bg.roundRect(-76, -14, 152, 28, 4);
    bg.stroke({ color: COLOR_NUM.cyan, width: 1, alpha: 0.6 });
    badge.addChild(bg);

    const txt = new Text({
      text: '★ ¡ALMA SELLADA! ★',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 13,
        fontWeight: '900',
        fill: '#facc15',
        letterSpacing: 1.2,
      }),
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    badge.addChild(txt);

    this.vfxLayer.addChild(badge);

    let life = 0;
    const maxLife = 1.3;
    this.activeOverlays.push({
      container: badge,
      x,
      y,
      vy: -0.9,
      life,
      maxLife,
      update: (dt: number) => {
        life += dt;
        badge.position.y += -0.9 * dt * 60;
        const progress = life / maxLife;
        badge.alpha = Math.max(0, 1 - Math.pow(progress, 3));
        return life < maxLife;
      },
    });
  }

  /**
   * Emite la nube de humo y chispas de fuga cuando el alma escapa de la botella.
   */
  public emitSoulCaptureFail(x: number, y: number): void {
    this.screenFlash(0xf43f5e, 140);
    this.screenShake(7, 0.22);

    if (this.combatFX) {
      this.combatFX.spawnFX('explosion', {
        position: { x, y },
        color: 0xf43f5e,
        secondaryColor: 0x9333ea,
        scale: 1.15,
        duration: 0.45,
        layer: 'impactFX',
      });
      this.combatFX.spawnFX('shockwave', {
        position: { x, y: y + 6 },
        color: 0xf43f5e,
        secondaryColor: 0x475569,
        scale: 1.15,
        duration: 0.4,
        layer: 'backFX',
      });
      this.combatFX.spawnFX('particles', {
        position: { x, y },
        color: 0x64748b,
        secondaryColor: 0xf43f5e,
        scale: 1.05,
        count: 32,
        duration: 0.55,
        layer: 'impactFX',
      });
    }

    // 1. Billowy Grey Dispersal Smoke
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const speed = 1.8 + Math.random() * 2.5;
      const col = i % 2 === 0 ? 0x64748b : 0x475569;
      this.particlePool.emit({
        x: x + Math.cos(angle) * 6,
        y: y + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        drag: 0.06,
        shape: 'smoke',
        size: 5 + Math.random() * 4,
        scale: 0.7,
        scaleSpeed: 1.4,
        color: col,
        maxLife: 0.5 + Math.random() * 0.25,
        alpha: 0.75,
      });
    }

    // 2. Crimson Warning Sparks
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.0 + Math.random() * 3.5;
      this.particlePool.emit({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.05,
        shape: 'spark',
        size: 3.5,
        color: 0xf43f5e,
        maxLife: 0.35,
        alpha: 0.9,
      });
    }

    // 3. Escape Floating Badge
    this.spawnCaptureFailBadge(x, y - 40);
  }

  private spawnCaptureFailBadge(x: number, y: number): void {
    const badge = new Container();
    badge.roundPixels = true;
    badge.position.set(x, y);

    const bg = new Graphics();
    bg.roundRect(-60, -16, 120, 32, 6);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    bg.stroke({ color: 0xf43f5e, width: 2 });
    badge.addChild(bg);

    const txt = new Text({
      text: '¡ESCAPÓ!',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 13,
        fontWeight: '900',
        fill: '#f43f5e',
        letterSpacing: 1.2,
      }),
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    badge.addChild(txt);

    this.vfxLayer.addChild(badge);

    let life = 0;
    const maxLife = 0.9;
    this.activeOverlays.push({
      container: badge,
      x,
      y,
      vy: -1.0,
      life,
      maxLife,
      update: (dt: number) => {
        life += dt;
        badge.position.y += -1.0 * dt * 60;
        const progress = life / maxLife;
        badge.alpha = Math.max(0, 1 - Math.pow(progress, 2));
        return life < maxLife;
      },
    });
  }

  // =========================================================================
  // 3. STAT CHANGE FEEDBACK SYSTEM (Buffs ▲ & Debuffs ▼)
  // =========================================================================

  /**
   * Emite columnas de partículas ascendentes (Buff) o lluvia de miasma descendente (Debuff),
   * junto a un banner flotante con tipografía canónica y valores exactos.
   */
  public emitStatChangeFeedback(x: number, y: number, statKey: string, delta: number): void {
    const isBuff = delta > 0;
    const statLabels: Record<string, string> = {
      hp: 'PS',
      atk: 'ATQ',
      def: 'DEF',
      spAtk: 'ATQ.E',
      spDef: 'DEF.E',
      speed: 'VEL',
      accuracy: 'PREC',
      evasion: 'EVAS',
    };
    const label = statLabels[statKey] || statKey.toUpperCase();

    if (this.combatFX) {
      if (isBuff) {
        this.combatFX.spawnFX('spiral', {
          position: { x, y },
          color: 0x4ade80,
          secondaryColor: 0xfacc15,
          scale: 1.05,
          duration: 0.58,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('energy_ring', {
          position: { x, y: y + 8 },
          color: 0x4ade80,
          secondaryColor: 0xffffff,
          scale: 0.95,
          duration: 0.42,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('particles', {
          position: { x, y },
          color: 0x4ade80,
          secondaryColor: 0xfacc15,
          scale: 1.05,
          count: 26,
          duration: 0.52,
          layer: 'impactFX',
        });
      } else {
        this.combatFX.spawnFX('shockwave', {
          position: { x, y: y + 14 },
          color: 0xf43f5e,
          secondaryColor: 0x9333ea,
          scale: 1.2,
          duration: 0.46,
          layer: 'backFX',
        });
        this.combatFX.spawnFX('vortex', {
          position: { x, y },
          color: 0xf43f5e,
          secondaryColor: 0x4c1d95,
          scale: 1.0,
          duration: 0.52,
          layer: 'backFX',
        });
        this.combatFX.spawnFX('particles', {
          position: { x, y },
          color: 0x9333ea,
          secondaryColor: 0xf43f5e,
          scale: 1.05,
          count: 26,
          duration: 0.52,
          layer: 'impactFX',
        });
      }
    }

    if (isBuff) {
      // 1. Upward Rising Energy Ring
      this.particlePool.emit({
        x,
        y: y + 10,
        shape: 'ring',
        color: 0x4ade80,
        size: 16,
        scale: 0.4,
        scaleSpeed: 2.2,
        alpha: 0.85,
        maxLife: 0.4,
      });

      // 2. Ascending Buff Chevrons & Sparkles (18 particles)
      for (let i = 0; i < 18; i++) {
        const spreadX = (Math.random() - 0.5) * 38;
        const col = i % 3 === 0 ? 0xfacc15 : 0x4ade80;
        const shape: ParticleShape = i % 2 === 0 ? 'chevron_up' : 'spark';

        this.particlePool.emit({
          x: x + spreadX,
          y: y + 20 + Math.random() * 15,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -2.8 - Math.random() * 2.2,
          ay: -0.04,
          shape,
          size: shape === 'chevron_up' ? 5 : 3.5,
          color: col,
          maxLife: 0.55 + Math.random() * 0.25,
          alpha: 0.95,
        });
      }
    } else {
      // 1. Sinking Heavy Weight Ring
      this.particlePool.emit({
        x,
        y: y + 16,
        shape: 'ring',
        color: 0xf43f5e,
        size: 18,
        scale: 1.2,
        scaleSpeed: -1.2,
        alpha: 0.85,
        maxLife: 0.45,
      });

      // 2. Descending Debuff Chevrons & Heavy Miasma (18 particles)
      for (let i = 0; i < 18; i++) {
        const spreadX = (Math.random() - 0.5) * 38;
        const col = i % 3 === 0 ? 0x9333ea : 0xf43f5e;
        const shape: ParticleShape = i % 2 === 0 ? 'chevron_down' : 'smoke';

        this.particlePool.emit({
          x: x + spreadX,
          y: y - 28 + Math.random() * 10,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 2.5 + Math.random() * 2.2,
          ay: 0.05,
          shape,
          size: shape === 'chevron_down' ? 5 : 4.5,
          color: col,
          maxLife: 0.55 + Math.random() * 0.25,
          alpha: 0.9,
        });
      }
    }

    // 3. Floating Stat Change Banner
    this.spawnStatBanner(x, y - 24, label, delta);
  }

  private spawnStatBanner(x: number, y: number, statName: string, delta: number): void {
    const isBuff = delta > 0;
    const sign = isBuff ? '+' : '';
    const arrowSymbol = isBuff ? '▲' : '▼';
    const textStr = `${arrowSymbol} ${statName} ${sign}${delta}`;
    const col = isBuff ? '#4ade80' : '#f43f5e';
    const borderCol = isBuff ? 0x4ade80 : 0xf43f5e;

    const badge = new Container();
    badge.roundPixels = true;
    badge.position.set(x, y);

    const bg = new Graphics();
    bg.roundRect(-58, -14, 116, 28, 5);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    bg.stroke({ color: borderCol, width: 2 });
    badge.addChild(bg);

    const txt = new Text({
      text: textStr,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: 'bold',
        fill: col,
        letterSpacing: 1,
      }),
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    badge.addChild(txt);

    this.vfxLayer.addChild(badge);

    let life = 0;
    const maxLife = 0.95;
    const moveVy = isBuff ? -1.1 : 1.1;

    this.activeOverlays.push({
      container: badge,
      x,
      y,
      vy: moveVy,
      life,
      maxLife,
      update: (dt: number) => {
        life += dt;
        badge.position.y += moveVy * dt * 60;
        const progress = life / maxLife;
        badge.alpha = Math.max(0, 1 - Math.pow(progress, 2));
        return life < maxLife;
      },
    });
  }

  // =========================================================================
  // 4. EXISTING VFX & POPUPS (Optimized & Preserved)
  // =========================================================================

  public spawnDamageText(x: number, y: number, damage: number, isCritical = false): void {
    const textStr = isCritical ? `💥 ${damage}!` : `${damage}`;
    const txt = new Text({
      text: textStr,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCritical ? 34 : 26,
        fontWeight: '900',
        fill: isCritical ? '#facc15' : '#ffffff',
        stroke: { color: '#000000', width: 5 },
      }),
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    txt.position.set(x, y);
    this.vfxLayer.addChild(txt);

    let life = 0;
    const maxLife = 0.85;
    this.activeOverlays.push({
      container: txt,
      x,
      y,
      vy: -1.6,
      life,
      maxLife,
      update: (dt: number) => {
        life += dt;
        txt.position.y += -1.6 * dt * 60;
        const progress = life / maxLife;
        txt.alpha = Math.max(0, 1 - progress);
        return life < maxLife;
      },
    });
  }

  public spawnEffectivenessBadge(
    x: number,
    y: number,
    rating: 'super_effective' | 'not_very_effective' | 'immune'
  ): void {
    let label = '¡SÚPER EFICAZ!';
    let col = '#facc15';
    let borderCol = 0xfacc15;
    if (rating === 'not_very_effective') {
      label = 'No es muy eficaz...';
      col = '#94a3b8';
      borderCol = 0x64748b;
    } else if (rating === 'immune') {
      label = '¡Sin efecto!';
      col = '#f43f5e';
      borderCol = 0xf43f5e;
    }

    const badge = new Container();
    badge.roundPixels = true;
    badge.position.set(x, y - 40);

    const bg = new Graphics();
    bg.roundRect(-90, -15, 180, 30, 6);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.94 });
    bg.stroke({ color: borderCol, width: 2 });
    badge.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: 'bold',
        fill: col,
      }),
    });
    txt.anchor.set(0.5);
    txt.roundPixels = true;
    badge.addChild(txt);

    this.vfxLayer.addChild(badge);

    let life = 0;
    const maxLife = 0.95;
    this.activeOverlays.push({
      container: badge,
      x,
      y,
      vy: -1.0,
      life,
      maxLife,
      update: (dt: number) => {
        life += dt;
        badge.position.y += -1.0 * dt * 60;
        const progress = life / maxLife;
        badge.alpha = Math.max(0, 1 - progress);
        return life < maxLife;
      },
    });
  }

  public spawnStatChangeArrow(x: number, y: number, statName: string, delta: number): void {
    this.emitStatChangeFeedback(x, y, statName, delta);
  }

  public vfxRepairSpark(x: number, y: number): void {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particlePool.emit({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.05,
        shape: 'spark',
        size: 3,
        color: 0xffd700,
        maxLife: 0.35 + Math.random() * 0.2,
        alpha: 1.0,
      });
    }
  }

  public updateWeatherVFX(dt: number, weather: import('../../types/weather').WeatherType): void {
    if (!weather || weather === 'none') return;
    this.weatherTimer += dt;
    if (this.weatherTimer < 0.04) return;
    this.weatherTimer = 0;

    const width = GlobalPixiRenderer.width || 800;
    const height = GlobalPixiRenderer.height || 600;

    if (weather === 'rain') {
      const rainX = Math.random() * (width + 240) - 120;
      const rainY = -20;
      this.particlePool.emit({
        x: rainX,
        y: rainY,
        vx: -3.5,
        vy: 14 + Math.random() * 5,
        shape: 'slash_spark',
        size: 4 + Math.random() * 2,
        color: 0x38bdf8,
        maxLife: 1.1,
        alpha: 0.75,
      });

      if (Math.random() < 0.35) {
        const splashX = Math.random() * width;
        const splashY = height * 0.6 + Math.random() * (height * 0.35);
        this.particlePool.emit({
          x: splashX,
          y: splashY,
          shape: 'ring',
          color: 0x7dd3fc,
          size: 6,
          scale: 0.3,
          scaleSpeed: 2.2,
          alpha: 0.6,
          maxLife: 0.25,
        });
      }
    } else if (weather === 'sun') {
      this.particlePool.emit({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -0.6 - Math.random() * 0.6,
        shape: 'spark',
        size: 3.5 + Math.random() * 3,
        color: Math.random() < 0.5 ? 0xfef08a : 0xf97316,
        maxLife: 1.8,
        alpha: 0.65,
      });
    } else if (weather === 'sandstorm') {
      this.particlePool.emit({
        x: -20,
        y: Math.random() * height,
        vx: 10 + Math.random() * 6,
        vy: (Math.random() - 0.5) * 2.5,
        shape: 'slash_spark',
        size: 3 + Math.random() * 2,
        color: Math.random() < 0.6 ? 0xd97706 : 0xfbbf24,
        maxLife: 1.3,
        alpha: 0.7,
      });
    } else if (weather === 'snow') {
      this.particlePool.emit({
        x: Math.random() * width,
        y: -10,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 2.2 + Math.random() * 2,
        vRot: (Math.random() - 0.5) * 0.15,
        shape: 'star',
        size: 3.5 + Math.random() * 2,
        color: 0xffffff,
        maxLife: 2.8,
        alpha: 0.85,
      });
    }
  }

  // --- PRESET VFX IMPLEMENTATIONS (Driven by PixiJS v8 CombatFXSystem) ---

  public async playPresetVfx(
    presetName: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    colorA = '#38bdf8',
    colorB = '#ffffff'
  ): Promise<void> {
    const colA = parseInt(colorA.replace('#', ''), 16) || 0x38bdf8;
    const colB = parseInt(colorB.replace('#', ''), 16) || 0xffffff;

    if (!this.combatFX) {
      this.combatFX = new CombatFXSystem(this.vfxLayer, undefined, (intensity, duration) => {
        this.screenShake(intensity, duration);
      });
    }

    switch (presetName) {
      case 'projectile':
      case 'fireball':
        await this.combatFX.attack('fireball', {
          from: { x: fromX, y: fromY },
          to: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'burst':
        await this.combatFX.attack('burst', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'beam':
      case 'energy_blast':
        await this.combatFX.attack('beam', {
          from: { x: fromX, y: fromY },
          to: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'slash':
        await this.combatFX.attack('slash', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'dimension_slash':
        await this.combatFX.attack('dimension_slash', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'holy_impact':
        await this.combatFX.attack('holy_impact', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'lightning':
      case 'lightning_strike':
        await this.combatFX.attack('lightning_strike', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'shadow_wave':
      case 'dark_sphere':
        await this.combatFX.attack('shadow_wave', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'quake':
        await this.combatFX.attack('quake', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'leaf_storm':
      case 'cyclone':
        await this.combatFX.attack('leaf_storm', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'aura':
        await this.vfxAura(fromX, fromY, colA, colB);
        break;

      case 'rain':
        await this.combatFX.attack('vortex', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;

      case 'ki_burst':
        await this.vfxKiBurst(toX, toY);
        break;

      case 'soul_flame':
        await this.vfxSoulFlame(fromX, fromY);
        break;

      case 'bottle_seal':
        await this.vfxBottleSeal(fromX, fromY, toX, toY);
        break;

      case 'victory_burst':
        await this.vfxVictoryBurst(toX, toY);
        break;

      default:
        await this.combatFX.attack('burst', {
          position: { x: toX, y: toY },
          color: colA,
          secondaryColor: colB,
        });
        break;
    }
  }

  public vfxKiBurst(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenShake(12, 0.3);
      this.screenFlash(0x38bdf8, 90);

      if (this.combatFX) {
        this.combatFX.spawnFX('explosion', {
          position: { x, y },
          color: 0x38bdf8,
          secondaryColor: 0xffffff,
          scale: 1.25,
          duration: 0.45,
          layer: 'impactFX',
        });
        this.combatFX.spawnFX('shockwave', {
          position: { x, y: y + 8 },
          color: 0x38bdf8,
          secondaryColor: 0x60a5fa,
          scale: 1.3,
          duration: 0.42,
          layer: 'backFX',
        });
        this.combatFX.spawnFX('radial_impact', {
          position: { x, y },
          color: 0x38bdf8,
          secondaryColor: 0xffffff,
          scale: 1.2,
          duration: 0.38,
          layer: 'impactFX',
        });
        this.combatFX.spawnFX('energy_ring', {
          position: { x, y },
          color: 0x38bdf8,
          secondaryColor: 0xffffff,
          scale: 1.1,
          duration: 0.35,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('particles', {
          position: { x, y },
          color: 0x38bdf8,
          secondaryColor: 0xffffff,
          scale: 1.15,
          count: 36,
          duration: 0.55,
          layer: 'impactFX',
        });
      }

      setTimeout(resolve, 360);
    });
  }

  public vfxAura(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.combatFX) {
        this.combatFX.spawnFX('aura', {
          position: { x, y },
          color: colA,
          secondaryColor: colB,
          scale: 1.15,
          duration: 0.6,
          layer: 'backFX',
        });
        this.combatFX.spawnFX('spiral', {
          position: { x, y },
          color: colA,
          secondaryColor: colB,
          scale: 1.05,
          duration: 0.55,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('particles', {
          position: { x, y },
          color: colA,
          secondaryColor: colB,
          scale: 1.05,
          count: 28,
          duration: 0.55,
          layer: 'impactFX',
        });
      }
      setTimeout(resolve, 420);
    });
  }

  public vfxSoulFlame(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.combatFX) {
        this.combatFX.spawnFX('vortex', {
          position: { x, y },
          color: 0xa855f7,
          secondaryColor: 0x38bdf8,
          scale: 1.1,
          duration: 0.65,
          layer: 'backFX',
        });
        this.combatFX.spawnFX('energy_sphere', {
          position: { x, y: y - 10 },
          color: 0x38bdf8,
          secondaryColor: 0xffffff,
          scale: 0.85,
          duration: 0.55,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('particles', {
          position: { x, y: y - 10 },
          color: 0xc084fc,
          secondaryColor: 0x38bdf8,
          scale: 1.0,
          count: 32,
          duration: 0.6,
          layer: 'impactFX',
        });
      }
      setTimeout(resolve, 450);
    });
  }

  public vfxBottleSeal(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.combatFX) {
        this.combatFX.spawnFX('trail', {
          from: { x: fromX, y: fromY },
          to: { x: toX, y: toY },
          color: 0x38bdf8,
          secondaryColor: 0xc084fc,
          scale: 1.25,
          duration: 0.45,
          layer: 'projectileFX',
        });
        this.combatFX.spawnFX('vortex', {
          position: { x: toX, y: toY },
          color: 0x38bdf8,
          secondaryColor: 0xfacc15,
          scale: 0.9,
          duration: 0.55,
          layer: 'backFX',
        });
        setTimeout(() => {
          this.combatFX?.spawnFX('radial_impact', {
            position: { x: toX, y: toY },
            color: 0x38bdf8,
            secondaryColor: 0xffffff,
            scale: 1.0,
            duration: 0.35,
            layer: 'impactFX',
          });
          this.combatFX?.spawnFX('energy_ring', {
            position: { x: toX, y: toY },
            color: 0x38bdf8,
            secondaryColor: 0xffffff,
            scale: 0.95,
            duration: 0.32,
            layer: 'frontFX',
          });
        }, 220);
      }
      setTimeout(resolve, 460);
    });
  }

  public vfxVictoryBurst(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenFlash(0xfacc15, 180);
      this.screenShake(10, 0.3);

      if (this.combatFX) {
        this.combatFX.spawnFX('shockwave', {
          position: { x, y: y + 10 },
          color: 0xfacc15,
          secondaryColor: 0x38bdf8,
          scale: 1.5,
          duration: 0.55,
          layer: 'backFX',
        });
        this.combatFX.spawnFX('energy_ring', {
          position: { x, y },
          color: 0xfacc15,
          secondaryColor: 0xffffff,
          scale: 1.35,
          duration: 0.48,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('spiral', {
          position: { x, y },
          color: 0x38bdf8,
          secondaryColor: 0xfacc15,
          scale: 1.25,
          duration: 0.6,
          layer: 'frontFX',
        });
        this.combatFX.spawnFX('radial_impact', {
          position: { x, y },
          color: 0xfacc15,
          secondaryColor: 0xffffff,
          scale: 1.4,
          duration: 0.45,
          layer: 'impactFX',
        });
        this.combatFX.spawnFX('particles', {
          position: { x, y: y - 10 },
          color: 0xfacc15,
          secondaryColor: 0xffffff,
          scale: 1.4,
          count: 52,
          duration: 0.7,
          layer: 'impactFX',
        });
      }

      setTimeout(resolve, 480);
    });
  }
}

export const GlobalVFXSystem = VFXSystem.getInstance();
