import { Direction, Vector2D } from '../types';
import { MapData, MapNPC, MapSign } from '../types/maps';
import { BillboardCharacter } from '../render/overworld/BillboardCharacter';
import { GlobalInput } from '../core/Input';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalEventBus } from '../core/EventBus';
import { GlobalSaveService } from '../services/SaveService';
import { EncounterSystem } from './EncounterSystem';
import { GlobalOverworldDecor } from '../render/overworld/DecorRenderer';

export class OverworldPlayer {
  public character: BillboardCharacter;
  public mapData!: MapData;

  // Grid position
  public gridX = 0;
  public gridY = 0;

  // Target grid position while in motion
  public targetGridX = 0;
  public targetGridY = 0;

  // Movement state
  public isMoving = false;
  private moveProgress = 0; // 0.0 to 1.0
  private stepDuration = 0.24; // seconds per tile
  private walkStepDuration = 0.24;
  private runStepDuration = 0.13;

  private isRunning = false;
  private stepCount = 0;
  private cameraYaw = 0;

  // Stamina sprint state
  public stamina = 100;
  public maxStamina = 100;
  public isTired = false;

  constructor(paletteId = 'player', spawnX = 6, spawnY = 8, initialDir: Direction = 'down') {
    this.gridX = spawnX;
    this.gridY = spawnY;
    this.targetGridX = spawnX;
    this.targetGridY = spawnY;
    this.character = new BillboardCharacter(paletteId, spawnX, spawnY, initialDir);
  }

  public setMap(map: MapData): void {
    this.mapData = map;
  }

  public setPosition(gx: number, gy: number, dir?: Direction): void {
    if (this.mapData && this.mapData.collision[gy] && this.mapData.collision[gy][gx]) {
      gx = 6;
      gy = 8;
    }
    this.gridX = gx;
    this.gridY = gy;
    this.targetGridX = gx;
    this.targetGridY = gy;
    this.isMoving = false;
    this.moveProgress = 0;
    this.character.setGridPosition(gx, gy);
    if (dir) {
      this.character.setDirection(dir);
    }
  }

  public update(dt: number, cameraYaw = 0): void {
    this.cameraYaw = cameraYaw;

    const input = GlobalInput;
    const isSprintWanted = input.isDown('RUN') && input.isSprintActive && input.isSprintActive();

    // Recover from tired state
    if (this.isTired && this.stamina >= 25) {
      this.isTired = false;
    }

    if (isSprintWanted && !this.isTired && this.isMoving) {
      this.isRunning = true;
      this.stepDuration = 0.08; // Ultra fast sprint
      this.stamina = Math.max(0, this.stamina - 30 * dt); // Depletes in ~3.3 seconds
      if (this.stamina <= 0) {
        this.isTired = true;
        this.isRunning = false;
        GlobalAudioService.playSfx('cancel'); // Audible feedback when tired
      }
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 25 * dt); // Recovers in ~4 seconds
    }

