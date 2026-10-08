import * as THREE from 'three';
import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalThreeRenderer } from '../render/ThreeRenderer';
import { MapRenderer } from '../render/overworld/MapRenderer';
import { OverworldCamera } from '../render/overworld/OverworldCamera';
import { OverworldPlayer } from '../systems/OverworldPlayer';
import { BillboardCharacter } from '../render/overworld/BillboardCharacter';
import { WorldGraph } from '../data/maps/worldGraph';
import { MapLoader } from '../data/maps/MapLoader';
import { MapData, MapNPC, MapWarp } from '../types/maps';
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
import { OverworldHud } from '../ui/hud/OverworldHud';
import { StarterSelectionModal } from '../ui/hud/StarterSelectionModal';
import { StarterLabSystem } from '../systems/lab/StarterLabSystem';
import { SOUL_SPECIES_DATA } from '../data/souldolls/souls';
import { isDebugEnabled } from '../core/DebugGate';
import { GlobalOverworldDecor } from '../render/overworld/DecorRenderer';
import { SoulMetaballSystem } from '../systems/overworld/SoulMetaballSystem';
import { GlobalTileRenderer } from '../render/overworld/TileRenderer';
import {
  ScreenFrame,
  KitCard,
  KitListRow,
  KitButton,
  IconRegistry,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_SEMANTIC } from '../ui/styles';
import esText from '../data/text/es.json';

export class OverworldScene implements IScene {
  public name = 'Overworld';

  private mapRenderer: MapRenderer;
  private cameraController: OverworldCamera;
  private cameraDebugOverlay: any = null;
  private atlasDebugOverlay: any = null;
  private player: OverworldPlayer;
  private currentMap!: MapData;
  private npcs: Map<string, { character: BillboardCharacter; data: MapNPC }> = new Map();
  private soulMetaballSystem: SoulMetaballSystem | null = null;

  // Ambient Lighting
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;

  // Pixi UI containers
  private hudContainer: Container = new Container();
  private overworldHud: OverworldHud | null = null;
  private toastContainer: Container = new Container();

  // In-Game Pause Menu (Bloque 43 Req. 5: Strictly Souldolls, Mochila, Códice de Almas, Misiones, Guardar, Opciones, Salir al título)
  private menuContainer: Container | null = null;
  private menuScreenFrame: ScreenFrame | null = null;
  private menuFocusManager: FocusManager = new FocusManager();
  private isMenuOpen = false;
  private selectedMenuIndex = 0;
  private starterModal: StarterSelectionModal | null = null;

  // Live New-Player Escort Tutorial state (Guía Leo accompanying player to Lab)
  private guideEscortStage: 'none' | 'approaching' | 'talking_welcome' | 'escorting' | 'talking_lab' = 'none';
  private guideWaypoints: Array<{ x: number; y: number; dir: Direction }> = [];
  private guideAnimTimer = 0;

  public getPauseMenuItems() {
    const t = (esText as any).terms.group_a.pause;
    return [
      {
        id: 'party',
        label: t.party,
        subtitle: t.party_sub,
        iconId: 'soul_orb' as const,
        action: () => GlobalSceneManager.pushScene('Party'),
      },
      {
        id: 'bag',
        label: t.bag,
        subtitle: t.bag_sub,
        iconId: 'elixir' as const,
        action: () => GlobalSceneManager.pushScene('Bag'),
      },
      {
        id: 'codex',
        label: t.codex,
        subtitle: t.codex_sub,
        iconId: 'codex_book' as const,
        action: () => GlobalSceneManager.pushScene('Pokedex'),
      },
      {
        id: 'quests',
        label: t.quests,
        subtitle: t.quests_sub,
        iconId: 'quest_scroll' as const,
        action: () => GlobalSceneManager.pushScene('QuestLog'),
      },
      {
        id: 'save',
        label: t.save,
        subtitle: t.save_sub,
        iconId: 'guild_seal' as const,
        action: () => {
          const state = GlobalSaveService.getCurrentState();
          state.player.position.x = this.player.gridX;
          state.player.position.z = this.player.gridY;
          state.player.direction = this.player.character.direction;
          state.player.mapId = this.currentMap.id;
          GlobalSaveService.save();
          this.showToast(esText.dialogue.saved, 2000);
        },
      },
      {
        id: 'options',
        label: t.options || 'OPCIONES',
        subtitle: t.options_sub || 'Audio, cámara, controles táctiles y presentación',
        iconId: 'settings_gear' as const,
        action: () => GlobalSceneManager.pushScene('Options'),
      },
      {
        id: 'title_screen',
        label: t.title_screen,
        subtitle: t.title_screen_sub,
        iconId: 'back' as const,
        action: () => {
          GlobalAudioService.playSfx('confirm');
          GlobalSceneManager.changeScene('Title');
        },
      },
    ];
  }

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
  private boundOpenShopHandler: (params: { mode?: 'buy' | 'sell'; category?: string; source?: string }) => void;
  private boundOpenWorkshopHandler: (params: { tab?: string; source?: string }) => void;
  private boundOpenStorageHandler: (params: { tab?: string; source?: string }) => void;
  private boundBattleEncounterHandler: (encounter: { speciesId: string; level: number }) => void;
  private boundKeyListener: (e: KeyboardEvent) => void;

