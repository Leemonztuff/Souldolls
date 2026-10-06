import { IScene } from '../scenes/IScene';
import { GlobalEventBus } from './EventBus';
import { GlobalInput } from './Input';
import { GlobalScreenWipeTransition, ScreenWipeOptions } from '../render/transition/ScreenWipeTransition';

export class SceneManager {
  private static instance: SceneManager;
  private sceneFactories: Map<string, () => IScene> = new Map();
  private sceneStack: IScene[] = [];
  private transitionQueue: Promise<void> = Promise.resolve();

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

  public hasScene(name: string): boolean {
    return this.sceneFactories.has(name);
  }

  private enqueue(op: () => Promise<void>): Promise<void> {
    this.transitionQueue = this.transitionQueue.then(op).catch((err) => {
      console.error('[SceneManager] Error in transition queue:', err);
    });
    return this.transitionQueue;
  }

  public async changeScene(name: string, params?: any): Promise<void> {
    return this.enqueue(async () => {
      try {
        GlobalInput.clearTransientStates();

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
        GlobalInput.clearTransientStates();
      } catch (err) {
        console.error(`[SceneManager] Error changing scene to "${name}":`, err);
      }
    });
  }

  public async pushScene(name: string, params?: any): Promise<void> {
    return this.enqueue(async () => {
      try {
        GlobalInput.clearTransientStates();

        const current = this.getCurrentScene();
        if (current && current.pause) {
          await current.pause();
        }

        const factory = this.sceneFactories.get(name);
        if (!factory) {
          throw new Error(`[SceneManager] Scene "${name}" is not registered.`);
        }

        const overlayScene = factory();
        this.sceneStack.push(overlayScene);
        await overlayScene.enter(params);
        GlobalInput.clearTransientStates();
      } catch (err) {
        console.error(`[SceneManager] Error pushing scene "${name}":`, err);
      }
    });
  }

  /**
   * Empuja una nueva escena aplicando un barrido de pantalla cinematográfico en PixiJS
   * (ideal para la transición del Overworld 3D al Combate 2D).
   */
  public async pushSceneWithTransition(
    name: string,
    params?: any,
    options: ScreenWipeOptions = {}
  ): Promise<void> {
    return GlobalScreenWipeTransition.executeTransition(async () => {
      await this.pushScene(name, params);
    }, options);
  }

  /**
   * Cambia de escena raíz aplicando una animación de barrido de pantalla.
   */
  public async changeSceneWithTransition(
    name: string,
    params?: any,
    options: ScreenWipeOptions = {}
  ): Promise<void> {
    return GlobalScreenWipeTransition.executeTransition(async () => {
      await this.changeScene(name, params);
    }, options);
  }

  public async popScene(): Promise<void> {
    return this.enqueue(async () => {
      if (this.sceneStack.length <= 1) return;

      try {
        GlobalInput.clearTransientStates();

        const top = this.sceneStack.pop();
        if (top) {
          await top.exit();
        }
        const current = this.getCurrentScene();
        if (current && current.resume) {
          await current.resume();
        }
        GlobalInput.clearTransientStates();
      } catch (err) {
        console.error(`[SceneManager] Error popping scene:`, err);
      }
    });
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
