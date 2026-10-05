import { Container, Graphics } from 'pixi.js';
import { GlobalPixiRenderer } from '../PixiRenderer';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalVFXSystem } from '../vfx/VFXSystem';
import { COLOR_NUM } from '../../ui/styles';

const safeNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const safeRAF = (cb: (time: number) => void): void => {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(cb);
  } else {
    setTimeout(() => cb(safeNow()), 16);
  }
};

export type ScreenWipeType = 'diagonal_slash' | 'diamond_shards' | 'radial_iris' | 'curtain_wipe';

export interface ScreenWipeOptions {
  type?: ScreenWipeType;
  inDurationMs?: number;
  holdDurationMs?: number;
  outDurationMs?: number;
  playSfx?: boolean;
}

export class ScreenWipeTransition {
  private static instance: ScreenWipeTransition;
  private isTransitioning = false;

  private constructor() {}

  public static getInstance(): ScreenWipeTransition {
    if (!ScreenWipeTransition.instance) {
      ScreenWipeTransition.instance = new ScreenWipeTransition();
    }
    return ScreenWipeTransition.instance;
  }

  /**
   * Ejecuta una transición completa de barrido de pantalla:
   * 1. Barrido de entrada (Wipe In) que cubre el overworld 3D.
   * 2. Ejecución de la acción intermedia (carga/inicio de la escena 2D).
   * 3. Barrido de salida (Wipe Out) que revela la escena de combate.
   */
  public async executeTransition(
    midAction: () => Promise<void> | void,
    options: ScreenWipeOptions = {}
  ): Promise<void> {
    if (this.isTransitioning) {
      await midAction();
      return;
    }

    this.isTransitioning = true;
    const type = options.type || 'diagonal_slash';
    const inDur = options.inDurationMs ?? 320;
    const holdDur = options.holdDurationMs ?? 60;
    const outDur = options.outDurationMs ?? 280;
    const sfx = options.playSfx ?? true;

    try {
      if (sfx) {
        GlobalAudioService.playSfx('hit_super', 1.05);
      }

      // 1. Wipe In (Cierre de pantalla)
      await this.runWipeIn(type, inDur);

      // Flash y chispas al momento del cierre completo
      if (GlobalVFXSystem) {
        GlobalVFXSystem.screenFlash(0xffffff, 80);
      }

      // Pausa breve en pantalla cerrada
      if (holdDur > 0) {
        await this.sleep(holdDur);
      }

      // 2. Acción intermedia (Cambio/Montaje de Escena)
      await midAction();

      // 3. Wipe Out (Apertura de pantalla)
      await this.runWipeOut(type, outDur);
    } catch (err) {
      console.error('[ScreenWipeTransition] Error during transition:', err);
    } finally {
      this.clearTransitionLayer();
      this.isTransitioning = false;
    }
  }

  private runWipeIn(type: ScreenWipeType, durationMs: number): Promise<void> {
    switch (type) {
      case 'diamond_shards':
        return this.animateDiamondShardsIn(durationMs);
      case 'radial_iris':
        return this.animateRadialIrisIn(durationMs);
      case 'curtain_wipe':
        return this.animateCurtainIn(durationMs);
      case 'diagonal_slash':
      default:
        return this.animateDiagonalSlashIn(durationMs);
    }
  }

  private runWipeOut(type: ScreenWipeType, durationMs: number): Promise<void> {
    switch (type) {
      case 'diamond_shards':
        return this.animateDiamondShardsOut(durationMs);
      case 'radial_iris':
        return this.animateRadialIrisOut(durationMs);
      case 'curtain_wipe':
        return this.animateCurtainOut(durationMs);
      case 'diagonal_slash':
      default:
        return this.animateDiagonalSlashOut(durationMs);
    }
  }

  // =========================================================================
  // 1. DIAGONAL SLASH TRANSITION (Corte Sagrado de Ki - 6 Cuchillas Diagonales)
  // =========================================================================

