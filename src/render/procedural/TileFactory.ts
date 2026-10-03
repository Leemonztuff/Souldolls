export type TileType =
  | 'grass'
  | 'tall_grass'
  | 'path'
  | 'water'
  | 'tree'
  | 'rock'
  | 'cave_floor'
  | 'wall'
  | 'building_wall'
  | 'roof'
  | 'door'
  | 'interior_floor'
  | 'flowers'
  | 'sand';

export const ALL_TILE_TYPES: TileType[] = [
  'grass',
  'tall_grass',
  'path',
  'water',
  'tree',
  'rock',
  'cave_floor',
  'wall',
  'building_wall',
  'roof',
  'door',
  'interior_floor',
  'flowers',
  'sand',
];

/**
 * Procedural 32x32 Tile Texture Generator
 */
export class TileFactory {
  public static generateAllTiles(): Record<TileType, HTMLCanvasElement> {
    const dict: Record<string, HTMLCanvasElement> = {};
    ALL_TILE_TYPES.forEach((type) => {
      dict[type] = this.generateTile(type);
    });
    return dict as Record<TileType, HTMLCanvasElement>;
  }

  public static generateTile(type: TileType): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    switch (type) {
      case 'grass':
        this.drawGrass(ctx);
        break;
      case 'tall_grass':
        this.drawTallGrass(ctx);
        break;
      case 'path':
        this.drawPath(ctx);
        break;
      case 'water':
        this.drawWater(ctx);
        break;
      case 'tree':
        this.drawTree(ctx);
        break;
      case 'rock':
        this.drawRock(ctx);
        break;
      case 'cave_floor':
        this.drawCaveFloor(ctx);
        break;
      case 'wall':
        this.drawWall(ctx);
        break;
      case 'building_wall':
        this.drawBuildingWall(ctx);
        break;
      case 'roof':
        this.drawRoof(ctx);
        break;
      case 'door':
        this.drawDoor(ctx);
        break;
      case 'interior_floor':
        this.drawInteriorFloor(ctx);
        break;
      case 'flowers':
        this.drawFlowers(ctx);
        break;
      case 'sand':
        this.drawSand(ctx);
        break;
    }

