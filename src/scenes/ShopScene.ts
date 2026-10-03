import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { ITEMS_DATA } from '../data/items/items';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';

export type ShopCategory = 'bottles' | 'elixirs' | 'bodies' | 'crystals' | 'gear';

export class ShopScene implements IScene {
  public name = 'Shop';
  private container: Container = new Container();
  private moneyText!: Text;
  private itemsContainer: Container = new Container();

  private mode: 'buy' | 'sell' = 'buy';
  private activeCategory: ShopCategory = 'bottles';

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.container = new Container();
    this.container.position.set(0, 0);

    // Dark Background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    this.container.addChild(bg);

    // Header Bar
    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 70);
    headerBg.fill({ color: COLOR_NUM.smokedWood });
    headerBg.stroke({ color: COLOR_NUM.gold, width: 2 });
    this.container.addChild(headerBg);

    const titleText = new Text({
      text: '🏛 MERCADO DE ARTÍFICES',
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

    const saveState = GlobalSaveService.getCurrentState();
    this.moneyText = new Text({
      text: `💸 Monedas: ¥${saveState.player.money}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 15,
        fontWeight: 'bold',
        fill: COLOR_HEX.cyan,
      }),
    });
    this.moneyText.position.set(width - 340, 25);
    this.container.addChild(this.moneyText);

    // Close Button
    const closeBtn = this.createButton('✕ SALIR', width - 130, 16, 110, 38, COLOR_NUM.rift, () => {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.popScene();
    });
    this.container.addChild(closeBtn);

    // Mode & Category Tabs
    this.buildTabs();

    this.container.addChild(this.itemsContainer);
    this.renderList();

    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  private buildTabs(): void {
    const buyBtn = this.createButton(
      '📥 COMPRAR',
      24,
      80,
      130,
      36,
      this.mode === 'buy' ? COLOR_NUM.gold : COLOR_NUM.bronze,
      () => {
        this.mode = 'buy';
        GlobalAudioService.playSfx('select');
        this.enter();
      }
    );
    this.container.addChild(buyBtn);

    const sellBtn = this.createButton(
      '💰 VENDER',
      160,
      80,
      130,
      36,
      this.mode === 'sell' ? COLOR_NUM.gold : COLOR_NUM.bronze,
      () => {
        this.mode = 'sell';
        GlobalAudioService.playSfx('select');
        this.enter();
      }
    );
    this.container.addChild(sellBtn);

    if (this.mode === 'buy') {
      const categories: Array<{ id: ShopCategory; label: string }> = [
        { id: 'bottles', label: '🧪 SOUL BOTTLES' },
        { id: 'elixirs', label: '🍷 ELIXIRES' },
        { id: 'bodies', label: '🤖 CUERPOS' },
        { id: 'crystals', label: '💎 CRISTALES' },
        { id: 'gear', label: '⚔️ RECO/ARMAS' },
      ];

      categories.forEach((cat, idx) => {
        const isSel = cat.id === this.activeCategory;
        const btn = this.createButton(
          cat.label,
          310 + idx * 125,
          80,
          120,
          36,
          isSel ? COLOR_NUM.cyan : COLOR_NUM.bronze,
          () => {
            this.activeCategory = cat.id;
            GlobalAudioService.playSfx('select');
            this.renderList();
          }
        );
        this.container.addChild(btn);
      });
    }
  }

  private renderList(): void {
    this.itemsContainer.removeChildren();
    const saveState = GlobalSaveService.getCurrentState();
    this.moneyText.text = `💸 Monedas: ¥${saveState.player.money}`;

    if (this.mode === 'buy') {
      this.renderBuyList(saveState);
    } else {
      this.renderSellList(saveState);
    }
  }

  private renderBuyList(saveState: any): void {
    let stockItems: Array<{ id: string; name: string; price: number; desc: string; isChassis?: boolean }> = [];

    if (this.activeCategory === 'bottles') {
      stockItems = [
        {
          id: 'soul_bottle_comun',
          name: 'Soul Bottle Común',
          price: 200,
          desc: 'Frasco estándar para resonar con almas salvajes comunes.',
        },
        {
          id: 'soul_bottle_plata',
          name: 'Soul Bottle Plata',
          price: 600,
          desc: 'Frasco plateado con mayor tasa de resonancia de ki.',
        },
        {
          id: 'soul_bottle_oro',
          name: 'Soul Bottle Oro',
          price: 1200,
          desc: 'Frasco de oro óptimo para capturar almas de alta categoría.',
        },
        {
          id: 'soul_bottle_cristal',
          name: 'Soul Bottle Cristal',
          price: 5000,
          desc: 'Frasco cristalino bendecido que atrapa almas al instante sin fallar.',
        },
      ];
    } else if (this.activeCategory === 'elixirs') {
      stockItems = [
        {
          id: 'elixir_ki',
          name: 'Elixir de Ki Pequeño',
          price: 100,
          desc: 'Restaura 20 PS de tus partes de cuerpo activas.',
        },
        {
          id: 'purga_ki',
          name: 'Purga de Ki Corrupto',
          price: 150,
          desc: 'Limpia cualquier estado alterado o corrupto de ki del contenedor.',
        },
        {
          id: 'reencarnacion',
          name: 'Reencarnación del Alma',
          price: 1000,
          desc: 'Restablece el enlace de una Souldoll debilitada con el 50% de sus PS.',
        },
        {
          id: 'repair_kit',
          name: 'Kit de Reparación',
          price: 300,
          desc: 'Restaura instantáneamente una sección destruida (cabeza, torso, extremidades).',
        },
      ];
    } else if (this.activeCategory === 'bodies') {
      stockItems = Object.values(BODY_CHASSIS_DATA).map((chassis) => ({
        id: chassis.id,
        name: chassis.name,
        price: chassis.price,
        desc: `${chassis.description} (Tier ${chassis.tier} physical chassis)`,
        isChassis: true,
      }));
    } else if (this.activeCategory === 'crystals') {
      stockItems = [
        {
          id: 'cristal_fuego',
          name: 'Cristal de Maná (Fuego)',
          price: 400,
          desc: 'Núcleo místico para desatar el ascenso de resonancia ígnea.',
        },
        {
          id: 'cristal_planta',
          name: 'Cristal de Maná (Planta)',
          price: 400,
          desc: 'Núcleo místico para el ascenso de Souldolls de planta.',
        },
        {
          id: 'cristal_agua',
          name: 'Cristal de Maná (Agua)',
          price: 400,
          desc: 'Núcleo místico para el ascenso de Souldolls de agua.',
        },
      ];
    } else if (this.activeCategory === 'gear') {
      stockItems = [
        {
          id: 'baculo_solaria',
          name: 'Báculo Solaria',
          price: 1500,
          desc: 'Reliquia de Archimaga. Incrementa enormemente el Ataque Especial de Fuego.',
        },
        {
          id: 'baculo_gaia',
          name: 'Báculo Gaia',
          price: 1500,
          desc: 'Reliquia de Hierofante. Potencia curas y habilidades de Planta.',
        },
        {
          id: 'martillo_titan',
          name: 'Martillo Titán',
          price: 2000,
          desc: 'Arma pesada de Templario. Otorga gran daño físico contundente de Tierra.',
        },
      ];
    }

    stockItems.forEach((item, idx) => {
      const cardY = 130 + idx * 80;
      const card = new Container();
      card.position.set(24, cardY);

      const bg = new Graphics();
      bg.roundRect(0, 0, 910, 70, 8);
      bg.fill({ color: COLOR_NUM.smokedWood });
      bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
      card.addChild(bg);

      // Inner highlight line
      bg.roundRect(3, 3, 904, 64, 6);
      bg.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.2 });

      const title = new Text({
        text: `${item.name.toUpperCase()} — ¥${item.price}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 15,
          fontWeight: '900',
          fill: COLOR_HEX.gold,
        }),
      });
      title.position.set(16, 12);
      card.addChild(title);

      const desc = new Text({
        text: item.desc,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 12,
          fill: COLOR_HEX.parchment,
        }),
      });
      desc.position.set(16, 40);
      card.addChild(desc);

      const buyBtn = this.createButton(
        '📥 ADQUIRIR',
        740,
        15,
        150,
        40,
        COLOR_NUM.gold,
        () => {
          if (saveState.player.money < item.price) {
            GlobalAudioService.playSfx('cancel');
            return;
          }
          saveState.player.money -= item.price;
          if (item.isChassis) {
            if (!saveState.bodies) saveState.bodies = {};
            const newBody = StatCalculator.createBodyInstance(item.id, item.name);
            saveState.bodies[newBody.instanceId] = newBody;
          } else {
            if (!saveState.inventory) saveState.inventory = {};
            saveState.inventory[item.id] = (saveState.inventory[item.id] || 0) + 1;
          }
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');
          this.renderList();
        }
      );
      card.addChild(buyBtn);

      this.itemsContainer.addChild(card);
    });
  }

  private renderSellList(saveState: any): void {
    const inventory = saveState.inventory || {};
    const entries = Object.entries(inventory).filter(([_, count]) => (count as number) > 0);

    if (entries.length === 0) {
      const emptyText = new Text({
        text: 'No tienes objetos en tu inventario para vender en el gremio.',
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 15,
          fill: COLOR_HEX.smoke,
        }),
      });
      emptyText.position.set(40, 160);
      this.itemsContainer.addChild(emptyText);
      return;
    }

    entries.forEach(([itemId, count], idx) => {
      const itemDef = ITEMS_DATA[itemId];
      const price = Math.floor((itemDef?.price || 100) / 2);

      const cardY = 130 + idx * 80;
      const card = new Container();
      card.position.set(24, cardY);

      const bg = new Graphics();
      bg.roundRect(0, 0, 910, 70, 8);
      bg.fill({ color: COLOR_NUM.smokedWood });
      bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
      card.addChild(bg);

      // Inner highlight line
      bg.roundRect(3, 3, 904, 64, 6);
      bg.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: 0.15 });

      const title = new Text({
        text: `${(itemDef?.name || itemId).toUpperCase()} (x${count}) — Reembolso: ¥${price}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 15,
          fontWeight: '900',
          fill: COLOR_HEX.cyan,
        }),
      });
      title.position.set(16, 12);
      card.addChild(title);

      const sellBtn = this.createButton(
        '💰 COBRAR x1',
        740,
        15,
        150,
        40,
        COLOR_NUM.cyan,
        () => {
          inventory[itemId] = (inventory[itemId] as number) - 1;
          saveState.player.money += price;
          GlobalSaveService.save();
          GlobalAudioService.playSfx('confirm');
          this.renderList();
        }
      );
      card.addChild(sellBtn);

      this.itemsContainer.addChild(card);
    });
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
        fontSize: 11,
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

  public update(_dt: number): void {}
  public render(): void {}
  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
