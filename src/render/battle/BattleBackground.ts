import { Container, Graphics, Sprite, Texture, Assets } from 'pixi.js';
import { BiomeType } from '../../scenes/BattleScene';
import { COLOR_NUM } from '../../ui/styles';

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  baseAlpha: number;
  phase: number;
  freq: number;
  graphics: Graphics;
}

export interface BattleBackgroundOptions {
  width: number;
  height: number;
  biome: BiomeType;
  customPngUrl?: string;
}

/**
 * BattleBackground — Fondo de combate modular para Souldolls.
 * Genera escenarios visuales ricos proceduralmente por bioma ('pasto', 'bosque', 'cueva', 'interior')
 * y soporta la inyección / carga automática de imágenes PNG personalizadas (/assets/battle/bg_${biome}.png).
 */
export class BattleBackground {
  public readonly container: Container;

  private width: number;
  private height: number;
  private biome: BiomeType;

  // Capas visuales
  private proceduralContainer: Container;
  private skyGraphics: Graphics;
  private groundGraphics: Graphics;
  private decorGraphics: Graphics;
  private particlesContainer: Container;

  // Capa PNG (cuando se proporcione textura o archivo)
  private pngContainer: Container;
  private pngSprite: Sprite | null = null;

  // Partículas ambientales sin asignaciones por frame (I-13)
  private particles: AmbientParticle[] = [];
  private timeSec = 0;

  constructor(options: BattleBackgroundOptions) {
    this.width = options.width;
    this.height = options.height;
    this.biome = options.biome;

    this.container = new Container();
    this.container.roundPixels = true;

    // 1. Contenedor procedural
    this.proceduralContainer = new Container();
    this.proceduralContainer.roundPixels = true;
    this.container.addChild(this.proceduralContainer);

    this.skyGraphics = new Graphics();
    this.groundGraphics = new Graphics();
    this.decorGraphics = new Graphics();
    this.particlesContainer = new Container();
    this.particlesContainer.roundPixels = true;

    this.proceduralContainer.addChild(this.skyGraphics);
    this.proceduralContainer.addChild(this.groundGraphics);
    this.proceduralContainer.addChild(this.decorGraphics);
    this.proceduralContainer.addChild(this.particlesContainer);

    // 2. Contenedor PNG
    this.pngContainer = new Container();
    this.pngContainer.roundPixels = true;
    this.container.addChild(this.pngContainer);

    // Generar el fondo procedural según bioma
    this.buildProceduralScene();

    // Intentar cargar PNG si existe o se especificó
    const targetPng = options.customPngUrl || `/assets/battle/bg_${this.biome}.png`;
    this.tryLoadPng(targetPng);
  }

  /**
   * Intenta cargar una textura PNG para el fondo de batalla.
   * Si no se encuentra (404), mantiene el fondo procedural activo sin errores.
   */
  public async tryLoadPng(url: string): Promise<boolean> {
    try {
      const tex = await Assets.load<Texture>(url);
      if (tex && !this.container.destroyed) {
        this.setCustomTexture(tex);
        return true;
      }
    } catch {
      // No existe PNG todavía, el fondo procedural continúa funcionando
    }
    return false;
  }

  /**
   * Configura una textura PNG personalizada directamente.
   */
  public setCustomTexture(tex: Texture): void {
    if (!this.pngSprite) {
      this.pngSprite = new Sprite(tex);
      this.pngSprite.roundPixels = true;
      this.pngContainer.addChild(this.pngSprite);
    } else {
      this.pngSprite.texture = tex;
    }

    // Escalar manteniendo proporción cubriendo el área
    const scaleX = this.width / tex.width;
    const scaleY = this.height / tex.height;
    const scale = Math.max(scaleX, scaleY);
    this.pngSprite.scale.set(scale);
    this.pngSprite.position.set(
      Math.round((this.width - tex.width * scale) / 2),
      Math.round((this.height - tex.height * scale) / 2)
    );
    this.pngSprite.visible = true;

    // Ocultar capa procedural si el PNG es opaco y activo
    this.proceduralContainer.visible = false;
  }

