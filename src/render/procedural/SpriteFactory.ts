import { CreatureSpecies } from '../../types/creatures';
import { SoulDollSpriteFactory, CreatureSpriteSet, ChassisMaterial } from './SoulDollSpriteFactory';

export type { CreatureSpriteSet };

/**
 * Procedural Layered Pixel-Art Sprite Generator for Souldolls
 */
export class SpriteFactory {
  public static adjustColor(hex: string, percent: number): string {
    return SoulDollSpriteFactory.adjustColor(hex, percent);
  }

  public static generateSpriteSet(species: CreatureSpecies, mat: ChassisMaterial = 'wood'): CreatureSpriteSet {
    return SoulDollSpriteFactory.generateSpriteSet(species, mat);
  }

  public static generateFrontSprite(species: CreatureSpecies, mat: ChassisMaterial = 'wood'): HTMLCanvasElement {
    return SoulDollSpriteFactory.generateLayeredCanvas({
      speciesId: species.id,
      chassisMaterial: mat,
      view: 'front',
    });
  }

  public static generateBackSprite(species: CreatureSpecies, mat: ChassisMaterial = 'wood'): HTMLCanvasElement {
    return SoulDollSpriteFactory.generateLayeredCanvas({
      speciesId: species.id,
      chassisMaterial: mat,
      view: 'back',
    });
  }

  public static generateIconSprite(species: CreatureSpecies, mat: ChassisMaterial = 'wood'): HTMLCanvasElement {
    return SoulDollSpriteFactory.generateLayeredCanvas({
      speciesId: species.id,
      chassisMaterial: mat,
      view: 'icon',
    });
  }
}
