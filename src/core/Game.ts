import { GameLoop } from './GameLoop';
import { GlobalSceneManager } from './SceneManager';
import { GlobalInput } from './Input';
import { GlobalEventBus } from './EventBus';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { BootScene } from '../scenes/BootScene';
import { TitleScene } from '../scenes/TitleScene';
import { OverworldScene } from '../scenes/OverworldScene';
import { QuestLogScene } from '../scenes/QuestLogScene';
import { BattleScene } from '../scenes/BattleScene';
import { EvolutionScene } from '../scenes/EvolutionScene';
import { PokedexScene } from '../scenes/PokedexScene';
import { ShopScene } from '../scenes/ShopScene';
import { StorageBoxScene } from '../scenes/StorageBoxScene';
import { CreditsScene } from '../scenes/CreditsScene';
import { CreatureDetailScene } from '../scenes/CreatureDetailScene';
import { PartyScene } from '../scenes/PartyScene';
import { BagScene } from '../scenes/BagScene';
import { WorkshopScene } from '../scenes/WorkshopScene';
import { SoulBindingScene } from '../scenes/SoulBindingScene';
import { GachaResonanceScene } from '../scenes/GachaResonanceScene';
import { OptionsScene } from '../ui/hud/OptionsScene';
import { DataValidator } from '../data/validation/DataValidator';
import { SoulCodexSystem } from '../systems/SoulCodexSystem';
import { GachaService } from '../systems/gacha';
import { isDebugEnabled } from './DebugGate';

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

    // 0. Initialize Codex listeners (DataValidator & AssetRegistry run progressively inside BootScene)
    SoulCodexSystem.initEventListeners();
    (window as any).GachaService = GachaService;

    // 1. Locate DOM containers
    this.gameContainer = document.getElementById('game-container') as HTMLElement;
    this.threeContainer = document.getElementById('three-container') as HTMLElement;
    this.pixiContainer = document.getElementById('pixi-container') as HTMLElement;

    if (!this.gameContainer || !this.threeContainer || !this.pixiContainer) {
      throw new Error('[Game] Required game canvas container elements were not found in DOM.');
    }

    // 2. Initialize Three.js (Background 3D)
    GlobalThreeRenderer.init(this.threeContainer);

    // 3. Initialize PixiJS v8 (Foreground 2D / UI) matching exact container dimensions (no CSS upscaling)
    const initialW = Math.max(320, Math.round(this.gameContainer.clientWidth || window.innerWidth || this.targetWidth));
    const initialH = Math.max(480, Math.round(this.gameContainer.clientHeight || window.innerHeight || this.targetHeight));
    this.targetWidth = initialW;
    this.targetHeight = initialH;
    await GlobalPixiRenderer.init(this.pixiContainer, this.targetWidth, this.targetHeight);

    // 4. Optional automated test suites: only run in DEV when explicitly requested via ?runTests=1
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('runTests') === '1') {
      setTimeout(async () => {
        try {
          const [
            gachaMod,
            b35Mod,
            b46Mod,
            b43Mod,
            b44Mod,
            b45Mod,
          ] = await Promise.all([
            import('../systems/gacha'),
            import('../systems/lab/Bloque35LabTestRunner'),
            import('../systems/lab/Bloque46StarterUiTestRunner'),
            import('../ui/hud/Bloque43HudTestRunner'),
            import('../render/overworld/Bloque44TilesetTestRunner'),
            import('../render/overworld/Bloque45MapgenTestRunner'),
          ]);
          gachaMod.GachaTestRunner.runAllTests();
          gachaMod.Bloque28BQrTestRunner.runAllTests();
          b35Mod.Bloque35LabTestRunner.runAllTests();
          b46Mod.Bloque46StarterUiTestRunner.runAllTests();
          b43Mod.Bloque43HudTestRunner.runAllTests();
          b44Mod.Bloque44TilesetTestRunner.runAllTests();
          b45Mod.Bloque45MapgenTestRunner.runAllTests();
        } catch (err) {
          console.error('[TestRunners] Error in automated suite:', err);
        }
      }, 200);
    }

    // 5. Initialize Touch Controls Overlay
    GlobalInput.mountTouchControls(this.gameContainer);

    // 6. Register Scenes
    GlobalSceneManager.registerScene('Boot', () => new BootScene());
    GlobalSceneManager.registerScene('Title', () => new TitleScene());
    GlobalSceneManager.registerScene('Overworld', () => new OverworldScene());
    GlobalSceneManager.registerScene('QuestLog', () => new QuestLogScene());
    GlobalSceneManager.registerScene('Battle', () => new BattleScene());
    GlobalSceneManager.registerScene('Evolution', () => new EvolutionScene());
    GlobalSceneManager.registerScene('Pokedex', () => new PokedexScene());
    GlobalSceneManager.registerScene('Shop', () => new ShopScene());
    GlobalSceneManager.registerScene('StorageBox', () => new StorageBoxScene());
    GlobalSceneManager.registerScene('Party', () => new PartyScene());
    GlobalSceneManager.registerScene('Bag', () => new BagScene());
    GlobalSceneManager.registerScene('CreatureDetail', () => new CreatureDetailScene());
    GlobalSceneManager.registerScene('Workshop', () => new WorkshopScene());
    GlobalSceneManager.registerScene('SoulBinding', () => new SoulBindingScene());
    GlobalSceneManager.registerScene('GachaResonance', () => new GachaResonanceScene());
    GlobalSceneManager.registerScene('Options', () => new OptionsScene());
    GlobalSceneManager.registerScene('Credits', () => new CreditsScene());

    // 7. Debug Toggle Shortcut Handler (Bloque 43 Req. 2: Dynamic import only when DEBUG is active)
    GlobalEventBus.on('debug:toggle', async () => {
      if (!isDebugEnabled()) return;
      const current = GlobalSceneManager.getCurrentScene() as any;
      if (current && current.name === 'Battle' && typeof current.toggleDebugOverlay === 'function') {
        current.toggleDebugOverlay();
        return;
      }
      if (current && current.name === 'Debug') {
        GlobalSceneManager.popScene();
      } else {
        try {
          const mod = await import('../scenes/DebugScene');
          GlobalSceneManager.registerScene('Debug', () => new mod.DebugScene());
          GlobalSceneManager.pushScene('Debug');
        } catch (err) {
          console.warn('[Game] Optional DebugScene could not be loaded:', err);
        }
      }
    });

    // 8. Handle Responsive Viewport with shared ResizeObserver (Bloque 43 Req. 7)
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.handleResize());
      ro.observe(this.gameContainer);
    }

    // 9. Setup & Start Central Loop immediately so BootScene renders its first frame without waiting
    this.gameLoop = new GameLoop(
      (fixedDt) => this.onLogicUpdate(fixedDt),
      (alpha) => this.onRender(alpha)
    );
    this.gameLoop.start();

    // 10. Enter Initial BootScene
    await GlobalSceneManager.changeScene('Boot');

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
    const w = Math.max(320, Math.round(this.gameContainer?.clientWidth || window.innerWidth || this.targetWidth));
    const h = Math.max(240, Math.round(this.gameContainer?.clientHeight || window.innerHeight || this.targetHeight));
    this.targetWidth = w;
    this.targetHeight = h;
    GlobalThreeRenderer.resize(w, h);
    GlobalPixiRenderer.resize(w, h);
    GlobalSceneManager.onResize(w, h);
  }
}

export const GlobalGame = Game.getInstance();