  /**
   * Genera el escenario procedural completo para el bioma actual.
   */
  public setBiome(biome: BiomeType): void {
    this.biome = biome;
    this.clearParticles();
    this.buildProceduralScene();
    this.tryLoadPng(`/assets/battle/bg_${this.biome}.png`);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.clearParticles();
    this.buildProceduralScene();
    if (this.pngSprite && this.pngSprite.texture) {
      this.setCustomTexture(this.pngSprite.texture);
    }
  }

  private buildProceduralScene(): void {
    this.skyGraphics.clear();
    this.groundGraphics.clear();
    this.decorGraphics.clear();

    const w = this.width;
    const h = this.height;
    const horizonY = Math.round(h * 0.40);

    switch (this.biome) {
      case 'bosque':
        this.buildBosqueScene(w, h, horizonY);
        break;
      case 'cueva':
        this.buildCuevaScene(w, h, horizonY);
        break;
      case 'interior':
        this.buildInteriorScene(w, h, horizonY);
        break;
      case 'pasto':
      default:
        this.buildPastoScene(w, h, horizonY);
        break;
    }
  }

  // =========================================================================
  // BIOMA 1: PASTO / PRADERA / CLARO DE ALMAS
  // =========================================================================
  private buildPastoScene(w: number, h: number, horizonY: number): void {
    // 1. Cielo crepuscular con degradado en bandas pixel-art
    const skyBands = [
      { y0: 0, y1: Math.round(horizonY * 0.22), color: 0x0f172a }, // Azul profundo noche
      { y0: Math.round(horizonY * 0.22), y1: Math.round(horizonY * 0.45), color: 0x1e293b },
      { y0: Math.round(horizonY * 0.45), y1: Math.round(horizonY * 0.70), color: 0x0369a1 },
      { y0: Math.round(horizonY * 0.70), y1: Math.round(horizonY * 0.88), color: 0x0284c7 },
      { y0: Math.round(horizonY * 0.88), y1: horizonY, color: 0xf59e0b }, // Resplandor dorado horizonte
    ];
    skyBands.forEach((band) => {
      this.skyGraphics.rect(0, band.y0, w, band.y1 - band.y0);
      this.skyGraphics.fill({ color: band.color });
    });

    // Nubes pixeladas lejanas
    this.skyGraphics.rect(Math.round(w * 0.12), Math.round(horizonY * 0.32), Math.round(w * 0.28), 12);
    this.skyGraphics.rect(Math.round(w * 0.16), Math.round(horizonY * 0.32) - 6, Math.round(w * 0.18), 6);
    this.skyGraphics.fill({ color: 0xffffff, alpha: 0.18 });

    this.skyGraphics.rect(Math.round(w * 0.60), Math.round(horizonY * 0.48), Math.round(w * 0.32), 10);
    this.skyGraphics.rect(Math.round(w * 0.66), Math.round(horizonY * 0.48) - 5, Math.round(w * 0.20), 5);
    this.skyGraphics.fill({ color: 0xffedd5, alpha: 0.22 });

    // 2. Siluetas de montañas lejanas (Horizonte lejano)
    const mtnBaseY = horizonY;
    const mtnPeaks = [
      { x: 0, peakY: horizonY - 45, endX: Math.round(w * 0.35) },
      { x: Math.round(w * 0.25), peakY: horizonY - 60, endX: Math.round(w * 0.70) },
      { x: Math.round(w * 0.58), peakY: horizonY - 38, endX: w },
    ];
    mtnPeaks.forEach((p) => {
      this.skyGraphics.moveTo(p.x, mtnBaseY);
      this.skyGraphics.lineTo(Math.round((p.x + p.endX) / 2), p.peakY);
      this.skyGraphics.lineTo(p.endX, mtnBaseY);
      this.skyGraphics.closePath();
      this.skyGraphics.fill({ color: 0x162c46, alpha: 0.85 });
    });

    // 3. Colinas intermedias con siluetas de copas de árboles
    this.skyGraphics.ellipse(Math.round(w * 0.2), horizonY, Math.round(w * 0.35), 24);
    this.skyGraphics.ellipse(Math.round(w * 0.8), horizonY, Math.round(w * 0.4), 28);
    this.skyGraphics.fill({ color: 0x14402a });

    // Línea de niebla / resplandor en el horizonte
    this.skyGraphics.rect(0, horizonY - 3, w, 6);
    this.skyGraphics.fill({ color: 0x38bdf8, alpha: 0.25 });

    // 4. Suelo de pradera en capas
    const groundHeight = h - horizonY;
    const groundBands = [
      { y0: horizonY, y1: horizonY + Math.round(groundHeight * 0.22), color: 0x1c4a2f },
      { y0: horizonY + Math.round(groundHeight * 0.22), y1: horizonY + Math.round(groundHeight * 0.52), color: 0x184229 },
      { y0: horizonY + Math.round(groundHeight * 0.52), y1: h, color: 0x123320 },
    ];
    groundBands.forEach((band) => {
      this.groundGraphics.rect(0, band.y0, w, band.y1 - band.y0);
      this.groundGraphics.fill({ color: band.color });
    });

    // Textura de briznas de hierba y flores silvestres (doradas y carmesí)
    const seed = 42;
    for (let i = 0; i < 48; i++) {
      const gx = Math.round((Math.sin(i * 99 + seed) * 0.5 + 0.5) * (w - 16) + 8);
      const gy = Math.round(horizonY + 8 + (Math.cos(i * 37 + seed) * 0.5 + 0.5) * (groundHeight - 20));

      // Brizna
      this.decorGraphics.rect(gx, gy, 2, 5);
      this.decorGraphics.rect(gx + 2, gy - 2, 2, 7);
      this.decorGraphics.fill({ color: 0x22c55e, alpha: 0.35 });

      // Flor ocasional
      if (i % 4 === 0) {
        const flowerCol = i % 8 === 0 ? 0xf59e0b : 0xf43f5e;
        this.decorGraphics.rect(gx + 1, gy - 4, 3, 3);
        this.decorGraphics.fill({ color: flowerCol, alpha: 0.75 });
      }
    }

    // Partículas: Semillas / polen brillante en el viento
    this.createAmbientParticles(16, {
      minY: horizonY - 20,
      maxY: h - 20,
      color: 0xfef08a,
      baseAlpha: 0.6,
      vxMin: -0.4,
      vxMax: -1.2,
      vyMin: -0.2,
      vyMax: 0.2,
    });
  }

