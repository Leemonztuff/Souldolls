import { Direction } from '../../types';

export interface CharacterPalette {
  id: string;
  name: string;
  hairColor: string;
  skinColor: string;
  shirtColor: string;
  pantsColor: string;
  hatColor?: string;
  hatTrimColor?: string;
  shoesColor: string;
  accessoryColor?: string;
}

export const CHARACTER_PALETTES: Record<string, CharacterPalette> = {
  player: {
    id: 'player',
    name: 'Entrenador Red',
    hairColor: '#451a03',
    skinColor: '#fed7aa',
    shirtColor: '#ef4444',
    pantsColor: '#1e3a8a',
    hatColor: '#dc2626',
    hatTrimColor: '#ffffff',
    shoesColor: '#1e293b',
    accessoryColor: '#facc15', // backpack strap
  },
  professor: {
    id: 'professor',
    name: 'Profesor Roble',
    hairColor: '#94a3b8',
    skinColor: '#fed7aa',
    shirtColor: '#f8fafc', // lab coat
    pantsColor: '#78350f',
    shoesColor: '#451a03',
  },
  lass: {
    id: 'lass',
    name: 'Joven Chica',
    hairColor: '#b45309',
    skinColor: '#ffedd5',
    shirtColor: '#10b981',
    pantsColor: '#f43f5e',
    shoesColor: '#1e293b',
    hatColor: '#f43f5e',
  },
  hiker: {
    id: 'hiker',
    name: 'Montañero',
    hairColor: '#1e293b',
    skinColor: '#fdba74',
    shirtColor: '#ea580c',
    pantsColor: '#3f3f46',
    hatColor: '#854d0e',
    shoesColor: '#451a03',
    accessoryColor: '#713f12', // backpack
  },
  nurse: {
    id: 'nurse',
    name: 'Enfermera Joy',
    hairColor: '#f472b6',
    skinColor: '#ffedd5',
    shirtColor: '#fbcfe8',
    pantsColor: '#f472b6',
    hatColor: '#ffffff',
    shoesColor: '#ffffff',
  },
  clerk: {
    id: 'clerk',
    name: 'Tendero',
    hairColor: '#334155',
    skinColor: '#fed7aa',
    shirtColor: '#0284c7',
    pantsColor: '#0f172a',
    shoesColor: '#0284c7',
  },
};

/**
 * Character Sprite Generator: 4 directions x 3 animation frames (32x32 per frame)
 */
export class CharacterFactory {
  public static generateCharacterSheet(
    paletteId = 'player'
  ): Record<Direction, HTMLCanvasElement[]> {
    const palette = CHARACTER_PALETTES[paletteId] || CHARACTER_PALETTES.player;
    const directions: Direction[] = ['down', 'up', 'left', 'right'];
    const result: Record<Direction, HTMLCanvasElement[]> = {
      down: [],
      up: [],
      left: [],
      right: [],
    };

    directions.forEach((dir) => {
      // 3 walk frames: 0: Idle, 1: Step Left, 2: Step Right
      for (let frame = 0; frame < 3; frame++) {
        result[dir].push(this.drawCharacterFrame(palette, dir, frame));
      }
    });

    return result;
  }

