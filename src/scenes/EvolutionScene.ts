import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalVFXSystem } from '../render/vfx/VFXSystem';
import { GlobalEvolutionSystem, EvolutionResult } from '../systems/evolution/EvolutionSystem';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { CreatureInstance } from '../types';

export interface EvolutionSceneParams {
  creature: CreatureInstance;
  targetSpeciesId: string;
  onComplete?: (result: EvolutionResult | null) => void;
}

export class EvolutionScene implements IScene {
  public name = 'Evolution';

  private container: Container = new Container();
  private bgContainer: Container = new Container();
  private spriteContainer: Container = new Container();
  private uiContainer: Container = new Container();

  private creature!: CreatureInstance;
  private targetSpeciesId!: string;
  private onCompleteCallback?: (result: EvolutionResult | null) => void;

  private spriteOld!: Sprite;
  private spriteNew!: Sprite;

  private bannerBox!: Container;
  private bannerText!: Text;

  private isEvolving = true;
  private isCancelled = false;
  private isFinished = false;

  private animTime = 0;
  private evolutionResult: EvolutionResult | null = null;

  public async enter(params?: EvolutionSceneParams): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    this.container = new Container();
    GlobalPixiRenderer.menuLayer.addChild(this.container);

    if (!params || !params.creature || !params.targetSpeciesId) {
      throw new Error('[EvolutionScene] Missing creature or targetSpeciesId parameter!');
    }

    this.creature = params.creature;
    this.targetSpeciesId = params.targetSpeciesId;
    this.onCompleteCallback = params.onComplete;

    this.buildBackground();
    this.buildSprites();
    this.buildUI();

    GlobalVFXSystem.init(this.container);
    GlobalAudioService.playTitleBgm();