  // =========================================================================
  // BIOMA 2: BOSQUE / BOSQUE DEL ECO
  // =========================================================================
  private buildBosqueScene(w: number, h: number, horizonY: number): void {
    // 1. Cielo y dosel superior muy cerrado y místico
    const skyBands = [
      { y0: 0, y1: Math.round(horizonY * 0.35), color: 0x051315 },
      { y0: Math.round(horizonY * 0.35), y1: Math.round(horizonY * 0.70), color: 0x081e1c },
      { y0: Math.round(horizonY * 0.70), y1: horizonY, color: 0x0f2f29 },
    ];
    skyBands.forEach((band) => {
      this.skyGraphics.rect(0, band.y0, w, band.y1 - band.y0);
      this.skyGraphics.fill({ color: band.color });
    });

    // Rayos de luz de luna que bajan diagonalmente entre la copa
    for (let r = 0; r < 3; r++) {
      const rx = Math.round(w * (0.2 + r * 0.28));
      this.skyGraphics.moveTo(rx, 0);
      this.skyGraphics.lineTo(rx + 45, horizonY + 60);
      this.skyGraphics.lineTo(rx + 85, horizonY + 60);
      this.skyGraphics.lineTo(rx + 25, 0);
      this.skyGraphics.closePath();
      this.skyGraphics.fill({ color: 0x5eead4, alpha: 0.06 });
    }

    // 2. Capa de troncos y follaje de fondo
    const numTrunks = 12;
    for (let i = 0; i < numTrunks; i++) {
      const tx = Math.round((w / numTrunks) * i + ((i % 3) * 8));
      const tw = 8 + (i % 4) * 4;
      const th = horizonY + 30;
      this.skyGraphics.rect(tx, horizonY - th * 0.7, tw, th);
      this.skyGraphics.fill({ color: 0x0a221b });

      // Ramas
      this.skyGraphics.rect(tx - 12, horizonY - 45, 16, 5);
      this.skyGraphics.rect(tx + tw - 2, horizonY - 60, 20, 5);
      this.skyGraphics.fill({ color: 0x0a221b });
    }

    // Dosel de hojas que cuelgan del borde superior
    for (let c = 0; c < 8; c++) {
      const cx = Math.round((w / 7) * c);
      this.decorGraphics.ellipse(cx, 0, Math.round(w * 0.15), 38 + (c % 3) * 12);
      this.decorGraphics.fill({ color: 0x062017, alpha: 0.95 });
    }

    // Árboles laterales enmarcando la arena
    this.decorGraphics.rect(-10, 0, 48, h);
    this.decorGraphics.rect(w - 38, 0, 48, h);
    this.decorGraphics.fill({ color: 0x04130e });

    // 3. Suelo de humus, musgo y raíces
    const groundHeight = h - horizonY;
    this.groundGraphics.rect(0, horizonY, w, groundHeight);
    this.groundGraphics.fill({ color: 0x0c2417 });

    this.groundGraphics.rect(0, horizonY + Math.round(groundHeight * 0.35), w, groundHeight);
    this.groundGraphics.fill({ color: 0x081910 });

    // Raíces y setas bioluminiscentes en el suelo
    for (let s = 0; s < 18; s++) {
      const sx = Math.round((s * 53) % (w - 40) + 20);
      const sy = Math.round(horizonY + 12 + (s * 31) % (groundHeight - 24));
      // Tallo
      this.decorGraphics.rect(sx, sy, 2, 4);
      this.decorGraphics.fill({ color: 0xd1fae5, alpha: 0.7 });
      // Sombrero hongo brillante
      this.decorGraphics.rect(sx - 2, sy - 3, 6, 3);
      this.decorGraphics.fill({ color: s % 2 === 0 ? 0x2dd4bf : 0x38bdf8, alpha: 0.9 });
    }

    // Partículas: Luciérnagas flotantes que parpadean
    this.createAmbientParticles(20, {
      minY: 40,
      maxY: h - 30,
      color: 0x34d399,
      baseAlpha: 0.85,
      vxMin: -0.3,
      vxMax: 0.3,
      vyMin: -0.3,
      vyMax: 0.2,
    });
  }

