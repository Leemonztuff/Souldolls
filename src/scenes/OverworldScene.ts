import * as THREE from 'three';
import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { MapRenderer } from '../render/overworld/MapRenderer';
import { OverworldCamera } from '../render/overworld/OverworldCamera';
import { CameraDebugOverlay } from '../render/overworld/CameraDebugOverlay';
import { OverworldPlayer } from '../systems/OverworldPlayer';
import { BillboardCharacter } from '../render/overworld/BillboardCharacter';
import { GlobalAtlasDebugOverlay } from '../render/overworld/AtlasDebugOverlay';
import { WorldGraph } from '../data/maps/worldGraph';
import { MapData, MapNPC } from '../types/maps';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalEventBus } from '../core/EventBus';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalQuestSystem } from '../systems/quest/QuestSystem';
import { GlobalDialogueSystem } from '../systems/dialogue/DialogueSystem';
import { GlobalAssetRegistry } from '../render/procedural/AssetRegistry';
import { DialogueNode } from '../types/dialogue';
import { Direction, CreatureInstance } from '../types';
import { PokedexSystem } from '../systems/PokedexSystem';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';

export class OverworldScene implements IScene {
  public name = 'Overworld';

  private mapRenderer: MapRenderer;
  private cameraController: OverworldCamera;
  private cameraDebugOverlay: CameraDebugOverlay;
  private player: OverworldPlayer;
  private currentMap!: MapData;
  private npcs: Map<string, { character: BillboardCharacter; data: MapNPC }> = new Map();

  // Ambient Lighting
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;

  // Pixi UI containers
  private hudContainer: Container = new Container();
  private toastContainer: Container = new Container();

  // In-Game Pause Menu
  private menuContainer: Container | null = null;
  private isMenuOpen = false;
  private selectedMenuIndex = 0;
  private menuItemsList = [
    { label: '🐾 EQUIPO', action: () => GlobalSceneManager.pushScene('CreatureDetail') },
    { label: '🔗 VINCULAR ALMAS', action: () => GlobalSceneManager.pushScene('SoulBinding') },
    { label: '📖 CÓDICE DE ALMAS', action: () => GlobalSceneManager.pushScene('Pokedex') },
    { label: '📜 MISIONES (J)', action: () => GlobalSceneManager.pushScene('QuestLog') },
    {
      label: '🎯 RECENTRAR CÁMARA',
      action: () => {
        this.cameraController.recenterOnPlayer(
          this.player.character.worldX,
          this.player.character.worldZ,
          true
        );
        this.showToast('🎯 Cámara Recentrada en el Jugador', 1500);
      },
    },
    {
      label: '💾 GUARDAR PARTIDA',
      action: () => {
        const state = GlobalSaveService.getCurrentState();
        state.player.position.x = this.player.gridX;
        state.player.position.z = this.player.gridY;
        state.player.direction = this.player.character.direction;
        state.player.mapId = this.currentMap.id;
        GlobalSaveService.save();
        this.showToast('💾 Partida guardada con éxito', 2000);
      },
    },
    {
      label: '🏠 VOLVER AL TÍTULO',
      action: () => {
        GlobalAudioService.playSfx('confirm');
        GlobalSceneManager.changeScene('Title');
      },
    },
    { label: '❌ CERRAR MENÚ', action: () => this.closeMenu() },
  ];

  // Dialogue Tree UI & Typewriter
  private dialogueBoxContainer: Container | null = null;
  private isDialogueOpen = false;
  private currentNode: DialogueNode | null = null;
  private typewriterFullText = '';
  private typewriterCurrentLength = 0;
  private typewriterTimer = 0;
  private typewriterSpeed = 45; // chars per second
  private isTypewriterComplete = false;
  private selectedOptionIndex = 0;
  private optionsContainers: Container[] = [];
  private textDisplayObject: Text | null = null;

  private isWarping = false;
  private staminaBar: Graphics | null = null;

  private boundWarpHandler: (params: {
    targetMapId: string;
    targetX: number;
    targetY: number;
    targetDirection: Direction;
  }) => void;
  private boundToastHandler: (params: { text: string; duration?: number }) => void;

  constructor() {
    this.mapRenderer = new MapRenderer();
    this.cameraController = new OverworldCamera(GlobalThreeRenderer.camera);
    this.cameraDebugOverlay = new CameraDebugOverlay();
    this.player = new OverworldPlayer('player', 6, 8, 'down');

    this.boundWarpHandler = (params) => this.executeWarp(params);
    this.boundToastHandler = ({ text, duration }) => this.showToast(text, duration);
  }

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    GlobalThreeRenderer.clearScene();

    const scene = GlobalThreeRenderer.scene;

