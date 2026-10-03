import themeTokens from './theme.json';

export interface ThemeTokens {
  name: string;
  version: string;
  colors: {
    base: {
      inkCrypt: string;
      smokedWood: string;
      bronze: string;
      gold: string;
      parchment: string;
      smoke: string;
    };
    ki: {
      cyan: string;
      soulViolet: string;
      rift: string;
      porcelainPink: string;
    };
    elements: Record<string, { primary: string; secondary: string }>;
    rarity: Record<string, string>;
  };
  typography: {
    titleFont: string;
    bodyFont: string;
    hudFont: string;
    damageFont: string;
    sizes: Record<string, number>;
  };
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, string>;
  animation: Record<string, number>;
}

export class ThemeManager {
  private static instance: ThemeManager;
  private tokens: ThemeTokens;

  private constructor() {
    this.tokens = this.validateTokens(themeTokens as ThemeTokens);
  }

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Runtime validation of design tokens
   */
  private validateTokens(rawTokens: ThemeTokens): ThemeTokens {
    if (!rawTokens.colors || !rawTokens.colors.base || !rawTokens.colors.base.inkCrypt) {
      throw new Error('[ThemeManager] Validation Error: Missing base color tokens in theme.json');
    }
    if (!rawTokens.colors.ki || !rawTokens.colors.ki.cyan) {
      throw new Error('[ThemeManager] Validation Error: Missing Ki color tokens in theme.json');
    }
    if (!rawTokens.colors.elements || !rawTokens.colors.elements.fuego) {
      throw new Error('[ThemeManager] Validation Error: Missing elemental tokens in theme.json');
    }
    return rawTokens;
  }

  public get Tokens(): ThemeTokens {
    return this.tokens;
  }

  /**
   * Converts hex string '#14101C' to Pixi number 0x14101C
   */
  public hexToNumber(hex: string): number {
    if (!hex) return 0x000000;
    const clean = hex.replace('#', '');
    return parseInt(clean, 16) || 0x000000;
  }

  // Base Colors
  public get inkCrypt(): string { return this.tokens.colors.base.inkCrypt; }
  public get inkCryptNum(): number { return this.hexToNumber(this.inkCrypt); }

  public get smokedWood(): string { return this.tokens.colors.base.smokedWood; }
  public get smokedWoodNum(): number { return this.hexToNumber(this.smokedWood); }

  public get bronze(): string { return this.tokens.colors.base.bronze; }
  public get bronzeNum(): number { return this.hexToNumber(this.bronze); }

  public get gold(): string { return this.tokens.colors.base.gold; }
  public get goldNum(): number { return this.hexToNumber(this.gold); }

  public get parchment(): string { return this.tokens.colors.base.parchment; }
  public get parchmentNum(): number { return this.hexToNumber(this.parchment); }

  public get smoke(): string { return this.tokens.colors.base.smoke; }
  public get smokeNum(): number { return this.hexToNumber(this.smoke); }

  // Ki Colors
  public get kiCyan(): string { return this.tokens.colors.ki.cyan; }
  public get kiCyanNum(): number { return this.hexToNumber(this.kiCyan); }

  public get kiViolet(): string { return this.tokens.colors.ki.soulViolet; }
  public get kiVioletNum(): number { return this.hexToNumber(this.kiViolet); }

  public get kiRift(): string { return this.tokens.colors.ki.rift; }
  public get kiRiftNum(): number { return this.hexToNumber(this.kiRift); }

  public get porcelainPink(): string { return this.tokens.colors.ki.porcelainPink; }
  public get porcelainPinkNum(): number { return this.hexToNumber(this.porcelainPink); }

  // Elemental Colors
  public getElementColor(type: string): { primary: string; secondary: string; primaryNum: number; secondaryNum: number } {
    const key = (type || 'neutro').toLowerCase();
    const elem = this.tokens.colors.elements[key] || this.tokens.colors.elements['neutro'];
    return {
      primary: elem.primary,
      secondary: elem.secondary,
      primaryNum: this.hexToNumber(elem.primary),
      secondaryNum: this.hexToNumber(elem.secondary),
    };
  }

  // Rarity Colors
  public getRarityColor(rarity: string): { hex: string; num: number } {
    const key = (rarity || 'comun').toLowerCase();
    const hex = this.tokens.colors.rarity[key] || this.tokens.colors.rarity['comun'];
    return { hex, num: this.hexToNumber(hex) };
  }

  /**
   * Helper to darken / lighten hex colors
   */
  public adjustColor(hex: string, percent: number): string {
    const cleanHex = (hex || '#6366f1').replace('#', '');
    const num = parseInt(cleanHex, 16) || 0x6366f1;
    let r = (num >> 16) + Math.round(255 * (percent / 100));
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
    let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
}

export const GlobalTheme = ThemeManager.getInstance();