  // =========================================================================
  // BIOMA 3: CUEVA / CAVERNA DE CRISTALES DE MANÁ
  // =========================================================================
  private buildCuevaScene(w: number, h: number, horizonY: number): void {
    // 1. Techo y bóveda de roca oscura basáltica
    this.skyGraphics.rect(0, 0, w, horizonY);
    this.skyGraphics.fill({ color: 0x090c15 });

    // Degradado en capas de penumbra
    this.skyGraphics.rect(0, Math.round(horizonY * 0.4), w, Math.round(horizonY * 0.6));
    this.skyGraphics.fill({ color: 0x111624 });

    // Estalactitas colgando del techo
    const stalactites = [
      { x: 12, w: 18, len: 45 },
      { x: 48, w: 14, len: 65 },
      { x: 95, w: 22, len: 52 },
      { x: 145, w: 16, len: 78 },
      { x: 198, w: 24, len: 44 },
      { x: 250, w: 20, len: 70 },
      { x: 295, w: 14, len: 58 },
      { x: 340, w: 26, len: 64 },
    ];
    stalactites.forEach((st) => {
      this.skyGraphics.moveTo(st.x, 0);
      this.skyGraphics.lineTo(st.x + Math.round(st.w / 2), st.len);
      this.skyGraphics.lineTo(st.x + st.w, 0);
      this.skyGraphics.closePath();
      this.skyGraphics.fill({ color: 0x161d2d });
    });

    // 2. Formaciones de Cristales de Maná (Ki Gems) incrustadas en las paredes
    const crystalColors = [0x06b6d4, 0xa855f7, 0x38bdf8, 0xf59e0b];
    for (let c = 0; c < 7; c++) {
      const cx = Math.round((c * 54 + 24) % (w - 40));
      const cy = Math.round(horizonY - 30 + ((c * 17) % 40) - 20);
      const col = crystalColors[c % crystalColors.length];

      // Halo de resplandor
      this.decorGraphics.circle(cx, cy, 14);
      this.decorGraphics.fill({ color: col, alpha: 0.18 });

      // Prisma cristalino principal
      this.decorGraphics.moveTo(cx, cy - 14);
      this.decorGraphics.lineTo(cx + 6, cy);
      this.decorGraphics.lineTo(cx, cy + 14);
      this.decorGraphics.lineTo(cx - 6, cy);
      this.decorGraphics.closePath();
      this.decorGraphics.fill({ color: col, alpha: 0.88 });

      // Faceta brillante
      this.decorGraphics.moveTo(cx, cy - 14);
      this.decorGraphics.lineTo(cx + 6, cy);
      this.decorGraphics.lineTo(cx, cy + 14);
      this.decorGraphics.closePath();
      this.decorGraphics.fill({ color: 0xffffff, alpha: 0.45 });
    }

    // 3. Suelo de roca y estratos minerales
    const groundHeight = h - horizonY;
    this.groundGraphics.rect(0, horizonY, w, groundHeight);
    this.groundGraphics.fill({ color: 0x131926 });

    this.groundGraphics.rect(0, horizonY + Math.round(groundHeight * 0.45), w, groundHeight);
    this.groundGraphics.fill({ color: 0x0a0e18 });

    // Grietas luminosas en el suelo
    for (let g = 0; g < 4; g++) {
      const gx = Math.round(w * (0.15 + g * 0.24));
      const gy = Math.round(horizonY + 25 + g * 18);
      this.decorGraphics.moveTo(gx, gy);
      this.decorGraphics.lineTo(gx + 18, gy + 8);
      this.decorGraphics.lineTo(gx + 32, gy + 4);
      this.decorGraphics.stroke({ color: 0x06b6d4, width: 2, alpha: 0.5 });
    }

    // Partículas: Polvo de cristal flotante que asciende lentamente
    this.createAmbientParticles(16, {
      minY: 60,
      maxY: h - 10,
      color: 0x38bdf8,
      baseAlpha: 0.7,
      vxMin: -0.15,
      vxMax: 0.15,
      vyMin: -0.6,
      vyMax: -0.2,
    });
  }

