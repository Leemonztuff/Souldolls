import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import {
  KitCard,
  KitBadge,
  KitButton,
  KitModal,
  KitTextInput,
  IconRegistry,
  FocusManager,
  UIKitLinter,
  UIKitLintIssue,
} from '../kit';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_ELEMENT, COLOR_STATS, RADII } from '../styles';
import { StarterLabSystem, StarterSpeciesId } from '../../systems/lab/StarterLabSystem';
import {
  buildStarterVM,
  StarterSelectVM,
  StarterOptionVM,
} from '../viewmodels/StarterSelectVM';
import { GlobalAssetRegistry } from '../../render/procedural/AssetRegistry';
import { SoulDollSpriteFactory } from '../../render/procedural/SoulDollSpriteFactory';
import { BattleIdleMesh } from '../../render/battle/BattleIdleMesh';
import { StatCalculator } from '../../systems/battle/StatCalculator';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalSceneManager } from '../../core/SceneManager';
import { GlobalEventBus } from '../../core/EventBus';
import { GlobalRng } from '../../core/Rng';
import { isDebugEnabled } from '../../core/DebugGate';
import { Souldoll } from '../../types/souldolls';
import themeTokens from '../../data/theme/theme.json';
import esText from '../../data/text/es.json';

export interface StarterSelectionModalCallbacks {
  onCancel: () => void;
  onStarterBound: (souldoll: Souldoll, rivalSpeciesId: StarterSpeciesId) => void;
}

interface AuraParticle {
  gfx: Graphics;
  baseX: number;
  baseY: number;
  phase: number;
  speed: number;
  ampY: number;
}

/**
 * BLOQUE 46: Pantalla de elección del primer Souldoll (rediseño).
 * - Separación estricta de datos con StarterSelectVM (/ui/viewmodels/StarterSelectVM.ts).
 * - Layout vertical móvil (360x640, 390x844, 412x915) y horizontal/escritorio (escenario a la izquierda y detalle a la derecha).
 * - Cabecera fija con Volver y Cerrar en espacios reservados, título autoajustable (hasta minTitlePx o 2 líneas) y subtítulo.
 * - Escenario (~38% del alto) con arco del laboratorio, tubo de cristal encendido tenuemente, 3 columnas con la elegida centrada,
 *   orbe elemental con aura animada + icono/texto de rol, orientación por ranura (centro view_front, izquierda view_front34 -> der,
 *   derecha view_front34 flipX -> izq), escala entera uniforme con pivote en los pies y máscara propia por columna.
 * - Idle por franjas (BattleIdleMesh, B39) solo en la enfocada; las demás quietas y atenuadas (brillo 0.6).
 * - Tarjetas compactas siempre en madera oscura (smokedWood) con texto pergamino, etiqueta de stat pequeña ARRIBA y valor grande ABAJO,
 *   borde dorado + resplandor suave + marcador triangular en la enfocada (70% opacidad en las demás; nunca cambia la paleta de fondo).
 * - Zona con scroll e inercia: tarjeta DETALLE (rol, arma, habilidad, lore de 3 líneas con "Ver más", 4 movimientos con icono de tipo)
 *   + tarjeta REGLA DE ORO (Soul Bottle + Cuerpo de Madera = Souldoll y recompensas).
 * - Puntos de paginación y barra inferior fija: Volver, Ver ficha (abre B40 en vista previa de solo lectura) y Elegir [nombre].
 * - Panel Debug (F2): selector de viewport (360x640, 390x844, 412x915, Horizontal), toggles de nombres largos, 4+ iniciales,
 *   arte faltante, rejilla de píxeles, cajas de límite de sprites y linter en vivo.
 */
export class StarterSelectionModal extends Container {
  public readonly focusManager: FocusManager = new FocusManager();
  private hostWidth: number;
  private hostHeight: number;
  private callbacks: StarterSelectionModalCallbacks;
  private selectedIndex = 0;

  // Scroll state (for detail & golden rule zone)
  private scrollRoot: Container = new Container();
  private scrollMask: Graphics = new Graphics();
  private scrollY = 0;
  private maxScrollY = 0;
  private velocityY = 0;
  private dragLastY: number | null = null;
  private scrollViewportH = 200;

  // Stage swipe tracking
  private stageSwipeStartX: number | null = null;

  // Active idle animator (only 1 for the focused Souldoll, B39/B46 Req 2)
  private activeIdleMesh: BattleIdleMesh | null = null;
  private focusedOrbAura: Graphics | null = null;
  private auraParticles: AuraParticle[] = [];
  private animClock = 0;
  private slotTransitionTimer = 0;
  private stageColumnsRoot: Container | null = null;

  // Modals (Confirm choice with nickname input, Read More lore modal)
  private activeConfirmOverlay: Container | null = null;
  private activeSubModal: KitModal | null = null;
  private customNickname = '';

  // Debug F2 state (Bloque 46 Req 8)
  private debugPanelOpen = false;
  private debugViewportOverride: { w: number; h: number; label: string } | null = null;
  private debugLongNames = false;
  private debugExtraStarters = false;
  private debugMissingArt = false;
  private debugPixelGrid = false;
  private debugSpriteBounds = false;
  private lastLintIssues: UIKitLintIssue[] = [];
  private boundKeyDown?: (e: KeyboardEvent) => void;

