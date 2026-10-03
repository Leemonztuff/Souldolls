import { IScene } from '../scenes/IScene';
import { GlobalEventBus } from './EventBus';

export class SceneManager {
  private static instance: SceneManager;
  private sceneFactories: Map<string, () => IScene> = new Map();
  private sceneStack: IScene[] = [];
  private isTransitioning = false;

  private constructor() {
    GlobalEventBus.on('scene:change', ({ sceneName, params }) => {
      this.changeScene(sceneName, params);
    });

    GlobalEventBus.on('scene:push', ({ sceneName, params }) => {
      this.pushScene(sceneName, params);
    });

    GlobalEventBus.on('scene:pop', () => {
      this.popScene();
    });
  }

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager();
    }
    return SceneManager.instance;
  }

  public registerScene(name: string, factory: () => IScene): void {
    this.sceneFactories.set(name, factory);
  }

  public async changeScene(name: string, params?: any): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    try {
      // Exit all active scenes from top to bottom
      while (this.sceneStack.length > 0) {
        const top = this.sceneStack.pop();
        if (top) {
          await top.exit();
        }
      }

      const factory = this.sceneFactories.get(name);
      if (!factory) {
        throw new Error(`[SceneManager] Scene "${name}" is not registered.`);
      }

      const nextScene = factory();
      this.sceneStack.push(nextScene);
      await nextScene.enter(params);
      this.updateTouchHudVisibility();
    } catch (err) {
      console.error(`[SceneManager] Error changing scene to "${name}":`, err);
    } finally {
      this.isTransitioning = false;
    }
  }

  public async pushScene(name: string, params?: any): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    try {
      const factory = this.sceneFactories.get(name);
      if (!factory) {
        throw new Error(`[SceneManager] Scene "${name}" is not registered.`);
      }

      const overlayScene = factory();
      this.sceneStack.push(overlayScene);
      await overlayScene.enter(params);
      this.updateTouchHudVisibility();
    } catch (err) {
      console.error(`[SceneManager] Error pushing scene "${name}":`, err);
    } finally {
      this.isTransitioning = false;
    }
  }

  public async popScene(): Promise<void> {
    if (this.isTransitioning || this.sceneStack.length <= 1) return;
    this.isTransitioning = true;

    try {
      const top = this.sceneStack.pop();
      if (top) {
        await top.exit();
      }
      const current = this.getCurrentScene();
      if (current && current.resume) {
        await current.resume();
      }
      this.updateTouchHudVisibility();
    } catch (err) {
      console.error(`[SceneManager] Error popping scene:`, err);
    } finally {
      this.isTransitioning = false;
    }
  }

  private updateTouchHudVisibility(): void {
    const topScene = this.getCurrentScene();
    const hud = document.getElementById('touch-controls-hud');
    if (hud) {
      if (topScene && topScene.name === 'Overworld') {
        hud.style.display = 'flex';
      } else {
        hud.style.display = 'none';
      }
    }
  }

  public update(dt: number): void {
    if (this.sceneStack.length === 0) return;

    // By default, update top-most scene in stack
    const topScene = this.sceneStack[this.sceneStack.length - 1];
    topScene.update(dt);
  }

  public render(alpha: number): void {
    if (this.sceneStack.length === 0) return;

    // Render stack from bottom to top for transparent overlays
    for (let i = 0; i < this.sceneStack.length; i++) {
      this.sceneStack[i].render(alpha);
    }
  }

  public onResize(width: number, height: number): void {
    for (let i = 0; i < this.sceneStack.length; i++) {
      this.sceneStack[i].onResize?.(width, height);
    }
  }

  public getCurrentScene(): IScene | null {
    return this.sceneStack.length > 0 ? this.sceneStack[this.sceneStack.length - 1] : null;
  }
}

export const GlobalSceneManager = SceneManager.getInstance();
