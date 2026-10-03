import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { BodyChassis } from '../types/bodies';
import { GlobalSaveService } from '../services/SaveService';
import { PokedexSystem, PokedexStatus } from '../systems/PokedexSystem';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';

export class PokedexScene implements IScene {
  public name = 'Pokedex';
  private container: Container = new Container();
  private activeTab: 'souls' | 'bodies' = 'souls';
  private selectedIndex = 0;
  private currentFilter: 'all' | 'caught' | 'seen' | 'unknown' = 'all';
  private currentSort: 'number' | 'type' = 'number';

  private contentContainer: Container = new Container();
  private detailsContainer: Container = new Container();
  private filterContainer: Container = new Container();

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.container = new Container();
    this.container.position.set(0, 0);

    // 1. Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.99 });
    this.container.addChild(bg);

    // 2. Header Bar
    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 75);
    headerBg.fill({ color: COLOR_NUM.smokedWood });
    headerBg.stroke({ color: COLOR_NUM.gold, width: 2 });
    this.container.addChild(headerBg);

    const titleText = new Text({
      text: '📖 CÓDICE DE ALMAS Y CUERPOS',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 20,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
        letterSpacing: 1.5,
      }),
    });
    titleText.position.set(24, 22);
    this.container.addChild(titleText);

    // Tab Buttons
    const soulsTabBtn = this.createButton(
      '🔮 ALMAS',
      320,
      18,
      120,
      38,
      this.activeTab === 'souls' ? COLOR_NUM.gold : COLOR_NUM.bronze,
      () => {
        this.activeTab = 'souls';
        this.selectedIndex = 0;
        GlobalAudioService.playSfx('select');
        this.enter();
      }
    );
    this.container.addChild(soulsTabBtn);

    const bodiesTabBtn = this.createButton(
      '🤖 CUERPOS CONOCIDOS',
      450,
      18,
      180,
      38,
      this.activeTab === 'bodies' ? COLOR_NUM.cyan : COLOR_NUM.bronze,
      () => {
        this.activeTab = 'bodies';
        this.selectedIndex = 0;
        GlobalAudioService.playSfx('select');
        this.enter();
      }
    );
    this.container.addChild(bodiesTabBtn);

    // Close button
    const closeBtn = this.createButton('✕ CERRAR', width - 140, 18, 120, 38, COLOR_NUM.rift, () => {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.popScene();
    });
    this.container.addChild(closeBtn);

    if (this.activeTab === 'souls') {
      // 3. Filters Bar
      this.buildFilterBar();
    }

    // 4. Main Layout Containers
    this.container.addChild(this.contentContainer);
    this.container.addChild(this.detailsContainer);

    this.refreshView();

    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    onClick: () => void
  ): Container {
    const btn = new Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: COLOR_NUM.inkCrypt });
    bg.stroke({ color, width: 2 });
    btn.addChild(bg);

    // Inner highlight
    bg.roundRect(2, 2, w - 4, h - 4, 6);
    bg.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: 0.15 });

    const txt = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: '900',
        fill: COLOR_HEX.parchment,
      }),
    });
    txt.anchor.set(0.5);
    txt.position.set(w / 2, h / 2);
    btn.addChild(txt);

    btn.on('pointerdown', (e) => {
      e.stopPropagation();
      onClick();
    });

    return btn;
  }

  private buildFilterBar(): void {
    this.filterContainer.removeChildren();
    this.filterContainer.position.set(24, 85);

    const filters: { id: 'all' | 'caught' | 'seen' | 'unknown'; label: string }[] = [
      { id: 'all', label: 'TODAS' },
      { id: 'caught', label: '🔮 LIGADAS' },
      { id: 'seen', label: '👁️ AVISTADAS' },
      { id: 'unknown', label: '🔒 INCÓGNITAS' },
    ];

    let startX = 0;
    filters.forEach((f) => {
      const active = this.currentFilter === f.id;
      const btn = this.createButton(
        f.label,
        startX,
        0,
        120,
        32,
        active ? COLOR_NUM.gold : COLOR_NUM.bronze,
        () => {
          GlobalAudioService.playSfx('select');
          this.currentFilter = f.id;
          this.selectedIndex = 0;
          this.buildFilterBar();
          this.refreshView();
        }
      );
      this.filterContainer.addChild(btn);
      startX += 130;
    });

    this.container.addChild(this.filterContainer);
  }

  private getFilteredCreatures() {
    let creatures = Object.values(CREATURES_DATA);

    // Filter
    creatures = creatures.filter((c) => {
      const status: PokedexStatus = PokedexSystem.getStatus(c.id);
      if (this.currentFilter === 'caught') return status === 'caught';
      if (this.currentFilter === 'seen') return status === 'seen';
      if (this.currentFilter === 'unknown') return status === 'unknown';
      return true;
    });

    // Sort
    if (this.currentSort === 'number') {
      creatures.sort((a, b) => a.dexNumber - b.dexNumber);
    } else {
      creatures.sort((a, b) => a.types[0].localeCompare(b.types[0]));
    }

    return creatures;
  }

  private refreshView(): void {
    if (this.activeTab === 'souls') {
      this.buildList();
      this.buildDetails();
    } else {
      this.buildBodiesList();
      this.buildBodiesDetails();
    }
  }

  private buildList(): void {
    this.contentContainer.removeChildren();
    const creatures = this.getFilteredCreatures();

    let startY = 130;
    creatures.forEach((c, idx) => {
      const status: PokedexStatus = PokedexSystem.getStatus(c.id);
      const isSelected = this.selectedIndex === idx;

      const itemBg = new Graphics();
      itemBg.roundRect(24, startY, 340, 52, 8);
      itemBg.fill({ color: isSelected ? COLOR_NUM.smokedWood : COLOR_NUM.inkCrypt, alpha: 0.95 });
      itemBg.stroke({
        color: isSelected ? COLOR_NUM.gold : COLOR_NUM.bronze,
        width: isSelected ? 2 : 1,
      });

      const itemContainer = new Container();
      itemContainer.eventMode = 'static';
      itemContainer.cursor = 'pointer';
      itemContainer.addChild(itemBg);

      const numStr = `#${String(c.dexNumber).padStart(3, '0')}`;
      const nameStr = status === 'unknown' ? '???' : c.name;
      const statusIcon = status === 'caught' ? '🔮' : status === 'seen' ? '👁️' : '🔒';

      const infoText = new Text({
        text: `${numStr}  ${nameStr}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 14,
          fontWeight: '700',
          fill: status === 'unknown' ? COLOR_HEX.smoke : COLOR_HEX.parchment,
        }),
      });
      infoText.position.set(40, startY + 16);
      itemContainer.addChild(infoText);

      const iconText = new Text({
        text: statusIcon,
        style: new TextStyle({ fontSize: 16 }),
      });
      iconText.position.set(325, startY + 16);
      itemContainer.addChild(iconText);

      itemContainer.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('select');
        this.selectedIndex = idx;
        this.refreshView();
      });

      this.contentContainer.addChild(itemContainer);
      startY += 60;
    });
  }

  private buildBodiesList(): void {
    this.contentContainer.removeChildren();
    const chassisList = Object.values(BODY_CHASSIS_DATA);

    let startY = 90;
    chassisList.forEach((chassis, idx) => {
      const isSelected = this.selectedIndex === idx;

      const itemBg = new Graphics();
      itemBg.roundRect(24, startY, 340, 52, 8);
      itemBg.fill({ color: isSelected ? COLOR_NUM.smokedWood : COLOR_NUM.inkCrypt, alpha: 0.95 });
      itemBg.stroke({
        color: isSelected ? COLOR_NUM.cyan : COLOR_NUM.bronze,
        width: isSelected ? 2 : 1,
      });

      const itemContainer = new Container();
      itemContainer.eventMode = 'static';
      itemContainer.cursor = 'pointer';
      itemContainer.addChild(itemBg);

      const infoText = new Text({
        text: `🤖 ${chassis.name} (T${chassis.tier})`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 14,
          fontWeight: '700',
          fill: COLOR_HEX.parchment,
        }),
      });
      infoText.position.set(40, startY + 16);
      itemContainer.addChild(infoText);

      itemContainer.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('select');
        this.selectedIndex = idx;
        this.refreshView();
      });

      this.contentContainer.addChild(itemContainer);
      startY += 60;
    });
  }

  private buildBodiesDetails(): void {
    this.detailsContainer.removeChildren();
    const chassisList = Object.values(BODY_CHASSIS_DATA);
    const chassis = chassisList[this.selectedIndex];

    const panel = new Graphics();
    panel.roundRect(390, 85, 550, 560, 12);
    panel.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    panel.stroke({ color: COLOR_NUM.cyan, width: 2 });
    
    // Inner outline
    panel.roundRect(394, 89, 542, 552, 10);
    panel.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.25 });
    this.detailsContainer.addChild(panel);

    if (!chassis) return;

    const title = new Text({
      text: `🤖 ${chassis.name.toUpperCase()} (TIER ${chassis.tier})`,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 20,
        fontWeight: '900',
        fill: COLOR_HEX.cyan,
      }),
    });
    title.position.set(420, 110);
    this.detailsContainer.addChild(title);

    const share = chassis.partShare;
    const availSlots = Object.entries(chassis.slots)
      .filter(([_, avail]) => avail)
      .map(([slot]) => slot.toUpperCase());
    const lines = [
      `Material : ${chassis.material.toUpperCase()}`,
      `Rango / Precio : Tier ${chassis.tier} ($${chassis.price})`,
      `─────────────────────────────────────`,
      `Reparto de Vida por Partes:`,
      `• Cabeza  : ${Math.round(share.head * 100)}% del pool de PS`,
      `• Torso   : ${Math.round(share.torso * 100)}% del pool de PS`,
      `• Brazos  : ${Math.round(share.arms * 100)}% del pool de PS`,
      `• Piernas : ${Math.round(share.legs * 100)}% del pool de PS`,
      `─────────────────────────────────────`,
      `Ranuras de Equipo Disponibles:`,
      `• ${availSlots.join(', ')}`,
      `─────────────────────────────────────`,
      `"${chassis.description}"`,
    ];

    const detailsText = new Text({
      text: lines.join('\n'),
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 22,
        fill: COLOR_HEX.parchment,
      }),
    });
    detailsText.position.set(420, 160);
    this.detailsContainer.addChild(detailsText);
  }

  private buildDetails(): void {
    this.detailsContainer.removeChildren();
    const creatures = this.getFilteredCreatures();
    const c = creatures[this.selectedIndex];

    const panel = new Graphics();
    panel.roundRect(390, 85, 550, 560, 12);
    panel.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    panel.stroke({ color: COLOR_NUM.bronze, width: 2 });

    // Inner outline
    panel.roundRect(394, 89, 542, 552, 10);
    panel.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.25 });
    this.detailsContainer.addChild(panel);

    if (!c) {
      const emptyText = new Text({
        text: 'No hay almas registradas en este filtro.',
        style: new TextStyle({ fontFamily: FONTS.hud, fontSize: 16, fill: COLOR_HEX.smoke }),
      });
      emptyText.position.set(420, 120);
      this.detailsContainer.addChild(emptyText);
      return;
    }

    const status: PokedexStatus = PokedexSystem.getStatus(c.id);
    const numStr = `#${String(c.dexNumber).padStart(3, '0')}`;

    const title = new Text({
      text: `${numStr} - ${status === 'unknown' ? '???' : c.name.toUpperCase()}`,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 22,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
      }),
    });
    title.position.set(420, 110);
    this.detailsContainer.addChild(title);

    const statusBadge = new Text({
      text:
        status === 'caught' ? '🔮 LIGADO AL CHASIS' : status === 'seen' ? '👁️ AVISTADO' : '🔒 INCÓGNITO',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 13,
        fontWeight: 'bold',
        fill:
          status === 'caught'
            ? COLOR_HEX.cyan
            : status === 'seen'
              ? COLOR_HEX.gold
              : COLOR_HEX.disabledText,
      }),
    });
    statusBadge.position.set(420, 145);
    this.detailsContainer.addChild(statusBadge);

    if (status === 'unknown') {
      const lockedMsg = new Text({
        text: 'Aún no has avistado ni ligado esta alma en tu aventura.',
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.smoke,
        }),
      });
      lockedMsg.position.set(420, 200);
      this.detailsContainer.addChild(lockedMsg);
      return;
    }

    // Details for Seen or Caught
    const typesStr = `Elemento: ${c.types.join(' / ').toUpperCase()}`;
    const descStr = c.description;
    const habitatStr = `Hábitat de Origen: ${(c.habitatMapIds || ['Ruta del Claro']).join(', ')}`;

    const lines: string[] = [typesStr, habitatStr, `─────────────────────────────────────`];

    // Check highest sync for lore unlock
    const saveState = GlobalSaveService.getCurrentState();
    const activeDoll = [...(saveState.party || []), ...(saveState.storage || [])].find(
      (s) => s.speciesId === c.id
    );
    const currentSync = activeDoll
      ? activeDoll.sync !== undefined
        ? activeDoll.sync
        : activeDoll.friendship || 0
      : 0;

    if (status === 'caught') {
      const bst =
        c.baseStats.hp +
        c.baseStats.atk +
        c.baseStats.def +
        c.baseStats.spAtk +
        c.baseStats.spDef +
        c.baseStats.speed;
      lines.push(
        `BST Total: ${bst}  ·  Sincronía del Lazo: ${currentSync}/255`,
        `• PS Base     : ${c.baseStats.hp}   • Atq. Esp. : ${c.baseStats.spAtk}`,
        `• Ataque Base : ${c.baseStats.atk}   • Def. Esp. : ${c.baseStats.spDef}`,
        `• Defensa Base: ${c.baseStats.def}   • Velocidad : ${c.baseStats.speed}`,
        `─────────────────────────────────────`
      );
    }

    lines.push(`"${descStr}"`);

    // Lore Unlocks by Synchrony
    if (currentSync >= 50) {
      lines.push(
        `\n📜 Lore de Origen (Sincronía ≥ 50):\nUn alma antigua que resonaba libre en el mundo de Anima antes de ser guiada al chasis.`
      );
    }
    if (currentSync >= 150) {
      lines.push(
        `\n✨ Resonancia Maestra (Sincronía ≥ 150):\nLa perfecta comunión entre el ki del Soultrainer y esta alma le otorga la fuerza para aguantar un golpe fatal en combate.`
      );
    }

    const detailsText = new Text({
      text: lines.join('\n'),
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 12,
        lineHeight: 18,
        fill: COLOR_HEX.parchment,
      }),
    });
    detailsText.position.set(420, 180);
    this.detailsContainer.addChild(detailsText);
  }

  public update(_dt: number): void {}
  public render(_alpha: number): void {}
  public onResize(_width: number, _height: number): void {}

  public async exit(): Promise<void> {
    if (this.container.parent) {
      this.container.parent.removeChildren();
    }
  }
}
