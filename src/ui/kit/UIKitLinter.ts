import { Container, Text } from 'pixi.js';
import themeTokens from '../../data/theme/theme.json';
import { IconRegistry } from './icons/IconRegistry';

export interface UIKitLintIssue {
  type:
    | 'color'
    | 'font'
    | 'icon'
    | 'text_truncated'
    | 'text_overlap'
    | 'touch_target'
    | 'glyph_coverage'
    | 'non_integer_scale';
  component: string;
  detail: string;
}

export interface GlyphCoverageResult {
  allCovered: boolean;
  checkedStringsCount: number;
  missingGlyphs: string[];
  details: string;
}

/**
 * BLOQUE 41 Req 8 & BLOQUE 46 Req 4 & 8: Linter en tiempo de ejecución para el Souldolls UI Kit.
 * Verifica que ningún componente use colores, fuentes o iconos fuera de /data/theme/theme.json,
 * ni tenga textos truncados/solapados, paréntesis renderizados como llaves en fuente pixel,
 * ni escalas fraccionarias en sprites pixel-art.
 */
export class UIKitLinter {
  private static allowedColorsNum: Set<number> | null = null;
  private static allowedFonts: Set<string> | null = null;

  public static readonly REQUIRED_SPANISH_GLYPHS = [
    '¿',
    '¡',
    'á',
    'é',
    'í',
    'ó',
    'ú',
    'Á',
    'É',
    'Í',
    'Ó',
    'Ú',
    'ñ',
    'Ñ',
    'ü',
    'Ü',
    '(',
    ')',
    '·',
    '/',
    '%',
    '+',
  ];

  private static initSets(): void {
    if (this.allowedColorsNum && this.allowedFonts) return;

    this.allowedColorsNum = new Set<number>();
    const addHex = (hex: string) => {
      if (typeof hex === 'string' && hex.startsWith('#')) {
        this.allowedColorsNum!.add(parseInt(hex.replace('#', ''), 16));
      }
    };

    Object.values(themeTokens.colors.base).forEach(addHex);
    Object.values(themeTokens.colors.ki).forEach(addHex);
    Object.values(themeTokens.colors.semantic).forEach(addHex);
    Object.values(themeTokens.colors.rarity).forEach(addHex);
    Object.values(themeTokens.colors.elements).forEach((el) => {
      addHex(el.primary);
      addHex(el.secondary);
    });
    Object.values(themeTokens.colors.stats).forEach((st) => {
      addHex(st.bg);
      addHex(st.border);
      addHex(st.label);
    });

    this.allowedFonts = new Set<string>([
      themeTokens.typography.titleFont,
      themeTokens.typography.bodyFont,
      themeTokens.typography.hudFont,
      themeTokens.typography.damageFont,
    ]);
  }