  private animateDiagonalSlashIn(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const bladeCount = 6;
      const bladeH = (height * 1.5) / bladeCount;

      const blades: Graphics[] = [];
      for (let i = 0; i < bladeCount; i++) {
        const g = new Graphics();
        g.roundPixels = true;
        container.addChild(g);
        blades.push(g);
      }

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        // Easing: easeOutCubic
        const ease = 1 - Math.pow(1 - progress, 3);

        const travelDist = width * 1.4;

        for (let i = 0; i < bladeCount; i++) {
          const g = blades[i];
          g.clear();

          const fromLeft = i % 2 === 0;
          const currentX = fromLeft
            ? -travelDist + travelDist * ease
            : travelDist - travelDist * ease;

          const y0 = i * bladeH - height * 0.25;
          const slant = 140; // Desplazamiento diagonal

          // Cuerpo principal de la cuchilla (InkCrypt)
          g.moveTo(currentX - (fromLeft ? 0 : width * 1.5), y0);
          g.lineTo(currentX + (fromLeft ? width * 1.5 : 0) + slant, y0);
          g.lineTo(currentX + (fromLeft ? width * 1.5 : 0), y0 + bladeH + 4);
          g.lineTo(currentX - (fromLeft ? 0 : width * 1.5) - slant, y0 + bladeH + 4);
          g.closePath();
          g.fill({ color: COLOR_NUM.inkCrypt });

          // Borde dorado de ki
          g.moveTo(currentX + (fromLeft ? width * 1.5 : 0) + slant, y0);
          g.lineTo(currentX + (fromLeft ? width * 1.5 : 0), y0 + bladeH + 4);
          g.stroke({ color: COLOR_NUM.gold, width: 4 });

          // Línea de brillo cian
          g.moveTo(currentX + (fromLeft ? width * 1.5 : 0) + slant - 4, y0);
          g.lineTo(currentX + (fromLeft ? width * 1.5 : 0) - 4, y0 + bladeH + 4);
          g.stroke({ color: COLOR_NUM.cyan, width: 2, alpha: 0.8 });
        }

        if (progress < 1.0) {
          safeRAF(tick);
        } else {
          // Cubrir completamente para evitar huecos en sub-píxeles
          const fullCover = new Graphics();
          fullCover.rect(0, 0, width, height);
          fullCover.fill({ color: COLOR_NUM.inkCrypt });
          container.addChild(fullCover);
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  private animateDiagonalSlashOut(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const bladeCount = 6;
      const bladeH = (height * 1.5) / bladeCount;

      const blades: Graphics[] = [];
      for (let i = 0; i < bladeCount; i++) {
        const g = new Graphics();
        g.roundPixels = true;
        container.addChild(g);
        blades.push(g);
      }

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        // Easing: easeInCubic
        const ease = Math.pow(progress, 3);

        const travelDist = width * 1.5;

        for (let i = 0; i < bladeCount; i++) {
          const g = blades[i];
          g.clear();

          const exitLeft = i % 2 !== 0;
          const currentX = exitLeft
            ? -travelDist * ease
            : travelDist * ease;

          const y0 = i * bladeH - height * 0.25;
          const slant = 140;

          g.moveTo(currentX - (!exitLeft ? width * 1.5 : 0), y0);
          g.lineTo(currentX + (exitLeft ? width * 1.5 : width * 1.5) + slant, y0);
          g.lineTo(currentX + (exitLeft ? width * 1.5 : width * 1.5), y0 + bladeH + 4);
          g.lineTo(currentX - (!exitLeft ? width * 1.5 : 0) - slant, y0 + bladeH + 4);
          g.closePath();
          g.fill({ color: COLOR_NUM.inkCrypt });

          g.moveTo(currentX + slant, y0);
          g.lineTo(currentX, y0 + bladeH + 4);
          g.stroke({ color: COLOR_NUM.gold, width: 3, alpha: 1 - progress });
        }

        if (progress < 1.0) {
          safeRAF(tick);
        } else {
          container.removeChildren();
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  // =========================================================================
  // 2. DIAMOND SHARDS TRANSITION (Mosaico de Rombos de Cristal)
  // =========================================================================

  private animateDiamondShardsIn(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const tileSize = 64;
      const cols = Math.ceil(width / tileSize) + 2;
      const rows = Math.ceil(height / tileSize) + 2;

      const g = new Graphics();
      g.roundPixels = true;
      container.addChild(g);

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const globalProgress = Math.min(1.0, elapsed / durationMs);

        g.clear();

        const centerX = cols / 2;
        const centerY = rows / 2;
        const maxDist = Math.hypot(centerX, centerY);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (c - 0.5) * tileSize;
            const y = (r - 0.5) * tileSize;

            const dist = Math.hypot(c - centerX, r - centerY);
            const delay = (dist / maxDist) * 0.45;
            const itemProgress = Math.max(0, Math.min(1.0, (globalProgress - delay) / 0.55));
            const ease = 1 - Math.pow(1 - itemProgress, 2);

            const s = (tileSize * 1.45 * ease) / 2;
            if (s > 0.5) {
              g.moveTo(x, y - s);
              g.lineTo(x + s, y);
              g.lineTo(x, y + s);
              g.lineTo(x - s, y);
              g.closePath();
              g.fill({ color: COLOR_NUM.inkCrypt });
              if (ease < 0.95) {
                g.stroke({ color: COLOR_NUM.cyan, width: 1.5 });
              }
            }
          }
        }

        if (globalProgress < 1.0) {
          safeRAF(tick);
        } else {
          g.clear();
          g.rect(0, 0, width, height);
          g.fill({ color: COLOR_NUM.inkCrypt });
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  private animateDiamondShardsOut(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const tileSize = 64;
      const cols = Math.ceil(width / tileSize) + 2;
      const rows = Math.ceil(height / tileSize) + 2;

      const g = new Graphics();
      g.roundPixels = true;
      container.addChild(g);

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const globalProgress = Math.min(1.0, elapsed / durationMs);

        g.clear();

        const centerX = cols / 2;
        const centerY = rows / 2;
        const maxDist = Math.hypot(centerX, centerY);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (c - 0.5) * tileSize;
            const y = (r - 0.5) * tileSize;

            const dist = Math.hypot(c - centerX, r - centerY);
            const delay = (dist / maxDist) * 0.4;
            const itemProgress = Math.max(0, Math.min(1.0, (globalProgress - delay) / 0.6));
            const ease = Math.pow(itemProgress, 2);

            const s = (tileSize * 1.45 * (1 - ease)) / 2;
            if (s > 0.5) {
              g.moveTo(x, y - s);
              g.lineTo(x + s, y);
              g.lineTo(x, y + s);
              g.lineTo(x - s, y);
              g.closePath();
              g.fill({ color: COLOR_NUM.inkCrypt });
              g.stroke({ color: COLOR_NUM.gold, width: 1.5, alpha: 1 - ease });
            }
          }
        }

        if (globalProgress < 1.0) {
          safeRAF(tick);
        } else {
          container.removeChildren();
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  // =========================================================================
  // 3. RADIAL IRIS TRANSITION (Vórtice Espiral de Marioneta)
  // =========================================================================

  private animateRadialIrisIn(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.hypot(cx, cy) + 40;

      const g = new Graphics();
      g.roundPixels = true;
      container.addChild(g);

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        const ease = 1 - Math.pow(1 - progress, 2.5);

        const currentInnerRadius = maxRadius * (1 - ease);

        g.clear();
        // Dibujar máscara oscura con orificio decreciente
        g.rect(0, 0, width, height);
        g.fill({ color: COLOR_NUM.inkCrypt });
        if (currentInnerRadius > 1) {
          g.circle(cx, cy, currentInnerRadius);
          g.cut();

          // Anillo de resonancia en el borde del iris
          g.circle(cx, cy, currentInnerRadius);
          g.stroke({ color: COLOR_NUM.gold, width: 4 });
          g.circle(cx, cy, currentInnerRadius + 3);
          g.stroke({ color: COLOR_NUM.cyan, width: 2 });
        }

        if (progress < 1.0) {
          safeRAF(tick);
        } else {
          g.clear();
          g.rect(0, 0, width, height);
          g.fill({ color: COLOR_NUM.inkCrypt });
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  private animateRadialIrisOut(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.hypot(cx, cy) + 40;

      const g = new Graphics();
      g.roundPixels = true;
      container.addChild(g);

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        const ease = Math.pow(progress, 2.5);

        const currentInnerRadius = maxRadius * ease;

        g.clear();
        if (currentInnerRadius < maxRadius) {
          g.rect(0, 0, width, height);
          g.fill({ color: COLOR_NUM.inkCrypt });
          g.circle(cx, cy, currentInnerRadius);
          g.cut();

          g.circle(cx, cy, currentInnerRadius);
          g.stroke({ color: COLOR_NUM.gold, width: 3, alpha: 1 - progress });
        }

        if (progress < 1.0) {
          safeRAF(tick);
        } else {
          container.removeChildren();
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  // =========================================================================
  // 4. CURTAIN WIPE TRANSITION (Persianas Horizontales Clásicas)
  // =========================================================================

  private animateCurtainIn(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const bars = 8;
      const barH = height / bars;

      const g = new Graphics();
      g.roundPixels = true;
      container.addChild(g);

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        const ease = 1 - Math.pow(1 - progress, 2);

        g.clear();
        for (let i = 0; i < bars; i++) {
          const fromLeft = i % 2 === 0;
          const curW = width * ease;
          const x = fromLeft ? 0 : width - curW;
          const y = i * barH;

          g.rect(x, y, curW, barH + 1);
          g.fill({ color: COLOR_NUM.inkCrypt });

          const edgeX = fromLeft ? curW : width - curW;
          g.moveTo(edgeX, y);
          g.lineTo(edgeX, y + barH);
          g.stroke({ color: COLOR_NUM.gold, width: 3 });
        }

        if (progress < 1.0) {
          safeRAF(tick);
        } else {
          g.clear();
          g.rect(0, 0, width, height);
          g.fill({ color: COLOR_NUM.inkCrypt });
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  private animateCurtainOut(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      const container = this.getTransitionContainer();
      container.removeChildren();

      const width = GlobalPixiRenderer.width || 960;
      const height = GlobalPixiRenderer.height || 720;
      const bars = 8;
      const barH = height / bars;

      const g = new Graphics();
      g.roundPixels = true;
      container.addChild(g);

      const startTime = safeNow();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        const ease = Math.pow(progress, 2);

        g.clear();
        for (let i = 0; i < bars; i++) {
          const toLeft = i % 2 !== 0;
          const curW = width * (1 - ease);
          const x = toLeft ? 0 : width - curW;
          const y = i * barH;

          if (curW > 1) {
            g.rect(x, y, curW, barH + 1);
            g.fill({ color: COLOR_NUM.inkCrypt });

            const edgeX = toLeft ? curW : width - curW;
            g.moveTo(edgeX, y);
            g.lineTo(edgeX, y + barH);
            g.stroke({ color: COLOR_NUM.gold, width: 2, alpha: 1 - progress });
          }
        }

        if (progress < 1.0) {
          safeRAF(tick);
        } else {
          container.removeChildren();
          resolve();
        }
      };

      safeRAF(tick);
    });
  }

  private getTransitionContainer(): Container {
    if (GlobalPixiRenderer.transitionLayer) {
      return GlobalPixiRenderer.transitionLayer;
    }
    return GlobalPixiRenderer.stage;
  }

  private clearTransitionLayer(): void {
    if (GlobalPixiRenderer.transitionLayer) {
      GlobalPixiRenderer.transitionLayer.removeChildren();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const GlobalScreenWipeTransition = ScreenWipeTransition.getInstance();
