/**
 * BLOQUE 47 (Paso 3): Editor Visual de Primitivas de Mapa (/tools/mapgen/ui/index.ts)
 * - 100% Vanilla TypeScript + Canvas 2D, sin librerías nuevas.
 * - Solo se carga mediante import() dinámico cuando import.meta.env.DEV es true y ?mapgen=1 está activo
 *   (o se abre en modo dev). En producción es eliminado por tree-shaking (I-12).
 * - Usa exclusivamente el núcleo puro /src/systems/mapgen (schema, stamps, bake, validate) y MapLoader/WorldGraph
 *   para sincronizar cambios en vivo con el juego 3D.
 */

import aldeaMarionetaSrc from '../../../src/data/maps/src/aldea_marioneta.map.json';
import {
  BakedCellType,
  BakedMapGrid,
  bakeMap,
  BiomeId,
  BorderMaterial,
  LandmarkRole,
  MapGenLandmark,
  MapGenPatch,
  MapGenPath,
  MapGenRegion,
  MapGenStampInstance,
  MapSourceSchemaV1,
  MapValidationReport,
  PatchType,
  PathRank,
  PathSurface,
  resolveRotatedStamp,
  RULE_STAGE_MAP,
   sampleCatmullRomSpline,
  STAMP_LIBRARY,
  StampRotation,
  validateMap,
  validateMapSourceSchema,
  ValidationRuleId,
} from '../../../src/systems/mapgen';
import { WorldGraph } from '../../../src/data/maps/worldGraph';
import { MapLoader } from '../../../src/data/maps/MapLoader';
import { GlobalSceneManager } from '../../../src/core/SceneManager';

type EditorStage = 1 | 2 | 3 | 4 | 5 | 6;
type ToolId = 'select' | 'region' | 'path' | 'patch' | 'stamp' | 'landmark';
type RightTabId = 'inspect' | 'layers' | 'issues' | 'map';

interface SelectionRef {
  kind: 'region' | 'path' | 'patch' | 'stamp' | 'landmark';
  id: string;
  vertexIndex?: number;
}

interface LayerVisibility {
  bakedTiles: boolean;
  blockedTiles: boolean;
  grid: boolean;
  regions: boolean;
  paths: boolean;
  patches: boolean;
  stamps: boolean;
  landmarks: boolean;
  validatorMarkers: boolean;
  windows9x13: boolean;
  cursorWindow9x13: boolean;
  playerScaleSilhouette: boolean;
}

const STORAGE_AUTOSAVE_KEY = 'souldolls_mapgen_autosave_v1';

const STAGE_DEFS: Record<
  EditorStage,
  { title: string; subtitle: string; description: string }
> = {
  1: {
    title: '1. Blockout',
    subtitle: 'regions',
    description: 'Define organic regions and outer border thickness/material in grayscale blockout.',
  },
  2: {
    title: '2. Paths & landmarks',
    subtitle: 'paths, landmarks',
    description: 'Trace Catmull-Rom spline roads (main/secondary/trail) and place spawn, exits and focal landmarks.',
  },
  3: {
    title: '3. Buildings & stamps',
    subtitle: 'stamps',
    description: 'Place architectural stamps (Workshop, Market, Lab, Houses, Plaza) with doors and approach tiles.',
  },
  4: {
    title: '4. Terrain & patches',
    subtitle: 'patches',
    description: 'Organic tall grass, flowers, clearings, gardens and lakes.',
  },
  5: {
    title: '5. Decor (scatter)',
    subtitle: 'not edited here',
    description: 'Read-only preview of biome scatter rules (trees, rocks, tufts) managed by B36 DecorRenderer.',
  },
  6: {
    title: '6. Lighting',
    subtitle: 'not edited here',
    description: 'Read-only preview of directional sunlight, contact shadows and warm window glow.',
  },
};

const CELL_COLORS_NORMAL: Record<BakedCellType, string> = {
  void: '#1a382c',
  ground: '#52b765',
  path_main: '#a67b4b',
  path_secondary: '#b88652',
  path_trail: '#c69868',
  water: '#2b7de0',
  tall_grass: '#2d8a47',
  flowers: '#68cf75',
  clearing: '#7ce087',
  garden: '#7e6d44',
  border: '#1c3b2e',
  stamp_block: '#64748b',
  stamp_walk: '#93c5fd',
  door: '#facc15',
};

const CELL_COLORS_BLOCKOUT: Record<BakedCellType, string> = {
  void: '#18181b',
  ground: '#52525b',
  path_main: '#a1a1aa',
  path_secondary: '#71717a',
  path_trail: '#71717a',
  water: '#27272a',
  tall_grass: '#3f3f46',
  flowers: '#52525b',
  clearing: '#64748b',
  garden: '#52525b',
  border: '#27272a',
  stamp_block: '#d4d4d8',
  stamp_walk: '#94a3b8',
  door: '#fde047',
};

const STAMP_FILL_COLORS: Record<string, { fill: string; stroke: string; shortLabel: string }> = {
  workshop: { fill: 'rgba(38, 132, 150, 0.78)', stroke: '#38bdf8', shortLabel: 'Taller' },
  market: { fill: 'rgba(229, 158, 66, 0.82)', stroke: '#7dd3fc', shortLabel: 'Mercado' },
  lab: { fill: 'rgba(139, 104, 219, 0.82)', stroke: '#7dd3fc', shortLabel: 'Laboratorio' },
  house_small: { fill: 'rgba(196, 134, 84, 0.82)', stroke: '#7dd3fc', shortLabel: 'House' },
  house_medium: { fill: 'rgba(196, 134, 84, 0.82)', stroke: '#7dd3fc', shortLabel: 'House' },
  fountain_plaza: { fill: 'rgba(138, 196, 255, 0.85)', stroke: '#93c5fd', shortLabel: 'Plaza' },
  well: { fill: 'rgba(148, 163, 184, 0.78)', stroke: '#93c5fd', shortLabel: 'Well' },
  statue: { fill: 'rgba(203, 213, 225, 0.82)', stroke: '#93c5fd', shortLabel: 'Statue' },
  garden_plot: { fill: 'rgba(134, 179, 125, 0.72)', stroke: '#7dd3fc', shortLabel: 'Garden' },
  bridge: { fill: 'rgba(180, 125, 75, 0.82)', stroke: '#fde047', shortLabel: 'Bridge' },
  stone_gate: { fill: 'rgba(186, 194, 222, 0.78)', stroke: '#93c5fd', shortLabel: 'North' },
  cave_entrance: { fill: 'rgba(100, 116, 139, 0.85)', stroke: '#93c5fd', shortLabel: 'Cave' },
};

