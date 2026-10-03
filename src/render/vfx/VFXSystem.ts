import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GlobalPixiRenderer } from '../PixiRenderer';

export interface Particle {
  graphic: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  scale: number;
  maxLife: number;
  life: number;
  color: number;
  active: boolean;
}

export class ParticlePool {
  private pool: Particle[] = [];
  private container: Container;

  constructor(container: Container, initialSize = 150) {
    this.container = container;
    for (let i = 0; i < initialSize; i++) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      this.pool.push({
        graphic: g,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        alpha: 1,
        scale: 1,
        maxLife: 1,
        life: 0,
        color: 0xffffff,
        active: false,
      });
    }
  }

  public getParticle(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        this.pool[i].graphic.visible = true;
        return this.pool[i];
      }
    }
    return null;
  }

  public update(dt: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.graphic.visible = false;
        continue;
      }

      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.graphic.position.set(p.x, p.y);

      const progress = p.life / p.maxLife;
      p.graphic.alpha = p.alpha * (1 - progress);
    }
  }

  public clear(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].graphic.visible = false;
    }
  }
}

export class VFXSystem {
  private static instance: VFXSystem;
  public vfxLayer: Container = new Container();
  public particlePool!: ParticlePool;

  private shakeTimer = 0;
  private shakeIntensity = 0;
  private origStageX = 0;
  private origStageY = 0;
  private weatherTimer = 0;