  private static drawCharacterFrame(
    p: CharacterPalette,
    dir: Direction,
    frame: number
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const outline = '#090d16';
    const cx = 16;
    const cy = 16;

    // Bobbing offset for walking
    const isStep = frame !== 0;
    const bob = isStep ? -1 : 0;

    ctx.save();

    // 1. Shadow beneath feet
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, 30, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Legs / Pants & Feet
    const legY = 22 + bob;
    ctx.fillStyle = outline;
    ctx.fillRect(cx - 5, legY - 1, 10, 8);

    ctx.fillStyle = p.pantsColor;
    if (dir === 'left' || dir === 'right') {
      // Side view legs
      const stepOffset = frame === 1 ? -2 : frame === 2 ? 2 : 0;
      ctx.fillRect(cx - 3 + stepOffset, legY, 6, 6);

      // Shoes
      ctx.fillStyle = p.shoesColor;
      ctx.fillRect(cx - (dir === 'left' ? 4 : 2) + stepOffset, legY + 6, 6, 2);
    } else {
      // Front / Back view legs
      const leftLegOffset = frame === 1 ? -1 : 0;
      const rightLegOffset = frame === 2 ? -1 : 0;

      ctx.fillRect(cx - 4, legY + leftLegOffset, 3, 6);
      ctx.fillRect(cx + 1, legY + rightLegOffset, 3, 6);

      // Shoes
      ctx.fillStyle = p.shoesColor;
      ctx.fillRect(cx - 5, legY + 6 + leftLegOffset, 4, 2);
      ctx.fillRect(cx + 1, legY + 6 + rightLegOffset, 4, 2);
    }

    // 3. Torso / Shirt / Coat
    const torsoY = 13 + bob;
    ctx.fillStyle = outline;
    ctx.fillRect(cx - 6, torsoY - 1, 12, 10);

    ctx.fillStyle = p.shirtColor;
    ctx.fillRect(cx - 5, torsoY, 10, 8);

    // Torso Details according to direction
    if (dir === 'down') {
      // Collar / Zipper
      ctx.fillStyle = p.skinColor;
      ctx.fillRect(cx - 1, torsoY, 2, 2);
      if (p.accessoryColor) {
        ctx.fillStyle = p.accessoryColor;
        ctx.fillRect(cx - 4, torsoY + 2, 2, 6);
      }
    } else if (dir === 'up') {
      // Backpack on back
      if (p.accessoryColor) {
        ctx.fillStyle = p.accessoryColor;
        ctx.fillRect(cx - 4, torsoY + 1, 8, 6);
      }
    } else if (dir === 'left' || dir === 'right') {
      // Side arm
      ctx.fillStyle = p.skinColor;
      const armX = dir === 'left' ? cx - 4 : cx + 2;
      ctx.fillRect(armX, torsoY + 3, 3, 4);
    }

    // 4. Head & Hair
    const headY = 4 + bob;
    ctx.fillStyle = outline;
    ctx.fillRect(cx - 5, headY - 1, 10, 10);

    // Skin
    ctx.fillStyle = p.skinColor;
    ctx.fillRect(cx - 4, headY, 8, 8);

    // Hair
    ctx.fillStyle = p.hairColor;
    if (dir === 'up') {
      // Full back hair
      ctx.fillRect(cx - 4, headY, 8, 7);
    } else if (dir === 'down') {
      // Bangs
      ctx.fillRect(cx - 4, headY, 8, 3);
      ctx.fillRect(cx - 4, headY + 3, 2, 3);
      ctx.fillRect(cx + 2, headY + 3, 2, 3);
    } else {
      // Side hair
      ctx.fillRect(cx - 4, headY, 8, 3);
      if (dir === 'left') ctx.fillRect(cx + 1, headY + 2, 3, 4);
      if (dir === 'right') ctx.fillRect(cx - 4, headY + 2, 3, 4);
    }

    // Hat (if present)
    if (p.hatColor) {
      ctx.fillStyle = outline;
      ctx.fillRect(cx - 6, headY - 2, 12, 5);
      ctx.fillStyle = p.hatColor;
      ctx.fillRect(cx - 5, headY - 1, 10, 4);

      if (p.hatTrimColor) {
        ctx.fillStyle = p.hatTrimColor;
        if (dir === 'down') {
          ctx.fillRect(cx - 3, headY + 1, 6, 1);
        } else if (dir === 'left') {
          ctx.fillRect(cx - 5, headY + 1, 4, 1);
        } else if (dir === 'right') {
          ctx.fillRect(cx + 1, headY + 1, 4, 1);
        }
      }
    }

    // 5. Face (Eyes & expression)
    if (dir === 'down') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 3, headY + 4, 2, 2);
      ctx.fillRect(cx + 1, headY + 4, 2, 2);
    } else if (dir === 'left') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 3, headY + 4, 2, 2);
    } else if (dir === 'right') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx + 1, headY + 4, 2, 2);
    }

    ctx.restore();
    return canvas;
  }
}
