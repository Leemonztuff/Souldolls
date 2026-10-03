import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { Souldoll } from '../types/souldolls';
import { BodyInstance } from '../types/bodies';

export class StorageBoxScene implements IScene {
  public name = 'StorageBox';
  private container: Container = new Container();
  private contentContainer: Container = new Container();
  private activeTab: 'souls' | 'bodies' = 'souls';

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.container = new Container();
    this.container.position.set(0, 0);

    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x070d18, alpha: 0.98 });
    this.container.addChild(bg);

    // Header
    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 70);
    headerBg.fill({ color: 0x0f172a });
    headerBg.stroke({ color: 0x38bdf8, width: 2 });
    this.container.addChild(headerBg);

    const titleText = new Text({
      text: '💻 ALMACÉN DE ALMAS Y CUERPOS (TALLER)',
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 20,
        fontWeight: '900',
        fill: '#38bdf8',
      }),
    });
    titleText.position.set(24, 22);
    this.container.addChild(titleText);

    const closeBtn = this.createButton('✕ SALIR', width - 130, 16, 110, 38, 0xef4444, () => {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.popScene();
    });
    this.container.addChild(closeBtn);

    // Tabs
    const soulsTab = this.createButton('🔮 ALMAS', 24, 80, 150, 36, this.activeTab === 'souls' ? 0x38bdf8 : 0x334155, () => {
      this.activeTab = 'souls';
      GlobalAudioService.playSfx('select');
      this.enter();
    });
    this.container.addChild(soulsTab);

    const bodiesTab = this.createButton('🤖 CUERPOS', 184, 80, 150, 36, this.activeTab === 'bodies' ? 0x10b981 : 0x334155, () => {
      this.activeTab = 'bodies';
      GlobalAudioService.playSfx('select');
      this.enter();
    });
    this.container.addChild(bodiesTab);

    this.container.addChild(this.contentContainer);
    this.renderTab();

    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  private renderTab(): void {
    this.contentContainer.removeChildren();
    const state = GlobalSaveService.getCurrentState();
    if (!state.storage) state.storage = [];
    if (!state.bodies) state.bodies = {};

    if (this.activeTab === 'souls') {
      this.renderSoulsTab(state);
    } else {
      this.renderBodiesTab(state);
    }
  }

  private renderSoulsTab(state: any): void {
    // Active Party Column
    const partyTitle = new Text({
      text: `EQUIPO ACTIVO (${state.party.length}/6):`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: '#22c55e' }),
    });
    partyTitle.position.set(24, 130);
    this.contentContainer.addChild(partyTitle);

    state.party.forEach((c: Souldoll, idx: number) => {
      const species = CREATURES_DATA[c.speciesId];
      const isBound = c.bodyInstanceId !== null;

      const card = new Container();
      card.position.set(24, 155 + idx * 60);

      const bg = new Graphics();
      bg.roundRect(0, 0, 420, 52, 8);
      bg.fill({ color: 0x0f172a });
      bg.stroke({ color: isBound ? 0x22c55e : 0xd97706, width: 2 });
      card.addChild(bg);

      const txt = new Text({
        text: `${species?.name || c.speciesId} (Nv.${c.level}) [${isBound ? 'Vinculada' : 'Sellada'}]`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#ffffff' }),
      });
      txt.position.set(12, 16);
      card.addChild(txt);

      if (state.party.length > 1) {
        const storeBtn = this.createButton('DEPOSITAR ➔', 280, 8, 128, 36, 0x0284c7, () => {
          state.party.splice(idx, 1);
          state.storage.push(c);
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');
          this.renderTab();
        });
        card.addChild(storeBtn);
      }

      this.contentContainer.addChild(card);
    });

    // Soul Storage Column
    const storageTitle = new Text({
      text: `ALMACÉN DE ALMAS (${state.storage.length}):`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: '#38bdf8' }),
    });
    storageTitle.position.set(480, 130);
    this.contentContainer.addChild(storageTitle);

    state.storage.forEach((c: Souldoll, idx: number) => {
      const species = CREATURES_DATA[c.speciesId];
      const isBound = c.bodyInstanceId !== null;

      const card = new Container();
      card.position.set(480, 155 + idx * 60);

      const bg = new Graphics();
      bg.roundRect(0, 0, 440, 52, 8);
      bg.fill({ color: 0x0f172a });
      bg.stroke({ color: 0x38bdf8, width: 2 });
      card.addChild(bg);

      const txt = new Text({
        text: `${species?.name || c.speciesId} (Nv.${c.level}) [${isBound ? 'Vinculada' : 'Sellada'}]`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#ffffff' }),
      });
      txt.position.set(12, 16);
      card.addChild(txt);

      if (state.party.length < 6) {
        const withdrawBtn = this.createButton('⬅ RETIRAR', 300, 8, 128, 36, 0x16a34a, () => {
          state.storage.splice(idx, 1);
          state.party.push(c);
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');
          this.renderTab();
        });
        card.addChild(withdrawBtn);
      }

      this.contentContainer.addChild(card);
    });
  }

  private renderBodiesTab(state: any): void {
    const assignedBodyIds = new Set(
      [...state.party, ...(state.storage || [])]
        .map((s: Souldoll) => s.bodyInstanceId)
        .filter(Boolean)
    );

    const bodiesList: BodyInstance[] = Object.values(state.bodies || {}) as BodyInstance[];

    const title = new Text({
      text: `CUERPOS Y CHASIS REGISTRADOS EN EL ALMACÉN (${bodiesList.length}):`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: '#10b981' }),
    });
    title.position.set(24, 130);
    this.contentContainer.addChild(title);

    bodiesList.forEach((body, idx) => {
      const chassis = BODY_CHASSIS_DATA[body.chassisId];
      const isAssigned = assignedBodyIds.has(body.instanceId);

      const cardY = 160 + idx * 65;
      const card = new Container();
      card.position.set(24, cardY);

      const bg = new Graphics();
      bg.roundRect(0, 0, 900, 56, 8);
      bg.fill({ color: 0x0f172a });
      bg.stroke({ color: isAssigned ? 0x22c55e : 0x10b981, width: 2 });
      card.addChild(bg);

      const txt = new Text({
        text: `🤖 ${chassis?.name || body.chassisId} (Tier ${chassis?.tier || 1}) — [${isAssigned ? 'Asignado a Souldoll' : 'Libre en Inventario'}]`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: '#ffffff' }),
      });
      txt.position.set(16, 18);
      card.addChild(txt);

      this.contentContainer.addChild(card);
    });
  }

  private createButton(label: string, x: number, y: number, w: number, h: number, color: number, onClick: () => void): Container {
    const btn = new Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, w, h, 8);
    bg.fill({ color: 0x0f172a });
    bg.stroke({ color, width: 2 });
    btn.addChild(bg);

    const txt = new Text({
      text: label,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fontWeight: '900', fill: '#ffffff' }),
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

  public update(_dt: number): void {}
  public render(): void {}
  public async exit(): Promise<void> { this.container.destroy({ children: true }); }
}
