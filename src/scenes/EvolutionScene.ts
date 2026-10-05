import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { GlobalEvolutionSystem } from '../systems/evolution/EvolutionSystem';
import { GlobalSaveService } from '../services/SaveService';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { CreatureInstance } from '../types';
import { ScreenFrame, KitCard, KitBadge, UIKitLinter } from '../ui/kit';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';
import esText from '../data/text/es.json';

export interface EvolutionSceneParams {
  creature: CreatureInstance;
  targetSpeciesId: string;
}

export class EvolutionScene implements IScene {
  public name = 'Evolution';
  private container: Container = new Container();
  private screenFrame!: ScreenFrame;
  private sprite!: Sprite;
  private animTimer = 0;
  private phase: 'intro' | 'flashing' | 'complete' = 'intro';

  public async enter(params?: EvolutionSceneParams): Promise<void> {
    this.container = new Container();
    this.container.roundPixels = true;
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    if (!params || !params.creature || !params.targetSpeciesId) {
      GlobalSceneManager.popScene();
      return;
    }

    const { creature, targetSpeciesId } = params;
    const oldSpecies = CREATURES_DATA[creature.speciesId];
    const newSpecies = CREATURES_DATA[targetSpeciesId];
    const oldName = creature.nickname || oldSpecies?.name || creature.speciesId;
    const newName = newSpecies?.name || targetSpeciesId;
    const t = (esText as any).terms.group_c.evolution;

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.screenFrame = new ScreenFrame({
      width,
      height,
      title: t.title,
      onClose: () => {
        if (this.phase === 'complete') {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.popScene();
        }
      },
      secondaryAction: {
        label: t.btn_back,
        iconId: 'back',
        onClick: () => {
          if (this.phase === 'complete') {
            GlobalAudioService.playSfx('cancel');
            GlobalSceneManager.popScene();
          }
        },
      },
      primaryAction: {
        label: t.btn_continue,
        iconId: 'star',
        onClick: () => {
          if (this.phase === 'complete') {
            GlobalAudioService.playSfx('confirm');
            GlobalSceneManager.popScene();
          }
        },
      },
    });
    this.container.addChild(this.screenFrame);

    const cw = this.screenFrame.contentWidth;
    const cardH = Math.max(320, this.screenFrame.contentHeight - 16);

    const card = new KitCard({
      width: cw,
      height: cardH,
      variant: 'smokedWood',
      title: t.subtitle,
    });
    card.position.set(0, 0);
    this.screenFrame.contentRoot.addChild(card);

    const badge = new KitBadge(
      `${oldName.toUpperCase()} -> ${newName.toUpperCase()}`,
      'tier',
      'tier'
    );
    badge.position.set(14, 44);
    card.addChild(badge);

    // Center Creature Sprite
    const oldTex = GlobalAssetRegistry.getCreatureSpritePixi(creature.speciesId, 'front');
    this.sprite = new Sprite(oldTex);
    this.sprite.anchor.set(0.5);
    this.sprite.scale.set(2);
    this.sprite.position.set(Math.round(cw / 2), Math.round(cardH * 0.52));
    card.addChild(this.sprite);

    const msgCard = new KitCard({
      width: cw - 28,
      height: 76,
      variant: 'parchment',
    });
    msgCard.position.set(14, cardH - 92);
    card.addChild(msgCard);

    const msgText = new Text({
      text: t.evolving.replace('{name}', oldName),
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.inkCrypt,
        wordWrap: true,
        wordWrapWidth: cw - 56,
        align: 'center',
      }),
    });
    msgText.anchor.set(0.5);
    msgText.position.set(Math.round((cw - 28) / 2), 38);
    msgCard.addChild(msgText);

    this.screenFrame.setContentTotalHeight(cardH + 16);
    UIKitLinter.inspectTree(this.screenFrame, 'EvolutionScene');

    // Run Ascension Sequence
    await this.sleep(1000);
    this.phase = 'flashing';

    const newTex = GlobalAssetRegistry.getCreatureSpritePixi(targetSpeciesId, 'front');
    for (let i = 0; i < 8; i++) {
      GlobalAudioService.playSfx('select');
      this.sprite.texture = i % 2 === 0 ? newTex : oldTex;
      this.sprite.tint = i % 2 === 0 ? COLOR_NUM.gold : COLOR_NUM.white;
      await this.sleep(160);
    }

    this.phase = 'complete';
    this.sprite.texture = newTex;
    this.sprite.tint = COLOR_NUM.white;

    // Apply Evolution via EvolutionSystem
    GlobalEvolutionSystem.executeEvolution(creature, targetSpeciesId);
    GlobalSaveService.save();

    GlobalAudioService.playSfx('levelUp');
    msgText.text = t.congrats.replace('{oldName}', oldName).replace('{newName}', newName);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  public update(dt: number): void {
    this.animTimer += dt;
    if (this.phase === 'flashing' && this.sprite) {
      const pulse = 2 + Math.sin(this.animTimer * 18) * 0.25;
      this.sprite.scale.set(pulse);
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }
}
