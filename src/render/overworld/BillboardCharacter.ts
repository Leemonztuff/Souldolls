import * as THREE from 'three';
import { Direction } from '../../types';
import { GlobalAssetRegistry } from '../procedural/AssetRegistry';

export class BillboardCharacter {
  public mesh: THREE.Group;
  public spriteMesh: THREE.Mesh;
  public shadowMesh: THREE.Mesh;
  public spriteMaterial: THREE.MeshBasicMaterial;

  // Floating Quest Marker ('!' or '?')
  private markerMesh: THREE.Mesh | null = null;
  private markerTexture: THREE.CanvasTexture | null = null;
  public questMarker: '!' | '?' | null = null;

  public paletteId: string;
  public direction: Direction = 'down';
  public animFrame = 0;

  // Grid and world positions
  public gridX = 0;
  public gridY = 0;
  public worldX = 0;
  public worldZ = 0;

  private bobTimer = 0;

  constructor(paletteId = 'player', initialX = 6, initialY = 8, initialDir: Direction = 'down') {
    this.paletteId = paletteId;
    this.gridX = initialX;
    this.gridY = initialY;
    this.worldX = initialX;
    this.worldZ = initialY;
    this.direction = initialDir;

    this.mesh = new THREE.Group();
    this.mesh.frustumCulled = false;
    this.mesh.visible = true;
    this.mesh.position.set(this.worldX, 0, this.worldZ);

    // 1. Soft Circular Shadow on Ground (depthWrite: false, renderOrder: 99, radius 0.42 per scale.json)
    const shadowGeo = new THREE.CircleGeometry(0.42, 16);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.position.y = 0.02;
    this.shadowMesh.renderOrder = 99;
    this.shadowMesh.frustumCulled = false;
    this.mesh.add(this.shadowMesh);

    // 2. Sprite Plane (Bloque 45 Req. 3: Escala fija jugador/NPC 1.0 x 1.5 tiles, pivote en los pies)
    const spriteGeo = new THREE.PlaneGeometry(1.0, 1.5);
    spriteGeo.translate(0, 0.75, 0);

    const initialTex = GlobalAssetRegistry.getCharacterFrameThree(this.paletteId, this.direction, 0);
    if (initialTex) {
      initialTex.needsUpdate = true;
    }

    this.spriteMaterial = new THREE.MeshBasicMaterial({
      map: initialTex || undefined,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthWrite: true,
      fog: false,
    });

    this.spriteMesh = new THREE.Mesh(spriteGeo, this.spriteMaterial);
    this.spriteMesh.position.y = 0.02; // slight raise to avoid ground z-fighting
    this.spriteMesh.frustumCulled = false;
    this.spriteMesh.visible = true;
    this.spriteMesh.renderOrder = 100;
    this.mesh.add(this.spriteMesh);

    this.updateTexture();
  }

  public setQuestMarker(marker: '!' | '?' | null): void {
    if (this.questMarker === marker) return;
    this.questMarker = marker;

    if (this.markerMesh) {
      this.mesh.remove(this.markerMesh);
      this.markerMesh.geometry.dispose();
      (this.markerMesh.material as THREE.Material).dispose();
      if (this.markerTexture) this.markerTexture.dispose();
      this.markerMesh = null;
      this.markerTexture = null;
    }

    if (marker) {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = marker === '!' ? '#f59e0b' : '#0284c7';
      ctx.beginPath();
      ctx.arc(16, 16, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker, 16, 17);

      this.markerTexture = new THREE.CanvasTexture(canvas);
      this.markerTexture.magFilter = THREE.NearestFilter;
      this.markerTexture.minFilter = THREE.NearestFilter;
      this.markerTexture.needsUpdate = true;

      const markerGeo = new THREE.PlaneGeometry(0.55, 0.55);
      const markerMat = new THREE.MeshBasicMaterial({
        map: this.markerTexture,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      this.markerMesh = new THREE.Mesh(markerGeo, markerMat);
      this.markerMesh.frustumCulled = false;
      this.markerMesh.renderOrder = 101;
      this.markerMesh.position.y = 1.45;
      this.mesh.add(this.markerMesh);
    }
  }

  public setGridPosition(gx: number, gy: number): void {
    this.gridX = gx;
    this.gridY = gy;
    this.worldX = gx;
    this.worldZ = gy;
    this.mesh.position.set(this.worldX, 0, this.worldZ);
  }

  public setWorldPosition(wx: number, wz: number): void {
    this.worldX = wx;
    this.worldZ = wz;
    this.mesh.position.set(this.worldX, 0, this.worldZ);
  }

  public setDirection(dir: Direction): void {
    if (this.direction !== dir) {
      this.direction = dir;
      this.updateTexture();
    }
  }

  public setAnimFrame(frame: number): void {
    if (this.animFrame !== frame) {
      this.animFrame = frame;
      this.updateTexture();
    }
  }

  public updateTexture(): void {
    const tex = GlobalAssetRegistry.getCharacterFrameThree(
      this.paletteId,
      this.direction,
      this.animFrame
    );
    if (tex) {
      tex.needsUpdate = true;
      this.spriteMaterial.map = tex;
      this.spriteMaterial.needsUpdate = true;
    }
  }

  /**
   * Aligns billboard sprite to camera on Y axis only
   */
  public updateBillboard(camera: THREE.Camera, dt = 0.016): void {
    const camPos = camera.position;
    const worldPos = new THREE.Vector3();
    this.spriteMesh.getWorldPosition(worldPos);

    // Y-axis billboard rotation (facing camera horizontally without tilting X)
    this.spriteMesh.lookAt(camPos.x, worldPos.y, camPos.z);

    if (this.markerMesh) {
      this.bobTimer += dt * 4.0;
      const markerPos = new THREE.Vector3();
      this.markerMesh.getWorldPosition(markerPos);
      this.markerMesh.lookAt(camPos.x, markerPos.y, camPos.z);
      this.markerMesh.position.y = 1.45 + Math.sin(this.bobTimer) * 0.08;
    }
  }

  public destroy(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.spriteMesh.geometry.dispose();
    this.spriteMaterial.dispose();
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    if (this.markerMesh) {
      this.markerMesh.geometry.dispose();
      (this.markerMesh.material as THREE.Material).dispose();
      if (this.markerTexture) this.markerTexture.dispose();
    }
  }
}
