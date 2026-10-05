import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalInput } from '../core/Input';
import { StatCalculator } from '../systems/battle/StatCalculator';
import {
  ScreenFrame,
  KitCard,
  KitTabBar,
  KitListRow,
  KitStepper,
  KitButton,
  KitBadge,
  KitBar,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_HEX, FONTS } from '../ui/styles';
import {
  buildShopCatalogVM,
  ShopCategoryFilter,
  ShopCatalogItemVM,
} from '../ui/viewmodels/GroupBViewModels';
import esText from '../data/text/es.json';

export class ShopScene implements IScene {
  public name = 'Shop';
  private container: Container = new Container();
  private screenFrame!: ScreenFrame;
  private focusManager: FocusManager = new FocusManager();
  private mode: 'buy' | 'sell' = 'buy';
  private category: ShopCategoryFilter = 'all';
  private selectedIndex = 0;
  private quantity = 1;
  private statusMessage = '';

  public async enter(params?: { mode?: 'buy' | 'sell'; category?: ShopCategoryFilter }): Promise<void> {
    if (params?.mode) this.mode = params.mode;
    if (params?.category) this.category = params.category;
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.renderShop();
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
    this.renderShop();
  }

  public onResize(_width: number, _height: number): void {
    this.renderShop();
  }

  private renderShop(): void {
    this.container.removeChildren();
    this.focusManager.clear();

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const isDesktop = width >= 840;
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_b.shop;
    const catalog = buildShopCatalogVM(state, this.mode, this.category);

    if (this.selectedIndex >= catalog.length) {
      this.selectedIndex = Math.max(0, catalog.length - 1);
    }
    const selItem: ShopCatalogItemVM | undefined = catalog[this.selectedIndex];

    this.screenFrame = new ScreenFrame({
      width,
      height,
      title: t.title,
      currencies: [
        { iconId: 'coin', value: state.player?.money || 0 },
        { iconId: 'guild_seal', value: (state.player?.badges || []).length },
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
        label: this.mode === 'buy' ? t.btn_buy : t.btn_sell,
        iconId: 'coin',
        disabled: !selItem,
        onClick: () => {
          if (selItem) this.executeTransaction(selItem);
        },
      },
    });
    this.container.addChild(this.screenFrame);

    const cw = this.screenFrame.contentWidth;

    const modeTabs = new KitTabBar({
      width: cw,
      absX: 0,
      activeId: this.mode,
      tabs: [
        { id: 'buy', label: t.tab_buy, iconId: 'shop' },
        { id: 'sell', label: t.tab_sell, iconId: 'coin' },
      ],
      onSelect: (id) => {
        this.mode = id as 'buy' | 'sell';
        this.selectedIndex = 0;
        this.quantity = 1;
        this.statusMessage = '';
        this.renderShop();
      },
    });
    modeTabs.position.set(0, 0);
    this.screenFrame.contentRoot.addChild(modeTabs);

    const catTabs = new KitTabBar({
      width: cw,
      absX: 0,
      activeId: this.category,
      tabs: [
        { id: 'all', label: t.cat_all },
        { id: 'bodies', label: t.cat_bodies },
        { id: 'weapons', label: t.cat_weapons },
        { id: 'crystals', label: t.cat_crystals },
        { id: 'souls', label: t.cat_souls },
      ],
      onSelect: (id) => {
        this.category = id as ShopCategoryFilter;
        this.selectedIndex = 0;
        this.quantity = 1;
        this.statusMessage = '';
        this.renderShop();
      },
    });
    catTabs.position.set(0, 44);
    this.screenFrame.contentRoot.addChild(catTabs);

    const leftW = isDesktop ? Math.floor(cw * 0.52) : cw;
    const rightW = isDesktop ? cw - leftW - 12 : cw;

    const rowH = 50;
    const leftH = Math.max(180, catalog.length * (rowH + 6) + 52);
    const leftCard = new KitCard({
      width: leftW,
      height: leftH,
      variant: 'smokedWood',
      title: t.sec_catalog,
    });
    leftCard.position.set(0, 90);
    this.screenFrame.contentRoot.addChild(leftCard);

    if (catalog.length === 0) {
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
      catalog.forEach((item, idx) => {
        const row = new KitListRow({
          width: leftW - 20,
          height: rowH,
          iconId: item.iconId,
          title: item.name,
          subtitle: item.subtitle,
          valueText: `${item.unitPrice} G`,
          selected: idx === this.selectedIndex,
          onClick: () => {
            this.selectedIndex = idx;
            this.quantity = 1;
            this.statusMessage = '';
            this.renderShop();
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
            this.quantity = 1;
            this.statusMessage = '';
            this.renderShop();
          },
        });
      });
    }

    const rightY = isDesktop ? 90 : 90 + leftH + 12;
    const rightH = 340;
    const rightCard = new KitCard({
      width: rightW,
      height: rightH,
      variant: 'parchment',
      title: t.sec_detail,
    });
    rightCard.position.set(isDesktop ? leftW + 12 : 0, rightY);
    this.screenFrame.contentRoot.addChild(rightCard);

    if (selItem) {
      const titleTxt = new Text({
        text: selItem.name.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      titleTxt.position.set(14, 40);
      rightCard.addChild(titleTxt);

      const ownedTxt = new Text({
        text: `${t.owned}: x${selItem.ownedQty} | ${t.price_unit}: ${selItem.unitPrice} G`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.woodMid,
        }),
      });
      ownedTxt.position.set(14, 62);
      rightCard.addChild(ownedTxt);

      const descTxt = new Text({
        text: selItem.description,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
          wordWrap: true,
          wordWrapWidth: rightW - 28,
        }),
      });
      descTxt.position.set(14, 88);
      rightCard.addChild(descTxt);

