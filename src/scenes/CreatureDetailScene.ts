import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalEventBus } from '../core/EventBus';
import { GlobalInput } from '../core/Input';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import {
  SoulDollSpriteFactory,
  ChassisMaterial,
  SpriteView,
} from '../render/procedural/SoulDollSpriteFactory';
import { BattleIdleMesh } from '../render/battle/BattleIdleMesh';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { BrassButton } from '../render/ui/kit/BrassButton';
import { ThemeProgressBar } from '../render/ui/kit/ThemeProgressBar';
import { ThemeTooltip } from '../render/ui/kit/ThemeTooltip';
import { IconRegistry, UIKitLinter } from '../ui/kit';
import {
  buildSheetVM,
  SoulDollSheetVM,
  SheetStatItemVM,
  SheetPartEntryVM,
  SheetEquipSlotVM,
} from '../ui/viewmodels/SoulDollSheetVM';
import { ITEMS_DATA } from '../data/items/items';
import { COLOR_NUM, COLOR_HEX, COLOR_SEMANTIC, COLOR_ELEMENT, COLOR_STATS, FONTS } from '../ui/styles';
import { Souldoll } from '../types/souldolls';
import { BodyPart } from '../types/bodies';
import esText from '../data/text/es.json';

export interface CreatureDetailParams {
  index?: number;
  uid?: string;
  list?: Souldoll[];
}

export class CreatureDetailScene implements IScene {
  public name = 'CreatureDetail';
  private container: Container = new Container();
  private contentContainer: Container = new Container();
  private modalContainer: Container = new Container();
  private tooltip: ThemeTooltip = new ThemeTooltip();

  private currentIndex = 0;
  private customList: Souldoll[] | null = null;
  private pedestalView: 'view_front' | 'view_front34' | 'view_side' | 'view_back34' | 'view_back' = 'view_front34';
  private static readonly PEDESTAL_VIEWS: Array<'view_front' | 'view_front34' | 'view_side' | 'view_back34' | 'view_back'> = [
    'view_front',
    'view_front34',
    'view_side',
    'view_back34',
    'view_back',
  ];
  private activeIdleMesh: BattleIdleMesh | null = null;
  private activeSilhouette: HumanoidPartSilhouette | null = null;
  private activeEquipModalSlot: 'weapon' | 'relic' | 'accessory' | null = null;

  // Touch swipe tracking for pedestal & sheet
  private swipeStartX: number | null = null;
  private swipeStartY: number | null = null;

  private boundKeyDown?: (e: KeyboardEvent) => void;
  private boundEventRefresh?: () => void;

