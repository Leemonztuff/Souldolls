import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GlobalPixiRenderer } from '../../render/PixiRenderer';
import { GlobalInput } from '../../core/Input';
import { GlobalSaveService } from '../../services/SaveService';
import { GlobalAudioService } from '../../services/AudioService';
import { GlobalQuestSystem } from '../../systems/quest/QuestSystem';
import { InputAction } from '../../types';
import { KitCard, KitButton, IconRegistry, UIKitLinter } from '../kit';
import { COLOR_NUM, COLOR_HEX, FONTS } from '../styles';
import esText from '../../data/text/es.json';

export interface OverworldHudCallbacks {
  onOpenMenu: () => void;
  onRotateCamera: () => void;
}

/**
 * BLOQUE 43 Req. 3, 4 & 7: Controles táctiles y HUD del Overworld (/ui/hud/OverworldHud.ts)
 * - D-pad a la izquierda y botones A y B a la derecha.
 * - Opacidad base 0.35, que sube a 0.8 al tocar y vuelve a 0.35 tras 3 s sin entrada.
 * - Sin etiquetas de texto permanentes (eliminados MOVER, INTERACTUAR, ACCIÓN, CANCELAR).
 * - CORRER: eliminado el botón dedicado; se corre manteniendo B (o alternando si se configura en Opciones).
 * - MENÚ: un único botón pequeño (icono de hamburguesa 'menu_hamburger', sin texto) arriba a la derecha, dentro de safe-area.
 * - CÁMARA: un único botón pequeño (icono de brújula 'compass', sin texto) arriba a la izquierda, dentro de safe-area; gira 90° en cada toque.
 * - Indicador contextual de interacción: sobre el botón A aparece una pequeña etiqueta ("Hablar", "Entrar", "Leer", "Recoger", "Abrir")
 *   SOLO cuando hay un interactuable delante. Si no hay nada, A no muestra texto.
 * - Pista de objetivo opcional bajo el banner de zona (controlada desde Opciones).
 * - Zonas táctiles >= 44 px, dentro de safe-area, con soporte de escala, posición y "panel de controles aparte" (franja inferior).
 */
export class OverworldHud extends Container {
  private callbacks: OverworldHudCallbacks;

  private topBarContainer: Container = new Container();
  private padLayerContainer: Container = new Container();
  private separatePanelBg: Graphics = new Graphics();
  private dpadContainer: Container = new Container();
  private abContainer: Container = new Container();
  private objectiveContainer: Container = new Container();

  private interactBadgeContainer: Container = new Container();
  private interactBadgeBg: Graphics = new Graphics();
  private interactBadgeText!: Text;
  private currentInteractLabel: string | null = null;

  // Souls Captured HUD element fields (Bloque 47)
  private soulsCounterContainer: Container = new Container();
  private soulsCounterBg: Graphics = new Graphics();
  private soulsCounterText!: Text;
  private lastSoulsCount = -1;
  private soulsPulseScale = 1.0;

  private inactivityTimer = 3.5; // Starts at base opacity 0.35
  private readonly baseAlpha = 0.35;
  private readonly activeAlpha = 0.8;
  private readonly fadeDelaySec = 3.0;

  private activeDirections: Set<InputAction> = new Set();
  private isBHeld = false;

  constructor(callbacks: OverworldHudCallbacks) {
    super();
    this.roundPixels = true;
    this.callbacks = callbacks;
    this.build();
  }