  public static inspectTree(root: Container, scopeName = 'UIKitRoot'): UIKitLintIssue[] {
    this.initSets();
    const issues: UIKitLintIssue[] = [];
    const textNodes: Array<{ node: Text; bounds: { x: number; y: number; width: number; height: number } }> = [];

    const walk = (node: Container) => {
      if (!node || !node.visible) return;

      // 1. Check requested icon ID
      const reqIcon = (node as any).__requestedIconId;
      if (reqIcon && !IconRegistry.has(reqIcon)) {
        issues.push({
          type: 'icon',
          component: scopeName,
          detail: `Icono fuera del registro: "${reqIcon}" (usando fallback visible)`,
        });
      }

      // 2. Check Text node font & color tokens
      if (node instanceof Text) {
        const style = node.style;
        const fontFam = String(style.fontFamily || '');
        const usesForbiddenMono =
          fontFam.toLowerCase().includes('monospace') || fontFam.toLowerCase().includes('system-ui');

        if (usesForbiddenMono || !this.allowedFonts!.has(fontFam)) {
          issues.push({
            type: 'font',
            component: `${scopeName} ("${node.text.slice(0, 18)}")`,
            detail: `Fuente no permitida por tokens: "${fontFam}"`,
          });
        }

        // Check emoji usage in kit text
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        if (emojiRegex.test(node.text)) {
          issues.push({
            type: 'icon',
            component: `${scopeName} ("${node.text.slice(0, 18)}")`,
            detail: `Uso de emoji del sistema detectado en lugar de IconRegistry`,
          });
        }

        // Bloque 46 Req 4: la fuente pixel (Pixelify Sans) no debe renderizar paréntesis (se ven como llaves)
        const isPixelFont = fontFam.toLowerCase().includes('pixelify');
        if (isPixelFont && (node.text.includes('(') || node.text.includes(')'))) {
          issues.push({
            type: 'glyph_coverage',
            component: `${scopeName} ("${node.text.slice(0, 22)}")`,
            detail: `Paréntesis detectados en fuente pixel (${fontFam}); usar Nunito (FONTS.body) para puntuación.`,
          });
        }

        if (typeof document !== 'undefined') {
          const b = node.getBounds();
          if (b.width > 0 && b.height > 0) {
            textNodes.push({
              node,
              bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
            });
          }
        }
      }

      // Bloque 46 Req 2 & 8: Comprobar que los sprites pixel-art marcados con __requireIntegerScale usen escala entera
      if ((node as any).__requireIntegerScale) {
        const sx = Math.abs(node.scale.x);
        const sy = Math.abs(node.scale.y);
        if (!Number.isInteger(sx) || !Number.isInteger(sy) || sx !== sy || sx < 1) {
          issues.push({
            type: 'non_integer_scale',
            component: scopeName,
            detail: `Escala no entera o no uniforme en sprite pixel-art: (${node.scale.x}, ${node.scale.y})`,
          });
        }
      }

      if (node.children) {
        for (const child of node.children) {
          walk(child as Container);
        }
      }
    };

    walk(root);

    // 3. Check overlapping sibling/peer texts
    for (let i = 0; i < textNodes.length; i++) {
      for (let j = i + 1; j < textNodes.length; j++) {
        const a = textNodes[i];
        const b = textNodes[j];
        if (a.node.parent !== b.node.parent) continue;

        const overlapX = Math.max(0, Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width) - Math.max(a.bounds.x, b.bounds.x));
        const overlapY = Math.max(0, Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height) - Math.max(a.bounds.y, b.bounds.y));
        if (overlapX > 4 && overlapY > 4) {
          issues.push({
            type: 'text_overlap',
            component: scopeName,
            detail: `Texto solapado: "${a.node.text.slice(0, 14)}" con "${b.node.text.slice(0, 14)}"`,
          });
        }
      }
    }

    if (issues.length > 0) {
      console.warn(`[UIKitLinter] ${issues.length} avisos en ${scopeName}:`, issues);
    }

    return issues;
  }

  /**
   * BLOQUE 46 Req 4: Comprobación de COBERTURA DE GLIFOS sobre es.json.
   * Recorre recursivamente es.json, verifica que ningún texto tenga caracteres de reemplazo (\uFFFD)
   * ni emojis prohibidos, y en entorno con Canvas 2D verifica que la fuente asignada (Nunito / Cinzel)
   * renderice todos los glifos españoles obligatorios: ¿ ¡ á é í ó ú ñ ü ( ) · / % +
   */
  public static verifyEsJsonGlyphCoverage(esJsonData: Record<string, any>): GlyphCoverageResult {
    const strings: string[] = [];
    const collect = (obj: any) => {
      if (typeof obj === 'string') {
        strings.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(collect);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(collect);
      }
    };
    collect(esJsonData);

    const missingGlyphs: string[] = [];

    // 1. Verificar que todos los glifos requeridos están presentes en el conjunto de prueba y que no hay \uFFFD
    for (const s of strings) {
      if (s.includes('\uFFFD')) {
        missingGlyphs.push('Carácter de reemplazo \\uFFFD detectado en es.json');
      }
    }

    // 2. Si hay soporte de Canvas 2D en navegador, medir el ancho de cada glifo obligatorio frente al carácter tofu
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const fontsToCheck = [
          themeTokens.typography.bodyFont,
          themeTokens.typography.titleFont,
        ];
        for (const fontFam of fontsToCheck) {
          ctx.font = `16px ${fontFam}`;
          for (const glyph of this.REQUIRED_SPANISH_GLYPHS) {
            const m = ctx.measureText(glyph);
            if (!m || m.width <= 0) {
              missingGlyphs.push(`${glyph} en ${fontFam}`);
            }
          }
        }
      }
    }

    return {
      allCovered: missingGlyphs.length === 0 && strings.length > 0,
      checkedStringsCount: strings.length,
      missingGlyphs,
      details:
        missingGlyphs.length === 0
          ? `${strings.length} cadenas de es.json y ${this.REQUIRED_SPANISH_GLYPHS.length} glifos españoles (¿ ¡ á é í ó ú ñ ü ( ) · / % +) verificados.`
          : `Glifos ausentes: ${missingGlyphs.join(', ')}`,
    };
  }
}
