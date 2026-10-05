import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalInput } from '../core/Input';
import {
  ScreenFrame,
  KitCard,
  KitListRow,
  KitBadge,
  KitStars,
  KitDivider,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildCreditsVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Pantalla de Fin de Demo / Epílogo ("CreditsScene")
 * Construida 100% con /ui/kit (ScreenFrame, KitCard, KitListRow, KitBadge, KitStars, KitDivider, FocusManager).
 * Cero colores, fuentes o emojis hardcodeados.
 */
export class CreditsScene implements IScene {
  public name = 'Credits';
  private container: Container = new Container();
  private screenFrame: ScreenFrame | null = null;
  private focusManager: FocusManager = new FocusManager();

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.buildUI();
    GlobalAudioService.playVictoryTheme();
  }

  private buildUI(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const saveState = GlobalSaveService.getCurrentState();
    const vm = buildCreditsVM(saveState);
    const t = (esText as any).terms.group_a.credits;

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      currencies: [
        { iconId: 'coin', value: vm.money },
        { iconId: 'guild_seal', value: vm.hasSeal ? 1 : 0 },
      ],
      onClose: () => GlobalSceneManager.popScene(),
      secondaryAction: {
        label: vm.btnTitle,
        iconId: 'trainer',
        onClick: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.changeScene('Title');
        },
      },
      primaryAction: {
        label: vm.btnContinue,
        iconId: 'check',
        onClick: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.popScene();
        },
      },
    });
    this.screenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const isTwoCol = frame.isTwoColumn;
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    // 1. Victory Banner Card
    const bannerCard = new KitCard({
      width: colW,
      height: 220,
      variant: 'parchment',
      title: vm.bannerTitle,
    });
    bannerCard.position.set(0, 0);
    frame.contentRoot.addChild(bannerCard);

    const stars = new KitStars(5, 5, 16);
    stars.position.set(12, 38);
    bannerCard.addChild(stars);

    const sealBadge = new KitBadge(
      vm.sealText,
      vm.hasSeal ? 'tier' : 'rarity',
      vm.hasSeal ? 'tier' : 'comun'
    );
    sealBadge.position.set(120, 36);
    bannerCard.addChild(sealBadge);

    const subTxt = new Text({
      text: vm.bannerSub,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        lineHeight: 20,
        fill: COLOR_HEX.inkCrypt,
        wordWrap: true,
        wordWrapWidth: colW - 24,
      }),
    });
    subTxt.roundPixels = true;
    subTxt.position.set(12, 68);
    bannerCard.addChild(subTxt);

    const div = new KitDivider(colW - 24);
    div.position.set(12, 118);
    bannerCard.addChild(div);

    const loreTxt = new Text({
      text: vm.loreClosing,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 20,
        fill: COLOR_HEX.inkCrypt,
        wordWrap: true,
        wordWrapWidth: colW - 24,
      }),
    });
    loreTxt.roundPixels = true;
    loreTxt.position.set(12, 134);
    bannerCard.addChild(loreTxt);

    // 2. Summary Stats Card
    const statsCard = new KitCard({
      width: colW,
      height: 276,
      variant: 'smokedWood',
      title: vm.secStats,
    });
    statsCard.position.set(isTwoCol ? colW + 12 : 0, isTwoCol ? 0 : 232);
    frame.contentRoot.addChild(statsCard);

    const rowsData: Array<{
      iconId: 'codex_book' | 'soul_orb' | 'coin' | 'guild_seal';
      title: string;
      value: string;
    }> = [
      {
        iconId: 'codex_book',
        title: t.stat_codex,
        value: `${vm.caughtCount}/${vm.totalSpecies} (${vm.codexPct}%)`,
      },
      {
        iconId: 'soul_orb',
        title: t.stat_party,
        value: `${vm.partyCount}/6`,
      },
      {
        iconId: 'coin',
        title: t.stat_money,
        value: `${vm.money}`,
      },
      {
        iconId: 'guild_seal',
        title: t.stat_seal,
        value: vm.sealText,
      },
    ];

    rowsData.forEach((r, idx) => {
      const row = new KitListRow({
        width: colW - 16,
        height: 52,
        iconId: r.iconId,
        title: r.title,
        value: r.value,
      });
      row.position.set(8, 38 + idx * 58);
      statsCard.addChild(row);
    });

    const totalH = isTwoCol ? 290 : 520;
    frame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(frame, 'CreditsScene');
  }

  public update(_dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }
    if (GlobalInput.justPressed('CONFIRM') || GlobalInput.justPressed('CANCEL')) {
      GlobalAudioService.playSfx('confirm');
      GlobalSceneManager.popScene();
    }
  }

  public render(_alpha: number): void {}

  public onResize(_width: number, _height: number): void {
    this.buildUI();
  }

  public async exit(): Promise<void> {
    this.focusManager.clear();
    if (this.container.parent) {
      this.container.parent.removeChildren();
    }
  }
}