  constructor(
    screenWidth: number,
    screenHeight: number,
    callbacks: StarterSelectionModalCallbacks
  ) {
    super();
    this.roundPixels = true;
    this.hostWidth = screenWidth;
    this.hostHeight = screenHeight;
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      this.boundKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'F2' || e.code === 'F2') && isDebugEnabled()) {
          e.preventDefault();
          e.stopPropagation();
          this.debugPanelOpen = !this.debugPanelOpen;
          GlobalAudioService.playSfx('select');
          this.buildUI();
        }
      };
      window.addEventListener('keydown', this.boundKeyDown);
    }

    this.buildUI();
  }

  public override destroy(options?: any): void {
    if (typeof window !== 'undefined' && this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = undefined;
    }
    if (this.activeIdleMesh) {
      this.activeIdleMesh.destroy({ children: true });
      this.activeIdleMesh = null;
    }
    super.destroy(options);
  }

  public resize(width: number, height: number): void {
    this.hostWidth = width;
    this.hostHeight = height;
    this.buildUI();
  }

  public getEffectiveViewport(): { width: number; height: number } {
    if (this.debugViewportOverride) {
      return { width: this.debugViewportOverride.w, height: this.debugViewportOverride.h };
    }
    return { width: this.hostWidth, height: this.hostHeight };
  }

  public getCurrentVM(): StarterSelectVM {
    const state = GlobalSaveService.hasActiveState()
      ? GlobalSaveService.getCurrentState()
      : null;
    return buildStarterVM(state, undefined, {
      focusIndex: this.selectedIndex,
      debugLongNames: this.debugLongNames,
      debugExtraStarters: this.debugExtraStarters,
    });
  }

  public getLastLintIssues(): UIKitLintIssue[] {
    return this.lastLintIssues;
  }

  public selectNext(delta: number): void {
    if (this.activeConfirmOverlay || this.activeSubModal) return;
    const vm = this.getCurrentVM();
    const count = Math.max(1, vm.options.length);
    this.selectedIndex = (this.selectedIndex + delta + count) % count;
    this.slotTransitionTimer = 0.16;
    GlobalAudioService.playSfx('select');
    // Vibración suave opcional al cambiar el foco (Req 3)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(10);
      } catch (_) {
        // Ignorar en dispositivos sin soporte
      }
    }
    this.buildUI();
  }

  public confirmCurrent(): void {
    if (this.activeSubModal) return;
    if (this.activeConfirmOverlay) {
      const vm = this.getCurrentVM();
      const opt = vm.options[vm.focusIndex];
      if (opt) {
        this.executeStarterBinding(opt);
      }
      return;
    }
    const vm = this.getCurrentVM();
    const opt = vm.options[vm.focusIndex];
    if (opt) {
      this.openStarterConfirmDialog(opt);
    }
  }

  public update(dt: number): void {
    this.animClock += dt;

    // 1. Actualizar animación idle por franjas solo en la Souldoll enfocada (B39 / Req 2)
    if (this.activeIdleMesh && !this.activeConfirmOverlay && !this.activeSubModal) {
      this.activeIdleMesh.update(dt);
    }

    // 2. Transición corta al rotar ranuras (Req 2)
    if (this.slotTransitionTimer > 0 && this.stageColumnsRoot) {
      this.slotTransitionTimer = Math.max(0, this.slotTransitionTimer - dt);
      const p = 1 - this.slotTransitionTimer / 0.16;
      this.stageColumnsRoot.alpha = 0.78 + 0.22 * p;
    }

    // 3. Animación de pulso del orbe y partículas con pool fijo (0 asignaciones por frame, Req 7)
    if (this.focusedOrbAura) {
      this.focusedOrbAura.alpha = 0.32 + 0.16 * Math.sin(this.animClock * 3.6);
    }
    for (let i = 0; i < this.auraParticles.length; i++) {
      const pt = this.auraParticles[i];
      pt.gfx.position.y = Math.round(
        pt.baseY + Math.sin(this.animClock * pt.speed + pt.phase) * pt.ampY
      );
    }

    // 4. Inercia de scroll de la zona inferior
    if (this.dragLastY === null && Math.abs(this.velocityY) > 0.4 && this.maxScrollY > 0) {
      this.setScroll(this.scrollY - this.velocityY);
      this.velocityY *= 0.9;
    }

    if (this.activeSubModal) {
      this.activeSubModal.updateTween(dt);
    }
  }

  private getElementColors(elemName: string): { primary: number; secondary: number } {
    const norm = (elemName || 'neutro')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') as keyof typeof COLOR_ELEMENT;
    return COLOR_ELEMENT[norm] || COLOR_ELEMENT.neutro;
  }

  private buildUI(): void {
    if (this.activeIdleMesh) {
      this.activeIdleMesh.destroy({ children: true });
      this.activeIdleMesh = null;
    }
    this.focusedOrbAura = null;
    this.auraParticles = [];
    this.stageColumnsRoot = null;

    this.removeChildren();
    this.focusManager.clear();

    const vm = this.getCurrentVM();
    this.selectedIndex = vm.focusIndex;
    const focusedOpt = vm.options[vm.focusIndex];
    const t = (esText as any).terms.starter_select;

    // Telón de fondo oscuro completo sobre el host
    const backdrop = new Graphics();
    backdrop.rect(0, 0, this.hostWidth, this.hostHeight);
    backdrop.fill({ color: COLOR_NUM.black, alpha: 0.78 });
    backdrop.eventMode = 'static';
    this.addChild(backdrop);

    const vp = this.getEffectiveViewport();
    const w = Math.max(320, Math.min(this.hostWidth, vp.width));
    const h = Math.max(540, Math.min(this.hostHeight, vp.height));
    const offsetX = Math.round((this.hostWidth - w) / 2);
    const offsetY = Math.round((this.hostHeight - h) / 2);

    const screenRoot = new Container();
    screenRoot.roundPixels = true;
    screenRoot.position.set(offsetX, offsetY);
    this.addChild(screenRoot);

    // Marco general tallado en cripta y bronce
    const frameBg = new Graphics();
    frameBg.rect(0, 0, w, h);
    frameBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.99 });
    frameBg.roundRect(2, 2, w - 4, h - 4, RADII.lg);
    frameBg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    frameBg.roundRect(5, 5, w - 10, h - 10, RADII.md);
    frameBg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.5 });
    screenRoot.addChild(frameBg);

    const isLandscape = w >= 700 && w > h;

    // =========================================================================
    // 1. CABECERA FIJA (Botón Volver a la izq, Cerrar a la der, Título autoajustable + Subtítulo)
    // =========================================================================
    const headerX = 8;
    const headerY = 8;
    const headerW = w - 16;
    const headerH = 56;

    const header = new Container();
    header.roundPixels = true;
    header.position.set(headerX, headerY);
    screenRoot.addChild(header);

    const hBg = new Graphics();
    hBg.roundRect(0, 0, headerW, headerH, RADII.md);
    hBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    hBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    header.addChild(hBg);

    const backHeaderBtn = new KitButton({
      iconId: 'back',
      variant: 'icon',
      width: 44,
      height: 44,
      onClick: () => {
        GlobalAudioService.playSfx('cancel');
        this.callbacks.onCancel();
      },
    });
    backHeaderBtn.position.set(6, 6);
    header.addChild(backHeaderBtn);

    const closeHeaderBtn = new KitButton({
      iconId: 'close',
      variant: 'danger',
      width: 44,
      height: 44,
      onClick: () => {
        GlobalAudioService.playSfx('cancel');
        this.callbacks.onCancel();
      },
    });
    closeHeaderBtn.position.set(headerW - 50, 6);
    header.addChild(closeHeaderBtn);

    // Espacio reservado entre Volver (x=54) y Cerrar (x=headerW-54)
    const titleAreaLeft = 56;
    const titleAreaW = Math.max(120, headerW - 112);
    const minTitlePx = (themeTokens.typography as any).minTitlePx || 15;

    let titleFontSize = 18;
    const titleTxt = new Text({
      text: vm.title,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: titleFontSize,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        align: 'center',
      }),
    });
    titleTxt.roundPixels = true;

    while (titleTxt.width > titleAreaW && titleFontSize > minTitlePx) {
      titleFontSize--;
      titleTxt.style.fontSize = titleFontSize;
    }
    if (titleTxt.width > titleAreaW) {
      titleTxt.style.wordWrap = true;
      titleTxt.style.wordWrapWidth = titleAreaW;
      titleTxt.style.lineHeight = minTitlePx + 2;
    }
    titleTxt.anchor.set(0.5, 0);
    titleTxt.position.set(Math.round(titleAreaLeft + titleAreaW / 2), 6);
    header.addChild(titleTxt);

    const subTxt = new Text({
      text: vm.step,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    subTxt.roundPixels = true;
    subTxt.anchor.set(0.5, 1);
    subTxt.position.set(Math.round(titleAreaLeft + titleAreaW / 2), headerH - 5);
    header.addChild(subTxt);

    // =========================================================================
    // 2. BARRA INFERIOR FIJA (Volver | Ver ficha | Elegir [nombre]) + PUNTOS DE PAGINACIÓN
    // =========================================================================
    const footerH = 54;
    const footerY = h - 8 - footerH;
    const paginationH = 16;
    const paginationY = footerY - paginationH - 2;

    this.buildPaginationDots(screenRoot, w, paginationY, vm);
    this.buildBottomActionBar(screenRoot, headerX, footerY, headerW, footerH, focusedOpt);

    // =========================================================================
    // 3. CUERPO CENTRAL (Vertical vs Horizontal/Escritorio)
    // =========================================================================
    const bodyTopY = headerY + headerH + 6;
    const bodyAvailH = paginationY - bodyTopY - 4;
    const contentW = w - 16;

    if (!isLandscape) {
      // MÓVIL VERTICAL:
      // - Escenario (~36-38% del alto total, ajustado para que quepan tarjetas y zona scroll)
      const stageH = Math.max(168, Math.min(256, Math.round(h * 0.34)));
      const compactH = 88;
      const stageContainer = this.buildStageAndCompactCards(
        contentW,
        stageH,
        compactH,
        vm
      );
      stageContainer.position.set(8, bodyTopY);
      screenRoot.addChild(stageContainer);

      const scrollTopY = bodyTopY + stageH + compactH + 8;
      const scrollH = Math.max(96, paginationY - scrollTopY - 4);
      this.buildScrollableDetailsArea(
        screenRoot,
        8,
        scrollTopY,
        contentW,
        scrollH,
        vm,
        focusedOpt
      );
    } else {
      // HORIZONTAL / ESCRITORIO: Escenario + tarjetas compactas a la izquierda, Detalle + Regla de Oro a la derecha
      const leftW = Math.floor(contentW * 0.54);
      const rightW = contentW - leftW - 10;
      const compactH = 90;
      const stageH = Math.max(168, bodyAvailH - compactH - 6);

      const stageContainer = this.buildStageAndCompactCards(
        leftW,
        stageH,
        compactH,
        vm
      );
      stageContainer.position.set(8, bodyTopY);
      screenRoot.addChild(stageContainer);

      this.buildScrollableDetailsArea(
        screenRoot,
        8 + leftW + 10,
        bodyTopY,
        rightW,
        bodyAvailH,
        vm,
        focusedOpt
      );
    }

    // Rejilla de píxeles opcional en modo Debug (F2)
    if (this.debugPixelGrid) {
      const gridGfx = new Graphics();
      for (let gx = 0; gx < w; gx += 16) {
        gridGfx.moveTo(gx, 0).lineTo(gx, h);
      }
      for (let gy = 0; gy < h; gy += 16) {
        gridGfx.moveTo(0, gy).lineTo(w, gy);
      }
      gridGfx.stroke({ color: COLOR_NUM.cyan, width: 1, alpha: 0.14 });
      screenRoot.addChild(gridGfx);
    }

    // Linter en vivo (Bloque 41 Req 8 & Bloque 46 Req 8)
    this.lastLintIssues = UIKitLinter.inspectTree(screenRoot, 'StarterSelectionModal');

    // Panel Debug F2 superpuesto si está abierto
    if (this.debugPanelOpen && isDebugEnabled()) {
      this.buildDebugOverlay(screenRoot, w, h);
    }
  }

  /**
   * Construye el ESCENARIO del laboratorio (arco, pedestal, tubo de cristal encendido tenuemente,
   * 3 columnas con la elegida siempre en el centro, orbes elementales + icono/rol, escalas enteras
   * con máscara propia) y debajo las 3 TARJETAS COMPACTAS de madera oscura.
   */
  private buildStageAndCompactCards(
    areaW: number,
    stageH: number,
    compactH: number,
    vm: StarterSelectVM
  ): Container {
    const wrapper = new Container();
    wrapper.roundPixels = true;

    const stage = new Container();
    stage.roundPixels = true;
    wrapper.addChild(stage);

    // 1. Fondo arquitectónico del Laboratorio (arco gótico/artífice + tubo de cristal encendido tenuemente)
    const bg = new Graphics();
    bg.roundRect(0, 0, areaW, stageH, RADII.md);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });

    // Arco de piedra tallada al fondo
    const archCx = Math.round(areaW / 2);
    const archW = Math.round(areaW * 0.86);
    bg.roundRect(Math.round((areaW - archW) / 2), 8, archW, stageH - 14, RADII.lg);
    bg.stroke({ color: COLOR_NUM.smokedWood, width: 4 });

    // Tubo de cristal de resonancia encendido tenuemente en la columna central (Req 2)
    const tubeW = Math.min(82, Math.round(areaW * 0.24));
    const tubeH = Math.round(stageH * 0.68);
    const tubeX = Math.round(archCx - tubeW / 2);
    const tubeY = Math.round(stageH * 0.16);

    bg.roundRect(tubeX, tubeY, tubeW, tubeH, 8);
    bg.fill({ color: COLOR_NUM.cyan, alpha: 0.09 });
    bg.stroke({ color: COLOR_NUM.cyan, width: 1.5, alpha: 0.35 });
    // Base y capitel de bronce del tubo
    bg.roundRect(tubeX - 4, tubeY - 4, tubeW + 8, 6, 2);
    bg.roundRect(tubeX - 6, tubeY + tubeH - 4, tubeW + 12, 8, 2);
    bg.fill({ color: COLOR_NUM.bronze, alpha: 0.75 });
    stage.addChild(bg);

    // Soporte de deslizar con el dedo (swipe horizontal) en el escenario
    stage.eventMode = 'static';
    stage.on('pointerdown', (e) => {
      this.stageSwipeStartX = e.global.x;
    });
    stage.on('pointerup', (e) => {
      if (this.stageSwipeStartX !== null) {
        const dx = e.global.x - this.stageSwipeStartX;
        this.stageSwipeStartX = null;
        if (Math.abs(dx) > 28) {
          this.selectNext(dx < 0 ? 1 : -1);
        }
      }
    });
    stage.on('pointerupoutside', () => {
      this.stageSwipeStartX = null;
    });

    // 2. Tres ranuras visibles con la elegida SIEMPRE en el centro (slot 0 = izq, slot 1 = centro, slot 2 = der)
    const count = vm.options.length;
    const leftIdx = (vm.focusIndex - 1 + count) % count;
    const centerIdx = vm.focusIndex;
    const rightIdx = (vm.focusIndex + 1) % count;
    const slotIndices = [leftIdx, centerIdx, rightIdx];

    const colGap = 6;
    const colW = Math.floor((areaW - colGap * 2) / 3);

    const columnsRoot = new Container();
    columnsRoot.roundPixels = true;
    this.stageColumnsRoot = columnsRoot;
    stage.addChild(columnsRoot);

    const compactRow = new Container();
    compactRow.roundPixels = true;
    compactRow.position.set(0, stageH + 4);
    wrapper.addChild(compactRow);

    // Calcular la mayor escala entera que quepa en ~70% del alto del escenario
    const sampleTex = GlobalAssetRegistry.getCreatureSpritePixi(
      vm.options[centerIdx].soulSpeciesId,
      'view_front'
    );
    const nativeH = Math.max(64, sampleTex?.height || 156);
    const maxAllowedSpriteH = stageH * 0.7;
    const centerIntScale = Math.max(1, Math.floor(maxAllowedSpriteH / nativeH));
    const sideIntScale = centerIntScale - 1 >= 1 ? centerIntScale - 1 : centerIntScale;
    const dimSideBrightness = sideIntScale === centerIntScale;

    slotIndices.forEach((optIdx, slotPos) => {
      const opt = vm.options[optIdx];
      const isCenter = slotPos === 1;
      const colX = slotPos * (colW + colGap);
      const elemColors = this.getElementColors(opt.element);

      // --- A) COLUMNA DEL ESCENARIO CON MÁSCARA PROPIA ---
      const slotContainer = new Container();
      slotContainer.roundPixels = true;
      slotContainer.position.set(colX, 0);
      slotContainer.eventMode = 'static';
      slotContainer.cursor = 'pointer';
      slotContainer.on('pointerdown', (e) => {
        e.stopPropagation();
        if (!isCenter) {
          this.selectNext(slotPos === 0 ? -1 : 1);
        } else {
          this.openStarterConfirmDialog(opt);
        }
      });
      columnsRoot.addChild(slotContainer);

      const slotMask = new Graphics();
      slotMask.rect(0, 0, colW, stageH);
      slotMask.fill({ color: COLOR_NUM.white });
      slotContainer.addChild(slotMask);

      const maskedContent = new Container();
      maskedContent.roundPixels = true;
      maskedContent.mask = slotMask;
      slotContainer.addChild(maskedContent);

      // Pedestal de piedra con sombra elíptica en la base de la columna
      const pedCx = Math.round(colW / 2);
      const pedCy = stageH - (isCenter ? 16 : 22);
      const pedRx = Math.min(42, Math.round(colW * 0.4));
      const pedRy = isCenter ? 10 : 8;

      const pedestal = new Graphics();
      // Sombra elíptica
      pedestal.ellipse(pedCx, pedCy + 4, pedRx + 4, pedRy + 2);
      pedestal.fill({ color: COLOR_NUM.black, alpha: 0.55 });
      // Base de piedra tallada
      pedestal.ellipse(pedCx, pedCy, pedRx, pedRy);
      pedestal.fill({ color: COLOR_NUM.smokedWood, alpha: 0.96 });
      pedestal.stroke({
        color: isCenter ? COLOR_NUM.gold : COLOR_NUM.bronze,
        width: isCenter ? 2 : 1.5,
      });
      // Anillo de resonancia elemental
      pedestal.ellipse(pedCx, pedCy - 1, Math.max(10, pedRx - 6), Math.max(4, pedRy - 3));
      pedestal.fill({ color: elemColors.primary, alpha: isCenter ? 0.35 : 0.16 });
      maskedContent.addChild(pedestal);

      // Partículas de aura con pool estático (solo en la enfocada)
      if (isCenter) {
        for (let p = 0; p < 4; p++) {
          const pGfx = new Graphics();
          pGfx.circle(0, 0, 2.5);
          pGfx.fill({ color: elemColors.secondary, alpha: 0.85 });
          const bx = pedCx + (p % 2 === 0 ? -1 : 1) * (14 + p * 6);
          const by = pedCy - 24 - p * 18;
          pGfx.position.set(bx, by);
          maskedContent.addChild(pGfx);
          this.auraParticles.push({
            gfx: pGfx,
            baseX: bx,
            baseY: by,
            phase: p * 1.3,
            speed: 2.4 + p * 0.3,
            ampY: 4,
          });
        }
      }

      // Orientación por ranura (Req 2):
      // - slot 1 (centro): view_front (frente)
      // - slot 0 (izquierda): view_front34 mirando a la derecha (flipX = false)
      // - slot 2 (derecha): view_front34 espejada (flipX = true) mirando a la izquierda
      const targetView = isCenter ? 'view_front' : 'view_front34';
      const flipX = slotPos === 2;
      const scaleInt = isCenter ? centerIntScale : sideIntScale;

      const tex = this.debugMissingArt
        ? GlobalAssetRegistry.createCrispPixiTexture(
            SoulDollSpriteFactory.generateLayeredCanvas({
              speciesId: opt.soulSpeciesId,
              chassisMaterial: 'wood',
              weaponId: opt.weaponId,
              view: targetView,
            })
          )
        : GlobalAssetRegistry.getCreatureSpritePixi(opt.soulSpeciesId, targetView);

      if (isCenter) {
        // El idle por franjas (B39) solo corre en la enfocada
        const meta = GlobalAssetRegistry.getCreatureFrameMeta(opt.soulSpeciesId, targetView);
        const bustMode = GlobalSaveService.hasActiveState()
          ? GlobalSaveService.getCurrentState().settings?.bustAnimation || 'subtle'
          : 'subtle';
        const idleMesh = new BattleIdleMesh({
          texture: tex,
          idleMeta: meta.idle,
          bustMode,
        });
        idleMesh.setIntegerScale(scaleInt, flipX);
        idleMesh.position.set(pedCx, pedCy);
        (idleMesh as any).__requireIntegerScale = true;
        maskedContent.addChild(idleMesh);
        this.activeIdleMesh = idleMesh;
      } else {
        // Las laterales quedan quietas (ahorra rendimiento) y atenuadas (brillo 0.6 si comparten escala)
        const spr = new Sprite(tex);
        spr.roundPixels = true;
        spr.anchor.set(0.5, 1.0); // Pivote en los pies (I-07)
        spr.scale.set(flipX ? -scaleInt : scaleInt, scaleInt);
        spr.position.set(pedCx, pedCy);
        if (dimSideBrightness) {
          spr.tint = 0x999999; // Brillo ~0.6 sin cambiar colores de paleta
        }
        (spr as any).__requireIntegerScale = true;
        maskedContent.addChild(spr);
      }

      // Caja de límite de sprite en modo Debug F2
      if (this.debugSpriteBounds) {
        const bw = Math.round((tex?.width || 64) * scaleInt);
        const bh = Math.round((tex?.height || 140) * scaleInt);
        const boxGfx = new Graphics();
        boxGfx.rect(pedCx - Math.round(bw / 2), pedCy - bh, bw, bh);
        boxGfx.stroke({ color: COLOR_NUM.gold, width: 1 });
        maskedContent.addChild(boxGfx);
      }

      // Orbe elemental + aura animada + icono de rol + texto encima de cada Souldoll (Req 2: no depende solo del color)
      const badgePillW = Math.min(colW - 6, 108);
      const badgePillH = 22;
      const badgePillX = Math.round((colW - badgePillW) / 2);
      const badgePillY = isCenter ? 6 : 12;

      if (isCenter) {
        const aura = new Graphics();
        aura.roundRect(badgePillX - 3, badgePillY - 3, badgePillW + 6, badgePillH + 6, 12);
        aura.fill({ color: elemColors.primary, alpha: 0.35 });
        maskedContent.addChild(aura);
        this.focusedOrbAura = aura;
      }

      const orbBadge = new Graphics();
      orbBadge.roundRect(badgePillX, badgePillY, badgePillW, badgePillH, 10);
      orbBadge.fill({ color: COLOR_NUM.smokedWood, alpha: 0.94 });
      orbBadge.stroke({
        color: isCenter ? elemColors.primary : COLOR_NUM.bronze,
        width: isCenter ? 2 : 1.5,
      });
      // Orbe elemental circular a la izquierda del chip
      orbBadge.circle(badgePillX + 11, badgePillY + 11, 6);
      orbBadge.fill({ color: elemColors.primary });
      orbBadge.circle(badgePillX + 9, badgePillY + 9, 2);
      orbBadge.fill({ color: elemColors.secondary });
      maskedContent.addChild(orbBadge);

      const roleIcon = IconRegistry.create(opt.roleIconId, 12);
      roleIcon.position.set(badgePillX + 20, badgePillY + 5);
      maskedContent.addChild(roleIcon);

      const elemRoleTxt = new Text({
        text: opt.element.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 12,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      elemRoleTxt.roundPixels = true;
      elemRoleTxt.anchor.set(0, 0.5);
      elemRoleTxt.position.set(badgePillX + 35, badgePillY + 11);
      maskedContent.addChild(elemRoleTxt);

      // --- B) TARJETA COMPACTA DEBAJO DE CADA COLUMNA ---
      const compactCard = this.buildCompactStatCard(colW, compactH, opt, isCenter, () => {
        if (!isCenter) {
          this.selectNext(slotPos === 0 ? -1 : 1);
        } else {
          this.openStarterConfirmDialog(opt);
        }
      });
      compactCard.position.set(colX, 0);
      compactRow.addChild(compactCard);
    });

    // 3. Flechas laterales < > (zonas táctiles >= 44x44 px)
    const arrowY = Math.round(stageH / 2 - 22);
    const prevArrow = new KitButton({
      iconId: 'chevron_left',
      variant: 'icon',
      width: 44,
      height: 44,
      onClick: () => this.selectNext(-1),
    });
    prevArrow.position.set(4, arrowY);
    stage.addChild(prevArrow);

    const nextArrow = new KitButton({
      iconId: 'chevron_right',
      variant: 'icon',
      width: 44,
      height: 44,
      onClick: () => this.selectNext(1),
    });
    nextArrow.position.set(areaW - 48, arrowY);
    stage.addChild(nextArrow);

    return wrapper;
  }

  /**
   * TARJETA COMPACTA (Req 2):
   * - Fondo SIEMPRE de madera oscura (smokedWood) con texto pergamino (el foco NUNCA cambia la paleta de fondo).
   * - Nombre (Cinzel, ellipsis), "Nv. 5", y 3 cajas de stat (PS, AT.ESP o ATK, VEL) con etiqueta pequeña ARRIBA
   *   y valor grande ABAJO, sin solapes.
   * - Enfocada: borde dorado, resplandor suave y marcador triangular bajo la tarjeta; las demás al 70% de opacidad.
   */
  private buildCompactStatCard(
    cardW: number,
    cardH: number,
    opt: StarterOptionVM,
    isFocused: boolean,
    onSelect: () => void
  ): Container {
    const t = (esText as any).terms.starter_select;
    const c = new Container();
    c.roundPixels = true;
    c.alpha = isFocused ? 1.0 : 0.7;
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointerdown', (e) => {
      e.stopPropagation();
      onSelect();
    });

    const bg = new Graphics();
    if (isFocused) {
      // Resplandor suave exterior dorado
      bg.roundRect(-2, -2, cardW + 4, cardH + 4, RADII.md + 2);
      bg.stroke({ color: COLOR_NUM.gold, width: 2, alpha: 0.45 });
    }
    // Fondo SIEMPRE smokedWood
    bg.roundRect(0, 0, cardW, cardH, RADII.md);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    bg.stroke({
      color: isFocused ? COLOR_NUM.gold : COLOR_NUM.bronze,
      width: isFocused ? 2.5 : 1.5,
    });

    // Marcador triangular bajo la tarjeta enfocada (accesibilidad: foco no depende solo del color)
    if (isFocused) {
      const midX = Math.round(cardW / 2);
      bg.poly([
        { x: midX - 6, y: cardH },
        { x: midX + 6, y: cardH },
        { x: midX, y: cardH + 6 },
      ]);
      bg.fill({ color: COLOR_NUM.gold });
    }
    c.addChild(bg);

    // Nombre en Cinzel con ellipsis medido
    const maxNameW = cardW - 10;
    let displayName = opt.name.toUpperCase();
    const nameTxt = new Text({
      text: displayName,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 14,
        fontWeight: 'bold',
        fill: isFocused ? COLOR_HEX.gold : COLOR_HEX.parchment,
      }),
    });
    nameTxt.roundPixels = true;
    while (nameTxt.width > maxNameW && displayName.length > 4) {
      displayName = `${displayName.slice(0, -2)}…`;
      nameTxt.text = displayName;
    }
    nameTxt.anchor.set(0.5, 0);
    nameTxt.position.set(Math.round(cardW / 2), 5);
    c.addChild(nameTxt);

    // Nivel ("Nv. 5") debajo del nombre
    const lvlTxt = new Text({
      text: t.level_badge.replace('{level}', String(opt.level)),
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    lvlTxt.roundPixels = true;
    lvlTxt.anchor.set(0.5, 0);
    lvlTxt.position.set(Math.round(cardW / 2), 22);
    c.addChild(lvlTxt);

    // 3 cajas de stat (PS, AT.ESP|ATK, VEL) con etiqueta pequeña ARRIBA y valor grande ABAJO
    const statItems = [
      { key: 'hp' as const, label: t.stat_hp, val: opt.stats.hp },
      {
        key: opt.stats.isSpAtk ? ('spAtk' as const) : ('atk' as const),
        label: opt.stats.primaryAtkLabel,
        val: opt.stats.primaryAtk,
      },
      { key: 'speed' as const, label: t.stat_speed, val: opt.stats.speed },
    ];

    const statGap = 3;
    const padX = 4;
    const boxW = Math.floor((cardW - padX * 2 - statGap * 2) / 3);
    const boxH = 42;
    const boxY = cardH - boxH - 5;

    statItems.forEach((st, idx) => {
      const bx = padX + idx * (boxW + statGap);
      const pal = COLOR_STATS[st.key];

      const sBox = new Container();
      sBox.roundPixels = true;
      sBox.position.set(bx, boxY);

      const sBg = new Graphics();
      sBg.roundRect(0, 0, boxW, boxH, RADII.sm);
      sBg.fill({ color: pal.bg, alpha: 0.96 });
      sBg.stroke({ color: pal.border, width: 1 });
      sBox.addChild(sBg);

      // Etiqueta pequeña ARRIBA (centrada, sin solapar el valor)
      const lbl = new Text({
        text: st.label,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 10,
          fontWeight: 'bold',
          fill: pal.labelHex,
        }),
      });
      lbl.roundPixels = true;
      lbl.anchor.set(0.5, 0);
      lbl.position.set(Math.round(boxW / 2), 3);
      sBox.addChild(lbl);

      // Valor grande ABAJO (>= 16 px en fuente HUD pixel)
      const val = new Text({
        text: String(st.val),
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      val.roundPixels = true;
      val.anchor.set(0.5, 1);
      val.position.set(Math.round(boxW / 2), boxH - 2);
      sBox.addChild(val);

      c.addChild(sBox);
    });

    return c;
  }

  /**
   * Zona con scroll e inercia entre las tarjetas compactas y la barra inferior:
   * - Tarjeta DETALLE de la enfocada (rol, arma, habilidad, lore recortado a 3 líneas con "Ver más", 4 movimientos con icono de tipo)
   * - Tarjeta REGLA DE ORO (Soul Bottle + Cuerpo de Madera = Souldoll; debajo recompensas recibidas)
   */
  private buildScrollableDetailsArea(
    parent: Container,
    x: number,
    y: number,
    width: number,
    height: number,
    vm: StarterSelectVM,
    opt: StarterOptionVM
  ): void {
    const t = (esText as any).terms.starter_select;
    this.scrollViewportH = height;

    const viewport = new Container();
    viewport.roundPixels = true;
    viewport.position.set(x, y);
    parent.addChild(viewport);

    this.scrollMask = new Graphics();
    this.scrollMask.rect(0, 0, width, height);
    this.scrollMask.fill({ color: COLOR_NUM.white });
    viewport.addChild(this.scrollMask);

    this.scrollRoot = new Container();
    this.scrollRoot.roundPixels = true;
    this.scrollRoot.mask = this.scrollMask;
    viewport.addChild(this.scrollRoot);

    let curY = 0;

    // --- 1. TARJETA DETALLE DE LA SOULDOLL ENFOCADA ---
    const detailH = 228;
    const detailCard = new KitCard({
      width,
      height: detailH,
      variant: 'smokedWood',
      title: `${t.detail_title} · ${opt.name.toUpperCase()}`,
    });
    detailCard.position.set(0, curY);
    this.scrollRoot.addChild(detailCard);

    // Fila de metadatos: Rol + Arma + Habilidad (usando Nunito para soportar puntuación clara)
    const metaText = new Text({
      text: `${t.label_role} ${opt.roleText}   ·   ${t.label_weapon} ${opt.weaponName}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        wordWrap: true,
        wordWrapWidth: width - 24,
      }),
    });
    metaText.roundPixels = true;
    metaText.position.set(12, 32);
    detailCard.addChild(metaText);

    const abilText = new Text({
      text: `${t.label_ability} ${opt.abilityName} — ${opt.abilityDescription}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: width - 24,
      }),
    });
    abilText.roundPixels = true;
    abilText.position.set(12, 54);
    detailCard.addChild(abilText);

    // Lore recortado a máx. 3 líneas con botón "Ver más" que abre modal (Req 2)
    const fullLore = `${opt.flavor} ${opt.soulBottleFlavor}`;
    const maxChars3Lines = Math.max(85, Math.floor((width - 110) * 0.36));
    const truncatedLore =
      fullLore.length > maxChars3Lines
        ? `${fullLore.slice(0, maxChars3Lines).trim()}…`
        : fullLore;

    const loreTxt = new Text({
      text: truncatedLore,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.smoke,
        wordWrap: true,
        wordWrapWidth: width - 116,
        lineHeight: 18,
      }),
    });
    loreTxt.roundPixels = true;
    loreTxt.position.set(12, 92);
    detailCard.addChild(loreTxt);

    const readMoreBtn = new KitButton({
      label: t.btn_read_more,
      variant: 'secondary',
      width: 88,
      height: 44,
      onClick: () => this.openReadMoreModal(opt),
    });
    readMoreBtn.position.set(width - 98, 92);
    detailCard.addChild(readMoreBtn);

    // Cuadrícula de 4 movimientos con icono y color de tipo
    const movesY = 148;
    const mGap = 6;
    const mColW = Math.floor((width - 24 - mGap) / 2);
    const mRowH = 32;

    opt.moves.slice(0, 4).forEach((mv, mIdx) => {
      const mx = 12 + (mIdx % 2) * (mColW + mGap);
      const my = movesY + Math.floor(mIdx / 2) * (mRowH + 4);
      const mElem = this.getElementColors(mv.type);

      const mChip = new Container();
      mChip.roundPixels = true;
      mChip.position.set(mx, my);

      const mBg = new Graphics();
      mBg.roundRect(0, 0, mColW, mRowH, RADII.sm);
      mBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
      mBg.stroke({ color: mElem.primary, width: 1.5 });
      mBg.circle(12, Math.round(mRowH / 2), 5);
      mBg.fill({ color: mElem.primary });
      mChip.addChild(mBg);

      const mName = new Text({
        text: mv.name,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      mName.roundPixels = true;
      mName.anchor.set(0, 0.5);
      mName.position.set(22, Math.round(mRowH / 2));
      mChip.addChild(mName);

      detailCard.addChild(mChip);
    });

    curY += detailH + 8;

    // --- 2. TARJETA REGLA DE ORO (Frasco con el alma + Cuerpo de Madera = Souldoll) ---
    const goldenH = 104;
    const goldenCard = new KitCard({
      width,
      height: goldenH,
      variant: 'inkCrypt',
      title: t.golden_rule_title,
    });
    goldenCard.position.set(0, curY);
    this.scrollRoot.addChild(goldenCard);

    // Diagrama de iconos: [Soul Bottle] + [Cuerpo de Madera] = [Souldoll]
    const diagY = 34;
    const bottleIc = IconRegistry.create('soul_bottle', 20);
    bottleIc.position.set(14, diagY);
    goldenCard.addChild(bottleIc);

    const chassisIc = IconRegistry.create('body_chassis', 20);
    chassisIc.position.set(42, diagY);
    goldenCard.addChild(chassisIc);

    const orbIc = IconRegistry.create('soul_orb', 20);
    orbIc.position.set(70, diagY);
    goldenCard.addChild(orbIc);

    // Usamos Nunito (FONTS.body) para que los paréntesis "(Alma)" jamás se rendericen como llaves
    const formulaTxt = new Text({
      text: t.golden_rule_formula,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        wordWrap: true,
        wordWrapWidth: width - 108,
      }),
    });
    formulaTxt.roundPixels = true;
    formulaTxt.position.set(96, diagY + 1);
    goldenCard.addChild(formulaTxt);

    const rewardsStr = t.golden_rule_rewards
      .replace('{level}', String(vm.rewards.level))
      .replace('{bodyName}', vm.rewards.bodyName)
      .replace('{bottlesCount}', String(vm.rewards.bottlesCount))
      .replace('{elixirCount}', String(vm.rewards.elixirCount));

    const rewardsTxt = new Text({
      text: rewardsStr,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: width - 24,
      }),
    });
    rewardsTxt.roundPixels = true;
    rewardsTxt.position.set(14, 62);
    goldenCard.addChild(rewardsTxt);

    curY += goldenH + 8;

    this.maxScrollY = Math.max(0, curY - this.scrollViewportH);
    this.setScroll(Math.min(this.scrollY, this.maxScrollY));

    // Eventos de arrastre vertical con inercia
    viewport.eventMode = 'static';
    viewport.on('pointerdown', (e) => {
      this.dragLastY = e.global.y;
      this.velocityY = 0;
    });
    viewport.on('pointermove', (e) => {
      if (this.dragLastY !== null && this.maxScrollY > 0) {
        const dy = e.global.y - this.dragLastY;
        this.dragLastY = e.global.y;
        this.velocityY = dy;
        this.setScroll(this.scrollY - dy);
      }
    });
    viewport.on('pointerup', () => {
      this.dragLastY = null;
    });
    viewport.on('pointerupoutside', () => {
      this.dragLastY = null;
    });
  }

  private setScroll(newY: number): void {
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, Math.round(newY)));
    this.scrollRoot.position.y = -this.scrollY;
  }

  /**
   * Puntos de paginación (3+) encima de la barra inferior
   */
  private buildPaginationDots(
    parent: Container,
    screenW: number,
    y: number,
    vm: StarterSelectVM
  ): void {
    const dots = new Graphics();
    const count = vm.options.length;
    const spacing = 18;
    const totalW = (count - 1) * spacing;
    const startX = Math.round(screenW / 2 - totalW / 2);
    const cy = y + 8;

    for (let i = 0; i < count; i++) {
      const dx = startX + i * spacing;
      const isAct = i === vm.focusIndex;
      if (isAct) {
        dots.roundRect(dx - 7, cy - 4, 14, 8, 4);
        dots.fill({ color: COLOR_NUM.gold });
      } else {
        dots.circle(dx, cy, 3.5);
        dots.fill({ color: COLOR_NUM.bronze, alpha: 0.7 });
      }
    }
    parent.addChild(dots);
  }

  /**
   * Barra inferior fija con 3 botones:
   * - Volver (secundario, izquierda)
   * - Ver ficha (secundario, centro, abre la ficha B40 en vista previa de solo lectura)
   * - Elegir [nombre] (primario, derecha)
   */
  private buildBottomActionBar(
    parent: Container,
    x: number,
    y: number,
    width: number,
    height: number,
    focusedOpt: StarterOptionVM
  ): void {
    const t = (esText as any).terms.starter_select;
    const footer = new Container();
    footer.roundPixels = true;
    footer.position.set(x, y);
    parent.addChild(footer);

    const fBg = new Graphics();
    fBg.roundRect(0, 0, width, height, RADII.md);
    fBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    fBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    footer.addChild(fBg);

    const pad = 6;
    const gap = 6;
    const availW = width - pad * 2 - gap * 2;
    const backW = Math.max(76, Math.floor(availW * 0.25));
    const sheetW = Math.max(92, Math.floor(availW * 0.31));
    const chooseW = availW - backW - sheetW;

    const btnBack = new KitButton({
      label: t.btn_back,
      variant: 'secondary',
      width: backW,
      height: 44,
      onClick: () => {
        GlobalAudioService.playSfx('cancel');
        this.callbacks.onCancel();
      },
    });
    btnBack.position.set(pad, 5);
    footer.addChild(btnBack);

    const btnSheet = new KitButton({
      label: t.btn_sheet,
      variant: 'secondary',
      width: sheetW,
      height: 44,
      onClick: () => this.openPreviewSheet(focusedOpt),
    });
    btnSheet.position.set(pad + backW + gap, 5);
    footer.addChild(btnSheet);

    const shortFirstName = focusedOpt.name.split(' ')[0];
    const btnChoose = new KitButton({
      label: t.btn_choose.replace('{name}', shortFirstName),
      variant: 'primary',
      width: chooseW,
      height: 44,
      onClick: () => this.openStarterConfirmDialog(focusedOpt),
    });
    btnChoose.position.set(pad + backW + gap + sheetW + gap, 5);
    footer.addChild(btnChoose);

    this.focusManager.register(btnBack.toFocusable());
    this.focusManager.register(btnSheet.toFocusable());
    this.focusManager.register(btnChoose.toFocusable());
  }

  /**
   * Abre la Ficha de Souldoll (Bloque 40) en modo vista previa de solo lectura
   */
  private openPreviewSheet(opt: StarterOptionVM): void {
    GlobalAudioService.playSfx('confirm');
    const previewDoll = StatCalculator.createSouldoll(
      opt.soulSpeciesId,
      opt.level,
      'chassis_madera_t1',
      opt.name,
      'docil',
      { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, speed: 15 }
    );
    StatCalculator.ensurePartHp(previewDoll);
    previewDoll.partHP = { ...previewDoll.maxPartHP };
    previewDoll.currentHp = previewDoll.maxHp;

    GlobalSceneManager.pushScene('CreatureDetail', {
      list: [previewDoll],
      index: 0,
    });
  }

  /**
   * Modal "Ver más" con la descripción completa del alma y su Soul Bottle
   */
  private openReadMoreModal(opt: StarterOptionVM): void {
    if (this.activeSubModal) {
      this.activeSubModal.destroy({ children: true });
      this.activeSubModal = null;
    }
    const t = (esText as any).terms.starter_select;
    const modal = new KitModal(this.hostWidth, this.hostHeight, {
      type: 'Alert',
      size: 'M',
      title: t.lore_modal_title.replace('{name}', opt.name.toUpperCase()),
      bodyText: `${opt.flavor}\n\n"${opt.soulBottleFlavor}"\n\n${t.label_weapon} ${opt.weaponName}\n${t.label_ability} ${opt.abilityName} — ${opt.abilityDescription}`,
      confirmLabel: t.btn_back,
      onConfirm: () => {
        this.activeSubModal = null;
        this.buildUI();
      },
      onCancel: () => {
        this.activeSubModal = null;
        this.buildUI();
      },
    });
    this.activeSubModal = modal;
    this.addChild(modal);
  }

  /**
   * Modal Confirm (Bloque 46 Req 3):
   * "¿Elegir a [nombre] como tu primera Souldoll?", con miniatura, aviso de que las otras dos
   * quedarán disponibles como almas salvajes, y campo de apodo opcional (KitTextInput).
   */
  private openStarterConfirmDialog(opt: StarterOptionVM): void {
    if (this.activeConfirmOverlay) {
      this.activeConfirmOverlay.destroy({ children: true });
      this.activeConfirmOverlay = null;
    }
    const t = (esText as any).terms.starter_select;
    const overlay = new Container();
    overlay.roundPixels = true;

    const dimmer = new Graphics();
    dimmer.rect(0, 0, this.hostWidth, this.hostHeight);
    dimmer.fill({ color: COLOR_NUM.black, alpha: 0.68 });
    dimmer.eventMode = 'static';
    dimmer.on('pointerdown', (e) => {
      e.stopPropagation();
      this.closeStarterConfirmDialog();
    });
    overlay.addChild(dimmer);

    const vp = this.getEffectiveViewport();
    const modalW = Math.min(420, Math.min(this.hostWidth, vp.width) - 24);
    const modalH = 310;
    const modalX = Math.round((this.hostWidth - modalW) / 2);
    const modalY = Math.round((this.hostHeight - modalH) / 2);

    const card = new KitCard({
      width: modalW,
      height: modalH,
      variant: 'inkCrypt',
      title: opt.name.toUpperCase(),
    });
    card.position.set(modalX, modalY);
    card.eventMode = 'static';
    overlay.addChild(card);

    // Miniatura de la Souldoll con escala entera 1x y marco de bronce
    const thumbBox = new Graphics();
    thumbBox.roundRect(16, 38, 68, 86, RADII.sm);
    thumbBox.fill({ color: COLOR_NUM.smokedWood });
    thumbBox.stroke({ color: COLOR_NUM.gold, width: 1.5 });
    card.addChild(thumbBox);

    const thumbMask = new Graphics();
    thumbMask.roundRect(16, 38, 68, 86, RADII.sm);
    thumbMask.fill({ color: COLOR_NUM.white });
    card.addChild(thumbMask);

    const iconTex = GlobalAssetRegistry.getCreatureIconPixi(opt.soulSpeciesId);
    const thumbSpr = new Sprite(iconTex);
    thumbSpr.roundPixels = true;
    thumbSpr.anchor.set(0.5, 0.5);
    thumbSpr.scale.set(2, 2);
    thumbSpr.position.set(50, 81);
    thumbSpr.mask = thumbMask;
    (thumbSpr as any).__requireIntegerScale = true;
    card.addChild(thumbSpr);

    // Pregunta principal y aviso de almas salvajes (en Nunito)
    const questionTxt = new Text({
      text: t.confirm_title.replace('{name}', opt.name),
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        wordWrap: true,
        wordWrapWidth: modalW - 104,
      }),
    });
    questionTxt.roundPixels = true;
    questionTxt.position.set(94, 38);
    card.addChild(questionTxt);

    const wildNoticeTxt = new Text({
      text: t.confirm_wild_notice,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: modalW - 104,
        lineHeight: 18,
      }),
    });
    wildNoticeTxt.roundPixels = true;
    wildNoticeTxt.position.set(94, 82);
    card.addChild(wildNoticeTxt);

    // Campo de apodo opcional (KitTextInput)
    const nickInput = new KitTextInput(
      t.nickname_label,
      this.customNickname || opt.name,
      t.nickname_placeholder,
      modalW - 32,
      () => {
        this.openNicknamePromptModal(opt);
      }
    );
    nickInput.position.set(16, 152);
    card.addChild(nickInput);

    // Botones Cancelar y Confirmar
    const btnY = modalH - 56;
    const cancelBtn = new KitButton({
      label: t.btn_cancel_choice,
      variant: 'secondary',
      width: 132,
      height: 44,
      onClick: () => {
        GlobalAudioService.playSfx('cancel');
        this.closeStarterConfirmDialog();
      },
    });
    cancelBtn.position.set(16, btnY);
    card.addChild(cancelBtn);

    const shortFirstName = opt.name.split(' ')[0];
    const confirmBtn = new KitButton({
      label: t.btn_confirm_choice.replace('{name}', shortFirstName),
      variant: 'primary',
      width: modalW - 172,
      height: 44,
      onClick: () => {
        this.executeStarterBinding(opt);
      },
    });
    confirmBtn.position.set(156, btnY);
    card.addChild(confirmBtn);

    this.activeConfirmOverlay = overlay;
    this.addChild(overlay);
  }

  private closeStarterConfirmDialog(): void {
    if (this.activeConfirmOverlay) {
      this.activeConfirmOverlay.destroy({ children: true });
      this.activeConfirmOverlay = null;
    }
  }

  private openNicknamePromptModal(opt: StarterOptionVM): void {
    if (this.activeSubModal) {
      this.activeSubModal.destroy({ children: true });
      this.activeSubModal = null;
    }
    const t = (esText as any).terms.starter_select;
    const promptModal = new KitModal(this.hostWidth, this.hostHeight, {
      type: 'TextPrompt',
      size: 'L',
      title: t.nickname_modal_title.replace('{name}', opt.name.toUpperCase()),
      bodyText: t.nickname_modal_body,
      initialText: this.customNickname || opt.name,
      confirmLabel: 'GUARDAR APODO',
      cancelLabel: t.btn_cancel_choice,
      onConfirm: (enteredText?: string) => {
        this.activeSubModal = null;
        this.customNickname = (enteredText || '').trim().slice(0, 14);
        this.openStarterConfirmDialog(opt);
      },
      onCancel: () => {
        this.activeSubModal = null;
        this.openStarterConfirmDialog(opt);
      },
    });
    this.activeSubModal = promptModal;
    this.addChild(promptModal);
  }

  /**
   * Ejecuta la vinculación en StarterLabSystem, aplica el apodo opcional,
   * emite el evento al EventBus y continúa con la secuencia de B35.
   */
  private executeStarterBinding(opt: StarterOptionVM): void {
    this.closeStarterConfirmDialog();
    const state = GlobalSaveService.getCurrentState();
    const validSpeciesId: StarterSpeciesId =
      opt.soulSpeciesId === 'sacerdotisa' || opt.soulSpeciesId === 'hidromante'
        ? opt.soulSpeciesId
        : 'maga';

    const { souldoll, rivalSpeciesId } = StarterLabSystem.chooseStarterBottle(
      state,
      validSpeciesId,
      GlobalRng
    );
    StarterLabSystem.applyStarterNickname(state, this.customNickname || null);
    GlobalSaveService.save();

    GlobalAudioService.playSfx('crystal');
    GlobalAudioService.playSfx('soul_seal');

    GlobalEventBus.emit('starter:chosen', {
      soulSpeciesId: validSpeciesId,
      souldollUid: souldoll.uid,
      nickname: souldoll.nickname || opt.name,
      rivalSpeciesId,
    });

    this.callbacks.onStarterBound(souldoll, rivalSpeciesId);
  }

  /**
   * BLOQUE 46 Req 8: Panel Debug (F2) con selector de viewport (360x640, 390x844, 412x915 y horizontal),
   * toggle de nombres largos, de 4+ iniciales, de arte faltante, rejilla de píxeles, cajas de límite y estado del linter.
   */
  private buildDebugOverlay(parent: Container, w: number, _h: number): void {
    const panelW = Math.min(340, w - 16);
    const panelH = 290;
    const panel = new KitCard({
      width: panelW,
      height: panelH,
      variant: 'inkCrypt',
      title: 'DEBUG F2 · BLOQUE 46 STARTER UI',
    });
    panel.position.set(w - panelW - 8, 68);
    panel.eventMode = 'static';
    parent.addChild(panel);

    const viewports = [
      { label: '360x640', w: 360, h: 640 },
      { label: '390x844', w: 390, h: 844 },
      { label: '412x915', w: 412, h: 915 },
      { label: 'Horiz', w: 844, h: 390 },
    ];

    const vpBtnW = Math.floor((panelW - 24 - 9) / 4);
    viewports.forEach((vp, idx) => {
      const isAct = this.debugViewportOverride?.label === vp.label;
      const btn = new KitButton({
        label: vp.label,
        variant: isAct ? 'primary' : 'secondary',
        width: vpBtnW,
        height: 44,
        fontSize: 11,
        onClick: () => {
          this.debugViewportOverride = isAct ? null : vp;
          this.buildUI();
        },
      });
      btn.position.set(12 + idx * (vpBtnW + 3), 34);
      panel.addChild(btn);
    });

    const toggles = [
      {
        label: `Nombres largos: ${this.debugLongNames ? 'SÍ' : 'NO'}`,
        active: this.debugLongNames,
        onClick: () => {
          this.debugLongNames = !this.debugLongNames;
          this.buildUI();
        },
      },
      {
        label: `4+ Iniciales: ${this.debugExtraStarters ? '5' : '3'}`,
        active: this.debugExtraStarters,
        onClick: () => {
          this.debugExtraStarters = !this.debugExtraStarters;
          this.selectedIndex = 0;
          this.buildUI();
        },
      },
      {
        label: `Arte faltante: ${this.debugMissingArt ? 'CAPAS' : 'HOJA'}`,
        active: this.debugMissingArt,
        onClick: () => {
          this.debugMissingArt = !this.debugMissingArt;
          this.buildUI();
        },
      },
      {
        label: `Rejilla / Cajas: ${this.debugSpriteBounds ? 'SÍ' : 'NO'}`,
        active: this.debugSpriteBounds,
        onClick: () => {
          this.debugPixelGrid = !this.debugPixelGrid;
          this.debugSpriteBounds = !this.debugSpriteBounds;
          this.buildUI();
        },
      },
    ];

    const tBtnW = Math.floor((panelW - 28) / 2);
    toggles.forEach((tg, idx) => {
      const btn = new KitButton({
        label: tg.label,
        variant: tg.active ? 'primary' : 'secondary',
        width: tBtnW,
        height: 44,
        fontSize: 11,
        onClick: tg.onClick,
      });
      btn.position.set(12 + (idx % 2) * (tBtnW + 4), 86 + Math.floor(idx / 2) * 48);
      panel.addChild(btn);
    });

    const glyphCheck = UIKitLinter.verifyEsJsonGlyphCoverage(esText as any);
    const lintStatus =
      this.lastLintIssues.length === 0 && glyphCheck.allCovered
        ? 'Linter UI & Glifos: 0 avisos · Escalas enteras OK'
        : `Avisos Linter: ${this.lastLintIssues.length} | Glifos faltantes: ${glyphCheck.missingGlyphs.length}`;

    const statusTxt = new Text({
      text: `${lintStatus}\n${glyphCheck.details}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 12,
        fill:
          this.lastLintIssues.length === 0 && glyphCheck.allCovered
            ? COLOR_HEX.ok
            : COLOR_HEX.warning,
        wordWrap: true,
        wordWrapWidth: panelW - 24,
      }),
    });
    statusTxt.roundPixels = true;
    statusTxt.position.set(12, 190);
    panel.addChild(statusTxt);
  }
}
