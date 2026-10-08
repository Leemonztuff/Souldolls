import * as THREE from 'three';
import { GlobalTallerAtlas, AtlasFrame } from './TallerAtlas';
import { GlobalMercadoAtlas, MercadoAtlasFrame } from './MercadoAtlas';
import { GlobalOverworldDecor, DecorAtlasFrame, QualityProfile } from './DecorRenderer';
import { GlobalTileRenderer } from './TileRenderer';
import { GlobalThreeRenderer } from '../ThreeRenderer';
import { MapData } from '../../types/maps';

type AtlasTabType = 'taller' | 'mercado' | 'decor';

export class AtlasDebugOverlay {
  private static instance: AtlasDebugOverlay;

  private isVisible = false;
  private overlayContainer: HTMLElement | null = null;
  private worldLabelsContainer: HTMLElement | null = null;
  private decorPanelContainer: HTMLElement | null = null;
  private telemetryEl: HTMLElement | null = null;
  private tileInspectorEl: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Active atlas tab: 'taller', 'mercado', or 'decor'
  private currentAtlas: AtlasTabType = 'decor';
  private atlasImg: HTMLImageElement | null = null;

  // Dragging state
  private activeFrame: string | null = null;
  private dragHandle: 'move' | 'left' | 'right' | 'top' | 'bottom' | null = null;
  private dragStartPos = { x: 0, y: 0 };
  private initialFrameState: AtlasFrame | MercadoAtlasFrame | DecorAtlasFrame | null = null;

  // 3D camera, map & scene tracking for world labels & tile rules inspector (Req. 8)
  private trackedCamera: THREE.Camera | null = null;
  private trackedObjects: { mesh: THREE.Mesh; label: string; footprint?: string }[] = [];
  private currentMap: MapData | null = null;
  private inspectedTileX = 6;
  private inspectedTileZ = 8;

  private constructor() {
    this.setupKeybindings();
  }

  public static getInstance(): AtlasDebugOverlay {
    if (!AtlasDebugOverlay.instance) {
      AtlasDebugOverlay.instance = new AtlasDebugOverlay();
    }
    return AtlasDebugOverlay.instance;
  }

