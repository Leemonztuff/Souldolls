import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { CreatureInstance } from '../types';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { MOVES_DATA } from '../data/moves/moves';
import { ITEMS_DATA } from '../data/items/items';
import { getAbility } from '../data/abilities/abilities';
import { NATURES_DATA } from '../types/natures';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';

export interface CreatureDetailParams {
  creature?: CreatureInstance;
  party?: CreatureInstance[];
  initialIndex?: number;
  onUpdate?: () => void;
}

export class CreatureDetailScene implements IScene {
  public name = 'CreatureDetail';
  private container: Container = new Container();
  private party: CreatureInstance[] = [];
  private currentIndex = 0;
  private onUpdateCallback?: () => void;

  private leftPanel = new Container();
  private rightPanel = new Container();
  private modalContainer: Container | null = null;

  public async enter(params?: CreatureDetailParams): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const state = GlobalSaveService.getCurrentState();
    this.party = params?.party || state.party || [];
    this.currentIndex = params?.initialIndex !== undefined ? params.initialIndex : 0;
    this.onUpdateCallback = params?.onUpdate;

    if (this.party.length === 0 && params?.creature) {
      this.party = [params.creature];
      this.currentIndex = 0;
    }

    this.container = new Container();
    this.container.position.set(0, 0);

    // 1. Dark Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x070d18, alpha: 0.99 });
    this.container.addChild(bg);

