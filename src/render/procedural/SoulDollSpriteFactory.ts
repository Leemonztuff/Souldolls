import { PartBlock } from '../../types/bodies';
import { CREATURES_DATA } from '../../data/creatures/creatures';
import { GlobalSaveService } from '../../services/SaveService';
import { SOULDOLLS_SPRITES_MANIFEST } from '../../data/assetsManifest';

export type ChassisMaterial = 'wood' | 'iron' | 'crystal' | 'stone' | 'clay' | 'bone';
export type SpriteView =
  | 'view_front34'
  | 'view_front'
  | 'view_back'
  | 'view_back34'
  | 'front'
  | 'back'
  | 'side_r'
  | 'side_l'
  | 'icon'
  | 'attack';

export interface LayeredRenderConfig {
  speciesId: string;
  chassisMaterial?: ChassisMaterial;
  weaponId?: string;
  equippedWeaponId?: string | null;
  brokenParts?: PartBlock;
  view?: SpriteView;
  frame?: number; // 0 or 1 for attack
  statusCondition?: string | null;
  outfitStyle?: 'clasico' | 'atrevido';
}

export interface CreatureSpriteSet {
  view_front34: HTMLCanvasElement;
  view_front: HTMLCanvasElement;
  view_back: HTMLCanvasElement;
  view_back34: HTMLCanvasElement;
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  side_r: HTMLCanvasElement;
  side_l: HTMLCanvasElement;
  icon: HTMLCanvasElement;
  attack?: HTMLCanvasElement;
}

export interface IdleBustBox {
  y0: number;
  y1: number;
  x0: number;
  x1: number;
}

export interface IdleBandMeta {
  neck: number;
  waist: number;
  bust?: IdleBustBox;
}

export interface BattleFrameAtlasMeta {
  anchor: [number, number];
  mirrorSafe: boolean;
  native: boolean;
  note: string;
  idle?: IdleBandMeta;
}

export class SoulDollSpriteFactory {
  private static cache: Map<string, HTMLCanvasElement> = new Map();
  private static customSpritesheet: HTMLImageElement | null = null;
  private static customSpritesheetLoaded = false;
  private static keyedViewsCache: Map<string, HTMLCanvasElement> = new Map();
  private static frameMetaCache: Map<string, BattleFrameAtlasMeta> = new Map();
  private static speciesViewsCache: Map<string, Map<string, HTMLCanvasElement>> = new Map();
  private static speciesMetaCache: Map<string, Map<string, BattleFrameAtlasMeta>> = new Map();
  private static loadedSpeciesSheets: Set<string> = new Set();
  private static onSheetReadyCallbacks: Array<() => void> = [];

  static {
    if (typeof window !== 'undefined') {
      // 1. Preload default base sheet (maga_battle_sheet.png)
      const pngImg = new Image();
      pngImg.src = '/assets/souldolls/maga_battle_sheet.png';
      pngImg.onload = () => {
        this.customSpritesheet = pngImg;
        this.customSpritesheetLoaded = true;
        this.processLoadedSpritesheet(pngImg, true);
        this.cache.clear();
        this.onSheetReadyCallbacks.forEach((cb) => cb());
      };

      // 2. Preload dedicated battle sheets & atlases for all 14 Souldolls
      Object.values(SOULDOLLS_SPRITES_MANIFEST).forEach((entry) => {
        this.preloadSpeciesSheetAndAtlas(entry.speciesId, entry.sheetPath, entry.atlasPath);
      });
    }
  }

  private static preloadSpeciesSheetAndAtlas(
    speciesId: string,
    sheetPath: string,
    atlasPath: string
  ): void {
    const img = new Image();
    img.src = sheetPath;
    img.onload = () => {
      fetch(atlasPath)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((atlasJson) => {
          this.processSpeciesSpritesheet(speciesId, img, atlasJson);
          this.loadedSpeciesSheets.add(speciesId);
          this.cache.clear();
          this.onSheetReadyCallbacks.forEach((cb) => cb());
        });
    };
  }

  private static processSpeciesSpritesheet(
    speciesId: string,
    img: HTMLImageElement,
    atlasJson?: any
  ): void {
    const vMap = new Map<string, HTMLCanvasElement>();
    const mMap = new Map<string, BattleFrameAtlasMeta>();

    if (atlasJson && atlasJson.frames) {
      for (const [vName, frame] of Object.entries<any>(atlasJson.frames)) {
        const fx = frame.x ?? 0;
        const fy = frame.y ?? 0;
        const fw = frame.w ?? img.width;
        const fh = frame.h ?? img.height;
        const { canvas, ctx } = this.createCanvas(fw, fh);
        ctx.drawImage(img, fx, fy, fw, fh, 0, 0, fw, fh);
        const trimmed = this.trimToOpaqueBoundingBox(canvas, 1);
        vMap.set(vName, trimmed);
        mMap.set(vName, {
          anchor: frame.anchor || [0.5, 1.0],
          mirrorSafe: Boolean(frame.mirrorSafe),
          native: Boolean(frame.native),
          note: frame.note || '',
          idle: frame.idle,
        });
      }
    }

    if (vMap.has('view_front34')) vMap.set('side_r', vMap.get('view_front34')!);
    if (vMap.has('view_front')) vMap.set('front', vMap.get('view_front')!);
    if (vMap.has('view_back')) vMap.set('back', vMap.get('view_back')!);
    if (vMap.has('view_back34')) vMap.set('side_l', vMap.get('view_back34')!);

    if (vMap.size > 0) {
      this.speciesViewsCache.set(speciesId, vMap);
      this.speciesMetaCache.set(speciesId, mMap);
    }
  }

  public static hasDedicatedSpeciesSheet(speciesId: string): boolean {
    return Boolean(SOULDOLLS_SPRITES_MANIFEST[speciesId]);
  }

