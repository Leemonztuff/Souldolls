import { GameLoop } from './GameLoop';
import { GlobalSceneManager } from './SceneManager';
import { GlobalInput } from './Input';
import { GlobalEventBus } from './EventBus';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { BootScene } from '../scenes/BootScene';
import { TitleScene } from '../scenes/TitleScene';
import { DebugScene } from '../scenes/DebugScene';
import { OverworldScene } from '../scenes/OverworldScene';
import { QuestLogScene } from '../scenes/QuestLogScene';
import { BattleScene } from '../scenes/BattleScene';
import { EvolutionScene } from '../scenes/EvolutionScene';
import { PokedexScene } from '../scenes/PokedexScene';
import { ShopScene } from '../scenes/ShopScene';
import { StorageBoxScene } from '../scenes/StorageBoxScene';
import { CreditsScene } from '../scenes/CreditsScene';
import { CreatureDetailScene } from '../scenes/CreatureDetailScene';
import { WorkshopScene } from '../scenes/WorkshopScene';
import { SoulBindingScene } from '../scenes/SoulBindingScene';
import { DataValidator } from '../data/validation/DataValidator';

export class Game {
  private static instance: Game;

  private gameContainer!: HTMLElement;
  private threeContainer!: HTMLElement;
  private pixiContainer!: HTMLElement;

  private gameLoop!: GameLoop;
  private targetWidth = 960;
  private targetHeight = 720;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // 0. Validate Data Layer Integrity (failing fast if schema or links are invalid)
    DataValidator.validateAll();

    // 1. Locate DOM containers
    this.gameContainer = document.getElementById('game-container') as HTMLElement;
    this.threeContainer = document.getElementById('three-container') as HTMLElement;
    this.pixiContainer = document.getElementById('pixi-container') as HTMLElement;

    if (!this.gameContainer || !this.threeContainer || !this.pixiContainer) {
      throw new Error('[Game] Required game canvas container elements were not found in DOM.');
    }

    // 2. Initialize Three.js (Background 3D)
    GlobalThreeRenderer.init(this.threeContainer);

    // 3. Initialize PixiJS v8 (Foreground 2D / UI)
    await GlobalPixiRenderer.init(this.pixiContainer, this.targetWidth, this.targetHeight);

    // 4. Generate & Cache all procedural Pixel Art Assets
    GlobalAssetRegistry.init();

    // 5. Initialize Touch Controls Overlay
    GlobalInput.mountTouchControls(this.gameContainer);

    // 6. Register Scenes
    GlobalSceneManager.registerScene('Boot', () => new BootScene());
    GlobalSceneManager.registerScene('Title', () => new TitleScene());
    GlobalSceneManager.registerScene('Debug', () => new DebugScene());
    GlobalSceneManager.registerScene('Overworld', () => new OverworldScene());
    GlobalSceneManager.registerScene('QuestLog', () => new QuestLogScene());
    GlobalSceneManager.registerScene('Battle', () => new BattleScene());
    GlobalSceneManager.registerScene('Evolution', () => new EvolutionScene());
    GlobalSceneManager.registerScene('Pokedex', () => new PokedexScene());
    GlobalSceneManager.registerScene('Shop', () => new ShopScene());
    GlobalSceneManager.registerScene('StorageBox', () => new StorageBoxScene());
    GlobalSceneManager.registerScene('CreatureDetail', () => new CreatureDetailScene());
    GlobalSceneManager.registerScene('Workshop', () => new WorkshopScene());
    GlobalSceneManager.registerScene('SoulBinding', () => new SoulBindingScene());
    GlobalSceneManager.registerScene('Credits', () => new CreditsScene());

    // 7. Debug Toggle Shortcut Handler
    GlobalEventBus.on('debug:toggle', () => {
      const current = GlobalSceneManager.getCurrentScene();
      if (current && current.name === 'Debug') {
        GlobalSceneManager.popScene();
      } else {
        GlobalSceneManager.pushScene('Debug');
      }
    });

    // 8. Handle Responsive Letterboxing
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // 9. Setup Central Loop
    this.gameLoop = new GameLoop(
      (fixedDt) => this.onLogicUpdate(fixedDt),
      (alpha) => this.onRender(alpha)
    );

    // 10. Start Initial Scene & GameLoop
    await GlobalSceneManager.changeScene('Boot');
    this.gameLoop.start();

    this.isInitialized = true;
    console.log('[Game] Engine initialized successfully with procedural art assets.');
  }

  /**
   * Fixed 60Hz logic update tick
   */
  private onLogicUpdate(dt: number): void {
    GlobalSceneManager.update(dt);
    GlobalInput.update();
  }

  /**
   * Variable rendering tick
   */
  private onRender(alpha: number): void {
    GlobalSceneManager.render(alpha);
    GlobalThreeRenderer.render();
    GlobalPixiRenderer.render();
  }

  /**
   * Maintains automatic responsive scaling and updates renderers
   */
  private handleResize(): void {
    GlobalThreeRenderer.resize(this.targetWidth, this.targetHeight);
    GlobalPixiRenderer.resize(this.targetWidth, this.targetHeight);
    GlobalSceneManager.onResize(this.targetWidth, this.targetHeight);
  }
}

export const GlobalGame = Game.getInstance();