  // =========================================================================
  // BIOMA 4: INTERIOR / TALLER DE ARTÍFICES / GREMIO
  // =========================================================================
  private buildInteriorScene(w: number, h: number, horizonY: number): void {
    // 1. Muros de madera noble y sillería artesanal
    this.skyGraphics.rect(0, 0, w, horizonY);
    this.skyGraphics.fill({ color: 0x1e1510 });

    // Vigas de madera verticales y travesaño superior
    const beamCount = 6;
    for (let b = 0; b <= beamCount; b++) {
      const bx = Math.round((w / beamCount) * b);
      this.skyGraphics.rect(bx - 4, 0, 8, horizonY);
      this.skyGraphics.fill({ color: 0x2e1f17 });
    }
    this.skyGraphics.rect(0, horizonY - 12, w, 12);
    this.skyGraphics.fill({ color: 0x3d2a1f });

    // Gran ventanal ojival central mostrando el cielo exterior
    const winW = Math.round(w * 0.32);
    const winH = Math.round(horizonY * 0.65);
    const winX = Math.round((w - winW) / 2);
    const winY = 16;

    // Interior de ventana: Cielo nocturno
    this.decorGraphics.rect(winX, winY + 16, winW, winH - 16);
    this.decorGraphics.arc(winX + Math.round(winW / 2), winY + 16, Math.round(winW / 2), Math.PI, 0);
    this.decorGraphics.fill({ color: 0x091428 });
    this.decorGraphics.stroke({ color: 0xc29b38, width: 3 });

    // Luz de luna / farol entrando por el ventanal
    this.decorGraphics.circle(winX + Math.round(winW / 2), winY + 20, 8);
    this.decorGraphics.fill({ color: 0xfef08a, alpha: 0.85 });

    // Estandartes gremiales a los lados
    const bannerW = 22;
    const bannerH = 55;
    [Math.round(w * 0.1), Math.round(w * 0.82)].forEach((bx) => {
      this.decorGraphics.rect(bx, 20, bannerW, bannerH);
      this.decorGraphics.fill({ color: 0x7c2d12 });
      this.decorGraphics.stroke({ color: 0xd97706, width: 2 });
      // Sello en el estandarte
      this.decorGraphics.circle(bx + Math.round(bannerW / 2), 38, 5);
      this.decorGraphics.fill({ color: 0xf59e0b });
    });

    // 2. Suelo de tablones pulidos con líneas de perspectiva
    const groundHeight = h - horizonY;
    this.groundGraphics.rect(0, horizonY, w, groundHeight);
    this.groundGraphics.fill({ color: 0x2c1d15 });

    // Tablones horizontales
    for (let p = 1; p <= 6; p++) {
      const py = horizonY + Math.round((groundHeight / 7) * p);
      this.groundGraphics.rect(0, py, w, 2);
      this.groundGraphics.fill({ color: 0x180f0a });
    }

    // Reflejo cálido en el suelo
    this.decorGraphics.ellipse(Math.round(w * 0.5), horizonY + Math.round(groundHeight * 0.4), Math.round(w * 0.35), 24);
    this.decorGraphics.fill({ color: 0xf59e0b, alpha: 0.08 });

    // Partículas: Motas doradas de polvo artesanal
    this.createAmbientParticles(14, {
      minY: 30,
      maxY: h - 20,
      color: 0xfde047,
      baseAlpha: 0.55,
      vxMin: -0.15,
      vxMax: 0.15,
      vyMin: -0.25,
      vyMax: 0.1,
    });
  }