    // 1. Setup Lighting
    this.ambientLight = new THREE.AmbientLight(0xfffaed, 0.9);
    scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.8);
    this.sunLight.position.set(12, 24, 16);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0005;
    scene.add(this.sunLight);

    // 2. Initialize Quests
    GlobalQuestSystem.ensureQuestsInitialized();

    // 3. Load Saved or Initial Map
    const savedState = GlobalSaveService.getCurrentState();
    const mapIdToLoad = params?.mapId || savedState.player.mapId || 'villa_brote';
    let spawnX = params?.x !== undefined ? params.x : (savedState.player.position.x !== undefined ? savedState.player.position.x : 6);
    let spawnY = params?.y !== undefined ? params.y : (savedState.player.position.z !== undefined ? savedState.player.position.z : 8);
    const spawnDir = params?.dir || savedState.player.direction || 'down';

    await this.loadMap(mapIdToLoad, spawnX, spawnY, spawnDir, true);
    GlobalAtlasDebugOverlay.setCamera(GlobalThreeRenderer.camera);

    // 4. Build Pixi HUD
    this.buildHUD();

    // Expose global diagnostic scan helper
    (window as any).runDiagnosticScan = () => this.runDiagnosticScan();

    // 5. Register Event Listeners
    GlobalEventBus.on('map:warp', this.boundWarpHandler);
    GlobalEventBus.on('toast:message', this.boundToastHandler);
    GlobalEventBus.on('battle:encounter', (encounter: { speciesId: string; level: number }) => {
      PokedexSystem.markSeen(encounter.speciesId);
      const wildCreature = StatCalculator.createCreatureInstance(encounter.speciesId, encounter.level);
      const saveState = GlobalSaveService.getCurrentState();
      if (saveState.party.length === 0) {
        saveState.party.push(StatCalculator.createCreatureInstance('maga', 5));
      }

      GlobalSceneManager.pushScene('Battle', {
        battleType: 'wild',
        playerParty: saveState.party,
        opponentParty: [wildCreature],
        onBattleEnd: (victory: boolean, capturedCreature?: CreatureInstance) => {
          if (capturedCreature) {
            PokedexSystem.markCaught(capturedCreature.speciesId);
            saveState.party.push(capturedCreature);
            GlobalSaveService.save();
          }
          GlobalSceneManager.popScene();
        },
      });
    });
  }

  public runDiagnosticScan(): void {
    const scene = GlobalThreeRenderer.scene;
    console.log('==================================================');
    console.log('🔍 [DIAGNOSTIC SCAN] Starting Three.js Scene Tree Audit');
    console.log('==================================================');

    let totalNodes = 0;
    let playerFound = false;

    const traverse = (obj: THREE.Object3D, depth = 0) => {
      totalNodes++;
      const indent = '  '.repeat(depth);
      const isPlayer = obj === this.player.character.mesh || obj === this.player.character.spriteMesh;
      if (obj === this.player.character.mesh) playerFound = true;

      const tag = isPlayer ? ' ⭐ [PLAYER]' : '';
      console.log(
        `${indent}- ${obj.constructor.name} (ID: ${obj.id}, Name: "${obj.name}") | Vis: ${obj.visible} | Pos: (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)}) | Scale: (${obj.scale.x.toFixed(2)}, ${obj.scale.y.toFixed(2)}, ${obj.scale.z.toFixed(2)})${tag}`
      );

      if (isPlayer && (obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
        console.log(`${indent}   ↳ Material: type=${mat.type}, transparent=${mat.transparent}, opacity=${mat.opacity}, map=${!!mat.map}`);
      }

      obj.children.forEach((child) => traverse(child, depth + 1));
    };

    traverse(scene);

    console.log('--------------------------------------------------');
    console.log(`[DIAGNOSTIC SUMMARY] Total Nodes: ${totalNodes}`);
    console.log(`[PLAYER CHECK] Player Mesh Attached to Scene: ${this.player.character.mesh.parent === scene}`);
    console.log(`[PLAYER CHECK] Player Found in Tree: ${playerFound}`);
    console.log(`[PLAYER CHECK] Player Visible: ${this.player.character.mesh.visible}`);
    console.log(`[PLAYER CHECK] Player Position: (${this.player.character.worldX.toFixed(2)}, 0, ${this.player.character.worldZ.toFixed(2)})`);
    console.log(`[PLAYER CHECK] Camera Position: (${GlobalThreeRenderer.camera.position.x.toFixed(2)}, ${GlobalThreeRenderer.camera.position.y.toFixed(2)}, ${GlobalThreeRenderer.camera.position.z.toFixed(2)})`);
    console.log(`[PLAYER CHECK] Texture Assigned: ${!!this.player.character.spriteMaterial.map}`);
    console.log('==================================================');

    this.showToast('🔍 Diagnóstico 3D impreso en consola (F12)', 2500);
  }

  /**
   * Loads and builds a map by ID
   */
  private async loadMap(
    mapId: string,
    spawnX: number,
    spawnY: number,
    spawnDir: Direction,
    instantCamera = false
  ): Promise<void> {
    const scene = GlobalThreeRenderer.scene;
    this.currentMap = WorldGraph.getMap(mapId);

    // Safety check: Prevent spawning inside non-walkable collision tiles (e.g. water fountain)
    if (this.currentMap.collision[spawnY] && this.currentMap.collision[spawnY][spawnX]) {
      spawnX = 6;
      spawnY = 8;
    }

    // 1. Clean existing map & NPC meshes
    this.mapRenderer.clear();
    this.npcs.forEach(({ character }) => {
      character.destroy();
    });
    this.npcs.clear();

    // 2. Adjust Lighting & Sky Colors
    scene.background = new THREE.Color(this.currentMap.skyColor || 0x38bdf8);
    if (this.currentMap.sunlightColor) {
      this.sunLight.color.setHex(this.currentMap.sunlightColor);
    }
    if (this.currentMap.indoor) {
      this.ambientLight.intensity = 1.2;
      this.sunLight.intensity = 1.0;
    } else {
      this.ambientLight.intensity = 0.9;
      this.sunLight.intensity = 1.8;
    }

    this.sunLight.position.set(spawnX + 10, 22, spawnY + 12);
    this.sunLight.target.position.set(spawnX, 0, spawnY);
    if (!this.sunLight.target.parent) {
      scene.add(this.sunLight.target);
    }

    // 3. Build 3D Map in Three.js
    this.mapRenderer.buildMap(this.currentMap, scene);

    // 4. Setup Player
    this.player.setMap(this.currentMap);
    this.player.setPosition(spawnX, spawnY, spawnDir);
    this.player.character.updateTexture();
    this.player.character.mesh.visible = true;
    if (this.player.character.mesh.parent !== scene) {
      scene.add(this.player.character.mesh);
    }

    // 5. Spawn NPCs & Update Quest Markers
    if (this.currentMap.npcs) {
      this.currentMap.npcs.forEach((npcData) => {
        const npcChar = new BillboardCharacter(
          npcData.paletteId,
          npcData.x,
          npcData.y,
          npcData.direction
        );
        const marker = GlobalQuestSystem.getNpcQuestMarker(npcData.id);
        npcChar.setQuestMarker(marker);

        scene.add(npcChar.mesh);
        this.npcs.set(npcData.id, { character: npcChar, data: npcData });
      });
    }

    // 6. Setup Camera Bounds & Target strictly aligned to player 3D coordinates
    this.cameraController.setBounds(0, this.currentMap.width, 0, this.currentMap.height);
    this.cameraController.recenterOnPlayer(this.player.character.worldX, this.player.character.worldZ, instantCamera);

    // 7. Update SaveState
    const state = GlobalSaveService.getCurrentState();
    state.player.mapId = this.currentMap.id;
    state.player.position.x = spawnX;
    state.player.position.z = spawnY;
    state.player.direction = spawnDir;
    GlobalSaveService.save(GlobalSaveService.getActiveSlot(), state);

    // 8. Show Map Name Banner & Trigger Adaptive Brand BGM
    this.showMapBanner(this.currentMap.name);

    if (this.currentMap.id === 'bosque_eco' || this.currentMap.id === 'cueva_eco' || this.currentMap.id === 'interior_gym') {
      GlobalAudioService.playZoneBgm('cueva');
    } else if (this.currentMap.id === 'ruta_claro' || this.currentMap.id === 'ruta_1') {
      GlobalAudioService.playZoneBgm('ruta');
    } else {
      GlobalAudioService.playZoneBgm('aldea');
    }

    if (mapId === 'interior_center') {
      const state = GlobalSaveService.getCurrentState();
      if (!state.flags?.tutorial_center_shown) {
        state.flags.tutorial_center_shown = true;
        GlobalSaveService.save();
        this.showToast('💡 ¡Consejo: El Centro de Sanación restaura gratis a todo tu equipo!', 4000);
      }
    }
  }

  private async executeWarp(params: {
    targetMapId: string;
    targetX: number;
    targetY: number;
    targetDirection: Direction;
  }): Promise<void> {
    if (this.isWarping) return;
    this.isWarping = true;

    GlobalAudioService.playSfx('step');

    await this.fadeTransition(0, 1, 0.22);
    await this.loadMap(
      params.targetMapId,
      params.targetX,
      params.targetY,
      params.targetDirection,
      true
    );
    await this.fadeTransition(1, 0, 0.22);

    this.isWarping = false;
  }

  private fadeTransition(startAlpha: number, endAlpha: number, durationSec: number): Promise<void> {
    return new Promise((resolve) => {
      const width = GlobalPixiRenderer.width;
      const height = GlobalPixiRenderer.height;
      const curtain = new Graphics();
      curtain.rect(0, 0, width, height);
      curtain.fill({ color: 0x000000 });
      curtain.alpha = startAlpha;
      GlobalPixiRenderer.transitionLayer.addChild(curtain);

      const startTime = performance.now();
      const durationMs = durationSec * 1000;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1.0, elapsed / durationMs);
        curtain.alpha = startAlpha + (endAlpha - startAlpha) * progress;

        if (progress < 1.0) {
          requestAnimationFrame(animate);
        } else {
          curtain.destroy();
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  private buildHUD(): void {
    const width = GlobalPixiRenderer.width;

    this.hudContainer = new Container();
    GlobalPixiRenderer.hudLayer.addChild(this.hudContainer);

    this.toastContainer = new Container();
    GlobalPixiRenderer.hudLayer.addChild(this.toastContainer);

    // Top-Left Action Buttons
    const topBar = new Container();
    topBar.position.set(18, 18);

    const makeBtn = (label: string, x: number, isGoldAccent = false, onClick: () => void) => {
      const btn = new Container();
      btn.position.set(x, 0);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      const btnW = label.length > 5 ? 160 : 64;
      const btnH = 46;

      const bg = new Graphics();
      bg.roundRect(0, 0, btnW, btnH, 8);
      bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
      bg.stroke({ color: isGoldAccent ? COLOR_NUM.gold : COLOR_NUM.bronze, width: 2 });
      btn.addChild(bg);

      // Inner ornate corner hairline
      bg.roundRect(2, 2, btnW - 4, btnH - 4, 6);
      bg.stroke({ color: COLOR_NUM.gold, width: 0.5, alpha: 0.25 });

      const txt = new Text({
        text: label.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 13,
          fontWeight: 'bold',
          fill: isGoldAccent ? COLOR_HEX.gold : COLOR_HEX.parchment,
          letterSpacing: 1,
        }),
      });
      txt.anchor.set(0.5);
      txt.position.set(btnW / 2, btnH / 2);
      btn.addChild(txt);

      btn.on('pointerdown', (e) => {
        e.stopPropagation();
        GlobalAudioService.playSfx('select');
        onClick();
      });

      return btn;
    };

    topBar.addChild(makeBtn('↶ Q', 0, false, () => this.cameraController.rotateLeft()));
    topBar.addChild(makeBtn('↷ E', 72, false, () => this.cameraController.rotateRight()));
    topBar.addChild(
      makeBtn('📜 MISIONES', 144, true, () => {
        GlobalSceneManager.pushScene('QuestLog');
      })
    );
    topBar.addChild(
      makeBtn('🎯 CENTRAR', 312, false, () => {
        this.cameraController.recenterOnPlayer(
          this.player.character.worldX,
          this.player.character.worldZ,
          true
        );
        this.showToast('🎯 Cámara Recentrada en el Jugador', 1500);
      })
    );
    topBar.addChild(
      makeBtn('📷 DIAGNÓSTICO', 480, false, () => {
        const active = this.cameraDebugOverlay.toggle();
        this.showToast(active ? '🛠️ Overlay Frustum & Crosshair ACTIVADO' : '🛠️ Overlay Desactivado', 2000);
        this.runDiagnosticScan();
      })
    );
    topBar.addChild(
      makeBtn('📖 CÓDICE', 648, false, () => {
        GlobalSceneManager.pushScene('Pokedex');
      })
    );
    topBar.addChild(
      makeBtn('🛍️ MERCADO', 816, true, () => {
        GlobalSceneManager.pushScene('Shop');
      })
    );
    topBar.addChild(
      makeBtn('🐾 EQUIPO', 984, false, () => {
        GlobalSceneManager.pushScene('CreatureDetail');
      })
    );

    this.hudContainer.addChild(topBar);
  }

  private showMapBanner(mapName: string): void {
    const banner = new Container();
    const width = GlobalPixiRenderer.width;
    banner.position.set(width / 2, 90);

    const bg = new Graphics();
    bg.roundRect(-260, -28, 520, 56, 12);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    banner.addChild(bg);

    // Inner gold hairline frame
    bg.roundRect(-256, -24, 512, 48, 10);
    bg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.3 });

    const txt = new Text({
      text: `📍 ${mapName}`.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 18,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 2,
        stroke: { color: COLOR_HEX.inkCrypt, width: 3 },
      }),
    });
    txt.anchor.set(0.5);
    banner.addChild(txt);

    GlobalPixiRenderer.hudLayer.addChild(banner);

    setTimeout(() => {
      banner.destroy({ children: true });
    }, 3200);
  }

  public showToast(message: string, duration = 2400): void {
    const toast = new Container();
    const width = GlobalPixiRenderer.width;

    const bg = new Graphics();
    bg.roundRect(-280, -28, 560, 56, 12);
    bg.fill({ color: COLOR_NUM.smokedWood, alpha: 0.95 });
    bg.stroke({ color: COLOR_NUM.gold, width: 2 });
    toast.addChild(bg);

    const txt = new Text({
      text: message,
      style: new TextStyle({
        fontFamily: FONTS.hud,
        fontSize: 15,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 0.5,
        stroke: { color: COLOR_HEX.inkCrypt, width: 2.5 },
      }),
    });
    txt.anchor.set(0.5);
    toast.addChild(txt);

    toast.position.set(width / 2, 160);
    this.toastContainer.addChild(toast);

    setTimeout(() => {
      toast.destroy({ children: true });
    }, duration);
  }

  public resume(): void {
    const scene = GlobalThreeRenderer.scene;

    // 1. Ensure Player Mesh is attached & visible
    if (this.player && this.player.character) {
      if (this.player.character.mesh.parent !== scene) {
        scene.add(this.player.character.mesh);
      }
      this.player.character.mesh.visible = true;
      this.player.character.updateTexture();
    }

    // 2. Ensure NPC Meshes are attached & visible
    this.npcs.forEach(({ character }) => {
      if (character.mesh.parent !== scene) {
        scene.add(character.mesh);
      }
      character.mesh.visible = true;
    });

    // 3. Ensure Lighting is attached
    if (this.ambientLight && this.ambientLight.parent !== scene) {
      scene.add(this.ambientLight);
    }
    if (this.sunLight && this.sunLight.parent !== scene) {
      scene.add(this.sunLight);
    }
    if (this.sunLight && this.sunLight.target && this.sunLight.target.parent !== scene) {
      scene.add(this.sunLight.target);
    }

    // 4. Rebuild Pixi HUD
    this.buildHUD();

    // 5. Strictly recenter camera on player position
    const px = this.player ? this.player.character.worldX : 6;
    const pz = this.player ? this.player.character.worldZ : 8;
    this.cameraController.setBounds(0, this.currentMap ? this.currentMap.width : 30, 0, this.currentMap ? this.currentMap.height : 30);
    this.cameraController.recenterOnPlayer(px, pz, true);
    GlobalAtlasDebugOverlay.setCamera(GlobalThreeRenderer.camera);
  }

  public update(dt: number): void {
    if (this.isWarping) return;

    // 1. Update Player Movement & Camera unconditionally to ensure player is never lost
    if (!this.isDialogueOpen && !this.isMenuOpen) {
      this.player.update(dt, this.cameraController.currentYaw);
    }

    const px = this.player.character.worldX;
    const pz = this.player.character.worldZ;

    // 2. Update Map Animations, Lighting & Camera
    this.mapRenderer.update(dt, this.cameraController.currentYaw, 0.72, px, pz);
    this.mapRenderer.updateOcclusion(px, pz, GlobalThreeRenderer.camera.position);
    GlobalAtlasDebugOverlay.setMapContext(this.currentMap, Math.round(px), Math.round(pz));

    this.sunLight.position.set(px + 10, 22, pz + 12);
    this.sunLight.target.position.set(px, 0, pz);
    this.sunLight.target.updateMatrixWorld();

    this.cameraController.setTarget(px, pz);
    this.cameraController.update(dt);

    // Update floating 2D overworld stamina bar projected above player's head
    this.updateStaminaBar();

    const cam = GlobalThreeRenderer.camera;
    this.player.character.updateBillboard(cam, dt);
    this.npcs.forEach(({ character, data }) => {
      const marker = GlobalQuestSystem.getNpcQuestMarker(data.id);
      character.setQuestMarker(marker);
      character.updateBillboard(cam, dt);
    });

    // Update 3D Camera Telemetry Debug Overlay
    this.cameraDebugOverlay.update(this.player, this.cameraController);

    // 3. In-Game Pause Menu Handling
    if (this.isMenuOpen) {
      this.handlePauseMenuInput();
      return;
    }

    // 4. Dialogue Logic
    if (this.isDialogueOpen) {
      this.updateTypewriter(dt);
      this.handleDialogueInput();
      return;
    }

    // 5. Open Quest Log on 'SELECT'
    if (GlobalInput.justPressed('SELECT')) {
      GlobalAudioService.playSfx('select');
      GlobalSceneManager.pushScene('QuestLog');
      return;
    }

    // 6. Interaction on CONFIRM
    if (GlobalInput.justPressed('CONFIRM') && !this.player.isMoving) {
      const hit = this.player.interactAhead();
      if (hit.type === 'npc') {
        const npc: MapNPC = hit.target;
        const npcChar = this.npcs.get(npc.id)?.character;
        if (npcChar) {
          npcChar.setDirection(this.getOppositeDirection(this.player.character.direction));
        }

        // Notify QuestSystem of talking to this NPC
        GlobalQuestSystem.handleTalkToNpc(npc.id);

        if (npc.id === 'npc_boss_guardian') {
          const saveState = GlobalSaveService.getCurrentState();
          if (!saveState.flags?.bosque_eco_boss) {
            const bossParty = [
              StatCalculator.createCreatureInstance('umbrito', 16),
              StatCalculator.createCreatureInstance('noctarro', 18),
              StatCalculator.createCreatureInstance('rocalin', 16),
            ];
            GlobalSceneManager.pushScene('Battle', {
              battleType: 'boss',
              playerParty: saveState.party,
              opponentParty: bossParty,
              onBattleEnd: (victory: boolean) => {
                GlobalSceneManager.popScene();
                if (victory) {
                  saveState.flags.bosque_eco_boss = true;
                  if (!saveState.keyItems) saveState.keyItems = [];
                  if (!saveState.keyItems.includes('sello_eco')) saveState.keyItems.push('sello_eco');
                  saveState.player.money += 2500;
                  GlobalQuestSystem.completeQuest('main_3_forest_boss');
                  GlobalSaveService.save();
                  GlobalSceneManager.pushScene('Credits');
                } else {
                  this.showToast('⚔️ El Guardián del Eco te ha derrotado. ¡Entrena y reintenta!', 3500);
                }
              },
            });
            return;
          }
        }

        // Find associated Dialogue Tree
        const treeId = this.getDialogueTreeForNpc(npc.id);
        if (treeId) {
          this.startDialogueTree(treeId);
        } else {
          this.openSimpleDialogue(npc.name, npc.dialogueLines);
        }
      } else if (hit.type === 'sign') {
        if (this.currentMap.id === 'interior_center' && hit.target.x === 8 && hit.target.y === 2) {
          GlobalAudioService.playSfx('select');
          GlobalSceneManager.pushScene('StorageBox');
        } else if (hit.target.shopCategory) {
          // Req. 7: TIENDA INTERACTIVA (Cuerpos, Armas, Cristales, Souls, Encargos)
          GlobalAudioService.playSfx('select');
          if (hit.target.shopCategory === 'quests') {
            GlobalSceneManager.pushScene('QuestLog');
          } else {
            GlobalSceneManager.pushScene('Shop', { mode: 'buy', category: hit.target.shopCategory });
          }
        } else if (hit.target.shopMode) {
          // Req. 7: Mostrador abre el menú Comprar/Vender
          GlobalAudioService.playSfx('select');
          GlobalSceneManager.pushScene('Shop', { mode: hit.target.shopMode || 'buy' });
        } else {
          this.openSimpleDialogue('Cartel', [hit.target.text]);
        }
      } else if (hit.type === 'decor') {
        // Bloque 36 Req. 6: Interactive Overworld Decor (doll_arm_buried, sparkle_hidden, mana_berry_plant, bones)
        GlobalAudioService.playSfx('select');
        this.openSimpleDialogue(hit.target.title, hit.target.lines);
      } else if (hit.type === 'water') {
        this.openSimpleDialogue('Agua', ['El agua es cristalina y profunda.']);
      }
    }

    // 7. Toggle Menu on MENU action (ESC / Start / Menu Key)
    if (GlobalInput.justPressed('MENU') && !this.player.isMoving) {
      this.openMenu();
    }
  }

  // --- In-Game Pause Menu ---
  public openMenu(): void {
    if (this.isMenuOpen || this.isDialogueOpen) return;
    this.isMenuOpen = true;
    this.selectedMenuIndex = 0;
    GlobalAudioService.playSfx('select');
    this.renderMenuUI();
  }

  public closeMenu(): void {
    if (!this.isMenuOpen) return;
    this.isMenuOpen = false;
    if (this.menuContainer) {
      this.menuContainer.destroy({ children: true });
      this.menuContainer = null;
    }
    GlobalAudioService.playSfx('cancel');
  }

  private handlePauseMenuInput(): void {
    if (GlobalInput.justPressed('UP')) {
      this.selectedMenuIndex = (this.selectedMenuIndex - 1 + this.menuItemsList.length) % this.menuItemsList.length;
      GlobalAudioService.playSfx('select');
      this.renderMenuUI();
    } else if (GlobalInput.justPressed('DOWN')) {
      this.selectedMenuIndex = (this.selectedMenuIndex + 1) % this.menuItemsList.length;
      GlobalAudioService.playSfx('select');
      this.renderMenuUI();
    }

    if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.closeMenu();
    }

    if (GlobalInput.justPressed('CONFIRM')) {
      const item = this.menuItemsList[this.selectedMenuIndex];
      if (item) {
        GlobalAudioService.playSfx('confirm');
        const act = item.action;
        this.closeMenu();
        act();
      }
    }
  }

  private renderMenuUI(): void {
    if (this.menuContainer) {
      this.menuContainer.destroy({ children: true });
    }

    this.menuContainer = new Container();
    this.menuContainer.zIndex = 950;
    GlobalPixiRenderer.menuLayer.addChild(this.menuContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    // Backdrop shadow
    const curtain = new Graphics();
    curtain.rect(0, 0, width, height);
    curtain.fill({ color: 0x000000, alpha: 0.65 });
    curtain.eventMode = 'static';
    curtain.on('pointerdown', () => this.closeMenu());
    this.menuContainer.addChild(curtain);

    // Right-aligned pause panel (Mobile First: 360px wide with touch-friendly spacing)
    const panelWidth = 360;
    const panelHeight = Math.min(height - 40, this.menuItemsList.length * 56 + 100);
    const panelX = width - panelWidth - 25;
    const panelY = (height - panelHeight) / 2;

    const panelBg = new Graphics();
    panelBg.roundRect(panelX, panelY, panelWidth, panelHeight, 14);
    panelBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    panelBg.stroke({ color: COLOR_NUM.bronze, width: 3 });
    this.menuContainer.addChild(panelBg);

    // Inner hairline frame
    panelBg.roundRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8, 10);
    panelBg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.35 });

    // Header
    const header = new Text({
      text: '⚙️ MENÚ PRINCIPAL',
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: 18,
        fontWeight: 'bold',
        fill: COLOR_HEX.gold,
        letterSpacing: 2,
        stroke: { color: COLOR_HEX.inkCrypt, width: 3 },
      }),
    });
    header.anchor.set(0.5);
    header.position.set(panelX + panelWidth / 2, panelY + 36);
    this.menuContainer.addChild(header);

    // Menu options (Mobile First: 50px tall touch targets, 16px bold typography)
    const itemStartY = panelY + 70;
    this.menuItemsList.forEach((item, idx) => {
      const isSel = idx === this.selectedMenuIndex;
      const itemY = itemStartY + idx * 54;

      const itemBtn = new Container();
      itemBtn.position.set(panelX + 16, itemY);
      itemBtn.eventMode = 'static';
      itemBtn.cursor = 'pointer';

      const btnBg = new Graphics();
      btnBg.roundRect(0, 0, panelWidth - 32, 48, 8);
      btnBg.fill({ color: isSel ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      btnBg.stroke({ color: isSel ? COLOR_NUM.white : COLOR_NUM.bronze, width: isSel ? 2 : 1 });
      itemBtn.addChild(btnBg);

      const btnText = new Text({
        text: item.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 15,
          fontWeight: 'bold',
          fill: isSel ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment,
          letterSpacing: 0.8,
        }),
      });
      btnText.anchor.set(0, 0.5);
      btnText.position.set(16, 24);
      itemBtn.addChild(btnText);

      itemBtn.on('pointerdown', (e) => {
        e.stopPropagation();
        this.selectedMenuIndex = idx;
        GlobalAudioService.playSfx('confirm');
        const act = item.action;
        this.closeMenu();
        act();
      });

      this.menuContainer?.addChild(itemBtn);
    });
  }

  private getDialogueTreeForNpc(npcId: string): string | null {
    switch (npcId) {
      case 'npc_prof_roble':
      case 'npc_prof_roble_lab':
        return 'prof_roble_intro';
      case 'npc_mom':
        return 'mom_dialogue';
      case 'npc_nurse_joy':
        return 'nurse_joy_dialogue';
      case 'npc_shop_clerk':
        return 'shopkeeper_dialogue';
      case 'npc_guide_leo':
        return 'guide_leo_dialogue';
      case 'npc_trainer_clara':
        return 'trainer_clara_dialogue';
      case 'npc_girl_mia':
        return 'mia_dialogue';
      case 'npc_boss_guardian':
        return 'guardian_dialogue';
      default:
        return null;
    }
  }

  private getOppositeDirection(dir: Direction): Direction {
    switch (dir) {
      case 'up': return 'down';
      case 'down': return 'up';
      case 'left': return 'right';
      case 'right': return 'left';
    }
  }

  // --- Rich Dialogue Tree & Typewriter UI ---

  public startDialogueTree(treeId: string): void {
    const node = GlobalDialogueSystem.startDialogue(treeId);
    if (!node) return;

    this.isDialogueOpen = true;
    this.currentNode = node;
    this.selectedOptionIndex = 0;
    GlobalAudioService.playSfx('confirm');
    this.renderNodeUI(node);
  }

  public openSimpleDialogue(speaker: string, lines: string[]): void {
    if (!lines || lines.length === 0) return;
    const fakeNode: DialogueNode = {
      id: 'simple_0',
      speakerName: speaker,
      text: lines.join('\n\n'),
    };
    this.isDialogueOpen = true;
    this.currentNode = fakeNode;
    this.selectedOptionIndex = 0;
    GlobalAudioService.playSfx('confirm');
    this.renderNodeUI(fakeNode);
  }

  private renderNodeUI(node: DialogueNode): void {
    if (this.dialogueBoxContainer) {
      this.dialogueBoxContainer.destroy({ children: true });
    }

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.dialogueBoxContainer = new Container();
    this.dialogueBoxContainer.zIndex = 500;
    this.dialogueBoxContainer.eventMode = 'static';
    this.dialogueBoxContainer.cursor = 'pointer';

    // Click on box accelerates or advances
    this.dialogueBoxContainer.on('pointerdown', (e) => {
      e.stopPropagation();
      this.handleAdvanceAction();
    });

    GlobalPixiRenderer.dialogueLayer.addChild(this.dialogueBoxContainer);

    const boxWidth = width - 60;
    const boxHeight = 190;
    const boxX = 30;
    const boxY = height - boxHeight - 20;

    // Background Card
    const bg = new Graphics();
    bg.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
    bg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.95 });
    bg.stroke({ color: COLOR_NUM.bronze, width: 2.5 });
    this.dialogueBoxContainer.addChild(bg);

    // Inner gold hairline border inside Dialogue box
    bg.roundRect(boxX + 4, boxY + 4, boxWidth - 8, boxHeight - 8, 8);
    bg.stroke({ color: COLOR_NUM.gold, width: 1, alpha: 0.3 });

    // Speaker Name Tag (Big & Bold - Mobile First: 16px)
    if (node.speakerName) {
      const nameTag = new Graphics();
      nameTag.roundRect(boxX + 24, boxY - 22, 260, 44, 8);
      nameTag.fill({ color: COLOR_NUM.bronze });
      nameTag.stroke({ color: COLOR_NUM.gold, width: 2 });
      this.dialogueBoxContainer.addChild(nameTag);

      const nameTxt = new Text({
        text: node.speakerName.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONTS.title,
          fontSize: 16,
          fontWeight: 'bold',
          fill: COLOR_HEX.parchment,
          letterSpacing: 1.2,
        }),
      });
      nameTxt.anchor.set(0.5);
      nameTxt.position.set(boxX + 24 + 130, boxY);
      this.dialogueBoxContainer.addChild(nameTxt);
    }

    // Speaker Avatar Portrait (if palette is known)
    let textLeftOffset = 30;
    if (node.speakerPaletteId) {
      const tex = GlobalAssetRegistry.getCharacterFramePixi(node.speakerPaletteId, 'down', 0);
      const portrait = new Sprite(tex);
      portrait.scale.set(2.4);
      portrait.position.set(boxX + 24, boxY + 28);
      this.dialogueBoxContainer.addChild(portrait);
      textLeftOffset = 120;
    }

    // Text Display (Mobile First: 18px font with 26px line height)
    this.typewriterFullText = node.text;
    this.typewriterCurrentLength = 0;
    this.typewriterTimer = 0;
    this.isTypewriterComplete = false;

    this.textDisplayObject = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 26,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: boxWidth - textLeftOffset - 40,
      }),
    });
    this.textDisplayObject.position.set(boxX + textLeftOffset, boxY + 28);
    this.dialogueBoxContainer.addChild(this.textDisplayObject);

    // Options Cards (rendered if node has options)
    this.renderOptions(node, boxX, boxY, boxWidth);
  }

  private renderOptions(node: DialogueNode, boxX: number, boxY: number, boxWidth: number): void {
    this.optionsContainers = [];
    if (!node.options || node.options.length === 0) return;

    const optHeight = 56;
    const startY = boxY - (node.options.length * (optHeight + 10)) - 14;

    node.options.forEach((opt, idx) => {
      const optBox = new Container();
      optBox.position.set(boxX + boxWidth - 460, startY + idx * (optHeight + 10));
      optBox.eventMode = 'static';
      optBox.cursor = 'pointer';

      const bg = new Graphics();
      const isSel = idx === this.selectedOptionIndex;
      bg.roundRect(0, 0, 460, optHeight, 10);
      bg.fill({ color: isSel ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: isSel ? COLOR_NUM.white : COLOR_NUM.bronze, width: isSel ? 2 : 1.5 });
      optBox.addChild(bg);

      const label = new Text({
        text: opt.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 16,
          fontWeight: 'bold',
          fill: isSel ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment,
          letterSpacing: 0.8,
        }),
      });
      label.position.set(20, 16);
      optBox.addChild(label);

      optBox.on('pointerdown', (e) => {
        e.stopPropagation();
        this.selectedOptionIndex = idx;
        this.chooseCurrentOption();
      });

      this.dialogueBoxContainer?.addChild(optBox);
      this.optionsContainers.push(optBox);
    });
  }

  private updateOptionsHighlight(): void {
    if (!this.currentNode?.options) return;
    this.optionsContainers.forEach((container, idx) => {
      const bg = container.children[0] as Graphics;
      const label = container.children[1] as Text;
      const isSel = idx === this.selectedOptionIndex;
      bg.clear();
      bg.roundRect(0, 0, 440, 52, 8);
      bg.fill({ color: isSel ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: isSel ? COLOR_NUM.white : COLOR_NUM.bronze, width: isSel ? 1.5 : 1 });
      if (label) {
        label.style.fill = isSel ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment;
      }
    });
  }

  private updateTypewriter(dt: number): void {
    if (!this.isTypewriterComplete && this.textDisplayObject) {
      this.typewriterTimer += dt * this.typewriterSpeed;
      const targetLen = Math.floor(this.typewriterTimer);
      if (targetLen > this.typewriterCurrentLength) {
        this.typewriterCurrentLength = Math.min(targetLen, this.typewriterFullText.length);
        this.textDisplayObject.text = this.typewriterFullText.slice(0, this.typewriterCurrentLength);

        if (this.typewriterCurrentLength >= this.typewriterFullText.length) {
          this.isTypewriterComplete = true;
        }
      }
    }
  }

  private handleDialogueInput(): void {
    const input = GlobalInput;

    // Navigate choices
    if (this.currentNode?.options && this.currentNode.options.length > 0) {
      if (input.justPressed('UP')) {
        if (this.selectedOptionIndex > 0) {
          this.selectedOptionIndex--;
          GlobalAudioService.playSfx('select');
          this.updateOptionsHighlight();
        }
      } else if (input.justPressed('DOWN')) {
        if (this.selectedOptionIndex < this.currentNode.options.length - 1) {
          this.selectedOptionIndex++;
          GlobalAudioService.playSfx('select');
          this.updateOptionsHighlight();
        }
      }
    }

    if (input.justPressed('CONFIRM')) {
      this.handleAdvanceAction();
    } else if (input.justPressed('CANCEL')) {
      if (this.isTypewriterComplete) {
        this.closeDialogue();
      } else {
        // Fast forward text
        this.completeTypewriterInstant();
      }
    }
  }

  private handleAdvanceAction(): void {
    if (!this.isTypewriterComplete) {
      // 1. First click fast-forwards text
      this.completeTypewriterInstant();
    } else {
      // 2. Second click chooses option or advances
      if (this.currentNode?.options && this.currentNode.options.length > 0) {
        this.chooseCurrentOption();
      } else {
        const next = GlobalDialogueSystem.advance();
        if (next) {
          this.currentNode = next;
          this.selectedOptionIndex = 0;
          GlobalAudioService.playSfx('select');
          this.renderNodeUI(next);
        } else {
          this.closeDialogue();
        }
      }
    }
  }

  private completeTypewriterInstant(): void {
    this.typewriterCurrentLength = this.typewriterFullText.length;
    if (this.textDisplayObject) {
      this.textDisplayObject.text = this.typewriterFullText;
    }
    this.isTypewriterComplete = true;
  }

  private chooseCurrentOption(): void {
    const next = GlobalDialogueSystem.selectOption(this.selectedOptionIndex);
    if (next) {
      this.currentNode = next;
      this.selectedOptionIndex = 0;
      GlobalAudioService.playSfx('confirm');
      this.renderNodeUI(next);
    } else {
      this.closeDialogue();
    }
  }

  private updateStaminaBar(): void {
    const player = this.player;
    if (!player) return;

    // Only show stamina bar if it's not full
    if (player.stamina >= player.maxStamina) {
      if (this.staminaBar) {
        this.staminaBar.visible = false;
      }
      return;
    }

    if (!this.staminaBar) {
      this.staminaBar = new Graphics();
      this.hudContainer.addChild(this.staminaBar);
    }

    this.staminaBar.visible = true;
    this.staminaBar.clear();

    // Project player's 3D position to 2D screen coordinates
    const tempV = new THREE.Vector3();
    player.character.mesh.getWorldPosition(tempV);
    tempV.y += 1.8; // Offset slightly above the player sprite head

    const cam = GlobalThreeRenderer.camera;
    tempV.project(cam);

    const screenX = (tempV.x * 0.5 + 0.5) * GlobalPixiRenderer.width;
    const screenY = (-(tempV.y * 0.5) + 0.5) * GlobalPixiRenderer.height;

    // Draw stamina bar layout (matching the Zelda-style / Genshin-style overworld feel)
    const barW = 54;
    const barH = 6;
    const ratio = player.stamina / player.maxStamina;

    // Glassmorphic background plate
    this.staminaBar.roundRect(screenX - barW / 2, screenY, barW, barH, 3);
    this.staminaBar.fill({ color: COLOR_NUM.smokedWood, alpha: 0.85 });
    this.staminaBar.stroke({ color: COLOR_NUM.bronze, width: 1 });

    // Progress bar fill (glow cyan for ki sprint, red if tired/depleted)
    if (ratio > 0) {
      const fillW = Math.max(1, (barW - 2) * ratio);
      const fillColor = player.isTired ? COLOR_SEMANTIC.danger : COLOR_NUM.cyan;
      this.staminaBar.roundRect(screenX - barW / 2 + 1, screenY + 1, fillW, barH - 2, 2);
      this.staminaBar.fill({ color: fillColor });
    }
  }

  private closeDialogue(): void {
    this.isDialogueOpen = false;
    this.currentNode = null;
    if (this.dialogueBoxContainer) {
      this.dialogueBoxContainer.destroy({ children: true });
      this.dialogueBoxContainer = null;
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    GlobalEventBus.off('map:warp', this.boundWarpHandler);
    GlobalEventBus.off('toast:message', this.boundToastHandler);

    this.cameraDebugOverlay.destroy();
    this.mapRenderer.clear();
    
    if (this.staminaBar) {
      this.staminaBar.destroy({ children: true });
      this.staminaBar = null;
    }

    this.hudContainer.destroy({ children: true });
    this.toastContainer.destroy({ children: true });
    if (this.dialogueBoxContainer) {
      this.dialogueBoxContainer.destroy({ children: true });
    }
    this.player.character.destroy();
    this.npcs.forEach(({ character }) => character.destroy());
    this.npcs.clear();
  }
}
