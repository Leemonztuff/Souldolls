import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalInput } from '../core/Input';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { GachaService } from '../systems/gacha/GachaService';
import { ITEMS_DATA } from '../data/items/items';
import { MOVES_DATA } from '../data/moves/moves';
import { CREATURES_DATA } from '../data/creatures/creatures';
import {
  ScreenFrame,
  KitCard,
  KitTabBar,
  KitListRow,
  KitItemSlot,
  KitBadge,
  KitDivider,
  KitModal,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildBagVM, BagTabId, BagItemEntryVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Pantalla de Mochila de Artífice ("BagScene")
 * Construida 100% con /ui/kit (ScreenFrame, KitCard, KitTabBar, KitListRow, KitItemSlot, KitBadge, KitModal, FocusManager).
 * Cero colores, fuentes o emojis hardcodeados.
 */
export class BagScene implements IScene {
  public name = 'Bag';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private screenFrame: ScreenFrame | null = null;
  private focusManager: FocusManager = new FocusManager();
  private activeModal: KitModal | null = null;

  private activeTab: BagTabId = 'consumables';
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
    const vm = buildBagVM(state, this.activeTab);

    if (this.selectedIndex >= vm.items.length) {
      this.selectedIndex = Math.max(0, vm.items.length - 1);
    }
    const selectedItem = vm.items[this.selectedIndex];

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      currencies: [{ iconId: 'coin', value: vm.money }],
      onClose: () => this.close(),
      secondaryAction: {
        label: vm.btnBack,
        iconId: 'chevron_left',
        onClick: () => this.close(),
      },
      primaryAction: selectedItem
        ? {
            label: vm.btnUse,
            iconId: 'check',
            disabled: !selectedItem.canUseInField,
            onClick: () => this.handleUseSelectedItem(selectedItem),
          }
        : undefined,
    });
    this.screenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const isTwoCol = frame.isTwoColumn;

    // 1. Top TabBar Card
    const tabCard = new KitCard({
      width: cw,
      height: 60,
      variant: 'smokedWood',
      showCorners: false,
    });
    tabCard.position.set(0, 0);
    frame.contentRoot.addChild(tabCard);

    const tabBar = new KitTabBar(
      vm.tabs,
      this.activeTab,
      cw - 16,
      (id) => {
        this.activeTab = id as BagTabId;
        this.selectedIndex = 0;
        this.buildUI();
      }
    );
    tabBar.position.set(8, 8);
    tabCard.addChild(tabBar);

    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;
    const startY = 68;

    // 2. Detail Card (On mobile portrait placed above or below list; let's place list & detail cleanly)
    const listRowH = 56;
    const listCardH = Math.max(180, vm.items.length * listRowH + 48);

    const listCard = new KitCard({
      width: colW,
      height: listCardH,
      variant: 'smokedWood',
      title: vm.secList,
    });
    listCard.position.set(0, startY);
    frame.contentRoot.addChild(listCard);

    if (vm.items.length === 0) {
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
      vm.items.forEach((it, idx) => {
        const row = new KitListRow({
          width: colW - 16,
          height: 50,
          iconId: it.iconId,
          title: it.name,
          subtitle: `${(esText as any).terms.group_a.bag.price_label}: ${it.price}`,
          value: `x${it.quantity}`,
          selected: idx === this.selectedIndex,
          onClick: () => {
            if (this.selectedIndex === idx && it.canUseInField) {
              this.handleUseSelectedItem(it);
            } else {
              this.selectedIndex = idx;
              this.buildUI();
            }
          },
        });
        row.position.set(8, 36 + idx * listRowH);
        listCard.addChild(row);

        this.focusManager.register({
          container: row,
          width: colW - 16,
          height: 50,
          onActivate: () => {
            this.selectedIndex = idx;
            if (it.canUseInField) {
              this.handleUseSelectedItem(it);
            } else {
              this.buildUI();
            }
          },
        });
      });
      this.focusManager.setFocus(this.selectedIndex, false);
    }

    // 3. Detail Card
    const detailCardH = 220;
    const detailCard = new KitCard({
      width: colW,
      height: detailCardH,
      variant: 'parchment',
      title: vm.secDetail,
    });
    detailCard.position.set(
      isTwoCol ? colW + 12 : 0,
      isTwoCol ? startY : startY + listCardH + 12
    );
    frame.contentRoot.addChild(detailCard);

    if (selectedItem) {
      const slot = new KitItemSlot(selectedItem.iconId, selectedItem.quantity, selectedItem.rarity);
      slot.position.set(12, 38);
      detailCard.addChild(slot);

      const itemTitle = new Text({
        text: selectedItem.name.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      itemTitle.roundPixels = true;
      itemTitle.position.set(70, 40);
      detailCard.addChild(itemTitle);

      const rarityBadge = new KitBadge(selectedItem.rarity, 'rarity', selectedItem.rarity);
      rarityBadge.position.set(70, 64);
      detailCard.addChild(rarityBadge);

      const div = new KitDivider(colW - 24);
      div.position.set(12, 96);
      detailCard.addChild(div);

      const descTxt = new Text({
        text: selectedItem.description,
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
      descTxt.position.set(12, 112);
      detailCard.addChild(descTxt);
    } else {
      const noSelTxt = new Text({
        text: vm.emptyText,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      noSelTxt.roundPixels = true;
      noSelTxt.position.set(16, 48);
      detailCard.addChild(noSelTxt);
    }

    const totalH = isTwoCol
      ? startY + Math.max(listCardH, detailCardH) + 16
      : startY + listCardH + detailCardH + 28;
    frame.setContentTotalHeight(totalH);

    if (this.activeModal) {
      this.container.addChild(this.activeModal);
    }

    UIKitLinter.inspectTree(frame, 'BagScene');
  }

  private handleUseSelectedItem(item: BagItemEntryVM): void {
    const t = (esText as any).terms.group_a.bag;
    const state = GlobalSaveService.getCurrentState();
    const party = state.party || [];

    // Bloque 28B R4.1: Usar Fragmentos de Alma abre la Cámara de Resonancia QR
    if (
      item.category === 'fragment' ||
      item.id === 'soul_fragment' ||
      item.id === 'soul_fragment_brilliant'
    ) {
      GlobalAudioService.playSfx('confirm');
      const tableId =
        item.id === 'soul_fragment_brilliant' ? 'brilliant_resonance' : 'standard_resonance';
      GlobalSceneManager.pushScene('GachaResonance', { tableId, tab: 'scan' });
      return;
    }

    if (!item.canUseInField || party.length === 0) {
      this.openModal({
        type: 'Alert',
        title: item.name,
        bodyText: t.cannot_use,
      });
      return;
    }

    const pickerItems = party.slice(0, 3).map((doll) => {
      const sp = CREATURES_DATA[doll.speciesId] || CREATURES_DATA.maga;
      const stats = StatCalculator.calculateStats(doll);
      return {
        id: doll.uid,
        title: `${doll.nickname || sp.name} (${esText.terms.sheet.level_short}.${doll.level})`,
        subtitle: sp.name,
        value: `${doll.currentHp}/${stats.hp}`,
        iconId: 'soul_orb' as const,
      };
    });

    this.openModal({
      type: 'ItemPicker',
      title: t.select_target,
      bodyText: item.name,
      cancelLabel: t.btn_back,
      items: pickerItems,
      onConfirm: (targetUid: string) => {
        if (typeof targetUid === 'string') {
          this.applyItemToDoll(item.id, targetUid);
        }
      },
    });
  }

  private applyItemToDoll(itemId: string, dollUid: string): void {
    const t = (esText as any).terms.group_a.bag;
    const state = GlobalSaveService.getCurrentState();
    const def = ITEMS_DATA[itemId];
    const doll = (state.party || []).find((d) => d.uid === dollUid);
    if (!def || !doll) return;

    const sp = CREATURES_DATA[doll.speciesId] || CREATURES_DATA.maga;
    const targetName = doll.nickname || sp.name;
    const stats = StatCalculator.calculateStats(doll);

    if (def.category === 'scroll') {
      const res = GachaService.useTechniqueScroll(itemId, doll, state);
      if (res.status === 'NEEDS_REPLACEMENT') {
        const moveItems = doll.moves.map((m, idx) => {
          const mDef = MOVES_DATA[m.moveId];
          return {
            id: String(idx),
            title: mDef?.name || m.moveId,
            subtitle: `${mDef?.type || 'Neutro'} · Pot: ${mDef?.power || 0}`,
            value: `PP ${m.currentPp}/${m.maxPp}`,
            iconId: 'quest_scroll' as const,
          };
        });
        this.openModal({
          type: 'ItemPicker',
          title: `OLVIDAR TÉCNICA PARA ${res.moveName?.toUpperCase()}`,
          bodyText: res.message,
          cancelLabel: t.btn_back,
          items: moveItems,
          onConfirm: (selectedIdxStr: string) => {
            const replaceIdx = parseInt(selectedIdxStr, 10);
            if (!isNaN(replaceIdx)) {
              const finalRes = GachaService.useTechniqueScroll(itemId, doll, state, replaceIdx);
              GlobalSaveService.save();
              this.buildUI();
              this.openModal({
                type: 'Alert',
                title: def.name,
                bodyText: finalRes.message,
              });
            }
          },
        });
        return;
      }

      GlobalSaveService.save();
      this.buildUI();
      this.openModal({
        type: 'Alert',
        title: def.name,
        bodyText: res.message,
      });
      return;
    }

    let msg = '';
    if (def.category === 'elixir' || def.category === 'repair_kit') {
      const healAmt = (def.effect as any).amount || 40;
      doll.currentHp = Math.min(stats.hp, (doll.currentHp || 0) + healAmt);
      if (!doll.partHP) {
        doll.partHP = { head: 1, torso: 1, arms: 1, legs: 1 };
      }
      doll.partHP.head = Math.min(Math.round(stats.hp * 0.2), doll.partHP.head + healAmt);
      doll.partHP.torso = Math.min(Math.round(stats.hp * 0.4), doll.partHP.torso + healAmt);
      doll.partHP.arms = Math.min(Math.round(stats.hp * 0.2), doll.partHP.arms + healAmt);
      doll.partHP.legs = Math.min(Math.round(stats.hp * 0.2), doll.partHP.legs + healAmt);
      msg = t.used_heal.replace('{item}', def.name).replace('{target}', targetName);
    } else if (def.category === 'reincarnation') {
      doll.currentHp = Math.max(1, Math.round(stats.hp * 0.5));
      if (!doll.partHP) {
        doll.partHP = { head: 1, torso: 1, arms: 1, legs: 1 };
      }
      doll.partHP.head = Math.max(1, Math.round(stats.hp * 0.1));
      doll.partHP.torso = Math.max(1, Math.round(stats.hp * 0.2));
      msg = t.used_revive.replace('{item}', def.name).replace('{target}', targetName);
    } else if (def.category === 'purge') {
      doll.status = null;
      msg = t.used_purge.replace('{item}', def.name).replace('{target}', targetName);
    } else if (def.category === 'weapon' || def.category === 'relic') {
      if (!doll.equipped) doll.equipped = {};
      const slot = def.category === 'weapon' ? 'weapon' : 'relic';
      const prev = doll.equipped[slot];
      if (prev) {
        state.inventory[prev] = (state.inventory[prev] || 0) + 1;
      }
      doll.equipped[slot] = def.id;
      if (slot === 'relic') doll.heldItemId = def.id;
      msg = t.used_equip.replace('{item}', def.name).replace('{target}', targetName);
    }

    state.inventory[itemId] = Math.max(0, (state.inventory[itemId] || 1) - 1);
    GlobalSaveService.save();
    this.buildUI();

    if (msg) {
      this.openModal({
        type: 'Alert',
        title: def.name,
        bodyText: msg,
      });
    }
  }

  private openModal(config: {
    type: 'Alert' | 'ItemPicker';
    title: string;
    bodyText: string;
    cancelLabel?: string;
    items?: any[];
    onConfirm?: (res: any) => void;
  }): void {
    if (this.activeModal) {
      this.activeModal.destroy({ children: true });
      this.activeModal = null;
    }

    const w = GlobalPixiRenderer.width;
    const h = GlobalPixiRenderer.height;
    const modal = new KitModal(w, h, {
      type: config.type,
      title: config.title,
      bodyText: config.bodyText,
      cancelLabel: config.cancelLabel,
      items: config.items,
      onConfirm: (res) => {
        if (this.activeModal) {
          this.activeModal.destroy({ children: true });
          this.activeModal = null;
        }
        config.onConfirm?.(res);
      },
      onCancel: () => {
        if (this.activeModal) {
          this.activeModal.destroy({ children: true });
          this.activeModal = null;
        }
      },
    });
    this.activeModal = modal;
    this.container.addChild(modal);
  }

  public update(dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }
    if (this.activeModal) {
      this.activeModal.updateTween(dt);
      if (GlobalInput.justPressed('UP')) {
        this.activeModal.focusManager.move(-1);
      } else if (GlobalInput.justPressed('DOWN')) {
        this.activeModal.focusManager.move(1);
      } else if (GlobalInput.justPressed('CONFIRM')) {
        this.activeModal.focusManager.activateCurrent();
      } else if (GlobalInput.justPressed('CANCEL')) {
        this.activeModal.destroy({ children: true });
        this.activeModal = null;
      }
      return;
    }

    const state = GlobalSaveService.getCurrentState();
    const vm = buildBagVM(state, this.activeTab);

    if (GlobalInput.justPressed('LEFT')) {
      const tabOrder: BagTabId[] = ['consumables', 'bottles', 'equipment', 'crystals'];
      const curIdx = tabOrder.indexOf(this.activeTab);
      this.activeTab = tabOrder[(curIdx - 1 + tabOrder.length) % tabOrder.length];
      this.selectedIndex = 0;
      GlobalAudioService.playSfx('select');
      this.buildUI();
    } else if (GlobalInput.justPressed('RIGHT')) {
      const tabOrder: BagTabId[] = ['consumables', 'bottles', 'equipment', 'crystals'];
      const curIdx = tabOrder.indexOf(this.activeTab);
      this.activeTab = tabOrder[(curIdx + 1) % tabOrder.length];
      this.selectedIndex = 0;
      GlobalAudioService.playSfx('select');
      this.buildUI();
    } else if (GlobalInput.justPressed('UP')) {
      if (vm.items.length > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + vm.items.length) % vm.items.length;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('DOWN')) {
      if (vm.items.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % vm.items.length;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('CONFIRM')) {
      const sel = vm.items[this.selectedIndex];
      if (sel) {
        this.handleUseSelectedItem(sel);
      }
    } else if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.close();
    }
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