  public async enter(params?: CreatureDetailParams): Promise<void> {
    this.customList = params?.list && params.list.length > 0 ? params.list : null;
    const roster = this.getActiveRoster();

    if (params?.uid) {
      const idx = roster.findIndex((s) => s.uid === params.uid);
      this.currentIndex = idx >= 0 ? idx : 0;
    } else if (typeof params?.index === 'number') {
      this.currentIndex = Math.max(0, Math.min(roster.length - 1, params.index));
    } else {
      this.currentIndex = 0;
    }

    this.container = new Container();
    this.container.roundPixels = true;

    this.contentContainer = new Container();
    this.contentContainer.roundPixels = true;
    this.container.addChild(this.contentContainer);

    this.modalContainer = new Container();
    this.modalContainer.roundPixels = true;
    this.container.addChild(this.modalContainer);

    this.tooltip = new ThemeTooltip();
    this.container.addChild(this.tooltip);

    // Subscribe to reactive events (Bloque 40 Req 4)
    this.boundEventRefresh = () => {
      this.renderSheet();
    };
    GlobalEventBus.on('save:saved', this.boundEventRefresh);
    GlobalEventBus.on('soul:ascended', this.boundEventRefresh);
    GlobalEventBus.on('creature:evolved', this.boundEventRefresh);
    GlobalEventBus.on('item:obtained', this.boundEventRefresh);

    // Keyboard shortcuts (Left / Right to cycle Souldolls, V to toggle 3/4 view, Escape to exit)
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (this.activeEquipModalSlot) {
        if (e.key === 'Escape') {
          this.closeEquipModal();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.navigateRoster(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.navigateRoster(1);
      } else if (e.key === 'v' || e.key === 'V') {
        this.togglePedestalView();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        GlobalAudioService.playSfx('cancel');
        GlobalSceneManager.popScene();
      }
    };
    window.addEventListener('keydown', this.boundKeyDown);

    // Rebuild if custom spritesheet finishes loading asynchronously
    SoulDollSpriteFactory.onSpritesheetReady(() => {
      if (!this.container.destroyed) {
        this.renderSheet();
      }
    });

    this.renderSheet();
    this.container.zIndex = 1100;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
  }

  private getActiveRoster(): Souldoll[] {
    if (this.customList && this.customList.length > 0) {
      return this.customList;
    }
    const saveState = GlobalSaveService.getCurrentState();
    return saveState.party || [];
  }

  private navigateRoster(delta: number): void {
    const roster = this.getActiveRoster();
    if (roster.length <= 1) return;
    this.currentIndex = (this.currentIndex + delta + roster.length) % roster.length;
    GlobalAudioService.playSfx('select');
    this.tooltip.hide();
    this.renderSheet();
  }

  private togglePedestalView(): void {
    const idx = CreatureDetailScene.PEDESTAL_VIEWS.indexOf(this.pedestalView);
    const nextIdx = (idx + 1) % CreatureDetailScene.PEDESTAL_VIEWS.length;
    this.pedestalView = CreatureDetailScene.PEDESTAL_VIEWS[nextIdx];
    GlobalAudioService.playSfx('select');
    this.renderSheet();
  }

  private getElementColors(elemName: string): { primary: number; secondary: number } {
    const normalized = (elemName || 'neutro')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') as keyof typeof COLOR_ELEMENT;
    return COLOR_ELEMENT[normalized] || COLOR_ELEMENT.neutro;
  }

  private mapMaterialToFactory(matRaw: string): ChassisMaterial {
    switch (matRaw) {
      case 'madera':
        return 'wood';
      case 'hierro':
        return 'iron';
      case 'piedra':
        return 'stone';
      case 'cristal':
        return 'crystal';
      case 'arcano':
        return 'crystal';
      default:
        return 'wood';
    }
  }

  private renderSheet(): void {
    if (this.activeIdleMesh) {
      this.activeIdleMesh.destroy({ children: true });
      this.activeIdleMesh = null;
    }
    this.contentContainer.removeChildren();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const saveState = GlobalSaveService.getCurrentState();
    const roster = this.getActiveRoster();
    const t = (esText as any).terms.sheet;

    // Full-screen atmospheric dark crypt backdrop
    const screenBg = new Graphics();
    screenBg.rect(0, 0, width, height);
    screenBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    this.contentContainer.addChild(screenBg);

    if (roster.length === 0) {
      const emptyTxt = new Text({
        text: (esText as any).ui?.empty_party || 'No tienes Souldolls en el equipo',
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 18,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      emptyTxt.anchor.set(0.5);
      emptyTxt.position.set(width / 2, height / 2 - 20);
      this.contentContainer.addChild(emptyTxt);

      const backBtn = new BrassButton({
        width: 150,
        height: 40,
        label: t.btn_back,
        onClick: () => GlobalSceneManager.popScene(),
      });
      backBtn.position.set(width / 2 - 75, height / 2 + 20);
      this.contentContainer.addChild(backBtn);
      return;
    }

    if (this.currentIndex >= roster.length) {
      this.currentIndex = 0;
    }

    const souldoll = roster[this.currentIndex];
    const vm = buildSheetVM(souldoll, saveState, roster);

    // Responsive card container centered on screen (supports mobile vertical & desktop)
    const padX = width < 640 ? 6 : 16;
    const padY = height < 720 ? 4 : 10;
    const sheetW = Math.min(980, width - padX * 2);
    const sheetH = Math.min(760, height - padY * 2);
    const sheetX = Math.round((width - sheetW) / 2);
    const sheetY = Math.round((height - sheetH) / 2);

    const cardRoot = new Container();
    cardRoot.roundPixels = true;
    cardRoot.position.set(sheetX, sheetY);
    this.contentContainer.addChild(cardRoot);

    // Outer Ornate Sheet Frame
    const outerFrame = new Graphics();
    outerFrame.roundRect(0, 0, sheetW, sheetH, 12);
    outerFrame.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    outerFrame.stroke({ color: COLOR_NUM.bronze, width: 3 });
    outerFrame.roundRect(3, 3, sheetW - 6, sheetH - 6, 9);
    outerFrame.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.65 });
    cardRoot.addChild(outerFrame);

    const isCompact = sheetW < 560 || sheetH < 640;
    const innerPad = isCompact ? 6 : 10;
    const gap = isCompact ? 5 : 8;

    // ---------------------------------------------------------
    // 1. TOP PLAYER BAR (Wood with Bronze Frame)
    // ---------------------------------------------------------
    const topBarH = isCompact ? 34 : 42;
    this.renderTopBar(cardRoot, innerPad, innerPad, sheetW - innerPad * 2, topBarH, vm, isCompact);

    // ---------------------------------------------------------
    // 2. BOTTOM NAVIGATION & ACTION FOOTER
    // ---------------------------------------------------------
    const footerH = isCompact ? 42 : 48;
    const footerY = sheetH - innerPad - footerH;
    this.renderFooterBar(
      cardRoot,
      innerPad,
      footerY,
      sheetW - innerPad * 2,
      footerH,
      souldoll,
      vm,
      isCompact
    );

    // ---------------------------------------------------------
    // 3. IDENTITY & SYNC/ASCENSION ROW
    // ---------------------------------------------------------
    const row2Y = innerPad + topBarH + gap;
    const row2H = isCompact ? 68 : 80;
    const totalInnerW = sheetW - innerPad * 2;
    const leftRatio = isCompact ? 0.56 : 0.58;
    const leftColW = Math.round(totalInnerW * leftRatio - gap / 2);
    const rightColW = totalInnerW - leftColW - gap;
    const rightColX = innerPad + leftColW + gap;

    this.renderIdentityCard(cardRoot, innerPad, row2Y, leftColW, row2H, vm, isCompact);
    this.renderSyncAndAscensionCard(cardRoot, rightColX, row2Y, rightColW, row2H, vm, isCompact);

    // ---------------------------------------------------------
    // 4. MAIN BODY COLUMNS (Left: Stats+Ability+Parts+Moves | Right: Pedestal+Equipment)
    // ---------------------------------------------------------
    const bodyTopY = row2Y + row2H + gap;
    const bodyAvailH = footerY - gap - bodyTopY;

    // Left Column heights
    const statsH = isCompact ? Math.round(bodyAvailH * 0.25) : Math.round(bodyAvailH * 0.24);
    const abilityH = isCompact ? Math.round(bodyAvailH * 0.14) : Math.round(bodyAvailH * 0.14);
    const partsH = isCompact ? Math.round(bodyAvailH * 0.28) : Math.round(bodyAvailH * 0.29);
    const movesH = bodyAvailH - statsH - abilityH - partsH - gap * 3;

    let curLeftY = bodyTopY;
    this.renderStatsGrid(cardRoot, innerPad, curLeftY, leftColW, statsH, vm, isCompact);
    curLeftY += statsH + gap;

    this.renderAbilityCard(cardRoot, innerPad, curLeftY, leftColW, abilityH, vm, isCompact);
    curLeftY += abilityH + gap;

    this.renderPartsAndBodyCard(cardRoot, innerPad, curLeftY, leftColW, partsH, vm, isCompact);
    curLeftY += partsH + gap;

    this.renderMovesCard(cardRoot, innerPad, curLeftY, leftColW, movesH, vm, isCompact);

    // Right Column heights (Pedestal + Equipment)
    const equipH = isCompact ? Math.max(92, Math.round(bodyAvailH * 0.28)) : Math.max(108, Math.round(bodyAvailH * 0.28));
    const pedestalH = bodyAvailH - equipH - gap;

    this.renderPedestalShowcase(
      cardRoot,
      rightColX,
      bodyTopY,
      rightColW,
      pedestalH,
      souldoll,
      vm,
      isCompact
    );

    this.renderEquipmentCard(
      cardRoot,
      rightColX,
      bodyTopY + pedestalH + gap,
      rightColW,
      equipH,
      souldoll,
      vm,
      isCompact
    );

    // Re-render modal if open
    if (this.activeEquipModalSlot) {
      this.renderEquipModal(souldoll);
    }

    UIKitLinter.inspectTree(cardRoot, 'CreatureDetailScene');
  }

  /**
   * 1. Top Bar: Smoked wood with bronze border, Soultrainer, PlayTime, Seals, Money, Fragments, Ki Dust
   */
  private renderTopBar(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const bar = new Container();
    bar.position.set(x, y);
    parent.addChild(bar);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    // Subtle inner gold trim
    bg.roundRect(2, 2, w - 4, h - 4, 6);
    bg.stroke({ color: COLOR_NUM.gold, width: 0.75, alpha: 0.45 });
    bar.addChild(bg);

    const fontSize = isCompact ? 10 : 12;

    const trainerIcon = IconRegistry.create('trainer', 14);
    trainerIcon.position.set(8, Math.round((h - 14) / 2));
    bar.addChild(trainerIcon);

    // Trainer & Playtime + Guild Seals on the left
    const trainerInfo = new Text({
      text: `${vm.header.trainerName}  |  ${vm.header.playTime}  |  ${vm.header.guildSeals}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    trainerInfo.anchor.set(0, 0.5);
    trainerInfo.position.set(26, h / 2);
    bar.addChild(trainerInfo);

    // Currencies & resources on the right (Money, Soul Fragments, Ki Dust) with kit icons
    const badges: Array<{ iconId: 'coin' | 'soul_fragment' | 'ki_dust'; label: string; color: number; textHex: string }> = [
      { iconId: 'coin', label: `${vm.header.money}`, color: COLOR_NUM.gold, textHex: COLOR_HEX.gold },
      { iconId: 'soul_fragment', label: `${vm.header.soulFragments}`, color: COLOR_NUM.soulViolet, textHex: COLOR_HEX.parchment },
      { iconId: 'ki_dust', label: `${vm.header.kiDust}`, color: COLOR_NUM.cyan, textHex: COLOR_HEX.cyan },
    ];

    let curRightX = w - 8;
    for (let i = badges.length - 1; i >= 0; i--) {
      const b = badges[i];
      const pillW = isCompact ? 62 : 84;
      const pillH = h - 10;
      const pillX = curRightX - pillW;
      const pillY = 5;

      const pill = new Graphics();
      pill.roundRect(pillX, pillY, pillW, pillH, 5);
      pill.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.9 });
      pill.stroke({ color: b.color, width: 1.2 });
      bar.addChild(pill);

      const ic = IconRegistry.create(b.iconId, 12);
      ic.position.set(pillX + 6, pillY + Math.round((pillH - 12) / 2));
      bar.addChild(ic);

      const txt = new Text({
        text: b.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 9 : 11,
          fontWeight: 'bold',
          fill: b.textHex,
        }),
      });
      txt.anchor.set(1, 0.5);
      txt.position.set(pillX + pillW - 6, pillY + pillH / 2);
      bar.addChild(txt);

      curRightX = pillX - (isCompact ? 4 : 6);
    }
  }

  /**
   * 2. Identity Card: Parchment panel with bronze frame, Name/Nickname (Cinzel), Element badge,
   * Stars (body tier), Class, Level / Max, EXP Bar with "next level"
   */
  private renderIdentityCard(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const card = new Container();
    card.position.set(x, y);
    parent.addChild(card);

    // Parchment-tinted dark panel with bronze border
    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.parchment, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    bg.roundRect(3, 3, w - 6, h - 6, 6);
    bg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.6 });
    card.addChild(bg);

    const id = vm.identity;
    const elemColors = this.getElementColors(id.element);

    // Element Badge
    const badgeW = isCompact ? 58 : 68;
    const badgeH = isCompact ? 18 : 20;
    const elemBadge = new Graphics();
    elemBadge.roundRect(8, 7, badgeW, badgeH, 4);
    elemBadge.fill({ color: elemColors.primary });
    elemBadge.stroke({ color: COLOR_NUM.inkCrypt, width: 1.2 });
    card.addChild(elemBadge);

    const elemTxt = new Text({
      text: id.element.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 8 : 9,
        fontWeight: '900',
        fill: COLOR_HEX.white,
      }),
    });
    elemTxt.anchor.set(0.5);
    elemTxt.position.set(8 + badgeW / 2, 7 + badgeH / 2);
    card.addChild(elemTxt);

    // Name / Nickname (Cinzel)
    const nameTxt = new Text({
      text: `${id.nickname.toUpperCase()}`,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: isCompact ? 13 : 16,
        fontWeight: '900',
        fill: COLOR_HEX.inkCrypt,
        letterSpacing: 0.8,
      }),
    });
    nameTxt.position.set(8 + badgeW + 8, 6);
    card.addChild(nameTxt);

    // Stars (= tier del cuerpo, 0 si es Alma sellada) on top right
    const starStr =
      id.stars > 0
        ? `T${id.stars}`
        : `(${t.sealed_soul})`;
    const starsTxt = new Text({
      text: starStr,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 10 : 12,
        fontWeight: '900',
        fill: id.stars > 0 ? COLOR_HEX.bronze : COLOR_HEX.rift,
      }),
    });
    starsTxt.anchor.set(1, 0);
    starsTxt.position.set(w - 8, 7);
    card.addChild(starsTxt);

    // Class & Level line
    const classAndLevel = new Text({
      text: `${id.dexNo} • ${t.class_label}: ${id.className}   |   ${t.level_short} ${id.level}/${id.maxLevel}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: isCompact ? 10 : 11,
        fontWeight: 'bold',
        fill: COLOR_HEX.inkCrypt,
      }),
    });
    classAndLevel.position.set(8, isCompact ? 28 : 31);
    card.addChild(classAndLevel);