    return canvas;
  }

  private static drawGrass(ctx: CanvasRenderingContext2D): void {
    // Bloque 36 Req. 4: Suelo poligonal base color verde #5CBF5A con ruido sutil
    ctx.fillStyle = '#5CBF5A';
    ctx.fillRect(0, 0, 32, 32);

    // Subtle organic noise (slightly darker and lighter speckles)
    ctx.fillStyle = '#53B051';
    const darkSpecks = [
      [3, 5], [11, 13], [21, 7], [7, 23], [19, 27], [27, 19], [15, 3], [25, 29]
    ];
    darkSpecks.forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 2);
    });

    ctx.fillStyle = '#66CA64';
    const lightSpecks = [
      [6, 17], [24, 12], [16, 20], [9, 8], [28, 6], [4, 28]
    ];
    lightSpecks.forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));
  }

  private static drawTallGrass(ctx: CanvasRenderingContext2D): void {
    this.drawGrass(ctx);

    // Lush 3D tufts
    ctx.fillStyle = '#1e3a1e'; // dark shadow outline
    for (let i = 2; i < 30; i += 7) {
      ctx.fillRect(i, 8, 6, 20);
    }

    ctx.fillStyle = '#22543d';
    for (let i = 3; i < 30; i += 7) {
      ctx.fillRect(i, 9, 4, 18);
    }

    ctx.fillStyle = '#38a169';
    for (let i = 4; i < 30; i += 7) {
      ctx.fillRect(i, 11, 2, 14);
    }

    ctx.fillStyle = '#9ae6b4'; // Tip highlights
    for (let i = 3; i < 30; i += 7) {
      ctx.fillRect(i + 1, 8, 2, 3);
    }
  }

  private static drawPath(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#b45309';
    const dirtNoise = [
      [2, 4], [8, 12], [18, 6], [24, 18], [6, 22], [14, 28], [28, 10]
    ];
    dirtNoise.forEach(([x, y]) => ctx.fillRect(x, y, 3, 2));

    ctx.fillStyle = '#fde68a';
    const pebbles = [[10, 8], [22, 24], [4, 16], [26, 6]];
    pebbles.forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));
  }

  private static drawWater(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(2, 6, 12, 2);
    ctx.fillRect(18, 14, 10, 2);
    ctx.fillRect(6, 22, 14, 2);

    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(4, 7, 4, 1);
    ctx.fillRect(20, 15, 3, 1);
    ctx.fillRect(8, 23, 5, 1);
  }

  private static drawTree(ctx: CanvasRenderingContext2D): void {
    // Dark Green Background
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#15803d';
    ctx.fillRect(2, 2, 28, 28);

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(4, 4, 12, 12);
    ctx.fillRect(16, 6, 10, 10);
    ctx.fillRect(8, 16, 16, 10);

    ctx.fillStyle = '#86efac';
    ctx.fillRect(6, 6, 4, 4);
    ctx.fillRect(18, 8, 3, 3);
  }

  private static drawRock(ctx: CanvasRenderingContext2D): void {
    this.drawGrass(ctx);

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(16, 16, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(16, 16, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(10, 10, 6, 4);
  }

  private static drawCaveFloor(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#1c1917';
    ctx.fillRect(4, 4, 6, 6);
    ctx.fillRect(18, 16, 8, 6);
    ctx.fillRect(6, 22, 6, 6);

    ctx.fillStyle = '#44403c';
    ctx.fillRect(12, 8, 3, 3);
    ctx.fillRect(24, 6, 4, 3);
  }

  private static drawWall(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillRect(0, 10, 32, 2);
    ctx.fillRect(0, 21, 32, 2);
    ctx.fillRect(0, 30, 32, 2);

    ctx.fillRect(15, 2, 2, 8);
    ctx.fillRect(7, 12, 2, 9);
    ctx.fillRect(23, 12, 2, 9);
    ctx.fillRect(15, 23, 2, 7);
  }

  private static drawBuildingWall(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fef3c7'; // warm cream plaster
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#78350f'; // wood timber framing
    ctx.fillRect(0, 0, 4, 32);
    ctx.fillRect(28, 0, 4, 32);
    ctx.fillRect(0, 0, 32, 4);
    ctx.fillRect(0, 28, 32, 4);

    // Cross beam
    ctx.fillRect(0, 14, 32, 3);
  }

  private static drawRoof(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#dc2626'; // classic red clay shingles
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 7, 32, 2);
    ctx.fillRect(0, 15, 32, 2);
    ctx.fillRect(0, 23, 32, 2);
    ctx.fillRect(0, 30, 32, 2);

    ctx.fillStyle = '#f87171';
    ctx.fillRect(4, 2, 6, 2);
    ctx.fillRect(18, 2, 6, 2);
    ctx.fillRect(10, 10, 6, 2);
    ctx.fillRect(24, 10, 6, 2);
  }

  private static drawDoor(ctx: CanvasRenderingContext2D): void {
    this.drawBuildingWall(ctx);

    // Door Frame & Panel
    ctx.fillStyle = '#451a03';
    ctx.fillRect(6, 4, 20, 28);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(8, 6, 16, 26);

    ctx.fillStyle = '#92400e';
    ctx.fillRect(10, 8, 12, 10);
    ctx.fillRect(10, 20, 12, 10);

    // Golden Knob
    ctx.fillStyle = '#facc15';
    ctx.fillRect(19, 18, 3, 3);
  }

  private static drawInteriorFloor(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 7, 32, 1);
    ctx.fillRect(0, 15, 32, 1);
    ctx.fillRect(0, 23, 32, 1);
    ctx.fillRect(0, 31, 32, 1);

    ctx.fillRect(14, 0, 1, 7);
    ctx.fillRect(24, 8, 1, 7);
    ctx.fillRect(8, 16, 1, 7);
    ctx.fillRect(18, 24, 1, 7);
  }

  private static drawFlowers(ctx: CanvasRenderingContext2D): void {
    this.drawGrass(ctx);

    // Red Flower
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(6, 8, 4, 4);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(7, 9, 2, 2);

    // Yellow Flower
    ctx.fillStyle = '#facc15';
    ctx.fillRect(20, 14, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(21, 15, 2, 2);

    // Blue Flower
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(10, 22, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(11, 23, 2, 2);
  }

  private static drawSand(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#fde047';
    const noise = [[4, 4], [16, 10], [24, 6], [10, 20], [20, 26], [6, 28]];
    noise.forEach(([x, y]) => ctx.fillRect(x, y, 2, 2));

    ctx.fillStyle = '#ca8a04';
    const shells = [[12, 14], [22, 18]];
    shells.forEach(([x, y]) => ctx.fillRect(x, y, 2, 1));
  }
}
