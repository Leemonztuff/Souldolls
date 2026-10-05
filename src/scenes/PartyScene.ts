import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
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
  KitPartsSilhouette,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildPartyVM, PartyScreenVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Pantalla dedicada de Equipo de Souldolls ("PartyScene")
 * Construida 100% con componentes de /ui/kit (ScreenFrame, KitCard, KitButton, KitBar, KitBadge, KitStars, KitPartsSilhouette, FocusManager).
 * Cero colores, fuentes o emojis hardcodeados.
 */
export class PartyScene implements IScene {
  public name = 'Party';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private screenFrame: ScreenFrame | null = null;
  private focusManager: FocusManager = new FocusManager();
  private selectedIndex = 0;

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.selectedIndex = 0;
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

    if (this.selectedIndex >= vm.members.length) {
      this.selectedIndex = Math.max(0, vm.members.length - 1);
    }

    const selectedMember = vm.members[this.selectedIndex];

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      currencies: [
        { iconId: 'coin', value: vm.money },
        { iconId: 'guild_seal', value: (state.badges || []).length },
      ],
      onClose: () => this.close(),
      secondaryAction:
        selectedMember && !selectedMember.isLead
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
      primaryAction: selectedMember
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
    const isTwoCol = frame.isTwoColumn;

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

    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;
    const cardH = 112;
    const gapY = 8;

    vm.members.forEach((m, idx) => {
      const col = isTwoCol ? idx % 2 : 0;
      const row = isTwoCol ? Math.floor(idx / 2) : idx;
      const x = col * (colW + 12);
      const y = row * (cardH + gapY);

      const card = this.renderMemberCard(m, idx, colW, cardH, vm);
      card.position.set(x, y);
      frame.contentRoot.addChild(card);

      this.focusManager.register({
        container: card,
        width: colW,
        height: cardH,
        onActivate: () => {
          this.selectedIndex = idx;
          GlobalSceneManager.pushScene('CreatureDetail', {
            index: idx,
            list: state.party,
          });
        },
      });
    });

    this.focusManager.setFocus(this.selectedIndex, false);

    const totalRows = isTwoCol ? Math.ceil(vm.members.length / 2) : vm.members.length;
    const totalH = totalRows * (cardH + gapY) + 12;
    frame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(frame, 'PartyScene');
  }

  private renderMemberCard(
    m: PartyScreenVM['members'][number],
    idx: number,
    w: number,
    h: number,
    _vm: PartyScreenVM
  ): KitCard {
    const t = (esText as any).terms.group_a.party;
    const isSel = idx === this.selectedIndex;

    const card = new KitCard({
      width: w,
      height: h,
      variant: isSel ? 'smokedWood' : 'inkCrypt',
      title: `${m.name} (${esText.terms.sheet.level_short}.${m.level})`,
    });

    const elemBadge = new KitBadge(m.element, 'element', m.element);
    elemBadge.position.set(w - elemBadge.width - 12, 8);
    card.addChild(elemBadge);

    if (m.isLead) {
      const leadBadge = new KitBadge(t.lead_badge, 'tier', 'tier');
      leadBadge.position.set(w - elemBadge.width - leadBadge.width - 18, 8);
      card.addChild(leadBadge);
    } else if (m.isKO) {
      const koBadge = new KitBadge(t.ko_badge, 'element', 'fuego');
      koBadge.position.set(w - elemBadge.width - koBadge.width - 18, 8);
      card.addChild(koBadge);
    } else if (m.isSealed) {
      const sealedBadge = new KitBadge(t.sealed_badge, 'rarity', 'rara');
      sealedBadge.position.set(w - elemBadge.width - sealedBadge.width - 18, 8);
      card.addChild(sealedBadge);
    }

    const barW = Math.max(120, w - 96);
    const hpBar = new KitBar(
      'hp',
      m.hpRatio,
      barW,
      18,
      4,
      `${m.hpCur}/${m.hpMax}`
    );
    hpBar.position.set(12, 40);
    card.addChild(hpBar);

    const chassisTxt = new Text({
      text: m.chassisName,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fill: COLOR_HEX.smoke,
      }),
    });
    chassisTxt.roundPixels = true;
    chassisTxt.position.set(12, 66);
    card.addChild(chassisTxt);

    const stars = new KitStars(m.tier, 5, 12);
    stars.position.set(12, 88);
    card.addChild(stars);

    const sil = new KitPartsSilhouette();
    sil.position.set(w - 52, 36);
    sil.updateParts(
      {
        head: m.parts.head.cur,
        torso: m.parts.torso.cur,
        arms: m.parts.arms.cur,
        legs: m.parts.legs.cur,
      },
      {
        head: m.parts.head.max,
        torso: m.parts.torso.max,
        arms: m.parts.arms.max,
        legs: m.parts.legs.max,
      }
    );
    card.addChild(sil);

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.on('pointerdown', (e) => {
      e.stopPropagation();
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
    });

    return card;
  }

  private makeSelectedLead(): void {
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_a.party;
    if (!state.party || this.selectedIndex <= 0 || this.selectedIndex >= state.party.length) {
      return;
    }

    const [chosen] = state.party.splice(this.selectedIndex, 1);
    state.party.unshift(chosen);
    this.selectedIndex = 0;
    GlobalSaveService.save();

    const spName = chosen.nickname || chosen.speciesId;
    GlobalEventBus.emit('toast:message', {
      text: t.swapped_msg.replace('{name}', spName.toUpperCase()),
      duration: 1800,
    });
    this.buildUI();
  }

  public update(_dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }

    if (GlobalInput.justPressed('UP') || GlobalInput.justPressed('LEFT')) {
      const state = GlobalSaveService.getCurrentState();
      const len = (state.party || []).length;
      if (len > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + len) % len;
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('DOWN') || GlobalInput.justPressed('RIGHT')) {
      const state = GlobalSaveService.getCurrentState();
      const len = (state.party || []).length;
      if (len > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % len;
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('CONFIRM')) {
      this.focusManager.activateCurrent();
    } else if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.close();
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
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
