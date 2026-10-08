import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot?: [number, number];
  tile?: boolean;
  flat?: boolean;
  glow?: boolean;
  ppu?: number;
}

interface AtlasJson {
  image: string;
  size: [number, number] | { w: number; h: number };
  ppu?: number;
  frames: Record<string, AtlasFrame>;
}

export function prepareVillageDecorAtlas(): boolean {
  const rootDir = process.cwd();
  const inputJpg = path.resolve(rootDir, 'assets/raw/village_decor_raw.jpg');
  const outputAtlasPublic = path.resolve(rootDir, 'public/assets/atlases/village_decor_atlas.png');
  const atlasJsonPath = path.resolve(rootDir, 'public/data/art/village_decor_atlas.json');

  if (!fs.existsSync(inputJpg)) {
    console.error(`❌ [prepareVillageDecorAtlas] No se encontró el archivo de entrada: ${inputJpg}`);
    return false;
  }

  console.log(`\n🔍 [prepareVillageDecorAtlas] Procesando atlas Aldea Marioneta: ${inputJpg}...`);
  const rawJpg = fs.readFileSync(inputJpg);
  const decoded = jpeg.decode(rawJpg, { useTArray: true });
  const { width, height, data } = decoded;

  console.log(`📐 [prepareVillageDecorAtlas] Dimensiones: ${width}x${height} px`);

  function isBackgroundPixel(r: number, g: number, b: number): boolean {
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC - minC;
    const avg = (r + g + b) / 3;

    // 1. Neutral checkerboard (light square ~190..215, dark square ~155..165, pure white ~220..255)
    if (sat <= 18 && avg >= 135) return true;

    // 2. Yellow/warm lantern glow on checkerboard (light yellowish tint on high brightness background)
    if (avg >= 145 && sat <= 65 && r >= g && g >= b && b >= 100 && (r + g) > 280) {
      return true;
    }

    // 3. Green chroma spill on background
    if (g > 150 && g > r * 1.3 && g > b * 1.3) return true;

    return false;
  }

  // Flood fill from outer image borders & known empty spaces
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, 0);
    queue.push(x, height - 1);
    visited[x] = 1;
    visited[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    queue.push(0, y);
    queue.push(width - 1, y);
    visited[y * width] = 1;
    visited[y * width + (width - 1)] = 1;
  }

  const seeds = [
    [390, 150], [790, 150], [100, 450], [620, 450], [670, 450], [1050, 450],
    [108, 750], [230, 750], [310, 750], [570, 750], [755, 750], [955, 750], [1070, 750]
  ];
  seeds.forEach(([sx, sy]) => {
    queue.push(sx, sy);
    visited[sy * width + sx] = 1;
  });

  const png = new PNG({ width, height });
  for (let i = 0; i < data.length; i += 4) {
    png.data[i] = data[i];
    png.data[i + 1] = data[i + 1];
    png.data[i + 2] = data[i + 2];
    png.data[i + 3] = 255;
  }

  let removedCount = 0;
  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const idx = (y * width + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (isBackgroundPixel(r, g, b)) {
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = 0;
      removedCount++;

      const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (!visited[nidx]) {
            visited[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  // Also clear isolated interior neutral grey checkerboard holes
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC - minC;
      const avg = (r + g + b) / 3;
      if (sat <= 8 && (Math.abs(avg - 160) <= 6 || Math.abs(avg - 192) <= 6)) {
        if (png.data[idx + 3] !== 0) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          removedCount++;
        }
      }
    }
  }

  const totalPixels = width * height;
  const transparentPct = Math.round((removedCount / totalPixels) * 100);
  console.log(
    `🎨 [prepareVillageDecorAtlas] Fondo y tablero de ajedrez eliminados: ${removedCount}/${totalPixels} (${transparentPct}%)`
  );

  // Exact detected bounding boxes of all 13 elements in village_decor_raw.jpg
  const defaultAtlasJson: AtlasJson = {
    image: 'village_decor_atlas.png',
    size: [width, height],
    ppu: 48,
    frames: {
      // --- BAND 1: HOUSES / FACADES (Y: 15..300) ---
      facade_house_teal: { x: 26, y: 20, w: 345, h: 275, pivot: [0.5, 1.0], ppu: 55 },
      facade_house_brown: { x: 428, y: 20, w: 345, h: 275, pivot: [0.5, 1.0], ppu: 55 },
      facade_house_slate: { x: 832, y: 15, w: 342, h: 283, pivot: [0.5, 1.0], ppu: 55 },

      // --- BAND 2: CENTRAL PLAZA FOUNTAIN & STONE WELL (Y: 310..605) ---
      fountain_central_plaza: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
      fountain_puppet_water_1: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
      fountain_puppet_stone: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
      fountain_puppet_water_2: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },
      fountain_puppet_water_3: { x: 240, y: 310, w: 327, h: 288, pivot: [0.5, 1.0], ppu: 75 },

      stone_well_gazebo: { x: 727, y: 320, w: 233, h: 278, pivot: [0.5, 1.0], ppu: 65 },
      stone_well_village: { x: 727, y: 320, w: 233, h: 278, pivot: [0.5, 1.0], ppu: 65 },

      // --- BAND 3: PROPS, LIGHTS, FURNITURE & DECOR (Y: 615..885) ---
      lamppost_ki_teal: { x: 18, y: 628, w: 96, h: 252, pivot: [0.5, 1.0], glow: true, ppu: 65 },
      lamppost_ki_cyan: { x: 118, y: 626, w: 100, h: 254, pivot: [0.5, 1.0], glow: true, ppu: 65 },
      signpost_arrows: { x: 118, y: 626, w: 100, h: 254, pivot: [0.5, 1.0], ppu: 65 },
      lamppost_pole_slim: { x: 247, y: 631, w: 46, h: 249, pivot: [0.5, 1.0], glow: true, ppu: 65 },

      village_wood_bench: { x: 351, y: 620, w: 201, h: 200, pivot: [0.5, 1.0], ppu: 65 },
      bulletin_notice_board: { x: 351, y: 620, w: 201, h: 200, pivot: [0.5, 1.0], ppu: 65 },

      village_mailbox: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },
      wooden_crates_stacked: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },
      wooden_crate_single: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },
      wooden_barrel: { x: 600, y: 635, w: 150, h: 245, pivot: [0.5, 1.0], ppu: 65 },

      puppet_statue_pedestal: { x: 768, y: 650, w: 185, h: 230, pivot: [0.5, 1.0], ppu: 65 },
      puppet_display_rack: { x: 768, y: 650, w: 185, h: 230, pivot: [0.5, 1.0], ppu: 65 },

      potted_plant_small: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
      potted_plant_medium: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
      potted_plant_tall: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
      flowerbox_purple: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
      flowerbox_orange: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },
      flowerbox_white: { x: 964, y: 615, w: 105, h: 265, pivot: [0.5, 1.0], ppu: 65 },

      green_hedge_bush_1: { x: 1080, y: 668, w: 105, h: 212, pivot: [0.5, 1.0], ppu: 65 },
      green_hedge_bush_2: { x: 1080, y: 668, w: 105, h: 212, pivot: [0.5, 1.0], ppu: 65 },
      clothesline_linens: { x: 1080, y: 668, w: 105, h: 212, pivot: [0.5, 1.0], ppu: 65 },
    },
  };

  const pngBuffer = PNG.sync.write(png);
  fs.mkdirSync(path.dirname(outputAtlasPublic), { recursive: true });
  fs.writeFileSync(outputAtlasPublic, pngBuffer);
  console.log(`💾 [prepareVillageDecorAtlas] Guardado en /public/assets/atlases/village_decor_atlas.png`);

  fs.mkdirSync(path.dirname(atlasJsonPath), { recursive: true });
  fs.writeFileSync(atlasJsonPath, JSON.stringify(defaultAtlasJson, null, 2));
  console.log(`💾 [prepareVillageDecorAtlas] JSON guardado en /public/data/art/village_decor_atlas.json`);

  return true;
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('prepare_village_decor')) {
  prepareVillageDecorAtlas();
}