  public build(): void {
    this.removeChildren();
    this.releaseAllInputs();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const state = GlobalSaveService.getCurrentState();
    const settings = state.settings || ({} as any);

    const safeTop = 14;
    const safeBottom = 16;
    const safeSide = 16;

    // 1. Optional Separate Bottom Control Panel (Franja inferior reservada)
    this.separatePanelBg = new Graphics();
    const rawScale = settings.touchScale ?? 1;
    const numericScale =
      typeof rawScale === 'number'
        ? rawScale
        : rawScale === 'small'
        ? 0.85
        : rawScale === 'large'
        ? 1.15
        : 1.0;
    const scale = Math.max(0.8, Math.min(1.3, numericScale));
    const panelHeight = Math.round(168 * scale);

    if (settings.separateControlPanel && settings.showTouchControls !== false) {
      this.separatePanelBg.rect(0, height - panelHeight, width, panelHeight);
      this.separatePanelBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.94 });
      this.separatePanelBg.moveTo(0, height - panelHeight).lineTo(width, height - panelHeight);
      this.separatePanelBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
      this.separatePanelBg.eventMode = 'static';
      this.addChild(this.separatePanelBg);
    }

    // 2. Top Safe-Area Bar: Compass (Top-Left) & Menu Icon-Only Button (Top-Right)
    this.topBarContainer = new Container();
    this.topBarContainer.roundPixels = true;
    this.addChild(this.topBarContainer);

    const btnSize = 44; // Minimum 44px touch target (Bloque 43 Req. 3)

    if (settings.showCameraButton !== false) {
      const compassBtn = new KitButton({
        width: btnSize,
        height: btnSize,
        iconId: 'compass',
        variant: 'secondary',
        onClick: () => {
          this.notifyTouchActivity();
          GlobalAudioService.playSfx('select');
          this.callbacks.onRotateCamera();
        },
      });
      compassBtn.position.set(safeSide, safeTop);
      this.topBarContainer.addChild(compassBtn);
    }

    const menuBtn = new KitButton({
      width: btnSize,
      height: btnSize,
      iconId: 'menu_hamburger',
      variant: 'primary',
      onClick: () => {
        this.notifyTouchActivity();
        this.callbacks.onOpenMenu();
      },
    });
    menuBtn.position.set(width - safeSide - btnSize, safeTop);
    this.topBarContainer.addChild(menuBtn);

    // 3. Optional Active Quest Objective Hint (below the zone banner area)
    this.objectiveContainer = new Container();
    this.objectiveContainer.roundPixels = true;
    this.addChild(this.objectiveContainer);
    this.refreshObjectiveHint();

    // 4. Touch Controls Layer (D-Pad Left + A/B Right, base alpha 0.35 -> 0.8 on touch)
    this.padLayerContainer = new Container();
    this.padLayerContainer.roundPixels = true;
    this.padLayerContainer.alpha = this.inactivityTimer < this.fadeDelaySec ? this.activeAlpha : this.baseAlpha;
    this.addChild(this.padLayerContainer);

    if (settings.showTouchControls !== false) {
      this.buildTouchControls(width, height, scale, settings.touchPosition || 'normal', safeSide, safeBottom);
    }

    // souls Captured HUD element (Bloque 47)
    const soulsCounterY = settings.showCameraButton !== false ? safeTop + btnSize + 8 : safeTop;
    this.buildSoulsCounter(safeSide, soulsCounterY);

    UIKitLinter.inspectTree(this, 'OverworldHud');
  }

  private buildTouchControls(
    width: number,
    height: number,
    scale: number,
    posMode: 'compact' | 'normal' | 'wide',
    safeSide: number,
    safeBottom: number
  ): void {
    const sideOffset =
      posMode === 'compact' ? safeSide + 20 : posMode === 'wide' ? Math.max(10, safeSide - 4) : safeSide + 6;
    const bottomOffset = safeBottom + (posMode === 'compact' ? 18 : 10);

    // --- D-PAD (Left Side) ---
    const btnDim = Math.max(44, Math.round(48 * scale));
    const dpadSpan = btnDim * 3;
    this.dpadContainer = new Container();
    this.dpadContainer.roundPixels = true;
    this.dpadContainer.position.set(sideOffset, height - bottomOffset - dpadSpan);
    this.padLayerContainer.addChild(this.dpadContainer);

    // Center hub plate
    const centerPlate = new Graphics();
    centerPlate.roundRect(btnDim, btnDim, btnDim, btnDim, 6);
    centerPlate.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.75 });
    centerPlate.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    this.dpadContainer.addChild(centerPlate);

    const createDirPadButton = (
      dirAction: InputAction,
      x: number,
      y: number,
      arrowRotation: number
    ) => {
      const btn = new Container();
      btn.position.set(x, y);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const bg = new Graphics();
      const drawBg = (pressed: boolean) => {
        bg.clear();
        bg.roundRect(0, 0, btnDim, btnDim, 8);
        bg.fill({
          color: pressed ? COLOR_NUM.gold : COLOR_NUM.smokedWood,
          alpha: 0.92,
        });
        bg.stroke({
          color: pressed ? COLOR_NUM.parchment : COLOR_NUM.bronze,
          width: 2,
        });
      };
      drawBg(false);
      btn.addChild(bg);

      const arrow = new Graphics();
      const cx = Math.round(btnDim / 2);
      const cy = Math.round(btnDim / 2);
      arrow.poly([0, -7, 7, 5, -7, 5], true);
      arrow.fill({ color: COLOR_NUM.parchment });
      arrow.position.set(cx, cy);
      arrow.rotation = arrowRotation;
      btn.addChild(arrow);

      const press = () => {
        this.notifyTouchActivity();
        if (!this.activeDirections.has(dirAction)) {
          this.activeDirections.add(dirAction);
          GlobalInput.setVirtualState(dirAction, true);
          drawBg(true);
        }
      };

      const release = () => {
        if (this.activeDirections.has(dirAction)) {
          this.activeDirections.delete(dirAction);
          GlobalInput.setVirtualState(dirAction, false);
          drawBg(false);
        }
      };

      btn.on('pointerdown', (e) => {
        e.stopPropagation();
        press();
      });
      btn.on('pointerup', release);
      btn.on('pointerupoutside', release);
      btn.on('pointercancel', release);
      btn.on('pointerleave', release);

      this.dpadContainer.addChild(btn);
    };

    createDirPadButton('UP', btnDim, 0, 0);
    createDirPadButton('DOWN', btnDim, btnDim * 2, Math.PI);
    createDirPadButton('LEFT', 0, btnDim, -Math.PI / 2);
    createDirPadButton('RIGHT', btnDim * 2, btnDim, Math.PI / 2);

    // --- A & B BUTTONS (Right Side, >= 44px diameter, NO permanent labels) ---
    const abDiameter = Math.max(52, Math.round(56 * scale));
    const abClusterW = Math.round(abDiameter * 2.25);
    const abClusterH = Math.round(abDiameter * 1.85);

    this.abContainer = new Container();
    this.abContainer.roundPixels = true;
    this.abContainer.position.set(
      width - sideOffset - abClusterW,
      height - bottomOffset - abClusterH
    );
    this.padLayerContainer.addChild(this.abContainer);

    // B Button (Bottom-Left of cluster: hold to run in Overworld, tap to cancel in menus/dialogues)
    const bX = 0;
    const bY = abClusterH - abDiameter;
    const bBtn = this.createRoundActionButton(
      'B',
      abDiameter,
      COLOR_NUM.smokedWood,
      COLOR_NUM.bronze,
      () => {
        this.notifyTouchActivity();
        this.isBHeld = true;
        GlobalInput.setVirtualState('CANCEL', true);
      },
      () => {
        if (this.isBHeld) {
          this.isBHeld = false;
          GlobalInput.setVirtualState('CANCEL', false);
        }
      }
    );
    bBtn.position.set(bX, bY);
    this.abContainer.addChild(bBtn);

    // A Button (Top-Right of cluster: confirm / interact)
    const aX = abClusterW - abDiameter;
    const aY = Math.round(abDiameter * 0.2);
    const aBtn = this.createRoundActionButton(
      'A',
      abDiameter,
      COLOR_NUM.gold,
      COLOR_NUM.parchment,
      () => {
        this.notifyTouchActivity();
        GlobalInput.setVirtualState('CONFIRM', true);
      },
      () => {
        GlobalInput.setVirtualState('CONFIRM', false);
      }
    );
    aBtn.position.set(aX, aY);
    this.abContainer.addChild(aBtn);

    // Contextual Interaction Label Pill ABOVE Button A (Bloque 43 Req. 4)
    this.interactBadgeContainer = new Container();
    this.interactBadgeContainer.roundPixels = true;
    this.interactBadgeContainer.visible = false;

    this.interactBadgeBg = new Graphics();
    this.interactBadgeContainer.addChild(this.interactBadgeBg);

    const tHud = (esText as any).terms.group_a.hud;
    this.interactBadgeText = new Text({
      text: tHud?.interact_talk || 'Hablar',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    this.interactBadgeText.roundPixels = true;
    this.interactBadgeText.anchor.set(0.5);
    this.interactBadgeContainer.addChild(this.interactBadgeText);

    // Position centered above A button
    this.interactBadgeContainer.position.set(aX + Math.round(abDiameter / 2), aY - 18);
    this.abContainer.addChild(this.interactBadgeContainer);

    if (this.currentInteractLabel) {
      this.setInteractLabel(this.currentInteractLabel);
    }
  }

  private createRoundActionButton(
    letter: 'A' | 'B',
    diameter: number,
    baseFill: number,
    borderCol: number,
    onPress: () => void,
    onRelease: () => void
  ): Container {
    const c = new Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const radius = Math.round(diameter / 2);
    const bg = new Graphics();
    const isPrimaryA = letter === 'A';

    const drawState = (pressed: boolean) => {
      bg.clear();
      bg.circle(radius, radius, radius);
      bg.fill({
        color: pressed ? COLOR_NUM.cyan : baseFill,
        alpha: 0.95,
      });
      bg.stroke({
        color: pressed ? COLOR_NUM.white : borderCol,
        width: 2.5,
      });
    };
    drawState(false);
    c.addChild(bg);

    const txt = new Text({
      text: letter,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: Math.round(diameter * 0.36),
        fontWeight: 'bold',
        fill: isPrimaryA ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment,
      }),
    });
    txt.roundPixels = true;
    txt.anchor.set(0.5);
    txt.position.set(radius, radius);
    c.addChild(txt);

    c.on('pointerdown', (e) => {
      e.stopPropagation();
      drawState(true);
      txt.style.fill = COLOR_HEX.inkCrypt;
      onPress();
    });

    const handleUp = () => {
      drawState(false);
      txt.style.fill = isPrimaryA ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment;
      onRelease();
    };

    c.on('pointerup', handleUp);
    c.on('pointerupoutside', handleUp);
    c.on('pointercancel', handleUp);

    return c;
  }

  /**
   * Bloque 43 Req. 4: Updates the contextual interaction pill above button A.
   * Pass null when no interactable is directly ahead.
   */
  public setInteractLabel(label: string | null): void {
    if (this.currentInteractLabel === label && this.interactBadgeContainer.visible === !!label) {
      return;
    }
    this.currentInteractLabel = label;

    if (!label) {
      this.interactBadgeContainer.visible = false;
      return;
    }

    this.interactBadgeText.text = label;
    const padX = 12;
    const measuredW = typeof document !== 'undefined' ? this.interactBadgeText.width : label.length * 8;
    const pillW = Math.max(58, Math.round(measuredW + padX * 2));
    const pillH = 24;

    this.interactBadgeBg.clear();
    this.interactBadgeBg.roundRect(-Math.round(pillW / 2), -Math.round(pillH / 2), pillW, pillH, 6);
    this.interactBadgeBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.94 });
    this.interactBadgeBg.stroke({ color: COLOR_NUM.gold, width: 1.5 });

    this.interactBadgeText.position.set(0, 0);
    this.interactBadgeContainer.visible = true;
  }

  /**
   * Bloque 43 Req. 4: Pista de objetivo opcional bajo el área del banner.
   */
  public refreshObjectiveHint(): void {
    this.objectiveContainer.removeChildren();

    const state = GlobalSaveService.getCurrentState();
    if (state.settings?.showObjectiveHint === false) {
      return;
    }

    const activeQuests = GlobalQuestSystem.getActiveQuests();
    if (!activeQuests || activeQuests.length === 0) {
      return;
    }

    const primary = activeQuests[0];
    const currentObj =
      primary.data.objectives[primary.state.currentObjectiveIndex] || primary.data.objectives[0];
    if (!currentObj) return;

    const tHud = (esText as any).terms.group_a.hud;
    const prefix = tHud?.objective_prefix || 'Objetivo:';
    const textStr = `${prefix} ${currentObj.description}`;

    const width = GlobalPixiRenderer.width;
    const isMobile = width < 640;
    const pillW = Math.min(400, width - 128);
    const pillH = 26;

    const card = new KitCard({
      width: pillW,
      height: pillH,
      variant: 'inkCrypt',
    });
    this.objectiveContainer.addChild(card);

    const icon = IconRegistry.create('quest_scroll', 14);
    icon.position.set(8, Math.round((pillH - 14) / 2));
    card.addChild(icon);

    const txt = new Text({
      text: textStr,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: isMobile ? 11 : 12,
        fill: COLOR_HEX.parchment,
      }),
    });
    txt.roundPixels = true;
    txt.anchor.set(0, 0.5);
    txt.position.set(26, Math.round(pillH / 2));

    // Clamp text if too wide
    const maxTextW = pillW - 34;
    if (typeof document !== 'undefined') {
      if (txt.width > maxTextW) {
        let clipped = textStr;
        while (clipped.length > 10 && txt.width > maxTextW) {
          clipped = clipped.slice(0, -2);
          txt.text = `${clipped}…`;
        }
      }
    } else if (textStr.length * 7 > maxTextW) {
      const maxChars = Math.max(10, Math.floor(maxTextW / 7));
      txt.text = `${textStr.slice(0, maxChars)}…`;
    }
    card.addChild(txt);

    this.objectiveContainer.position.set(Math.round((width - pillW) / 2), 16);
  }

  private buildSoulsCounter(safeSide: number, yPos: number): void {
    this.soulsCounterContainer = new Container();
    this.soulsCounterContainer.roundPixels = true;

    const cardW = 76;
    const cardH = 30;

    // Set pivot to center for beautiful pulse scaling from exact center
    this.soulsCounterContainer.pivot.set(cardW / 2, cardH / 2);
    this.soulsCounterContainer.position.set(safeSide + cardW / 2, yPos + cardH / 2);
    this.addChild(this.soulsCounterContainer);

    this.soulsCounterBg = new Graphics();
    this.soulsCounterBg.roundRect(0, 0, cardW, cardH, 6);
    this.soulsCounterBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.90 });
    this.soulsCounterBg.stroke({ color: COLOR_NUM.gold, width: 1.5 });
    this.soulsCounterContainer.addChild(this.soulsCounterBg);

    // Soul Orb Icon
    const icon = IconRegistry.create('soul_orb', 14);
    icon.position.set(8, Math.round((cardH - 14) / 2));
    this.soulsCounterContainer.addChild(icon);

    this.soulsCounterText = new Text({
      text: '0',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    this.soulsCounterText.roundPixels = true;
    this.soulsCounterText.anchor.set(0, 0.5);
    this.soulsCounterText.position.set(26, Math.round(cardH / 2));
    this.soulsCounterContainer.addChild(this.soulsCounterText);

    // Initial count
    const state = GlobalSaveService.getCurrentState();
    const currentCount = (state.party || []).length + (state.storage || []).length;
    this.lastSoulsCount = currentCount;
    this.soulsCounterText.text = String(currentCount);
  }

  public notifyTouchActivity(): void {
    this.inactivityTimer = 0;
    this.padLayerContainer.alpha = this.activeAlpha;
  }

  public updateHud(dt: number): void {
    // 1. Check & Animate Souls Captured counter with gentle pulse
    const state = GlobalSaveService.getCurrentState();
    const currentCount = (state.party || []).length + (state.storage || []).length;

    if (this.lastSoulsCount !== -1 && currentCount > this.lastSoulsCount) {
      this.soulsPulseScale = 1.40; // Pulse up on capture!
      GlobalAudioService.playSfx('confirm');
    }
    this.lastSoulsCount = currentCount;

    if (this.soulsCounterText) {
      this.soulsCounterText.text = String(currentCount);
    }

    // Decay pulse back to 1.0
    if (this.soulsPulseScale > 1.0) {
      this.soulsPulseScale += (1.0 - this.soulsPulseScale) * Math.min(1, dt * 10);
    } else {
      this.soulsPulseScale = 1.0;
    }
    this.soulsCounterContainer.scale.set(this.soulsPulseScale);

    // Also wake up pad opacity if any directional or action input is pressed
    if (
      this.activeDirections.size > 0 ||
      this.isBHeld ||
      GlobalInput.isDown('UP') ||
      GlobalInput.isDown('DOWN') ||
      GlobalInput.isDown('LEFT') ||
      GlobalInput.isDown('RIGHT') ||
      GlobalInput.isDown('CONFIRM') ||
      GlobalInput.isDown('CANCEL')
    ) {
      this.inactivityTimer = 0;
    } else {
      this.inactivityTimer += dt;
    }

    const targetAlpha =
      this.inactivityTimer < this.fadeDelaySec || this. currentInteractLabel
          ? this.activeAlpha
          : this.baseAlpha;

    // Smoothly interpolate alpha
    const diff = targetAlpha - this.padLayerContainer.alpha;
    if (Math.abs(diff) > 0.005) {
      this.padLayerContainer.alpha += diff * Math.min(1, dt * 8);
    } else {
      this.padLayerContainer.alpha = targetAlpha;
    }
  }

  public releaseAllInputs(): void {
    this.activeDirections.forEach((act) => {
      GlobalInput.setVirtualState(act, false);
    });
    this.activeDirections.clear();
    if (this.isBHeld) {
      this.isBHeld = false;
      GlobalInput.setVirtualState('CANCEL', false);
    }
  }

  public override destroy(options?: any): void {
    this.releaseAllInputs();
    super.destroy(options);
  }
}
