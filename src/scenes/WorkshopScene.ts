import { Container, Graphics, Text, TextStyle, Texture, Sprite } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalSaveService } from '../services/SaveService';
import { CREATURES_DATA } from '../data/creatures/creatures';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import { HumanoidPartSilhouette } from '../render/ui/HumanoidPartSilhouette';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { BrassPanel } from '../render/ui/kit/BrassPanel';
import { BrassButton } from '../render/ui/kit/BrassButton';
import { GlobalVFXSystem } from '../render/vfx/VFXSystem';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { Souldoll } from '../types/souldolls';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';
import { BodyPart } from '../types/bodies';

// Load map JSON data directly
import workshopData from '../data/maps/workshop_interior.json';

export class WorkshopScene implements IScene {
  public name = 'Workshop';
  private container: Container = new Container();
  private partyContainer: Container = new Container();
  private dialogText!: Text;
  private artificerHairHighlight!: Graphics;
  private lanternGraphic!: Graphics;
  private moneyText!: Text;
  private kitText!: Text;

  // Active state
  private selectedDollIndex = 0;
  private selectedRepairPart: BodyPart | 'all' | null = null;
  private repairContainer: Container | null = null; // New container
  private currentArtificerText = '';
  private currentArtificerSpeaker = 'Artífice de Almas';

  // Animation states
  private isAnimating = false;
  private animationOverlay: Graphics | null = null;
  private townId = 'villa_brote'; // Default town ID

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.container = new Container();
    this.container.position.set(0, 0);

    // Identify current town for visual variation
    const saveState = GlobalSaveService.getCurrentState();
    // Default town mapping based on last map
    if (saveState.player.mapId === 'pueblo_costero') {
      this.townId = 'pueblo_costero';
    } else if (saveState.player.mapId === 'ciudad_gimnasio') {
      this.townId = 'ciudad_gimnasio';
    } else {
      this.townId = 'villa_brote';
    }

    // 1. REGISTRAR PUNTO DE RESPAWN EN EL TALLER
    saveState.player.mapId = 'interior_center';
    saveState.player.position.x = 6;
    saveState.player.position.z = 10;
    saveState.player.direction = 'up';