    // 2. Header
    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 70);
    headerBg.fill({ color: 0x0f172a });
    headerBg.stroke({ color: 0x38bdf8, width: 2 });
    this.container.addChild(headerBg);

    const titleText = new Text({
      text: '📊 FICHA DE DATOS Y ESTADÍSTICAS (IVs / EVs / NATURALEZA)',
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 18,
        fontWeight: '900',
        fill: '#38bdf8',
      }),
    });
    titleText.position.set(24, 24);
    this.container.addChild(titleText);

    // Close button
    const closeBtn = this.createButton('✕ SALIR', width - 120, 16, 100, 38, 0xef4444, () => {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.popScene();
    });
    this.container.addChild(closeBtn);

    // Party switcher buttons
    if (this.party.length > 1) {
      const prevBtn = this.createButton('◀ ANTERIOR', width - 360, 16, 110, 38, 0x64748b, () => {
        this.switchCreature(-1);
      });
      const nextBtn = this.createButton('SIGUIENTE ▶', width - 240, 16, 110, 38, 0x64748b, () => {
        this.switchCreature(1);
      });
      this.container.addChild(prevBtn);
      this.container.addChild(nextBtn);
    }

    this.container.addChild(this.leftPanel);
    this.container.addChild(this.rightPanel);

    this.renderCreatureView();
    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  private switchCreature(direction: number): void {
    if (this.party.length <= 1) return;
    GlobalAudioService.playSfx('select');
    this.currentIndex = (this.currentIndex + direction + this.party.length) % this.party.length;
    this.renderCreatureView();
  }

  private renderCreatureView(): void {
    this.leftPanel.removeChildren();
    this.rightPanel.removeChildren();

    const c = this.party[this.currentIndex];
    if (!c) return;

    const species = CREATURES_DATA[c.speciesId] || CREATURES_DATA['flamin'];

    // -------------------------------------------------------------
    // LEFT PANEL: SPRITE, IDENTITY, HP/EXP, ABILITY, HELD ITEM, AMISTAD
    // -------------------------------------------------------------
    const leftX = 24;
    const leftY = 85;
    const leftW = 340;
    const leftH = 500;

    const leftBg = new Graphics();
    leftBg.roundRect(0, 0, leftW, leftH, 12);
    leftBg.fill({ color: 0x0f172a, alpha: 0.95 });
    leftBg.stroke({ color: 0x1e293b, width: 2 });
    this.leftPanel.addChild(leftBg);
    this.leftPanel.position.set(leftX, leftY);

    // Sprite preview box
    const spriteBox = new Graphics();
    spriteBox.roundRect(16, 16, 110, 110, 8);
    spriteBox.fill({ color: 0x1e293b });
    spriteBox.stroke({ color: 0x334155, width: 1 });
    this.leftPanel.addChild(spriteBox);

    const tex = GlobalAssetRegistry.getCreatureFrontPixi(species.id);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.scale.set(1.2);
    sprite.position.set(71, 71);
    this.leftPanel.addChild(sprite);

    // Name & Nickname & Dex #
    const nameText = new Text({
      text: c.nickname && c.nickname !== species.name ? `${c.nickname} (${species.name})` : species.name,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 16, fontWeight: '900', fill: '#ffffff' }),
    });
    nameText.position.set(136, 16);
    this.leftPanel.addChild(nameText);

    const dexText = new Text({
      text: `N.º ${species.dexNumber.toString().padStart(3, '0')}  ·  Nv. ${c.level}`,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 13, fontWeight: 'bold', fill: '#94a3b8' }),
    });
    dexText.position.set(136, 40);
    this.leftPanel.addChild(dexText);

    // Types
    species.types.forEach((type, idx) => {
      const typeBadge = this.createTypeBadge(type, 136 + idx * 75, 68);
      this.leftPanel.addChild(typeBadge);
    });

    // HP Bar
    const hpLabel = new Text({
      text: `PS: ${c.currentHp} / ${c.maxHp}`,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fontWeight: 'bold', fill: '#38bdf8' }),
    });
    hpLabel.position.set(16, 136);
    this.leftPanel.addChild(hpLabel);

    const hpBarBg = new Graphics();
    hpBarBg.roundRect(16, 154, 308, 10, 5);
    hpBarBg.fill({ color: 0x334155 });
    this.leftPanel.addChild(hpBarBg);

    const hpRatio = Math.max(0, Math.min(1, c.currentHp / c.maxHp));
    const hpBar = new Graphics();
    hpBar.roundRect(16, 154, 308 * hpRatio, 10, 5);
    hpBar.fill({ color: hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.2 ? 0xeab308 : 0xef4444 });
    this.leftPanel.addChild(hpBar);

    // Friendship Hearts
    const friendshipVal = c.friendship !== undefined ? c.friendship : 70;
    const heartsCount = Math.floor((friendshipVal / 255) * 5);
    const heartsStr = '❤️'.repeat(heartsCount) + '🤍'.repeat(5 - heartsCount);

    const friendLabel = new Text({
      text: `Vínculo de Amistad: ${friendshipVal}/255  ${heartsStr}`,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fontWeight: 'bold', fill: '#f472b6' }),
    });
    friendLabel.position.set(16, 175);
    this.leftPanel.addChild(friendLabel);

    // Passive Ability Box
    const abilityId = c.abilityId || species.abilityId || 'mar_llamas';
    const abilityDef = getAbility(abilityId);

    const abilityBox = new Graphics();
    abilityBox.roundRect(16, 206, 308, 90, 8);
    abilityBox.fill({ color: 0x1e293b, alpha: 0.9 });
    abilityBox.stroke({ color: 0x3b82f6, width: 1.5 });
    this.leftPanel.addChild(abilityBox);

    const abilityTitle = new Text({
      text: `✨ HABILIDAD: ${abilityDef?.name || 'Ninguna'}`,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 13, fontWeight: '900', fill: '#60a5fa' }),
    });
    abilityTitle.position.set(26, 214);
    this.leftPanel.addChild(abilityTitle);

    const abilityDesc = new Text({
      text: abilityDef?.description || 'Sin efecto pasivo registrado.',
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 11,
        fill: '#cbd5e1',
        wordWrap: true,
        wordWrapWidth: 288,
        lineHeight: 15,
      }),
    });
    abilityDesc.position.set(26, 236);
    this.leftPanel.addChild(abilityDesc);

    // Held Item Box & Management
    const heldItemBox = new Graphics();
    heldItemBox.roundRect(16, 310, 308, 70, 8);
    heldItemBox.fill({ color: 0x1e293b, alpha: 0.9 });
    heldItemBox.stroke({ color: 0x10b981, width: 1.5 });
    this.leftPanel.addChild(heldItemBox);

    const heldItemTitle = new Text({
      text: '🎒 OBJETO EQUIPADO:',
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fontWeight: '900', fill: '#34d399' }),
    });
    heldItemTitle.position.set(26, 316);
    this.leftPanel.addChild(heldItemTitle);

    const itemDef = c.heldItemId ? ITEMS_DATA[c.heldItemId] : null;
    const itemDescText = new Text({
      text: itemDef ? `${itemDef.name}: ${itemDef.description}` : 'Sin objeto equipado (Reliquia / Arma).',
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 10,
        fill: '#e2e8f0',
        wordWrap: true,
        wordWrapWidth: 288,
        lineHeight: 13,
      }),
    });
    itemDescText.position.set(26, 334);
    this.leftPanel.addChild(itemDescText);

    // Equip / Unequip buttons
    const equipBtn = this.createButton('📦 EQUIPAR', 16, 386, 145, 30, 0x10b981, () => {
      this.openItemPickerModal(c);
    });
    this.leftPanel.addChild(equipBtn);

    const unequipBtn = this.createButton('DESEQUIPAR', 179, 386, 145, 30, 0x64748b, () => {
      this.handleUnequipItem(c);
    });
    this.leftPanel.addChild(unequipBtn);

    // Chassis & Part Life Silhouette Card (Bloque 18)
    const chassisBox = new Graphics();
    chassisBox.roundRect(16, 422, 308, 92, 8);
    chassisBox.fill({ color: 0x1e293b, alpha: 0.95 });
    chassisBox.stroke({ color: 0x38bdf8, width: 1.5 });
    this.leftPanel.addChild(chassisBox);

    // Mini Silhouette
    const sil = new HumanoidPartSilhouette();
    sil.position.set(26, 432);
    sil.scale.set(0.85);
    const partHp = c.partHP || { head: 15, torso: 40, arms: 20, legs: 25 };
    const partMax = c.maxPartHP || { head: 15, torso: 40, arms: 20, legs: 25 };
    sil.updateParts(partHp, partMax);
    this.leftPanel.addChild(sil);

    // Quality stars calculation from IVs
    const ivsObj = c.ivs || { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, speed: 15 };
    const totalIv = Object.values(ivsObj).reduce((a, b) => a + b, 0);
    const starCount = Math.min(5, Math.max(1, Math.ceil((totalIv / 186) * 5)));
    const starsStr = '⭐'.repeat(starCount);

    const chassisTitle = new Text({
      text: `🤖 CHASIS ${starsStr}`,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fontWeight: '900', fill: '#38bdf8' }),
    });
    chassisTitle.position.set(80, 428);
    this.leftPanel.addChild(chassisTitle);

    const partsDetailText = new Text({
      text: `Cab: ${partHp.head}/${partMax.head} · Tor: ${partHp.torso}/${partMax.torso}\nBra: ${partHp.arms}/${partMax.arms} · Pie: ${partHp.legs}/${partMax.legs}\nRanuras: Arma [${c.heldItemId ? '✓' : '—'}] Reliquia [${c.heldItemId ? '✓' : '—'}]`,
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 10,
        fontWeight: 'bold',
        fill: '#cbd5e1',
        lineHeight: 14,
      }),
    });
    partsDetailText.position.set(80, 448);
    this.leftPanel.addChild(partsDetailText);

    // -------------------------------------------------------------
    // RIGHT PANEL: NATURES, STATS (BASE, IV, EV, TOTAL), MOVES
    // -------------------------------------------------------------
    const rightX = 380;
    const rightY = 85;
    const rightW = 396;
    const rightH = 500;

    const rightBg = new Graphics();
    rightBg.roundRect(0, 0, rightW, rightH, 12);
    rightBg.fill({ color: 0x0f172a, alpha: 0.95 });
    rightBg.stroke({ color: 0x1e293b, width: 2 });
    this.rightPanel.addChild(rightBg);
    this.rightPanel.position.set(rightX, rightY);

    // Nature Display
    const nature = c.nature || 'docil';
    const natureMod = NATURES_DATA[nature];
    let natureDesc = 'Naturaleza neutra (sin alteraciones).';
    if (natureMod.increasedStat && natureMod.decreasedStat) {
      natureDesc = `+10% ${this.statNameToSpanish(natureMod.increasedStat)}  ·  -10% ${this.statNameToSpanish(natureMod.decreasedStat)}`;
    }

    const natureBox = new Graphics();
    natureBox.roundRect(16, 16, 364, 48, 8);
    natureBox.fill({ color: 0x1e293b });
    natureBox.stroke({ color: 0xf59e0b, width: 1.5 });
    this.rightPanel.addChild(natureBox);

    const natureTitle = new Text({
      text: `🧬 NATURALEZA: ${nature.toUpperCase()}`,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 13, fontWeight: '900', fill: '#fbbf24' }),
    });
    natureTitle.position.set(26, 22);
    this.rightPanel.addChild(natureTitle);

    const natureSub = new Text({
      text: natureDesc,
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 11, fontWeight: 'bold', fill: '#cbd5e1' }),
    });
    natureSub.position.set(26, 42);
    this.rightPanel.addChild(natureSub);

    // Stats Table Header
    const statHeaderBg = new Graphics();
    statHeaderBg.roundRect(16, 72, 364, 26, 4);
    statHeaderBg.fill({ color: 0x1e293b });
    this.rightPanel.addChild(statHeaderBg);

    const statHeader = new Text({
      text: 'ESTADÍSTICA       BASE    IV (0-31)   EV (0-252)   TOTAL',
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 11, fontWeight: 'bold', fill: '#94a3b8' }),
    });
    statHeader.position.set(24, 78);
    this.rightPanel.addChild(statHeader);

    const statsList: Array<{ id: 'hp' | 'atk' | 'def' | 'spAtk' | 'spDef' | 'speed'; label: string }> = [
      { id: 'hp', label: 'PS (Puntos Salud)' },
      { id: 'atk', label: 'Ataque Físico' },
      { id: 'def', label: 'Defensa Física' },
      { id: 'spAtk', label: 'Ataque Especial' },
      { id: 'spDef', label: 'Defensa Especial' },
      { id: 'speed', label: 'Velocidad' },
    ];

    const ivs = c.ivs || { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, speed: 15 };
    const evs = c.evs || { hp: 0, atk: 0, def: 0, spAtk: 0, spDef: 0, speed: 0 };

    statsList.forEach((st, idx) => {
      const rowY = 104 + idx * 24;
      const isIncreased = natureMod.increasedStat === st.id;
      const isDecreased = natureMod.decreasedStat === st.id;

      let statColor = '#ffffff';
      let modTag = '';
      if (isIncreased) {
        statColor = '#4ade80';
        modTag = ' ▲';
      } else if (isDecreased) {
        statColor = '#f87171';
        modTag = ' ▼';
      }

      const rowText = new Text({
        text: `${st.label.padEnd(16, ' ')} ${species.baseStats[st.id].toString().padStart(4, ' ')}       ${ivs[st.id].toString().padStart(2, ' ')}/31        ${evs[st.id].toString().padStart(3, ' ')}/252    ${c.stats[st.id].toString().padStart(4, ' ')}${modTag}`,
        style: new TextStyle({
          fontFamily: 'monospace, system-ui',
          fontSize: 11,
          fontWeight: isIncreased || isDecreased ? '900' : 'normal',
          fill: statColor,
        }),
      });
      rowText.position.set(24, rowY);
      this.rightPanel.addChild(rowText);
    });

    // Moves Section
    const movesHeader = new Text({
      text: '⚔️ MOVIMIENTOS APRENDIDOS (4 MÁX.):',
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 13, fontWeight: '900', fill: '#38bdf8' }),
    });
    movesHeader.position.set(16, 255);
    this.rightPanel.addChild(movesHeader);

    c.moves.forEach((m, idx) => {
      const def = MOVES_DATA[m.moveId];
      if (!def) return;

      const moveBoxY = 278 + idx * 52;
      const moveBox = new Graphics();
      moveBox.roundRect(16, moveBoxY, 364, 46, 6);
      moveBox.fill({ color: 0x1e293b, alpha: 0.9 });
      moveBox.stroke({ color: 0x334155, width: 1 });
      this.rightPanel.addChild(moveBox);

      const mName = new Text({
        text: def.name,
        style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fontWeight: '900', fill: '#ffffff' }),
      });
      mName.position.set(26, moveBoxY + 8);
      this.rightPanel.addChild(mName);

      const typeBadge = this.createTypeBadge(def.type, 26, moveBoxY + 25);
      this.rightPanel.addChild(typeBadge);

      const catText = new Text({
        text: def.category === 'physical' ? 'FÍSICO' : def.category === 'special' ? 'ESPECIAL' : 'ESTADO',
        style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }),
      });
      catText.position.set(110, moveBoxY + 28);
      this.rightPanel.addChild(catText);

      const powerAcc = new Text({
        text: `Pot: ${def.power > 0 ? def.power : '—'}   Prec: ${def.accuracy ? def.accuracy + '%' : '—'}   PP: ${m.currentPp}/${m.maxPp}`,
        style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 11, fontWeight: 'bold', fill: '#e2e8f0' }),
      });
      powerAcc.position.set(210, moveBoxY + 16);
      this.rightPanel.addChild(powerAcc);
    });
  }

  private handleUnequipItem(c: CreatureInstance): void {
    if (!c.heldItemId) {
      GlobalAudioService.playSfx('select');
      return;
    }
    const state = GlobalSaveService.getCurrentState();
    const itemId = c.heldItemId;
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    c.heldItemId = null;
    GlobalSaveService.save();
    GlobalAudioService.playSfx('confirm');
    this.renderCreatureView();
    if (this.onUpdateCallback) this.onUpdateCallback();
  }

  private openItemPickerModal(c: CreatureInstance): void {
    if (this.modalContainer) {
      this.modalContainer.destroy({ children: true });
      this.modalContainer = null;
    }

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.modalContainer = new Container();
    this.modalContainer.position.set(0, 0);

    const scrim = new Graphics();
    scrim.rect(0, 0, width, height);
    scrim.fill({ color: 0x000000, alpha: 0.75 });
    scrim.eventMode = 'static';
    this.modalContainer.addChild(scrim);

    const modalBox = new Graphics();
    modalBox.roundRect(width / 2 - 200, height / 2 - 180, 400, 360, 12);
    modalBox.fill({ color: 0x0f172a });
    modalBox.stroke({ color: 0x10b981, width: 2 });
    this.modalContainer.addChild(modalBox);

    const modalTitle = new Text({
      text: '🎒 SELECCIONAR OBJETO PARA EQUIPAR',
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 14, fontWeight: '900', fill: '#34d399' }),
    });
    modalTitle.position.set(width / 2 - 180, height / 2 - 160);
    this.modalContainer.addChild(modalTitle);

    const state = GlobalSaveService.getCurrentState();
    const equipableItems = Object.keys(state.inventory || {}).filter((id) => {
      const count = state.inventory[id] || 0;
      const def = ITEMS_DATA[id];
      return count > 0 && def && (def.category === 'relic' || def.category === 'weapon' || def.category === 'crystal');
    });

    if (equipableItems.length === 0) {
      const emptyText = new Text({
        text: 'No tienes objetos equipables (reliquias, armas, cristales de maná) en el inventario.',
        style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 12, fill: '#94a3b8', wordWrap: true, wordWrapWidth: 360 }),
      });
      emptyText.position.set(width / 2 - 180, height / 2 - 100);
      this.modalContainer.addChild(emptyText);
    } else {
      equipableItems.forEach((itemId, idx) => {
        const def = ITEMS_DATA[itemId];
        const count = state.inventory[itemId];
        const btnY = height / 2 - 110 + idx * 46;

        const btn = this.createButton(`${def.name} (x${count})`, width / 2 - 180, btnY, 360, 38, 0x10b981, () => {
          // If already has item, return to bag
          if (c.heldItemId) {
            state.inventory[c.heldItemId] = (state.inventory[c.heldItemId] || 0) + 1;
          }
          state.inventory[itemId] = Math.max(0, count - 1);
          c.heldItemId = itemId;
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');

          if (this.modalContainer) {
            this.modalContainer.destroy({ children: true });
            this.modalContainer = null;
          }
          this.renderCreatureView();
          if (this.onUpdateCallback) this.onUpdateCallback();
        });
        this.modalContainer!.addChild(btn);
      });
    }

    const cancelBtn = this.createButton('CANCELAR', width / 2 - 70, height / 2 + 130, 140, 36, 0xef4444, () => {
      GlobalAudioService.playSfx('select');
      if (this.modalContainer) {
        this.modalContainer.destroy({ children: true });
        this.modalContainer = null;
      }
    });
    this.modalContainer.addChild(cancelBtn);

    this.container.addChild(this.modalContainer);
  }

  private statNameToSpanish(stat: string): string {
    switch (stat) {
      case 'atk': return 'Ataque';
      case 'def': return 'Defensa';
      case 'spAtk': return 'Atq. Esp.';
      case 'spDef': return 'Def. Esp.';
      case 'speed': return 'Velocidad';
      default: return stat;
    }
  }

  private createTypeBadge(type: string, x: number, y: number): Container {
    const badge = new Container();
    badge.position.set(x, y);

    const typeColors: Record<string, number> = {
      Normal: 0x94a3b8,
      Fuego: 0xf97316,
      Agua: 0x38bdf8,
      Planta: 0x22c55e,
      Eléctrico: 0xfacc15,
      Tierra: 0xb45309,
      Sombra: 0x7e22ce,
      Hielo: 0x67e8f9,
      Volador: 0x60a5fa,
      Hada: 0xf472b6,
    };

    const color = typeColors[type] || 0x64748b;

    const bg = new Graphics();
    bg.roundRect(0, 0, 68, 18, 4);
    bg.fill({ color });
    badge.addChild(bg);

    const txt = new Text({
      text: type.toUpperCase(),
      style: new TextStyle({ fontFamily: 'monospace, system-ui', fontSize: 10, fontWeight: '900', fill: '#0f172a' }),
    });
    txt.anchor.set(0.5);
    txt.position.set(34, 9);
    badge.addChild(txt);

    return badge;
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

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