    // Start Evolution Sequence
    this.runEvolutionSequence();
  }

  private buildBackground(): void {
    this.bgContainer = new Container();
    this.container.addChild(this.bgContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x090e1a });
    this.bgContainer.addChild(bg);

    // Glowing stage pedestal
    const pedestal = new Graphics();
    pedestal.ellipse(width / 2, height * 0.62, 240, 70);
    pedestal.fill({ color: 0x0284c7, alpha: 0.35 });
    pedestal.stroke({ color: 0x38bdf8, width: 3 });
    this.bgContainer.addChild(pedestal);
  }

  private buildSprites(): void {
    this.spriteContainer = new Container();
    this.container.addChild(this.spriteContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const oldSpecies = CREATURES_DATA[this.creature.speciesId];
    const newSpecies = CREATURES_DATA[this.targetSpeciesId];

    // Old Species Sprite
    const texOld = GlobalAssetRegistry.getCreatureSpritePixi(oldSpecies.id, 'front');
    this.spriteOld = new Sprite(texOld);
    this.spriteOld.anchor.set(0.5, 1.0);
    this.spriteOld.scale.set(4.0);
    this.spriteOld.position.set(width / 2, height * 0.62);
    this.spriteContainer.addChild(this.spriteOld);

    // New Species Sprite (Initially Hidden)
    const texNew = GlobalAssetRegistry.getCreatureSpritePixi(newSpecies.id, 'front');
    this.spriteNew = new Sprite(texNew);
    this.spriteNew.anchor.set(0.5, 1.0);
    this.spriteNew.scale.set(4.2);
    this.spriteNew.position.set(width / 2, height * 0.62);
    this.spriteNew.visible = false;
    this.spriteContainer.addChild(this.spriteNew);
  }

  private buildUI(): void {
    this.uiContainer = new Container();
    this.uiContainer.zIndex = 900;
    this.container.addChild(this.uiContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Bottom Banner Box
    this.bannerBox = new Container();
    this.bannerBox.position.set(20, height - 150);

    const bg = new Graphics();
    bg.roundRect(0, 0, width - 40, 110, 12);
    bg.fill({ color: 0x0f172a, alpha: 0.95 });
    bg.stroke({ color: 0x38bdf8, width: 3 });
    this.bannerBox.addChild(bg);

    const oldName = this.creature.nickname || CREATURES_DATA[this.creature.speciesId].name;
    this.bannerText = new Text({
      text: `¡Un momento! ¡${oldName} está evolucionando!`,
      style: new TextStyle({
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 24,
        fontWeight: '900',
        fill: '#ffffff',
        wordWrap: true,
        wordWrapWidth: width - 80,
      }),
    });
    this.bannerText.position.set(24, 24);
    this.bannerBox.addChild(this.bannerText);

    // Cancel hint
    const cancelHint = new Text({
      text: 'Pulsa [CANCEL] para detener',
      style: new TextStyle({
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        fontWeight: 'bold',
        fill: '#94a3b8',
      }),
    });
    cancelHint.position.set(width - 290, 72);
    this.bannerBox.addChild(cancelHint);

    this.uiContainer.addChild(this.bannerBox);
  }

  private async runEvolutionSequence(): Promise<void> {
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Check Ascension & Body Tier Eligibility
    const checkRes = GlobalEvolutionSystem.checkAscension(this.creature, 'level_up');
    if (checkRes && !checkRes.bodyEligible) {
      GlobalAudioService.playSfx('cancel');
      const oldName = this.creature.nickname || CREATURES_DATA[this.creature.speciesId]?.name || this.creature.speciesId;
      const targetSpecies = CREATURES_DATA[this.targetSpeciesId];
      const reqTier = checkRes.requiredTier || targetSpecies?.bodyRequirement?.minTier || 2;

      this.bannerText.text = `⚠️ ¡El Ascenso de ${oldName} se ha bloqueado!\n"El cuerpo no soporta este ki" (Requiere Chasis Tier ${reqTier}).`;
      this.bannerText.style.fill = '#f87171';
      this.isEvolving = false;
      this.isFinished = true;

      // Pulse red indicator
      this.spriteOld.tint = 0xef4444;
      return;
    }

    // Phase 1: Alternating Pulsing Silhouettes (3.5s)
    const startTime = performance.now();
    const pulseDurationMs = 3500;

    while (performance.now() - startTime < pulseDurationMs) {
      if (this.isCancelled) return;

      const elapsed = performance.now() - startTime;
      const progress = elapsed / pulseDurationMs; // 0.0 to 1.0

      // Accelerating pulse frequency
      const freq = 3 + progress * 22;
      const showNew = Math.sin(elapsed * 0.001 * freq * Math.PI) > 0;

      this.spriteOld.visible = !showNew;
      this.spriteNew.visible = showNew;

      // White tint flash effect
      this.spriteOld.tint = showNew ? 0xffffff : 0xffffff;
      this.spriteNew.tint = 0xffffff;

      await this.sleep(25);
    }

    if (this.isCancelled) return;

    // Phase 2: Flash Burst & Evolution Commit
    this.isEvolving = false;
    GlobalAudioService.playSfx('levelUp');
    await GlobalVFXSystem.screenFlash(0xffffff, 450);

    // Perform actual evolution mutation
    this.evolutionResult = GlobalEvolutionSystem.evolveCreature(this.creature, this.targetSpeciesId);

    // Show reveal sprite in full color
    this.spriteOld.visible = false;
    this.spriteNew.visible = true;
    this.spriteNew.tint = 0xffffff;

    // Spawn aura particles
    await GlobalVFXSystem.playPresetVfx(
      'aura',
      width / 2,
      height * 0.62,
      width / 2,
      height * 0.62,
      '#facc15',
      '#ffffff'
    );

    // Update Banner Message
    const oldName = this.evolutionResult.oldSpecies.name;
    const newName = this.evolutionResult.newSpecies.name;
    let msg = `¡Felicidades! ¡Tu ${oldName} evolucionó en ${newName}!`;

    if (this.evolutionResult.learnedMoves.length > 0) {
      msg += `\n¡Aprendió ${this.evolutionResult.learnedMoves.join(', ')}!`;
    }

    this.bannerText.text = msg;
    this.isFinished = true;
  }

  private handleCancelRequest(): void {
    if (!this.isEvolving || this.isFinished) return;

    this.isCancelled = true;
    GlobalAudioService.playSfx('cancel');

    this.bannerText.text = `¡La evolución de ${this.creature.nickname || CREATURES_DATA[this.creature.speciesId].name} ha sido detenida!`;

    this.spriteOld.visible = true;
    this.spriteNew.visible = false;
    this.spriteOld.tint = 0xffffff;

    setTimeout(() => {
      this.finishAndExit();
    }, 1200);
  }

  private finishAndExit(): void {
    if (this.onCompleteCallback) {
      this.onCompleteCallback(this.evolutionResult);
    }
    GlobalSceneManager.popScene();
  }

  public update(dt: number): void {
    this.animTime += dt;
    GlobalVFXSystem.update(dt);

    if (this.isEvolving && GlobalInput.justPressed('CANCEL')) {
      this.handleCancelRequest();
    }

    if (this.isFinished && (GlobalInput.justPressed('CONFIRM') || GlobalInput.justPressed('CANCEL'))) {
      GlobalAudioService.playSfx('confirm');
      this.finishAndExit();
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    this.container.destroy({ children: true });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