  public static onSpritesheetReady(cb: () => void): void {
    if (this.customSpritesheetLoaded) {
      cb();
    } else {
      this.onSheetReadyCallbacks.push(cb);
    }
  }

  /**
   * Req 2: Procesa una imagen o canvas eliminando el fondo verde (chroma key + despill g = max(r,b))
   * una sola vez al cargar y cachea el canvas resultante.
   */
  public static keyOutGreen(
    source: HTMLImageElement | HTMLCanvasElement,
    targetGreen: [number, number, number] = [26, 174, 6],
    tolerance = 58
  ): HTMLCanvasElement {
    const w = source.width;
    const h = source.height;
    const { canvas, ctx } = this.createCanvas(w, h);
    ctx.drawImage(source, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const [bgR, bgG, bgB] = targetGreen;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
      const greenExcess = g - Math.max(r, b);

      if (dist <= tolerance || (greenExcess > 48 && g > 95 && r < 115 && b < 115)) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else if (greenExcess > 12) {
        // Despill: en bordes, g = max(r,b)
        data[i + 1] = Math.max(r, b);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Recorta un canvas al bounding box de los píxeles opacos con 1 px de padding transparente.
   */
  public static trimToOpaqueBoundingBox(source: HTMLCanvasElement, padding = 1): HTMLCanvasElement {
    const w = source.width;
    const h = source.height;
    const ctx = source.getContext('2d')!;
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w;
    let maxX = -1;
    let minY = h;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return source;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const outW = cropW + padding * 2;
    const outH = cropH + padding * 2;

    const { canvas: outCanvas, ctx: outCtx } = this.createCanvas(outW, outH);
    outCtx.drawImage(source, minX, minY, cropW, cropH, padding, padding, cropW, cropH);
    return outCanvas;
  }

  /**
   * Segmenta la hoja por columnas vacías, reduce a cuadrícula nativa (~160px alto) si viene en alta resolución,
   * y recorta cada vista con 1 px de padding.
   */
  private static processLoadedSpritesheet(img: HTMLImageElement, isPreKeyedPng: boolean): void {
    const keyedSheet = isPreKeyedPng ? this.keyOutGreen(img, [26, 174, 6], 42) : this.keyOutGreen(img, [26, 174, 6], 58);
    const w = keyedSheet.width;
    const h = keyedSheet.height;
    const ctx = keyedSheet.getContext('2d')!;
    const data = ctx.getImageData(0, 0, w, h).data;

    // Detectar columnas no vacías para separar las 4 vistas sin cajas fijas
    const colCounts = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      let c = 0;
      for (let y = 0; y < h; y++) {
        if (data[(y * w + x) * 4 + 3] > 16) c++;
      }
      colCounts[x] = c;
    }

    const minPixelsPerCol = h > 500 ? 5 : 1;
    const minSegWidth = w > 1000 ? 20 : 8;
    const segments: Array<[number, number]> = [];
    let inSeg = false;
    let startX = 0;
    for (let x = 0; x < w; x++) {
      if (colCounts[x] >= minPixelsPerCol) {
        if (!inSeg) {
          inSeg = true;
          startX = x;
        }
      } else if (inSeg) {
        if (x - startX >= minSegWidth) segments.push([startX, x - 1]);
        inSeg = false;
      }
    }
    if (inSeg && w - startX >= minSegWidth) {
      segments.push([startX, w - 1]);
    }

    // Bloque 38 Req 1:
    // Col 0: view_front34 (rostro y pecho visibles, mira hacia la DERECHA en el arte original)
    // Col 1: view_front (frontal/perfil secundario)
    // Col 2: view_back (espalda simétrica)
    // Col 3: view_back34 (de espaldas, nuca visible, mira hacia la IZQUIERDA en el arte original)
    const defaultIdleMap: Record<string, IdleBandMeta> = {
      view_front: {
        neck: 0.31,
        waist: 0.48,
        bust: { y0: 0.34, y1: 0.46, x0: 0.30, x1: 0.70 },
      },
      view_front34: {
        neck: 0.30,
        waist: 0.48,
        bust: { y0: 0.33, y1: 0.46, x0: 0.28, x1: 0.72 },
      },
      view_back: {
        neck: 0.30,
        waist: 0.48,
      },
      view_back34: {
        neck: 0.30,
        waist: 0.48,
      },
    };

    const viewNames: SpriteView[] = ['view_front34', 'view_front', 'view_back', 'view_back34'];
    segments.forEach(([sx, ex], idx) => {
      const vName = viewNames[idx] || 'view_front34';
      const segW = ex - sx + 1;
      const { canvas: rawSeg, ctx: segCtx } = this.createCanvas(segW, h);
      segCtx.drawImage(keyedSheet, sx, 0, segW, h, 0, 0, segW, h);
      const trimmed = this.trimToOpaqueBoundingBox(rawSeg, 1);

      let finalViewCanvas = trimmed;
      // Si es la imagen JPG original (~1412px de alto), reducir por bloques (nearest) a ~160px
      if (trimmed.height > 300) {
        const targetH = 160;
        const scale = trimmed.height / targetH;
        const targetW = Math.max(1, Math.round(trimmed.width / scale));
        const { canvas: downCanvas, ctx: downCtx } = this.createCanvas(targetW, targetH);
        downCtx.imageSmoothingEnabled = false;
        downCtx.drawImage(trimmed, 0, 0, targetW, targetH);
        finalViewCanvas = this.trimToOpaqueBoundingBox(downCanvas, 1);
      }

      this.keyedViewsCache.set(vName, finalViewCanvas);
      this.frameMetaCache.set(vName, {
        anchor: [0.5, 1.0],
        mirrorSafe: false,
        native: false,
        note: 'Asimetría de diseño: el brazo del guantelete cambia de lado al espejar (flipX: true).',
        idle: defaultIdleMap[vName],
      });
    });

    // Alias de compatibilidad hacia atrás con Bloque 37
    if (this.keyedViewsCache.has('view_front34')) {
      this.keyedViewsCache.set('side_r', this.keyedViewsCache.get('view_front34')!);
    }
    if (this.keyedViewsCache.has('view_front')) {
      this.keyedViewsCache.set('front', this.keyedViewsCache.get('view_front')!);
    }
    if (this.keyedViewsCache.has('view_back')) {
      this.keyedViewsCache.set('back', this.keyedViewsCache.get('view_back')!);
    }
    if (this.keyedViewsCache.has('view_back34')) {
      this.keyedViewsCache.set('side_l', this.keyedViewsCache.get('view_back34')!);
    }
  }

  public static hasRealView(speciesId: string, view: SpriteView): boolean {
    const spMap = this.speciesViewsCache.get(speciesId);
    if (spMap && spMap.has(view)) {
      return true;
    }
    if (this.keyedViewsCache.has(view)) {
      return true;
    }
    return view !== 'side_l';
  }

  public static getBattleFrameMeta(speciesId: string, view: SpriteView): BattleFrameAtlasMeta {
    return this.getFrameMeta(speciesId, view);
  }

  public static getFrameMeta(speciesId: string, view: SpriteView): BattleFrameAtlasMeta {
    const resolvedView: SpriteView =
      view === 'side_r'
        ? 'view_front34'
        : view === 'front'
        ? 'view_front'
        : view === 'back'
        ? 'view_back'
        : view === 'side_l'
        ? 'view_back34'
        : view;

    const spMetaMap = this.speciesMetaCache.get(speciesId);
    if (spMetaMap && spMetaMap.has(resolvedView)) {
      return spMetaMap.get(resolvedView)!;
    }

    const cached = this.frameMetaCache.get(resolvedView);
    if (cached) return cached;

    const isBack = resolvedView === 'view_back' || resolvedView === 'view_back34';
    const isFront = resolvedView === 'view_front';

    return {
      anchor: [0.5, 1.0],
      mirrorSafe: false,
      native: false,
      note: 'Asimetría de diseño: el brazo del guantelete cambia de lado al espejar (flipX: true).',
      idle: isBack
        ? { neck: 0.30, waist: 0.48 }
        : isFront
        ? { neck: 0.31, waist: 0.48, bust: { y0: 0.34, y1: 0.46, x0: 0.30, x1: 0.70 } }
        : { neck: 0.30, waist: 0.48, bust: { y0: 0.33, y1: 0.46, x0: 0.28, x1: 0.72 } },
    };
  }

  /**
   * Aplica recoloreado de paleta elemental sobre el sprite base (vestido rojo/naranja -> color de la clase)
   * manteniendo intactos la piel, ojos, madera del chasis y bordes oscuros.
   */
  private static applySpeciesPaletteShift(canvas: HTMLCanvasElement, speciesId: string): void {
    if (speciesId === 'maga' || speciesId === 'starter') return;

    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    // Mapa de tinte objetivo por clase para píxeles cálidos del atuendo/sombrero
    const tintMap: Record<string, [number, number, number]> = {
      archimaga: [220, 38, 38],
      sacerdotisa: [34, 197, 94],
      hierofante: [22, 163, 74],
      gladiadora: [217, 119, 6],
      titanide: [245, 158, 11],
      paladin: [217, 119, 6],
      templario: [245, 158, 11],
      bruja: [168, 85, 247],
      hechicera: [192, 132, 252],
      hidromante: [56, 189, 248],
      cantora_marea: [14, 165, 233],
      monje: [250, 204, 21],
      maestro_trueno: [234, 179, 8],
      asesina: [100, 116, 139],
      espectro: [139, 92, 246],
    };

    const target = tintMap[speciesId];
    if (!target) return;

    const [tR, tG, tB] = target;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      // Detectar píxeles de tela roja/escarlata/púrpura del atuendo sin tocar la piel clara (r>195, g>145, b>120)
      const isSkin = r > 185 && g > 135 && b > 110 && r > g && g > b;
      const isFabricRed = !isSkin && r > 110 && r > g * 1.35 && b < r * 0.75;
      const isDarkHatOrCape = !isSkin && r > 60 && b > 55 && g < Math.min(r, b) * 0.85;

      if (isFabricRed || isDarkHatOrCape) {
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 180;
        d[i] = Math.min(255, Math.max(0, Math.round(tR * lum)));
        d[i + 1] = Math.min(255, Math.max(0, Math.round(tG * lum)));
        d[i + 2] = Math.min(255, Math.max(0, Math.round(tB * lum)));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  /**
   * BLOQUE 46 (Req. 6): Arte provisional diferenciado sobre la hoja base.
   * Dibuja sobre la mano el arma propia de cada inicial (báculo de brasa / Bastón Ignis,
   * báculo-raíz / Vara de Sauce, Tridente de Coral), su emblema de tocado y sutil aura elemental,
   * garantizando que las 3 opciones se distingan a simple vista sin depender solo del tinte.
   */
  private static drawSpeciesHeldWeaponOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    speciesId: string,
    view: SpriteView
  ): void {
    const isBack = view === 'view_back' || view === 'view_back34' || view === 'back' || view === 'side_l';
    const handX = view === 'view_front34' || view === 'side_r' ? Math.round(w * 0.78) : Math.round(w * 0.82);
    const handY = Math.round(h * 0.56);
    const headX = Math.round(w * 0.5);
    const headY = Math.round(h * 0.14);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (speciesId === 'maga' || speciesId === 'archimaga') {
      // Bastón Ignis: báculo de fresno oscuro coronado por rubí ígneo y chispas de brasa
      ctx.fillStyle = '#422513';
      ctx.fillRect(handX - 2, handY - 34, 4, 58);
      ctx.fillStyle = '#8A6A3B';
      ctx.fillRect(handX - 4, handY - 36, 8, 4);
      ctx.fillStyle = '#FF6B35';
      ctx.fillRect(handX - 5, handY - 45, 10, 9);
      ctx.fillStyle = '#FFC15E';
      ctx.fillRect(handX - 2, handY - 43, 4, 5);
      // Ascuas flotantes
      ctx.fillStyle = '#FF6B35';
      ctx.fillRect(handX - 9, handY - 50, 2, 2);
      ctx.fillRect(handX + 7, handY - 48, 2, 2);
    } else if (speciesId === 'sacerdotisa' || speciesId === 'hierofante') {
      // Vara de Sauce (báculo-raíz): cayado curvo de madera viva con hojas esmeralda y flor sanadora
      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(handX - 2, handY - 32, 4, 56);
      ctx.fillRect(handX - 7, handY - 38, 10, 4);
      ctx.fillRect(handX - 9, handY - 35, 3, 6);
      // Hojas de sauce y flor blanca/esmeralda
      ctx.fillStyle = '#5CBF5A';
      ctx.fillRect(handX - 11, handY - 41, 6, 4);
      ctx.fillRect(handX + 2, handY - 42, 6, 4);
      ctx.fillStyle = '#C8F28A';
      ctx.fillRect(handX - 4, handY - 44, 6, 6);
      // Guirnalda botánica sobre el tocado
      if (!isBack) {
        ctx.fillStyle = '#5CBF5A';
        ctx.fillRect(headX - 12, headY, 24, 3);
        ctx.fillStyle = '#C8F28A';
        ctx.fillRect(headX - 8, headY - 1, 4, 3);
        ctx.fillRect(headX + 4, headY - 1, 4, 3);
      }
    } else if (speciesId === 'hidromante' || speciesId === 'cantora_marea') {
      // Tridente de Coral: asta marina y tres puntas de coral celeste
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(handX - 2, handY - 30, 4, 54);
      ctx.fillStyle = '#3FA9F5';
      ctx.fillRect(handX - 8, handY - 34, 16, 3);
      // 3 puntas del tridente
      ctx.fillRect(handX - 8, handY - 45, 3, 12);
      ctx.fillRect(handX - 1, handY - 49, 3, 16);
      ctx.fillRect(handX + 5, handY - 45, 3, 12);
      ctx.fillStyle = '#A8E6FF';
      ctx.fillRect(handX - 1, handY - 48, 2, 6);
      // Diadema de coral / perla marina en la frente
      if (!isBack) {
        ctx.fillStyle = '#3FA9F5';
        ctx.fillRect(headX - 10, headY + 1, 20, 3);
        ctx.fillStyle = '#A8E6FF';
        ctx.fillRect(headX - 2, headY - 2, 4, 5);
      }
    } else if (speciesId === 'bruja' || speciesId === 'hechicera') {
      // Grimorio Polvo / Tomo Arcano: códice flotante con páginas iluminadas y sello de ki
      ctx.fillStyle = '#241434';
      ctx.fillRect(handX - 9, handY - 22, 16, 20);
      ctx.fillStyle = speciesId === 'hechicera' ? '#7a30d0' : '#944ce0';
      ctx.fillRect(handX - 8, handY - 21, 14, 18);
      ctx.fillStyle = '#F2E6C9';
      ctx.fillRect(handX - 6, handY - 19, 10, 14);
      ctx.fillStyle = '#5FE3D2';
      ctx.fillRect(handX - 3, handY - 15, 4, 6);
      if (!isBack && speciesId === 'hechicera') {
        ctx.fillStyle = '#E8B84A';
        ctx.fillRect(headX - 10, headY - 2, 20, 3);
        ctx.fillStyle = '#E9D5FF';
        ctx.fillRect(headX - 1, headY - 6, 3, 5);
      }
    } else if (speciesId === 'gladiadora' || speciesId === 'titanide') {
      // Guantelete de Piedra / Titán: cestus pesado de bronce y granito
      ctx.fillStyle = '#201810';
      ctx.fillRect(handX - 7, handY - 10, 13, 16);
      ctx.fillStyle = speciesId === 'titanide' ? '#925826' : '#b07a45';
      ctx.fillRect(handX - 6, handY - 9, 11, 14);
      ctx.fillStyle = '#E8B84A';
      ctx.fillRect(handX - 4, handY - 7, 7, 5);
    } else if (speciesId === 'monje' || speciesId === 'maestro_trueno') {
      // Guantes Chispa / Nunchaku Rayo: vendas doradas con chispas eléctricas
      ctx.fillStyle = '#EEBE2C';
      ctx.fillRect(handX - 5, handY - 14, 9, 12);
      ctx.fillStyle = '#FFF6B0';
      ctx.fillRect(handX - 3, handY - 22, 4, 8);
      ctx.fillStyle = '#5FE3D2';
      ctx.fillRect(handX + 2, handY - 26, 3, 6);
    } else if (speciesId === 'asesina' || speciesId === 'espectro') {
      // Daga Penumbra / Guadaña del Vacío: hoja umbría con filo carmesí/vacío
      ctx.fillStyle = '#1c162c';
      ctx.fillRect(handX - 2, handY - 34, 3, 52);
      ctx.fillStyle = '#B894F6';
      ctx.fillRect(handX - 1, handY - 38, 12, 5);
      ctx.fillStyle = speciesId === 'espectro' ? '#5FE3D2' : '#C2234B';
      ctx.fillRect(handX + 6, handY - 35, 4, 10);
    }

    ctx.restore();
  }

  /**
   * Helper to darken / lighten hex colors
   */
  public static adjustColor(hex: string, percent: number): string {
    const cleanHex = (hex || '#6366f1').replace('#', '');
    const num = parseInt(cleanHex, 16) || 0x6366f1;
    let r = (num >> 16) + Math.round(255 * (percent / 100));
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
    let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  private static createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  /**
   * Generates or retrieves from cache a single layered sprite canvas
   */
  public static generateLayeredCanvas(config: LayeredRenderConfig): HTMLCanvasElement {
    const speciesId = config.speciesId || 'maga';
    const mat = config.chassisMaterial || 'wood';
    const weaponId = config.equippedWeaponId || config.weaponId || 'default';
    const brokenKey = config.brokenParts
      ? `${config.brokenParts.head}_${config.brokenParts.torso}_${config.brokenParts.arms}_${config.brokenParts.legs}`
      : 'ok';
    const view = config.view || 'front';
    const frame = config.frame || 0;
    const status = config.statusCondition || 'none';

    // Get current Outfit Style setting from GlobalSaveService if a save is active
    let styleSetting: 'clasico' | 'atrevido' = 'clasico';
    try {
      if (GlobalSaveService.hasActiveState()) {
        const state = GlobalSaveService.getCurrentState();
        if (state && state.settings && state.settings.outfitStyle) {
          styleSetting = state.settings.outfitStyle;
        }
      }
    } catch (_) {
      // Ignore
    }

    const outfitStyle = config.outfitStyle || styleSetting;

    const cacheKey = `${speciesId}_${mat}_${weaponId}_${brokenKey}_${view}_${frame}_${status}_${outfitStyle}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // CHECK IF DEDICATED PER-SPECIES SHEET OR CUSTOM BASE SPRITESHEET IS LOADED
    const spViewsMap = this.speciesViewsCache.get(speciesId);
    const hasDedicatedSheet = Boolean(spViewsMap && spViewsMap.size > 0);
    const useRealSpritesheet =
      hasDedicatedSheet ||
      (this.customSpritesheetLoaded && this.keyedViewsCache.size > 0);

    if (useRealSpritesheet && view !== 'icon') {
      let targetView: SpriteView = view;
      if (view === 'attack' || view === 'side_r') targetView = 'view_front34';
      else if (view === 'front') targetView = 'view_front';
      else if (view === 'back') targetView = 'view_back';
      else if (view === 'side_l') targetView = 'view_back34';

      const sourceMap = hasDedicatedSheet ? spViewsMap! : this.keyedViewsCache;

      // Req 2: Fallback si falta view_back34 -> view_back; si falta view_front34 -> view_front
      let baseViewCanvas = sourceMap.get(targetView);
      if (!baseViewCanvas && targetView === 'view_back34') {
        baseViewCanvas = sourceMap.get('view_back');
      } else if (!baseViewCanvas && targetView === 'view_front34') {
        baseViewCanvas = sourceMap.get('view_front');
      }
      if (!baseViewCanvas) {
        baseViewCanvas =
          sourceMap.get('view_front34') ||
          sourceMap.get('view_front');
      }

      if (baseViewCanvas) {
        const { canvas: nativeCanvas, ctx: nCtx } = this.createCanvas(baseViewCanvas.width, baseViewCanvas.height);
        nCtx.drawImage(baseViewCanvas, 0, 0);

        if (!hasDedicatedSheet) {
          this.applySpeciesPaletteShift(nativeCanvas, speciesId);
          this.drawSpeciesHeldWeaponOverlay(nCtx, nativeCanvas.width, nativeCanvas.height, speciesId, targetView);
        }

        if (outfitStyle === 'atrevido') {
          nCtx.fillStyle = '#ff8fbb';
          nCtx.globalAlpha = 0.18;
          nCtx.fillRect(
            Math.floor(baseViewCanvas.width * 0.25),
            Math.floor(baseViewCanvas.height * 0.35),
            Math.floor(baseViewCanvas.width * 0.5),
            Math.floor(baseViewCanvas.height * 0.3)
          );
          nCtx.globalAlpha = 1.0;
        }

        const trimmed = this.trimToOpaqueBoundingBox(nativeCanvas, 1);
        this.cache.set(cacheKey, trimmed);
        return trimmed;
      }
    }

    const species = CREATURES_DATA[speciesId] || CREATURES_DATA['maga'];

    if (view === 'icon') {
      const { canvas, ctx } = this.createCanvas(32, 32);
      this.drawIconView(ctx, species, mat);
      this.cache.set(cacheKey, canvas);
      return canvas;
    }

    // Procedural humanoid canvas (drawn at 64x64, then scaled by integer 2x to ~124px native height and cropped to bounding box + 1px padding)
    const { canvas: rawCanvas, ctx } = this.createCanvas(64, 64);
    ctx.save();
    const isLegsBroken = config.brokenParts && config.brokenParts.legs <= 0;
    const isBackView = view === 'back' || view === 'view_back' || view === 'view_back34';
    if (isLegsBroken) {
      ctx.translate(32, 40);
      ctx.rotate(isBackView ? -0.12 : 0.12);
      ctx.translate(-32, -36);
    }

    // Layer 1: Chassis / Material Body
    this.drawChassisLayer(ctx, mat, view, config.brokenParts);

    // Layer 2: Class Outfit (respecting classic vs bold outfitStyle and 3/4 facing)
    this.drawClassOutfitLayer(ctx, species, view, outfitStyle);

    // Layer 3: Weapon
    this.drawWeaponLayer(ctx, species, weaponId, view, frame, config.brokenParts);

    // Layer 4: Accessories & Status
    this.drawAccessoryAndStatusLayer(ctx, species, status, view);

    // Layer 5: Damage / Broken parts overlays
    if (config.brokenParts) {
      this.drawDamageLayer(ctx, config.brokenParts, view);
    }

    ctx.restore();

    // Scale procedural sprite by exact integer 2x so its native height (~124px) matches the ~120-160px native pixel grid
    const trimmed64 = this.trimToOpaqueBoundingBox(rawCanvas, 0);
    const nativeScale = 2;
    const { canvas: upCanvas, ctx: upCtx } = this.createCanvas(
      trimmed64.width * nativeScale,
      trimmed64.height * nativeScale
    );
    upCtx.imageSmoothingEnabled = false;
    upCtx.drawImage(
      trimmed64,
      0,
      0,
      trimmed64.width,
      trimmed64.height,
      0,
      0,
      trimmed64.width * nativeScale,
      trimmed64.height * nativeScale
    );

    const finalCanvas = this.trimToOpaqueBoundingBox(upCanvas, 1);
    this.cache.set(cacheKey, finalCanvas);
    return finalCanvas;
  }

  /**
   * Generates full sprite set (view_front34, view_front, view_back, view_back34, front, back, side_r, side_l, icon, attack)
   */
  public static generateSpriteSet(species: any, mat: ChassisMaterial = 'wood'): CreatureSpriteSet {
    const view_front34 = this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'view_front34' });
    const view_front = this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'view_front' });
    const view_back = this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'view_back' });
    const view_back34 = this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'view_back34' });
    return {
      view_front34,
      view_front,
      view_back,
      view_back34,
      front: view_front,
      back: view_back,
      side_r: view_front34,
      side_l: view_back34,
      icon: this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'icon' }),
      attack: this.generateLayeredCanvas({ speciesId: species.id, chassisMaterial: mat, view: 'attack', frame: 1 }),
    };
  }

  // -------------------------------------------------------------
  // LAYER 1: CHASSIS / MATERIAL BODY
  // -------------------------------------------------------------
  private static drawChassisLayer(
    ctx: CanvasRenderingContext2D,
    mat: ChassisMaterial,
    view: SpriteView,
    brokenParts?: PartBlock
  ): void {
    const isArmsBroken = brokenParts && brokenParts.arms <= 0;

    let baseCol = '#874c26'; // Wood
    let shadowCol = '#422513';
    let lightCol = '#a3623b';
    let jointCol = '#291407';

    if (mat === 'iron') {
      baseCol = '#64748b'; shadowCol = '#334155'; lightCol = '#94a3b8'; jointCol = '#1e293b';
    } else if (mat === 'crystal') {
      baseCol = '#0284c7'; shadowCol = '#0369a1'; lightCol = '#38bdf8'; jointCol = '#0f172a';
    } else if (mat === 'stone') {
      baseCol = '#475569'; shadowCol = '#1e293b'; lightCol = '#64748b'; jointCol = '#0f172a';
    } else if (mat === 'clay') {
      baseCol = '#b45309'; shadowCol = '#78350f'; lightCol = '#d97706'; jointCol = '#451a03';
    } else if (mat === 'bone') {
      baseCol = '#fef3c7'; shadowCol = '#d97706'; lightCol = '#ffffff'; jointCol = '#92400e';
    }

    const cx = 32;
    const cy = 34;

    ctx.fillStyle = '#090d16'; // Outline

    // Head base
    ctx.fillRect(cx - 9, cy - 23, 18, 18);
    ctx.fillStyle = baseCol;
    ctx.fillRect(cx - 8, cy - 22, 16, 16);
    ctx.fillStyle = lightCol;
    ctx.fillRect(cx - 7, cy - 21, 6, 4);

    // Neck joint
    ctx.fillStyle = jointCol;
    ctx.fillRect(cx - 3, cy - 5, 6, 4);

    // Torso container box
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 11, cy - 1, 22, 22);
    ctx.fillStyle = baseCol;
    ctx.fillRect(cx - 10, cy, 20, 20);
    ctx.fillStyle = shadowCol;
    ctx.fillRect(cx - 8, cy + 12, 16, 6);

    // Core ki gem in center of torso
    ctx.fillStyle = '#5fe3d2'; // Cyan ki glow gem
    ctx.beginPath();
    ctx.arc(cx, cy + 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 9, cy + 20, 7, 18);
    ctx.fillRect(cx + 2, cy + 20, 7, 18);
    ctx.fillStyle = baseCol;
    ctx.fillRect(cx - 8, cy + 20, 5, 16);
    ctx.fillRect(cx + 3, cy + 20, 5, 16);

    // Knee joints
    ctx.fillStyle = jointCol;
    ctx.fillRect(cx - 8, cy + 27, 5, 3);
    ctx.fillRect(cx + 3, cy + 27, 5, 3);

    // Arms
    if (isArmsBroken) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - 15, cy + 4, 5, 16);
      ctx.fillRect(cx + 10, cy + 4, 5, 16);
      ctx.fillStyle = shadowCol;
      ctx.fillRect(cx - 14, cy + 5, 3, 14);
      ctx.fillRect(cx + 11, cy + 5, 3, 14);
    } else {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(cx - 15, cy + 1, 5, 18);
      ctx.fillRect(cx + 10, cy + 1, 5, 18);
      ctx.fillStyle = baseCol;
      ctx.fillRect(cx - 14, cy + 2, 3, 16);
      ctx.fillRect(cx + 11, cy + 2, 3, 16);

      // Shoulder joints
      ctx.fillStyle = jointCol;
      ctx.fillRect(cx - 14, cy + 1, 4, 4);
      ctx.fillRect(cx + 10, cy + 1, 4, 4);
    }

    // Material specific texture marks
    if (mat === 'wood') {
      ctx.fillStyle = jointCol;
      ctx.fillRect(cx - 4, cy + 3, 2, 8);
      ctx.fillRect(cx + 2, cy + 10, 2, 6);
    } else if (mat === 'iron') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 9, cy + 2, 2, 2);
      ctx.fillRect(cx + 7, cy + 2, 2, 2);
    } else if (mat === 'stone') {
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(cx - 6, cy + 14, 3, 2);
    }
  }

  // -------------------------------------------------------------
  // LAYER 2: CLASS OUTFIT
  // -------------------------------------------------------------
  private static drawClassOutfitLayer(
    ctx: CanvasRenderingContext2D,
    species: any,
    view: SpriteView,
    outfitStyle: 'clasico' | 'atrevido' = 'clasico'
  ): void {
    const isEvo = species.dexNumber % 2 === 0;
    const classId = species.classId || 'maga';

    const cx = 32;
    const cy = 34;

    const classPalettes: Record<string, { main: string; sec: string; gold: string }> = {
      maga: { main: '#ea580c', sec: '#f97316', gold: '#fef08a' },
      archimaga: { main: '#c2410c', sec: '#ef4444', gold: '#facc15' },
      sacerdotisa: { main: '#16a34a', sec: '#22c55e', gold: '#fef08a' },
      hierofante: { main: '#15803d', sec: '#4ade80', gold: '#facc15' },
      gladiadora: { main: '#b45309', sec: '#d97706', gold: '#fef08a' },
      titanide: { main: '#92400e', sec: '#f59e0b', gold: '#facc15' },
      paladin: { main: '#b45309', sec: '#d97706', gold: '#fef08a' },
      templario: { main: '#92400e', sec: '#f59e0b', gold: '#facc15' },
      bruja: { main: '#7e22ce', sec: '#a855f7', gold: '#fef08a' },
      hechicera: { main: '#6b21a8', sec: '#c084fc', gold: '#facc15' },
      hidromante: { main: '#0284c7', sec: '#38bdf8', gold: '#fef08a' },
      cantora_marea: { main: '#0369a1', sec: '#7dd3fc', gold: '#facc15' },
      monje: { main: '#ca8a04', sec: '#eab308', gold: '#fef08a' },
      maestro_trueno: { main: '#a16207', sec: '#fde047', gold: '#facc15' },
      asesina: { main: '#334155', sec: '#64748b', gold: '#cbd5e1' },
      espectro: { main: '#1e1b4b', sec: '#7e22ce', gold: '#c084fc' },
    };

    const pal = classPalettes[classId] || classPalettes['maga'];

    ctx.fillStyle = pal.main;

    // Adjust parameters for bold vs classic garment cuts
    const isAtrevido = outfitStyle === 'atrevido';
    const robeOffset = isAtrevido ? 3 : 0; // Higher cut / corset look

    if (classId.includes('maga')) {
      ctx.fillRect(cx - 9, cy + 2 + robeOffset, 18, 18 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 7, cy + 4 + robeOffset, 14, 14 - robeOffset);
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 3, cy - 22, 6, 3); // Tiara

      if (isAtrevido) {
        // Glamour accent: high thigh trims and fancy sash
        ctx.fillStyle = '#ff8fbb'; // Porcelain pink lace accents
        ctx.fillRect(cx - 9, cy + 18, 3, 2);
        ctx.fillRect(cx + 6, cy + 18, 3, 2);
      }

      if (isEvo) {
        ctx.fillStyle = pal.sec;
        ctx.fillRect(cx - 14, cy, 4, 22);
        ctx.fillRect(cx + 10, cy, 4, 22);
      }
    } else if (classId.includes('sacerdotisa') || classId.includes('hierofante')) {
      ctx.fillRect(cx - 9, cy + 2 + robeOffset, 18, 18 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 3, cy + 2 + robeOffset, 6, 18 - robeOffset); // Stole
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 5, cy - 23, 10, 3); // Root Crown
    } else if (classId.includes('paladin') || classId.includes('templario') || classId.includes('gladiadora') || classId.includes('titanide')) {
      ctx.fillRect(cx - 9, cy + 1 + robeOffset, 18, 12 - robeOffset);
      ctx.fillStyle = pal.gold;
      ctx.fillRect(cx - 4, cy + 4, 8, 6); // Crest
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 12, cy + 1, 4, 6); // Shoulder pads
      ctx.fillRect(cx + 8, cy + 1, 4, 6);
    } else if (classId.includes('bruja') || classId.includes('hechicera')) {
      ctx.fillRect(cx - 8, cy + 4 + robeOffset, 16, 16 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 32);
      ctx.lineTo(cx - 12, cy - 20);
      ctx.lineTo(cx + 12, cy - 20);
      ctx.closePath();
      ctx.fill();
    } else if (classId.includes('hidromante') || classId.includes('cantora')) {
      ctx.fillRect(cx - 9, cy + 3 + robeOffset, 18, 16 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 11, cy + 6, 22, 8);
    } else if (classId.includes('monje') || classId.includes('maestro')) {
      ctx.fillRect(cx - 8, cy + 2 + robeOffset, 16, 16 - robeOffset);
      ctx.fillStyle = '#0f172a'; // Black belt
      ctx.fillRect(cx - 8, cy + 12, 16, 3);
      if (isEvo) {
        ctx.fillStyle = pal.gold;
        ctx.fillRect(cx - 7, cy + 3, 3, 3);
        ctx.fillRect(cx + 4, cy + 3, 3, 3);
      }
    } else if (classId.includes('asesina') || classId.includes('espectro')) {
      ctx.fillRect(cx - 9, cy + 2 + robeOffset, 18, 18 - robeOffset);
      ctx.fillStyle = pal.sec;
      ctx.fillRect(cx - 8, cy - 22, 16, 6); // Cowl mask
    }

    // Eyes (visible only in front / 3/4 front views, hidden in back / 3/4 back views)
    const isBackView = view === 'back' || view === 'view_back' || view === 'view_back34';
    if (!isBackView) {
      ctx.fillStyle = pal.gold;
      const eyeOffsetX = view === 'side_r' || view === 'view_front34' ? 2 : 0;
      ctx.fillRect(cx - 4 + eyeOffsetX, cy - 16, 3, 3);
      ctx.fillRect(cx + 1 + eyeOffsetX, cy - 16, 3, 3);
    }
  }

  // -------------------------------------------------------------
  // LAYER 3: WEAPON
  // -------------------------------------------------------------
  private static drawWeaponLayer(
    ctx: CanvasRenderingContext2D,
    species: any,
    weaponId: string,
    view: SpriteView,
    frame = 0,
    brokenParts?: PartBlock
  ): void {
    if (brokenParts && brokenParts.arms <= 0) return;

    const cx = 32;
    const cy = 34;

    const isAttack = view === 'attack' || frame === 1;
    const wx = isAttack ? cx + 18 : cx + 14;
    const wy = isAttack ? cy + 2 : cy + 8;

    const weaponName = weaponId.toLowerCase();

    ctx.save();

    if (weaponName.includes('baculo') || weaponName.includes('basto') || weaponName.includes('escoba')) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(wx - 2, wy - 18, 4, 28);
      ctx.fillStyle = weaponName.includes('fuego') || weaponName.includes('solaria') ? '#ea580c' : '#22c55e';
      ctx.beginPath();
      ctx.arc(wx, wy - 20, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (weaponName.includes('martillo') || weaponName.includes('titan')) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(wx - 3, wy - 16, 6, 24);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(wx - 8, wy - 20, 16, 8);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(cx - 20, cy + 4, 8, 12);
    } else if (weaponName.includes('tridente') || weaponName.includes('cetro')) {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(wx - 2, wy - 18, 4, 28);
      ctx.fillRect(wx - 6, wy - 22, 12, 3);
      ctx.fillRect(wx - 6, wy - 26, 3, 5);
      ctx.fillRect(wx - 1, wy - 28, 3, 7);
      ctx.fillRect(wx + 4, wy - 26, 3, 5);
    } else if (weaponName.includes('guante') || weaponName.includes('nunchaku')) {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(wx - 4, wy, 8, 8);
      ctx.fillRect(cx - 18, cy + 6, 8, 8);
    } else if (weaponName.includes('daga') || weaponName.includes('espectral')) {
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(wx - 1, wy - 12, 3, 16);
      ctx.fillRect(cx - 17, cy, 3, 16);
    } else {
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(wx - 2, wy - 16, 4, 24);
      ctx.fillRect(wx - 4, wy - 20, 8, 5);
    }

    if (isAttack) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 16, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // LAYER 4: ACCESSORY & STATUS EFFECT
  // -------------------------------------------------------------
  private static drawAccessoryAndStatusLayer(
    ctx: CanvasRenderingContext2D,
    species: any,
    status: string,
    view: SpriteView
  ): void {
    const cx = 32;
    const cy = 34;

    if (!status || status === 'none') return;

    ctx.save();
    if (status === 'burn') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 12, cy + 18, 4, 4);
      ctx.fillRect(cx + 8, cy + 16, 4, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(cx - 10, cy + 16, 3, 3);
    } else if (status === 'poison') {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(cx - 10, cy - 10, 3, 0, Math.PI * 2);
      ctx.arc(cx + 10, cy - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (status === 'paralysis') {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 4); ctx.lineTo(cx - 10, cy + 4); ctx.lineTo(cx - 6, cy);
      ctx.stroke();
    } else if (status === 'sleep') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 12px monospace';
      ctx.fillText('Zzz', cx + 12, cy - 18);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // LAYER 5: DAMAGE & BROKEN PARTS OVERLAY
  // -------------------------------------------------------------
  private static drawDamageLayer(
    ctx: CanvasRenderingContext2D,
    broken: PartBlock,
    view: SpriteView
  ): void {
    const cx = 32;
    const cy = 34;

    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;

    if (broken.head <= 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 20);
      ctx.lineTo(cx + 2, cy - 14);
      ctx.lineTo(cx - 2, cy - 8);
      ctx.stroke();
    }

    if (broken.torso <= 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy + 2);
      ctx.lineTo(cx + 6, cy + 10);
      ctx.lineTo(cx - 4, cy + 18);
      ctx.stroke();
    }

    if (broken.arms <= 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 15, cy + 2, 6, 2);
      ctx.fillRect(cx + 9, cy + 2, 6, 2);
    }

    if (broken.legs <= 0) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 8, cy + 26, 5, 2);
      ctx.fillRect(cx + 3, cy + 26, 5, 2);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------
  // ICON VIEW (32x32)
  // -------------------------------------------------------------
  private static drawIconView(ctx: CanvasRenderingContext2D, species: any, mat: ChassisMaterial): void {
    const classId = species.classId || 'maga';
    const cx = 16;
    const cy = 16;

    let col = '#f97316';
    if (classId.includes('sacerdotisa') || classId.includes('hierofante')) col = '#22c55e';
    if (classId.includes('paladin') || classId.includes('templario') || classId.includes('gladiadora') || classId.includes('titanide')) col = '#b45309';
    if (classId.includes('bruja') || classId.includes('hechicera')) col = '#a855f7';
    if (classId.includes('hidromante') || classId.includes('cantora')) col = '#38bdf8';
    if (classId.includes('monje') || classId.includes('maestro')) col = '#eab308';
    if (classId.includes('asesina') || classId.includes('espectro')) col = '#7e22ce';

    ctx.fillStyle = '#090d16';
    ctx.fillRect(cx - 10, cy - 10, 20, 20);

    ctx.fillStyle = col;
    ctx.fillRect(cx - 8, cy - 8, 16, 16);

    ctx.fillStyle = '#fef08a';
    ctx.fillRect(cx - 4, cy - 4, 3, 3);
    ctx.fillRect(cx + 1, cy - 4, 3, 3);
  }
}