const LANDMARK_COLORS: Record<LandmarkRole, { bg: string; letter: string }> = {
  spawn: { bg: '#2dd4bf', letter: 'S' },
  exit: { bg: '#60a5fa', letter: 'E' },
  focus: { bg: '#facc15', letter: 'F' },
  rest: { bg: '#67e8f9', letter: 'R' },
  secret: { bg: '#c084fc', letter: '?' },
  danger: { bg: '#f87171', letter: '!' },
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class MapGenEditorUI {
  private rootEl: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private doc: MapSourceSchemaV1;
  private baked!: BakedMapGrid;
  private report!: MapValidationReport;

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private dragSnapshotBefore: string | null = null;

  private currentStage: EditorStage = 4;
  private currentTool: ToolId = 'select';
  private activeRightTab: RightTabId = 'inspect';
  private snapToGrid = true;

  // Creación interactiva de Región / Camino y colocación de Stamp / Landmark
  private draftPoints: [number, number][] = [];
  private activeStampPrefabId = 'workshop';
  private activeStampRotation: StampRotation = 0;
  private activeLandmarkRole: LandmarkRole = 'focus';
  private activePatchType: PatchType = 'flowers';
  private activePathRank: PathRank = 'secondary';

  // Selección y arrastre
  private selected: SelectionRef | null = null;
  private isPanning = false;
  private isSpaceDown = false;
  private dragMode:
    | 'none'
    | 'pan'
    | 'move-primitive'
    | 'move-vertex'
    | 'resize-patch' = 'none';
  private dragStartMouse = { x: 0, y: 0 };
  private dragStartMapTile = { x: 0, y: 0 };
  private dragOrigData: any = null;

  // Viewport (zoom y paneo)
  private zoomPxPerTile = 16;
  private panX = 48;
  private panY = 24;
  private hoverTile: { x: number; y: number } | null = null;

  private layers: LayerVisibility = {
    bakedTiles: true,
    blockedTiles: false,
    grid: true,
    regions: true,
    paths: true,
    patches: true,
    stamps: true,
    landmarks: true,
    validatorMarkers: true,
    windows9x13: false,
    cursorWindow9x13: false,
    playerScaleSilhouette: false,
  };

  // Referencias DOM para actualización sin parpadeos
  private topUndoBtn!: HTMLButtonElement;
  private topRedoBtn!: HTMLButtonElement;
  private stageBarContainer!: HTMLDivElement;
  private stageSummaryText!: HTMLSpanElement;
  private toolsListContainer!: HTMLDivElement;
  private rightTabsHeader!: HTMLDivElement;
  private rightPanelBody!: HTMLDivElement;
  private statusBarEl!: HTMLDivElement;
  private modalOverlayEl!: HTMLDivElement;
  private hiddenFileInput!: HTMLInputElement;

  constructor() {
    this.doc = this.loadInitialDocument();
    this.rebakeAndValidate();

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'mapgen-editor-root';
    Object.assign(this.rootEl.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '99999',
      backgroundColor: '#16131d',
      color: '#e2dce8',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '12px',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      overflow: 'hidden',
    });

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;

    this.buildDOM();
    document.body.appendChild(this.rootEl);

    this.bindEvents();
    this.fitView();
    this.refreshUI();
  }

  private loadInitialDocument(): MapSourceSchemaV1 {
    try {
      const saved = localStorage.getItem(STORAGE_AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validateMapSourceSchema(parsed).valid) {
          return parsed;
        }
      }
    } catch (_) {}
    return deepClone(aldeaMarionetaSrc as unknown as MapSourceSchemaV1);
  }

  private saveToAutosave(): void {
    try {
      localStorage.setItem(STORAGE_AUTOSAVE_KEY, JSON.stringify(this.doc));
    } catch (_) {}
  }

  private pushUndoSnapshot(snapshotJson?: string): void {
    const snap = snapshotJson ?? JSON.stringify(this.doc);
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snap) {
      return;
    }
    this.undoStack.push(snap);
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }

  private undo(): void {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.doc));
    const prev = this.undoStack.pop()!;
    this.doc = JSON.parse(prev);
    this.selected = null;
    this.rebakeAndValidate();
    this.refreshUI();
  }

  private redo(): void {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.doc));
    const next = this.redoStack.pop()!;
    this.doc = JSON.parse(next);
    this.selected = null;
    this.rebakeAndValidate();
    this.refreshUI();
  }

  private rebakeAndValidate(): void {
    this.baked = bakeMap(this.doc);
    this.report = validateMap(this.doc, this.baked, 4);
    this.saveToAutosave();
    // Sincronizar en caliente el mapa editado con el WorldGraph del juego
    try {
      WorldGraph.registerMap(this.doc);
    } catch (_) {}
  }

  private isToolUnlockedInStage(tool: ToolId, stage: EditorStage): boolean {
    if (tool === 'select') return true;
    if (stage >= 5) return false; // Etapas 5 y 6 son solo vista
    if (tool === 'region') return stage >= 1;
    if (tool === 'path' || tool === 'landmark') return stage >= 2;
    if (tool === 'stamp') return stage >= 3;
    if (tool === 'patch') return stage >= 4;
    return false;
  }

  // ==========================================================================
  // DOM CONSTRUCTION
  // ==========================================================================

  private buildDOM(): void {
    // 1. TOP BAR
    const topBar = document.createElement('div');
    Object.assign(topBar.style, {
      height: '38px',
      backgroundColor: '#1d1826',
      borderBottom: '1px solid #2e263d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      flexShrink: '0',
    });

    const leftTop = document.createElement('div');
    Object.assign(leftTop.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    const brandTitle = document.createElement('span');
    brandTitle.textContent = 'mapgen · dev';
    Object.assign(brandTitle.style, {
      color: '#fbbf24',
      fontWeight: 'bold',
      fontSize: '13px',
      marginRight: '8px',
    });
    leftTop.appendChild(brandTitle);

    this.topUndoBtn = this.makeButton('Undo', () => this.undo());
    this.topRedoBtn = this.makeButton('Redo', () => this.redo());
    const fitBtn = this.makeButton('Fit', () => {
      this.fitView();
      this.renderCanvas();
    });
    leftTop.append(this.topUndoBtn, this.topRedoBtn, fitBtn);

    const rightTop = document.createElement('div');
    Object.assign(rightTop.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    const newBtn = this.makeButton('New', () => this.createNewBlankMap());
    const openBtn = this.makeButton('Open...', () => this.hiddenFileInput.click());
    const saveBtn = this.makeButton('Save source', () => this.downloadSourceJson());
    const copyBtn = this.makeButton('Copy JSON', () => this.copySourceJsonToClipboard());
    const exportBakedBtn = this.makeButton('Export baked', () => this.downloadBakedJson());
    const snapshotBtn = this.makeButton('Snapshot PNG', () => this.exportStagePng());
    const playInGameBtn = this.makeButton(
      'Play in Game ▶',
      () => this.applyAndPlayInGame(),
      '#14532d',
      '#4ade80'
    );

    rightTop.append(newBtn, openBtn, saveBtn, copyBtn, exportBakedBtn, snapshotBtn, playInGameBtn);
    topBar.append(leftTop, rightTop);

    // 2. STAGE STEPPER BAR
    const stageWrapper = document.createElement('div');
    Object.assign(stageWrapper.style, {
      height: '44px',
      backgroundColor: '#191521',
      borderBottom: '1px solid #2e263d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: '8px',
      flexShrink: '0',
    });

    const prevStageBtn = this.makeButton('◀ Prev', () => this.requestStageChange((this.currentStage - 1) as EditorStage));
    const nextStageBtn = this.makeButton('Next ▶', () => this.requestStageChange((this.currentStage + 1) as EditorStage));

    this.stageBarContainer = document.createElement('div');
    Object.assign(this.stageBarContainer.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });

    this.stageSummaryText = document.createElement('span');
    Object.assign(this.stageSummaryText.style, {
      color: '#9ca3af',
      marginLeft: '10px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });

    stageWrapper.append(prevStageBtn, this.stageBarContainer, nextStageBtn, this.stageSummaryText);

    // 3. MAIN WORKSPACE (Left Tools | Center Canvas | Right Inspector/Layers/Issues/Map)
    const workspace = document.createElement('div');
    Object.assign(workspace.style, {
      flex: '1',
      display: 'flex',
      minHeight: '0',
      position: 'relative',
    });

    // 3A. Left Column (Tools + Options)
    const leftPanel = document.createElement('div');
    Object.assign(leftPanel.style, {
      width: '138px',
      backgroundColor: '#191521',
      borderRight: '1px solid #2e263d',
      padding: '10px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      flexShrink: '0',
    });

    const toolsHeader = document.createElement('div');
    toolsHeader.textContent = 'TOOLS';
    Object.assign(toolsHeader.style, {
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#9ca3af',
      letterSpacing: '0.06em',
    });

    this.toolsListContainer = document.createElement('div');
    Object.assign(this.toolsListContainer.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
    });

    const optionsHeader = document.createElement('div');
    optionsHeader.textContent = 'OPTIONS';
    Object.assign(optionsHeader.style, {
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#9ca3af',
      letterSpacing: '0.06em',
      marginTop: '6px',
    });

    const snapLabel = document.createElement('label');
    Object.assign(snapLabel.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      cursor: 'pointer',
      color: '#d1d5db',
    });
    const snapCheck = document.createElement('input');
    snapCheck.type = 'checkbox';
    snapCheck.checked = this.snapToGrid;
    snapCheck.onchange = () => {
      this.snapToGrid = snapCheck.checked;
    };
    const snapSpan = document.createElement('span');
    snapSpan.textContent = 'snap to grid';
    snapLabel.append(snapCheck, snapSpan);

    const helpHint = document.createElement('div');
    helpHint.textContent =
      'Space+drag or middle mouse: pan. Wheel: zoom. Shift+click on a selected region/path: insert vertex. R: rotate stamp. Del: delete.';
    Object.assign(helpHint.style, {
      color: '#8b849c',
      fontSize: '11px',
      lineHeight: '1.45',
      marginTop: '4px',
    });

    leftPanel.append(toolsHeader, this.toolsListContainer, optionsHeader, snapLabel, helpHint);

    // 3B. Center Canvas Area
    const canvasContainer = document.createElement('div');
    Object.assign(canvasContainer.style, {
      flex: '1',
      position: 'relative',
      backgroundColor: '#120f17',
      overflow: 'hidden',
    });
    Object.assign(this.canvas.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      cursor: 'crosshair',
    });
    canvasContainer.appendChild(this.canvas);

    // 3C. Right Panel (Tabs: inspect | layers | issues | map)
    const rightPanel = document.createElement('div');
    Object.assign(rightPanel.style, {
      width: '285px',
      backgroundColor: '#191521',
      borderLeft: '1px solid #2e263d',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: '0',
    });

    this.rightTabsHeader = document.createElement('div');
    Object.assign(this.rightTabsHeader.style, {
      display: 'flex',
      borderBottom: '1px solid #2e263d',
      height: '34px',
    });

    this.rightPanelBody = document.createElement('div');
    Object.assign(this.rightPanelBody.style, {
      flex: '1',
      padding: '12px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    });

    rightPanel.append(this.rightTabsHeader, this.rightPanelBody);
    workspace.append(leftPanel, canvasContainer, rightPanel);

    // 4. STATUS BAR
    this.statusBarEl = document.createElement('div');
    Object.assign(this.statusBarEl.style, {
      height: '26px',
      backgroundColor: '#15111c',
      borderTop: '1px solid #2e263d',
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      padding: '0 12px',
      color: '#a199b3',
      fontSize: '12px',
      flexShrink: '0',
    });

    // 5. MODAL OVERLAY (Stage advance validation gate)
    this.modalOverlayEl = document.createElement('div');
    Object.assign(this.modalOverlayEl.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(10, 8, 16, 0.78)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '100005',
    });

    // Hidden file input for Open JSON
    this.hiddenFileInput = document.createElement('input');
    this.hiddenFileInput.type = 'file';
    this.hiddenFileInput.accept = '.json';
    this.hiddenFileInput.style.display = 'none';
    this.hiddenFileInput.onchange = () => this.handleFileImport();

    this.rootEl.append(topBar, stageWrapper, workspace, this.statusBarEl, this.modalOverlayEl, this.hiddenFileInput);
  }

  private makeButton(
    label: string,
    onClick: () => void,
    bgColor = '#251f33',
    borderColor = '#3a3150'
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      backgroundColor: bgColor,
      color: '#e2dce8',
      border: `1px solid ${borderColor}`,
      borderRadius: '4px',
      padding: '4px 10px',
      fontSize: '12px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    });
    btn.onclick = onClick;
    return btn;
  }

  // ==========================================================================
  // STAGE TRANSITIONS & VALIDATOR GATE DIALOG
  // ==========================================================================

  private requestStageChange(targetStage: EditorStage): void {
    if (targetStage < 1 || targetStage > 6 || targetStage === this.currentStage) return;

    // Retroceder es libre
    if (targetStage < this.currentStage) {
      this.setStage(targetStage);
      return;
    }

    // Avanzar ejecuta el validador con las reglas obligatorias hasta targetStage
    const checkStage = Math.min(4, targetStage) as 1 | 2 | 3 | 4;
    const stageReport = validateMap(this.doc, this.baked, checkStage);
    const blockingErrors = stageReport.issues.filter(
      (iss) => iss.severity === 'error' && iss.stage <= checkStage
    );

    if (blockingErrors.length > 0) {
      this.showStageGateDialog(targetStage, blockingErrors);
      return;
    }

    this.setStage(targetStage);
  }

  private setStage(stage: EditorStage): void {
    this.currentStage = stage;
    this.draftPoints = [];
    if (!this.isToolUnlockedInStage(this.currentTool, stage)) {
      this.currentTool = 'select';
    }
    this.refreshUI();
  }

  private showStageGateDialog(targetStage: EditorStage, errors: MapValidationReport['issues']): void {
    this.modalOverlayEl.innerHTML = '';
    this.modalOverlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: '460px',
      backgroundColor: '#1e192b',
      border: '1px solid #f87171',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
    });

    const title = document.createElement('div');
    title.textContent = `⚠ Problemas detectados antes de avanzar a Etapa ${targetStage}`;
    Object.assign(title.style, {
      color: '#f87171',
      fontWeight: 'bold',
      fontSize: '14px',
    });

    const desc = document.createElement('div');
    desc.textContent = `Se encontraron ${errors.length} error(es) de validación obligatorios hasta esta etapa:`;
    desc.style.color = '#cbd5e1';

    const list = document.createElement('ul');
    Object.assign(list.style, {
      margin: '0',
      paddingLeft: '18px',
      maxHeight: '180px',
      overflowY: 'auto',
      color: '#fca5a5',
      lineHeight: '1.5',
    });
    for (const err of errors) {
      const li = document.createElement('li');
      li.textContent = `[${err.ruleId}] (${err.x}, ${err.y}): ${err.message}`;
      list.appendChild(li);
    }

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '8px',
      marginTop: '6px',
    });

    const viewIssuesBtn = this.makeButton(
      'Ver problemas',
      () => {
        this.modalOverlayEl.style.display = 'none';
        this.activeRightTab = 'issues';
        this.refreshUI();
      },
      '#7f1d1d',
      '#f87171'
    );

    const proceedAnywayBtn = this.makeButton('Avanzar igualmente', () => {
      this.modalOverlayEl.style.display = 'none';
      this.setStage(targetStage);
    });

    actions.append(viewIssuesBtn, proceedAnywayBtn);
    card.append(title, desc, list, actions);
    this.modalOverlayEl.appendChild(card);
  }

  // ==========================================================================
  // UI REFRESH (STAGE BAR, TOOLS, RIGHT PANEL, STATUS BAR)
  // ==========================================================================

  private refreshUI(): void {
    this.topUndoBtn.disabled = this.undoStack.length === 0;
    this.topUndoBtn.style.opacity = this.undoStack.length === 0 ? '0.45' : '1';
    this.topRedoBtn.disabled = this.redoStack.length === 0;
    this.topRedoBtn.style.opacity = this.redoStack.length === 0 ? '0.45' : '1';

    // 1. Stage Bar
    this.stageBarContainer.innerHTML = '';
    ([1, 2, 3, 4, 5, 6] as EditorStage[]).forEach((st) => {
      const def = STAGE_DEFS[st];
      const active = this.currentStage === st;
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        backgroundColor: active ? '#f5c242' : '#221c2e',
        color: active ? '#181320' : '#c4bdd0',
        border: active ? '1px solid #fde047' : '1px solid #352c47',
        borderRadius: '5px',
        padding: '3px 10px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        lineHeight: '1.15',
      });
      const line1 = document.createElement('span');
      line1.textContent = def.title;
      line1.style.fontWeight = 'bold';
      line1.style.fontSize = '11px';

      const line2 = document.createElement('span');
      line2.textContent = def.subtitle;
      line2.style.fontSize = '10px';
      line2.style.opacity = active ? '0.85' : '0.65';

      btn.append(line1, line2);
      btn.onclick = () => this.requestStageChange(st);
      this.stageBarContainer.appendChild(btn);
    });
    this.stageSummaryText.textContent = STAGE_DEFS[this.currentStage].description;

    // 2. Tools List
    this.toolsListContainer.innerHTML = '';
    const tools: { id: ToolId; label: string; shortcut: string }[] = [
      { id: 'select', label: 'Select / move', shortcut: 'V' },
      { id: 'region', label: 'Region', shortcut: 'G' },
      { id: 'path', label: 'Path', shortcut: 'P' },
      { id: 'patch', label: 'Patch', shortcut: 'B' },
      { id: 'stamp', label: 'Stamp', shortcut: 'S' },
      { id: 'landmark', label: 'Landmark', shortcut: 'L' },
    ];

    for (const t of tools) {
      const unlocked = this.isToolUnlockedInStage(t.id, this.currentStage);
      const active = this.currentTool === t.id;
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        backgroundColor: active ? '#f5c242' : '#231d30',
        color: active ? '#16131d' : unlocked ? '#e2dce8' : '#585068',
        border: active ? '1px solid #fde047' : '1px solid #352c47',
        borderRadius: '4px',
        padding: '6px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: unlocked ? 'pointer' : 'not-allowed',
        fontFamily: 'inherit',
        fontWeight: active ? 'bold' : 'normal',
        fontSize: '12px',
      });
      const lbl = document.createElement('span');
      lbl.textContent = t.label;
      const key = document.createElement('span');
      key.textContent = t.shortcut;
      key.style.opacity = '0.75';
      btn.append(lbl, key);
      btn.onclick = () => {
        if (!unlocked) return;
        this.currentTool = t.id;
        this.draftPoints = [];
        this.refreshUI();
      };
      this.toolsListContainer.appendChild(btn);
    }

    // 3. Right Tabs Header
    this.rightTabsHeader.innerHTML = '';
    const tabs: { id: RightTabId; label: string }[] = [
      { id: 'inspect', label: 'inspect' },
      { id: 'layers', label: 'layers' },
      { id: 'issues', label: `issues (${this.report.issues.length})` },
      { id: 'map', label: 'map' },
    ];
    for (const tab of tabs) {
      const active = this.activeRightTab === tab.id;
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      Object.assign(btn.style, {
        flex: '1',
        backgroundColor: 'transparent',
        color: active ? '#fbbf24' : '#9ca3af',
        border: 'none',
        borderBottom: active ? '2px solid #fbbf24' : '2px solid transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: active ? 'bold' : 'normal',
        fontSize: '12px',
      });
      btn.onclick = () => {
        this.activeRightTab = tab.id;
        this.refreshUI();
      };
      this.rightTabsHeader.appendChild(btn);
    }

    // 4. Right Panel Content
    this.renderRightPanelBody();

    // 5. Status Bar & Canvas
    this.updateStatusBar();
    this.renderCanvas();
  }

  private renderRightPanelBody(): void {
    this.rightPanelBody.innerHTML = '';

    if (this.activeRightTab === 'inspect') {
      this.renderInspectorTab();
    } else if (this.activeRightTab === 'layers') {
      this.renderLayersTab();
    } else if (this.activeRightTab === 'issues') {
      this.renderIssuesTab();
    } else {
      this.renderMapMetaTab();
    }
  }

  private renderInspectorTab(): void {
    // Si la herramienta activa es Stamp, Path, Patch o Landmark, mostrar selector de creación rápida arriba
    if (this.currentTool === 'stamp') {
      const box = this.makeSectionBox('STAMP PLACEMENT PALETTE');
      const sel = document.createElement('select');
      this.styleInput(sel);
      for (const prefab of Object.values(STAMP_LIBRARY)) {
        const opt = document.createElement('option');
        opt.value = prefab.id;
        opt.textContent = `${prefab.name}${prefab.service ? ` [${prefab.service}]` : ''}`;
        if (prefab.id === this.activeStampPrefabId) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => {
        this.activeStampPrefabId = sel.value;
        this.renderCanvas();
      };
      const rotBtn = this.makeButton(`Rotation: ${this.activeStampRotation}° (Press R)`, () => {
        this.activeStampRotation = (((this.activeStampRotation + 90) % 360) as StampRotation);
        this.refreshUI();
      });
      box.append(sel, rotBtn);
      this.rightPanelBody.appendChild(box);
    } else if (this.currentTool === 'landmark') {
      const box = this.makeSectionBox('LANDMARK ROLE PALETTE');
      const sel = document.createElement('select');
      this.styleInput(sel);
      (['spawn', 'exit', 'focus', 'rest', 'secret', 'danger'] as LandmarkRole[]).forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r.toUpperCase();
        if (r === this.activeLandmarkRole) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => {
        this.activeLandmarkRole = sel.value as LandmarkRole;
      };
      box.appendChild(sel);
      this.rightPanelBody.appendChild(box);
    } else if (this.currentTool === 'patch') {
      const box = this.makeSectionBox('PATCH TYPE PALETTE');
      const sel = document.createElement('select');
      this.styleInput(sel);
      (['tall_grass', 'flowers', 'clearing', 'garden', 'lake'] as PatchType[]).forEach((pt) => {
        const opt = document.createElement('option');
        opt.value = pt;
        opt.textContent = pt;
        if (pt === this.activePatchType) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => {
        this.activePatchType = sel.value as PatchType;
      };
      box.appendChild(sel);
      this.rightPanelBody.appendChild(box);
    } else if (this.currentTool === 'path') {
      const box = this.makeSectionBox('PATH RANK PALETTE');
      const sel = document.createElement('select');
      this.styleInput(sel);
      (['main', 'secondary', 'trail'] as PathRank[]).forEach((rk) => {
        const opt = document.createElement('option');
        opt.value = rk;
        opt.textContent = `${rk} (${rk === 'main' ? '3 tiles' : rk === 'secondary' ? '2 tiles' : '1 tile'})`;
        if (rk === this.activePathRank) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.onchange = () => {
        this.activePathRank = sel.value as PathRank;
      };
      box.appendChild(sel);
      this.rightPanelBody.appendChild(box);
    }

    if (!this.selected) {
      const emptyMsg = document.createElement('div');
      emptyMsg.textContent = 'Nothing selected. Use Select (V) and click a primitive.';
      emptyMsg.style.color = '#a199b3';
      emptyMsg.style.lineHeight = '1.5';

      const stageHeader = document.createElement('div');
      stageHeader.textContent = `STAGE ${this.currentStage}: ${STAGE_DEFS[this.currentStage].title.replace(/^\d+\.\s*/, '').toUpperCase()}`;
      Object.assign(stageHeader.style, {
        fontWeight: 'bold',
        color: '#c4bdd0',
        marginTop: '8px',
      });

      const stageDesc = document.createElement('div');
      stageDesc.textContent = STAGE_DEFS[this.currentStage].description;
      stageDesc.style.color = '#9ca3af';
      stageDesc.style.lineHeight = '1.5';

      this.rightPanelBody.append(emptyMsg, stageHeader, stageDesc);
      return;
    }

    const { kind, id } = this.selected;
    const box = this.makeSectionBox(`SELECTED ${kind.toUpperCase()}: ${id}`);

    if (kind === 'region') {
      const reg = this.doc.regions.find((r) => r.id === id);
      if (reg) {
        this.addSelectField(
          box,
          'Biome',
          ['meadow', 'town', 'forest', 'coastal', 'mountain', 'cave'],
          reg.biome,
          (v) => {
            this.pushUndoSnapshot();
            reg.biome = v as BiomeId;
            this.rebakeAndValidate();
            this.refreshUI();
          }
        );
        this.addNumberField(box, 'Edge Noise (0..10)', reg.edgeNoise, 0, 10, 0.1, (v) => {
          this.pushUndoSnapshot();
          reg.edgeNoise = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Noise Scale (0.05..2)', reg.noiseScale, 0.05, 2, 0.02, (v) => {
          this.pushUndoSnapshot();
          reg.noiseScale = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
      }
    } else if (kind === 'path') {
      const p = this.doc.paths.find((x) => x.id === id);
      if (p) {
        this.addSelectField(box, 'Rank', ['main', 'secondary', 'trail'], p.rank, (v) => {
          this.pushUndoSnapshot();
          p.rank = v as PathRank;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addSelectField(box, 'Surface', ['cobble', 'path', 'dirt', 'sand', 'wood'], p.surface, (v) => {
          this.pushUndoSnapshot();
          p.surface = v as PathSurface;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Width Jitter (0..2)', p.widthJitter, 0, 2, 0.1, (v) => {
          this.pushUndoSnapshot();
          p.widthJitter = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
      }
    } else if (kind === 'patch') {
      const pa = this.doc.patches.find((x) => x.id === id);
      if (pa) {
        this.addSelectField(
          box,
          'Type',
          ['tall_grass', 'flowers', 'clearing', 'garden', 'lake'],
          pa.type,
          (v) => {
            this.pushUndoSnapshot();
            pa.type = v as PatchType;
            this.rebakeAndValidate();
            this.refreshUI();
          }
        );
        this.addNumberField(box, 'Radius', pa.radius, 0.5, 30, 0.2, (v) => {
          this.pushUndoSnapshot();
          pa.radius = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Aspect (0.3..4)', pa.aspect, 0.3, 4, 0.05, (v) => {
          this.pushUndoSnapshot();
          pa.aspect = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Rotation (°)', pa.rotation, -180, 180, 5, (v) => {
          this.pushUndoSnapshot();
          pa.rotation = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Edge Noise (0..1)', pa.noise, 0, 1, 0.05, (v) => {
          this.pushUndoSnapshot();
          pa.noise = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
      }
    } else if (kind === 'stamp') {
      const st = this.doc.stamps.find((x) => x.id === id);
      if (st) {
        this.addSelectField(box, 'Prefab Stamp', Object.keys(STAMP_LIBRARY), st.stampId, (v) => {
          this.pushUndoSnapshot();
          st.stampId = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'X', st.x, 0, this.doc.meta.width - 1, 1, (v) => {
          this.pushUndoSnapshot();
          st.x = Math.round(v);
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Y', st.y, 0, this.doc.meta.height - 1, 1, (v) => {
          this.pushUndoSnapshot();
          st.y = Math.round(v);
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addSelectField(box, 'Rotation (°)', ['0', '90', '180', '270'], String(st.rot), (v) => {
          this.pushUndoSnapshot();
          st.rot = Number(v) as StampRotation;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addTextField(box, 'Label', st.label || '', (v) => {
          this.pushUndoSnapshot();
          st.label = v;
          this.rebakeAndValidate();
          this.refreshUI();
        });
      }
    } else if (kind === 'landmark') {
      const lm = this.doc.landmarks.find((x) => x.id === id);
      if (lm) {
        this.addSelectField(
          box,
          'Role',
          ['spawn', 'exit', 'focus', 'rest', 'secret', 'danger'],
          lm.role,
          (v) => {
            this.pushUndoSnapshot();
            lm.role = v as LandmarkRole;
            this.rebakeAndValidate();
            this.refreshUI();
          }
        );
        this.addTextField(box, 'Label', lm.label, (v) => {
          this.pushUndoSnapshot();
          lm.label = v || lm.id;
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'X', lm.x, 0, this.doc.meta.width - 1, 1, (v) => {
          this.pushUndoSnapshot();
          lm.x = Math.round(v);
          this.rebakeAndValidate();
          this.refreshUI();
        });
        this.addNumberField(box, 'Y', lm.y, 0, this.doc.meta.height - 1, 1, (v) => {
          this.pushUndoSnapshot();
          lm.y = Math.round(v);
          this.rebakeAndValidate();
          this.refreshUI();
        });
        if (lm.role === 'exit') {
          this.addTextField(box, 'Target Map ID', lm.targetMap || 'ruta_claro', (v) => {
            this.pushUndoSnapshot();
            lm.targetMap = v.trim() || 'ruta_claro';
            this.rebakeAndValidate();
            this.refreshUI();
          });
        }
      }
    }

    const delBtn = this.makeButton(
      'Delete selected (Del)',
      () => this.deleteSelectedPrimitive(),
      '#7f1d1d',
      '#f87171'
    );
    box.appendChild(delBtn);
    this.rightPanelBody.appendChild(box);
  }

  private renderLayersTab(): void {
    const box = this.makeSectionBox('VIEWPORT LAYERS');
    const items: { key: keyof LayerVisibility; label: string }[] = [
      { key: 'bakedTiles', label: 'Baked terrain tiles' },
      { key: 'blockedTiles', label: 'Blocked tiles (red overlay)' },
      { key: 'grid', label: 'Tile grid & coordinates' },
      { key: 'regions', label: 'Regions (polygon outlines)' },
      { key: 'paths', label: 'Paths (splines & vertices)' },
      { key: 'patches', label: 'Patches (ellipses)' },
      { key: 'stamps', label: 'Stamps (doors & approach)' },
      { key: 'landmarks', label: 'Landmarks (role badges)' },
      { key: 'validatorMarkers', label: 'Validator issue markers (▲)' },
      { key: 'windows9x13', label: '9×13 sliding windows (red = no focus)' },
      { key: 'cursorWindow9x13', label: '9×13 mobile window under cursor' },
      { key: 'playerScaleSilhouette', label: 'Player silhouette (1×1.5 tiles)' },
    ];

    for (const item of items) {
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        padding: '3px 0',
      });
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = this.layers[item.key];
      chk.onchange = () => {
        this.layers[item.key] = chk.checked;
        this.renderCanvas();
      };
      const span = document.createElement('span');
      span.textContent = item.label;
      row.append(chk, span);
      box.appendChild(row);
    }

    this.rightPanelBody.appendChild(box);
  }

  private renderIssuesTab(): void {
    const scoreBox = this.makeSectionBox(
      `VALIDATOR SCORE: ${this.report.score}/100 (${this.report.errorCount} errors, ${this.report.warningCount} warnings)`
    );

    const ruleList = document.createElement('div');
    Object.assign(ruleList.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '11px',
    });

    (Object.keys(RULE_STAGE_MAP) as ValidationRuleId[]).forEach((ruleId) => {
      const rStat = this.report.ruleSummary[ruleId];
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        justifyContent: 'space-between',
        color: rStat.passed ? '#4ade80' : '#f87171',
      });
      row.innerHTML = `<span>${rStat.passed ? '✓' : '✗'} [S${rStat.stage}] ${ruleId}</span><span>${rStat.issueCount}</span>`;
      ruleList.appendChild(row);
    });
    scoreBox.appendChild(ruleList);
    this.rightPanelBody.appendChild(scoreBox);

    const issuesBox = this.makeSectionBox('CLICK ISSUE TO CENTER CAMERA');
    if (this.report.issues.length === 0) {
      const ok = document.createElement('div');
      ok.textContent = '✓ All rules passed with 0 issues!';
      ok.style.color = '#4ade80';
      issuesBox.appendChild(ok);
    } else {
      for (const iss of this.report.issues) {
        const item = document.createElement('div');
        Object.assign(item.style, {
          padding: '6px 8px',
          backgroundColor: '#231d30',
          borderLeft: `3px solid ${iss.severity === 'error' ? '#f87171' : '#fbbf24'}`,
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '11px',
          lineHeight: '1.35',
        });
        item.textContent = `[${iss.ruleId}] (${iss.x},${iss.y}) ${iss.message}`;
        item.onclick = () => {
          this.centerViewOnTile(iss.x, iss.y);
          this.renderCanvas();
        };
        issuesBox.appendChild(item);
      }
    }
    this.rightPanelBody.appendChild(issuesBox);
  }

  private renderMapMetaTab(): void {
    const metaBox = this.makeSectionBox('MAP META & BORDER');
    this.addTextField(metaBox, 'Map ID', this.doc.meta.id, (v) => {
      this.pushUndoSnapshot();
      this.doc.meta.id = v.trim() || 'custom_map';
      this.rebakeAndValidate();
      this.refreshUI();
    });
    this.addTextField(metaBox, 'Name', this.doc.meta.name, (v) => {
      this.pushUndoSnapshot();
      this.doc.meta.name = v.trim() || 'Mapa sin nombre';
      this.rebakeAndValidate();
      this.refreshUI();
    });
    this.addNumberField(metaBox, 'Width (10..128)', this.doc.meta.width, 10, 128, 1, (v) => {
      this.pushUndoSnapshot();
      this.doc.meta.width = Math.round(v);
      this.rebakeAndValidate();
      this.refreshUI();
    });
    this.addNumberField(metaBox, 'Height (10..128)', this.doc.meta.height, 10, 128, 1, (v) => {
      this.pushUndoSnapshot();
      this.doc.meta.height = Math.round(v);
      this.rebakeAndValidate();
      this.refreshUI();
    });
    this.addNumberField(metaBox, 'Seed', this.doc.meta.seed, 1, 999999999, 1, (v) => {
      this.pushUndoSnapshot();
      this.doc.meta.seed = Math.round(v);
      this.rebakeAndValidate();
      this.refreshUI();
    });
    this.addSelectField(
      metaBox,
      'Default Biome',
      ['meadow', 'town', 'forest', 'coastal', 'mountain', 'cave'],
      this.doc.meta.defaultBiome,
      (v) => {
        this.pushUndoSnapshot();
        this.doc.meta.defaultBiome = v as BiomeId;
        this.rebakeAndValidate();
        this.refreshUI();
      }
    );
    this.addNumberField(metaBox, 'Border Thickness (0..8)', this.doc.border.thickness, 0, 8, 1, (v) => {
      this.pushUndoSnapshot();
      this.doc.border.thickness = Math.round(v);
      this.rebakeAndValidate();
      this.refreshUI();
    });
    this.addSelectField(
      metaBox,
      'Border Material',
      ['tree', 'rock', 'water', 'cliff'],
      this.doc.border.material,
      (v) => {
        this.pushUndoSnapshot();
        this.doc.border.material = v as BorderMaterial;
        this.rebakeAndValidate();
        this.refreshUI();
      }
    );

    const resetExampleBtn = this.makeButton('Reset to aldea_marioneta example', () => {
      this.pushUndoSnapshot();
      this.doc = deepClone(aldeaMarionetaSrc as unknown as MapSourceSchemaV1);
      this.selected = null;
      this.rebakeAndValidate();
      this.fitView();
      this.refreshUI();
    });
    metaBox.appendChild(resetExampleBtn);
    this.rightPanelBody.appendChild(metaBox);
  }

  private makeSectionBox(title: string): HTMLDivElement {
    const box = document.createElement('div');
    Object.assign(box.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      paddingBottom: '10px',
      borderBottom: '1px solid #2e263d',
    });
    const hdr = document.createElement('div');
    hdr.textContent = title;
    Object.assign(hdr.style, {
      fontSize: '11px',
      fontWeight: 'bold',
      color: '#c4bdd0',
      letterSpacing: '0.04em',
    });
    box.appendChild(hdr);
    return box;
  }

  private styleInput(el: HTMLElement): void {
    Object.assign(el.style, {
      backgroundColor: '#120f17',
      color: '#e2dce8',
      border: '1px solid #3a3150',
      borderRadius: '4px',
      padding: '4px 6px',
      fontFamily: 'inherit',
      fontSize: '12px',
      width: '100%',
    });
  }

  private addTextField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (val: string) => void
  ): void {
    const wrap = document.createElement('div');
    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.color = '#9ca3af';
    lbl.style.marginBottom = '2px';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    this.styleInput(inp);
    inp.onchange = () => onChange(inp.value);
    wrap.append(lbl, inp);
    parent.appendChild(wrap);
  }

  private addNumberField(
    parent: HTMLElement,
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void
  ): void {
    const wrap = document.createElement('div');
    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.color = '#9ca3af';
    lbl.style.marginBottom = '2px';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = String(min);
    inp.max = String(max);
    inp.step = String(step);
    inp.value = String(value);
    this.styleInput(inp);
    inp.onchange = () => {
      const parsed = Number(inp.value);
      if (Number.isFinite(parsed)) {
        onChange(Math.max(min, Math.min(max, parsed)));
      }
    };
    wrap.append(lbl, inp);
    parent.appendChild(wrap);
  }

  private addSelectField(
    parent: HTMLElement,
    label: string,
    options: string[],
    value: string,
    onChange: (val: string) => void
  ): void {
    const wrap = document.createElement('div');
    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.color = '#9ca3af';
    lbl.style.marginBottom = '2px';
    const sel = document.createElement('select');
    this.styleInput(sel);
    for (const optVal of options) {
      const o = document.createElement('option');
      o.value = optVal;
      o.textContent = optVal;
      if (optVal === value) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => onChange(sel.value);
    wrap.append(lbl, sel);
    parent.appendChild(wrap);
  }

  private updateStatusBar(): void {
    const hoverStr = this.hoverTile
      ? `tile (${this.hoverTile.x}, ${this.hoverTile.y}) · ${
          this.baked.cells[this.hoverTile.y]?.[this.hoverTile.x] || 'out'
        }`
      : 'hover the map';
    const scoreColor =
      this.report.errorCount > 0 ? '#f87171' : this.report.score >= 70 ? '#4ade80' : '#fbbf24';

    this.statusBarEl.innerHTML = `
      <span>${hoverStr}</span>
      <span>zoom ${Math.round(this.zoomPxPerTile)}px/tile</span>
      <span>${this.doc.meta.id} ${this.doc.meta.width}×${this.doc.meta.height}</span>
      <span>stage ${this.currentStage}/6</span>
      <span style="color:${scoreColor};font-weight:bold;">score ${this.report.score}</span>
      <span>bake ${this.baked.hash}</span>
    `;
  }

  // ==========================================================================
  // CANVAS 2D RENDERING
  // ==========================================================================

  private fitView(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const cw = rect?.width || window.innerWidth - 430;
    const ch = rect?.height || window.innerHeight - 115;
    this.canvas.width = Math.max(320, Math.floor(cw));
    this.canvas.height = Math.max(240, Math.floor(ch));

    const pad = 44;
    const scaleX = (this.canvas.width - pad * 2) / this.doc.meta.width;
    const scaleY = (this.canvas.height - pad * 2) / this.doc.meta.height;
    this.zoomPxPerTile = Math.max(8, Math.min(36, Math.floor(Math.min(scaleX, scaleY))));
    this.panX = Math.floor((this.canvas.width - this.doc.meta.width * this.zoomPxPerTile) / 2);
    this.panY = Math.floor((this.canvas.height - this.doc.meta.height * this.zoomPxPerTile) / 2);
  }

  private centerViewOnTile(tx: number, ty: number): void {
    this.panX = Math.floor(this.canvas.width / 2 - (tx + 0.5) * this.zoomPxPerTile);
    this.panY = Math.floor(this.canvas.height / 2 - (ty + 0.5) * this.zoomPxPerTile);
  }

  public renderCanvas(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect && (this.canvas.width !== Math.floor(rect.width) || this.canvas.height !== Math.floor(rect.height))) {
      this.canvas.width = Math.max(320, Math.floor(rect.width));
      this.canvas.height = Math.max(240, Math.floor(rect.height));
    }

    const ctx = this.ctx;
    const W = this.doc.meta.width;
    const H = this.doc.meta.height;
    const z = this.zoomPxPerTile;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#120f17';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.panX, this.panY);

    const palette = this.currentStage === 1 ? CELL_COLORS_BLOCKOUT : CELL_COLORS_NORMAL;

    // 1. CAPA: TILES HORNEADOS
    if (this.layers.bakedTiles) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cell = this.baked.cells[y][x];
          ctx.fillStyle = palette[cell] || '#52b765';
          ctx.fillRect(x * z, y * z, z, z);

          // Stage 5: previsualización de decorado determinista sobre celdas ground
          if (this.currentStage >= 5 && cell === 'ground') {
            const h = ((x * 73856093) ^ (y * 19349663) ^ this.doc.meta.seed) >>> 0;
            if (h % 11 === 0) {
              ctx.fillStyle = '#1e5e3a';
              ctx.beginPath();
              ctx.arc((x + 0.5) * z, (y + 0.5) * z, z * 0.28, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    // 2. CAPA: TILES BLOQUEADOS (ROJO)
    if (this.layers.blockedTiles) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.36)';
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!this.baked.walkable[y][x]) {
            ctx.fillRect(x * z, y * z, z, z);
          }
        }
      }
    }

    // 3. CAPA: CUADRÍCULA Y REGLAS DE COORDENADAS
    if (this.layers.grid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= W; x++) {
        ctx.moveTo(x * z, 0);
        ctx.lineTo(x * z, H * z);
      }
      for (let y = 0; y <= H; y++) {
        ctx.moveTo(0, y * z);
        ctx.lineTo(W * z, y * z);
      }
      ctx.stroke();

      // Líneas cada 5 tiles y numeración
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.beginPath();
      for (let x = 0; x <= W; x += 5) {
        ctx.moveTo(x * z, 0);
        ctx.lineTo(x * z, H * z);
      }
      for (let y = 0; y <= H; y += 5) {
        ctx.moveTo(0, y * z);
        ctx.lineTo(W * z, y * z);
      }
      ctx.stroke();

      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px monospace';
      for (let x = 0; x < W; x += 5) {
        ctx.fillText(String(x), x * z + 2, 9);
      }
      for (let y = 0; y < H; y += 5) {
        ctx.fillText(String(y), 2, y * z + 9);
      }

      // Contorno blanco del mapa + límite punteado del cinturón de borde
      ctx.strokeStyle = '#e2dce8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, W * z, H * z);

      const bt = this.doc.border.thickness;
      if (bt > 0) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.strokeRect(bt * z, bt * z, (W - bt * 2) * z, (H - bt * 2) * z);
        ctx.restore();
      }
    }

    // 4. CAPA: REGIONES (Polígonos punteados rosa/violeta)
    if (this.layers.regions) {
      for (const reg of this.doc.regions) {
        if (reg.points.length < 2) continue;
        const isSel = this.selected?.kind === 'region' && this.selected.id === reg.id;
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = isSel ? '#fde047' : '#f472b6';
        ctx.lineWidth = isSel ? 2 : 1.3;
        ctx.beginPath();
        reg.points.forEach(([px, py], idx) => {
          if (idx === 0) ctx.moveTo(px * z, py * z);
          else ctx.lineTo(px * z, py * z);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        const [fx, fy] = reg.points[0];
        ctx.fillStyle = '#f472b6';
        ctx.font = '10px monospace';
        ctx.fillText(reg.id, fx * z + 4, fy * z - 4);

        if (isSel) {
          for (const [vx, vy] of reg.points) {
            ctx.fillStyle = '#fde047';
            ctx.strokeStyle = '#18181b';
            ctx.lineWidth = 1.5;
            ctx.fillRect(vx * z - 4, vy * z - 4, 8, 8);
            ctx.strokeRect(vx * z - 4, vy * z - 4, 8, 8);
          }
        }
      }
    }

    // 5. CAPA: PARCHES (Elipses punteadas con etiqueta)
    if (this.layers.patches && this.currentStage >= 4) {
      for (const pa of this.doc.patches) {
        const isSel = this.selected?.kind === 'patch' && this.selected.id === pa.id;
        const [cx, cy] = pa.center;
        const rx = pa.radius * (pa.aspect || 1) * z;
        const ry = pa.radius * z;
        const rotRad = ((pa.rotation || 0) * Math.PI) / 180;

        ctx.save();
        ctx.translate((cx + 0.5) * z, (cy + 0.5) * z);
        ctx.rotate(rotRad);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isSel ? '#fde047' : '#86efac';
        ctx.fillStyle =
          pa.type === 'lake'
            ? 'rgba(56, 189, 248, 0.18)'
            : pa.type === 'garden'
            ? 'rgba(161, 98, 7, 0.25)'
            : 'rgba(134, 239, 172, 0.18)';
        ctx.lineWidth = isSel ? 2 : 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#86efac';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pa.type, (cx + 0.5) * z, (cy + 0.5) * z + 3);
        ctx.textAlign = 'left';

        // Tirador de radio cuando está seleccionado
        if (isSel) {
          const hx = (cx + 0.5 + pa.radius * (pa.aspect || 1)) * z;
          const hy = (cy + 0.5) * z;
          ctx.fillStyle = '#fde047';
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
        }
      }
    }

    // 6. CAPA: STAMPS (Con puerta 'D' en amarillo y casilla de aproximación punteada)
    if (this.layers.stamps && this.currentStage >= 3) {
      for (const st of this.doc.stamps) {
        const resolved = resolveRotatedStamp(st.stampId, st.x, st.y, st.rot);
        if (!resolved) continue;
        const isSel = this.selected?.kind === 'stamp' && this.selected.id === st.id;
        const style = STAMP_FILL_COLORS[st.stampId] || {
          fill: 'rgba(148, 163, 184, 0.78)',
          stroke: '#7dd3fc',
          shortLabel: st.stampId,
        };

        ctx.fillStyle = style.fill;
        ctx.fillRect(st.x * z, st.y * z, resolved.width * z, resolved.height * z);

        // Si es la plaza con fuente (7x7), dibujar su núcleo central 3x3
        if (st.stampId === 'fountain_plaza') {
          ctx.fillStyle = 'rgba(71, 136, 214, 0.85)';
          ctx.fillRect((st.x + 2) * z, (st.y + 2) * z, 3 * z, 3 * z);
        }

        ctx.strokeStyle = isSel ? '#fde047' : style.stroke;
        ctx.lineWidth = isSel ? 2.2 : 1.4;
        ctx.strokeRect(st.x * z, st.y * z, resolved.width * z, resolved.height * z);

        // Etiqueta superior izquierda
        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px monospace';
        ctx.fillText(st.label || style.shortLabel, st.x * z + 4, st.y * z + 11);

        // Puerta ('D') y casilla de aproximación
        if (resolved.doorCell) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(resolved.doorCell.x * z, resolved.doorCell.y * z, z, z);
        }
        if (resolved.approachCell) {
          ctx.save();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(
            resolved.approachCell.x * z + 1,
            resolved.approachCell.y * z + 1,
            z - 2,
            z - 2
          );
          ctx.restore();
        }
      }
    }

    // 7. CAPA: CAMINOS (Splines Catmull-Rom amarillos + vértices cuadrados)
    if (this.layers.paths && this.currentStage >= 2) {
      for (const p of this.doc.paths) {
        if (p.points.length < 2) continue;
        const isSel = this.selected?.kind === 'path' && this.selected.id === p.id;
        const spline = sampleCatmullRomSpline(p.points, 12);

        ctx.strokeStyle = isSel ? '#fde047' : '#f59e0b';
        ctx.lineWidth = isSel ? 2.4 : 1.6;
        ctx.beginPath();
        spline.forEach(([sx, sy], idx) => {
          const px = (sx + 0.5) * z;
          const py = (sy + 0.5) * z;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Vértices de control
        for (const [vx, vy] of p.points) {
          const px = (vx + 0.5) * z;
          const py = (vy + 0.5) * z;
          ctx.fillStyle = isSel ? '#fde047' : '#fbbf24';
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 1.2;
          ctx.fillRect(px - 3, py - 3, 6, 6);
          ctx.strokeRect(px - 3, py - 3, 6, 6);
        }

        const [lx, ly] = p.points[0];
        ctx.fillStyle = '#fcd34d';
        ctx.font = '10px monospace';
        ctx.fillText(`${p.id} [${p.rank}]`, (lx + 0.8) * z, (ly + 0.6) * z);
      }
    }

    // 8. CAPA: LANDMARKS (Círculos por rol y letra S/E/F/R/?/!)
    if (this.layers.landmarks && this.currentStage >= 2) {
      for (const lm of this.doc.landmarks) {
        const isSel = this.selected?.kind === 'landmark' && this.selected.id === lm.id;
        const badge = LANDMARK_COLORS[lm.role] || LANDMARK_COLORS.focus;
        const cx = (lm.x + 0.5) * z;
        const cy = (lm.y + 0.5) * z;
        const rad = Math.max(7, z * 0.44);

        ctx.fillStyle = badge.bg;
        ctx.strokeStyle = isSel ? '#ffffff' : '#18181b';
        ctx.lineWidth = isSel ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#090d16';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badge.letter, cx, cy + 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }

    // 9. CAPA: VENTANAS DESLIZANTES 9x13 (Rojo = sin foco, Ámbar = sobrecargada)
    if (this.layers.windows9x13) {
      for (const win of this.report.windows) {
        if (win.status === 'ignored' || win.status === 'ok') continue;
        ctx.strokeStyle =
          win.status === 'no-focus' ? 'rgba(248, 113, 113, 0.65)' : 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(win.x * z, win.y * z, win.width * z, win.height * z);
      }
    }

    // 10. CAPA: MARCADORES DEL VALIDADOR (Triángulos ▲ de advertencia/error)
    if (this.layers.validatorMarkers) {
      for (const iss of this.report.issues) {
        const cx = (iss.x + 0.5) * z;
        const cy = (iss.y + 0.5) * z;
        const sz = Math.max(5, z * 0.34);
        ctx.fillStyle = iss.severity === 'error' ? '#ef4444' : '#f59e0b';
        ctx.strokeStyle = '#18181b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - sz);
        ctx.lineTo(cx + sz, cy + sz);
        ctx.lineTo(cx - sz, cy + sz);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 11. TRAZO EN CURSO (Región o Camino mientras se añaden puntos)
    if (this.draftPoints.length > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.draftPoints.forEach(([px, py], idx) => {
        if (idx === 0) ctx.moveTo((px + 0.5) * z, (py + 0.5) * z);
        else ctx.lineTo((px + 0.5) * z, (py + 0.5) * z);
      });
      if (this.hoverTile) {
        ctx.lineTo((this.hoverTile.x + 0.5) * z, (this.hoverTile.y + 0.5) * z);
      }
      ctx.stroke();
    }

    // 12. PREVISUALIZACIÓN FANTASMA DE STAMP / VENTANA 9x13 BAJO EL CURSOR / SILUETA DEL JUGADOR (1x1.5)
    if (this.hoverTile) {
      const { x: hx, y: hy } = this.hoverTile;

      if (this.currentTool === 'stamp') {
        const preview = resolveRotatedStamp(this.activeStampPrefabId, hx, hy, this.activeStampRotation);
        if (preview) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hx * z, hy * z, preview.width * z, preview.height * z);
        }
      }

      if (this.layers.cursorWindow9x13) {
        const wx = Math.round(hx - 4);
        const wy = Math.round(hy - 6);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(wx * z, wy * z, 9 * z, 13 * z);
      }

      if (this.layers.playerScaleSilhouette) {
        // Silueta del jugador: 1.0 tile de ancho × 1.5 tiles de alto con pivote en los pies
        ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.fillRect(hx * z, (hy - 0.5) * z, 1.0 * z, 1.5 * z);
        ctx.strokeRect(hx * z, (hy - 0.5) * z, 1.0 * z, 1.5 * z);
      }
    }

    // Stage 6: tinte cálido de iluminación solar e iluminación de puertas/ventanas
    if (this.currentStage === 6) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
      ctx.fillRect(0, 0, W * z, H * z);
    }

    ctx.restore();
  }

  // ==========================================================================
  // INTERACCIÓN DE RATÓN Y TECLADO
  // ==========================================================================

  private screenToTile(clientX: number, clientY: number): { x: number; y: number; rawX: number; rawY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left - this.panX;
    const sy = clientY - rect.top - this.panY;
    const rawX = sx / this.zoomPxPerTile;
    const rawY = sy / this.zoomPxPerTile;
    const x = this.snapToGrid ? Math.floor(rawX) : Number(rawX.toFixed(2));
    const y = this.snapToGrid ? Math.floor(rawY) : Number(rawY.toFixed(2));
    return { x: Math.floor(rawX), y: Math.floor(rawY), rawX, rawY };
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.renderCanvas());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = (mx - this.panX) / this.zoomPxPerTile;
      const worldY = (my - this.panY) / this.zoomPxPerTile;

      const delta = e.deltaY < 0 ? 2 : -2;
      this.zoomPxPerTile = Math.max(6, Math.min(48, this.zoomPxPerTile + delta));
      this.panX = Math.round(mx - worldX * this.zoomPxPerTile);
      this.panY = Math.round(my - worldY * this.zoomPxPerTile);
      this.updateStatusBar();
      this.renderCanvas();
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      const tile = this.screenToTile(e.clientX, e.clientY);

      // Botón central o Espacio+arrastre -> Paneo
      if (e.button === 1 || (e.button === 0 && this.isSpaceDown)) {
        this.isPanning = true;
        this.dragMode = 'pan';
        this.dragStartMouse = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        return;
      }

      if (e.button !== 0) return;

      // Mayús+clic sobre una región o camino seleccionados -> insertar un vértice en el segmento más cercano
      if (e.shiftKey && this.selected && (this.selected.kind === 'region' || this.selected.kind === 'path')) {
        this.insertVertexOnSelected(tile.x, tile.y);
        return;
      }

      if (this.currentTool === 'select') {
        const hit = this.hitTestPrimitive(tile.rawX, tile.rawY);
        this.selected = hit;
        if (hit) {
          this.dragSnapshotBefore = JSON.stringify(this.doc);
          this.dragStartMapTile = { x: tile.rawX, y: tile.rawY };
          if (hit.vertexIndex !== undefined) {
            this.dragMode = 'move-vertex';
          } else if (hit.kind === 'patch' && this.isNearPatchRadiusHandle(hit.id, tile.rawX, tile.rawY)) {
            this.dragMode = 'resize-patch';
          } else {
            this.dragMode = 'move-primitive';
          }
          this.dragOrigData = deepClone(this.getSelectedObject(hit));
        }
        this.refreshUI();
        return;
      }

      if (this.currentTool === 'region' || this.currentTool === 'path') {
        this.draftPoints.push([tile.x, tile.y]);
        this.renderCanvas();
        return;
      }

      if (this.currentTool === 'patch') {
        this.pushUndoSnapshot();
        const newId = `patch_${this.activePatchType}_${Date.now().toString().slice(-4)}`;
        this.doc.patches.push({
          id: newId,
          type: this.activePatchType,
          center: [tile.x, tile.y],
          radius: 2.8,
          aspect: 1.2,
          rotation: 0,
          noise: 0.28,
        });
        this.selected = { kind: 'patch', id: newId };
        this.rebakeAndValidate();
        this.refreshUI();
        return;
      }

      if (this.currentTool === 'stamp') {
        this.pushUndoSnapshot();
        const newId = `st_${this.activeStampPrefabId}_${Date.now().toString().slice(-4)}`;
        this.doc.stamps.push({
          id: newId,
          stampId: this.activeStampPrefabId,
          x: tile.x,
          y: tile.y,
          rot: this.activeStampRotation,
        });
        this.selected = { kind: 'stamp', id: newId };
        this.rebakeAndValidate();
        this.refreshUI();
        return;
      }

      if (this.currentTool === 'landmark') {
        this.pushUndoSnapshot();
        const newId = `lm_${this.activeLandmarkRole}_${Date.now().toString().slice(-4)}`;
        this.doc.landmarks.push({
          id: newId,
          role: this.activeLandmarkRole,
          x: tile.x,
          y: tile.y,
          label: `${this.activeLandmarkRole} (${tile.x},${tile.y})`,
          ...(this.activeLandmarkRole === 'exit' ? { targetMap: 'ruta_claro' } : {}),
        });
        this.selected = { kind: 'landmark', id: newId };
        this.rebakeAndValidate();
        this.refreshUI();
      }
    });

    this.canvas.addEventListener('dblclick', () => {
      if (this.currentTool === 'region' || this.currentTool === 'path') {
        this.commitDraftPolygonOrPath();
      }
    });

    window.addEventListener('mousemove', (e) => {
      const tile = this.screenToTile(e.clientX, e.clientY);
      this.hoverTile = { x: tile.x, y: tile.y };

      if (this.dragMode === 'pan' && this.isPanning) {
        this.panX = e.clientX - this.dragStartMouse.x;
        this.panY = e.clientY - this.dragStartMouse.y;
        this.renderCanvas();
        return;
      }

      if (this.dragMode !== 'none' && this.selected && this.dragOrigData) {
        const dx = this.snapToGrid
          ? Math.round(tile.rawX - this.dragStartMapTile.x)
          : tile.rawX - this.dragStartMapTile.x;
        const dy = this.snapToGrid
          ? Math.round(tile.rawY - this.dragStartMapTile.y)
          : tile.rawY - this.dragStartMapTile.y;

        this.applyDragDelta(this.selected, dx, dy, tile.rawX);
        this.rebakeAndValidate();
        this.updateStatusBar();
        this.renderCanvas();
        return;
      }

      this.updateStatusBar();
      if (
        this.draftPoints.length > 0 ||
        this.currentTool === 'stamp' ||
        this.layers.cursorWindow9x13 ||
        this.layers.playerScaleSilhouette
      ) {
        this.renderCanvas();
      }
    });

    window.addEventListener('mouseup', () => {
      if (
        (this.dragMode === 'move-primitive' ||
          this.dragMode === 'move-vertex' ||
          this.dragMode === 'resize-patch') &&
        this.dragSnapshotBefore
      ) {
        if (this.dragSnapshotBefore !== JSON.stringify(this.doc)) {
          this.pushUndoSnapshot(this.dragSnapshotBefore);
          this.refreshUI();
        }
      }
      this.isPanning = false;
      this.dragMode = 'none';
      this.dragSnapshotBefore = null;
      this.dragOrigData = null;
    });

    window.addEventListener('keydown', (e) => {
      if (this.rootEl.style.display === 'none') {
        return;
      }

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        this.isSpaceDown = true;
      }

      // Deshacer / Rehacer (Ctrl+Z / Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
        return;
      }

      // Finalizar polígono o camino con Enter
      if (e.key === 'Enter' && this.draftPoints.length > 0) {
        e.preventDefault();
        this.commitDraftPolygonOrPath();
        return;
      }

      // Backspace quita el último vértice en curso
      if (e.key === 'Backspace' && this.draftPoints.length > 0) {
        e.preventDefault();
        this.draftPoints.pop();
        this.renderCanvas();
        return;
      }

      // Escape cancela trazo o deselecciona
      if (e.key === 'Escape') {
        this.draftPoints = [];
        this.selected = null;
        this.modalOverlayEl.style.display = 'none';
        this.refreshUI();
        return;
      }

      // Supr / Delete borra la primitiva seleccionada
      if (e.key === 'Delete' && this.selected) {
        e.preventDefault();
        this.deleteSelectedPrimitive();
        return;
      }

      // R rota el stamp seleccionado o el stamp en colocación
      if (e.key.toLowerCase() === 'r') {
        if (this.selected?.kind === 'stamp') {
          const st = this.doc.stamps.find((s) => s.id === this.selected!.id);
          if (st) {
            this.pushUndoSnapshot();
            st.rot = (((st.rot + 90) % 360) as StampRotation);
            this.rebakeAndValidate();
            this.refreshUI();
          }
        } else {
          this.activeStampRotation = (((this.activeStampRotation + 90) % 360) as StampRotation);
          this.refreshUI();
        }
        return;
      }

      // Atajos de herramientas: V, G, P, B, S, L
      const keyMap: Record<string, ToolId> = {
        v: 'select',
        g: 'region',
        p: 'path',
        b: 'patch',
        s: 'stamp',
        l: 'landmark',
      };
      const mappedTool = keyMap[e.key.toLowerCase()];
      if (mappedTool && this.isToolUnlockedInStage(mappedTool, this.currentStage)) {
        this.currentTool = mappedTool;
        this.draftPoints = [];
        this.refreshUI();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpaceDown = false;
      }
    });
  }

  private commitDraftPolygonOrPath(): void {
    if (this.currentTool === 'region' && this.draftPoints.length >= 3) {
      this.pushUndoSnapshot();
      const newId = `region_${Date.now().toString().slice(-4)}`;
      this.doc.regions.push({
        id: newId,
        biome: 'meadow',
        points: [...this.draftPoints],
        edgeNoise: 0.8,
        noiseScale: 0.22,
      });
      this.draftPoints = [];
      this.selected = { kind: 'region', id: newId };
      this.rebakeAndValidate();
      this.refreshUI();
    } else if (this.currentTool === 'path' && this.draftPoints.length >= 2) {
      this.pushUndoSnapshot();
      const newId = `path_${Date.now().toString().slice(-4)}`;
      this.doc.paths.push({
        id: newId,
        rank: this.activePathRank,
        surface: this.activePathRank === 'main' ? 'cobble' : 'path',
        points: [...this.draftPoints],
        widthJitter: 0,
      });
      this.draftPoints = [];
      this.selected = { kind: 'path', id: newId };
      this.rebakeAndValidate();
      this.refreshUI();
    }
  }

  private hitTestPrimitive(rawX: number, rawY: number): SelectionRef | null {
    // 1. Landmarks
    for (let i = this.doc.landmarks.length - 1; i >= 0; i--) {
      const lm = this.doc.landmarks[i];
      if (Math.hypot(rawX - (lm.x + 0.5), rawY - (lm.y + 0.5)) <= 0.85) {
        return { kind: 'landmark', id: lm.id };
      }
    }

    // 2. Stamps
    for (let i = this.doc.stamps.length - 1; i >= 0; i--) {
      const st = this.doc.stamps[i];
      const res = resolveRotatedStamp(st.stampId, st.x, st.y, st.rot);
      if (!res) continue;
      if (rawX >= st.x && rawX <= st.x + res.width && rawY >= st.y && rawY <= st.y + res.height) {
        return { kind: 'stamp', id: st.id };
      }
    }

    // 3. Path vertices & segments
    for (let i = this.doc.paths.length - 1; i >= 0; i--) {
      const p = this.doc.paths[i];
      for (let vIdx = 0; vIdx < p.points.length; vIdx++) {
        const [vx, vy] = p.points[vIdx];
        if (Math.hypot(rawX - (vx + 0.5), rawY - (vy + 0.5)) <= 0.75) {
          return { kind: 'path', id: p.id, vertexIndex: vIdx };
        }
      }
      const spline = sampleCatmullRomSpline(p.points, 10);
      for (const [sx, sy] of spline) {
        if (Math.hypot(rawX - (sx + 0.5), rawY - (sy + 0.5)) <= 0.95) {
          return { kind: 'path', id: p.id };
        }
      }
    }

    // 4. Patches
    for (let i = this.doc.patches.length - 1; i >= 0; i--) {
      const pa = this.doc.patches[i];
      const [cx, cy] = pa.center;
      const rx = pa.radius * (pa.aspect || 1);
      const ry = pa.radius;
      if (Math.hypot((rawX - (cx + 0.5)) / rx, (rawY - (cy + 0.5)) / ry) <= 1.15) {
        return { kind: 'patch', id: pa.id };
      }
    }

    // 5. Region vertices & interior polygon
    for (let i = this.doc.regions.length - 1; i >= 0; i--) {
      const reg = this.doc.regions[i];
      for (let vIdx = 0; vIdx < reg.points.length; vIdx++) {
        const [vx, vy] = reg.points[vIdx];
        if (Math.hypot(rawX - vx, rawY - vy) <= 0.85) {
          return { kind: 'region', id: reg.id, vertexIndex: vIdx };
        }
      }
    }
    for (let i = this.doc.regions.length - 1; i >= 0; i--) {
      const reg = this.doc.regions[i];
      if (this.isPointInsidePolygon(rawX, rawY, reg.points)) {
        return { kind: 'region', id: reg.id };
      }
    }

    return null;
  }

  private isPointInsidePolygon(px: number, py: number, pts: [number, number][]): boolean {
    if (pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private isNearPatchRadiusHandle(patchId: string, rawX: number, rawY: number): boolean {
    const pa = this.doc.patches.find((x) => x.id === patchId);
    if (!pa) return false;
    const hx = pa.center[0] + 0.5 + pa.radius * (pa.aspect || 1);
    const hy = pa.center[1] + 0.5;
    return Math.hypot(rawX - hx, rawY - hy) <= 0.9;
  }

  private getSelectedObject(sel: SelectionRef): any {
    if (sel.kind === 'region') return this.doc.regions.find((r) => r.id === sel.id);
    if (sel.kind === 'path') return this.doc.paths.find((p) => p.id === sel.id);
    if (sel.kind === 'patch') return this.doc.patches.find((p) => p.id === sel.id);
    if (sel.kind === 'stamp') return this.doc.stamps.find((s) => s.id === sel.id);
    if (sel.kind === 'landmark') return this.doc.landmarks.find((l) => l.id === sel.id);
    return null;
  }

  private applyDragDelta(sel: SelectionRef, dx: number, dy: number, rawX: number): void {
    const target = this.getSelectedObject(sel);
    if (!target || !this.dragOrigData) return;

    if (this.dragMode === 'move-vertex' && sel.vertexIndex !== undefined) {
      const origPt = this.dragOrigData.points[sel.vertexIndex];
      if (origPt) {
        target.points[sel.vertexIndex] = [Math.round(origPt[0] + dx), Math.round(origPt[1] + dy)];
      }
      return;
    }

    if (this.dragMode === 'resize-patch' && sel.kind === 'patch') {
      const dist = Math.max(0.8, Math.abs(rawX - (target.center[0] + 0.5)) / (target.aspect || 1));
      target.radius = Number(dist.toFixed(2));
      return;
    }

    if (sel.kind === 'stamp' || sel.kind === 'landmark') {
      target.x = Math.round(this.dragOrigData.x + dx);
      target.y = Math.round(this.dragOrigData.y + dy);
    } else if (sel.kind === 'patch') {
      target.center = [
        Math.round(this.dragOrigData.center[0] + dx),
        Math.round(this.dragOrigData.center[1] + dy),
      ];
    } else if (sel.kind === 'region' || sel.kind === 'path') {
      target.points = this.dragOrigData.points.map(([px, py]: [number, number]) => [
        Math.round(px + dx),
        Math.round(py + dy),
      ]);
    }
  }

  private insertVertexOnSelected(tx: number, ty: number): void {
    if (!this.selected) return;
    const obj = this.getSelectedObject(this.selected) as MapGenRegion | MapGenPath | undefined;
    if (!obj || !Array.isArray(obj.points) || obj.points.length < 2) return;

    this.pushUndoSnapshot();
    let bestIdx = 1;
    let bestDist = Infinity;
    const closed = this.selected.kind === 'region';
    const len = closed ? obj.points.length : obj.points.length - 1;

    for (let i = 0; i < len; i++) {
      const [x1, y1] = obj.points[i];
      const [x2, y2] = obj.points[(i + 1) % obj.points.length];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const d = Math.hypot(tx - mx, ty - my);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i + 1;
      }
    }

    obj.points.splice(bestIdx, 0, [tx, ty]);
    this.rebakeAndValidate();
    this.refreshUI();
  }

  private deleteSelectedPrimitive(): void {
    if (!this.selected) return;
    this.pushUndoSnapshot();
    const { kind, id } = this.selected;
    if (kind === 'region') this.doc.regions = this.doc.regions.filter((r) => r.id !== id);
    if (kind === 'path') this.doc.paths = this.doc.paths.filter((p) => p.id !== id);
    if (kind === 'patch') this.doc.patches = this.doc.patches.filter((p) => p.id !== id);
    if (kind === 'stamp') this.doc.stamps = this.doc.stamps.filter((s) => s.id !== id);
    if (kind === 'landmark') this.doc.landmarks = this.doc.landmarks.filter((l) => l.id !== id);
    this.selected = null;
    this.rebakeAndValidate();
    this.refreshUI();
  }

  // ==========================================================================
  // PERSISTENCIA: NEW, OPEN JSON, SAVE SOURCE, COPY JSON, EXPORT BAKED, SNAPSHOT PNG
  // ==========================================================================

  private createNewBlankMap(): void {
    this.pushUndoSnapshot();
    this.doc = {
      schema: 1,
      meta: {
        id: 'nuevo_mapa',
        name: 'Nuevo Mapa',
        width: 40,
        height: 32,
        seed: 47001,
        defaultBiome: 'meadow',
      },
      border: {
        thickness: 2,
        material: 'tree',
      },
      regions: [
        {
          id: 'region_base',
          biome: 'meadow',
          points: [
            [1, 1],
            [39, 1],
            [39, 31],
            [1, 31],
          ],
          edgeNoise: 0,
          noiseScale: 0.25,
        },
      ],
      paths: [],
      patches: [],
      stamps: [],
      landmarks: [
        {
          id: 'lm_spawn',
          role: 'spawn',
          x: 20,
          y: 28,
          label: 'Spawn',
        },
      ],
    };
    this.currentStage = 1;
    this.selected = null;
    this.rebakeAndValidate();
    this.fitView();
    this.refreshUI();
  }

  private handleFileImport(): void {
    const file = this.hiddenFileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const check = validateMapSourceSchema(parsed);
        if (!check.valid) {
          console.error('[mapgen] Invalid JSON schema:', check.errors);
          return;
        }
        this.pushUndoSnapshot();
        this.doc = parsed;
        this.selected = null;
        this.rebakeAndValidate();
        this.fitView();
        this.refreshUI();
      } catch (err) {
        console.error('[mapgen] Failed to parse JSON:', err);
      }
    };
    reader.readAsText(file);
  }

  private downloadSourceJson(): void {
    const json = JSON.stringify(this.doc, null, 2) + '\n';
    this.triggerDownload(`${this.doc.meta.id}.map.json`, json, 'application/json');
  }

  private copySourceJsonToClipboard(): void {
    const json = JSON.stringify(this.doc, null, 2) + '\n';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).catch(() => {});
    }
    this.statusBarEl.innerHTML = `<span style="color:#4ade80;font-weight:bold;">✓ Copied ${this.doc.meta.id}.map.json to clipboard! Paste into /data/maps/src/${this.doc.meta.id}.map.json</span>`;
  }

  private downloadBakedJson(): void {
    const { mapData } = MapLoader.loadMapData(this.doc);
    const payload = {
      id: mapData.id,
      name: mapData.name,
      width: mapData.width,
      height: mapData.height,
      hash: this.baked.hash,
      ground: mapData.ground,
      decor: mapData.decor,
      collision: mapData.collision,
      encounters: mapData.encounters,
      warps: mapData.warps,
      spawnPoints: mapData.spawnPoints,
      validatorSummary: {
        valid: this.report.valid,
        score: this.report.score,
        errorCount: this.report.errorCount,
        warningCount: this.report.warningCount,
        issues: this.report.issues,
      },
    };
    this.triggerDownload(
      `${this.doc.meta.id}.baked.json`,
      JSON.stringify(payload, null, 2) + '\n',
      'application/json'
    );
  }

  private exportStagePng(): void {
    const dataUrl = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${this.doc.meta.id}_stage${this.currentStage}.png`;
    a.click();
  }

  private triggerDownload(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Registra el mapa actual en WorldGraph, oculta el editor visual y lanza la escena Overworld
   * directamente en el punto de spawn del mapa editado para probar colisiones, puertas y salidas en vivo.
   */
  private applyAndPlayInGame(): void {
    const registered = WorldGraph.registerMap(this.doc);
    const sp = registered.spawnPoints?.default || { x: 7, y: 8, direction: 'down' as const };
    this.rootEl.style.display = 'none';
    GlobalSceneManager.changeScene('Overworld', {
      mapId: registered.id,
      x: sp.x,
      y: sp.y,
      dir: sp.direction,
    });
  }

  public toggleVisibility(): void {
    const hidden = this.rootEl.style.display === 'none';
    this.rootEl.style.display = hidden ? 'flex' : 'none';
    if (hidden) {
      this.fitView();
      this.refreshUI();
    }
  }
}

let editorSingleton: MapGenEditorUI | null = null;

export function mountMapGenEditor(): MapGenEditorUI {
  if (!editorSingleton) {
    editorSingleton = new MapGenEditorUI();
  } else {
    editorSingleton.toggleVisibility();
  }
  return editorSingleton;
}
