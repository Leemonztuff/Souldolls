import * as THREE from 'three';

export class ThreeRenderer {
  private static instance: ThreeRenderer;

  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public container!: HTMLElement;
  private resizeObserver: ResizeObserver | null = null;

  private constructor() {}

  public static getInstance(): ThreeRenderer {
    if (!ThreeRenderer.instance) {
      ThreeRenderer.instance = new ThreeRenderer();
    }
    return ThreeRenderer.instance;
  }

  public init(container: HTMLElement): void {
    this.container = container;
    const w = container.clientWidth || 960;
    const h = container.clientHeight || 720;

    // 1. Create Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14101c);
    this.scene.fog = new THREE.FogExp2(0x14101c, 0.025);

    // 2. Create Camera with HD-2D ~38° FOV
    const aspect = w / h;
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 1000);
    this.camera.position.set(0, 11, 12);
    this.camera.lookAt(0, 0.5, 0);

    // 3. Create WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(w, h, true);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Style canvas to stretch smoothly across container
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    // Clear previous children and append
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. ResizeObserver on container
    if (typeof ResizeObserver !== 'undefined') {
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cw = entry.contentRect.width;
          const ch = entry.contentRect.height;
          if (cw > 0 && ch > 0) {
            this.resize(cw, ch);
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  public resize(width: number, height: number): void {
    if (this.camera && this.renderer && width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, true);
    }
  }

  public render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public isReady(): boolean {
    return Boolean(this.renderer && this.scene && this.camera && this.container);
  }

  public clearScene(): void {
    if (!this.scene) return;
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material.dispose();
        }
      }
    }
  }
}

export const GlobalThreeRenderer = ThreeRenderer.getInstance();
