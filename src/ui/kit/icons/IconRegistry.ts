import { Container, Graphics } from 'pixi.js';
import { COLOR_NUM, COLOR_SEMANTIC } from '../../styles';

export type KitIconId =
  | 'coin'
  | 'soul_fragment'
  | 'ki_dust'
  | 'guild_seal'
  | 'clock'
  | 'trainer'
  | 'sword'
  | 'relic'
  | 'accessory'
  | 'bottle'
  | 'elixir'
  | 'body_chassis'
  | 'crystal'
  | 'repair_kit'
  | 'heart_full'
  | 'heart_empty'
  | 'star_full'
  | 'star_empty'
  | 'check'
  | 'close'
  | 'chevron_right'
  | 'chevron_left'
  | 'warning'
  | 'quest_scroll'
  | 'codex_book'
  | 'workshop_anvil'
  | 'shop_scales'
  | 'soul_orb'
  | 'qr_code'
  | 'settings_gear'
  | 'quests'
  | 'codex'
  | 'shop'
  | 'party'
  | 'back'
  | 'spark'
  | 'scroll'
  | 'compass'
  | 'menu_hamburger'
  | 'soul_bottle'
  | 'heart'
  | 'workshop'
  | 'star'
  | 'storage'
  | 'bag'
  | 'potion'
  | 'weapon'
  | 'fallback';

/**
 * BLOQUE 41 Req 3: Registro de iconos procedurales en pixel-art (sin emojis del sistema).
 * Si un id no existe en el registro, dibuja un icono de reserva visible ('fallback') y registra aviso en el linter.
 */
export class IconRegistry {
  private static knownIds: Set<string> = new Set([
    'coin',
    'soul_fragment',
    'ki_dust',
    'guild_seal',
    'clock',
    'trainer',
    'sword',
    'relic',
    'accessory',
    'bottle',
    'elixir',
    'body_chassis',
    'crystal',
    'repair_kit',
    'heart_full',
    'heart_empty',
    'star_full',
    'star_empty',
    'check',
    'close',
    'chevron_right',
    'chevron_left',
    'warning',
    'quest_scroll',
    'codex_book',
    'workshop_anvil',
    'shop_scales',
    'soul_orb',
    'qr_code',
    'settings_gear',
    'quests',
    'codex',
    'shop',
    'party',
    'back',
    'spark',
    'scroll',
    'compass',
    'menu_hamburger',
    'soul_bottle',
    'heart',
    'workshop',
    'star',
    'storage',
    'bag',
    'potion',
    'weapon',
    'fallback',
  ]);

  public static has(id: string): boolean {
    return this.knownIds.has(id);
  }

  public static getAllIds(): KitIconId[] {
    return Array.from(this.knownIds) as KitIconId[];
  }

  public static createSprite(id: string, size = 16, tintOverride?: number): Container {
    return this.create(id, size, tintOverride);
  }