    if (this.isMoving) {
      this.updateMovement(dt);
    } else {
      this.handleInput();
    }
  }

  private handleInput(): void {
    const input = GlobalInput;
    const isSprintWanted = input.isDown('RUN') && input.isSprintActive && input.isSprintActive();

    if (isSprintWanted && !this.isTired) {
      this.isRunning = true;
      this.stepDuration = 0.08;
    } else {
      this.isRunning = input.isDown('RUN');
      this.stepDuration = this.isRunning ? this.runStepDuration : this.walkStepDuration;
    }

    let rawDir: Direction | null = null;
    let actionKey = '';
    if (input.isDown('UP')) { rawDir = 'up'; actionKey = 'UP'; }
    else if (input.isDown('DOWN')) { rawDir = 'down'; actionKey = 'DOWN'; }
    else if (input.isDown('LEFT')) { rawDir = 'left'; actionKey = 'LEFT'; }
    else if (input.isDown('RIGHT')) { rawDir = 'right'; actionKey = 'RIGHT'; }

    let inputDir: Direction | null = null;
    if (rawDir) {
      inputDir = this.mapCameraRelativeDirection(rawDir, this.cameraYaw);
    }

    if (inputDir) {
      if (this.character.direction !== inputDir) {
        this.character.setDirection(inputDir);
        GlobalAudioService.playSfx('step', 1.2);
        if (!input.justPressed(actionKey as any)) {
          this.attemptStep(inputDir);
        }
      } else {
        this.attemptStep(inputDir);
      }
    } else {
      this.character.setAnimFrame(0);
    }
  }

  private mapCameraRelativeDirection(dir: Direction, yaw: number): Direction {
    // Convert angle to nearest 90° step index (0..3)
    let steps = Math.round(yaw / (Math.PI / 2)) % 4;
    if (steps < 0) steps += 4;

    const dirs: Direction[] = ['up', 'right', 'down', 'left'];
    const idx = dirs.indexOf(dir);
    return dirs[(idx + steps) % 4];
  }

  private attemptStep(dir: Direction): void {
    const offset = this.getDirectionOffset(dir);
    const nextX = this.gridX + offset.x;
    const nextY = this.gridY + offset.y;

    if (this.canWalkTo(nextX, nextY)) {
      this.targetGridX = nextX;
      this.targetGridY = nextY;
      this.isMoving = true;
      this.moveProgress = 0;
      this.stepCount++;

      const inGrass = this.mapData.encounters && this.mapData.encounters[nextY][nextX] === 'tall_grass';
      GlobalAudioService.playSfx('step', inGrass ? 0.8 : 1.0);
    } else {
      this.character.setAnimFrame(0);
    }
  }

  public canWalkTo(x: number, y: number): boolean {
    if (!this.mapData) return false;

    if (x < 0 || x >= this.mapData.width || y < 0 || y >= this.mapData.height) {
      return false;
    }

    if (this.mapData.collision[y][x]) {
      return false;
    }

    if (this.mapData.npcs) {
      const npcBlocked = this.mapData.npcs.some((npc) => npc.x === x && npc.y === y);
      if (npcBlocked) return false;
    }

    return true;
  }

  private updateMovement(dt: number): void {
    this.moveProgress += dt / this.stepDuration;

    const subFrame = this.stepCount % 2 === 0 ? 1 : 2;
    this.character.setAnimFrame(this.moveProgress < 0.8 ? subFrame : 0);

    if (this.moveProgress >= 1.0) {
      this.gridX = this.targetGridX;
      this.gridY = this.targetGridY;
      this.character.setGridPosition(this.gridX, this.gridY);
      this.isMoving = false;
      this.moveProgress = 0;

      this.onTileEnter(this.gridX, this.gridY);
      this.handleInput();
    } else {
      const curX = this.gridX + (this.targetGridX - this.gridX) * this.moveProgress;
      const curZ = this.gridY + (this.targetGridY - this.gridY) * this.moveProgress;
      this.character.setWorldPosition(curX, curZ);
    }
  }

  private onTileEnter(x: number, y: number): void {
    // Bloque 36: Trigger tall-grass squash, leaf particles & berry regrowth step counter
    GlobalOverworldDecor.onPlayerStep(x, y);

    const warp = this.mapData.warps?.find((w) => w.x === x && w.y === y);
    if (warp) {
      GlobalEventBus.emit('map:warp', {
        targetMapId: warp.targetMapId,
        targetX: warp.targetX,
        targetY: warp.targetY,
        targetDirection: warp.targetDirection,
      });
      return;
    }

    if (this.mapData.encounters && this.mapData.encounters[y][x] === 'tall_grass') {
      const state = GlobalSaveService.getCurrentState();
      if (!state.flags?.tutorial_grass_shown) {
        state.flags.tutorial_grass_shown = true;
        GlobalSaveService.save();
        GlobalEventBus.emit('toast:message', {
          text: '💡 ¡Consejo: La hierba alta oculta criaturas salvajes! Camina sobre ella para explorar.',
          duration: 4000,
        });
      }
      const encounter = EncounterSystem.checkEncounter(this.mapData);
      if (encounter) {
        GlobalEventBus.emit('battle:encounter', encounter);
        GlobalEventBus.emit('toast:message', {
          text: `⚔️ ¡Un ${encounter.speciesId.toUpperCase()} salvaje (Nv. ${encounter.level}) apareció!`,
          duration: 2500,
        });
      }
    }
  }

  public interactAhead(): { type: 'npc' | 'sign' | 'decor' | 'water' | 'empty'; target?: any } {
    const offset = this.getDirectionOffset(this.character.direction);
    const targetX = this.gridX + offset.x;
    const targetY = this.gridY + offset.y;

    if (this.mapData.npcs) {
      const npc = this.mapData.npcs.find((n) => n.x === targetX && n.y === targetY);
      if (npc) {
        return { type: 'npc', target: npc };
      }

      // Check if interacting across a counter/bench
      const twoStepsX = targetX + offset.x;
      const twoStepsY = targetY + offset.y;
      const npcAcrossCounter = this.mapData.npcs.find((n) => n.x === twoStepsX && n.y === twoStepsY);
      const decorAhead = this.mapData.decor && this.mapData.decor[targetY] ? this.mapData.decor[targetY][targetX] : null;
      if (
        npcAcrossCounter &&
        (decorAhead === 'counter' || decorAhead === 'building_wall' || decorAhead === 'counter_scale' || this.mapData.collision[targetY]?.[targetX])
      ) {
        return { type: 'npc', target: npcAcrossCounter };
      }
    }

    if (this.mapData.signs) {
      const sign = this.mapData.signs.find((s) => s.x === targetX && s.y === targetY);
      if (sign) {
        return { type: 'sign', target: sign };
      }
    }

    // Bloque 36 Req. 6: Interactive Overworld Decor (doll_arm_buried, sparkle_hidden, mana_berry_plant, bones)
    const decorHit = GlobalOverworldDecor.interactAt(targetX, targetY, this.gridX, this.gridY);
    if (decorHit) {
      return { type: 'decor', target: decorHit };
    }

    if (
      targetX >= 0 &&
      targetX < this.mapData.width &&
      targetY >= 0 &&
      targetY < this.mapData.height &&
      this.mapData.ground[targetY][targetX] === 'water'
    ) {
      return { type: 'water' };
    }

    return { type: 'empty' };
  }

  public getDirectionOffset(dir: Direction): Vector2D {
    switch (dir) {
      case 'up': return { x: 0, y: -1 };
      case 'down': return { x: 0, y: 1 };
      case 'left': return { x: -1, y: 0 };
      case 'right': return { x: 1, y: 0 };
    }
  }
}