  constructor() {
    this.mapRenderer = new MapRenderer();
    this.cameraController = new OverworldCamera(GlobalThreeRenderer.camera);
    this.player = new OverworldPlayer('player', 6, 8, 'down');

    this.boundWarpHandler = (params) => this.executeWarp(params);
    this.boundToastHandler = ({ text, duration }) => this.showToast(text, duration);

    // Bloque 43 Req. 6: Services only open from physical NPC/indoor interactions (or debug panel when DEBUG is active)
    this.boundOpenShopHandler = (params) => {
      if (params?.source !== 'npc_dialogue' && params?.source !== 'debug') {
        console.warn('[Bloque43] OpenShop blocked: must originate from physical NPC dialogue.');
        return;
      }
      this.closeDialogue();
      this.closeMenu();
      GlobalSceneManager.pushScene('Shop', { mode: params?.mode || 'buy', category: params?.category });
    };
    this.boundOpenWorkshopHandler = (params) => {
      if (params?.source !== 'npc_dialogue' && params?.source !== 'debug') {
        console.warn('[Bloque43] OpenWorkshop blocked: must originate from physical NPC dialogue.');
        return;
      }
      this.closeDialogue();
      this.closeMenu();
      GlobalSceneManager.pushScene('Workshop', { tab: params?.tab || 'heal' });
    };
    this.boundOpenStorageHandler = (params) => {
      if (params?.source !== 'npc_dialogue' && params?.source !== 'debug') {
        console.warn('[Bloque43] OpenStorage blocked: must originate from physical NPC dialogue.');
        return;
      }
      this.closeDialogue();
      this.closeMenu();
      GlobalSceneManager.pushScene('StorageBox', { tab: params?.tab });
    };
    this.boundBattleEncounterHandler = (encounter: { speciesId: string; level: number }) => {
      PokedexSystem.markSeen(encounter.speciesId);
      const wildCreature = StatCalculator.createCreatureInstance(encounter.speciesId, encounter.level);
      const saveState = GlobalSaveService.getCurrentState();
      if (saveState.party.length === 0) {
        saveState.party.push(StatCalculator.createCreatureInstance('maga', 5));
      }

      GlobalSceneManager.pushSceneWithTransition('Battle', {
        battleType: 'wild',
        playerParty: saveState.party,
        opponentParty: [wildCreature],
        onBattleEnd: async (_victory: boolean, capturedCreature?: CreatureInstance) => {
          if (capturedCreature) {
            PokedexSystem.markCaught(capturedCreature.speciesId);
            GlobalEventBus.emit('creature:caught', {
              speciesId: capturedCreature.speciesId,
              level: capturedCreature.level,
            });
            const alreadyInParty = saveState.party.some((c) => c.uid === capturedCreature.uid);
            const alreadyInStorage = (saveState.storage || []).some((c) => c.uid === capturedCreature.uid);
            if (!alreadyInParty && !alreadyInStorage) {
              if (saveState.party.length < 6) {
                saveState.party.push(capturedCreature);
              } else {
                if (!saveState.storage) saveState.storage = [];
                saveState.storage.push(capturedCreature);
              }
            }
            GlobalSaveService.save();
          }
          await GlobalSceneManager.popScene();
        },
      });
    };

    // Bloque 43 Req. 3: Q / E rotate camera 90° on keyboard; F3 toggles camera telemetry only if DEBUG is active
    this.boundKeyListener = (e: KeyboardEvent) => {
      if (this.isMenuOpen || this.isDialogueOpen || GlobalSceneManager.getCurrentScene()?.name !== 'Overworld') {
        return;
      }
      if (e.code === 'KeyQ') {
        GlobalAudioService.playSfx('select');
        this.cameraController.rotateLeft();
      } else if (e.code === 'KeyE') {
        GlobalAudioService.playSfx('select');
        this.cameraController.rotateRight();
      } else if (e.code === 'F3' && isDebugEnabled() && this.cameraDebugOverlay) {
        e.preventDefault();
        this.cameraDebugOverlay.toggle();
      }
    };
  }