  public updateWeatherVFX(dt: number, weather: import('../../types/weather').WeatherType): void {
    if (!weather || weather === 'none') return;
    this.weatherTimer += dt;
    if (this.weatherTimer < 0.05) return;
    this.weatherTimer = 0;

    const width = GlobalPixiRenderer.width || 800;
    const height = GlobalPixiRenderer.height || 600;

    if (weather === 'rain') {
      const p = this.particlePool?.getParticle();
      if (p) {
        p.x = Math.random() * (width + 200) - 100;
        p.y = -20;
        p.vx = -3;
        p.vy = 12 + Math.random() * 4;
        p.maxLife = 1.2;
        p.life = 0;
        p.alpha = 0.7;
        p.graphic.clear();
        p.graphic.moveTo(0, 0);
        p.graphic.lineTo(-4, 16);
        p.graphic.stroke({ color: 0x38bdf8, width: 2 });
      }
    } else if (weather === 'sun') {
      const p = this.particlePool?.getParticle();
      if (p) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.vx = (Math.random() - 0.5) * 0.5;
        p.vy = -0.5 - Math.random() * 0.5;
        p.maxLife = 1.5;
        p.life = 0;
        p.alpha = 0.5;
        p.graphic.clear();
        p.graphic.circle(0, 0, 3 + Math.random() * 4);
        p.graphic.fill({ color: 0xfef08a });
      }
    } else if (weather === 'sandstorm') {
      const p = this.particlePool?.getParticle();
      if (p) {
        p.x = -20;
        p.y = Math.random() * height;
        p.vx = 8 + Math.random() * 4;
        p.vy = (Math.random() - 0.5) * 2;
        p.maxLife = 1.5;
        p.life = 0;
        p.alpha = 0.6;
        p.graphic.clear();
        p.graphic.rect(0, 0, 4, 3);
        p.graphic.fill({ color: 0xd97706 });
      }
    } else if (weather === 'snow') {
      const p = this.particlePool?.getParticle();
      if (p) {
        p.x = Math.random() * width;
        p.y = -10;
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = 2 + Math.random() * 2;
        p.maxLife = 3.0;
        p.life = 0;
        p.alpha = 0.8;
        p.graphic.clear();
        p.graphic.circle(0, 0, 2 + Math.random() * 2.5);
        p.graphic.fill({ color: 0xffffff });
      }
    }
  }

  private constructor() {}

  public static getInstance(): VFXSystem {
    if (!VFXSystem.instance) {
      VFXSystem.instance = new VFXSystem();
    }
    return VFXSystem.instance;
  }

  public init(parentLayer: Container): void {
    this.vfxLayer = new Container();
    this.vfxLayer.zIndex = 800;
    parentLayer.addChild(this.vfxLayer);
    this.particlePool = new ParticlePool(this.vfxLayer, 200);
  }

  public update(dt: number): void {
    this.particlePool.update(dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      if (this.shakeTimer <= 0) {
        this.shakeTimer = 0;
        GlobalPixiRenderer.app.stage.position.set(this.origStageX, this.origStageY);
      } else {
        const dx = (Math.random() - 0.5) * this.shakeIntensity * 2;
        const dy = (Math.random() - 0.5) * this.shakeIntensity * 2;
        GlobalPixiRenderer.app.stage.position.set(this.origStageX + dx, this.origStageY + dy);
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
      const flashG = new Graphics();
      flashG.rect(0, 0, GlobalPixiRenderer.width, GlobalPixiRenderer.height);
      flashG.fill({ color: colorHex, alpha: 0.75 });
      this.vfxLayer.addChild(flashG);

      setTimeout(() => {
        flashG.destroy();
        resolve();
      }, durationMs);
    });
  }

  public spawnDamageText(x: number, y: number, damage: number, isCritical = false): void {
    const textStr = isCritical ? `💥 ${damage}!` : `${damage}`;
    const txt = new Text({
      text: textStr,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: isCritical ? 36 : 28,
        fontWeight: '900',
        fill: isCritical ? '#facc15' : '#ffffff',
        stroke: { color: '#000000', width: 6 },
      }),
    });
    txt.anchor.set(0.5);
    txt.position.set(x, y);
    this.vfxLayer.addChild(txt);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.03;
      txt.position.y -= 1.8;
      txt.alpha = 1 - elapsed / 0.8;
      if (elapsed >= 0.8) {
        clearInterval(interval);
        txt.destroy();
      }
    }, 30);
  }

  public spawnEffectivenessBadge(x: number, y: number, rating: 'super_effective' | 'not_very_effective' | 'immune'): void {
    let label = '¡SÚPER EFICAZ!';
    let col = '#facc15';
    if (rating === 'not_very_effective') {
      label = 'No es muy eficaz...';
      col = '#94a3b8';
    } else if (rating === 'immune') {
      label = '¡Sin efecto!';
      col = '#f43f5e';
    }

    const badge = new Container();
    badge.position.set(x, y - 40);

    const bg = new Graphics();
    bg.roundRect(-110, -18, 220, 36, 8);
    bg.fill({ color: 0x0f172a, alpha: 0.9 });
    bg.stroke({ color: col === '#facc15' ? 0xfacc15 : 0x38bdf8, width: 2 });
    badge.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fontWeight: '900',
        fill: col,
      }),
    });
    txt.anchor.set(0.5);
    badge.addChild(txt);

    this.vfxLayer.addChild(badge);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.04;
      badge.position.y -= 1.2;
      badge.alpha = 1 - elapsed / 1.0;
      if (elapsed >= 1.0) {
        clearInterval(interval);
        badge.destroy();
      }
    }, 40);
  }

  public spawnStatChangeArrow(x: number, y: number, statName: string, delta: number): void {
    const isUp = delta > 0;
    const arrowStr = isUp ? `▲ ${statName.toUpperCase()} +${delta}` : `▼ ${statName.toUpperCase()} ${delta}`;
    const col = isUp ? '#4ade80' : '#f43f5e';

    const container = new Container();
    container.position.set(x, y);

    const txt = new Text({
      text: arrowStr,
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 18,
        fontWeight: '900',
        fill: col,
        stroke: { color: '#000000', width: 4 },
      }),
    });
    txt.anchor.set(0.5);
    container.addChild(txt);

    this.vfxLayer.addChild(container);

    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 0.03;
      container.position.y += isUp ? -1.5 : 1.5;
      container.alpha = 1 - elapsed / 0.9;
      if (elapsed >= 0.9) {
        clearInterval(interval);
        container.destroy();
      }
    }, 30);
  }

  public vfxRepairSpark(x: number, y: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        p.graphic.clear();
        p.graphic.rect(0, 0, 3, 3);
        p.graphic.fill({ color: 0xffd700 });
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0;
        p.maxLife = 0.3 + Math.random() * 0.2;
        p.alpha = 1;
    }
  }

  // --- PRESET VFX IMPLEMENTATIONS ---

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

    switch (presetName) {
      case 'projectile':
        await this.vfxProjectile(fromX, fromY, toX, toY, colA, colB);
        break;
      case 'burst':
        await this.vfxBurst(toX, toY, colA, colB);
        break;
      case 'beam':
        await this.vfxBeam(fromX, fromY, toX, toY, colA, colB);
        break;
      case 'slash':
        await this.vfxSlash(toX, toY, colA, colB);
        break;
      case 'aura':
        await this.vfxAura(fromX, fromY, colA, colB);
        break;
      case 'rain':
        await this.vfxRain(toX, toY, colA, colB);
        break;
      case 'quake':
        await this.vfxQuake(toX, toY, colA, colB);
        break;
      case 'shadow_wave':
        await this.vfxShadowWave(toX, toY, colA, colB);
        break;
      case 'lightning':
        await this.vfxLightning(fromX, fromY, toX, toY, colA, colB);
        break;
      case 'leaf_storm':
        await this.vfxLeafStorm(toX, toY, colA, colB);
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
      default:
        await this.vfxBurst(toX, toY, colA, colB);
        break;
    }
  }

  private vfxProjectile(fromX: number, fromY: number, toX: number, toY: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      const ball = new Graphics();
      ball.circle(0, 0, 14);
      ball.fill({ color: colA });
      ball.circle(0, 0, 8);
      ball.fill({ color: colB });
      ball.position.set(fromX, fromY);
      this.vfxLayer.addChild(ball);

      const steps = 18;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        const t = step / steps;
        ball.position.set(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t);

        // Trail particles
        const p = this.particlePool.getParticle();
        if (p) {
          p.graphic.clear();
          p.graphic.circle(0, 0, 6);
          p.graphic.fill({ color: colA });
          p.x = ball.x;
          p.y = ball.y;
          p.vx = (Math.random() - 0.5) * 1.5;
          p.vy = (Math.random() - 0.5) * 1.5;
          p.life = 0;
          p.maxLife = 0.25;
          p.alpha = 0.8;
        }

        if (step >= steps) {
          clearInterval(interval);
          ball.destroy();
          this.screenShake(8, 0.2);
          this.vfxBurst(toX, toY, colA, colB).then(resolve);
        }
      }, 20);
    });
  }

  private vfxBurst(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenShake(10, 0.25);
      const count = 28;
      for (let i = 0; i < count; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;

        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = 4 + Math.random() * 6;

        p.graphic.clear();
        p.graphic.circle(0, 0, 5 + Math.random() * 4);
        p.graphic.fill({ color: i % 2 === 0 ? colA : colB });
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0;
        p.maxLife = 0.4 + Math.random() * 0.2;
        p.alpha = 1;
      }

      setTimeout(resolve, 350);
    });
  }

  private vfxBeam(fromX: number, fromY: number, toX: number, toY: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      const beamG = new Graphics();
      this.vfxLayer.addChild(beamG);

      let alpha = 0;
      let frame = 0;
      this.screenShake(12, 0.4);

      const interval = setInterval(() => {
        frame++;
        beamG.clear();
        beamG.stroke({ color: colA, width: 24, alpha: Math.min(1, frame / 5) });
        beamG.moveTo(fromX, fromY);
        beamG.lineTo(toX, toY);

        beamG.stroke({ color: colB, width: 10, alpha: Math.min(1, frame / 5) });
        beamG.moveTo(fromX, fromY);
        beamG.lineTo(toX, toY);

        if (frame >= 14) {
          clearInterval(interval);
          beamG.destroy();
          resolve();
        }
      }, 25);
    });
  }

  private vfxSlash(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      const slashG = new Graphics();
      this.vfxLayer.addChild(slashG);

      this.screenShake(6, 0.2);
      let step = 0;

      const interval = setInterval(() => {
        step++;
        slashG.clear();

        // 3 diagonal slash cuts
        for (let i = -1; i <= 1; i++) {
          const offY = i * 22;
          const progress = step / 8;
          const x1 = x - 60 + progress * 20;
          const y1 = y - 60 + offY + progress * 20;
          const x2 = x + 60 + progress * 20;
          const y2 = y + 60 + offY + progress * 20;

          slashG.stroke({ color: colA, width: 6, alpha: 1 - progress });
          slashG.moveTo(x1, y1);
          slashG.lineTo(x2, y2);

          slashG.stroke({ color: colB, width: 2, alpha: 1 - progress });
          slashG.moveTo(x1, y1);
          slashG.lineTo(x2, y2);
        }

        if (step >= 8) {
          clearInterval(interval);
          slashG.destroy();
          resolve();
        }
      }, 30);
    });
  }

  private vfxAura(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      for (let i = 0; i < 30; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;

        p.graphic.clear();
        p.graphic.circle(0, 0, 6 + Math.random() * 4);
        p.graphic.fill({ color: i % 2 === 0 ? colA : colB });
        p.x = x + (Math.random() - 0.5) * 60;
        p.y = y + 20 + Math.random() * 20;
        p.vx = (Math.random() - 0.5) * 1.0;
        p.vy = -3 - Math.random() * 4;
        p.life = 0;
        p.maxLife = 0.5 + Math.random() * 0.3;
        p.alpha = 0.9;
      }

      setTimeout(resolve, 500);
    });
  }

  private vfxRain(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      for (let i = 0; i < 35; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;

        p.graphic.clear();
        p.graphic.rect(-1, -8, 2, 16);
        p.graphic.fill({ color: colA });
        p.x = x + (Math.random() - 0.5) * 180;
        p.y = y - 140 + Math.random() * 40;
        p.vx = -1.5;
        p.vy = 8 + Math.random() * 5;
        p.life = 0;
        p.maxLife = 0.4;
        p.alpha = 0.85;
      }

      setTimeout(resolve, 450);
    });
  }

  private vfxQuake(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenShake(16, 0.5);

      const cracks = new Graphics();
      cracks.position.set(x, y + 20);
      cracks.stroke({ color: colA, width: 4, alpha: 0.9 });
      cracks.moveTo(-50, 0);
      cracks.lineTo(-20, -10);
      cracks.lineTo(10, 8);
      cracks.lineTo(50, -5);
      this.vfxLayer.addChild(cracks);

      for (let i = 0; i < 24; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;

        p.graphic.clear();
        p.graphic.rect(-4, -4, 8, 8);
        p.graphic.fill({ color: colB });
        p.x = x + (Math.random() - 0.5) * 100;
        p.y = y + 10;
        p.vx = (Math.random() - 0.5) * 4;
        p.vy = -3 - Math.random() * 4;
        p.life = 0;
        p.maxLife = 0.45;
        p.alpha = 1;
      }

      setTimeout(() => {
        cracks.destroy();
        resolve();
      }, 500);
    });
  }

  private vfxShadowWave(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      const ring = new Graphics();
      ring.position.set(x, y);
      this.vfxLayer.addChild(ring);

      let radius = 10;
      const maxRadius = 90;

      const interval = setInterval(() => {
        radius += 6;
        const progress = radius / maxRadius;

        ring.clear();
        ring.stroke({ color: colA, width: 8, alpha: 1 - progress });
        ring.circle(0, 0, radius);

        ring.stroke({ color: colB, width: 3, alpha: 1 - progress });
        ring.circle(0, 0, radius * 0.85);

        if (radius >= maxRadius) {
          clearInterval(interval);
          ring.destroy();
          resolve();
        }
      }, 25);
    });
  }

  private vfxLightning(fromX: number, fromY: number, toX: number, toY: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenShake(14, 0.35);
      const boltG = new Graphics();
      this.vfxLayer.addChild(boltG);

      let step = 0;
      const interval = setInterval(() => {
        step++;
        boltG.clear();

        // Procedural zig-zag lightning bolt
        const segments = 6;
        let currX = fromX;
        let currY = fromY;

        boltG.stroke({ color: colA, width: 6 });
        boltG.moveTo(currX, currY);

        for (let i = 1; i <= segments; i++) {
          const t = i / segments;
          let nx = fromX + (toX - fromX) * t;
          let ny = fromY + (toY - fromY) * t;

          if (i < segments) {
            nx += (Math.random() - 0.5) * 40;
            ny += (Math.random() - 0.5) * 40;
          }

          boltG.lineTo(nx, ny);
          currX = nx;
          currY = ny;
        }

        if (step >= 8) {
          clearInterval(interval);
          boltG.destroy();
          resolve();
        }
      }, 35);
    });
  }

  private vfxLeafStorm(x: number, y: number, colA: number, colB: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenShake(8, 0.3);

      for (let i = 0; i < 30; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;

        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 60;

        p.graphic.clear();
        p.graphic.ellipse(0, 0, 8, 4);
        p.graphic.fill({ color: i % 2 === 0 ? colA : colB });
        p.x = x + Math.cos(angle) * radius;
        p.y = y + Math.sin(angle) * radius;
        p.vx = Math.cos(angle + Math.PI / 2) * 4;
        p.vy = Math.sin(angle + Math.PI / 2) * 4 - 1;
        p.life = 0;
        p.maxLife = 0.5;
        p.alpha = 0.9;
      }

      setTimeout(resolve, 500);
    });
  }

  public vfxKiBurst(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      this.screenShake(12, 0.35);
      const count = 35;
      for (let i = 0; i < count; i++) {
        const p = this.particlePool.getParticle();
        if (!p) continue;

        const angle = Math.random() * Math.PI * 2;
        const speed = 5 + Math.random() * 8;

        p.graphic.clear();
        p.graphic.circle(0, 0, 4 + Math.random() * 5);
        p.graphic.fill({ color: i % 3 === 0 ? 0x38bdf8 : i % 3 === 1 ? 0xc084fc : 0xffffff });
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 2;
        p.life = 0;
        p.maxLife = 0.5 + Math.random() * 0.3;
        p.alpha = 1.0;
      }

      setTimeout(resolve, 450);
    });
  }

  public vfxSoulFlame(x: number, y: number): Promise<void> {
    return new Promise((resolve) => {
      const flameContainer = new Container();
      flameContainer.position.set(x, y);
      this.vfxLayer.addChild(flameContainer);

      const soulG = new Graphics();
      soulG.circle(0, 0, 16);
      soulG.fill({ color: 0x38bdf8, alpha: 0.85 });
      soulG.circle(0, 0, 10);
      soulG.fill({ color: 0xffffff, alpha: 0.95 });
      flameContainer.addChild(soulG);

      let step = 0;
      const interval = setInterval(() => {
        step++;
        flameContainer.position.y -= 2.5;
        flameContainer.alpha = 1 - step / 25;

        const p = this.particlePool.getParticle();
        if (p) {
          p.graphic.clear();
          p.graphic.circle(0, 0, 4);
          p.graphic.fill({ color: 0xc084fc });
          p.x = flameContainer.x + (Math.random() - 0.5) * 16;
          p.y = flameContainer.y;
          p.vx = (Math.random() - 0.5) * 1.0;
          p.vy = -2;
          p.life = 0;
          p.maxLife = 0.4;
          p.alpha = 0.8;
        }

        if (step >= 25) {
          clearInterval(interval);
          flameContainer.destroy();
          resolve();
        }
      }, 30);
    });
  }

  public vfxBottleSeal(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    return new Promise((resolve) => {
      const beam = new Graphics();
      this.vfxLayer.addChild(beam);

      let step = 0;
      const interval = setInterval(() => {
        step++;
        beam.clear();
        beam.moveTo(fromX, fromY);
        beam.lineTo(toX, toY);
        beam.stroke({ color: step % 2 === 0 ? 0x38bdf8 : 0xc084fc, width: 6, alpha: 0.8 });

        const p = this.particlePool.getParticle();
        if (p) {
          const t = Math.random();
          p.x = fromX + (toX - fromX) * t;
          p.y = fromY + (toY - fromY) * t;
          p.vx = (Math.random() - 0.5) * 2;
          p.vy = (Math.random() - 0.5) * 2;
          p.maxLife = 0.3;
          p.life = 0;
          p.alpha = 0.9;
          p.graphic.clear();
          p.graphic.circle(0, 0, 4);
          p.graphic.fill({ color: 0xfef08a });
        }

        if (step >= 12) {
          clearInterval(interval);
          beam.destroy();
          this.vfxKiBurst(toX, toY).then(resolve);
        }
      }, 35);
    });
  }
}

export const GlobalVFXSystem = VFXSystem.getInstance();