      if (selItem.partShare) {
        const pKeys: Array<'head' | 'torso' | 'arms' | 'legs'> = ['head', 'torso', 'arms', 'legs'];
        pKeys.forEach((pk, pIdx) => {
          const pct = Math.round((selItem.partShare![pk] || 0.25) * 100);
          const bar = new KitBar({
            width: rightW - 28,
            height: 14,
            value: pct,
            max: 50,
            kind: 'ki',
            showText: true,
          });
          bar.position.set(14, 136 + pIdx * 18);
          rightCard.addChild(bar);
        });
      }

      const maxQty =
        this.mode === 'sell'
          ? Math.max(1, selItem.ownedQty)
          : Math.max(1, Math.min(99, Math.floor((state.player?.money || 0) / Math.max(1, selItem.unitPrice))));

      const stepper = new KitStepper({
        value: this.quantity,
        min: 1,
        max: maxQty,
        onChange: (val) => {
          this.quantity = val;
          this.renderShop();
        },
      });
      stepper.position.set(14, 218);
      rightCard.addChild(stepper);

      const totalCost = selItem.unitPrice * this.quantity;
      const totalBadge = new KitBadge(`${t.total}: ${totalCost} G`, 'tier', 'tier');
      totalBadge.position.set(162, 224);
      rightCard.addChild(totalBadge);

      const actBtn = new KitButton({
        width: rightW - 28,
        height: 42,
        label: `${this.mode === 'buy' ? t.btn_buy : t.btn_sell} (x${this.quantity})`,
        variant: 'primary',
        iconId: 'coin',
        onClick: () => this.executeTransaction(selItem),
      });
      actBtn.position.set(14, 268);
      rightCard.addChild(actBtn);
      this.focusManager.register(actBtn.toFocusable());
    }

    if (this.statusMessage) {
      const msgBadge = new KitBadge(this.statusMessage, 'tier', 'tier');
      msgBadge.position.set(14, rightH - 28);
      rightCard.addChild(msgBadge);
    }

    const totalH = isDesktop ? Math.max(leftH, rightH) + 100 : rightY + rightH + 24;
    this.screenFrame.setContentTotalHeight(totalH);

    UIKitLinter.inspectTree(this.screenFrame, 'ShopScene');
  }

  private executeTransaction(item: ShopCatalogItemVM): void {
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_b.shop;
    const total = item.unitPrice * this.quantity;

    if (this.mode === 'buy') {
      if ((state.player?.money || 0) < total) {
        GlobalAudioService.playSfx('cancel');
        this.statusMessage = t.msg_no_money;
        this.renderShop();
        return;
      }
      state.player.money -= total;
      if (item.isChassis && item.chassisId) {
        if (!state.bodies) state.bodies = {};
        for (let i = 0; i < this.quantity; i++) {
          const b = StatCalculator.createBodyInstance(item.chassisId);
          state.bodies[b.instanceId] = b;
        }
      } else {
        state.inventory[item.id] = (state.inventory[item.id] || 0) + this.quantity;
      }
      GlobalSaveService.save();
      GlobalAudioService.playSfx('confirm');
      this.statusMessage = t.msg_bought.replace('{qty}', String(this.quantity)).replace('{name}', item.name);
      this.quantity = 1;
      this.renderShop();
    } else {
      const curOwned = state.inventory[item.id] || 0;
      const sellQty = Math.min(curOwned, this.quantity);
      if (sellQty <= 0) return;
      state.inventory[item.id] = curOwned - sellQty;
      if (state.inventory[item.id] <= 0) delete state.inventory[item.id];
      state.player.money += item.unitPrice * sellQty;
      GlobalSaveService.save();
      GlobalAudioService.playSfx('confirm');
      this.statusMessage = t.msg_sold.replace('{qty}', String(sellQty)).replace('{name}', item.name);
      this.quantity = 1;
      this.renderShop();
    }
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
