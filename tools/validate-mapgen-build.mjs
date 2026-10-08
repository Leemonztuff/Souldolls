#!/usr/bin/env node
/**
 * BLOQUE 47 (Paso 5): Compuerta de QA de Build y Pureza (tools/validate-mapgen-build.mjs)
 * Rompe el build (exit 1) si:
 * 1. Algún archivo en /src/systems/mapgen importa DOM, Three, Pixi, render o ui (Invariante I-03).
 * 2. Algún archivo en /src importa /tools/mapgen de forma estática (`import ... from '...tools/mapgen...'`).
 * 3. El bundle de producción en /dist contiene rastros del editor visual (`mapgen-editor-root` o `mountMapGenEditor`) (Invariante I-12).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SYSTEMS_MAPGEN_DIR = path.join(ROOT, 'src/systems/mapgen');
const SRC_DIR = path.join(ROOT, 'src');
const DIST_DIR = path.join(ROOT, 'dist');

const errors = [];

function walkFiles(dir, extFilter = ['.ts', '.tsx', '.js', '.mjs']) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extFilter));
    } else if (extFilter.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// 1. Verificar pureza de /src/systems/mapgen (I-03: sin DOM, Three, Pixi, render, ui)
const mapgenSystemFiles = walkFiles(SYSTEMS_MAPGEN_DIR, ['.ts']);
const forbiddenPurePatterns = [
  { regex: /from\s+['"]three['"]/, reason: 'import de Three.js' },
  { regex: /from\s+['"]pixi\.js['"]/, reason: 'import de PixiJS' },
  { regex: /from\s+['"][^'"]*\/render\//, reason: 'import de /render' },
  { regex: /from\s+['"][^'"]*\/ui\//, reason: 'import de /ui' },
  { regex: /\b(window\.|document\.|localStorage\.|HTMLCanvasElement\b|HTMLElement\b)/, reason: 'uso de APIs de DOM/window' },
];

for (const file of mapgenSystemFiles) {
  const rawContent = fs.readFileSync(file, 'utf8');
  // Strip single-line and multi-line comments before checking identifier usage
  const codeOnly = rawContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const rel = path.relative(ROOT, file);
  for (const pat of forbiddenPurePatterns) {
    if (pat.regex.test(codeOnly)) {
      errors.push(`[I-03 Violación en ${rel}] Detectado ${pat.reason} dentro de /systems/mapgen.`);
    }
  }
}

// 2. Verificar que ningún archivo en /src haga import estático de /tools/mapgen
const srcFiles = walkFiles(SRC_DIR, ['.ts', '.tsx']);
const staticToolsImportRegex = /^\s*import\s+[^;]*from\s+['"][^'"]*tools\/mapgen[^'"]*['"]/m;

for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (staticToolsImportRegex.test(content)) {
    errors.push(`[I-12 Violación en ${rel}] Import estático de /tools/mapgen prohibido. Usa import() dinámico protegido por import.meta.env.DEV.`);
  }
}

// 3. Si existe /dist, verificar que ningún archivo JS del bundle de producción contenga el editor visual
if (fs.existsSync(DIST_DIR)) {
  const distFiles = walkFiles(DIST_DIR, ['.js', '.mjs']);
  const forbiddenBundleMarkers = ['mapgen-editor-root', 'mountMapGenEditor', 'STAMP PLACEMENT PALETTE'];
  for (const file of distFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const marker of forbiddenBundleMarkers) {
      if (content.includes(marker)) {
        errors.push(`[I-12 Fuga en Build de Producción] El archivo ${rel} incluye código del editor de desarrollo ("${marker}").`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('❌ [Bloque 47 QA Gate] Falló la verificación de pureza y aislamiento de build:');
  for (const e of errors) {
    console.error('  -', e);
  }
  process.exit(1);
}

console.log(
  `✅ [Bloque 47 QA Gate] /systems/mapgen puro (${mapgenSystemFiles.length} archivos), 0 imports estáticos a /tools/mapgen en /src y 0 fugas del editor en dist/.`
);
