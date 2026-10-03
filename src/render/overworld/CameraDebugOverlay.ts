import * as THREE from 'three';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { OverworldPlayer } from '../../systems/OverworldPlayer';
import { OverworldCamera } from './OverworldCamera';
import { GlobalThreeRenderer } from '../ThreeRenderer';
import { GlobalPixiRenderer } from '../PixiRenderer';

export class CameraDebugOverlay {
  public enabled = false;

  // Three.js 3D Helpers
  private debugGroup: THREE.Group = new THREE.Group();
  private playerAnchorMesh!: THREE.Mesh;
  private cameraTargetMesh!: THREE.Mesh;
  private rayLineMesh!: THREE.Line;

  // Pixi 2D Overlay & Center Crosshair
  private hudContainer: Container = new Container();
  private panelBg!: Graphics;
  private infoText!: Text;
  private crosshairContainer: Container = new Container();

  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();

  constructor() {
    this.build3DHelpers();
    this.build2DPane();
    this.buildCrosshair();
  }

  private build3DHelpers(): void {
    // 1. Player Ground Anchor (Cyan Ring)
    const ringGeo = new THREE.RingGeometry(0.35, 0.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    this.playerAnchorMesh = new THREE.Mesh(ringGeo, ringMat);
    this.debugGroup.add(this.playerAnchorMesh);

    // 2. Camera Target Center (Yellow Sphere Marker)
    const sphereGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      wireframe: true,
      depthTest: false,
    });
    this.cameraTargetMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.debugGroup.add(this.cameraTargetMesh);

    // 3. Camera Line to Target
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xff0055,
      linewidth: 2,
      depthTest: false,
    });
    this.rayLineMesh = new THREE.Line(lineGeo, lineMat);
    this.debugGroup.add(this.rayLineMesh);
  }

  private build2DPane(): void {
    this.hudContainer = new Container();
    this.hudContainer.position.set(18, 75);
    this.hudContainer.visible = false;
    this.hudContainer.zIndex = 999;

    this.panelBg = new Graphics();
    this.panelBg.roundRect(0, 0, 360, 240, 10);
    this.panelBg.fill({ color: 0x070d18, alpha: 0.94 });
    this.panelBg.stroke({ color: 0x00f3ff, width: 2 });
    this.hudContainer.addChild(this.panelBg);

    this.infoText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'monospace, system-ui',
        fontSize: 11,
        lineHeight: 16,
        fill: '#38bdf8',
      }),
    });
    this.infoText.position.set(14, 12);
    this.hudContainer.addChild(this.infoText);
  }

  private buildCrosshair(): void {
    this.crosshairContainer = new Container();
    this.crosshairContainer.visible = false;
    this.crosshairContainer.zIndex = 998;

    const crosshair = new Graphics();
    // 1px Center Crosshair
    crosshair.moveTo(-10, 0).lineTo(10, 0).stroke({ color: 0x00f3ff, width: 1, alpha: 0.8 });
    crosshair.moveTo(0, -10).lineTo(0, 10).stroke({ color: 0x00f3ff, width: 1, alpha: 0.8 });
    this.crosshairContainer.addChild(crosshair);
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    const scene = GlobalThreeRenderer.scene;

    if (this.enabled) {
      if (!this.debugGroup.parent) scene.add(this.debugGroup);
      if (!this.hudContainer.parent) GlobalPixiRenderer.hudLayer.addChild(this.hudContainer);
      if (!this.crosshairContainer.parent) GlobalPixiRenderer.hudLayer.addChild(this.crosshairContainer);
      this.hudContainer.visible = true;
      this.crosshairContainer.visible = true;
    } else {
      if (this.debugGroup.parent) scene.remove(this.debugGroup);
      this.hudContainer.visible = false;
      this.crosshairContainer.visible = false;
    }

    return this.enabled;
  }

  public update(player: OverworldPlayer, cameraController: OverworldCamera): void {
    if (!this.enabled) return;

    const camera = cameraController.camera;
    const px = player.character.worldX;
    const pz = player.character.worldZ;

    // 1. Position 3D Helpers
    this.playerAnchorMesh.position.set(px, 0.05, pz);
    this.cameraTargetMesh.position.set(cameraController.currentX, 0.5, cameraController.currentZ);

    const camPos = camera.position;
    const targetPos = new THREE.Vector3(cameraController.currentX, 0.5, cameraController.currentZ);

    const linePositions = new Float32Array([
      camPos.x,
      camPos.y,
      camPos.z,
      targetPos.x,
      targetPos.y,
      targetPos.z,
    ]);
    this.rayLineMesh.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(linePositions, 3)
    );
    this.rayLineMesh.geometry.attributes.position.needsUpdate = true;

    // 2. Compute Frustum Contains Test & NDC Projection
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix);

    const playerPos3D = new THREE.Vector3(px, 0.6, pz);
    const isPlayerInFrustum = this.frustum.containsPoint(playerPos3D);

    const ndcVector = playerPos3D.clone().project(camera);
    console.log(
      `[Diagnostic Frustum] Player World: (${px.toFixed(2)}, ${pz.toFixed(2)}) | Screen Projected (vector.project): x=${ndcVector.x.toFixed(3)}, y=${ndcVector.y.toFixed(3)}, z=${ndcVector.z.toFixed(3)} | In Frustum: ${isPlayerInFrustum}`
    );

    // Position crosshair at center of viewport
    const vpW = GlobalPixiRenderer.width;
    const vpH = GlobalPixiRenderer.height;
    this.crosshairContainer.position.set(vpW / 2, vpH / 2);

    // Container vs Canvas size
    const containerW = GlobalThreeRenderer.container?.clientWidth || 0;
    const containerH = GlobalThreeRenderer.container?.clientHeight || 0;
    const canvasEl = GlobalThreeRenderer.renderer?.domElement;
    const canvasW = canvasEl ? canvasEl.width : 0;
    const canvasH = canvasEl ? canvasEl.height : 0;

    // 3. Format Telemetry Display
    const yawDeg = Math.round((cameraController.currentYaw * 180) / Math.PI);

    const txt = [
      `📷 CAMERA & PLAYER TELEMETRY OVERLAY`,
      `─────────────────────────────────────`,
      `• Grid Pos : (${player.gridX}, ${player.gridY}) | Dir: ${player.character.direction.toUpperCase()}`,
      `• World Pos: (${px.toFixed(2)}, Y:0.00, ${pz.toFixed(2)})`,
      `• Cam Focus: (${cameraController.currentX.toFixed(2)}, Y:0.50, ${cameraController.currentZ.toFixed(2)})`,
      `• Cam Pos  : (${camPos.x.toFixed(2)}, Y:${camPos.y.toFixed(2)}, ${camPos.z.toFixed(2)})`,
      `• Yaw/Aspect: ${yawDeg}° | Aspect: ${camera.aspect.toFixed(3)}`,
      `• Container: ${containerW}x${containerH} | Canvas: ${canvasW}x${canvasH}`,
      `• NDC Proj : (${ndcVector.x.toFixed(3)}, ${ndcVector.y.toFixed(3)}) [Target: (0,0)]`,
      `• Frustum  : ${isPlayerInFrustum ? '✅ DENTRO' : '❌ FUERA'} | Sprite: ${player.character.mesh.visible ? '✅ OK' : '❌ OCULTO'}`,
    ].join('\n');

    this.infoText.text = txt;
  }

  public destroy(): void {
    this.hudContainer.destroy({ children: true });
    this.crosshairContainer.destroy({ children: true });
  }
}
