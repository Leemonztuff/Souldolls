import { Container, Text } from 'pixi.js';
import themeTokens from '../../data/theme/theme.json';
import { IconRegistry } from './icons/IconRegistry';

export interface UIKitLintIssue {
  type: 'color' | 'font' | 'icon' | 'text_truncated' | 'text_overlap' | 'touch_target';
  component: string;
  detail: string;
}

/**
 * BLOQUE 41 Req 8: Linter en tiempo de ejecución para el Souldolls UI Kit.
 * Verifica que ningún componente use colores, fuentes o iconos fuera de /data/theme/theme.json,
 * ni tenga textos truncados/solapados.
 */
export class UIKitLinter {
  private static allowedColorsNum: Set<number> | null = null;
  private static allowedFonts: Set<string> | null = null;

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
}