  public static create(id: string, size = 16, tintOverride?: number): Container {
    const c = new Container();
    c.roundPixels = true;
    (c as any).__kitIconId = this.knownIds.has(id) ? id : 'fallback';
    (c as any).__requestedIconId = id;

    const g = new Graphics();
    const s = Math.max(8, Math.round(size));
    const half = Math.round(s / 2);

    const aliasMap: Record<string, string> = {
      quests: 'quest_scroll',
      scroll: 'quest_scroll',
      codex: 'codex_book',
      shop: 'shop_scales',
      party: 'soul_orb',
      back: 'chevron_left',
      spark: 'ki_dust',
      soul_bottle: 'bottle',
      heart: 'heart_full',
      workshop: 'workshop_anvil',
      star: 'star_full',
      storage: 'body_chassis',
      bag: 'bottle',
      potion: 'elixir',
      weapon: 'sword',
    };
    const resolvedId = aliasMap[id] || id;
    const drawId = this.knownIds.has(resolvedId) ? resolvedId : 'fallback';

    switch (drawId) {
      case 'coin': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.circle(half, half, half - 1);
        g.fill({ color: col });
        g.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
        g.rect(half - 1, 4, 2, s - 8);
        g.fill({ color: COLOR_NUM.inkCrypt });
        break;
      }
      case 'soul_fragment': {
        const col = tintOverride ?? COLOR_NUM.soulViolet;
        g.poly([
          { x: half, y: 1 },
          { x: s - 2, y: half },
          { x: half, y: s - 1 },
          { x: 2, y: half },
        ]);
        g.fill({ color: col });
        g.stroke({ color: COLOR_NUM.parchment, width: 1 });
        break;
      }
      case 'ki_dust': {
        const col = tintOverride ?? COLOR_NUM.cyan;
        g.poly([
          { x: half, y: 1 },
          { x: half + 2, y: half - 2 },
          { x: s - 1, y: half },
          { x: half + 2, y: half + 2 },
          { x: half, y: s - 1 },
          { x: half - 2, y: half + 2 },
          { x: 1, y: half },
          { x: half - 2, y: half - 2 },
        ]);
        g.fill({ color: col });
        break;
      }
      case 'guild_seal': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.poly([
          { x: half, y: 1 },
          { x: s - 2, y: 4 },
          { x: s - 3, y: s - 4 },
          { x: half, y: s - 1 },
          { x: 3, y: s - 4 },
          { x: 2, y: 4 },
        ]);
        g.fill({ color: COLOR_NUM.bronze });
        g.stroke({ color: col, width: 1.5 });
        g.circle(half, half, 2.5);
        g.fill({ color: COLOR_NUM.cyan });
        break;
      }
      case 'clock': {
        const col = tintOverride ?? COLOR_NUM.parchment;
        g.circle(half, half, half - 1.5);
        g.stroke({ color: col, width: 1.5 });
        g.moveTo(half, half).lineTo(half, 4);
        g.moveTo(half, half).lineTo(s - 4, half);
        g.stroke({ color: COLOR_NUM.gold, width: 1.5 });
        break;
      }
      case 'trainer': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.circle(half, 5, 3);
        g.fill({ color: col });
        g.roundRect(3, 9, s - 6, s - 10, 2);
        g.fill({ color: COLOR_NUM.bronze });
        g.stroke({ color: col, width: 1 });
        break;
      }
      case 'sword': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.moveTo(3, s - 3).lineTo(s - 3, 3);
        g.stroke({ color: COLOR_NUM.parchment, width: 2 });
        g.moveTo(4, s - 7).lineTo(7, s - 4);
        g.stroke({ color: col, width: 2 });
        break;
      }
      case 'relic': {
        const col = tintOverride ?? COLOR_NUM.soulViolet;
        g.circle(half, half, half - 2);
        g.stroke({ color: COLOR_NUM.gold, width: 1.5 });
        g.circle(half, half, 3);
        g.fill({ color: col });
        break;
      }
      case 'accessory': {
        const col = tintOverride ?? COLOR_NUM.cyan;
        g.circle(half, half + 1, half - 3);
        g.stroke({ color: COLOR_NUM.gold, width: 1.5 });
        g.rect(half - 2, 2, 4, 3);
        g.fill({ color: col });
        break;
      }
      case 'bottle': {
        const col = tintOverride ?? COLOR_NUM.cyan;
        g.rect(half - 2, 1, 4, 3);
        g.fill({ color: COLOR_NUM.gold });
        g.roundRect(3, 4, s - 6, s - 5, 3);
        g.fill({ color: COLOR_NUM.smokedWood });
        g.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
        g.circle(half, half + 2, 3);
        g.fill({ color: col });
        break;
      }
      case 'elixir': {
        const col = tintOverride ?? COLOR_SEMANTIC.ok;
        g.rect(half - 2, 1, 4, 3);
        g.fill({ color: COLOR_NUM.bronze });
        g.poly([
          { x: half - 2, y: 4 },
          { x: half + 2, y: 4 },
          { x: s - 2, y: s - 2 },
          { x: 2, y: s - 2 },
        ]);
        g.fill({ color: col });
        g.stroke({ color: COLOR_NUM.gold, width: 1 });
        break;
      }
      case 'body_chassis': {
        const col = tintOverride ?? COLOR_NUM.parchment;
        g.circle(half, 4, 2.5);
        g.roundRect(half - 3, 7, 6, 5, 1);
        g.rect(half - 6, 7, 2, 5);
        g.rect(half + 4, 7, 2, 5);
        g.fill({ color: col });
        break;
      }
      case 'crystal': {
        const col = tintOverride ?? COLOR_NUM.cyan;
        g.poly([
          { x: half, y: 1 },
          { x: s - 3, y: 5 },
          { x: s - 3, y: s - 5 },
          { x: half, y: s - 1 },
          { x: 3, y: s - 5 },
          { x: 3, y: 5 },
        ]);
        g.fill({ color: col });
        g.stroke({ color: COLOR_NUM.white, width: 1 });
        break;
      }
      case 'repair_kit': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.roundRect(2, 4, s - 4, s - 5, 2);
        g.fill({ color: COLOR_NUM.bronze });
        g.stroke({ color: col, width: 1.5 });
        g.rect(half - 1, 6, 2, 6);
        g.rect(half - 3, 8, 6, 2);
        g.fill({ color: COLOR_NUM.parchment });
        break;
      }
      case 'heart_full': {
        const col = tintOverride ?? COLOR_NUM.porcelainPink;
        g.circle(half - 3, 5, 3);
        g.circle(half + 3, 5, 3);
        g.poly([
          { x: 2, y: 6 },
          { x: s - 2, y: 6 },
          { x: half, y: s - 2 },
        ]);
        g.fill({ color: col });
        break;
      }
      case 'heart_empty': {
        const col = tintOverride ?? COLOR_NUM.disabledBorder;
        g.circle(half - 3, 5, 3);
        g.circle(half + 3, 5, 3);
        g.poly([
          { x: 2, y: 6 },
          { x: s - 2, y: 6 },
          { x: half, y: s - 2 },
        ]);
        g.stroke({ color: col, width: 1.2 });
        break;
      }
      case 'star_full': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.poly([
          { x: half, y: 1 },
          { x: half + 2, y: 5 },
          { x: s - 1, y: 6 },
          { x: half + 3, y: 9 },
          { x: s - 3, y: s - 1 },
          { x: half, y: s - 4 },
          { x: 3, y: s - 1 },
          { x: half - 3, y: 9 },
          { x: 1, y: 6 },
          { x: half - 2, y: 5 },
        ]);
        g.fill({ color: col });
        g.stroke({ color: COLOR_NUM.bronze, width: 1 });
        break;
      }
      case 'star_empty': {
        const col = tintOverride ?? COLOR_NUM.disabledBorder;
        g.poly([
          { x: half, y: 1 },
          { x: half + 2, y: 5 },
          { x: s - 1, y: 6 },
          { x: half + 3, y: 9 },
          { x: s - 3, y: s - 1 },
          { x: half, y: s - 4 },
          { x: 3, y: s - 1 },
          { x: half - 3, y: 9 },
          { x: 1, y: 6 },
          { x: half - 2, y: 5 },
        ]);
        g.stroke({ color: col, width: 1.2 });
        break;
      }
      case 'check': {
        const col = tintOverride ?? COLOR_SEMANTIC.ok;
        g.moveTo(3, half)
          .lineTo(half - 1, s - 3)
          .lineTo(s - 2, 3);
        g.stroke({ color: col, width: 2 });
        break;
      }
      case 'close': {
        const col = tintOverride ?? COLOR_NUM.parchment;
        g.moveTo(3, 3).lineTo(s - 3, s - 3);
        g.moveTo(s - 3, 3).lineTo(3, s - 3);
        g.stroke({ color: col, width: 2 });
        break;
      }
      case 'chevron_right': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.moveTo(5, 3)
          .lineTo(s - 4, half)
          .lineTo(5, s - 3);
        g.stroke({ color: col, width: 2 });
        break;
      }
      case 'chevron_left': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.moveTo(s - 5, 3)
          .lineTo(4, half)
          .lineTo(s - 5, s - 3);
        g.stroke({ color: col, width: 2 });
        break;
      }
      case 'warning': {
        const col = tintOverride ?? COLOR_SEMANTIC.warning;
        g.poly([
          { x: half, y: 2 },
          { x: s - 2, y: s - 2 },
          { x: 2, y: s - 2 },
        ]);
        g.fill({ color: col });
        g.rect(half - 1, 6, 2, 4);
        g.rect(half - 1, 11, 2, 2);
        g.fill({ color: COLOR_NUM.inkCrypt });
        break;
      }
      case 'quest_scroll': {
        g.roundRect(3, 2, s - 6, s - 4, 2);
        g.fill({ color: COLOR_NUM.parchment });
        g.stroke({ color: COLOR_NUM.bronze, width: 1.5 });
        g.moveTo(5, 6).lineTo(s - 5, 6);
        g.moveTo(5, 9).lineTo(s - 5, 9);
        g.stroke({ color: COLOR_NUM.inkCrypt, width: 1 });
        break;
      }
      case 'codex_book': {
        g.roundRect(2, 2, s - 4, s - 4, 2);
        g.fill({ color: COLOR_NUM.soulViolet });
        g.stroke({ color: COLOR_NUM.gold, width: 1.5 });
        g.circle(half, half, 2.5);
        g.fill({ color: COLOR_NUM.cyan });
        break;
      }
      case 'workshop_anvil': {
        g.rect(3, half, s - 6, 4);
        g.rect(5, half + 4, s - 10, 3);
        g.fill({ color: COLOR_NUM.bronze });
        g.stroke({ color: COLOR_NUM.gold, width: 1 });
        break;
      }
      case 'shop_scales': {
        g.moveTo(half, 2).lineTo(half, s - 2);
        g.moveTo(3, 6).lineTo(s - 3, 6);
        g.stroke({ color: COLOR_NUM.gold, width: 1.5 });
        g.circle(4, 10, 2);
        g.circle(s - 4, 10, 2);
        g.fill({ color: COLOR_NUM.bronze });
        break;
      }
      case 'soul_orb': {
        g.circle(half, half, half - 2);
        g.fill({ color: COLOR_NUM.soulViolet });
        g.circle(half, half, half - 4);
        g.fill({ color: COLOR_NUM.cyan });
        break;
      }
      case 'qr_code': {
        g.rect(2, 2, 5, 5);
        g.rect(s - 7, 2, 5, 5);
        g.rect(2, s - 7, 5, 5);
        g.rect(half, half, 4, 4);
        g.fill({ color: COLOR_NUM.parchment });
        break;
      }
      case 'settings_gear': {
        g.circle(half, half, half - 2);
        g.stroke({ color: COLOR_NUM.gold, width: 2 });
        g.circle(half, half, 2);
        g.fill({ color: COLOR_NUM.inkCrypt });
        break;
      }
      case 'compass': {
        const col = tintOverride ?? COLOR_NUM.gold;
        g.circle(half, half, half - 1.5);
        g.fill({ color: COLOR_NUM.inkCrypt });
        g.stroke({ color: col, width: 1.5 });
        // North needle (cyan ki)
        g.poly([
          { x: half, y: 2 },
          { x: half + 2.5, y: half },
          { x: half - 2.5, y: half },
        ]);
        g.fill({ color: COLOR_NUM.cyan });
        // South needle (gold)
        g.poly([
          { x: half, y: s - 2 },
          { x: half + 2.5, y: half },
          { x: half - 2.5, y: half },
        ]);
        g.fill({ color: COLOR_NUM.gold });
        g.circle(half, half, 1.5);
        g.fill({ color: COLOR_NUM.parchment });
        break;
      }
      case 'menu_hamburger': {
        const col = tintOverride ?? COLOR_NUM.parchment;
        const barW = s - 6;
        g.roundRect(3, 3, barW, 2, 1);
        g.roundRect(3, half - 1, barW, 2, 1);
        g.roundRect(3, s - 5, barW, 2, 1);
        g.fill({ color: col });
        break;
      }
      case 'fallback':
      default: {
        // Icono de reserva visible si falta (diamante magenta/ámbar de alerta)
        g.rect(1, 1, s - 2, s - 2);
        g.fill({ color: COLOR_NUM.rift });
        g.stroke({ color: COLOR_NUM.gold, width: 1.5 });
        g.moveTo(3, 3).lineTo(s - 3, s - 3);
        g.moveTo(s - 3, 3).lineTo(3, s - 3);
        g.stroke({ color: COLOR_NUM.white, width: 1.5 });
        break;
      }
    }

    c.addChild(g);
    return c;
  }
}