  public async enter(params?: any): Promise<void> {
    GlobalPixiRenderer.clearAllLayers();
    GlobalThreeRenderer.clearScene();
    GlobalTileRenderer.setAuthoringStage(0);

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

    // 3. Load Saved or Initial Map (allowing ?map=<id> override for mapgen/example inspection)
    const savedState = GlobalSaveService.getCurrentState();
    const urlMapParam =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('map') : null;
    const mapIdToLoad = urlMapParam || params?.mapId || savedState.player.mapId || 'aldea_marioneta';
    const targetMapDef = WorldGraph.getMap(mapIdToLoad);
    const defaultSpawn = targetMapDef.spawnPoints?.default || { x: 7, y: 8, direction: 'down' as Direction };
    const spawnX =
      params?.x !== undefined
        ? params.x
        : urlMapParam
        ? defaultSpawn.x
        : savedState.player.position.x !== undefined
        ? savedState.player.position.x
        : defaultSpawn.x;
    const spawnY =
      params?.y !== undefined
        ? params.y
        : urlMapParam
        ? defaultSpawn.y
        : savedState.player.position.z !== undefined
        ? savedState.player.position.z
        : defaultSpawn.y;
    const spawnDir = params?.dir || (urlMapParam ? defaultSpawn.direction : savedState.player.direction) || 'down';

    await this.loadMap(mapIdToLoad, spawnX, spawnY, spawnDir, true);

    // Bloque 43 Req. 2: Dynamically load debug overlays ONLY if DEBUG mode is active
    if (isDebugEnabled()) {
      try {
        const [camDebugMod, atlasDebugMod] = await Promise.all([
          import('../render/overworld/CameraDebugOverlay'),
          import('../render/overworld/AtlasDebugOverlay'),
        ]);
        this.cameraDebugOverlay = new camDebugMod.CameraDebugOverlay();
        this.atlasDebugOverlay = atlasDebugMod.GlobalAtlasDebugOverlay;
        this.atlasDebugOverlay?.setCamera(GlobalThreeRenderer.camera);
        (window as any).__activeMapRenderer = this.mapRenderer;
        (window as any).runDiagnosticScan = () => this.runDiagnosticScan();
      } catch (err) {
        console.warn('[OverworldScene] Optional debug overlays could not be loaded:', err);
      }
    }

    // 4. Build Pixi HUD
    this.buildHUD();

    // 5. Register Event Listeners
    window.addEventListener('keydown', this.boundKeyListener);
    GlobalEventBus.on('map:warp', this.boundWarpHandler);
    GlobalEventBus.on('toast:message', this.boundToastHandler);
    GlobalEventBus.on('OpenShop', this.boundOpenShopHandler);
    GlobalEventBus.on('OpenWorkshop', this.boundOpenWorkshopHandler);
    GlobalEventBus.on('OpenStorage', this.boundOpenStorageHandler);
    GlobalEventBus.on('battle:encounter', this.boundBattleEncounterHandler);
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

    this.showToast('Diagnóstico 3D impreso en consola (F12)', 2500);
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

    // 2. Adjust Lighting & Sky Colors (Bloque 45 Req. 3: Una sola dirección de luz solar coherente desde scale.json)
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

    // Coherent single sun direction [-0.45, -0.82, -0.35] -> light source at (+14, +25, +11) relative to target
    this.sunLight.position.set(spawnX + 14, 25, spawnY + 11);
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

    // 5. Spawn NPCs & Update Quest / Trainer Line-of-Sight Markers (Bloque 45 Req. 2)
    if (this.currentMap.npcs) {
      this.currentMap.npcs.forEach((npcData) => {
        const npcChar = new BillboardCharacter(
          npcData.paletteId,
          npcData.x,
          npcData.y,
          npcData.direction
        );
        const questMarker = GlobalQuestSystem.getNpcQuestMarker(npcData.id);
        const marker = questMarker || (npcData.isTrainer ? '!' : null);
        npcChar.setQuestMarker(marker);

        scene.add(npcChar.mesh);
        this.npcs.set(npcData.id, { character: npcChar, data: npcData });
      });
    }

    // 6. Spawn wandering Soul Metaball entities over grass/cave areas (Bloque 47)
    if (this.soulMetaballSystem) {
      this.soulMetaballSystem.clear();
    }
    this.soulMetaballSystem = new SoulMetaballSystem(scene);
    if (this.currentMap.encounters && this.currentMap.encounters.length > 0) {
      const colors: Array<'violet' | 'cyan' | 'gold' | 'bronze'> = ['cyan', 'violet', 'gold', 'bronze'];
      const count = 4;
      for (let i = 0; i < count; i++) {
        const rx = Math.floor(Math.random() * (this.currentMap.width - 4)) + 2;
        const rz = Math.floor(Math.random() * (this.currentMap.height - 4)) + 2;
        if (this.currentMap.collision[rz] && !this.currentMap.collision[rz][rx]) {
          const col = colors[i % colors.length];
          this.soulMetaballSystem.spawnEntity(`soul_${this.currentMap.id}_${i}`, rx, rz, 3.0, col);
        }
      }
    }

    // 7. Setup Camera Bounds & Target strictly aligned to player 3D coordinates
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
        this.showToast('Consejo: El Taller de Artífices restaura gratis a todo tu equipo.', 4000);
      }
    }

    // 9. Tutorial Inicial en Vivo (Solo para jugadores nuevos en Aldea Marioneta)
    this.checkStartNewPlayerEscortTutorial();
  }

  private checkStartNewPlayerEscortTutorial(): void {
    const state = GlobalSaveService.getCurrentState();
    if (
      this.currentMap?.id === 'villa_brote' &&
      state.flags?.is_new_player &&
      !state.flags?.guide_escort_done &&
      !state.flags?.body_linked
    ) {
      const leoEntry = this.npcs.get('npc_guide_leo');
      if (leoEntry) {
        // Colocar a Guía Leo a unos pasos del jugador (10, 8) para que se acerque en vivo
        leoEntry.data.x = 10;
        leoEntry.data.y = 8;
        leoEntry.character.setGridPosition(10, 8);
        leoEntry.character.setDirection('left');
        leoEntry.character.setQuestMarker('!');
        this.guideEscortStage = 'approaching';
        this.guideWaypoints = [
          { x: 9, y: 8, dir: 'left' },
          { x: 8, y: 8, dir: 'left' },
          { x: 7, y: 8, dir: 'left' },
        ];
      }
    } else {
      this.guideEscortStage = 'none';
      this.guideWaypoints = [];
    }
  }

  private updateNewPlayerEscortTutorial(dt: number): void {
    if (this.guideEscortStage === 'none') return;
    const leoEntry = this.npcs.get('npc_guide_leo');
    if (!leoEntry) {
      this.guideEscortStage = 'none';
      return;
    }

    const tLab = (esText as any).terms.lab;
    const char = leoEntry.character;

    if (this.guideEscortStage === 'approaching' || this.guideEscortStage === 'escorting') {
      if (this.guideWaypoints.length > 0) {
        const target = this.guideWaypoints[0];
        const speed = 3.6; // tiles per second
        const dx = target.x - char.worldX;
        const dz = target.y - char.worldZ;
        const dist = Math.hypot(dx, dz);

        char.setDirection(target.dir);
        this.guideAnimTimer += dt * 7;
        char.setAnimFrame(Math.floor(this.guideAnimTimer) % 4);

        // Si está escoltando al jugador al Laboratorio, el jugador camina en vivo detrás del Guía Leo
        if (this.guideEscortStage === 'escorting') {
          const pTargetX = Math.max(6, char.worldX - 1.1);
          const pTargetZ = char.worldZ;
          this.player.character.setDirection(target.dir);
          this.player.character.setWorldPosition(pTargetX, pTargetZ);
          this.player.gridX = Math.round(pTargetX);
          this.player.gridY = Math.round(pTargetZ);
          this.player.character.setAnimFrame(Math.floor(this.guideAnimTimer + 1) % 4);
        }

        if (dist <= speed * dt) {
          char.setGridPosition(target.x, target.y);
          leoEntry.data.x = target.x;
          leoEntry.data.y = target.y;
          this.guideWaypoints.shift();
        } else {
          char.setWorldPosition(
            char.worldX + (dx / dist) * speed * dt,
            char.worldZ + (dz / dist) * speed * dt
          );
        }
      } else {
        char.setAnimFrame(0);
        if (this.guideEscortStage === 'approaching') {
          this.guideEscortStage = 'talking_welcome';
          this.player.character.setDirection('right');
          this.openSimpleDialogue('Guía Leo', [
            tLab.guide_welcome_1,
            tLab.guide_welcome_2,
            tLab.guide_welcome_3,
          ]);
        } else if (this.guideEscortStage === 'escorting') {
          this.guideEscortStage = 'talking_lab';
          char.setDirection('left');
          // Dejar al jugador justo frente a la puerta del Laboratorio (22, 8) mirando al norte
          this.player.setPosition(22, 8, 'up');
          const state = GlobalSaveService.getCurrentState();
          state.player.position.x = 22;
          state.player.position.z = 8;
          state.player.direction = 'up';
          state.flags.guide_escort_done = true;
          GlobalSaveService.save();

          this.openSimpleDialogue('Guía Leo', [tLab.guide_at_lab]);
        }
      }
      return;
    }

    if (this.guideEscortStage === 'talking_welcome' && !this.isDialogueOpen) {
      // Iniciar caminata en vivo por la calle central hasta el Laboratorio (21, 8)
      this.guideEscortStage = 'escorting';
      this.guideWaypoints = [
        { x: 10, y: 8, dir: 'right' },
        { x: 14, y: 8, dir: 'right' },
        { x: 18, y: 8, dir: 'right' },
        { x: 21, y: 8, dir: 'right' },
      ];
      return;
    }

    if (this.guideEscortStage === 'talking_lab' && !this.isDialogueOpen) {
      this.guideEscortStage = 'none';
      this.showToast('Pulsa [A] frente a la puerta para entrar al Laboratorio.', 4000);
    }
  }

  private async executeWarp(params: {
    targetMapId: string;
    targetX: number;
    targetY: number;
    targetDirection: Direction;
  }): Promise<void> {
    if (this.isWarping) return;

    // Guardia de salida hacia Ruta Claro si el jugador nuevo aún no tiene su primera Souldoll
    if (
      (this.currentMap?.id === 'villa_brote' || this.currentMap?.id === 'aldea_marioneta') &&
      params.targetMapId === 'ruta_claro'
    ) {
      const state = GlobalSaveService.getCurrentState();
      if (!state.flags?.body_linked && (state.party?.length || 0) === 0) {
        GlobalAudioService.playSfx('cancel');
        const tLab = (esText as any).terms.lab;
        this.openSimpleDialogue('Guía Leo', [tLab.route_blocked_no_starter]);
        return;
      }
    }

    // Bloque 35 Caso límite 1 y R4.5: Bloqueo al salir del Laboratorio sin Souldoll o reto del rival
    if (
      this.currentMap?.id === 'interior_lab' &&
      (params.targetMapId === 'villa_brote' || params.targetMapId === 'aldea_marioneta')
    ) {
      const state = GlobalSaveService.getCurrentState();
      if (!state.flags?.body_linked) {
        GlobalAudioService.playSfx('cancel');
        const tLab = (esText as any).terms.lab;
        this.openSimpleDialogue('Maestro Artífice', [tLab.exit_blocked]);
        return;
      }
      if (!state.flags?.rival_tutorial_done) {
        this.triggerRivalTutorialBattle();
        return;
      }
    }

    // Bloque 47: Si entramos desde un mapa exterior a un mapa interior, registrar la casilla de aproximación como punto de retorno
    if (this.currentMap && !this.currentMap.indoor && params.targetMapId.startsWith('interior_')) {
      const enterDir = this.player.character.direction;
      const dx = enterDir === 'left' ? 1 : enterDir === 'right' ? -1 : 0;
      const dy = enterDir === 'up' ? 1 : enterDir === 'down' ? -1 : 1;
      const returnDir: Direction =
        enterDir === 'up' ? 'down' : enterDir === 'down' ? 'up' : enterDir === 'left' ? 'right' : 'left';
      // Si el warp se disparó por interacción a 1 casilla de distancia, el jugador ya está en la casilla de aproximación;
      // si se disparó al pisar la casilla de puerta (gridX, gridY), la casilla de aproximación es (gridX + dx, gridY + dy).
      const steppedOntoDoor =
        this.currentMap.warps?.some(
          (w) =>
            w.targetMapId === params.targetMapId &&
            w.x === this.player.gridX &&
            w.y === this.player.gridY
        ) ?? false;
      const retX = steppedOntoDoor ? this.player.gridX + dx : this.player.gridX;
      const retY = steppedOntoDoor ? this.player.gridY + dy : this.player.gridY;
      MapLoader.recordInteriorEntry(params.targetMapId, {
        returnMapId: this.currentMap.id,
        returnX: retX,
        returnY: retY,
        returnDirection: returnDir,
      });
    }

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
      curtain.fill({ color: COLOR_NUM.black });
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
    this.staminaBar = null;
    if (this.hudContainer && !this.hudContainer.destroyed) {
      this.hudContainer.destroy({ children: true });
    }
    if (this.toastContainer && !this.toastContainer.destroyed) {
      this.toastContainer.destroy({ children: true });
    }

    this.hudContainer = new Container();
    this.hudContainer.roundPixels = true;
    if (GlobalPixiRenderer.hudLayer) {
      GlobalPixiRenderer.hudLayer.addChild(this.hudContainer);
    }

    this.overworldHud = new OverworldHud({
      onOpenMenu: () => this.openMenu(),
      onRotateCamera: () => this.cameraController.rotateRight(),
    });
    this.hudContainer.addChild(this.overworldHud);

    this.toastContainer = new Container();
    this.toastContainer.roundPixels = true;
    if (GlobalPixiRenderer.hudLayer) {
      GlobalPixiRenderer.hudLayer.addChild(this.toastContainer);
    }
  }

  public onResize(_width: number, _height: number): void {
    const isTopScene = GlobalSceneManager.getCurrentScene()?.name === this.name;
    this.buildHUD();
    if (!isTopScene) {
      this.hudContainer.visible = false;
      this.toastContainer.visible = false;
    }
    if (this.isMenuOpen) {
      this.renderMenuUI();
    }
    if (this.starterModal) {
      this.starterModal.resize(GlobalPixiRenderer.width, GlobalPixiRenderer.height);
    }
    if (this.isDialogueOpen && this.currentNode) {
      this.renderNodeUI(this.currentNode);
    }
  }

  /**
   * Bloque 43 Req. 4: Computes the contextual interaction label for whatever is directly ahead of the player.
   * Returns null if nothing is interactable.
   */
  public getContextualInteractLabel(): string | null {
    if (this.isDialogueOpen || this.isMenuOpen || !this.currentMap || !this.player) {
      return null;
    }

    const tHud = (esText as any).terms.group_a.hud;
    const offset = this.player.getDirectionOffset(this.player.character.direction);
    const targetX = this.player.gridX + offset.x;
    const targetY = this.player.gridY + offset.y;

    // 1. Check Warp / Door ahead
    const warpAhead: MapWarp | undefined = this.currentMap.warps?.find(
      (w) => w.x === targetX && w.y === targetY
    );
    if (warpAhead) {
      return warpAhead.interactLabel || tHud?.interact_enter || 'Entrar';
    }

    // 2. Check NPC ahead or across a counter
    if (this.currentMap.npcs) {
      const npc = this.currentMap.npcs.find((n) => n.x === targetX && n.y === targetY);
      if (npc) {
        return npc.interactLabel || tHud?.interact_talk || 'Hablar';
      }
      const twoStepsX = targetX + offset.x;
      const twoStepsY = targetY + offset.y;
      const npcAcross = this.currentMap.npcs.find((n) => n.x === twoStepsX && n.y === twoStepsY);
      const decorAhead =
        this.currentMap.decor && this.currentMap.decor[targetY]
          ? this.currentMap.decor[targetY][targetX]
          : null;
      if (
        npcAcross &&
        (decorAhead === 'counter' ||
          decorAhead === 'building_wall' ||
          decorAhead === 'counter_scale' ||
          this.currentMap.collision[targetY]?.[targetX])
      ) {
        return npcAcross.interactLabel || tHud?.interact_talk || 'Hablar';
      }
    }

    // 3. Check Sign / Indoor Showcase / Terminal ahead
    if (this.currentMap.signs) {
      const sign = this.currentMap.signs.find((s) => s.x === targetX && s.y === targetY);
      if (sign) {
        if (sign.interactLabel) return sign.interactLabel;
        if (this.currentMap.id === 'interior_center' && sign.x === 8 && sign.y === 2) {
          return tHud?.interact_open || 'Abrir';
        }
        if (sign.shopCategory || sign.shopMode) {
          return tHud?.interact_open || 'Abrir';
        }
        return tHud?.interact_read || 'Leer';
      }
    }

    // 4. Check Interactive Decor (hidden items, berry plants, buried arm) without mutating state
    const decorType =
      this.currentMap.decor && this.currentMap.decor[targetY]
        ? this.currentMap.decor[targetY][targetX]
        : null;
    if (
      decorType === 'doll_arm_buried' ||
      decorType === 'sparkle_hidden' ||
      decorType === 'mana_berry_plant'
    ) {
      return tHud?.interact_pickup || 'Recoger';
    }
    if (decorType === 'bones') {
      return tHud?.interact_read || 'Leer';
    }

    return null;
  }

  private showMapBanner(mapName: string): void {
    const banner = new Container();
    banner.roundPixels = true;
    const width = GlobalPixiRenderer.width;
    const isMobile = width < 640;
    const bW = Math.min(400, width - 128);
    const bH = isMobile ? 38 : 44;
    banner.position.set(Math.round((width - bW) / 2), isMobile ? 48 : 50);

    const card = new KitCard({
      width: bW,
      height: bH,
      variant: 'smokedWood',
    });
    banner.addChild(card);

    const iconSpr = IconRegistry.create('guild_seal', 18);
    iconSpr.position.set(14, Math.round((bH - 18) / 2));
    card.addChild(iconSpr);

    const txt = new Text({
      text: mapName.toUpperCase(),
      style: new TextStyle({
        fontFamily: FONTS.title,
        fontSize: isMobile ? 13 : 15,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        letterSpacing: 1.5,
      }),
    });
    txt.anchor.set(0.5);
    txt.position.set(Math.round(bW / 2) + 8, Math.round(bH / 2));
    card.addChild(txt);

    GlobalPixiRenderer.hudLayer.addChild(banner);

    setTimeout(() => {
      if (!banner.destroyed) {
        banner.destroy({ children: true });
      }
    }, 3200);
  }

  public showToast(message: string, duration = 2400): void {
    // Strip any legacy system emojis from toast messages (Bloque 43 Req. 7)
    const cleanMsg = message.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();

    const toast = new Container();
    toast.roundPixels = true;
    const width = GlobalPixiRenderer.width;
    const isMobile = width < 640;
    const tW = Math.min(460, width - 28);
    const tH = isMobile ? 42 : 46;

    const card = new KitCard({
      width: tW,
      height: tH,
      variant: 'smokedWood',
    });
    toast.addChild(card);

    const iconSpr = IconRegistry.create('spark', 16);
    iconSpr.position.set(12, Math.round((tH - 16) / 2));
    card.addChild(iconSpr);

    const txt = new Text({
      text: cleanMsg,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: isMobile ? 12 : 14,
        fontWeight: 'bold',
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: tW - 44,
        align: 'center',
      }),
    });
    txt.anchor.set(0.5);
    txt.position.set(Math.round(tW / 2) + 8, Math.round(tH / 2));
    card.addChild(txt);

    toast.position.set(Math.round((width - tW) / 2), isMobile ? 92 : 98);
    this.toastContainer.addChild(toast);

    setTimeout(() => {
      if (!toast.destroyed) {
        toast.destroy({ children: true });
      }
    }, duration);
  }

  public pause(): void {
    this.overworldHud?.releaseAllInputs();
    if (this.hudContainer && !this.hudContainer.destroyed) {
      this.hudContainer.visible = false;
    }
    if (this.toastContainer && !this.toastContainer.destroyed) {
      this.toastContainer.visible = false;
    }
    if (this.menuContainer && !this.menuContainer.destroyed) {
      this.menuContainer.visible = false;
    }
    if (this.dialogueBoxContainer && !this.dialogueBoxContainer.destroyed) {
      this.dialogueBoxContainer.visible = false;
    }
  }

  public resume(): void {
    const scene = GlobalThreeRenderer.scene;

    // 0. Clear any residual overlay state and ensure layers are interactive
    this.isWarping = false;
    if (this.player) {
      this.player.isMoving = false;
    }
    if (GlobalPixiRenderer.transitionLayer) {
      GlobalPixiRenderer.transitionLayer.removeChildren();
    }
    if (GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.removeChildren();
    }
    if (GlobalPixiRenderer.dialogueLayer) {
      GlobalPixiRenderer.dialogueLayer.removeChildren();
    }
    this.isMenuOpen = false;
    this.menuContainer = null;
    this.menuScreenFrame = null;
    this.menuFocusManager.clear();

    if (this.isDialogueOpen) {
      this.isDialogueOpen = false;
      this.currentNode = null;
      this.dialogueBoxContainer = null;
    }

    // 1. Ensure Player Mesh is attached & visible
    if (this.player && this.player.character) {
      if (scene && this.player.character.mesh.parent !== scene) {
        scene.add(this.player.character.mesh);
      }
      this.player.character.mesh.visible = true;
      this.player.character.updateTexture();
    }

    // 2. Ensure NPC Meshes are attached & visible & update quest markers
    this.npcs.forEach(({ character, data }) => {
      if (scene && character.mesh.parent !== scene) {
        scene.add(character.mesh);
      }
      character.mesh.visible = true;
      const marker = GlobalQuestSystem.getNpcQuestMarker(data.id);
      character.setQuestMarker(marker);
    });

    // 3. Ensure Lighting is attached
    if (scene && this.ambientLight && this.ambientLight.parent !== scene) {
      scene.add(this.ambientLight);
    }
    if (scene && this.sunLight && this.sunLight.parent !== scene) {
      scene.add(this.sunLight);
    }
    if (scene && this.sunLight && this.sunLight.target && this.sunLight.target.parent !== scene) {
      scene.add(this.sunLight.target);
    }

    // 4. Rebuild Pixi HUD cleanly
    this.buildHUD();
    this.hudContainer.visible = true;
    this.toastContainer.visible = true;

    // 5. Strictly recenter camera on player position
    const px = this.player ? this.player.character.worldX : 6;
    const pz = this.player ? this.player.character.worldZ : 8;
    if (this.cameraController) {
      this.cameraController.setBounds(0, this.currentMap ? this.currentMap.width : 30, 0, this.currentMap ? this.currentMap.height : 30);
      if (GlobalThreeRenderer.camera) {
        this.cameraController.recenterOnPlayer(px, pz, true);
      }
    }
    if (this.atlasDebugOverlay && GlobalThreeRenderer.camera) {
      this.atlasDebugOverlay.setCamera(GlobalThreeRenderer.camera);
    }
  }

  public update(dt: number): void {
    if (this.isWarping) return;

    const isEscortingMovement =
      this.guideEscortStage === 'approaching' || this.guideEscortStage === 'escorting';

    // 1. Update Player Movement & Camera unconditionally to ensure player is never lost
    if (!this.isDialogueOpen && !this.isMenuOpen && !isEscortingMovement) {
      this.player.update(dt, this.cameraController.currentYaw);
    }

    this.updateNewPlayerEscortTutorial(dt);

    const px = this.player.character.worldX;
    const pz = this.player.character.worldZ;

    // 2. Update Map Animations, Lighting & Camera
    this.mapRenderer.update(dt, this.cameraController.currentYaw, 0.72, px, pz);
    this.soulMetaballSystem?.update(dt, px, pz);
    this.mapRenderer.updateOcclusion(px, pz, GlobalThreeRenderer.camera.position);
    if (this.atlasDebugOverlay) {
      this.atlasDebugOverlay.setMapContext(this.currentMap, Math.round(px), Math.round(pz));
    }

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

    // Update Contextual Interaction Indicator on Button A & HUD fade (Bloque 43 Req. 3 & 4)
    if (this.overworldHud) {
      this.overworldHud.setInteractLabel(this.getContextualInteractLabel());
      this.overworldHud.updateHud(dt);
    }

    // Update 3D Camera Telemetry Debug Overlay only if DEBUG is active
    if (this.cameraDebugOverlay) {
      this.cameraDebugOverlay.update(this.player, this.cameraController);
    }

    // 3. In-Game Pause Menu or Starter Selection Modal Handling
    if (this.starterModal) {
      this.starterModal.update(dt);
      if (GlobalInput.justPressed('LEFT') || GlobalInput.justPressed('UP')) {
        this.starterModal.selectNext(-1);
      } else if (GlobalInput.justPressed('RIGHT') || GlobalInput.justPressed('DOWN')) {
        this.starterModal.selectNext(1);
      } else if (GlobalInput.justPressed('CONFIRM')) {
        this.starterModal.confirmCurrent();
      } else if (GlobalInput.justPressed('CANCEL')) {
        this.closeStarterSelectionModal();
      }
      return;
    }

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

    // 5. Interaction on CONFIRM (or stepping into a door/warp with A)
    if (GlobalInput.justPressed('CONFIRM') && !this.player.isMoving) {
      const offset = this.player.getDirectionOffset(this.player.character.direction);
      const targetX = this.player.gridX + offset.x;
      const targetY = this.player.gridY + offset.y;
      const warpAhead = this.currentMap.warps?.find((w) => w.x === targetX && w.y === targetY);
      if (warpAhead) {
        this.executeWarp({
          targetMapId: warpAhead.targetMapId,
          targetX: warpAhead.targetX,
          targetY: warpAhead.targetY,
          targetDirection: warpAhead.targetDirection,
        });
        return;
      }

      const hit = this.player.interactAhead();
      if (hit.type === 'npc') {
        const npc: MapNPC = hit.target;
        const npcChar = this.npcs.get(npc.id)?.character;
        if (npcChar) {
          npcChar.setDirection(this.getOppositeDirection(this.player.character.direction));
        }

        // Notify QuestSystem of talking to this NPC
        GlobalQuestSystem.handleTalkToNpc(npc.id);
        this.overworldHud?.refreshObjectiveHint();

        if (npc.id === 'npc_prof_roble_lab') {
          const state = GlobalSaveService.getCurrentState();
          StarterLabSystem.recordIntroSeen(state);
          GlobalSaveService.save();
        } else if (npc.id === 'npc_rival_kael') {
          const state = GlobalSaveService.getCurrentState();
          if (state.flags?.body_linked && !state.flags?.rival_tutorial_done) {
            this.triggerRivalTutorialBattle();
            return;
          }
        }

        if (npc.id === 'npc_boss_guardian') {
          const saveState = GlobalSaveService.getCurrentState();
          if (!saveState.flags?.bosque_eco_boss) {
            const bossParty = [
              StatCalculator.createCreatureInstance('umbrito', 16),
              StatCalculator.createCreatureInstance('noctarro', 18),
              StatCalculator.createCreatureInstance('titanide', 16),
            ];
            GlobalSceneManager.pushSceneWithTransition('Battle', {
              battleType: 'boss',
              playerParty: saveState.party,
              opponentParty: bossParty,
              onBattleEnd: async (victory: boolean) => {
                await GlobalSceneManager.popScene();
                if (victory) {
                  saveState.flags.bosque_eco_boss = true;
                  saveState.flags.defeated_forest_boss = true;
                  if (!saveState.keyItems) saveState.keyItems = [];
                  if (!saveState.keyItems.includes('sello_eco')) saveState.keyItems.push('sello_eco');
                  saveState.player.money += 2500;
                  GlobalQuestSystem.completeQuest('main_3_forest_boss');
                  GlobalSaveService.save();
                  await GlobalSceneManager.pushScene('Credits');
                } else {
                  this.showToast('El Guardián del Eco te ha derrotado. Entrena y reintenta.', 3500);
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
        if (hit.target.labInteractable) {
          // Bloque 35 R3: Los 7 Objetos Interactivos del Laboratorio del Maestro Artífice
          GlobalAudioService.playSfx('select');
          const state = GlobalSaveService.getCurrentState();
          const res = StarterLabSystem.inspectLabObject(state, hit.target.labInteractable);
          GlobalSaveService.save();
          this.mapRenderer.rebuildCurrentMap();

          if (res.action === 'open_starter_modal') {
            this.openStarterSelectionModal();
          } else if (res.action === 'start_intro') {
            this.startDialogueTree('prof_roble_intro');
          } else if (res.action === 'open_codex') {
            this.openSimpleDialogue(res.speaker, res.lines);
          } else {
            this.openSimpleDialogue(res.speaker, res.lines);
          }
        } else if (this.currentMap.id === 'interior_center' && hit.target.x === 8 && hit.target.y === 2) {
          GlobalAudioService.playSfx('select');
          GlobalEventBus.emit('OpenStorage', { source: 'npc_dialogue' });
        } else if (hit.target.shopCategory) {
          // Req. 6: TIENDA INTERACTIVA dentro del edificio del Mercado
          GlobalAudioService.playSfx('select');
          if (hit.target.shopCategory === 'quests') {
            GlobalSceneManager.pushScene('QuestLog');
          } else {
            GlobalEventBus.emit('OpenShop', {
              mode: 'buy',
              category: hit.target.shopCategory,
              source: 'npc_dialogue',
            });
          }
        } else if (hit.target.shopMode) {
          // Req. 6: Mostrador dentro del edificio del Mercado
          GlobalAudioService.playSfx('select');
          GlobalEventBus.emit('OpenShop', {
            mode: hit.target.shopMode || 'buy',
            source: 'npc_dialogue',
          });
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

    // 7. Toggle Menu on MENU action (ESC / Enter / Menu Icon)
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
    this.menuFocusManager.clear();
    this.menuScreenFrame = null;
    if (this.menuContainer) {
      this.menuContainer.destroy({ children: true });
      this.menuContainer = null;
    }
    GlobalAudioService.playSfx('cancel');
  }

  private handlePauseMenuInput(): void {
    if (this.menuScreenFrame) {
      this.menuScreenFrame.updateInertia();
    }
    const items = this.getPauseMenuItems();
    if (GlobalInput.justPressed('UP')) {
      this.selectedMenuIndex = (this.selectedMenuIndex - 1 + items.length) % items.length;
      GlobalAudioService.playSfx('select');
      this.renderMenuUI();
    } else if (GlobalInput.justPressed('DOWN')) {
      this.selectedMenuIndex = (this.selectedMenuIndex + 1) % items.length;
      GlobalAudioService.playSfx('select');
      this.renderMenuUI();
    }

    if (GlobalInput.justPressed('CANCEL') || GlobalInput.justPressed('MENU')) {
      this.closeMenu();
    }

    if (GlobalInput.justPressed('CONFIRM')) {
      const item = items[this.selectedMenuIndex];
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
    this.menuFocusManager.clear();

    this.menuContainer = new Container();
    this.menuContainer.roundPixels = true;
    this.menuContainer.zIndex = 950;
    GlobalPixiRenderer.menuLayer.addChild(this.menuContainer);

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const state = GlobalSaveService.getCurrentState();
    const t = (esText as any).terms.group_a.pause;
    const items = this.getPauseMenuItems();

    // Backdrop shadow blocking world taps
    const curtain = new Graphics();
    curtain.rect(0, 0, width, height);
    curtain.fill({ color: COLOR_NUM.black, alpha: 0.6 });
    curtain.eventMode = 'static';
    curtain.on('pointerdown', () => this.closeMenu());
    this.menuContainer.addChild(curtain);

    const frameW = Math.min(480, width - 16);
    const frameH = Math.min(620, height - 16);
    const frameX = Math.round((width - frameW) / 2);
    const frameY = Math.round((height - frameH) / 2);

    const frame = new ScreenFrame({
      width: frameW,
      height: frameH,
      title: t.title,
      currencies: [
        { iconId: 'coin', value: state.player?.money || 0 },
        { iconId: 'guild_seal', value: (state.badges || []).length },
      ],
      onClose: () => this.closeMenu(),
      primaryAction: {
        label: t.close,
        iconId: 'close',
        onClick: () => this.closeMenu(),
      },
    });
    frame.position.set(frameX, frameY);
    this.menuScreenFrame = frame;
    this.menuContainer.addChild(frame);

    const cw = frame.contentWidth;
    const rowH = 56;
    const cardH = items.length * rowH + 44;

    const card = new KitCard({
      width: cw,
      height: cardH,
      variant: 'smokedWood',
      title: esText.factions.gremio,
    });
    card.position.set(0, 0);
    frame.contentRoot.addChild(card);

    items.forEach((item, idx) => {
      const row = new KitListRow({
        width: cw - 16,
        height: 50,
        iconId: item.iconId,
        title: item.label,
        subtitle: item.subtitle,
        selected: idx === this.selectedMenuIndex,
        onClick: () => {
          this.selectedMenuIndex = idx;
          const act = item.action;
          this.closeMenu();
          act();
        },
      });
      row.position.set(8, 36 + idx * rowH);
      card.addChild(row);

      this.menuFocusManager.register({
        container: row,
        width: cw - 16,
        height: 50,
        onActivate: () => {
          this.selectedMenuIndex = idx;
          const act = item.action;
          this.closeMenu();
          act();
        },
      });
    });

    this.menuFocusManager.setFocus(this.selectedMenuIndex, false);
    frame.setContentTotalHeight(cardH + 12);

    UIKitLinter.inspectTree(frame, 'MainPauseMenu');
  }

  public openStarterSelectionModal(): void {
    if (this.starterModal) {
      this.starterModal.destroy({ children: true });
      this.starterModal = null;
    }

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.starterModal = new StarterSelectionModal(width, height, {
      onCancel: () => {
        this.closeStarterSelectionModal();
      },
      onStarterBound: (_souldoll, _rivalSpeciesId) => {
        this.closeStarterSelectionModal();
        this.mapRenderer.rebuildCurrentMap();
        this.overworldHud?.refreshObjectiveHint();
        this.triggerRivalTutorialBattle();
      },
    });

    GlobalPixiRenderer.menuLayer.addChild(this.starterModal);
  }

  public closeStarterSelectionModal(): void {
    if (this.starterModal) {
      this.starterModal.destroy({ children: true });
      this.starterModal = null;
    }
  }

  /**
   * Bloque 35 R4.5 y Caso límite 3: Combate tutorial contra el Aprendiz Kael (ventaja elemental, sin Game Over punitivo).
   */
  public triggerRivalTutorialBattle(): void {
    const state = GlobalSaveService.getCurrentState();
    const chosenId = (state.vars?.starter_species_id as string) || state.party[0]?.speciesId || 'maga';
    const rivalDoll = StarterLabSystem.createRivalSouldoll(chosenId);
    const rivalName = SOUL_SPECIES_DATA[rivalDoll.speciesId]?.name || rivalDoll.nickname;
    const tLab = (esText as any).terms.lab;

    this.showToast(tLab.tutorial_parts_banner, 4500);

    GlobalSceneManager.pushSceneWithTransition('Battle', {
      battleType: 'trainer',
      trainerName: 'Aprendiz Kael',
      tutorialPartsBattle: true,
      playerParty: state.party,
      opponentParty: [rivalDoll],
      onBattleEnd: async (victory: boolean) => {
        StarterLabSystem.completeRivalTutorial(state, victory);
        GlobalSaveService.save();
        await GlobalSceneManager.popScene();
        this.mapRenderer.rebuildCurrentMap();
        this.overworldHud?.refreshObjectiveHint();
        this.openSimpleDialogue('Aprendiz Kael', [
          tLab.rival_challenge_intro.replace('{rivalSoul}', rivalName),
          tLab.rival_after_battle,
        ]);
      },
    });
  }

  private getDialogueTreeForNpc(npcId: string): string | null {
    switch (npcId) {
      case 'npc_prof_roble':
      case 'npc_prof_roble_lab':
        return 'prof_roble_intro';
      case 'npc_rival_kael':
        return 'rival_kael_dialogue';
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
    const isMobile = width < 640;

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

    const marginX = isMobile ? 12 : 28;
    const boxWidth = Math.min(720, width - marginX * 2);
    const boxHeight = isMobile ? 118 : 144;
    const boxX = Math.round((width - boxWidth) / 2);
    // On mobile portrait, place the dialogue card above the virtual D-Pad / A-B buttons
    const bottomReserved = isMobile ? 168 : 22;
    const boxY = Math.max(90, height - boxHeight - bottomReserved);

    // Background Card using KitCard (parchment / smokedWood with bronze frame & corner studs)
    const card = new KitCard({
      width: boxWidth,
      height: boxHeight,
      variant: 'smokedWood',
      title: node.speakerName ? node.speakerName.toUpperCase() : undefined,
    });
    card.position.set(boxX, boxY);
    this.dialogueBoxContainer.addChild(card);

    // Speaker Avatar Portrait (if palette is known)
    let textLeftOffset = isMobile ? 14 : 22;
    if (node.speakerPaletteId) {
      const tex = GlobalAssetRegistry.getCharacterFramePixi(node.speakerPaletteId, 'down', 0);
      const portrait = new Sprite(tex);
      const pScale = isMobile ? 1.5 : 1.9;
      portrait.scale.set(pScale);
      portrait.position.set(boxX + (isMobile ? 12 : 18), boxY + (isMobile ? 34 : 38));
      this.dialogueBoxContainer.addChild(portrait);
      textLeftOffset = isMobile ? 68 : 92;
    }

    // Text Display (compact & clear)
    this.typewriterFullText = node.text;
    this.typewriterCurrentLength = 0;
    this.typewriterTimer = 0;
    this.isTypewriterComplete = false;

    this.textDisplayObject = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: isMobile ? 13 : 15,
        fontWeight: '600',
        lineHeight: isMobile ? 18 : 22,
        fill: COLOR_HEX.parchment,
        wordWrap: true,
        wordWrapWidth: boxWidth - textLeftOffset - (isMobile ? 14 : 24),
      }),
    });
    this.textDisplayObject.position.set(boxX + textLeftOffset, boxY + (isMobile ? 34 : 38));
    this.dialogueBoxContainer.addChild(this.textDisplayObject);

    // Options Cards (rendered if node has options)
    this.renderOptions(node, boxX, boxY, boxWidth);

    UIKitLinter.inspectTree(this.dialogueBoxContainer, 'DialogueBox');
  }

  private renderOptions(node: DialogueNode, boxX: number, boxY: number, boxWidth: number): void {
    this.optionsContainers = [];
    if (!node.options || node.options.length === 0) return;

    const width = GlobalPixiRenderer.width;
    const isMobile = width < 640;
    const optWidth = isMobile ? Math.min(boxWidth, width - 24) : Math.min(360, boxWidth);
    const optHeight = isMobile ? 36 : 42;
    const optGap = isMobile ? 6 : 8;
    const optX = isMobile ? boxX + Math.round((boxWidth - optWidth) / 2) : boxX + boxWidth - optWidth;
    const startY = Math.max(54, boxY - node.options.length * (optHeight + optGap) - (isMobile ? 14 : 16));

    node.options.forEach((opt, idx) => {
      const optBox = new Container();
      optBox.position.set(optX, startY + idx * (optHeight + optGap));
      optBox.eventMode = 'static';
      optBox.cursor = 'pointer';

      const bg = new Graphics();
      const isSel = idx === this.selectedOptionIndex;
      bg.roundRect(0, 0, optWidth, optHeight, 7);
      bg.fill({ color: isSel ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: isSel ? COLOR_NUM.white : COLOR_NUM.bronze, width: isSel ? 2 : 1.5 });
      optBox.addChild(bg);

      const label = new Text({
        text: opt.label,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: isMobile ? 12 : 14,
          fontWeight: 'bold',
          fill: isSel ? COLOR_HEX.inkCrypt : COLOR_HEX.parchment,
          letterSpacing: 0.4,
          wordWrap: true,
          wordWrapWidth: optWidth - 24,
        }),
      });
      label.anchor.set(0, 0.5);
      label.position.set(14, optHeight / 2);
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
    const width = GlobalPixiRenderer.width;
    const isMobile = width < 640;
    const marginX = isMobile ? 12 : 28;
    const boxWidth = Math.min(720, width - marginX * 2);
    const optWidth = isMobile ? Math.min(boxWidth, width - 24) : Math.min(360, boxWidth);
    const optHeight = isMobile ? 36 : 42;

    this.optionsContainers.forEach((container, idx) => {
      const bg = container.children[0] as Graphics;
      const label = container.children[1] as Text;
      const isSel = idx === this.selectedOptionIndex;
      bg.clear();
      bg.roundRect(0, 0, optWidth, optHeight, 7);
      bg.fill({ color: isSel ? COLOR_NUM.gold : COLOR_NUM.smokedWood, alpha: 0.95 });
      bg.stroke({ color: isSel ? COLOR_NUM.white : COLOR_NUM.bronze, width: isSel ? 2 : 1.5 });
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyListener);
    }
    GlobalEventBus.off('map:warp', this.boundWarpHandler);
    GlobalEventBus.off('toast:message', this.boundToastHandler);
    GlobalEventBus.off('OpenShop', this.boundOpenShopHandler);
    GlobalEventBus.off('OpenWorkshop', this.boundOpenWorkshopHandler);
    GlobalEventBus.off('OpenStorage', this.boundOpenStorageHandler);
    GlobalEventBus.off('battle:encounter', this.boundBattleEncounterHandler);

    if (this.cameraDebugOverlay) {
      this.cameraDebugOverlay.destroy();
      this.cameraDebugOverlay = null;
    }
    this.mapRenderer.clear();
    this.soulMetaballSystem?.clear();
    this.soulMetaballSystem = null;

    this.staminaBar = null;
    if (this.hudContainer && !this.hudContainer.destroyed) {
      this.hudContainer.destroy({ children: true });
    }
    if (this.toastContainer && !this.toastContainer.destroyed) {
      this.toastContainer.destroy({ children: true });
    }
    if (this.menuContainer && !this.menuContainer.destroyed) {
      this.menuContainer.destroy({ children: true });
      this.menuContainer = null;
    }
    if (this.dialogueBoxContainer && !this.dialogueBoxContainer.destroyed) {
      this.dialogueBoxContainer.destroy({ children: true });
      this.dialogueBoxContainer = null;
    }
    this.player.character.destroy();
    this.npcs.forEach(({ character }) => character.destroy());
    this.npcs.clear();
  }
}
