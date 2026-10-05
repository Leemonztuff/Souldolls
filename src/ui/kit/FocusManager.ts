import { Container, Graphics } from 'pixi.js';
import { COLOR_NUM } from '../styles';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalInput } from '../../core/Input';

export interface FocusableElement {
  container: Container;
  onActivate: () => void;
  onStep?: (dir: -1 | 1) => void;
  disabled?: boolean;
  width: number;
  height: number;
}

/**
 * BLOQUE 41 Req 6: Gestor de foco unificado con anillo dorado visible.
 * Soporta navegación por teclado/D-pad (Flechas/WASD, CONFIRM, CANCEL) y puntero táctil en paralelo.
 */
export class FocusManager {
  private items: FocusableElement[] = [];
  private currentIndex = 0;
  private focusRing: Graphics = new Graphics();

  public register(item: FocusableElement): void {
    this.items.push(item);
    if (this.items.length === 1) {
      this.setFocus(0, false);
    }
  }

  public clear(): void {
    this.items = [];
    this.currentIndex = 0;
    if (this.focusRing.parent) {
      this.focusRing.parent.removeChild(this.focusRing);
    }
  }

  public setFocus(index: number, playSound = true): void {
    if (this.items.length === 0) return;
    const clamped = (index + this.items.length) % this.items.length;
    this.currentIndex = clamped;

    const target = this.items[this.currentIndex];
    if (!target || !target.container || target.container.destroyed) return;

    if (playSound) {
      GlobalAudioService.playSfx('select');
    }

    this.focusRing.clear();
    this.focusRing.roundRect(-3, -3, target.width + 6, target.height + 6, 8);
    this.focusRing.stroke({ color: COLOR_NUM.gold, width: 2.5 });
    target.container.addChild(this.focusRing);
  }

  public move(delta: number): void {
    if (this.items.length === 0) return;
    this.setFocus(this.currentIndex + delta, true);
  }

  public stepCurrent(dir: -1 | 1): boolean {
    const cur = this.items[this.currentIndex];
    if (cur && cur.onStep && !cur.disabled) {
      GlobalAudioService.playSfx('select');
      cur.onStep(dir);
      return true;
    }
    return false;
  }

  public activateCurrent(): void {
    const cur = this.items[this.currentIndex];
    if (!cur) return;
    if (cur.disabled) {
      GlobalAudioService.playSfx('cancel');
      return;
    }
    GlobalAudioService.playSfx('confirm');
    cur.onActivate();
  }

  public update(): void {
    if (this.items.length === 0) return;

    if (GlobalInput.justPressed('UP')) {
      this.move(-1);
    } else if (GlobalInput.justPressed('DOWN')) {
      this.move(1);
    } else if (GlobalInput.justPressed('LEFT')) {
      if (!this.stepCurrent(-1)) {
        this.move(-1);
      }
    } else if (GlobalInput.justPressed('RIGHT')) {
      if (!this.stepCurrent(1)) {
        this.move(1);
      }
    } else if (GlobalInput.justPressed('CONFIRM')) {
      this.activateCurrent();
    }
  }
}