    if (id.isKO) {
      const koTag = new Text({
        text: id.isSealed ? `[${t.sealed_soul.toUpperCase()}]` : '[KO]',
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 9 : 10,
          fontWeight: '900',
          fill: COLOR_HEX.rift,
        }),
      });
      koTag.anchor.set(1, 0);
      koTag.position.set(w - 8, isCompact ? 28 : 31);
      card.addChild(koTag);
    }

    // EXP Progress bar & next level text
    const barY = h - (isCompact ? 18 : 22);
    const barW = Math.round(w * 0.56);
    const expBar = new ThemeProgressBar({
      width: barW,
      height: isCompact ? 10 : 12,
      type: 'exp',
      value: id.expProgressRatio,
    });
    expBar.position.set(8, barY);
    card.addChild(expBar);

    const nextTextStr =
      id.level >= id.maxLevel
        ? t.max_level_reached
        : `${t.next_level}: ${id.expToNext} ${t.exp_label}`;
    const expLabel = new Text({
      text: nextTextStr,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 8 : 9,
        fontWeight: 'bold',
        fill: COLOR_HEX.inkCrypt,
      }),
    });
    expLabel.anchor.set(1, 0.5);
    expLabel.position.set(w - 8, barY + (isCompact ? 5 : 6));
    card.addChild(expLabel);
  }

  /**
   * 3. Sync & Ascension Card (Top Right): 5 Hearts, numeric Sync value, Ascension requirement
   * with check if body meets tier requirement and helper text if not
   */
  private renderSyncAndAscensionCard(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const card = new Container();
    card.position.set(x, y);
    parent.addChild(card);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    card.addChild(bg);

    // Sync row: numeric value + hearts
    const syncTitle = new Text({
      text: `${t.sync_label.toUpperCase()}: `,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 9 : 10,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    syncTitle.position.set(8, 7);
    card.addChild(syncTitle);

    const heartsTxt = new Text({
      text: `${vm.sync.hearts}/5 (${vm.sync.value}/${vm.sync.max})`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 9 : 11,
        fontWeight: 'bold',
        fill: COLOR_HEX.porcelainPink,
      }),
    });
    heartsTxt.position.set(8 + syncTitle.width, 6);
    card.addChild(heartsTxt);

    // Divider line
    const div = new Graphics();
    div.moveTo(8, isCompact ? 23 : 26);
    div.lineTo(w - 8, isCompact ? 23 : 26);
    div.stroke({ color: COLOR_NUM.bronze, width: 1, alpha: 0.5 });
    card.addChild(div);

    // Ascension info
    const asc = vm.ascension;
    if (!asc.known) {
      const noAscTxt = new Text({
        text: `${t.ascension_label}: ${asc.hint}`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: isCompact ? 9 : 10,
          fill: COLOR_HEX.smoke,
          wordWrap: true,
          wordWrapWidth: w - 16,
        }),
      });
      noAscTxt.position.set(8, isCompact ? 28 : 32);
      card.addChild(noAscTxt);
    } else {
      const checkIcon = asc.bodyOk ? 'OK' : 'X';
      const checkColor = asc.bodyOk ? COLOR_HEX.cyan : COLOR_HEX.rift;

      const reqLine = new Text({
        text: `${t.ascension_label} -> ${asc.targetName}: Nv.${asc.level} • T${asc.minTier}+`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: isCompact ? 9 : 11,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      reqLine.position.set(8, isCompact ? 27 : 31);
      card.addChild(reqLine);

      const hintLine = new Text({
        text: `[${checkIcon}] ${asc.hint} (${asc.itemName})`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 8 : 9,
          fontWeight: 'bold',
          fill: checkColor,
          wordWrap: true,
          wordWrapWidth: w - 16,
        }),
      });
      hintLine.position.set(8, isCompact ? 43 : 50);
      card.addChild(hintLine);
    }
  }

  /**
   * 4. Six Stat Boxes in 3x2 Grid, each with distinct color, short label, final value,
   * and interactive tooltip showing Base / IV / EV / Modifier breakdown
   */
  private renderStatsGrid(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const grid = new Container();
    grid.position.set(x, y);
    parent.addChild(grid);

    const cols = 3;
    const rows = 2;
    const gapX = isCompact ? 4 : 6;
    const gapY = isCompact ? 4 : 6;
    const cellW = Math.floor((w - gapX * (cols - 1)) / cols);
    const cellH = Math.floor((h - gapY * (rows - 1)) / rows);

    const statPalette = COLOR_STATS;

    const t = (esText as any).terms.sheet;
    const isKO = vm.identity.isKO;

    vm.stats.forEach((st: SheetStatItemVM, idx: number) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = col * (cellW + gapX);
      const cy = row * (cellH + gapY);

      const pal = statPalette[st.id] || statPalette.hp;
      const cell = new Container();
      cell.position.set(cx, cy);
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.alpha = isKO ? 0.55 : 1.0;

      const box = new Graphics();
      box.roundRect(0, 0, cellW, cellH, 6);
      box.fill({ color: pal.bg, alpha: 0.95 });
      box.stroke({ color: pal.border, width: 1.5 });
      cell.addChild(box);

      const lbl = new Text({
        text: st.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 9 : 10,
          fontWeight: 'bold',
          fill: pal.labelHex,
        }),
      });
      lbl.position.set(6, 4);
      cell.addChild(lbl);

      // Show IV/EV mini badge on top right of cell
      if (st.bonusFromIV > 0 || st.bonusFromEV > 0 || st.modifier !== 1) {
        const modTag =
          st.modifier < 1 ? '-' : st.modifier > 1 ? '+' : `+${st.bonusFromIV}`;
        const sub = new Text({
          text: modTag,
          style: new TextStyle({
            fontFamily: FONTS.hud,
            fontSize: isCompact ? 8 : 9,
            fontWeight: 'bold',
            fill: st.modifier < 1 ? COLOR_HEX.rift : COLOR_HEX.gold,
          }),
        });
        sub.anchor.set(1, 0);
        sub.position.set(cellW - 5, 4);
        cell.addChild(sub);
      }

      const valTxt = new Text({
        text: String(st.value),
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 13 : 16,
          fontWeight: '900',
          fill: st.penaltyNote ? COLOR_HEX.rift : COLOR_HEX.parchment,
        }),
      });
      valTxt.anchor.set(1, 1);
      valTxt.position.set(cellW - 6, cellH - 3);
      cell.addChild(valTxt);

      // Tooltip breakdown on click/hover
      const showStatBreakdown = () => {
        const lines = [
          `${t.stat_base}: ${st.baseValue}`,
          `+${t.stat_iv}: +${st.bonusFromIV}   +${t.stat_ev}: +${st.bonusFromEV}`,
          `${t.stat_mod}: x${st.modifier}`,
        ];
        if (st.penaltyNote) lines.push(`[!] ${st.penaltyNote}`);
        const globalPos = cell.getGlobalPosition();
        this.showClampedTooltip(
          `${st.label}: ${st.value}`,
          lines.join('\n'),
          globalPos.x,
          globalPos.y + cellH + 4
        );
      };

      cell.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('select');
        showStatBreakdown();
      });
      cell.on('pointerover', showStatBreakdown);
      cell.on('pointerout', () => this.tooltip.hide());

      grid.addChild(cell);
    });
  }

  /**
   * 5. Passive Ability Card (Name + 2-line description, or "Vacío" empty state)
   */
  private renderAbilityCard(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const card = new Container();
    card.position.set(x, y);
    parent.addChild(card);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 7);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.95 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    card.addChild(bg);

    const titleStr = vm.ability
      ? `${t.ability_title}: ${vm.ability.name.toUpperCase()}`
      : `${t.ability_title}: ${t.empty_slot.toUpperCase()}`;

    const titleTxt = new Text({
      text: titleStr,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 9 : 10,
        fontWeight: 'bold',
        fill: vm.ability ? COLOR_HEX.gold : COLOR_HEX.disabledText,
      }),
    });
    titleTxt.position.set(8, 5);
    card.addChild(titleTxt);

    const descTxt = new Text({
      text: vm.ability ? vm.ability.description : t.no_ability,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: isCompact ? 9 : 11,
        fill: vm.ability ? COLOR_HEX.parchment : COLOR_HEX.disabledText,
        wordWrap: true,
        wordWrapWidth: w - 16,
        lineHeight: isCompact ? 11 : 13,
      }),
    });
    descTxt.position.set(8, isCompact ? 19 : 21);
    card.addChild(descTxt);
  }

  /**
   * 6. Parts & Body Card (Souldolls Signature):
   * Paper-doll silhouette (Head, Torso, Arms, Legs) with color by state + 4 part HP bars +
   * Chassis data (Material, Tier, IV stars, Durability)
   */
  private renderPartsAndBodyCard(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const card = new Container();
    card.position.set(x, y);
    parent.addChild(card);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    card.addChild(bg);

    // Header strip with Chassis name, material, tier & IV quality stars
    const bodyInfo = vm.body;
    const ivStarsStr =
      bodyInfo.hasBody && bodyInfo.ivStars > 0
        ? `IV:${bodyInfo.ivStars}/5`
        : '';
    const headerTitle = bodyInfo.hasBody
      ? `${bodyInfo.chassisName} (${bodyInfo.material} • T${bodyInfo.tier} ${ivStarsStr} • ${bodyInfo.durabilityPct}%)`
      : `${t.parts_title}: ${t.sealed_soul.toUpperCase()}`;

    const hdrTxt = new Text({
      text: headerTitle,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 8.5 : 10,
        fontWeight: 'bold',
        fill: bodyInfo.hasBody ? COLOR_HEX.cyan : COLOR_HEX.disabledText,
      }),
    });
    hdrTxt.position.set(8, 5);
    card.addChild(hdrTxt);

    // Paper-doll silhouette on the left
    const silWrapper = new Container();
    const silScale = isCompact ? 1.15 : 1.45;
    silWrapper.position.set(isCompact ? 8 : 12, isCompact ? 22 : 26);
    silWrapper.scale.set(silScale);

    const silhouette = new HumanoidPartSilhouette();
    if (bodyInfo.hasBody) {
      silhouette.updateParts(
        {
          head: vm.parts?.head?.cur ?? 0,
          torso: vm.parts?.torso?.cur ?? 0,
          arms: vm.parts?.arms?.cur ?? 0,
          legs: vm.parts?.legs?.cur ?? 0,
        },
        {
          head: vm.parts?.head?.max ?? 1,
          torso: vm.parts?.torso?.max ?? 1,
          arms: vm.parts?.arms?.max ?? 1,
          legs: vm.parts?.legs?.max ?? 1,
        }
      );
    } else {
      // Sealed soul: all parts in grey/broken state
      silhouette.updateParts(
        { head: 0, torso: 0, arms: 0, legs: 0 },
        { head: 1, torso: 1, arms: 1, legs: 1 }
      );
      silhouette.alpha = 0.45;
    }
    this.activeSilhouette = silhouette;
    silWrapper.addChild(silhouette);
    card.addChild(silWrapper);

    // 4 Individual Part Bars on the right of the silhouette
    const barsStartX = isCompact ? 56 : 74;
    const barsW = w - barsStartX - 8;
    const partRows: Array<{ key: BodyPart; label: string; data: SheetPartEntryVM }> = [
      { key: 'head', label: t.part_head, data: vm.parts?.head || { cur: 0, max: 1, state: 'broken' } },
      { key: 'torso', label: t.part_torso, data: vm.parts?.torso || { cur: 0, max: 1, state: 'broken' } },
      { key: 'arms', label: t.part_arms, data: vm.parts?.arms || { cur: 0, max: 1, state: 'broken' } },
      { key: 'legs', label: t.part_legs, data: vm.parts?.legs || { cur: 0, max: 1, state: 'broken' } },
    ];

    const startY = isCompact ? 21 : 25;
    const availBarsH = h - startY - 4;
    const rowStep = Math.floor(availBarsH / 4);

    partRows.forEach((p, idx) => {
      const ry = startY + idx * rowStep;
      const rowCont = new Container();
      rowCont.position.set(barsStartX, ry);
      rowCont.eventMode = 'static';
      rowCont.cursor = 'pointer';

      let barColor = COLOR_SEMANTIC.ok;
      let stateText = t.state_ok;
      if (!bodyInfo.hasBody) {
        barColor = COLOR_NUM.disabledBorder;
        stateText = t.state_sealed;
      } else if (p.data.state === 'broken') {
        barColor = COLOR_SEMANTIC.danger;
        stateText = t.state_broken;
      } else if (p.data.state === 'low') {
        barColor = COLOR_SEMANTIC.warning;
        stateText = t.state_low;
      }

      const lblW = isCompact ? 46 : 56;
      const lbl = new Text({
        text: p.label,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: isCompact ? 9 : 10,
          fontWeight: 'bold',
          fill: bodyInfo.hasBody ? COLOR_HEX.parchment : COLOR_HEX.disabledText,
        }),
      });
      lbl.position.set(0, 1);
      rowCont.addChild(lbl);

      const trackX = lblW;
      const valLabelW = isCompact ? 62 : 76;
      const trackW = Math.max(40, barsW - lblW - valLabelW - 4);
      const trackH = isCompact ? 9 : 11;

      const track = new Graphics();
      track.roundRect(trackX, 2, trackW, trackH, 3);
      track.fill({ color: COLOR_NUM.smokedWood });
      track.stroke({ color: COLOR_NUM.bronze, width: 1 });

      const ratio =
        bodyInfo.hasBody && p.data.max > 0
          ? Math.max(0, Math.min(1, p.data.cur / p.data.max))
          : 0;
      if (ratio > 0) {
        const fillW = Math.max(2, Math.round((trackW - 2) * ratio));
        track.roundRect(trackX + 1, 3, fillW, trackH - 2, 2);
        track.fill({ color: barColor });
      }
      rowCont.addChild(track);

      const hpValTxt = new Text({
        text: bodyInfo.hasBody ? `${p.data.cur}/${p.data.max}` : `--/-- (${stateText})`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 8.5 : 9.5,
          fontWeight: 'bold',
          fill:
            !bodyInfo.hasBody
              ? COLOR_HEX.disabledText
              : p.data.state === 'broken'
              ? COLOR_HEX.rift
              : COLOR_HEX.parchment,
        }),
      });
      hpValTxt.anchor.set(1, 0);
      hpValTxt.position.set(barsW, 1);
      rowCont.addChild(hpValTxt);

      rowCont.on('pointerdown', () => {
        if (this.activeSilhouette) {
          this.activeSilhouette.flashZone(p.key, barColor);
        }
      });

      card.addChild(rowCont);
    });
  }

  /**
   * 7. Moves Card (2x2 Grid of up to 4 Moves):
   * Name, Element, Power/Accuracy, PP cur/max, likely body parts hit, and warning if Arms=0 blocks "weapon" move
   */
  private renderMovesCard(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const card = new Container();
    card.position.set(x, y);
    parent.addChild(card);

    const cols = 2;
    const rows = 2;
    const gapX = isCompact ? 4 : 6;
    const gapY = isCompact ? 4 : 6;
    const cellW = Math.floor((w - gapX) / cols);
    const cellH = Math.floor((h - gapY) / rows);

    for (let i = 0; i < 4; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * (cellW + gapX);
      const cy = row * (cellH + gapY);

      const mv = vm.moves[i];
      const cell = new Container();
      cell.position.set(cx, cy);

      const bg = new Graphics();
      bg.roundRect(0, 0, cellW, cellH, 6);

      if (!mv) {
        bg.fill({ color: COLOR_NUM.disabledBg, alpha: 0.7 });
        bg.stroke({ color: COLOR_NUM.disabledBorder, width: 1 });
        cell.addChild(bg);

        const emptyTxt = new Text({
          text: `— ${t.empty_slot} —`,
          style: new TextStyle({
            fontFamily: FONTS.body,
            fontSize: isCompact ? 9 : 10,
            fill: COLOR_HEX.disabledText,
          }),
        });
        emptyTxt.anchor.set(0.5);
        emptyTxt.position.set(cellW / 2, cellH / 2);
        cell.addChild(emptyTxt);
        card.addChild(cell);
        continue;
      }

      const elemCol = this.getElementColors(mv.type);
      const isBlocked = Boolean(mv.blockedReason);

      bg.fill({ color: isBlocked ? COLOR_NUM.inkCrypt : COLOR_NUM.smokedWood, alpha: 0.96 });
      bg.stroke({
        color: isBlocked ? COLOR_SEMANTIC.danger : elemCol.primary,
        width: 1.5,
      });
      cell.addChild(bg);

      // Move Name
      const nameTxt = new Text({
        text: mv.name,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: isCompact ? 9.5 : 11,
          fontWeight: 'bold',
          fill: isBlocked ? COLOR_HEX.rift : COLOR_HEX.parchment,
        }),
      });
      nameTxt.position.set(6, 3);
      cell.addChild(nameTxt);

      // PP badge on top right
      const ppTxt = new Text({
        text: `${t.move_pp} ${mv.pp}/${mv.ppMax}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 8 : 9,
          fontWeight: 'bold',
          fill: mv.pp > 0 ? COLOR_HEX.gold : COLOR_HEX.rift,
        }),
      });
      ppTxt.anchor.set(1, 0);
      ppTxt.position.set(cellW - 6, 4);
      cell.addChild(ppTxt);

      // Middle line: Element + Power + Accuracy
      const pwrStr = mv.power > 0 ? `${t.move_power}:${mv.power}` : 'EST';
      const metaLine = new Text({
        text: `${mv.type.toUpperCase()} • ${pwrStr} • ${t.move_accuracy}:${mv.accuracy}%`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 7.5 : 8.5,
          fill: COLOR_HEX.smoke,
        }),
      });
      metaLine.position.set(6, isCompact ? 17 : 20);
      cell.addChild(metaLine);

      // Bottom line: Likely parts hit OR Blocked reason
      const bottomStr = isBlocked
        ? `[!] ${mv.blockedReason}`
        : `${t.move_parts}: ${mv.likelyPartsLabels.join(', ')}`;
      const bottomTxt = new Text({
        text: bottomStr,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 7.5 : 8.5,
          fontWeight: isBlocked ? 'bold' : 'normal',
          fill: isBlocked ? COLOR_HEX.rift : COLOR_HEX.cyan,
        }),
      });
      bottomTxt.position.set(6, cellH - (isCompact ? 12 : 14));
      cell.addChild(bottomTxt);

      // Hover/click tooltip for full move description
      cell.eventMode = 'static';
      cell.cursor = 'pointer';
      cell.on('pointerdown', (e) => {
        e.stopPropagation();
        const gp = cell.getGlobalPosition();
        const extra = isBlocked ? `\n[!] ${mv.blockedReason}` : '';
        this.showClampedTooltip(
          `${mv.name} (${mv.type})`,
          `${mv.description}\n${t.move_parts}: ${mv.likelyPartsLabels.join(', ')}${extra}`,
          gp.x,
          gp.y - 68
        );
      });

      card.addChild(cell);
    }
  }

  /**
   * 8. Pedestal Showcase (Right Column):
   * Full-body Souldoll sprite with integer scale, nearest filtering, feet anchored on elliptical pedestal,
   * Bloque 39 idle breathing/bust animation, and 3/4 Front <-> 3/4 Back toggle button
   */
  private renderPedestalShowcase(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    souldoll: Souldoll,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const panel = new Container();
    panel.position.set(x, y);
    panel.eventMode = 'static';
    parent.addChild(panel);

    const elemCol = this.getElementColors(vm.identity.element);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 10);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    // Subtle elemental radial aura behind pedestal
    bg.circle(Math.round(w / 2), Math.round(h * 0.48), Math.round(Math.min(w, h) * 0.34));
    bg.fill({ color: elemCol.primary, alpha: 0.12 });
    panel.addChild(bg);

    // Pedestal Center Coordinates (Integer pixels)
    const pedX = Math.round(w / 2);
    const pedY = Math.round(h - (isCompact ? 28 : 36));
    const pedRx = Math.round(Math.min(w * 0.36, 92));
    const pedRy = Math.round(Math.max(12, pedRx * 0.24));

    // Draw Stone & Bronze Pedestal + Shadow (alpha 0.35)
    const pedG = new Graphics();
    // Base pillar rim
    pedG.ellipse(pedX, pedY + 5, pedRx + 4, pedRy + 3);
    pedG.fill({ color: COLOR_NUM.smokedWood });
    pedG.stroke({ color: COLOR_NUM.bronze, width: 2 });
    // Pedestal top surface
    pedG.ellipse(pedX, pedY, pedRx, pedRy);
    pedG.fill({ color: COLOR_NUM.smokedWood });
    pedG.stroke({ color: COLOR_NUM.gold, width: 1.5 });
    // Inner rune ring
    pedG.ellipse(pedX, pedY, Math.round(pedRx * 0.72), Math.round(pedRy * 0.72));
    pedG.stroke({ color: elemCol.secondary, width: 1, alpha: 0.55 });
    // Own elliptical shadow under feet (alpha 0.35 as in Bloque 38/40)
    pedG.ellipse(pedX, pedY, Math.round(pedRx * 0.48), Math.round(pedRy * 0.45));
    pedG.fill({ color: COLOR_NUM.black, alpha: 0.35 });
    panel.addChild(pedG);

    // Generate full-body sprite for current pedestal view (view_front34 or view_back34)
    const saveState = GlobalSaveService.getCurrentState();
    const outfitStyle = saveState.settings?.outfitStyle || 'clasico';
    const bustMode =
      saveState.settings?.bustAnimation ||
      ( outfitStyle === 'clasico' ? 'subtle' : 'normal' );

    const viewToRender: SpriteView = this.pedestalView;
    const brokenParts = vm.body.hasBody
      ? {
          head: vm.parts?.head?.cur ?? 10,
          torso: vm.parts?.torso?.cur ?? 10,
          arms: vm.parts?.arms?.cur ?? 10,
          legs: vm.parts?.legs?.cur ?? 10,
        }
      : { head: 10, torso: 10, arms: 10, legs: 10 };

    const canvas = SoulDollSpriteFactory.generateLayeredCanvas({
      speciesId: vm.speciesId,
      chassisMaterial: this.mapMaterialToFactory(vm.body.materialRaw),
      equippedWeaponId: vm.equipment.weapon.itemId,
      brokenParts,
      view: viewToRender,
      statusCondition: souldoll.status,
      outfitStyle,
    });

    const tex = GlobalAssetRegistry.createCrispPixiTexture(canvas);
    const frameMeta = SoulDollSpriteFactory.getFrameMeta(vm.speciesId, viewToRender);
    const idleMeta = frameMeta?.idle || {
      neck: 0.30,
      waist: 0.48,
      ...(viewToRender === 'view_front34'
        ? { bust: { y0: 0.31, y1: 0.45, x0: 0.30, x1: 0.72 } }
        : {}),
    };

    const idleMesh = new BattleIdleMesh({
      texture: tex,
      idleMeta,
      bustMode,
    });

    // Integer scale calculation so sprite fits cleanly above pedestal without touching borders
    const maxAvailSpriteH = Math.max(64, pedY - (isCompact ? 30 : 38));
    const maxAvailSpriteW = Math.max(48, w - 20);
    const scaleByH = Math.floor(maxAvailSpriteH / Math.max(1, tex.height));
    const scaleByW = Math.floor(maxAvailSpriteW / Math.max(1, tex.width));
    const intScale = Math.max(1, Math.min(scaleByH, scaleByW));

    idleMesh.position.set(pedX, pedY);
    idleMesh.setIntegerScale(intScale, false);

    if (vm.identity.isSealed) {
      // Translucent ethereal tint when sealed inside Soul Bottle
      idleMesh.alpha = 0.65;
      idleMesh.tint = COLOR_NUM.cyan;
    } else if (vm.identity.isKO) {
      idleMesh.alpha = 0.55;
      idleMesh.tint = COLOR_NUM.smoke;
    }

    this.activeIdleMesh = idleMesh;
    panel.addChild(idleMesh);

    // Top-right button to rotate through all 5 views (Frontal -> 3/4 Frontal -> Perfil -> 3/4 Espalda -> Espalda)
    const viewLabelMap: Record<string, string> = {
      view_front: t.pedestal_view_front_full || 'FRONTAL (1/5)',
      view_front34: t.pedestal_view_front34_full || t.pedestal_view_front,
      view_side: t.pedestal_view_side_full || 'PERFIL (3/5)',
      view_back34: t.pedestal_view_back34_full || t.pedestal_view_back,
      view_back: t.pedestal_view_back_full || 'ESPALDA (5/5)',
    };
    const toggleLabel = viewLabelMap[this.pedestalView] || t.pedestal_view_front;
    const viewBtn = new BrassButton({
      width: isCompact ? 114 : 134,
      height: isCompact ? 24 : 26,
      label: toggleLabel,
      fontSize: isCompact ? 8 : 9,
      onClick: () => this.togglePedestalView(),
    });
    viewBtn.position.set(w - (isCompact ? 120 : 140), 6);
    panel.addChild(viewBtn);

    // Swipe gesture on pedestal to navigate between Souldolls
    panel.on('pointerdown', (e) => {
      this.swipeStartX = e.global.x;
      this.swipeStartY = e.global.y;
    });
    panel.on('pointerup', (e) => {
      if (this.swipeStartX !== null && this.swipeStartY !== null) {
        const dx = e.global.x - this.swipeStartX;
        const dy = e.global.y - this.swipeStartY;
        if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) {
          this.navigateRoster(dx < 0 ? 1 : -1);
        }
      }
      this.swipeStartX = null;
      this.swipeStartY = null;
    });
  }

  /**
   * 9. Equipment Card (Bottom Right):
   * 3 Slots (Weapon, Relic, Accessory) with icon, item name, and effect summary
   */
  private renderEquipmentCard(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    souldoll: Souldoll,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const card = new Container();
    card.position.set(x, y);
    parent.addChild(card);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.96 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    card.addChild(bg);

    const slots: SheetEquipSlotVM[] = [
      vm.equipment.weapon,
      vm.equipment.relic,
      vm.equipment.accessory,
    ];

    const pad = isCompact ? 5 : 7;
    const rowGap = isCompact ? 3 : 4;
    const slotH = Math.floor((h - pad * 2 - rowGap * 2) / 3);
    const slotW = w - pad * 2;

    slots.forEach((slot, idx) => {
      const sy = pad + idx * (slotH + rowGap);
      const row = new Container();
      row.position.set(pad, sy);
      row.eventMode = 'static';
      row.cursor = 'pointer';

      const hasItem = Boolean(slot.itemId);
      const rBg = new Graphics();
      rBg.roundRect(0, 0, slotW, slotH, 5);
      rBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.92 });
      rBg.stroke({
        color: hasItem ? COLOR_NUM.gold : COLOR_NUM.disabledBorder,
        width: 1.2,
      });
      row.addChild(rBg);

      // Icon badge using IconRegistry
      const iconBoxSize = Math.max(16, slotH - 6);
      const iconBox = new Graphics();
      iconBox.roundRect(4, 3, iconBoxSize, iconBoxSize, 4);
      iconBox.fill({ color: COLOR_NUM.smokedWood });
      iconBox.stroke({ color: COLOR_NUM.bronze, width: 1 });
      row.addChild(iconBox);

      const slotIconId =
        slot.slotKey === 'weapon' ? 'sword' : slot.slotKey === 'relic' ? 'relic' : 'accessory';
      const ic = IconRegistry.create(slotIconId, Math.max(10, iconBoxSize - 4));
      ic.position.set(6, 5);
      row.addChild(ic);

      // Slot Label + Item Name
      const textX = 8 + iconBoxSize;
      const nameStr = `${slot.slotLabel}: ${slot.name}`;
      const nameTxt = new Text({
        text: nameStr,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: isCompact ? 9 : 10.5,
          fontWeight: 'bold',
          fill: hasItem ? COLOR_HEX.parchment : COLOR_HEX.disabledText,
        }),
      });
      nameTxt.position.set(textX, 2);
      row.addChild(nameTxt);

      // Effect summary
      const effTxt = new Text({
        text: hasItem ? slot.effectSummary : t.empty_slot,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isCompact ? 7.5 : 8.5,
          fill: hasItem ? COLOR_HEX.cyan : COLOR_HEX.disabledText,
        }),
      });
      effTxt.position.set(textX, slotH - (isCompact ? 11 : 13));
      row.addChild(effTxt);

      row.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('confirm');
        this.activeEquipModalSlot = slot.slotKey;
        this.renderEquipModal(souldoll);
      });

      card.addChild(row);
    });
  }

  /**
   * 10. Bottom Bar:
   * Prev/Next Souldoll arrows (< 1/N >) + Action buttons (Equipar, Reparar en Taller, Cambiar Cuerpo, Volver)
   */
  private renderFooterBar(
    parent: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    souldoll: Souldoll,
    vm: SoulDollSheetVM,
    isCompact: boolean
  ): void {
    const t = (esText as any).terms.sheet;
    const footer = new Container();
    footer.position.set(x, y);
    parent.addChild(footer);

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.98 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    footer.addChild(bg);

    const btnH = h - 10;
    const btnY = 5;

    // Navigation Controls on the Left (< 1/6 >)
    const prevBtn = new BrassButton({
      width: isCompact ? 32 : 38,
      height: btnH,
      label: '◀',
      fontSize: isCompact ? 11 : 13,
      disabled: vm.nav.total <= 1,
      onClick: () => this.navigateRoster(-1),
    });
    prevBtn.position.set(6, btnY);
    footer.addChild(prevBtn);

    const navIndicatorW = isCompact ? 46 : 58;
    const navTxt = new Text({
      text: `${vm.nav.index + 1} / ${vm.nav.total}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: isCompact ? 10 : 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    navTxt.anchor.set(0.5);
    navTxt.position.set(6 + (isCompact ? 32 : 38) + navIndicatorW / 2, h / 2);
    footer.addChild(navTxt);

    const nextBtn = new BrassButton({
      width: isCompact ? 32 : 38,
      height: btnH,
      label: '▶',
      fontSize: isCompact ? 11 : 13,
      disabled: vm.nav.total <= 1,
      onClick: () => this.navigateRoster(1),
    });
    nextBtn.position.set(6 + (isCompact ? 32 : 38) + navIndicatorW, btnY);
    footer.addChild(nextBtn);

    // 2 Action Buttons on the Right (Equipar y Volver; sin acceso remoto al Taller ni Vincular Alma)
    const navEndX = 6 + (isCompact ? 32 : 38) * 2 + navIndicatorW + 8;
    const availActionsW = w - navEndX - 6;
    const actionGap = isCompact ? 6 : 12;
    const btnW = Math.floor((availActionsW - actionGap) / 2);
    const fontSize = isCompact ? 9.5 : 11;

    const actions: Array<{ label: string; useKiGlow?: boolean; onClick: () => void }> = [
      {
        label: t.btn_equip,
        useKiGlow: true,
        onClick: () => {
          this.activeEquipModalSlot = 'weapon';
          this.renderEquipModal(souldoll);
        },
      },
      {
        label: t.btn_back,
        onClick: () => {
          GlobalSceneManager.popScene();
        },
      },
    ];

    actions.forEach((act, idx) => {
      const btn = new BrassButton({
        width: btnW,
        height: btnH,
        label: act.label,
        fontSize,
        useKiGlow: act.useKiGlow,
        onClick: act.onClick,
      });
      btn.position.set(navEndX + idx * (btnW + actionGap), btnY);
      footer.addChild(btn);
    });
  }

  /**
   * Modal to Equip / Unequip Weapon, Relic, or Accessory from real inventory
   */
  private renderEquipModal(souldoll: Souldoll): void {
    this.modalContainer.removeChildren();
    if (!this.activeEquipModalSlot) return;

    const t = (esText as any).terms.sheet;
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const saveState = GlobalSaveService.getCurrentState();

    // Backdrop
    const dimmer = new Graphics();
    dimmer.rect(0, 0, width, height);
    dimmer.fill({ color: COLOR_NUM.black, alpha: 0.72 });
    dimmer.eventMode = 'static';
    dimmer.on('pointerdown', () => this.closeEquipModal());
    this.modalContainer.addChild(dimmer);

    const modalW = Math.min(440, width - 24);
    const modalH = Math.min(380, height - 40);
    const mx = Math.round((width - modalW) / 2);
    const my = Math.round((height - modalH) / 2);

    const box = new Container();
    box.position.set(mx, my);
    box.eventMode = 'static';
    this.modalContainer.addChild(box);

    const bg = new Graphics();
    bg.roundRect(0, 0, modalW, modalH, 10);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 3 });
    box.addChild(bg);

    const title = new Text({
      text: t.modal_select_slot,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    title.position.set(14, 12);
    box.addChild(title);

    // Slot selector tabs (Arma | Reliquia | Accesorio)
    const slotTabs: Array<{ key: 'weapon' | 'relic' | 'accessory'; label: string }> = [
      { key: 'weapon', label: t.slot_weapon },
      { key: 'relic', label: t.slot_relic },
      { key: 'accessory', label: t.slot_accessory },
    ];

    const tabW = Math.floor((modalW - 28 - 12) / 3);
    slotTabs.forEach((st, idx) => {
      const isSel = this.activeEquipModalSlot === st.key;
      const tabBtn = new BrassButton({
        width: tabW,
        height: 28,
        label: st.label.toUpperCase(),
        fontSize: 10,
        useKiGlow: isSel,
        onClick: () => {
          this.activeEquipModalSlot = st.key;
          this.renderEquipModal(souldoll);
        },
      });
      tabBtn.position.set(14 + idx * (tabW + 6), 38);
      box.addChild(tabBtn);
    });

    // Compatible items from player's inventory
    const slotKey = this.activeEquipModalSlot;
    const inv = saveState.inventory || {};
    const compatibleItems = Object.entries(inv)
      .filter(([itemId, count]) => {
        if ((count || 0) <= 0) return false;
        const def = ITEMS_DATA[itemId];
        if (!def) return false;
        if (slotKey === 'weapon') return def.category === 'weapon';
        if (slotKey === 'relic') return def.category === 'relic';
        return def.category === 'crystal' || def.category === 'relic';
      })
      .map(([itemId, count]) => ({ item: ITEMS_DATA[itemId], count }));

    // Unequip button
    const unequipBtn = new BrassButton({
      width: modalW - 28,
      height: 30,
      label: t.modal_unequip,
      fontSize: 10,
      onClick: () => {
        if (!souldoll.equipped) souldoll.equipped = {};
        const prevItem = souldoll.equipped[slotKey];
        if (prevItem) {
          saveState.inventory[prevItem] = (saveState.inventory[prevItem] || 0) + 1;
        }
        souldoll.equipped[slotKey] = null;
        if (slotKey === 'relic') souldoll.heldItemId = null;
        GlobalSaveService.save();
        this.closeEquipModal();
      },
    });
    unequipBtn.position.set(14, 76);
    box.addChild(unequipBtn);

    if (compatibleItems.length === 0) {
      const emptyTxt = new Text({
        text: t.modal_no_items,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 12,
          fill: COLOR_HEX.smoke,
          wordWrap: true,
          wordWrapWidth: modalW - 32,
        }),
      });
      emptyTxt.position.set(16, 124);
      box.addChild(emptyTxt);
    } else {
      compatibleItems.slice(0, 5).forEach((entry, idx) => {
        const iy = 114 + idx * 42;
        const itemBtn = new BrassButton({
          width: modalW - 28,
          height: 36,
          label: `${entry.item.name} (x${entry.count}) — ${entry.item.description.slice(0, 32)}`,
          fontSize: 10,
          onClick: () => {
            if (!souldoll.equipped) souldoll.equipped = {};
            const prevItem = souldoll.equipped[slotKey];
            if (prevItem) {
              saveState.inventory[prevItem] = (saveState.inventory[prevItem] || 0) + 1;
            }
            saveState.inventory[entry.item.id] = Math.max(
              0,
              (saveState.inventory[entry.item.id] || 1) - 1
            );
            souldoll.equipped[slotKey] = entry.item.id;
            if (slotKey === 'relic') souldoll.heldItemId = entry.item.id;
            GlobalSaveService.save();
            this.closeEquipModal();
          },
        });
        itemBtn.position.set(14, iy);
        box.addChild(itemBtn);
      });
    }

    const closeBtn = new BrassButton({
      width: 110,
      height: 32,
      label: t.modal_close,
      fontSize: 11,
      onClick: () => this.closeEquipModal(),
    });
    closeBtn.position.set(modalW - 124, modalH - 42);
    box.addChild(closeBtn);
  }

  private closeEquipModal(): void {
    this.activeEquipModalSlot = null;
    this.modalContainer.removeChildren();
    this.renderSheet();
  }

  private showClampedTooltip(title: string, body: string, x: number, y: number): void {
    const maxW = GlobalPixiRenderer.width - 210;
    const maxH = GlobalPixiRenderer.height - 110;
    const clampedX = Math.max(8, Math.min(maxW, Math.round(x)));
    const clampedY = Math.max(8, Math.min(maxH, Math.round(y)));
    this.tooltip.show(title, body, clampedX, clampedY);
  }

  public update(dt: number): void {
    if (this.activeIdleMesh && !this.activeIdleMesh.destroyed) {
      this.activeIdleMesh.update(dt);
    }

    if (this.activeEquipModalSlot) {
      if (GlobalInput.justPressed('CANCEL')) {
        this.closeEquipModal();
      }
      return;
    }

    if (GlobalInput.justPressed('LEFT')) {
      this.navigateRoster(-1);
    } else if (GlobalInput.justPressed('RIGHT')) {
      this.navigateRoster(1);
    } else if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      GlobalAudioService.playSfx('cancel');
      GlobalSceneManager.popScene();
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = undefined;
    }
    if (this.boundEventRefresh) {
      GlobalEventBus.off('save:saved', this.boundEventRefresh);
      GlobalEventBus.off('soul:ascended', this.boundEventRefresh);
      GlobalEventBus.off('creature:evolved', this.boundEventRefresh);
      GlobalEventBus.off('item:obtained', this.boundEventRefresh);
      this.boundEventRefresh = undefined;
    }
    if (this.activeIdleMesh) {
      this.activeIdleMesh.destroy({ children: true });
      this.activeIdleMesh = null;
    }
    this.container.destroy({ children: true });
  }
}
