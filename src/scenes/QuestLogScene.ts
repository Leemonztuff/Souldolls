import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalQuestSystem } from '../systems/quest/QuestSystem';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import {
  ScreenFrame,
  KitCard,
  KitListRow,
  KitBadge,
  KitDivider,
  KitCurrencyChip,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildQuestLogVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Diario de Misiones ("QuestLogScene")
 * Construido 100% con /ui/kit (ScreenFrame, KitCard, KitListRow, KitBadge, KitDivider, KitCurrencyChip, FocusManager).
 * Cero colores, fuentes o emojis hardcodeados.
 */
export class QuestLogScene implements IScene {
  public name = 'QuestLog';
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

  private buildUI(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const state = GlobalSaveService.getCurrentState();
    const rawQuests = GlobalQuestSystem.getAllQuestsWithStatus();
    const vm = buildQuestLogVM(rawQuests);
    const t = (esText as any).terms.group_a.quests;

    if (this.selectedIndex >= vm.quests.length) {
      this.selectedIndex = Math.max(0, vm.quests.length - 1);
    }

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      currencies: [{ iconId: 'coin', value: state.player?.money || 0 }],
      onClose: () => this.close(),
      primaryAction: {
        label: vm.btnBack,
        iconId: 'chevron_left',
        onClick: () => this.close(),
      },
    });
    this.screenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const isTwoCol = frame.isTwoColumn;
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    const rowH = 58;
    const listCardH = Math.max(160, vm.quests.length * rowH + 44);

    // 1. Left / Top Quest List Card
    const listCard = new KitCard({
      width: colW,
      height: listCardH,
      variant: 'smokedWood',
      title: vm.secList,
    });
    listCard.position.set(0, 0);
    frame.contentRoot.addChild(listCard);

    if (vm.quests.length === 0) {
      const emptyTxt = new Text({
        text: vm.emptyText,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.smoke,
        }),
      });
      emptyTxt.roundPixels = true;
      emptyTxt.position.set(16, 48);
      listCard.addChild(emptyTxt);
    } else {
      vm.quests.forEach((q, idx) => {
        const row = new KitListRow({
          width: colW - 16,
          height: 52,
          iconId: q.status === 'completed' ? 'check' : 'quest_scroll',
          title: q.title,
          subtitle: `${q.categoryLabel} • ${q.summary.slice(0, 32)}`,
          value: q.statusLabel,
          selected: idx === this.selectedIndex,
          onClick: () => {
            this.selectedIndex = idx;
            this.buildUI();
          },
        });
        row.position.set(8, 36 + idx * rowH);
        listCard.addChild(row);

        this.focusManager.register({
          container: row,
          width: colW - 16,
          height: 52,
          onActivate: () => {
            this.selectedIndex = idx;
            this.buildUI();
          },
        });
      });
      this.focusManager.setFocus(this.selectedIndex, false);
    }

    // 2. Right / Bottom Quest Detail Card
    const sel = vm.quests[this.selectedIndex];
    const objRowsH = sel ? sel.objectives.length * 54 : 0;
    const detailCardH = Math.max(300, 220 + objRowsH);

    const detailCard = new KitCard({
      width: colW,
      height: detailCardH,
      variant: 'parchment',
      title: sel ? sel.title : vm.secDetail,
    });
    detailCard.position.set(
      isTwoCol ? colW + 12 : 0,
      isTwoCol ? 0 : listCardH + 12
    );
    frame.contentRoot.addChild(detailCard);

    if (sel) {
      const catBadge = new KitBadge(sel.categoryLabel, 'tier', 'tier');
      catBadge.position.set(12, 36);
      detailCard.addChild(catBadge);

      const statusBadge = new KitBadge(
        sel.statusLabel,
        sel.status === 'completed' ? 'rarity' : 'element',
        sel.status === 'completed' ? 'poco_comun' : 'agua'
      );
      statusBadge.position.set(18 + catBadge.width, 36);
      detailCard.addChild(statusBadge);

      const descTxt = new Text({
        text: sel.description,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          lineHeight: 20,
          fill: COLOR_HEX.inkCrypt,
          wordWrap: true,
          wordWrapWidth: colW - 24,
        }),
      });
      descTxt.roundPixels = true;
      descTxt.position.set(12, 68);
      detailCard.addChild(descTxt);

      let cursorY = 124;
      const div1 = new KitDivider(colW - 24);
      div1.position.set(12, cursorY);
      detailCard.addChild(div1);
      cursorY += 16;

      sel.objectives.forEach((obj) => {
        const objRow = new KitListRow({
          width: colW - 24,
          height: 48,
          iconId: obj.isDone ? 'check' : 'quest_scroll',
          title: obj.description,
          value: obj.required > 1 ? `${obj.current}/${obj.required}` : obj.isDone ? 'OK' : '...',
          selected: obj.isDone,
        });
        objRow.position.set(12, cursorY);
        detailCard.addChild(objRow);
        cursorY += 54;
      });

      const div2 = new KitDivider(colW - 24);
      div2.position.set(12, cursorY + 4);
      detailCard.addChild(div2);
      cursorY += 18;

      const rewTitle = new Text({
        text: t.rewards,
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 14,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      rewTitle.roundPixels = true;
      rewTitle.position.set(12, cursorY);
      detailCard.addChild(rewTitle);

      let chipX = 12;
      if (sel.rewardMoney > 0) {
        const moneyChip = new KitCurrencyChip('coin', sel.rewardMoney, 96);
        moneyChip.position.set(chipX, cursorY + 22);
        detailCard.addChild(moneyChip);
        chipX += 104;
      }

      sel.rewardItems.forEach((ri) => {
        const itemBadge = new KitBadge(`${ri.count}x ${ri.name}`, 'rarity', 'rara');
        itemBadge.position.set(chipX, cursorY + 24);
        detailCard.addChild(itemBadge);
        chipX += itemBadge.width + 8;
      });
    }

    const totalH = isTwoCol
      ? Math.max(listCardH, detailCardH) + 16
      : listCardH + detailCardH + 28;
    frame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(frame, 'QuestLogScene');
  }

  public update(_dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }

    const rawQuests = GlobalQuestSystem.getAllQuestsWithStatus();
    const len = rawQuests.length;

    if (GlobalInput.justPressed('UP')) {
      if (len > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + len) % len;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('DOWN')) {
      if (len > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % len;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.close();
    }
  }

  public onResize(_width: number, _height: number): void {
    this.buildUI();
  }

  public close(): void {
    GlobalAudioService.playSfx('cancel');
    GlobalSceneManager.popScene();
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
