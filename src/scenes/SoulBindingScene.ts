import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { Souldoll } from '../types/souldolls';
import { BodyInstance } from '../types/bodies';

export class SoulBindingScene implements IScene {
  public name = 'SoulBinding';
  private container: Container = new Container();
  private leftListContainer: Container = new Container();
  private rightListContainer: Container = new Container();
  private previewContainer: Container = new Container();

  private selectedSoulIndex = 0;
  private selectedBodyId: string | null = null;
  private mode: 'bind' | 'unbind' = 'bind';

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.container = new Container();
    this.container.position.set(0, 0);

    // Dark Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x070d18, alpha: 0.98 });
    this.container.addChild(bg);

    // Header Bar
    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 70);
    headerBg.fill({ color: 0x0f172a });
    headerBg.stroke({ color: 0x38bdf8, width: 2 });
    this.container.addChild(headerBg);

    const titleText = new Text({
      text: '🔗 VINCULAR ALMA Y CUERPO (TALLER DE ARTÍFICES)',
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 20,
        fontWeight: '900',
        fill: '#38bdf8',
      }),
    });
    titleText.position.set(24, 22);
    this.container.addChild(titleText);

    // Close Button
    const closeBtn = this.createButton('✕ SALIR', width - 130, 16, 110, 38, 0xef4444, () => {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.popScene();
    });
    this.container.addChild(closeBtn);

    // Tabs: Bind vs Unbind
    const bindTabBtn = this.createButton('🔗 VINCULAR ALMA', 24, 80, 180, 36, this.mode === 'bind' ? 0x38bdf8 : 0x334155, () => {
      this.mode = 'bind';
      GlobalAudioService.playSfx('select');
      this.renderUI();
    });
    this.container.addChild(bindTabBtn);

    const unbindTabBtn = this.createButton('✂️ DESVINCULAR ALMA', 214, 80, 180, 36, this.mode === 'unbind' ? 0xef4444 : 0x334155, () => {
      this.mode = 'unbind';
      GlobalAudioService.playSfx('select');
      this.renderUI();
    });
    this.container.addChild(unbindTabBtn);

    this.container.addChild(this.leftListContainer);
    this.container.addChild(this.rightListContainer);
    this.container.addChild(this.previewContainer);

    this.renderUI();
    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  private renderUI(): void {
    this.leftListContainer.removeChildren();
    this.rightListContainer.removeChildren();
    this.previewContainer.removeChildren();

    const state = GlobalSaveService.getCurrentState();
    if (!state.bodies) state.bodies = {};

    if (this.mode === 'bind') {
      this.renderBindMode(state);
    } else {
      this.renderUnbindMode(state);
    }
  }

  private renderBindMode(state: any): void {
    // Sealed souls (bodyInstanceId === null) in storage or party
    const sealedSouls: Souldoll[] = [
      ...state.party.filter((s: Souldoll) => s.bodyInstanceId === null),
      ...(state.storage || []).filter((s: Souldoll) => s.bodyInstanceId === null),
    ];

    // Unassigned bodies in state.bodies
    const assignedBodyIds = new Set(
      [...state.party, ...(state.storage || [])]
        .map((s: Souldoll) => s.bodyInstanceId)
        .filter(Boolean)
    );

    const availableBodies: BodyInstance[] = Object.values(state.bodies || {}).filter(
      (b: any) => !assignedBodyIds.has(b.instanceId)
    ) as BodyInstance[];

    // 1. Left: Sealed Souls List
    const soulHeader = new Text({
      text: `1. SELECCIONAR ALMA SELLADA (${sealedSouls.length}):`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#38bdf8' }),
    });
    soulHeader.position.set(24, 130);
    this.leftListContainer.addChild(soulHeader);

    if (sealedSouls.length === 0) {
      const emptyTxt = new Text({
        text: 'No tienes Almas selladas sin cuerpo. Captura almas con Soul Bottles.',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fill: '#94a3b8', wordWrap: true, wordWrapWidth: 280 }),
      });
      emptyTxt.position.set(24, 160);
      this.leftListContainer.addChild(emptyTxt);
    } else {
      sealedSouls.forEach((soul, idx) => {
        const isSel = idx === this.selectedSoulIndex;
        const species = CREATURES_DATA[soul.speciesId];

        const btn = new Container();
        btn.position.set(24, 160 + idx * 56);
        btn.eventMode = 'static';
        btn.cursor = 'pointer';

        const bg = new Graphics();
        bg.roundRect(0, 0, 280, 48, 8);
        bg.fill({ color: isSel ? 0x0284c7 : 0x0f172a });
        bg.stroke({ color: isSel ? 0xffffff : 0x38bdf8, width: 2 });
        btn.addChild(bg);

        const txt = new Text({
          text: `🔮 ${species?.name || soul.speciesId} (Nv.${soul.level})`,
          style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#ffffff' }),
        });
        txt.position.set(12, 14);
        btn.addChild(txt);

        btn.on('pointerdown', () => {
          this.selectedSoulIndex = idx;
          GlobalAudioService.playSfx('select');
          this.renderUI();
        });

        this.leftListContainer.addChild(btn);
      });
    }

    // 2. Middle: Available Bodies List
    const bodyHeader = new Text({
      text: `2. SELECCIONAR CUERPO LIBRE (${availableBodies.length}):`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#38bdf8' }),
    });
    bodyHeader.position.set(330, 130);
    this.rightListContainer.addChild(bodyHeader);

    if (availableBodies.length === 0) {
      const emptyTxt = new Text({
        text: 'No tienes Cuerpos libres en el inventario. Consigue botín o compra en el Mercado.',
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fill: '#94a3b8', wordWrap: true, wordWrapWidth: 280 }),
      });
      emptyTxt.position.set(330, 160);
      this.rightListContainer.addChild(emptyTxt);
    } else {
      availableBodies.forEach((body, idx) => {
        const isSel = body.instanceId === this.selectedBodyId;
        const chassis = BODY_CHASSIS_DATA[body.chassisId];

        const btn = new Container();
        btn.position.set(330, 160 + idx * 56);
        btn.eventMode = 'static';
        btn.cursor = 'pointer';

        const bg = new Graphics();
        bg.roundRect(0, 0, 280, 48, 8);
        bg.fill({ color: isSel ? 0x16a34a : 0x0f172a });
        bg.stroke({ color: isSel ? 0xffffff : 0x10b981, width: 2 });
        btn.addChild(bg);

        const txt = new Text({
          text: `🤖 ${chassis?.name || body.chassisId} (T${chassis?.tier || 1})`,
          style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#ffffff' }),
        });
        txt.position.set(12, 14);
        btn.addChild(txt);

        btn.on('pointerdown', () => {
          this.selectedBodyId = body.instanceId;
          GlobalAudioService.playSfx('select');
          this.renderUI();
        });

        this.rightListContainer.addChild(btn);
      });
    }

    // 3. Right: Preview & Action
    const selectedSoul = sealedSouls[this.selectedSoulIndex];
    const selectedBody = availableBodies.find((b) => b.instanceId === this.selectedBodyId);

    if (selectedSoul && selectedBody) {
      this.renderBindPreview(selectedSoul, selectedBody);
    }
  }

  private renderBindPreview(soul: Souldoll, body: BodyInstance): void {
    const species = CREATURES_DATA[soul.speciesId];
    const chassis = BODY_CHASSIS_DATA[body.chassisId];
    if (!species || !chassis) return;

    const previewX = 640;
    const previewY = 130;

    const bg = new Graphics();
    bg.roundRect(previewX, previewY, 290, 520, 10);
    bg.fill({ color: 0x0f172a, alpha: 0.95 });
    bg.stroke({ color: 0x38bdf8, width: 2 });
    this.previewContainer.addChild(bg);

    const title = new Text({
      text: '📋 VISTA PREVIA DE VINCULACIÓN',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: '900', fill: '#38bdf8' }),
    });
    title.position.set(previewX + 16, previewY + 16);
    this.previewContainer.addChild(title);

    // Compatibility check
    const isCompatible = (species.bodyRequirement?.minTier || 1) <= chassis.tier;
    const compatText = new Text({
      text: isCompatible ? '✅ COMPATIBLE' : '❌ TIER INSUFICIENTE',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', fill: isCompatible ? '#4ade80' : '#ef4444' }),
    });
    compatText.position.set(previewX + 16, previewY + 44);
    this.previewContainer.addChild(compatText);

    // Mini Silhouette Preview
    const tempDoll = StatCalculator.createSouldoll(soul.speciesId, soul.level, body.chassisId, soul.nickname);
    const sil = new HumanoidPartSilhouette();
    sil.position.set(previewX + 20, previewY + 75);
    sil.scale.set(0.9);
    sil.updateParts(tempDoll.partHP, tempDoll.maxPartHP);
    this.previewContainer.addChild(sil);

    const partsInfo = new Text({
      text: `Reparto de Vida (T${chassis.tier}):\n• Cabeza: ${tempDoll.maxPartHP.head} PS\n• Torso: ${tempDoll.maxPartHP.torso} PS\n• Brazos: ${tempDoll.maxPartHP.arms} PS\n• Piernas: ${tempDoll.maxPartHP.legs} PS\nTotal Max HP: ${tempDoll.maxHp} PS`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fill: '#cbd5e1', lineHeight: 16 }),
    });
    partsInfo.position.set(previewX + 80, previewY + 75);
    this.previewContainer.addChild(partsInfo);

    // Confirm Bind Button
    const bindBtn = this.createButton('🔗 VINCULAR AHORA', previewX + 16, previewY + 450, 258, 44, isCompatible ? 0x16a34a : 0x475569, () => {
      if (!isCompatible) {
        GlobalAudioService.playSfx('cancel');
        return;
      }
      this.executeBind(soul, body);
    });
    this.previewContainer.addChild(bindBtn);
  }

  private executeBind(soul: Souldoll, body: BodyInstance): void {
    const state = GlobalSaveService.getCurrentState();
    
    // Assign body instance
    soul.bodyInstanceId = body.instanceId;
    
    // Recalculate stats & parts
    const updated = StatCalculator.createSouldoll(soul.speciesId, soul.level, body.chassisId, soul.nickname);
    soul.maxHp = updated.maxHp;
    soul.currentHp = updated.maxHp;
    soul.partHP = { ...updated.maxPartHP };
    soul.maxPartHP = { ...updated.maxPartHP };

    // Move to party if room
    if (state.party.length < 6 && !state.party.some((s: Souldoll) => s.uid === soul.uid)) {
      state.party.push(soul);
      state.storage = (state.storage || []).filter((s: Souldoll) => s.uid !== soul.uid);
    }

    GlobalSaveService.save();
    GlobalAudioService.playSfx('levelUp');
    this.selectedBodyId = null;
    this.renderUI();
  }

  private renderUnbindMode(state: any): void {
    const boundSouls: Souldoll[] = [
      ...state.party.filter((s: Souldoll) => s.bodyInstanceId !== null),
      ...(state.storage || []).filter((s: Souldoll) => s.bodyInstanceId !== null),
    ];

    const title = new Text({
      text: `DESVINCULAR ALMAS DE SU CUERPO (${boundSouls.length}):`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#ef4444' }),
    });
    title.position.set(24, 130);
    this.leftListContainer.addChild(title);

    boundSouls.forEach((soul, idx) => {
      const species = CREATURES_DATA[soul.speciesId];
      const btn = new Container();
      btn.position.set(24, 160 + idx * 56);

      const bg = new Graphics();
      bg.roundRect(0, 0, 480, 48, 8);
      bg.fill({ color: 0x0f172a });
      bg.stroke({ color: 0xef4444, width: 2 });
      btn.addChild(bg);

      const txt = new Text({
        text: `🔮 ${species?.name || soul.speciesId} (Nv.${soul.level}) — Vinculado a Chasis`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', fill: '#ffffff' }),
      });
      txt.position.set(12, 14);
      btn.addChild(txt);

      const unbindBtn = this.createButton('✂️ DESVINCULAR', 340, 6, 128, 36, 0xef4444, () => {
        soul.bodyInstanceId = null;
        GlobalSaveService.save();
        GlobalAudioService.playSfx('confirm');
        this.renderUI();
      });
      btn.addChild(unbindBtn);

      this.leftListContainer.addChild(btn);
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
