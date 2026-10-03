import * as THREE from 'three';

export class OverworldCamera {
  public camera: THREE.PerspectiveCamera;

  // Target to follow (player position)
  public targetX = 6;
  public targetZ = 8;
  public currentX = 6;
  public currentZ = 8;

  // Camera offset parameters for HD-2D ~50° tilt perspective
  private readonly distance = 12.0;
  private readonly height = 11.0;

  // Rotation angles (0, 90, 180, 270 deg)
  public targetYaw = 0;
  public currentYaw = 0;

  // Map boundaries
  private minX = 0;
  private maxX = 30;
  private minZ = 0;
  private maxZ = 30;

  // Smoothing speed
  private followLerp = 10.0;
  private rotLerp = 8.0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
  }

  public setBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    this.minX = minX;
    this.maxX = maxX;
    this.minZ = minZ;
    this.maxZ = maxZ;
  }

  public setTarget(x: number, z: number, instant = false): void {
    if (isNaN(x) || isNaN(z)) return;
    this.targetX = x;
    this.targetZ = z;

    if (instant) {
      this.currentX = x;
      this.currentZ = z;
      this.currentYaw = this.targetYaw;
      this.applyCameraPosition();
    }
  }

  /**
   * Strictly aligns the camera target coordinates to the player's 3D position,
   * forcing immediate recalculation of camera transform matrices and frustum.
   */
  public recenterOnPlayer(playerX: number, playerZ: number, instant = true): void {
    if (isNaN(playerX) || isNaN(playerZ)) return;
    this.targetX = playerX;
    this.targetZ = playerZ;
    if (instant) {
      this.currentX = playerX;
      this.currentZ = playerZ;
      this.currentYaw = this.targetYaw;
    }
    this.applyCameraPosition();
  }

  public rotateLeft(): void {
    this.targetYaw += Math.PI / 2;
  }

  public rotateRight(): void {
    this.targetYaw -= Math.PI / 2;
  }

  public update(dt: number): void {
    const safeDt = Math.min(0.1, Math.max(0.001, dt || 0.016));

    // 1. Smoothly interpolate camera target directly to player position so player is centered
    this.currentX += (this.targetX - this.currentX) * Math.min(1.0, this.followLerp * safeDt);
    this.currentZ += (this.targetZ - this.currentZ) * Math.min(1.0, this.followLerp * safeDt);

    // 2. Smoothly interpolate yaw rotation
    this.currentYaw += (this.targetYaw - this.currentYaw) * Math.min(1.0, this.rotLerp * safeDt);

    this.applyCameraPosition();
  }

  public applyCameraPosition(): void {
    if (isNaN(this.currentX) || isNaN(this.currentZ) || isNaN(this.currentYaw)) {
      this.currentX = this.targetX || 6;
      this.currentZ = this.targetZ || 8;
      this.currentYaw = this.targetYaw || 0;
    }

    // Compute camera position relative to target based on yaw angle
    const offsetX = Math.sin(this.currentYaw) * this.distance;
    const offsetZ = Math.cos(this.currentYaw) * this.distance;

    const camX = this.currentX + offsetX;
    const camY = this.height;
    const camZ = this.currentZ + offsetZ;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.currentX, 0.5, this.currentZ);
    this.camera.updateMatrixWorld(true);
  }
}