  private setupKeybindings(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Raycast mouse move to inspect tile under cursor when F2 is open
    window.addEventListener('mousemove', (e) => {
      if (!this.isVisible || !this.trackedCamera || !this.currentMap) return;
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
      const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.trackedCamera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectPt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, intersectPt)) {
        const tx = Math.round(intersectPt.x);
        const tz = Math.round(intersectPt.z);
        if (tx >= 0 && tx < this.currentMap.width && tz >= 0 && tz < this.currentMap.height) {
          this.inspectedTileX = tx;
          this.inspectedTileZ = tz;
        }
      }
    });
  }

  public setMapContext(map: MapData, playerTileX: number, playerTileZ: number): void {
    this.currentMap = map;
    if (!this.isVisible) {
      this.inspectedTileX = playerTileX;
      this.inspectedTileZ = playerTileZ;
    }
  }

  public registerTrackedObject(mesh: THREE.Mesh, frameName: string, footprint?: string): void {
    this.trackedObjects.push({ mesh, label: frameName, footprint });
  }

  public clearTrackedObjects(): void {
    this.trackedObjects = [];
  }

  public setCamera(camera: THREE.Camera): void {
    this.trackedCamera = camera;
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.isVisible) {
      this.mount();
    } else {
      this.unmount();
    }
  }

  private getActiveAtlasData(): {
    image: string;
    size: [number, number] | { w: number; h: number };
    ppu?: number;
    frames: Record<string, any>;
  } {
    if (this.currentAtlas === 'taller') return GlobalTallerAtlas.atlasData;
    if (this.currentAtlas === 'mercado') return GlobalMercadoAtlas.atlasData;
    return GlobalOverworldDecor.atlasData;
  }

  private mount(): void {
    if (this.overlayContainer) return;

    // 1. World Labels Overlay (projects frame name & collision footprint over each map object)
    this.worldLabelsContainer = document.createElement('div');
    this.worldLabelsContainer.id = 'atlas-world-labels';
    this.worldLabelsContainer.style.position = 'fixed';
    this.worldLabelsContainer.style.inset = '0';
    this.worldLabelsContainer.style.pointerEvents = 'none';
    this.worldLabelsContainer.style.zIndex = '9998';
    document.body.appendChild(this.worldLabelsContainer);

    // 2. Main Atlas Visualizer Modal
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'atlas-debug-modal';
    this.overlayContainer.style.position = 'fixed';
    this.overlayContainer.style.inset = '0';
    this.overlayContainer.style.backgroundColor = 'rgba(10, 8, 16, 0.90)';
    this.overlayContainer.style.backdropFilter = 'blur(6px)';
    this.overlayContainer.style.zIndex = '9999';
    this.overlayContainer.style.display = 'flex';
    this.overlayContainer.style.flexDirection = 'column';
    this.overlayContainer.style.fontFamily = 'monospace';
    this.overlayContainer.style.color = '#f1f5f9';
    this.overlayContainer.style.userSelect = 'none';

    // Header Bar
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '10px 20px';
    header.style.background = '#1e1b2e';
    header.style.borderBottom = '2px solid #e8b84a';

    const titleArea = document.createElement('div');
    titleArea.style.display = 'flex';
    titleArea.style.alignItems = 'center';
    titleArea.style.gap = '10px';

    const title = document.createElement('div');
    title.innerHTML = '<strong>🛠 ATLAS & DECOR DEBUGGER (F2)</strong>';
    title.style.color = '#e8b84a';
    title.style.fontSize = '14px';
    titleArea.appendChild(title);

    const createTabBtn = (id: AtlasTabType, label: string) => {
      const btn = document.createElement('button');
      btn.innerText = label;
      btn.style.padding = '4px 10px';
      btn.style.borderRadius = '4px';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.fontWeight = 'bold';
      const active = this.currentAtlas === id;
      btn.style.background = active ? '#e8b84a' : '#334155';
      btn.style.color = active ? '#000' : '#fff';
      btn.onclick = () => {
        this.currentAtlas = id;
        this.atlasImg = null;
        this.unmount();
        this.mount();
      };
      return btn;
    };

    titleArea.appendChild(createTabBtn('taller', '🛠 Taller (B33)'));
    titleArea.appendChild(createTabBtn('mercado', '🏛 Mercado (B34)'));
    titleArea.appendChild(createTabBtn('decor', '🌿 Decorados (B36)'));
    header.appendChild(titleArea);

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '10px';

    // Copy JSON Button
    const copyBtn = document.createElement('button');
    copyBtn.innerText = '📋 Copiar JSON Actualizado';
    copyBtn.style.padding = '6px 14px';
    copyBtn.style.background = '#0284c7';
    copyBtn.style.color = '#ffffff';
    copyBtn.style.border = 'none';
    copyBtn.style.borderRadius = '4px';
    copyBtn.style.cursor = 'pointer';
    copyBtn.style.fontWeight = 'bold';
    copyBtn.onclick = () => {
      const activeData = this.getActiveAtlasData();
      const exportJson = {
        image: activeData.image,
        size: activeData.size,
        ppu: activeData.ppu,
        frames: activeData.frames,
      };
      const jsonStr = JSON.stringify(exportJson, null, 2);
      navigator.clipboard.writeText(jsonStr).then(() => {
        copyBtn.innerText = '✅ ¡Copiado al Portapapeles!';
        setTimeout(() => (copyBtn.innerText = '📋 Copiar JSON Actualizado'), 2000);
      });
    };

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕ Cerrar (F2)';
    closeBtn.style.padding = '6px 14px';
    closeBtn.style.background = '#e11d48';
    closeBtn.style.color = '#ffffff';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => this.toggle();

    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(closeBtn);
    header.appendChild(btnGroup);
    this.overlayContainer.appendChild(header);

    // Warning Banner for Background Check
    const warningBanner = document.createElement('div');
    warningBanner.id = 'atlas-warning-banner';
    warningBanner.style.display = 'none';
    warningBanner.style.padding = '8px 20px';
    warningBanner.style.background = '#7f1d1d';
    warningBanner.style.color = '#fecaca';
    warningBanner.style.borderBottom = '1px solid #ef4444';
    warningBanner.style.fontSize = '12px';
    warningBanner.innerHTML =
      '⚠️ <strong>AVISO:</strong> Se ha detectado fondo falso opaco en el atlas. Ejecuta <code>npm run prepare:atlas</code>.';
    this.overlayContainer.appendChild(warningBanner);

    // Main Content Area (Left: Atlas Canvas, Right: Bloque 36 Decor Controls & Telemetry)
    const bodyWrap = document.createElement('div');
    bodyWrap.style.display = 'flex';
    bodyWrap.style.flex = '1';
    bodyWrap.style.overflow = 'hidden';

    // Canvas container
    const canvasWrap = document.createElement('div');
    canvasWrap.style.flex = '1';
    canvasWrap.style.overflow = 'auto';
    canvasWrap.style.position = 'relative';
    canvasWrap.style.padding = '20px';

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    canvasWrap.appendChild(this.canvas);
    bodyWrap.appendChild(canvasWrap);

    // Bloque 36 Req. 8: Side Panel for Decor Controls, Layer Toggles, Sliders, Seed & Tile Inspector
    this.decorPanelContainer = document.createElement('div');
    this.decorPanelContainer.style.width = '360px';
    this.decorPanelContainer.style.background = '#141220';
    this.decorPanelContainer.style.borderLeft = '1px solid #334155';
    this.decorPanelContainer.style.padding = '16px';
    this.decorPanelContainer.style.overflowY = 'auto';
    this.decorPanelContainer.style.display = 'flex';
    this.decorPanelContainer.style.flexDirection = 'column';
    this.decorPanelContainer.style.gap = '14px';

    this.buildDecorControlPanel(this.decorPanelContainer);
    bodyWrap.appendChild(this.decorPanelContainer);

    this.overlayContainer.appendChild(bodyWrap);
    document.body.appendChild(this.overlayContainer);

    this.setupCanvasInteractions();
    this.loadAtlasImage();
  }

  private buildDecorControlPanel(panel: HTMLElement): void {
    // 1. Live Telemetry Box (Instances, Chunks, Draw Calls)
    const telemetryBox = document.createElement('div');
    telemetryBox.style.background = '#1e293b';
    telemetryBox.style.padding = '10px 12px';
    telemetryBox.style.borderRadius = '6px';
    telemetryBox.style.border = '1px solid #38bdf8';
    this.telemetryEl = telemetryBox;
    panel.appendChild(telemetryBox);

    // 2. Seed & Quality Controls
    const seedRow = document.createElement('div');
    seedRow.style.display = 'flex';
    seedRow.style.gap = '8px';
    seedRow.style.alignItems = 'center';

    const seedBtn = document.createElement('button');
    seedBtn.innerText = `🎲 Nueva Semilla (${GlobalOverworldDecor.mapSeed})`;
    seedBtn.style.flex = '1';
    seedBtn.style.padding = '7px 10px';
    seedBtn.style.background = '#10b981';
    seedBtn.style.color = '#000';
    seedBtn.style.fontWeight = 'bold';
    seedBtn.style.border = 'none';
    seedBtn.style.borderRadius = '4px';
    seedBtn.style.cursor = 'pointer';
    seedBtn.onclick = () => {
      GlobalOverworldDecor.mapSeed = Math.floor(Math.random() * 90000) + 10000;
      seedBtn.innerText = `🎲 Nueva Semilla (${GlobalOverworldDecor.mapSeed})`;
      GlobalOverworldDecor.rebuildCurrentMap();
      this.updateWorldLabels();
    };
    seedRow.appendChild(seedBtn);
    panel.appendChild(seedRow);

    // Bloque 44 Req. 5: Modo "plano clásico" (debug): dibuja todo plano sobre el suelo como en RPG Maker
    const flatModeBtn = document.createElement('button');
    const isFlat = GlobalTileRenderer.isClassicFlatMode();
    flatModeBtn.innerText = `📐 Modo Plano Clásico (B44): ${isFlat ? 'ACTIVO' : 'OFF'}`;
    flatModeBtn.style.padding = '7px 10px';
    flatModeBtn.style.background = isFlat ? '#e8b84a' : '#334155';
    flatModeBtn.style.color = isFlat ? '#000' : '#fff';
    flatModeBtn.style.fontWeight = 'bold';
    flatModeBtn.style.border = 'none';
    flatModeBtn.style.borderRadius = '4px';
    flatModeBtn.style.cursor = 'pointer';
    flatModeBtn.onclick = () => {
      const nextFlat = GlobalTileRenderer.toggleClassicFlatMode();
      flatModeBtn.innerText = `📐 Modo Plano Clásico (B44): ${nextFlat ? 'ACTIVO' : 'OFF'}`;
      flatModeBtn.style.background = nextFlat ? '#e8b84a' : '#334155';
      flatModeBtn.style.color = nextFlat ? '#000' : '#fff';
      if ((window as any).__activeMapRenderer) {
        (window as any).__activeMapRenderer.rebuildCurrentMap();
      }
    };
    panel.appendChild(flatModeBtn);

    // Botón de Vista Aérea Completa de la Aldea (F2)
    const aerialBtn = document.createElement('button');
    aerialBtn.innerText = '🔭 Vista Aérea Aldea (Referencia F2)';
    aerialBtn.style.padding = '7px 10px';
    aerialBtn.style.background = '#0284c7';
    aerialBtn.style.color = '#fff';
    aerialBtn.style.fontWeight = 'bold';
    aerialBtn.style.border = 'none';
    aerialBtn.style.borderRadius = '4px';
    aerialBtn.style.cursor = 'pointer';
    aerialBtn.onclick = () => {
      if (this.trackedCamera) {
        this.trackedCamera.position.set(14.5, 26, 20);
        this.trackedCamera.lookAt(14.5, 0, 11.5);
      }
    };
    panel.appendChild(aerialBtn);

    // Bloque 45 Req. 1: Flujo obligatorio de autoría por mapa en 6 etapas (con vista y captura en F2)
    const b45Title = document.createElement('div');
    b45Title.innerHTML = '<strong>🗺 FLUJO DE AUTORÍA EN 6 ETAPAS (B45)</strong>';
    b45Title.style.color = '#e8b84a';
    b45Title.style.fontSize = '12px';
    panel.appendChild(b45Title);

    const stageLabels: Array<{ stage: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string }> = [
      { stage: 0, label: '✨ Completo' },
      { stage: 1, label: '1. Blockout Gris' },
      { stage: 2, label: '2. Caminos/Hitos' },
      { stage: 3, label: '3. Edificios/Stamps' },
      { stage: 4, label: '4. Terreno/Grupos' },
      { stage: 5, label: '5. Decorado' },
      { stage: 6, label: '6. Iluminación' },
    ];

    const stageGrid = document.createElement('div');
    stageGrid.style.display = 'grid';
    stageGrid.style.gridTemplateColumns = '1fr 1fr';
    stageGrid.style.gap = '5px';

    stageLabels.forEach(({ stage, label }) => {
      const sBtn = document.createElement('button');
      const isCur = GlobalTileRenderer.getAuthoringStage() === stage;
      sBtn.innerText = label;
      sBtn.style.padding = '5px 6px';
      sBtn.style.fontSize = '11px';
      sBtn.style.fontWeight = 'bold';
      sBtn.style.border = 'none';
      sBtn.style.borderRadius = '4px';
      sBtn.style.cursor = 'pointer';
      sBtn.style.background = isCur ? '#38bdf8' : '#1e293b';
      sBtn.style.color = isCur ? '#000' : '#e2e8f0';
      sBtn.onclick = () => {
        GlobalTileRenderer.setAuthoringStage(stage);
        if ((window as any).__activeMapRenderer) {
          (window as any).__activeMapRenderer.rebuildCurrentMap();
        }
        this.unmount();
        this.mount();
      };
      stageGrid.appendChild(sBtn);
    });
    panel.appendChild(stageGrid);

    // Quality Profile Selector (Bajo / Medio / Alto)
    const qualityRow = document.createElement('div');
    qualityRow.style.display = 'flex';
    qualityRow.style.gap = '6px';
    (['Bajo', 'Medio', 'Alto'] as QualityProfile[]).forEach((q) => {
      const qBtn = document.createElement('button');
      qBtn.innerText = `Calidad: ${q}`;
      qBtn.style.flex = '1';
      qBtn.style.padding = '5px';
      qBtn.style.border = 'none';
      qBtn.style.borderRadius = '4px';
      qBtn.style.cursor = 'pointer';
      qBtn.style.fontSize = '11px';
      qBtn.style.fontWeight = 'bold';
      const isAct = GlobalOverworldDecor.qualityProfile === q;
      qBtn.style.background = isAct ? '#e8b84a' : '#334155';
      qBtn.style.color = isAct ? '#000' : '#fff';
      qBtn.onclick = () => {
        GlobalOverworldDecor.qualityProfile = q;
        GlobalOverworldDecor.rebuildCurrentMap();
        this.unmount();
        this.mount();
      };
      qualityRow.appendChild(qBtn);
    });
    panel.appendChild(qualityRow);

    // 3. Layer Toggles (flores, hierba, hongos, glow, luciérnagas)
    const layersTitle = document.createElement('div');
    layersTitle.innerHTML = '<strong>👁 CAPAS VISIBLES</strong>';
    layersTitle.style.color = '#e8b84a';
    layersTitle.style.fontSize = '12px';
    panel.appendChild(layersTitle);

    const layersGrid = document.createElement('div');
    layersGrid.style.display = 'grid';
    layersGrid.style.gridTemplateColumns = '1fr 1fr';
    layersGrid.style.gap = '6px';

    const layerDefs: Array<{ key: 'grass' | 'flowers' | 'mushrooms' | 'glow' | 'fireflies'; label: string }> = [
      { key: 'grass', label: '🌿 Hierba' },
      { key: 'flowers', label: '🌸 Flores' },
      { key: 'mushrooms', label: '🍄 Hongos' },
      { key: 'glow', label: '✨ Glow Aditivo' },
      { key: 'fireflies', label: '🔥 Luciérnagas' },
    ];

    layerDefs.forEach(({ key, label }) => {
      const lbl = document.createElement('label');
      lbl.style.display = 'flex';
      lbl.style.alignItems = 'center';
      lbl.style.gap = '6px';
      lbl.style.background = '#1e293b';
      lbl.style.padding = '6px 8px';
      lbl.style.borderRadius = '4px';
      lbl.style.cursor = 'pointer';
      lbl.style.fontSize = '11px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = GlobalOverworldDecor.layerVisibility[key];
      cb.onchange = () => {
        GlobalOverworldDecor.setLayerVisible(key, cb.checked);
      };

      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(label));
      layersGrid.appendChild(lbl);
    });
    panel.appendChild(layersGrid);

    // 4. Density Sliders per Biome Rule
    const slidersTitle = document.createElement('div');
    slidersTitle.innerHTML = '<strong>🎚 DENSIDAD POR REGLA (BIOMA ACTUAL)</strong>';
    slidersTitle.style.color = '#e8b84a';
    slidersTitle.style.fontSize = '12px';
    panel.appendChild(slidersTitle);

    const biome = this.currentMap ? GlobalOverworldDecor.getBiomeForMap(this.currentMap) : null;
    if (biome) {
      biome.rules.forEach((rule) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '2px';
        row.style.background = '#1e293b';
        row.style.padding = '6px 8px';
        row.style.borderRadius = '4px';

        const curMult = GlobalOverworldDecor.ruleDensityMultipliers[rule.id] ?? 1.0;
        const top = document.createElement('div');
        top.style.display = 'flex';
        top.style.justifyContent = 'space-between';
        top.style.fontSize = '11px';
        const valSpan = document.createElement('span');
        valSpan.style.color = '#38bdf8';
        valSpan.innerText = `${(rule.density * curMult).toFixed(1)}/tile (${Math.round(curMult * 100)}%)`;
        top.innerHTML = `<span>${rule.id}</span>`;
        top.appendChild(valSpan);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '2.5';
        slider.step = '0.1';
        slider.value = String(curMult);
        slider.oninput = () => {
          const v = parseFloat(slider.value);
          GlobalOverworldDecor.ruleDensityMultipliers[rule.id] = v;
          valSpan.innerText = `${(rule.density * v).toFixed(1)}/tile (${Math.round(v * 100)}%)`;
          GlobalOverworldDecor.rebuildCurrentMap();
        };

        row.appendChild(top);
        row.appendChild(slider);
        panel.appendChild(row);
      });
    }

    // 5. Cursor / Player Tile Rules Inspector
    const inspectorBox = document.createElement('div');
    inspectorBox.style.background = '#0f172a';
    inspectorBox.style.padding = '10px';
    inspectorBox.style.borderRadius = '6px';
    inspectorBox.style.border = '1px solid #a855f7';
    inspectorBox.style.fontSize = '11px';
    this.tileInspectorEl = inspectorBox;
    panel.appendChild(inspectorBox);
  }

  private unmount(): void {
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
    if (this.worldLabelsContainer) {
      this.worldLabelsContainer.remove();
      this.worldLabelsContainer = null;
    }
    this.decorPanelContainer = null;
    this.telemetryEl = null;
    this.tileInspectorEl = null;
    this.canvas = null;
    this.ctx = null;
  }

  private loadAtlasImage(): void {
    const activeData = this.getActiveAtlasData();
    const imgPath = activeData.image?.startsWith('/')
      ? activeData.image
      : `/assets/atlases/${activeData.image}`;

    if (!this.atlasImg) {
      this.atlasImg = new Image();
      this.atlasImg.src = imgPath;
      this.atlasImg.onload = () => {
        this.checkBackgroundOpaque();
        this.renderCanvas();
      };
    } else {
      this.checkBackgroundOpaque();
      this.renderCanvas();
    }
  }

  private checkBackgroundOpaque(): void {
    if (!this.atlasImg || !this.atlasImg.complete || this.atlasImg.naturalWidth === 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.atlasImg.naturalWidth;
    tempCanvas.height = this.atlasImg.naturalHeight;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return;

    tCtx.drawImage(this.atlasImg, 0, 0);
    const samplePoints = [
      [5, 5],
      [this.atlasImg.naturalWidth - 5, 5],
      [5, 440],
    ];
    let opaqueCount = 0;
    for (const [sx, sy] of samplePoints) {
      const pixel = tCtx.getImageData(sx, sy, 1, 1).data;
      if (pixel[3] > 240) opaqueCount++;
    }

    const banner = document.getElementById('atlas-warning-banner');
    if (banner) {
      banner.style.display = opaqueCount === samplePoints.length ? 'block' : 'none';
    }
  }

  private renderCanvas(): void {
    if (!this.canvas || !this.ctx) return;

    const activeData = this.getActiveAtlasData();
    const size = activeData.size;
    const W = Array.isArray(size) ? size[0] : size.w;
    const H = Array.isArray(size) ? size[1] : size.h;
    this.canvas.width = W;
    this.canvas.height = H;

    // Draw dark checkerboard background
    const sq = 16;
    for (let y = 0; y < H; y += sq) {
      for (let x = 0; x < W; x += sq) {
        this.ctx.fillStyle = (x / sq + y / sq) % 2 === 0 ? '#1e293b' : '#0f172a';
        this.ctx.fillRect(x, y, sq, sq);
      }
    }

    if (this.atlasImg && this.atlasImg.complete && this.atlasImg.naturalWidth > 0) {
      this.ctx.drawImage(this.atlasImg, 0, 0, W, H);
    }

    const frames = activeData.frames;
    const colors = ['#38bdf8', '#4ade80', '#f472b6', '#facc15', '#a78bfa', '#fb923c', '#2dd4bf'];
    let idx = 0;

    for (const [name, frame] of Object.entries(frames)) {
      const color = this.activeFrame === name ? '#ffffff' : colors[idx % colors.length];
      idx++;

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

      this.ctx.fillStyle = color;
      this.ctx.fillRect(frame.x, Math.max(0, frame.y - 16), frame.w, 16);
      this.ctx.fillStyle = '#000000';
      this.ctx.font = 'bold 10px monospace';
      const ppuStr = frame.ppu ? `@${frame.ppu}` : '';
      this.ctx.fillText(`${name} (${frame.w}x${frame.h}${ppuStr})`, frame.x + 3, Math.max(11, frame.y - 4));
    }
  }

  private setupCanvasInteractions(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = this.hitTest(mx, my);
      if (hit) {
        this.activeFrame = hit.name;
        this.dragHandle = hit.handle;
        this.dragStartPos = { x: mx, y: my };
        const activeData = this.getActiveAtlasData();
        this.initialFrameState = { ...activeData.frames[hit.name] };
        this.renderCanvas();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.activeFrame || !this.dragHandle || !this.initialFrameState || !this.canvas) return;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = Math.round(mx - this.dragStartPos.x);
      const dy = Math.round(my - this.dragStartPos.y);

      const activeData = this.getActiveAtlasData();
      const frame = { ...activeData.frames[this.activeFrame] };
      const init = this.initialFrameState;

      switch (this.dragHandle) {
        case 'move':
          frame.x = Math.max(0, init.x + dx);
          frame.y = Math.max(0, init.y + dy);
          break;
        case 'left':
          frame.x = Math.max(0, init.x + dx);
          frame.w = Math.max(8, init.w - dx);
          break;
        case 'right':
          frame.w = Math.max(8, init.w + dx);
          break;
        case 'top':
          frame.y = Math.max(0, init.y + dy);
          frame.h = Math.max(8, init.h - dy);
          break;
        case 'bottom':
          frame.h = Math.max(8, init.h + dy);
          break;
      }

      if (this.currentAtlas === 'taller') {
        GlobalTallerAtlas.updateFrameRect(this.activeFrame, frame);
      } else if (this.currentAtlas === 'mercado') {
        GlobalMercadoAtlas.updateFrameRect(this.activeFrame, frame);
      } else {
        GlobalOverworldDecor.updateFrameRect(this.activeFrame, frame);
      }
      this.renderCanvas();
    });

    window.addEventListener('mouseup', () => {
      this.activeFrame = null;
      this.dragHandle = null;
      this.initialFrameState = null;
    });
  }

  private hitTest(x: number, y: number): { name: string; handle: 'move' | 'left' | 'right' | 'top' | 'bottom' } | null {
    const margin = 8;
    const activeData = this.getActiveAtlasData();
    const frames = activeData.frames;

    for (const [name, frame] of Object.entries(frames)) {
      if (
        x >= frame.x - margin &&
        x <= frame.x + frame.w + margin &&
        y >= frame.y - margin &&
        y <= frame.y + frame.h + margin
      ) {
        if (Math.abs(x - frame.x) <= margin) return { name, handle: 'left' };
        if (Math.abs(x - (frame.x + frame.w)) <= margin) return { name, handle: 'right' };
        if (Math.abs(y - frame.y) <= margin) return { name, handle: 'top' };
        if (Math.abs(y - (frame.y + frame.h)) <= margin) return { name, handle: 'bottom' };
        return { name, handle: 'move' };
      }
    }
    return null;
  }

  /**
   * Updates 3D world labels, draw calls telemetry, and tile rule inspector when F2 overlay is active (Req. 8)
   */
  public updateWorldLabels(): void {
    if (!this.isVisible) return;

    // Update Telemetry Counter (Instances, Chunks, Draw Calls)
    if (this.telemetryEl) {
      const drawCalls = GlobalThreeRenderer.renderer?.info?.render?.calls ?? 0;
      const triangles = GlobalThreeRenderer.renderer?.info?.render?.triangles ?? 0;
      this.telemetryEl.innerHTML = `
        <div style="color:#38bdf8;font-weight:bold;margin-bottom:4px">📊 RENDIMIENTO OVERWORLD (B36)</div>
        <div>• Instancias Decor: <strong>${GlobalOverworldDecor.totalInstancesCount}</strong></div>
        <div>• Chunks (16x16): <strong>${GlobalOverworldDecor.activeChunksCount}</strong></div>
        <div>• WebGL Draw Calls: <strong>${drawCalls}</strong> (${triangles} tris)</div>
      `;
    }

    // Update Tile Rules Inspector under cursor / player
    if (this.tileInspectorEl && this.currentMap) {
      const tx = this.inspectedTileX;
      const tz = this.inspectedTileZ;
      const gType = this.currentMap.ground[tz]?.[tx] || 'none';
      const isEnc = this.currentMap.encounters?.[tz]?.[tx] === 'tall_grass';
      const rules = GlobalOverworldDecor.getRulesForTile(this.currentMap, tx, tz);
      const biome = GlobalOverworldDecor.getBiomeForMap(this.currentMap);

      this.tileInspectorEl.innerHTML = `
        <div style="color:#c084fc;font-weight:bold;margin-bottom:4px">🔍 INSPECTOR DE TILE (${tx}, ${tz})</div>
        <div>• Bioma: <strong>${biome?.biome || 'interior'}</strong> (Tex: <code>${biome?.groundTextureId || 'n/a'}</code>)</div>
        <div>• Suelo: <strong>${gType}</strong> | Encuentro: <strong>${isEnc ? 'SÍ (Hierba Alta)' : 'No'}</strong></div>
        <div style="margin-top:4px;color:#94a3b8">Reglas aplicables (${rules.length}):</div>
        <div style="color:#4ade80">${rules.length > 0 ? rules.map((r) => `✓ ${r}`).join('<br/>') : 'Ninguna (bloqueado/camino)'}</div>
      `;
    }

    if (!this.worldLabelsContainer || !this.trackedCamera) return;

    this.worldLabelsContainer.innerHTML = '';
    const tempVec = new THREE.Vector3();

    this.trackedObjects.forEach(({ mesh, label, footprint }) => {
      if (!mesh.parent) return;
      mesh.getWorldPosition(tempVec);
      tempVec.y += 1.1;
      tempVec.project(this.trackedCamera!);

      if (tempVec.z > 1 || tempVec.z < -1) return;

      const sx = ((tempVec.x + 1) * window.innerWidth) / 2;
      const sy = ((-tempVec.y + 1) * window.innerHeight) / 2;

      const badge = document.createElement('div');
      const footprintBadge = footprint ? ` <span style="color:#fcd34d;font-size:10px">[${footprint}]</span>` : '';
      badge.innerHTML = `<strong>${label}</strong>${footprintBadge}`;
      badge.style.position = 'absolute';
      badge.style.left = `${Math.round(sx)}px`;
      badge.style.top = `${Math.round(sy)}px`;
      badge.style.transform = 'translate(-50%, -100%)';
      badge.style.background = 'rgba(23, 23, 37, 0.92)';
      badge.style.color = '#38bdf8';
      badge.style.border = '1px solid #38bdf8';
      badge.style.fontSize = '11px';
      badge.style.padding = '3px 7px';
      badge.style.borderRadius = '4px';
      badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.6)';
      badge.style.pointerEvents = 'none';
      this.worldLabelsContainer!.appendChild(badge);
    });
  }
}

export const GlobalAtlasDebugOverlay = AtlasDebugOverlay.getInstance();
