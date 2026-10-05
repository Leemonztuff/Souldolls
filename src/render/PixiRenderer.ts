import { Application, Container, TextureSource } from 'pixi.js';

export class PixiRenderer {
  private static instance: PixiRenderer;

  public app!: Application;
  public container!: HTMLElement;

  // Root UI Layers
  public stage!: Container;
  public worldUiLayer!: Container;
  public hudLayer!: Container;
  public menuLayer!: Container;
  public dialogueLayer!: Container;
  public transitionLayer!: Container;

  public width = 960;
  public height = 720;
  public resolution = 1;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): PixiRenderer {
    if (!PixiRenderer.instance) {
      PixiRenderer.instance = new PixiRenderer();
    }
    return PixiRenderer.instance;
  }

  public async init(container: HTMLElement, width = 960, height = 720): Promise<void> {
    if (this.isInitialized) return;

    this.container = container;
    this.width = Math.max(320, Math.round(width || window.innerWidth || 960));
    this.height = Math.max(240, Math.round(height || window.innerHeight || 720));
    this.resolution = Math.min(window.devicePixelRatio || 1, 3);

    // Configurar valores por defecto de texturas PixiJS v8 para pixel-art nítido
    TextureSource.defaultOptions.scaleMode = 'nearest';
    TextureSource.defaultOptions.autoGenerateMipmaps = false;

    this.app = new Application();
    await this.app.init({
      width: this.width,
      height: this.height,
      backgroundAlpha: 0, // Transparent overlay over Three.js canvas
      resolution: this.resolution,
      autoDensity: true,
      antialias: false,
      roundPixels: true,
    });

    this.stage = this.app.stage;

    // Create organized layers
    this.worldUiLayer = new Container();
    this.worldUiLayer.label = 'worldUiLayer';

    this.hudLayer = new Container();
    this.hudLayer.label = 'hudLayer';

    this.menuLayer = new Container();
    this.menuLayer.label = 'menuLayer';

    this.dialogueLayer = new Container();
    this.dialogueLayer.label = 'dialogueLayer';

    this.transitionLayer = new Container();
    this.transitionLayer.label = 'transitionLayer';

    this.stage.addChild(
      this.worldUiLayer,
      this.hudLayer,
      this.menuLayer,
      this.dialogueLayer,
      this.transitionLayer
    );

    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.display = 'block';
    canvas.style.imageRendering = 'pixelated';

    this.container.innerHTML = '';
    this.container.appendChild(canvas);

    this.isInitialized = true;
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(320, Math.round(width || window.innerWidth || 960));
    this.height = Math.max(240, Math.round(height || window.innerHeight || 720));
    this.resolution = Math.min(window.devicePixelRatio || 1, 3);

    if (this.app && this.app.renderer) {
      this.app.renderer.resolution = this.resolution;
      this.app.renderer.resize(this.width, this.height);
    }
  }

  public clearAllLayers(): void {
    if (!this.isInitialized) return;
    this.worldUiLayer.removeChildren();
    this.hudLayer.removeChildren();
    this.menuLayer.removeChildren();
    this.dialogueLayer.removeChildren();
    this.transitionLayer.removeChildren();
  }

  public render(): void {
    if (this.isInitialized && this.app && this.app.renderer) {
      this.app.renderer.render(this.stage);
    }
  }

  public isReady(): boolean {
    return Boolean(this.isInitialized && this.app && this.app.renderer && this.stage);
  }
}

export const GlobalPixiRenderer = PixiRenderer.getInstance();
