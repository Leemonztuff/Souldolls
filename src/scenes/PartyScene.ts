import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { SoulDollSpriteFactory } from '../render/procedural/SoulDollSpriteFactory';
import { GlobalInput } from '../core/Input';
import { GlobalEventBus } from '../core/EventBus';
import { StatCalculator } from '../systems/battle/StatCalculator';
import {
  ScreenFrame,
  KitCard,
  KitButton,
  KitBar,
  KitBadge,
  KitStars,
  KitHearts,
  KitStatBox,
  KitPartsSilhouette,
  IconRegistry,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildPartyVM, PartyScreenVM, PartyMemberVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_ELEMENT } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Pantalla de Gestión de Equipo de Souldolls ("PartyScene").
 * Permite al jugador visualizar estadísticas completas de sus criaturas capturadas,
 * inspeccionar partes corporales, equipamiento y movimientos, y reordenar el grupo principal
 * (intercambio flexible, subir/bajar posición y asignación directa de líder).
 * 100% PixiJS con UI Kit y tokens de theme.json.
 */
export class PartyScene implements IScene {
  public name = 'Party';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private screenFrame: ScreenFrame | null = null;
  private focusManager: FocusManager = new FocusManager();
  private selectedIndex = 0;
  private swapSourceIndex: number | null = null;
  private boundKeyDown?: (e: KeyboardEvent) => void;

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.selectedIndex = 0;
    this.swapSourceIndex = null;

    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        this.toggleSwapMode();
      } else if (e.key === 'l' || e.key === 'L') {
        this.makeSelectedLead();
      } else if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'ArrowUp')) {
        this.moveMember(-1);
      } else if (e.key === 'd' || e.key === 'D' || (e.ctrlKey && e.key === 'ArrowDown')) {
        this.moveMember(1);
      } else if (e.key === 'h' || e.key === 'H') {
        this.quickHealSelected();
      }
    };
    window.addEventListener('keydown', this.boundKeyDown);

    this.buildUI();
    GlobalAudioService.playSfx('confirm');
  }

  private buildUI(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const state = GlobalSaveService.getCurrentState();
    const vm = buildPartyVM(state);
    const t = (esText as any).terms.group_a.party;

    if (this.selectedIndex >= vm.members.length) {
      this.selectedIndex = Math.max(0, vm.members.length - 1);
    }

    const selectedMember = vm.members[this.selectedIndex];
    const isSwapActive = this.swapSourceIndex !== null;

    const frame = new ScreenFrame({
      width,
      height,
      title: isSwapActive
        ? `REORDENAR EQUIPO — SELECCIONA DESTINO`
        : vm.title,
      currencies: [
        { iconId: 'elixir', value: vm.elixirCount },
        { iconId: 'coin', value: vm.money },
        { iconId: 'guild_seal', value: (state.badges || []).length },
      ],
      onClose: () => {
        if (this.swapSourceIndex !== null) {
          this.cancelSwapMode();
        } else {
          this.close();
        }
      },
      secondaryAction: isSwapActive
        ? {
            label: vm.btnSwapCancel,
            iconId: 'close',
            onClick: () => this.cancelSwapMode(),
          }
        : selectedMember && !selectedMember.isLead
        ? {
            label: vm.btnLead,
            iconId: 'star_full',
            onClick: () => this.makeSelectedLead(),
          }
        : {
            label: vm.btnBack,
            iconId: 'chevron_left',
            onClick: () => this.close(),
          },
      primaryAction: isSwapActive
        ? undefined
        : selectedMember
        ? {
            label: vm.btnSheet,
            iconId: 'codex_book',
            onClick: () => {
              GlobalSceneManager.pushScene('CreatureDetail', {
                index: this.selectedIndex,
                list: state.party,
              });
            },
          }
        : undefined,
    });
    this.screenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const isTwoCol = width >= 840;

    if (vm.members.length === 0) {
      const emptyCard = new KitCard({
        width: cw,
        height: 160,
        variant: 'smokedWood',
        title: vm.secActive,
      });
      emptyCard.position.set(0, 0);
      frame.contentRoot.addChild(emptyCard);

      const emptyTxt = new Text({
        text: vm.emptyText,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 16,
          fill: COLOR_HEX.smoke,
        }),
      });
      emptyTxt.roundPixels = true;
      emptyTxt.position.set(16, 56);
      emptyCard.addChild(emptyTxt);

      frame.setContentTotalHeight(176);
      UIKitLinter.inspectTree(frame, 'PartyScene');
      return;
    }

    const colW = isTwoCol ? Math.floor((cw - 16) / 2) : cw;

    // --- COLUMNA 1: LISTA DEL ROSTER ACTIVO (1..6) ---
    const rosterContainer = new Container();
    rosterContainer.roundPixels = true;
    rosterContainer.position.set(0, 0);
    frame.contentRoot.addChild(rosterContainer);

    const cardH = 92;
    const gapY = 8;

    vm.members.forEach((m, idx) => {
      const y = idx * (cardH + gapY);
      const card = this.renderMemberCard(m, idx, colW, cardH, vm);
      card.position.set(0, y);
      rosterContainer.addChild(card);

      this.focusManager.register({
        container: card,
        width: colW,
        height: cardH,
        onActivate: () => {
          this.handleMemberCardClick(idx);
        },
      });
    });

    const rosterTotalH = vm.members.length * (cardH + gapY);

    // --- COLUMNA 2 (O PANEL INFERIOR): VISTA DE ESTADÍSTICAS Y ACCIONES DE FORMACIÓN ---
    const detailPanelX = isTwoCol ? colW + 16 : 0;
    const detailPanelY = isTwoCol ? 0 : rosterTotalH + 12;

    if (selectedMember) {
      const statsPanel = this.renderStatsAndActionDeck(
        selectedMember,
        colW,
        vm,
        t,
        state
      );
      statsPanel.position.set(detailPanelX, detailPanelY);
      frame.contentRoot.addChild(statsPanel);

      const statsPanelH = (statsPanel as any).__totalHeight || 380;
      const totalH = isTwoCol
        ? Math.max(rosterTotalH, statsPanelH) + 16
        : rosterTotalH + statsPanelH + 28;
      frame.setContentTotalHeight(totalH);
    } else {
      frame.setContentTotalHeight(rosterTotalH + 16);
    }

    this.focusManager.setFocus(this.selectedIndex, false);
    UIKitLinter.inspectTree(frame, 'PartyScene');
  }

  private handleMemberCardClick(idx: number): void {
    if (this.swapSourceIndex !== null) {
      if (this.swapSourceIndex === idx) {
        this.cancelSwapMode();
      } else {
        this.swapPartyMembers(this.swapSourceIndex, idx);
      }
      return;
    }

    if (this.selectedIndex === idx) {
      const state = GlobalSaveService.getCurrentState();
      GlobalSceneManager.pushScene('CreatureDetail', {
        index: idx,
        list: state.party,
      });
    } else {
      this.selectedIndex = idx;
      GlobalAudioService.playSfx('select');
      this.buildUI();
    }
  }

  private renderMemberCard(
    m: PartyMemberVM,
    idx: number,
    w: number,
    h: number,
    _vm: PartyScreenVM
  ): KitCard {
    const t = (esText as any).terms.group_a.party;
    const isSel = idx === this.selectedIndex;
    const isSwapSource = this.swapSourceIndex === idx;

    const card = new KitCard({
      width: w,
      height: h,
      variant: isSwapSource ? 'parchment' : isSel ? 'smokedWood' : 'inkCrypt',
      title: `${idx + 1}º · ${m.name} (Nv.${m.level})`,
    });

    if (isSwapSource) {
      const pulseG = new Graphics();
      pulseG.roundRect(0, 0, w, h, 8);
      pulseG.stroke({ color: COLOR_NUM.gold, width: 3 });
      card.addChild(pulseG);
    }

    // Badge Elemento
    const elemBadge = new KitBadge(m.element, 'element', m.element);
    elemBadge.position.set(w - elemBadge.width - 10, 6);
    card.addChild(elemBadge);

    // Badges de Estado
    if (m.isLead) {
      const leadBadge = new KitBadge(t.lead_badge, 'tier', 'tier');
      leadBadge.position.set(w - elemBadge.width - leadBadge.width - 14, 6);
      card.addChild(leadBadge);
    } else if (m.isKO) {
      const koBadge = new KitBadge(t.ko_badge, 'element', 'fuego');
      koBadge.position.set(w - elemBadge.width - koBadge.width - 14, 6);
      card.addChild(koBadge);
    } else if (m.isSealed) {
      const sealedBadge = new KitBadge(t.sealed_badge, 'rarity', 'rara');
      sealedBadge.position.set(w - elemBadge.width - sealedBadge.width - 14, 6);
      card.addChild(sealedBadge);
    }

    // Miniatura Souldoll Sprite
    const miniTex = GlobalAssetRegistry.getCreatureSpritePixi(m.speciesId, 'view_front');
    if (miniTex) {
      const spr = new Sprite(miniTex);
      spr.roundPixels = true;
      spr.anchor.set(0.5, 1.0);
      spr.scale.set(0.48);
      spr.position.set(24, h - 8);
      if (m.isKO) spr.alpha = 0.5;
      card.addChild(spr);
    }

    // Barra de Salud (HP)
    const contentX = 50;
    const barW = Math.max(100, w - contentX - 54);
    const hpBar = new KitBar(
      'hp',
      m.hpRatio,
      barW,
      16,
      4,
      `${m.hpCur}/${m.hpMax} PS`
    );
    hpBar.position.set(contentX, 34);
    card.addChild(hpBar);

    // Información de Chasis y Tier
    const chassisTxt = new Text({
      text: `${m.chassisName} · ${m.weaponName}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 12,
        fill: isSwapSource ? COLOR_HEX.inkCrypt : COLOR_HEX.parchmentDark,
      }),
    });
    chassisTxt.roundPixels = true;
    chassisTxt.position.set(contentX, 58);
    card.addChild(chassisTxt);

    const stars = new KitStars(m.tier, 5, 10);
    stars.position.set(contentX, 74);
    card.addChild(stars);

    // Silueta de partes miniatura
    const sil = new KitPartsSilhouette();
    sil.scale.set(0.72);
    sil.position.set(w - 38, 36);
    sil.updateParts(
      {
        head: m.parts?.head?.cur ?? 1,
        torso: m.parts?.torso?.cur ?? 1,
        arms: m.parts?.arms?.cur ?? 1,
        legs: m.parts?.legs?.cur ?? 1,
      },
      {
        head: m.parts?.head?.max ?? 1,
        torso: m.parts?.torso?.max ?? 1,
        arms: m.parts?.arms?.max ?? 1,
        legs: m.parts?.legs?.max ?? 1,
      }
    );
    card.addChild(sil);

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleMemberCardClick(idx);
    });

    return card;
  }

  private renderStatsAndActionDeck(
    m: PartyMemberVM,
    w: number,
    vm: PartyScreenVM,
    t: any,
    state: any
  ): Container {
    const deck = new Container();
    deck.roundPixels = true;

    if (!m) {
      return deck;
    }

    const memberName = (m.name || 'Souldoll').toUpperCase();
    const speciesName = m.speciesName || 'Desconocida';
    const level = typeof m.level === 'number' ? m.level : 1;
    const sync = typeof m.sync === 'number' ? m.sync : 0;
    const syncHearts = typeof m.syncHearts === 'number' ? m.syncHearts : 0;

    const stats = m.stats || { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };
    const parts = {
      head: m.parts?.head || { cur: 0, max: 0 },
      torso: m.parts?.torso || { cur: 0, max: 0 },
      arms: m.parts?.arms || { cur: 0, max: 0 },
      legs: m.parts?.legs || { cur: 0, max: 0 },
    };

    const sheetTerms = esText?.terms?.sheet || {
      stat_hp: 'PS',
      stat_atk: 'ATQ',
      stat_def: 'DEF',
      stat_spAtk: 'ATQ.E',
      stat_spDef: 'DEF.E',
      stat_speed: 'VEL',
      parts_title: 'ESTADO DE PARTES',
    };

    // 1. Tarjeta de Estadísticas y Atributos de Combate
    const cardH = 340;
    const card = new KitCard({
      width: w,
      height: cardH,
      variant: 'smokedWood',
      title: `${vm?.secStatsPreview || 'ESTADÍSTICAS'} — ${memberName}`,
    });
    deck.addChild(card);

    // Cabecera con especie, corazones de sincronía y sprite
    const subTitle = new Text({
      text: `${speciesName} · Nv.${level} · Sincronía ${sync}/255`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    subTitle.roundPixels = true;
    subTitle.position.set(14, 38);
    card.addChild(subTitle);

    const hearts = new KitHearts(syncHearts, 5, 12);
    hearts.position.set(w - 84, 40);
    card.addChild(hearts);

    // Miniatura de combate de alta fidelidad
    const previewCanvas = SoulDollSpriteFactory.generateLayeredCanvas({
      speciesId: m.speciesId || 'maga_fuego',
      chassisMaterial: 'wood',
      view: 'view_front',
    });
    const previewTex = GlobalAssetRegistry.createCrispPixiTexture(previewCanvas);
    const sprite = new Sprite(previewTex);
    sprite.roundPixels = true;
    sprite.anchor.set(0.5, 1.0);
    const maxSpriteH = 80;
    const spriteScale = Math.max(1, Math.floor(maxSpriteH / Math.max(1, previewTex.height)));
    sprite.scale.set(spriteScale);
    sprite.position.set(40, 150);
    card.addChild(sprite);

    // Rejilla de 6 Estadísticas (HP, ATK, DEF, SP.ATK, SP.DEF, SPEED)
    const statBoxStartX = 84;
    const statGridW = w - statBoxStartX - 14;
    const statBoxW = Math.floor((statGridW - 8) / 3);
    const statBoxH = 40;

    const statsList: Array<{
      id: 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed';
      lbl: string;
      val: number;
    }> = [
      { id: 'hp', lbl: sheetTerms.stat_hp || 'PS', val: typeof stats.hp === 'number' ? stats.hp : 0 },
      { id: 'atk', lbl: sheetTerms.stat_atk || 'ATQ', val: typeof stats.atk === 'number' ? stats.atk : 0 },
      { id: 'def', lbl: sheetTerms.stat_def || 'DEF', val: typeof stats.def === 'number' ? stats.def : 0 },
      { id: 'spAtk', lbl: sheetTerms.stat_spAtk || 'ATQ.E', val: typeof stats.spAtk === 'number' ? stats.spAtk : 0 },
      { id: 'spDef', lbl: sheetTerms.stat_spDef || 'DEF.E', val: typeof stats.spDef === 'number' ? stats.spDef : 0 },
      { id: 'speed', lbl: sheetTerms.stat_speed || 'VEL', val: typeof stats.speed === 'number' ? stats.speed : 0 },
    ];

    if (Array.isArray(statsList)) {
      statsList.forEach((st, idx) => {
        if (!st) return;
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = statBoxStartX + col * (statBoxW + 4);
        const by = 64 + row * (statBoxH + 4);
        const box = new KitStatBox(st.id, st.lbl, st.val, statBoxW, statBoxH);
        box.position.set(bx, by);
        card.addChild(box);
      });
    }

    // Estado detallado de las 4 partes corporales
    const partsTitle = new Text({
      text: `${sheetTerms.parts_title || 'ESTADO DE PARTES'}: Cabeza ${parts.head.cur}/${parts.head.max} · Torso ${parts.torso.cur}/${parts.torso.max} · Brazos ${parts.arms.cur}/${parts.arms.max} · Piernas ${parts.legs.cur}/${parts.legs.max}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 12,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: w - 28,
      }),
    });
    partsTitle.roundPixels = true;
    partsTitle.position.set(14, 160);
    card.addChild(partsTitle);

    // Lista de Técnicas / Movimientos
    const movesTitle = new Text({
      text: `TÉCNICAS Y MOVIMIENTOS:`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 11,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    movesTitle.roundPixels = true;
    movesTitle.position.set(14, 186);
    card.addChild(movesTitle);

    const validMoves = Array.isArray(m.moves) ? m.moves.filter(Boolean) : [];
    const moveW = Math.floor((w - 32) / 2);
    validMoves.slice(0, 4).forEach((mv, idx) => {
      if (!mv) return;
      const mx = 14 + (idx % 2) * (moveW + 4);
      const my = 204 + Math.floor(idx / 2) * 26;

      const moveRow = new Graphics();
      moveRow.roundRect(0, 0, moveW, 22, 4);
      moveRow.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
      moveRow.stroke({ color: COLOR_NUM.bronze, width: 1 });
      moveRow.position.set(mx, my);
      card.addChild(moveRow);

      const moveName = mv.name || 'Técnica';
      const curPp = typeof mv.currentPp === 'number' ? mv.currentPp : 0;
      const maxPp = typeof mv.maxPp === 'number' ? mv.maxPp : 0;

      const moveTxt = new Text({
        text: `${moveName} (${curPp}/${maxPp} PP)`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 11,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      moveTxt.roundPixels = true;
      moveTxt.position.set(6, 4);
      moveRow.addChild(moveTxt);
    });

    // Equipamiento actual
    const weaponName = m.weaponName || 'Ninguna';
    const relicName = m.relicName || 'Ninguna';
    const equipTxt = new Text({
      text: `ARMAMENTO: ${weaponName}  |  RELIQUIA: ${relicName}`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 11,
        fill: COLOR_HEX.smoke,
      }),
    });
    equipTxt.roundPixels = true;
    equipTxt.position.set(14, 260);
    card.addChild(equipTxt);

    // Aviso de ayuda sobre reordenación
    const isSwapActive = this.swapSourceIndex !== null;
    const sourceDoll = this.swapSourceIndex !== null ? vm.members[this.swapSourceIndex] : null;
    const hintTxt = new Text({
      text: isSwapActive && sourceDoll
        ? t.swap_selected_hint.replace('{name}', sourceDoll.name.toUpperCase())
        : `Toca una Souldoll para seleccionarla. Usa los botones de abajo para reordenar la formación.`,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 11.5,
        fill: isSwapActive ? COLOR_HEX.gold : COLOR_HEX.cyan,
        wordWrap: true,
        wordWrapWidth: w - 28,
      }),
    });
    hintTxt.roundPixels = true;
    hintTxt.position.set(14, 282);
    card.addChild(hintTxt);

    // 2. Botonera de Gestión y Reordenación (Acciones Rápidas)
    const actionsCardH = 110;
    const actionsCard = new KitCard({
      width: w,
      height: actionsCardH,
      variant: 'inkCrypt',
      title: t.sec_actions,
    });
    actionsCard.position.set(0, cardH + 8);
    deck.addChild(actionsCard);

    const btnH = 36;
    const halfW = Math.floor((w - 36) / 2);
    const thirdW = Math.floor((w - 44) / 3);

    // Fila 1: [ ▲ SUBIR ] [ ▼ BAJAR ] [ ★ HACER LÍDER ]
    const btnUp = new KitButton({
      width: thirdW,
      height: btnH,
      label: vm.btnMoveUp,
      fontSize: 11,
      variant: 'secondary',
      disabled: m.index <= 0,
      onClick: () => this.moveMember(-1),
    });
    btnUp.position.set(14, 32);
    actionsCard.addChild(btnUp);
    this.focusManager.register(btnUp.toFocusable());

    const btnDown = new KitButton({
      width: thirdW,
      height: btnH,
      label: vm.btnMoveDown,
      fontSize: 11,
      variant: 'secondary',
      disabled: m.index >= vm.members.length - 1,
      onClick: () => this.moveMember(1),
    });
    btnDown.position.set(14 + thirdW + 8, 32);
    actionsCard.addChild(btnDown);
    this.focusManager.register(btnDown.toFocusable());

    const btnLead = new KitButton({
      width: thirdW,
      height: btnH,
      label: vm.btnLead,
      fontSize: 11,
      variant: m.isLead ? 'secondary' : 'primary',
      disabled: m.isLead,
      onClick: () => this.makeSelectedLead(),
    });
    btnLead.position.set(14 + (thirdW + 8) * 2, 32);
    actionsCard.addChild(btnLead);
    this.focusManager.register(btnLead.toFocusable());

    // Fila 2: [ 🔄 REORDENAR / INTERCAMBIAR ] [ 💊 USAR ELIXIR ]
    const btnSwap = new KitButton({
      width: halfW,
      height: btnH,
      label: isSwapActive ? vm.btnSwapCancel : vm.btnSwapMode,
      iconId: 'compass',
      fontSize: 11,
      variant: isSwapActive ? 'danger' : 'primary',
      onClick: () => this.toggleSwapMode(),
    });
    btnSwap.position.set(14, 72);
    actionsCard.addChild(btnSwap);
    this.focusManager.register(btnSwap.toFocusable());

    const btnHeal = new KitButton({
      width: halfW,
      height: btnH,
      label: `${vm.btnHeal} (${vm.elixirCount})`,
      iconId: 'elixir',
      fontSize: 11,
      variant: 'secondary',
      disabled: vm.elixirCount <= 0 || (m.hpCur >= m.hpMax && !m.isKO),
      onClick: () => this.quickHealSelected(),
    });
    btnHeal.position.set(14 + halfW + 8, 72);
    actionsCard.addChild(btnHeal);
    this.focusManager.register(btnHeal.toFocusable());

    (deck as any).__totalHeight = cardH + actionsCardH + 16;
    return deck;
  }

  public toggleSwapMode(): void {
    if (this.swapSourceIndex === null) {
      this.swapSourceIndex = this.selectedIndex;
      GlobalAudioService.playSfx('select');
      const state = GlobalSaveService.getCurrentState();
      const doll = state.party?.[this.selectedIndex];
      const dollName = doll?.nickname || doll?.speciesId || 'Souldoll';
      GlobalEventBus.emit('toast:message', {
        text: (esText as any).terms.group_a.party.swap_selected_hint.replace('{name}', dollName.toUpperCase()),
        duration: 2200,
      });
    } else {
      this.cancelSwapMode();
    }
    this.buildUI();
  }

  public cancelSwapMode(): void {
    this.swapSourceIndex = null;
    GlobalAudioService.playSfx('cancel');
    this.buildUI();
  }

  public swapPartyMembers(idxA: number, idxB: number): void {
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_a.party;
    if (
      !state.party ||
      idxA === idxB ||
      idxA < 0 ||
      idxB < 0 ||
      idxA >= state.party.length ||
      idxB >= state.party.length
    ) {
      this.cancelSwapMode();
      return;
    }

    const tmp = state.party[idxA];
    state.party[idxA] = state.party[idxB];
    state.party[idxB] = tmp;
    this.selectedIndex = idxB;
    this.swapSourceIndex = null;
    GlobalSaveService.save();
    GlobalAudioService.playSfx('confirm');

    const movedDoll = state.party[idxB];
    const spName = movedDoll.nickname || movedDoll.speciesId;
    GlobalEventBus.emit('toast:message', {
      text: t.order_changed_msg
        .replace('{name}', spName.toUpperCase())
        .replace('{pos}', String(idxB + 1)),
      duration: 1800,
    });
    this.buildUI();
  }

  public moveMember(delta: -1 | 1): void {
    const state = GlobalSaveService.getCurrentState();
    const targetIdx = this.selectedIndex + delta;
    if (!state.party || targetIdx < 0 || targetIdx >= state.party.length) {
      return;
    }
    this.swapPartyMembers(this.selectedIndex, targetIdx);
  }

  public makeSelectedLead(): void {
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_a.party;
    if (!state.party || this.selectedIndex <= 0 || this.selectedIndex >= state.party.length) {
      return;
    }

    const [chosen] = state.party.splice(this.selectedIndex, 1);
    state.party.unshift(chosen);
    this.selectedIndex = 0;
    this.swapSourceIndex = null;
    GlobalSaveService.save();
    GlobalAudioService.playSfx('soul_seal');

    const spName = chosen.nickname || chosen.speciesId;
    GlobalEventBus.emit('toast:message', {
      text: t.swapped_msg.replace('{name}', spName.toUpperCase()),
      duration: 1800,
    });
    this.buildUI();
  }

  public quickHealSelected(): void {
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_a.party;
    const doll = state.party?.[this.selectedIndex];
    if (!doll) return;

    const inv = state.inventory || {};
    const itemKey =
      (inv['elixir_ki'] || 0) > 0
        ? 'elixir_ki'
        : (inv['potion'] || 0) > 0
        ? 'potion'
        : null;

    if (!itemKey) {
      GlobalAudioService.playSfx('cancel');
      GlobalEventBus.emit('toast:message', {
        text: t.no_elixir_msg,
        duration: 1800,
      });
      return;
    }

    inv[itemKey] = Math.max(0, inv[itemKey] - 1);
    StatCalculator.ensurePartHp(doll);
    doll.currentHp = doll.maxHp;
    doll.partHP = { ...doll.maxPartHP };
    GlobalSaveService.save();
    GlobalAudioService.playSfx('heal');

    const dollName = doll.nickname || doll.speciesId;
    GlobalEventBus.emit('toast:message', {
      text: t.healed_msg.replace('{name}', dollName.toUpperCase()),
      duration: 1800,
    });
    this.buildUI();
  }

  public update(_dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }
    this.focusManager.update();

    if (GlobalInput.justPressed('UP')) {
      const state = GlobalSaveService.getCurrentState();
      const len = (state.party || []).length;
      if (len > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + len) % len;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('DOWN')) {
      const state = GlobalSaveService.getCurrentState();
      const len = (state.party || []).length;
      if (len > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % len;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('CONFIRM')) {
      if (this.swapSourceIndex !== null) {
        this.swapPartyMembers(this.swapSourceIndex, this.selectedIndex);
      } else {
        const state = GlobalSaveService.getCurrentState();
        GlobalSceneManager.pushScene('CreatureDetail', {
          index: this.selectedIndex,
          list: state.party,
        });
      }
    } else if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      if (this.swapSourceIndex !== null) {
        this.cancelSwapMode();
      } else {
        this.close();
      }
    }
  }

  public pause(): void {
    if (this.container && !this.container.destroyed) {
      this.container.visible = false;
    }
  }

  public async resume(): Promise<void> {
    if (!this.container || this.container.destroyed) {
      this.container = new Container();
      this.container.roundPixels = true;
      this.container.zIndex = 1000;
    }
    this.container.visible = true;
    if (this.container.parent !== GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.addChild(this.container);
    }
    this.buildUI();
  }

  public onResize(_width: number, _height: number): void {
    this.buildUI();
  }

  private close(): void {
    GlobalAudioService.playSfx('cancel');
    GlobalSceneManager.popScene();
  }

  public render(_alpha: number): void {}

  public async exit(): Promise<void> {
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = undefined;
    }
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