    // 2. AUTOGUARDADO AL ENTRAR
    GlobalSaveService.save();

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
      text: '🛠 TALLER DE ARTÍFICES (REPARACIONES & RESONANCIA)',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 18,
        fontWeight: '900',
        fill: COLOR_HEX.gold,
        letterSpacing: 1.5,
      }),
    });
    titleText.position.set(24, 22);
    this.container.addChild(titleText);

    // Money indicator
    this.moneyText = new Text({
      text: `💸 Monedas: ¥${saveState.player.money}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.cyan,
      }),
    });
    this.moneyText.position.set(width - 340, 16);
    this.container.addChild(this.moneyText);

    // Kits indicator
    const kitCount = saveState.inventory?.['repair_kit'] || 0;
    this.kitText = new Text({
      text: `📦 Kits de Reparación: ${kitCount}`,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
      }),
    });
    this.kitText.position.set(width - 340, 42);
    this.container.addChild(this.kitText);

    // Close / Exit Button
    const closeBtn = this.createButton('✕ SALIR', width - 130, 16, 110, 38, COLOR_NUM.rift, () => {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.popScene();
    });
    this.container.addChild(closeBtn);

    // RENDER VISUAL VARIANTS BY TOWN
    this.renderTownVariants(width);
    this.renderEnvironment();

    // BUILD LAYOUT
    this.buildLeftMenuPanel();
    this.container.addChild(this.partyContainer);
    this.renderParty();

    // Trigger seal save animation toast
    this.triggerSaveSealFlash();

    GlobalPixiRenderer.hudLayer.addChild(this.container);
  }

  /**
   * Render thematic dark fantasy environment features
   */
  private renderEnvironment(): void {
    // 1. Draw Decorations from JSON
    const decorations = workshopData.decorations as Record<string, any>;
    Object.entries(decorations).forEach(([key, dec]) => {
      // TEMPORARY: Map keys to atlas coordinates (roughly)
      // This is for development layout as requested.
      const atlasMap: Record<string, [number, number, number, number]> = {
          'resonance_machine': [450, 450, 200, 200],
          'repair_bench': [700, 450, 250, 200],
          'exit_door': [100, 400, 150, 200]
      };
      
      const [ax, ay, aw, ah] = atlasMap[key] || [0, 0, 100, 100];
      const canvas = GlobalAssetRegistry.getTileFromAtlas(ax, ay, aw, ah);
      const tex = Texture.from({ resource: canvas });
      const sprite = new Sprite(tex);
      
      const x = (dec.x / 14) * GlobalPixiRenderer.width;
      const y = (dec.y / 12) * GlobalPixiRenderer.height;
      sprite.position.set(x, y);
      sprite.scale.set(0.5); // Fit into the grid
      
      this.container.addChild(sprite);
      
      // Label
      const txt = new Text({
          text: dec.name,
          style: new TextStyle({ fontSize: 10, fill: COLOR_HEX.parchment })
      });
      txt.position.set(x + 5, y + 5);
      this.container.addChild(txt);
    });

    // 2. Thematic Shadows
    const shadow = new Graphics();
    shadow.rect(0, 0, GlobalPixiRenderer.width, GlobalPixiRenderer.height);
    shadow.fill({ color: COLOR_NUM.inkCrypt, alpha: workshopData.theme.shadowOpacity });
    this.container.addChild(shadow);
    
    // 3. Simple Candles
    for (let i = 0; i < workshopData.theme.candleCount; i++) {
        const candle = new Graphics();
        candle.rect(100 + i * 200, GlobalPixiRenderer.height - 30, 10, 20);
        candle.fill({ color: COLOR_NUM.parchment });
        this.container.addChild(candle);
    }
  }

  /**
   * Auto-save seal flash animation
   */
  private triggerSaveSealFlash(): void {
    const seal = new Graphics();
    const cx = GlobalPixiRenderer.width - 240;
    const cy = 180;
    seal.circle(cx, cy, 32);
    seal.fill({ color: COLOR_NUM.gold, alpha: 0.15 });
    seal.stroke({ color: COLOR_NUM.gold, width: 2 });
    // Ornate details in seal
    seal.circle(cx, cy, 26);
    seal.stroke({ color: COLOR_NUM.gold, width: 0.5 });
    seal.rect(cx - 16, cy - 16, 32, 32);
    seal.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.4 });

    const sealText = new Text({
      text: 'CONEXIÓN\nGUARDADA',
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 9,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        align: 'center',
      }),
    });
    sealText.anchor.set(0.5);
    sealText.position.set(cx, cy);

    const sealContainer = new Container();
    sealContainer.addChild(seal);
    sealContainer.addChild(sealText);
    sealContainer.alpha = 0;
    this.container.addChild(sealContainer);

    // Animate fade in and fade out
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= 10) {
        sealContainer.alpha = step / 10;
      } else if (step > 40 && step <= 50) {
        sealContainer.alpha = (50 - step) / 10;
      } else if (step > 50) {
        clearInterval(interval);
        sealContainer.destroy({ children: true });
      }
    }, 30);
  }

  /**
   * Render town hanging lantern and Artificer avatar hair variant
   */
  private renderTownVariants(width: number): void {
    const variant =
      workshopData.townVariants[this.townId as keyof typeof workshopData.townVariants] ||
      workshopData.townVariants.villa_brote;

    // 1. Hanging Lantern
    this.lanternGraphic = new Graphics();
    this.lanternGraphic.rect(60, 70, 4, 30); // Cord
    this.lanternGraphic.fill({ color: COLOR_NUM.bronze });
    // Lantern frame
    this.lanternGraphic.roundRect(50, 100, 24, 34, 4);
    this.lanternGraphic.fill({ color: COLOR_NUM.smokedWood });
    this.lanternGraphic.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
    // Glowing core
    this.lanternGraphic.circle(62, 117, 8);
    const lanternNum = parseInt(variant.lanternColor.replace('#', '0x'));
    this.lanternGraphic.fill({ color: lanternNum });
    this.container.addChild(this.lanternGraphic);

    // 2. Artificer Procedural Avatar Frame (Left menu)
    const avatarBg = new Graphics();
    avatarBg.roundRect(24, 150, 80, 80, 8);
    avatarBg.fill({ color: COLOR_NUM.smokedWood });
    avatarBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    this.container.addChild(avatarBg);

    // Base face
    avatarBg.circle(64, 190, 20);
    avatarBg.fill({ color: 0xffe4e6 }); // Peach skin

    // Procedural locks of hair
    avatarBg.ellipse(64, 178, 22, 12);
    avatarBg.fill({ color: 0x3f3f46 }); // Charcoal hair

    // Artificer colored lock of hair highlight (vía data)
    this.artificerHairHighlight = new Graphics();
    this.artificerHairHighlight.ellipse(74, 182, 6, 14);
    const hairNum = parseInt(variant.hairHighlight.replace('#', '0x'));
    this.artificerHairHighlight.fill({ color: hairNum });
    this.container.addChild(this.artificerHairHighlight);

    // Eyes
    avatarBg.circle(58, 190, 2);
    avatarBg.circle(70, 190, 2);
    avatarBg.fill({ color: COLOR_NUM.inkCrypt });

    // Cute blush
    avatarBg.circle(54, 196, 3);
    avatarBg.circle(74, 196, 3);
    avatarBg.fill({ color: COLOR_NUM.rift, alpha: 0.3 });

    // Goggles / Magnifier (Artificer goggles)
    avatarBg.rect(48, 184, 32, 4);
    avatarBg.fill({ color: COLOR_NUM.bronze });
    avatarBg.circle(58, 186, 6);
    avatarBg.circle(70, 186, 6);
    avatarBg.stroke({ color: COLOR_NUM.gold, width: 1.5 });
  }

  /**
   * Left Menu Panel representing Dialogue box and service menu triggers
   */
  private buildLeftMenuPanel(): void {
    const startY = 245;

    // Dialogue display panel
    const dialogBg = new Graphics();
    dialogBg.roundRect(24, startY, 340, 160, 10);
    dialogBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    dialogBg.stroke({ color: COLOR_NUM.gold, width: 1.5 });
    this.container.addChild(dialogBg);

    // Speaker label
    const speakerText = new Text({
      text: this.currentArtificerSpeaker.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
      }),
    });
    speakerText.position.set(38, startY + 12);
    this.container.addChild(speakerText);

    // Dialogue text body
    this.currentArtificerText = workshopData.dialogues.welcome;
    this.dialogText = new Text({
      text: this.currentArtificerText,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 11,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: 312,
        lineHeight: 18,
      }),
    });
    this.dialogText.position.set(38, startY + 36);
    this.container.addChild(this.dialogText);

    // Service Buttons Stack
    const menuStartY = startY + 175;
    const btnW = 340;
    const btnH = 34;

    const services = [
      {
        label: '✨ CURAR EQUIPO (GRATIS)',
        color: COLOR_NUM.cyan,
        action: () => this.executeHealSequence(),
      },
      {
        label: '🛠 REPARAR PARTE CON DAÑO',
        color: COLOR_NUM.gold,
        action: () => {
          this.currentArtificerSpeaker = 'Gremio de Artífices';
          this.setArtificerText(workshopData.dialogues.first_visit);
          this.showRepairPrompt();
        },
      },
      {
        label: '🍷 PURGAR KI CORRUPTO',
        color: COLOR_NUM.soulViolet,
        action: () => this.executePurgeSequence(),
      },
      {
        label: '🔮 VINCULACIÓN / ALMACÉN DE ALMAS',
        color: COLOR_NUM.gold,
        action: () => {
          GlobalAudioService.playSfx('select');
          GlobalSceneManager.pushScene('SoulBinding');
        },
      },
      {
        label: '🤖 ALMACÉN DE CUERPOS',
        color: COLOR_NUM.soulViolet,
        action: () => {
          GlobalAudioService.playSfx('select');
          GlobalSceneManager.pushScene('StorageBox');
        },
      },
      {
        label: '✨ MEJORAR CUERPO (SI DISPONIBLE)',
        color: COLOR_NUM.gold,
        action: () => this.executeUpgradeSequence(),
      },
    ];

    services.forEach((s, idx) => {
      const btn = this.createButton(
        s.label,
        24,
        menuStartY + idx * 44,
        btnW,
        btnH,
        s.color,
        s.action
      );
      this.container.addChild(btn);
    });
  }

  /**
   * Procedural Celesta resonance machine curing animation
   */
  private executeHealSequence(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;

    this.currentArtificerSpeaker = 'Máquina de Resonancia';
    this.setArtificerText(workshopData.dialogues.healing_init);

    // Create a curing visual overlay
    this.animationOverlay = new Graphics();
    this.container.addChild(this.animationOverlay);

    const steps = 6;
    let step = 0;

    const playCelestaBeep = () => {
      if (step >= steps) {
        // Complete Curing
        this.isAnimating = false;
        if (this.animationOverlay) {
          this.animationOverlay.destroy();
          this.animationOverlay = null;
        }

        // Heal Party
        this.executeKiHeal();
        this.currentArtificerSpeaker = 'Artífice de Almas';
        this.setArtificerText(workshopData.dialogues.healing_complete);
        return;
      }

      // Procedural celesta tones raising in pitch
      const pitchOffset = 1.0 + step * 0.15;
      GlobalAudioService.playSfx('select', pitchOffset);

      // Flash sequence flasks on the overlay
      const width = GlobalPixiRenderer.width;
      const height = GlobalPixiRenderer.height;

      this.animationOverlay?.clear();
      this.animationOverlay?.rect(0, 0, width, height);
      this.animationOverlay?.fill({ color: 0x5fe3d2, alpha: 0.05 + step * 0.03 });

      // Flask glowing circles
      for (let i = 0; i <= step; i++) {
        this.animationOverlay?.circle(450 + i * 40, 200, 12);
        this.animationOverlay?.fill({ color: COLOR_NUM.cyan });
        this.animationOverlay?.stroke({ color: COLOR_NUM.white, width: 2 });
      }

      step++;
      setTimeout(playCelestaBeep, 300);
    };

    playCelestaBeep();
  }

  private executeUpgradeSequence(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;

    this.currentArtificerSpeaker = 'Gremio de Artífices';
    this.setArtificerText(workshopData.dialogues.upgrade_init);

    const saveState = GlobalSaveService.getCurrentState();
    const currentDoll = saveState.party[this.selectedDollIndex];
    
    if (currentDoll && currentDoll.bodyInstanceId && saveState.bodies[currentDoll.bodyInstanceId]) {
      if (currentDoll.maxPartHP) {
        Object.keys(currentDoll.maxPartHP).forEach((part) => {
          currentDoll.maxPartHP[part as BodyPart] += 5; 
        });
        currentDoll.partHP = { ...currentDoll.maxPartHP };
      }
    }

    setTimeout(() => {
      this.isAnimating = false;
      GlobalSaveService.save();
      this.setArtificerText(workshopData.dialogues.upgrade_success);
      this.renderParty();
    }, 1500);
  }

  private executeKiHeal(): void {
    const saveState = GlobalSaveService.getCurrentState();
    saveState.party.forEach(doll => {
      doll.currentHp = doll.maxHp;
      doll.moves.forEach(move => {
        move.currentPp = move.maxPp;
      });
    });
    GlobalSaveService.save();
  }

  /**
   * Procedural purple-to-cyan fading mist purge animation
   */
  private executePurgeSequence(): void {
    if (this.isAnimating) return;
    this.isAnimating = true;

    this.currentArtificerSpeaker = 'Purga de Ki';
    this.setArtificerText(workshopData.dialogues.purge_init);

    const saveState = GlobalSaveService.getCurrentState();
    const currentDoll = saveState.party[this.selectedDollIndex];

    this.animationOverlay = new Graphics();
    this.container.addChild(this.animationOverlay);

    let progress = 0;
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const fadeMist = () => {
      progress += 0.05;
      if (progress >= 1.0) {
        this.isAnimating = false;
        this.animationOverlay?.destroy();
        this.animationOverlay = null;

        // Clear status
        if (currentDoll) {
          currentDoll.status = null;
        }
        GlobalSaveService.save();
        GlobalAudioService.playSfx('confirm');

        this.currentArtificerSpeaker = 'Artífice de Almas';
        this.setArtificerText(workshopData.dialogues.purge_success);
        this.renderParty();
        return;
      }

      // Purge smoke violet to cyan transition
      this.animationOverlay?.clear();
      this.animationOverlay?.rect(0, 0, width, height);
      this.animationOverlay?.fill({
        color: progress < 0.5 ? COLOR_NUM.soulViolet : COLOR_NUM.cyan,
        alpha: Math.sin(progress * Math.PI) * 0.35,
      });

      // Sound feedback
      if (Math.random() < 0.2) {
        GlobalAudioService.playSfx('select', 1.5);
      }

      requestAnimationFrame(fadeMist);
    };

    fadeMist();
  }

  /**
   * Display interactive parts selector with price list and sparks animation
   */
  private showRepairPrompt(): void {
    if (this.repairContainer) {
      this.repairContainer.destroy({ children: true });
    }

    this.repairContainer = new Container();
    this.container.addChild(this.repairContainer);

    const saveState = GlobalSaveService.getCurrentState();
    const currentDoll = saveState.party[this.selectedDollIndex];
    if (!currentDoll) return;

    // Use BrassPanel for thematic background
    const panel = new BrassPanel({
        width: 560,
        height: 400,
        title: 'Reparación de Chasis',
        backgroundType: 'inkCrypt'
    });
    panel.position.set(380, 150);
    this.repairContainer.addChild(panel);

    // Silhouette
    const sil = new HumanoidPartSilhouette();
    sil.position.set(450, 200);
    sil.updateParts(currentDoll.partHP, currentDoll.maxPartHP);
    this.repairContainer.addChild(sil);

    // Parts Info & Buttons using BrassButton
    const parts: BodyPart[] = ['head', 'torso', 'arms', 'legs'];
    parts.forEach((part, idx) => {
        const hp = currentDoll.partHP?.[part] ?? 0;
        const max = currentDoll.maxPartHP?.[part] ?? 1;
        
        const btn = new BrassButton({
            width: 250,
            height: 40,
            label: `Reparar ${part.toUpperCase()} (${hp}/${max})`,
            onClick: () => {
                this.repairSelectedPart(part, false);
                this.showRepairPrompt(); // Refresh
            }
        });
        btn.position.set(600, 200 + idx * 60);
        this.repairContainer?.addChild(btn);
    });

    // Bulk Repair using BrassButton
    const allBtn = new BrassButton({
        width: 250,
        height: 50,
        label: 'REPARAR TODO (300¥)',
        onClick: () => {
            this.repairSelectedPart('all', false);
            this.showRepairPrompt(); // Refresh
        },
        useKiGlow: true
    });
    allBtn.position.set(600, 450);
    this.repairContainer.addChild(allBtn);

    // Close Button (using a simpler button implementation)
    const closeBtn = this.createButton('✕', 900, 160, 30, 30, COLOR_NUM.rift, () => {
        this.repairContainer?.destroy({ children: true });
        this.repairContainer = null;
    });
    this.repairContainer.addChild(closeBtn);
  }

  /**
   * Execute part repair with sparks lines over the silhouette
   */
  private repairSelectedPart(part: BodyPart | 'all', useKit = false): void {
    const saveState = GlobalSaveService.getCurrentState();
    const currentDoll = saveState.party[this.selectedDollIndex];
    if (!currentDoll) return;

    // Validate tier pricing
    let currentTier = 1;
    if (currentDoll.bodyInstanceId && saveState.bodies && saveState.bodies[currentDoll.bodyInstanceId]) {
      const bodyInst = saveState.bodies[currentDoll.bodyInstanceId];
      const chassis = BODY_CHASSIS_DATA[bodyInst.chassisId];
      if (chassis) currentTier = chassis.tier;
    }

    const cost = part === 'all' ? 300 * currentTier : 100 * currentTier;

    if (useKit) {
      const kitCount = saveState.inventory?.['repair_kit'] || 0;
      if (kitCount < 1) {
        GlobalAudioService.playSfx('cancel');
        this.setArtificerText('No te quedan Kits de Reparación en tu mochila.');
        return;
      }
      saveState.inventory['repair_kit'] = kitCount - 1;
    } else {
      if (saveState.player.money < cost) {
        GlobalAudioService.playSfx('cancel');
        this.setArtificerText(workshopData.dialogues.no_money);
        return;
      }
      saveState.player.money -= cost;
    }

    // Play repair sparks animation
    this.isAnimating = true;
    this.animationOverlay = new Graphics();
    this.container.addChild(this.animationOverlay);

    let frames = 0;
    const playSparks = () => {
      frames++;
      if (frames >= 12) {
        this.isAnimating = false;
        this.animationOverlay?.destroy();
        this.animationOverlay = null;

        // Apply health recovery
        if (currentDoll.partHP && currentDoll.maxPartHP) {
          if (part === 'all') {
            currentDoll.partHP = { ...currentDoll.maxPartHP };
          } else {
            currentDoll.partHP[part] = currentDoll.maxPartHP[part];
          }
          currentDoll.currentHp = currentDoll.maxHp;
        }

        GlobalSaveService.save();
        GlobalAudioService.playSfx('confirm');

        const count = saveState.inventory?.['repair_kit'] || 0;
        this.kitText.text = `📦 Kits de Reparación: ${count}`;
        this.moneyText.text = `💸 Monedas: ¥${saveState.player.money}`;

        this.setArtificerText(workshopData.dialogues.repair_success);
        this.renderParty();
        return;
      }

      // Draw random electric ki spark lines on repair bench
      GlobalVFXSystem.vfxRepairSpark(600, 250);
      
      // Audible mechanical click/clang sound
      if (frames % 3 === 0) {
        GlobalAudioService.playSfx('select', 0.6 + Math.random() * 0.4);
      }

      setTimeout(playSparks, 60);
    };

    playSparks();
  }

  private setArtificerText(txt: string): void {
    this.currentArtificerText = txt;
    if (this.dialogText) {
      this.dialogText.text = txt;
    }
  }

  private renderParty(): void {
    this.partyContainer.removeChildren();

    const saveState = GlobalSaveService.getCurrentState();
    this.moneyText.text = `💸 Monedas: ¥${saveState.player.money}`;

    const party = saveState.party || [];
    party.forEach((soul: Souldoll, idx: number) => {
      const species = CREATURES_DATA[soul.speciesId];
      const cardY = 140 + idx * 85;

      const card = new Container();
      card.position.set(390, cardY);

      const isSelected = this.selectedDollIndex === idx;

      const bg = new Graphics();
      bg.roundRect(0, 0, 540, 78, 10);
      bg.fill({ color: isSelected ? COLOR_NUM.smokedWood : COLOR_NUM.inkCrypt, alpha: 0.95 });
      bg.stroke({ color: isSelected ? COLOR_NUM.gold : COLOR_NUM.bronze, width: isSelected ? 3 : 1.5 });
      card.addChild(bg);

      // Inner ornate line
      bg.roundRect(3, 3, 534, 72, 8);
      bg.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.2 });

      // Click to select Souldoll
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.on('pointerdown', () => {
        GlobalAudioService.playSfx('select');
        this.selectedDollIndex = idx;
        this.renderParty();
        this.showRepairPrompt();
      });

      // Part Silhouette
      const sil = new HumanoidPartSilhouette();
      sil.position.set(16, 12);
      sil.scale.set(0.8);
      sil.updateParts(soul.partHP, soul.maxPartHP);
      card.addChild(sil);

      // Name & Level
      const nameTxt = new Text({
        text: `🔮 ${soul.nickname || species?.name || soul.speciesId} (Nv. ${soul.level})`,
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 14,
          fontWeight: '900',
          fill: COLOR_HEX.parchment,
        }),
      });
      nameTxt.position.set(70, 12);
      card.addChild(nameTxt);

      // Part HP Breakdown
      const partHp = soul.partHP || { head: 15, torso: 40, arms: 20, legs: 25 };
      const partMax = soul.maxPartHP || { head: 15, torso: 40, arms: 20, legs: 25 };

      const hpTxt = new Text({
        text: `Cab: ${partHp.head}/${partMax.head} · Tor: ${partHp.torso}/${partMax.torso} · Bra: ${partHp.arms}/${partMax.arms} · Pie: ${partHp.legs}/${partMax.legs}`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 11,
          fill: COLOR_HEX.smoke,
        }),
      });
      hpTxt.position.set(70, 42);
      card.addChild(hpTxt);

      // Repair Buttons per Souldoll
      let currentTier = 1;
      let bodyInst: any = null;
      if (soul.bodyInstanceId && saveState.bodies && saveState.bodies[soul.bodyInstanceId]) {
        bodyInst = saveState.bodies[soul.bodyInstanceId];
        const chassis = BODY_CHASSIS_DATA[bodyInst.chassisId];
        if (chassis) currentTier = chassis.tier;
      }

      // Repair Action triggers directly on the card
      const repairCost = 100 * currentTier;

      // Choose repair methods
      const cashBtn = this.createButton(
        `🛠 REPARAR (${repairCost}¥)`,
        300,
        18,
        110,
        40,
        COLOR_NUM.gold,
        () => {
          this.selectedDollIndex = idx;
          this.repairSelectedPart('all', false); // Repair all via coins
        }
      );
      card.addChild(cashBtn);

      const kitBtn = this.createButton(
        `📦 USAR KIT`,
        420,
        18,
        100,
        40,
        COLOR_NUM.cyan,
        () => {
          this.selectedDollIndex = idx;
          this.repairSelectedPart('all', true); // Repair all via Kit
        }
      );
      card.addChild(kitBtn);

      this.partyContainer.addChild(card);
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
        fontSize: 10,
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
