import * as THREE from 'three';
import { COLOR_HEX } from '../../ui/styles';

export interface SoulMetaballEntity {
  id: string;
  x: number;
  z: number;
  baseX: number;
  baseZ: number;
  wanderRadius: number;
  speed: number;
  phase: number;
  colorType: 'violet' | 'cyan' | 'gold' | 'bronze';
  mesh: THREE.Mesh;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/**
 * Sistema de Almas Errantes con Efecto Metaball / Fluido Orgánico (Bloque 47).
 * Renderiza dinámicamente gotas orgánicas que se fusionan con bordes iridiscentes
 * usando la paleta oficial de Souldolls en el overworld 3D.
 */
export class SoulMetaballSystem {
  private entities: SoulMetaballEntity[] = []
  private scene: THREE.Scene;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public spawnEntity(id: string, x: number, z: number, wanderRadius = 3, colorType: 'violet' | 'cyan' | 'gold' | 'bronze' = 'cyan'): SoulMetaballEntity {
    const canvas = typeof document !== 'undefined'
      ? document.createElement('canvas')
      : ({
          width: 128,
          height: 128,
          getContext: () => ({
            clearRect: () => {},
            createRadialGradient: () => ({ addColorStop: () => {} }),
            fillRect: () => {},
            save: () => {},
            restore: () => {},
            fill: () => {},
            stroke: () => {},
            beginPath: () => {},
            arc: () => {},
          }),
        } as unknown as HTMLCanvasElement);

    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
    });

    const geometry = new THREE.PlaneGeometry(1.4, 1.4);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 0.6, z);
    mesh.rotation.x = -Math.PI / 6; // Ligeramente inclinado hacia la cámara cenital/38°
    this.scene.add(mesh);

    const entity: SoulMetaballEntity = {
      id,
      x,
      z,
      baseX: x,
      baseZ: z,
      wanderRadius,
      speed: 0.8 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      colorType,
      mesh,
      texture,
      canvas,
      ctx,
    };

    this.entities.push(entity);
    this.renderEntityTexture(entity, 0);
    return entity;
  }

  private renderEntityTexture(entity: SoulMetaballEntity, t: number, proximityFactor = 1.0): void {
    const { ctx, canvas } = entity;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Seleccionar colores de la paleta del juego
    let primaryColor = COLOR_HEX.cyan;
    let secondaryColor = COLOR_HEX.soulViolet;
    let glowColor = COLOR_HEX.gold;

    if (entity.colorType === 'violet') {
      primaryColor = COLOR_HEX.soulViolet;
      secondaryColor = COLOR_HEX.cyan;
      glowColor = COLOR_HEX.parchment;
    } else if (entity.colorType === 'gold') {
      primaryColor = COLOR_HEX.gold;
      secondaryColor = COLOR_HEX.bronze;
      glowColor = COLOR_HEX.cyan;
    } else if (entity.colorType === 'bronze') {
      primaryColor = COLOR_HEX.bronze;
      secondaryColor = COLOR_HEX.inkCrypt;
      glowColor = COLOR_HEX.gold;
    }

    // Efecto Metaball orgánico con 4 sub-gotas orbitando (velocidad escalada por proximidad)
    const cx = w / 2;
    const cy = h / 2;
    const numBlobs = 4;
    const blobs: Array<{ x: number; y: number; r: number }> = [];

    const animatedTime = t * proximityFactor;

    for (let i = 0; i < numBlobs; i++) {
      const angle = animatedTime * (1.2 + i * 0.3) + (i * Math.PI * 2) / numBlobs;
      const dist = 16 + Math.sin(animatedTime * 2 + i) * 8;
      const bx = cx + Math.cos(angle) * dist;
      const by = cy + Math.sin(angle * 1.3) * dist;
      const r = (18 + Math.sin(animatedTime * 3 + i * 1.5) * 6) * Math.min(1.4, proximityFactor * 0.85);
      blobs.push({ x: bx, y: by, r });
    }

    // 1. Dibujar contornos oscuros de tinta (Toon Outline / Cel Shading)
    for (const b of blobs) {
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = COLOR_HEX.inkCrypt;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Bandas de Sombra Cuantizadas (Cel-Shading Hard Color Bands) con brillo aumentado por proximidad
    for (const b of blobs) {
      // Sombra exterior / base
      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      // Tono medio principal
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // Núcleo de luz brillante (Toon highlight)
      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(b.x - 3, b.y - 3, b.r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Destello estelar central (Chispa de alma estilo anime)
    const sparkX = cx + Math.sin(animatedTime * 4) * 5;
    const sparkY = cy + Math.cos(animatedTime * 3) * 4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 4 * Math.min(1.5, proximityFactor), 0, Math.PI * 2);
    ctx.fill();

    entity.texture.needsUpdate = true;
  }

  public update(dt: number, playerX?: number, playerZ?: number): void {
    this.time += dt;
    for (const entity of this.entities) {
      // Calcular factor de excitación por proximidad
      let proximityFactor = 1.0;
      if (playerX !== undefined && playerZ !== undefined) {
        const dx = entity.x - playerX;
        const dz = entity.z - playerZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 8.0) {
          const t = 1.0 - Math.min(1.0, Math.max(0.0, (dist - 1.0) / 7.0));
          proximityFactor = 1.0 + t * 2.0; // escalar velocidad y brillo hasta 3x
        }
      }

      // Movimiento errático y orgánico basado en funciones armónicas (acelerado por proximidad)
      entity.phase += dt * entity.speed * proximityFactor;
      const offsetX = Math.sin(entity.phase * 0.7) * entity.wanderRadius + Math.cos(this.time * 0.5 + entity.phase) * 1.2;
      const offsetZ = Math.cos(entity.phase * 0.5) * entity.wanderRadius + Math.sin(this.time * 0.6) * 1.2;

      entity.x = entity.baseX + offsetX;
      entity.z = entity.baseZ + offsetZ;
      entity.mesh.position.set(entity.x, 0.6 + Math.sin(this.time * 3 + entity.phase) * 0.15, entity.z);

      // Pasar factor de proximidad para aumentar brillo y pulsación
      this.renderEntityTexture(entity, this.time, proximityFactor);
    }
  }

  public clear(): void {
    for (const entity of this.entities) {
      this.scene.remove(entity.mesh);
      entity.mesh.geometry?.dispose?.();
      (entity.mesh.material as THREE.Material)?.dispose?.();
      entity.texture?.dispose?.();
    }
    this.entities = [];
  }

  public getEntityCount(): number {
    return this.entities.length;
  }
}