  // =========================================================================
  // SISTEMA DE PARTÍCULAS AMBIENTALES
  // =========================================================================
  private createAmbientParticles(
    count: number,
    cfg: {
      minY: number;
      maxY: number;
      color: number;
      baseAlpha: number;
      vxMin: number;
      vxMax: number;
      vyMin: number;
      vyMax: number;
    }
  ): void {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const size = 2 + (i % 3);
      g.rect(0, 0, size, size);
      g.fill({ color: cfg.color });

      const x = Math.round(Math.random() * this.width);
      const y = Math.round(cfg.minY + Math.random() * (cfg.maxY - cfg.minY));
      const vx = cfg.vxMin + Math.random() * (cfg.vxMax - cfg.vxMin);
      const vy = cfg.vyMin + Math.random() * (cfg.vyMax - cfg.vyMin);

      g.position.set(x, y);
      g.alpha = cfg.baseAlpha;
      this.particlesContainer.addChild(g);

      this.particles.push({
        x,
        y,
        vx,
        vy,
        size,
        color: cfg.color,
        baseAlpha: cfg.baseAlpha,
        phase: Math.random() * Math.PI * 2,
        freq: 1.5 + Math.random() * 2.0,
        graphics: g,
      });
    }
  }

  private clearParticles(): void {
    this.particles.forEach((p) => {
      p.graphics.destroy();
    });
    this.particles = [];
    this.particlesContainer.removeChildren();
  }

  /**
   * Actualización por frame de la animación ambiental (I-13: sin asignaciones de memoria).
   */
  public update(dt: number): void {
    if (!this.proceduralContainer.visible) return;

    this.timeSec += dt;
    const w = this.width;
    const h = this.height;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * (dt * 60);
      p.y += p.vy * (dt * 60);

      // Wrap bounds
      if (p.x < -8) p.x = w + 4;
      else if (p.x > w + 8) p.x = -4;

      if (p.y < 20) p.y = h - 20;
      else if (p.y > h - 10) p.y = 30;

      // Oscilación suave de opacidad
      const osc = Math.sin(this.timeSec * p.freq + p.phase);
      p.graphics.alpha = Math.max(0.1, p.baseAlpha + osc * 0.35);
      p.graphics.position.set(Math.round(p.x), Math.round(p.y));
    }
  }

  public destroy(): void {
    this.clearParticles();
    this.container.destroy({ children: true });
  }
}
