import { Container, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalInput } from '../core/Input';
import { StatCalculator } from '../systems/battle/StatCalculator';
import {
  ScreenFrame,
  KitCard,
  KitTabBar,
  KitListRow,
  KitStatBox,
  KitBadge,
  KitStars,
  KitHearts,
  KitDivider,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { buildCodexVM, CodexSoulEntryVM, CodexBodyEntryVM } from '../ui/viewmodels/GroupAViewModels';
import { COLOR_HEX, FONTS } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 42 (GRUPO A): Códice de Almas y Cuerpos ("PokedexScene")
 * Construido 100% con /ui/kit (ScreenFrame, KitCard, KitTabBar, KitListRow, KitStatBox, KitBadge, KitStars, KitHearts, FocusManager).
 * Cero colores, fuentes o emojis hardcodeados.
 */
export class PokedexScene implements IScene {
  public name = 'Pokedex';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private screenFrame: ScreenFrame | null = null;
  private focusManager: FocusManager = new FocusManager();

  private activeTab: 'souls' | 'bodies' = 'souls';
  private currentFilter: 'all' | 'caught' | 'seen' | 'unknown' = 'all';
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
    const vm = buildCodexVM(state, this.activeTab, this.currentFilter);
    const t = (esText as any).terms.group_a.codex;

    const listLen = this.activeTab === 'souls' ? vm.souls.length : vm.bodies.length;
    if (this.selectedIndex >= listLen) {
      this.selectedIndex = Math.max(0, listLen - 1);
    }

    const selectedSoul = this.activeTab === 'souls' ? vm.souls[this.selectedIndex] : undefined;
    const canOpenSheet = Boolean(selectedSoul && selectedSoul.status !== 'unknown');

    const frame = new ScreenFrame({
      width,
      height,
      title: vm.title,
      currencies: [{ iconId: 'soul_orb', value: `${vm.caughtCount}/${vm.totalCount}` }],
      onClose: () => this.close(),
      secondaryAction: {
        label: t.btn_back,
        iconId: 'chevron_left',
        onClick: () => this.close(),
      },
      primaryAction: canOpenSheet
        ? {
            label: t.btn_sheet,
            iconId: 'codex_book',
            onClick: () => this.openUnitSheet(selectedSoul!),
          }
        : undefined,
    });
    this.screenFrame = frame;
    this.container.addChild(frame);

    const cw = frame.contentWidth;
    const isTwoCol = frame.isTwoColumn;

    // 1. Top Controls Card (Tabs + Filters)
    const headerCardH = this.activeTab === 'souls' ? 112 : 60;
    const headerCard = new KitCard({
      width: cw,
      height: headerCardH,
      variant: 'smokedWood',
      showCorners: false,
    });
    headerCard.position.set(0, 0);
    frame.contentRoot.addChild(headerCard);

    const mainTabs = new KitTabBar(
      [
        { id: 'souls', label: t.tab_souls, iconId: 'soul_orb' },
        { id: 'bodies', label: t.tab_bodies, iconId: 'body_chassis' },
      ],
      this.activeTab,
      cw - 16,
      (id) => {
        this.activeTab = id as 'souls' | 'bodies';
        this.selectedIndex = 0;
        this.buildUI();
      }
    );
    mainTabs.position.set(8, 8);
    headerCard.addChild(mainTabs);

    if (this.activeTab === 'souls') {
      const filterTabs = new KitTabBar(
        [
          { id: 'all', label: t.filter_all },
          { id: 'caught', label: t.filter_caught },
          { id: 'seen', label: t.filter_seen },
          { id: 'unknown', label: t.filter_unknown },
        ],
        this.currentFilter,
        cw - 16,
        (fid) => {
          this.currentFilter = fid as any;
          this.selectedIndex = 0;
          this.buildUI();
        }
      );
      filterTabs.position.set(8, 58);
      headerCard.addChild(filterTabs);
    }

    const startY = headerCardH + 10;
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    if (this.activeTab === 'souls') {
      this.renderSoulsContent(frame, vm.souls, startY, colW, isTwoCol);
    } else {
      this.renderBodiesContent(frame, vm.bodies, startY, colW, isTwoCol);
    }

    UIKitLinter.inspectTree(frame, 'PokedexScene');
  }

  private renderSoulsContent(
    frame: ScreenFrame,
    souls: CodexSoulEntryVM[],
    startY: number,
    colW: number,
    isTwoCol: boolean
  ): void {
    const t = (esText as any).terms.group_a.codex;
    const rowH = 54;
    const listCardH = Math.max(160, souls.length * rowH + 44);

    const listCard = new KitCard({
      width: colW,
      height: listCardH,
      variant: 'smokedWood',
      title: t.tab_souls,
    });
    listCard.position.set(0, startY);
    frame.contentRoot.addChild(listCard);

    if (souls.length === 0) {
      const emptyTxt = new Text({
        text: t.empty_filter,
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
      souls.forEach((s, idx) => {
        const iconId =
          s.status === 'caught' ? 'soul_orb' : s.status === 'seen' ? 'codex_book' : 'warning';
        const row = new KitListRow({
          width: colW - 16,
          height: 48,
          iconId,
          title: `${s.numFormatted} ${s.name}`,
          subtitle: s.status === 'unknown' ? s.statusLabel : `${s.element} • ${s.habitat}`,
          value: s.status === 'caught' ? `BST ${s.bst}` : '',
          selected: idx === this.selectedIndex,
          onClick: () => {
            if (this.selectedIndex === idx && s.status !== 'unknown') {
              this.openUnitSheet(s);
            } else {
              this.selectedIndex = idx;
              this.buildUI();
            }
          },
        });
        row.position.set(8, 36 + idx * rowH);
        listCard.addChild(row);

        this.focusManager.register({
          container: row,
          width: colW - 16,
          height: 48,
          onActivate: () => {
            this.selectedIndex = idx;
            if (s.status !== 'unknown') {
              this.openUnitSheet(s);
            } else {
              this.buildUI();
            }
          },
        });
      });
      this.focusManager.setFocus(this.selectedIndex, false);
    }

    // Detail Card
    const detailCardH = 380;
    const detailCard = new KitCard({
      width: colW,
      height: detailCardH,
      variant: 'parchment',
      title: souls[this.selectedIndex]
        ? `${souls[this.selectedIndex].numFormatted} — ${souls[this.selectedIndex].name}`
        : t.tab_souls,
    });
    detailCard.position.set(
      isTwoCol ? colW + 12 : 0,
      isTwoCol ? startY : startY + listCardH + 12
    );
    frame.contentRoot.addChild(detailCard);

    const sel = souls[this.selectedIndex];
    if (sel) {
      const statusBadge = new KitBadge(
        sel.statusLabel,
        sel.status === 'caught' ? 'tier' : 'rarity',
        sel.status === 'caught' ? 'tier' : 'comun'
      );
      statusBadge.position.set(12, 36);
      detailCard.addChild(statusBadge);

      if (sel.status !== 'unknown') {
        const elemBadge = new KitBadge(sel.element, 'element', sel.element);
        elemBadge.position.set(18 + statusBadge.width, 36);
        detailCard.addChild(elemBadge);

        const habTxt = new Text({
          text: `${t.habitat}: ${sel.habitat}`,
          style: new TextStyle({
            fontFamily: FONTS.body,
            fontSize: 14,
            fontWeight: 'bold',
            fill: COLOR_HEX.inkCrypt,
          }),
        });
        habTxt.roundPixels = true;
        habTxt.position.set(12, 68);
        detailCard.addChild(habTxt);

        const hearts = new KitHearts(Math.min(5, Math.floor(sel.syncValue / 50)), 5, 14);
        hearts.position.set(colW - 96, 68);
        detailCard.addChild(hearts);

        // 3x2 StatBoxes
        const sbW = Math.floor((colW - 36) / 3);
        const statList: Array<{
          id: 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed';
          lbl: string;
          val: number;
        }> = [
          { id: 'hp', lbl: esText.terms.sheet.stat_hp, val: sel.baseStats.hp },
          { id: 'atk', lbl: esText.terms.sheet.stat_atk, val: sel.baseStats.atk },
          { id: 'def', lbl: esText.terms.sheet.stat_def, val: sel.baseStats.def },
          { id: 'spAtk', lbl: esText.terms.sheet.stat_spAtk, val: sel.baseStats.spAtk },
          { id: 'spDef', lbl: esText.terms.sheet.stat_spDef, val: sel.baseStats.spDef },
          { id: 'speed', lbl: esText.terms.sheet.stat_speed, val: sel.baseStats.speed },
        ];
        statList.forEach((st, idx) => {
          const box = new KitStatBox(st.id, st.lbl, st.val, sbW, 44);
          box.position.set(12 + (idx % 3) * (sbW + 6), 94 + Math.floor(idx / 3) * 50);
          detailCard.addChild(box);
        });
      }

      const div = new KitDivider(colW - 24);
      div.position.set(12, 200);
      detailCard.addChild(div);

      const loreLines = [sel.description];
      if (sel.lore50) loreLines.push(sel.lore50);
      if (sel.lore150) loreLines.push(sel.lore150);

      const descTxt = new Text({
        text: loreLines.join('\n\n'),
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          lineHeight: 19,
          fill: COLOR_HEX.inkCrypt,
          wordWrap: true,
          wordWrapWidth: colW - 24,
        }),
      });
      descTxt.roundPixels = true;
      descTxt.position.set(12, 214);
      detailCard.addChild(descTxt);
    }

    const totalH = isTwoCol
      ? startY + Math.max(listCardH, detailCardH) + 16
      : startY + listCardH + detailCardH + 28;
    frame.setContentTotalHeight(totalH);
  }

  private renderBodiesContent(
    frame: ScreenFrame,
    bodies: CodexBodyEntryVM[],
    startY: number,
    colW: number,
    isTwoCol: boolean
  ): void {
    const t = (esText as any).terms.group_a.codex;
    const rowH = 54;
    const listCardH = Math.max(160, bodies.length * rowH + 44);

    const listCard = new KitCard({
      width: colW,
      height: listCardH,
      variant: 'smokedWood',
      title: t.tab_bodies,
    });
    listCard.position.set(0, startY);
    frame.contentRoot.addChild(listCard);

    bodies.forEach((b, idx) => {
      const row = new KitListRow({
        width: colW - 16,
        height: 48,
        iconId: 'body_chassis',
        title: b.name,
        subtitle: `${b.material} • Tier ${b.tier}`,
        value: `${b.price}`,
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
        height: 48,
        onActivate: () => {
          this.selectedIndex = idx;
          this.buildUI();
        },
      });
    });
    this.focusManager.setFocus(this.selectedIndex, false);

    const detailCardH = 290;
    const sel = bodies[this.selectedIndex];
    const detailCard = new KitCard({
      width: colW,
      height: detailCardH,
      variant: 'parchment',
      title: sel ? sel.name : t.tab_bodies,
    });
    detailCard.position.set(
      isTwoCol ? colW + 12 : 0,
      isTwoCol ? startY : startY + listCardH + 12
    );
    frame.contentRoot.addChild(detailCard);

    if (sel) {
      const stars = new KitStars(sel.tier, 5, 14);
      stars.position.set(12, 38);
      detailCard.addChild(stars);

      const matBadge = new KitBadge(sel.material, 'tier', 'tier');
      matBadge.position.set(110, 34);
      detailCard.addChild(matBadge);

      const shareTitle = new Text({
        text: `${t.part_share}: ${esText.terms.sheet.part_head} ${sel.partShare.head}% • ${esText.terms.sheet.part_torso} ${sel.partShare.torso}% • ${esText.terms.sheet.part_arms} ${sel.partShare.arms}% • ${esText.terms.sheet.part_legs} ${sel.partShare.legs}%`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
          wordWrap: true,
          wordWrapWidth: colW - 24,
        }),
      });
      shareTitle.roundPixels = true;
      shareTitle.position.set(12, 68);
      detailCard.addChild(shareTitle);

      const slotsTxt = new Text({
        text: `${t.slots_avail}: ${sel.slotsText}`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      slotsTxt.roundPixels = true;
      slotsTxt.position.set(12, 116);
      detailCard.addChild(slotsTxt);

      const div = new KitDivider(colW - 24);
      div.position.set(12, 144);
      detailCard.addChild(div);

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
      descTxt.position.set(12, 160);
      detailCard.addChild(descTxt);
    }

    const totalH = isTwoCol
      ? startY + Math.max(listCardH, detailCardH) + 16
      : startY + listCardH + detailCardH + 28;
    frame.setContentTotalHeight(totalH);
  }

  private openUnitSheet(soul: CodexSoulEntryVM): void {
    const saveState = GlobalSaveService.getCurrentState();
    const allOwned = [...(saveState.party || []), ...(saveState.storage || [])];
    const activeDoll = allOwned.find((s) => s.speciesId === soul.id);

    GlobalAudioService.playSfx('confirm');
    if (activeDoll) {
      GlobalSceneManager.pushScene('CreatureDetail', {
        uid: activeDoll.uid,
        list: allOwned,
      });
    } else {
      const previewDoll = StatCalculator.createSouldoll(soul.id, 10, 'chassis_madera_t1', soul.name);
      GlobalSceneManager.pushScene('CreatureDetail', {
        index: 0,
        list: [previewDoll],
      });
    }
  }

  public update(_dt: number): void {
    if (this.screenFrame) {
      this.screenFrame.updateInertia();
    }

    const state = GlobalSaveService.getCurrentState();
    const vm = buildCodexVM(state, this.activeTab, this.currentFilter);
    const listLen = this.activeTab === 'souls' ? vm.souls.length : vm.bodies.length;

    if (GlobalInput.justPressed('UP')) {
      if (listLen > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + listLen) % listLen;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('DOWN')) {
      if (listLen > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % listLen;
        GlobalAudioService.playSfx('select');
        this.buildUI();
      }
    } else if (GlobalInput.justPressed('LEFT') || GlobalInput.justPressed('RIGHT')) {
      this.activeTab = this.activeTab === 'souls' ? 'bodies' : 'souls';
      this.selectedIndex = 0;
      GlobalAudioService.playSfx('select');
      this.buildUI();
    } else if (GlobalInput.justPressed('CONFIRM')) {
      this.focusManager.activateCurrent();
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
