import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalInput } from '../core/Input';
import {
  ScreenFrame,
  KitCard,
  KitTabBar,
  KitListRow,
  KitButton,
  KitBadge,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_HEX, FONTS } from '../ui/styles';
import {
  buildStorageVM,
  getFreeBodiesList,
  getSealedSoulsList,
  StorageTabId,
} from '../ui/viewmodels/GroupBViewModels';
import esText from '../data/text/es.json';

export class StorageBoxScene implements IScene {
  public name = 'StorageBox';
  private container: Container = new Container();
  private screenFrame!: ScreenFrame;
  private focusManager: FocusManager = new FocusManager();
  private currentTab: StorageTabId = 'party';
  private selectedIndex = 0;
  private statusMessage = '';

  public async enter(): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.renderStorage();
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
    this.renderStorage();
  }

  public onResize(_width: number, _height: number): void {
    this.renderStorage();
  }

  private renderStorage(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const isDesktop = width >= 840;
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_b.storage;
    const entries = buildStorageVM(state, this.currentTab);

    if (this.selectedIndex >= entries.length) {
      this.selectedIndex = Math.max(0, entries.length - 1);
    }
    const selEntry = entries[this.selectedIndex];
    const sealedSouls = getSealedSoulsList(state);
    const freeBodies = getFreeBodiesList(state);
    const boxDolls = (state.storage || []).filter((s) => Boolean(s.bodyInstanceId));

    this.screenFrame = new ScreenFrame({
      width,
      height,
      title: t.title,
      currencies: [
        { iconId: 'party', value: `${(state.party || []).length}/6` },
        { iconId: 'soul_bottle', value: sealedSouls.length },
        { iconId: 'body_chassis', value: freeBodies.length },
      ],
      onClose: () => {
        GlobalAudioService.playSfx('cancel');
        GlobalSceneManager.popScene();
      },
      secondaryAction: {
        label: t.btn_back,
        iconId: 'back',
        onClick: () => {
          GlobalAudioService.playSfx('cancel');
          GlobalSceneManager.popScene();
        },
      },
      primaryAction: {
        label: t.btn_bind,
        iconId: 'soul_bottle',
        onClick: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.pushScene('SoulBinding');
        },
      },
    });
    this.container.addChild(this.screenFrame);

    const cw = this.screenFrame.contentWidth;

    const tabs = new KitTabBar({
      width: cw,
      absX: 0,
      activeId: this.currentTab,
      tabs: [
        { id: 'party', label: `${t.tab_party} (${(state.party || []).length})`, iconId: 'party' },
        { id: 'box', label: `${t.tab_box} (${boxDolls.length})`, iconId: 'storage' },
        { id: 'souls', label: `${t.tab_souls} (${sealedSouls.length})`, iconId: 'soul_bottle' },
        { id: 'bodies', label: `${t.tab_bodies} (${freeBodies.length})`, iconId: 'body_chassis' },
      ],
      onSelect: (id) => {
        this.currentTab = id as StorageTabId;
        this.selectedIndex = 0;
        this.statusMessage = '';
        this.renderStorage();
      },
    });
    tabs.position.set(0, 0);
    this.screenFrame.contentRoot.addChild(tabs);

    const leftW = isDesktop ? Math.floor(cw * 0.54) : cw;
    const rightW = isDesktop ? cw - leftW - 12 : cw;

    const rowH = 52;
    const leftH = Math.max(180, entries.length * (rowH + 6) + 52);
    const leftCard = new KitCard({
      width: leftW,
      height: leftH,
      variant: 'smokedWood',
      title: t.sec_list,
    });
    leftCard.position.set(0, 48);
    this.screenFrame.contentRoot.addChild(leftCard);

    if (entries.length === 0) {
      const emptyTxt = new Text({
        text: t.empty_list,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fill: COLOR_HEX.smoke,
        }),
      });
      emptyTxt.position.set(14, 48);
      leftCard.addChild(emptyTxt);
    } else {
      entries.forEach((item, idx) => {
        const row = new KitListRow({
          width: leftW - 20,
          height: rowH,
          iconId: item.iconId,
          title: item.title,
          subtitle: item.subtitle,
          valueText: item.valueText,
          selected: idx === this.selectedIndex,
          onClick: () => {
            this.selectedIndex = idx;
            this.statusMessage = '';
            this.renderStorage();
          },
        });
        row.position.set(10, 38 + idx * (rowH + 6));
        leftCard.addChild(row);

        this.focusManager.register({
          container: row,
          width: leftW - 20,
          height: rowH,
          onActivate: () => {
            this.selectedIndex = idx;
            this.statusMessage = '';
            this.renderStorage();
          },
        });
      });
    }

    const rightY = isDesktop ? 48 : 48 + leftH + 12;
    const rightH = 260;
    const rightCard = new KitCard({
      width: rightW,
      height: rightH,
      variant: 'parchment',
      title: t.sec_detail,
    });
    rightCard.position.set(isDesktop ? leftW + 12 : 0, rightY);
    this.screenFrame.contentRoot.addChild(rightCard);

    if (selEntry) {
      const titleTxt = new Text({
        text: `${selEntry.title} (${selEntry.valueText})`,
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 15,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      titleTxt.position.set(14, 42);
      rightCard.addChild(titleTxt);

      selEntry.detailLines.forEach((line, lIdx) => {
        const lineTxt = new Text({
          text: line,
          style: new TextStyle({
            fontFamily: FONTS.body,
            fontSize: 13,
            fontWeight: 'bold',
            fill: COLOR_HEX.inkCrypt,
            wordWrap: true,
            wordWrapWidth: rightW - 28,
          }),
        });
        lineTxt.position.set(14, 70 + lIdx * 24);
        rightCard.addChild(lineTxt);
      });

      if (this.currentTab === 'party') {
        const moveBtn = new KitButton({
          width: rightW - 28,
          height: 40,
          label: t.btn_move_to_box,
          variant: 'secondary',
          iconId: 'storage',
          disabled: state.party.length <= 1,
          onClick: () => {
            if (state.party.length <= 1) {
              this.statusMessage = t.msg_last_party;
              this.renderStorage();
              return;
            }
            const [removed] = state.party.splice(this.selectedIndex, 1);
            state.storage.push(removed);
            GlobalSaveService.save();
            GlobalAudioService.playSfx('confirm');
            this.renderStorage();
          },
        });
        moveBtn.position.set(14, 152);
        rightCard.addChild(moveBtn);
        this.focusManager.register(moveBtn.toFocusable());

        const sheetBtn = new KitButton({
          width: rightW - 28,
          height: 40,
          label: t.btn_inspect,
          variant: 'primary',
          iconId: 'codex',
          onClick: () => {
            GlobalAudioService.playSfx('confirm');
            GlobalSceneManager.pushScene('CreatureDetail', { partyIndex: this.selectedIndex });
          },
        });
        sheetBtn.position.set(14, 200);
        rightCard.addChild(sheetBtn);
        this.focusManager.register(sheetBtn.toFocusable());
      } else if (this.currentTab === 'box') {
        const toPartyBtn = new KitButton({
          width: rightW - 28,
          height: 40,
          label: t.btn_move_to_party,
          variant: 'primary',
          iconId: 'party',
          disabled: state.party.length >= 6,
          onClick: () => {
            if (state.party.length >= 6) {
              this.statusMessage = t.msg_party_full;
              this.renderStorage();
              return;
            }
            const stIdx = state.storage.findIndex((s) => s.uid === selEntry.id);
            if (stIdx >= 0) {
              const [removed] = state.storage.splice(stIdx, 1);
              state.party.push(removed);
              GlobalSaveService.save();
              GlobalAudioService.playSfx('confirm');
              this.renderStorage();
            }
          },
        });
        toPartyBtn.position.set(14, 152);
        rightCard.addChild(toPartyBtn);
        this.focusManager.register(toPartyBtn.toFocusable());
      } else {
        const bindBtn = new KitButton({
          width: rightW - 28,
          height: 40,
          label: t.btn_bind,
          variant: 'primary',
          iconId: 'soul_bottle',
          onClick: () => {
            GlobalAudioService.playSfx('confirm');
            GlobalSceneManager.pushScene('SoulBinding');
          },
        });
        bindBtn.position.set(14, 152);
        rightCard.addChild(bindBtn);
        this.focusManager.register(bindBtn.toFocusable());
      }
    }

    if (this.statusMessage) {
      const badge = new KitBadge(this.statusMessage, 'tier', 'tier');
      badge.position.set(14, rightH - 28);
      rightCard.addChild(badge);
    }

    const totalH = isDesktop ? Math.max(leftH, rightH) + 64 : rightY + rightH + 24;
    this.screenFrame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(this.screenFrame, 'StorageBoxScene');
  }

  public update(_dt: number): void {
    this.screenFrame.updateInertia();
    this.focusManager.update();
    if (GlobalInput.justPressed('CANCEL')) {
      GlobalAudioService.playSfx('cancel');
      GlobalSceneManager.popScene();
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
