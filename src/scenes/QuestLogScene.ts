import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalQuestSystem } from '../systems/quest/QuestSystem';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { QuestData, QuestProgressState } from '../types/quests';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';

export class QuestLogScene implements IScene {
  public name = 'QuestLog';
  public isTransparentOverlay = true;

  private container: Container = new Container();
  private listContainer: Container = new Container();
  private detailContainer: Container = new Container();

  private questsWithState: Array<{ data: QuestData; state: QuestProgressState }> = [];
  private selectedIndex = 0;

  public async enter(): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    this.questsWithState = GlobalQuestSystem.getAllQuestsWithStatus();
    this.buildUI();
    GlobalAudioService.playSfx('confirm');
  }

  private buildUI(): void {
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Dark backdrop
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    bg.eventMode = 'static';
    this.container.addChild(bg);

    // 1. Header Bar (Large & Highly Legible)
    const header = new Container();
    header.position.set(0, 0);

    const headerBg = new Graphics();
    headerBg.rect(0, 0, width, 68);
    headerBg.fill({ color: COLOR_NUM.smokedWood });
    headerBg.stroke({ color: COLOR_NUM.gold, width: 2.5 });
    header.addChild(headerBg);

    const titleText = new Text({
      text: '📜 DIARIO DE MISIONES',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 24,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
        letterSpacing: 2,
      }),
    });
    titleText.position.set(24, 18);
    header.addChild(titleText);

    // Close Button (Big & Touch-Friendly)
    const closeBtn = new Container();
    closeBtn.position.set(width - 160, 10);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';

    const closeBg = new Graphics();
    closeBg.roundRect(0, 0, 140, 48, 8);
    closeBg.fill({ color: COLOR_NUM.rift });
    closeBg.stroke({ color: COLOR_NUM.gold, width: 2 });
    closeBtn.addChild(closeBg);

    // Inner highlight line
    closeBg.roundRect(2, 2, 136, 44, 6);
    closeBg.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: 0.2 });

    const closeTxt = new Text({
      text: '✕ CERRAR',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.white,
      }),
    });
    closeTxt.anchor.set(0.5);
    closeTxt.position.set(70, 24);
    closeBtn.addChild(closeTxt);

    closeBtn.on('pointerdown', () => this.close());
    header.addChild(closeBtn);

    this.container.addChild(header);

    // 2. Left Column: Quest List (Width 360)
    this.listContainer = new Container();
    this.listContainer.position.set(20, 84);
    this.container.addChild(this.listContainer);

    // 3. Right Column: Detailed View (Width 540)
    this.detailContainer = new Container();
    this.detailContainer.position.set(400, 84);
    this.container.addChild(this.detailContainer);

    this.renderQuestList();
    this.renderQuestDetails();
  }

  private renderQuestList(): void {
    this.listContainer.removeChildren();
    const itemHeight = 92;
    const itemWidth = 360;

    if (this.questsWithState.length === 0) {
      const emptyText = new Text({
        text: 'No hay misiones registradas aún.',
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 18,
          fill: COLOR_HEX.smoke,
        }),
      });
      this.listContainer.addChild(emptyText);
      return;
    }

    this.questsWithState.forEach(({ data, state }, idx) => {
      const isSelected = idx === this.selectedIndex;
      const card = new Container();
      card.position.set(0, idx * (itemHeight + 10));
      card.eventMode = 'static';
      card.cursor = 'pointer';

      const bg = new Graphics();
      bg.roundRect(0, 0, itemWidth, itemHeight, 10);

      let borderColor = COLOR_NUM.bronze;
      let statusBadgeColor = COLOR_NUM.smokedWood;
      let statusLabel = 'BLOQUEADA';

      if (state.status === 'active') {
        borderColor = isSelected ? COLOR_NUM.cyan : COLOR_NUM.bronze;
        statusBadgeColor = COLOR_NUM.smokedWood;
        statusLabel = 'ACTIVA';
      } else if (state.status === 'completable') {
        borderColor = isSelected ? COLOR_NUM.gold : COLOR_NUM.bronze;
        statusBadgeColor = COLOR_NUM.gold;
        statusLabel = 'COMPLETABLE';
      } else if (state.status === 'completed') {
        borderColor = isSelected ? COLOR_SEMANTIC.ok : COLOR_NUM.bronze;
        statusBadgeColor = COLOR_SEMANTIC.ok;
        statusLabel = 'COMPLETADA';
      } else if (state.status === 'available') {
        borderColor = isSelected ? COLOR_NUM.soulViolet : COLOR_NUM.bronze;
        statusBadgeColor = COLOR_NUM.soulViolet;
        statusLabel = 'DISPONIBLE';
      }

      bg.fill({ color: isSelected ? COLOR_NUM.smokedWood : COLOR_NUM.inkCrypt, alpha: 0.95 });
      bg.stroke({ color: isSelected ? COLOR_NUM.gold : borderColor, width: isSelected ? 3 : 1.5 });
      card.addChild(bg);

      // Inner hairline
      bg.roundRect(3, 3, itemWidth - 6, itemHeight - 6, 8);
      bg.stroke({ color: COLOR_NUM.white, width: 0.5, alpha: 0.1 });

      // Status Tag Badge
      const badge = new Graphics();
      badge.roundRect(itemWidth - 140, 10, 130, 28, 6);
      badge.fill({ color: statusBadgeColor, alpha: 0.85 });
      badge.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.3 });
      card.addChild(badge);

      const badgeTxt = new Text({
        text: statusLabel,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 11,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
        }),
      });
      badgeTxt.anchor.set(0.5);
      badgeTxt.position.set(itemWidth - 75, 24);
      card.addChild(badgeTxt);

      // Quest Title (Big & Bold)
      const catPrefix = data.category === 'main' ? '★ ' : '◇ ';
      const titleTxt = new Text({
        text: `${catPrefix}${data.title}`,
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 16,
          fontWeight: '900',
          fill: isSelected ? COLOR_HEX.gold : COLOR_HEX.parchment,
          wordWrap: true,
          wordWrapWidth: itemWidth - 150,
        }),
      });
      titleTxt.position.set(14, 10);
      card.addChild(titleTxt);

      // Summary preview text
      const summaryTxt = new Text({
        text: data.summary,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fill: COLOR_HEX.smoke,
          wordWrap: true,
          wordWrapWidth: itemWidth - 28,
        }),
      });
      summaryTxt.position.set(14, 46);
      card.addChild(summaryTxt);

      card.on('pointerdown', () => {
        if (this.selectedIndex !== idx) {
          this.selectedIndex = idx;
          GlobalAudioService.playSfx('select');
          this.renderQuestList();
          this.renderQuestDetails();
        }
      });

      this.listContainer.addChild(card);
    });
  }

  private renderQuestDetails(): void {
    this.detailContainer.removeChildren();
    const item = this.questsWithState[this.selectedIndex];
    if (!item) return;

    const { data, state } = item;
    const detailWidth = 540;
    const detailHeight = 610;

    const bg = new Graphics();
    bg.roundRect(0, 0, detailWidth, detailHeight, 12);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.98 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    
    // Inner frame
    bg.roundRect(4, 4, detailWidth - 8, detailHeight - 8, 10);
    bg.stroke({ color: COLOR_NUM.gold, width: 0.8, alpha: 0.3 });
    this.detailContainer.addChild(bg);

    // Title (Large & Prominent)
    const title = new Text({
      text: `${data.category === 'main' ? '★ Misión Principal' : '◇ Misión Secundaria'}: ${data.title}`,
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 18,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
        wordWrap: true,
        wordWrapWidth: detailWidth - 48,
      }),
    });
    title.position.set(24, 18);
    this.detailContainer.addChild(title);

    // Description (Large & Easy to Read)
    const desc = new Text({
      text: data.description,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        lineHeight: 22,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: detailWidth - 48,
      }),
    });
    desc.position.set(24, 66);
    this.detailContainer.addChild(desc);

    // Objectives Section Header
    const objHeader = new Text({
      text: '🎯 OBJETIVOS:',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 16,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
      }),
    });
    objHeader.position.set(24, 160);
    this.detailContainer.addChild(objHeader);

    data.objectives.forEach((obj, idx) => {
      const objBox = new Container();
      objBox.position.set(24, 196 + idx * 72);

      const current = state.objectiveProgress[obj.id] || 0;
      const isDone = current >= obj.requiredCount;

      const objBg = new Graphics();
      objBg.roundRect(0, 0, detailWidth - 48, 62, 8);
      objBg.fill({ color: isDone ? COLOR_NUM.smokedWood : COLOR_NUM.inkCrypt, alpha: 0.85 });
      objBg.stroke({ color: isDone ? COLOR_SEMANTIC.ok : COLOR_NUM.bronze, width: 1.5 });
      objBox.addChild(objBg);

      const checkIcon = isDone ? '✅' : '◻️';
      const objTxt = new Text({
        text: `${checkIcon}  ${obj.description}`,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: isDone ? 'normal' : 'bold',
          fill: isDone ? COLOR_HEX.cyan : COLOR_HEX.parchment,
          wordWrap: true,
          wordWrapWidth: detailWidth - 160,
        }),
      });
      objTxt.position.set(16, 16);
      objBox.addChild(objTxt);

      if (obj.requiredCount > 1) {
        const countTxt = new Text({
          text: `${current} / ${obj.requiredCount}`,
          style: new TextStyle({
            fontFamily: FONTS.hud,
            fontSize: 16,
            fontWeight: '900',
            fill: isDone ? COLOR_HEX.cyan : COLOR_HEX.gold,
          }),
        });
        countTxt.anchor.set(1, 0.5);
        countTxt.position.set(detailWidth - 70, 31);
        objBox.addChild(countTxt);
      }

      this.detailContainer.addChild(objBox);
    });

    // Rewards Section Header
    const rewHeader = new Text({
      text: '🎁 RECOMPENSAS:',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 16,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
      }),
    });
    rewHeader.position.set(24, 430);
    this.detailContainer.addChild(rewHeader);

    const rewBox = new Container();
    rewBox.position.set(24, 466);

    const rewBg = new Graphics();
    rewBg.roundRect(0, 0, detailWidth - 48, 110, 8);
    rewBg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.85 });
    rewBg.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    rewBox.addChild(rewBg);

    const rewItemsStr =
      (data.rewards.money ? `💰 ¥${data.rewards.money}  ` : '') +
      (data.rewards.items
        ? data.rewards.items.map((i) => `📦 ${i.count}x ${i.itemId.toUpperCase()}`).join('  ')
        : '');

    const rewTxt = new Text({
      text: rewItemsStr || 'Sincronía y reconocimiento de los Artífices.',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 16,
        fontWeight: 'bold',
        fill: COLOR_HEX.cyan,
      }),
    });
    rewTxt.position.set(18, 16);
    rewBox.addChild(rewTxt);

    if (data.rewards.message) {
      const msgTxt = new Text({
        text: data.rewards.message,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 13,
          fill: COLOR_HEX.smoke,
          wordWrap: true,
          wordWrapWidth: detailWidth - 84,
        }),
      });
      msgTxt.position.set(18, 52);
      rewBox.addChild(msgTxt);
    }

    this.detailContainer.addChild(rewBox);
  }

  public update(dt: number): void {
    if (GlobalInput.justPressed('UP')) {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        GlobalAudioService.playSfx('select');
        this.renderQuestList();
        this.renderQuestDetails();
      }
    } else if (GlobalInput.justPressed('DOWN')) {
      if (this.selectedIndex < this.questsWithState.length - 1) {
        this.selectedIndex++;
        GlobalAudioService.playSfx('select');
        this.renderQuestList();
        this.renderQuestDetails();
      }
    }

    if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.close();
    }
  }

  public close(): void {
    GlobalAudioService.playSfx('cancel');
    GlobalSceneManager.popScene();
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
