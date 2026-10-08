/**
 * BLOQUE 47 (Paso 1.4): Validador de reglas de diseño y estética de mapas (/systems/mapgen/validate.ts)
 * Cumple invariantes:
 * - I-03 (/systems puro): 0 imports de DOM, Three o Pixi; determinista.
 * - Implementa todas las reglas de B45 con su etapa obligatoria (1 a 4):
 *   · Etapa 1: degenerate, open-edge
 *   · Etapa 2: no-spawn, exit-edge, landmark-blocked, unreachable, path-width
 *   · Etapa 3: stamp-overlap, stamp-outside, stamp-door, window-no-focus, window-crowded
 *   · Etapa 4: patch-small, patch-rect, empty-zone
 * - Puntuación = 100 - 20 por error - 5 por aviso.
 */

import { BakedMapGrid, bakeMap } from './bake';
import { MapSourceSchemaV1 } from './schema';

export type ValidationRuleId =
  | 'degenerate'
  | 'open-edge'
  | 'no-spawn'
  | 'exit-edge'
  | 'landmark-blocked'
  | 'unreachable'
  | 'path-width'
  | 'stamp-overlap'
  | 'stamp-outside'
  | 'stamp-door'
  | 'window-no-focus'
  | 'window-crowded'
  | 'patch-small'
  | 'patch-rect'
  | 'empty-zone';

export type IssueSeverity = 'error' | 'warning';

export interface MapValidationIssue {
  id: string;
  ruleId: ValidationRuleId;
  stage: 1 | 2 | 3 | 4;
  severity: IssueSeverity;
  message: string;
  x: number;
  y: number;
  targetId?: string;
}

export interface WindowFocusDiagnostic {
  x: number;
  y: number;
  width: number;
  height: number;
  walkableRatio: number;
  focusIds: string[];
  status: 'ignored' | 'ok' | 'no-focus' | 'crowded';
}

export interface MapValidationReport {
  valid: boolean;
  score: number;
  errorCount: number;
  warningCount: number;
  issues: MapValidationIssue[];
  ruleSummary: Record<
    ValidationRuleId,
    {
      stage: 1 | 2 | 3 | 4;
      passed: boolean;
      issueCount: number;
    }
  >;
  windows: WindowFocusDiagnostic[];
}

export const RULE_STAGE_MAP: Record<ValidationRuleId, 1 | 2 | 3 | 4> = {
  degenerate: 1,
  'open-edge': 1,
  'no-spawn': 2,
  'exit-edge': 2,
  'landmark-blocked': 2,
  unreachable: 2,
  'path-width': 2,
  'stamp-overlap': 3,
  'stamp-outside': 3,
  'stamp-door': 3,
  'window-no-focus': 3,
  'window-crowded': 3,
  'patch-small': 4,
  'patch-rect': 4,
  'empty-zone': 4,
};

/**
 * Ejecuta todas las reglas de validación sobre un mapa fuente y su cuadrícula horneada.
 * @param source Especificación fuente del mapa (Schema 1)
 * @param preBaked Cuadrícula ya horneada (opcional; si no se pasa se hornea al vuelo)
 * @param upToStage Etapa máxima a exigir como error bloqueante (por defecto 4 = todas)
 */
export function validateMap(
  source: MapSourceSchemaV1,
  preBaked?: BakedMapGrid,
  upToStage: 1 | 2 | 3 | 4 | 5 | 6 = 4
): MapValidationReport {
  const baked = preBaked || bakeMap(source);
  const W = baked.width;
  const H = baked.height;
  const issues: MapValidationIssue[] = [];
  let seq = 1;

  const addIssue = (
    ruleId: ValidationRuleId,
    severity: IssueSeverity,
    message: string,
    x: number,
    y: number,
    targetId?: string
  ) => {
    const stage = RULE_STAGE_MAP[ruleId];
    if (stage > upToStage) return;
    issues.push({
      id: `${ruleId}-${seq++}`,
      ruleId,
      stage,
      severity,
      message,
      x: Math.max(0, Math.min(W - 1, Math.round(x))),
      y: Math.max(0, Math.min(H - 1, Math.round(y))),
      targetId,
    });
  };

  // ==========================================================================
  // ETAPA 1: DEGENERATE & OPEN-EDGE
  // ==========================================================================
  let walkableCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (baked.walkable[y][x]) walkableCount++;
    }
  }

  const degenerateRegion = (source.regions || []).find((r) => !r.points || r.points.length < 3);
  if (W < 10 || H < 10 || (source.regions || []).length === 0 || degenerateRegion || walkableCount < 16) {
    addIssue(
      'degenerate',
      'error',
      `Mapa degenerado: requiere dimensiones >= 10×10, al menos 1 región de >= 3 vértices y >= 16 celdas transitables (actual: ${walkableCount}).`,
      Math.floor(W / 2),
      Math.floor(H / 2),
      degenerateRegion?.id
    );
  }

  // open-edge: ninguna celda transitable toca void o el borde del mapa salvo en los huecos de salida
  let openEdgeReported = false;
  for (let y = 0; y < H && !openEdgeReported; y++) {
    for (let x = 0; x < W && !openEdgeReported; x++) {
      if (!baked.walkable[y][x]) continue;
      const isExitGap = baked.exitGapCells.has(`${x},${y}`);

      // 1. Toca el límite exterior del mapa fuera de un hueco de salida
      if ((x === 0 || x === W - 1 || y === 0 || y === H - 1) && !isExitGap) {
        addIssue(
          'open-edge',
          'error',
          `Borde abierto en (${x}, ${y}): una celda transitable toca el límite del mapa fuera de un hueco de salida ("exit").`,
          x,
          y
        );
        openEdgeReported = true;
        break;
      }

      // 2. Toca una celda 'void' interior (salvo si forma parte de un hueco de salida)
      if (!isExitGap) {
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < W && ny >= 0 && ny < H && baked.cells[ny][nx] === 'void') {
            addIssue(
              'open-edge',
              'error',
              `Borde abierto hacia el vacío (void) en (${x}, ${y}) junto a (${nx}, ${ny}).`,
              x,
              y
            );
            openEdgeReported = true;
            break;
          }
        }
      }
    }
  }

  // ==========================================================================
  // ETAPA 2: NO-SPAWN, EXIT-EDGE, LANDMARK-BLOCKED, UNREACHABLE, PATH-WIDTH
  // ==========================================================================
  const spawns = (source.landmarks || []).filter((lm) => lm.role === 'spawn');
  if (spawns.length === 0) {
    addIssue(
      'no-spawn',
      'error',
      'El mapa no tiene ningún landmark con rol "spawn" (punto de aparición).',
      Math.floor(W / 2),
      Math.floor(H / 2)
    );
  }

  const thickness = Math.max(0, Math.floor(source.border?.thickness ?? 0));
  const maxExitEdgeDist = Math.max(thickness + 2, 4);

  for (const lm of source.landmarks || []) {
    const inBounds = lm.x >= 0 && lm.x < W && lm.y >= 0 && lm.y < H;

    if (lm.role === 'exit') {
      const distEdge = Math.min(lm.x, W - 1 - lm.x, lm.y, H - 1 - lm.y);
      if (!inBounds || distEdge > maxExitEdgeDist) {
        addIssue(
          'exit-edge',
          'error',
          `El landmark de salida "${lm.label}" (${lm.id}) en (${lm.x}, ${lm.y}) debe situarse junto al borde del mapa (distancia <= ${maxExitEdgeDist}).`,
          lm.x,
          lm.y,
          lm.id
        );
      }
    }

    // landmark-blocked: aplica a todos los roles excepto "focus" (que puede estar sobre una fuente/estatua)
    if (lm.role !== 'focus') {
      if (!inBounds || !baked.walkable[lm.y][lm.x]) {
        addIssue(
          'landmark-blocked',
          'error',
          `El landmark "${lm.label}" (${lm.id}, rol=${lm.role}) en (${lm.x}, ${lm.y}) cae sobre una celda bloqueada.`,
          lm.x,
          lm.y,
          lm.id
        );
      }
    }
  }

  // BFS desde el primer spawn válido para comprobar alcanzabilidad (unreachable)
  const primarySpawn = spawns.find(
    (s) => s.x >= 0 && s.x < W && s.y >= 0 && s.y < H && baked.walkable[s.y][s.x]
  );

  if (primarySpawn) {
    const reachable: boolean[][] = Array.from({ length: H }, () =>
      Array.from({ length: W }, () => false)
    );
    const queue: [number, number][] = [[primarySpawn.x, primarySpawn.y]];
    reachable[primarySpawn.y][primarySpawn.x] = true;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && !reachable[ny][nx] && baked.walkable[ny][nx]) {
          reachable[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
    }

    const hasReachableNeighbor = (tx: number, ty: number): boolean => {
      if (tx >= 0 && tx < W && ty >= 0 && ty < H && reachable[ty][tx]) return true;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && reachable[ny][nx]) return true;
      }
      return false;
    };

    // Comprobar todos los landmarks
    for (const lm of source.landmarks || []) {
      let ok = false;
      if (lm.role === 'focus') {
        ok = hasReachableNeighbor(lm.x, lm.y);
        if (!ok && lm.x >= 0 && lm.x < W && lm.y >= 0 && lm.y < H) {
          // Si el landmark focus está en el centro de un monumento o fuente (ej. 3x3 bloqueado),
          // comprobar si existe una celda alcanzable a distancia Manhattan <= 2
          for (let dy = -2; dy <= 2 && !ok; dy++) {
            for (let dx = -2; dx <= 2 && !ok; dx++) {
              const nx = lm.x + dx;
              const ny = lm.y + dy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H && reachable[ny][nx]) {
                ok = true;
              }
            }
          }
        }
      } else {
        ok = lm.x >= 0 && lm.x < W && lm.y >= 0 && lm.y < H && reachable[lm.y][lm.x];
      }

      if (!ok) {
        addIssue(
          'unreachable',
          'error',
          `El landmark "${lm.label}" (${lm.id}) en (${lm.x}, ${lm.y}) es inalcanzable desde el spawn (${primarySpawn.x}, ${primarySpawn.y}).`,
          lm.x,
          lm.y,
          lm.id
        );
      }
    }

    // Comprobar la casilla de aproximación de cada puerta de stamp
    for (const rec of baked.stampRecords) {
      if (!rec.approachCell) continue;
      const { x: ax, y: ay } = rec.approachCell;
      if (ax < 0 || ax >= W || ay < 0 || ay >= H || !reachable[ay][ax]) {
        addIssue(
          'unreachable',
          'error',
          `La casilla de aproximación (${ax}, ${ay}) de la puerta del stamp "${rec.instanceId}" es inalcanzable desde el spawn.`,
          ax,
          ay,
          rec.instanceId
        );
      }
    }
  }

  // path-width: caminos main >= 2 de ancho libre y al menos 2 puntos válidos
  for (const p of source.paths || []) {
    if (p.rank !== 'main') continue;
    if (!p.points || p.points.length < 2) {
      addIssue('path-width', 'error', `El camino principal "${p.id}" tiene menos de 2 puntos.`, 0, 0, p.id);
      continue;
    }
    if ((p.widthJitter ?? 0) > 1.5) {
      const [px, py] = p.points[0];
      addIssue(
        'path-width',
        'error',
        `El camino principal "${p.id}" tiene widthJitter excesivo (${p.widthJitter}) que estrecha el carril por debajo de 2 tiles.`,
        px,
        py,
        p.id
      );
    }
    // Verificar que los puntos del camino principal tengan al menos un vecino transitable de carril >= 2 tiles
    for (const [wx, wy] of p.points) {
      const ix = Math.round(wx);
      const iy = Math.round(wy);
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue;
      let walkable2x2 = false;
      for (const [ox, oy] of [
        [0, 0],
        [-1, 0],
        [0, -1],
        [-1, -1],
      ]) {
        const x0 = ix + ox;
        const y0 = iy + oy;
        if (
          x0 >= 0 &&
          x0 + 1 < W &&
          y0 >= 0 &&
          y0 + 1 < H &&
          baked.walkable[y0][x0] &&
          baked.walkable[y0][x0 + 1] &&
          baked.walkable[y0 + 1][x0] &&
          baked.walkable[y0 + 1][x0 + 1]
        ) {
          walkable2x2 = true;
          break;
        }
      }
      if (!walkable2x2) {
        addIssue(
          'path-width',
          'error',
          `El camino principal "${p.id}" se estrecha a menos de 2 tiles transitables en (${ix}, ${iy}).`,
          ix,
          iy,
          p.id
        );
        break;
      }
    }
  }

  // ==========================================================================
  // ETAPA 3: STAMP-OVERLAP, STAMP-OUTSIDE, STAMP-DOOR, WINDOW-NO-FOCUS, WINDOW-CROWDED
  // ==========================================================================
  const reportedOverlapPairs = new Set<string>();

  for (const rec of baked.stampRecords) {
    // stamp-outside: fuera del mapa o invadiendo el borde
    if (rec.outOfBounds || rec.touchesBorder) {
      addIssue(
        'stamp-outside',
        'error',
        `El stamp "${rec.instanceId}" (${rec.stampId}) en (${rec.x}, ${rec.y}) se sale del mapa o pisa la banda de borde.`,
        rec.x,
        rec.y,
        rec.instanceId
      );
    }

    // stamp-overlap: solape entre dos stamps
    for (const otherId of rec.overlapsWith) {
      const pairKey = [rec.instanceId, otherId].sort().join('::');
      if (!reportedOverlapPairs.has(pairKey)) {
        reportedOverlapPairs.add(pairKey);
        addIssue(
          'stamp-overlap',
          'error',
          `Los stamps "${rec.instanceId}" y "${otherId}" se solapan.`,
          rec.x,
          rec.y,
          rec.instanceId
        );
      }
    }

    // stamp-door: la casilla de aproximación frente a la puerta debe estar dentro del mapa y ser transitable
    if (rec.doorCell && rec.approachCell) {
      const { x: ax, y: ay } = rec.approachCell;
      if (ax < 0 || ax >= W || ay < 0 || ay >= H || !baked.walkable[ay][ax]) {
        addIssue(
          'stamp-door',
          'error',
          `La puerta del stamp "${rec.instanceId}" tiene bloqueada su casilla de aproximación en (${ax}, ${ay}).`,
          ax,
          ay,
          rec.instanceId
        );
      }
    }
  }

  // Ventanas deslizantes de 9x13 tiles (paso 3, solo las que tienen >= 40% transitable):
  // - Deben tener al menos 1 punto focal (edificio con >= 40% de su huella visible, o landmark focus/rest/danger/exit)
  // - Y no más de 3 puntos focales (window-crowded)
  // - Los props y stamps transitables (well, statue, garden_plot, bridge) tienen countsAsFocus=false
  const WIN_W = 9;
  const WIN_H = 13;
  const WIN_STEP = 3;
  const windows: WindowFocusDiagnostic[] = [];

  for (let wy = 0; wy <= H - WIN_H; wy += WIN_STEP) {
    for (let wx = 0; wx <= W - WIN_W; wx += WIN_STEP) {
      let walkableInWin = 0;
      const totalWinCells = WIN_W * WIN_H;

      for (let y = wy; y < wy + WIN_H; y++) {
        for (let x = wx; x < wx + WIN_W; x++) {
          if (baked.walkable[y][x]) walkableInWin++;
        }
      }

      const walkableRatio = walkableInWin / totalWinCells;
      if (walkableRatio < 0.4) {
        windows.push({
          x: wx,
          y: wy,
          width: WIN_W,
          height: WIN_H,
          walkableRatio,
          focusIds: [],
          status: 'ignored',
        });
        continue;
      }

      const focusIds: string[] = [];

      // 1. Edificios / stamps con countsAsFocus === true y >= 40% de su huella dentro de la ventana
      for (const rec of baked.stampRecords) {
        if (!rec.placement.prefab.countsAsFocus) continue;
        const ix0 = Math.max(wx, rec.x);
        const iy0 = Math.max(wy, rec.y);
        const ix1 = Math.min(wx + WIN_W, rec.x + rec.width);
        const iy1 = Math.min(wy + WIN_H, rec.y + rec.height);
        if (ix1 > ix0 && iy1 > iy0) {
          const overlapArea = (ix1 - ix0) * (iy1 - iy0);
          const stampArea = rec.width * rec.height;
          if (overlapArea / stampArea >= 0.4) {
            focusIds.push(`stamp:${rec.instanceId}`);
          }
        }
      }

      // 2. Landmarks con rol focus | rest | danger | exit dentro de la ventana
      for (const lm of source.landmarks || []) {
        if (
          lm.role === 'focus' ||
          lm.role === 'rest' ||
          lm.role === 'danger' ||
          lm.role === 'exit'
        ) {
          if (lm.x >= wx && lm.x < wx + WIN_W && lm.y >= wy && lm.y < wy + WIN_H) {
            focusIds.push(`landmark:${lm.id}`);
          }
        }
      }

      let status: WindowFocusDiagnostic['status'] = 'ok';
      if (focusIds.length === 0) {
        status = 'no-focus';
        addIssue(
          'window-no-focus',
          'warning',
          `Ventana 9×13 en (${wx}, ${wy}) sin punto focal (requiere al menos 1 edificio o landmark focus/rest/danger/exit).`,
          wx + Math.floor(WIN_W / 2),
          wy + Math.floor(WIN_H / 2)
        );
      } else if (focusIds.length > 3) {
        status = 'crowded';
        addIssue(
          'window-crowded',
          'warning',
          `Ventana 9×13 en (${wx}, ${wy}) sobrecargada con ${focusIds.length} focos (máximo permitido: 3).`,
          wx + Math.floor(WIN_W / 2),
          wy + Math.floor(WIN_H / 2)
        );
      }

      windows.push({
        x: wx,
        y: wy,
        width: WIN_W,
        height: WIN_H,
        walkableRatio,
        focusIds,
        status,
      });
    }
  }

  // ==========================================================================
  // ETAPA 4: PATCH-SMALL, PATCH-RECT, EMPTY-ZONE
  // ==========================================================================
  for (const pr of baked.patchRecords) {
    if (pr.type === 'tall_grass' && pr.cells.length < 6) {
      addIssue(
        'patch-small',
        'error',
        `El parche de hierba alta "${pr.id}" tiene solo ${pr.cells.length} celdas (mínimo requerido: 6).`,
        pr.center[0],
        pr.center[1],
        pr.id
      );
    }

    if (pr.cells.length >= 6) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [gx, gy] of pr.cells) {
        if (gx < minX) minX = gx;
        if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy;
        if (gy > maxY) maxY = gy;
      }
      const bboxArea = (maxX - minX + 1) * (maxY - minY + 1);
      const fillRatio = pr.cells.length / bboxArea;
      if (fillRatio > 0.9) {
        addIssue(
          'patch-rect',
          'warning',
          `El parche "${pr.id}" rellena el ${(fillRatio * 100).toFixed(0)}% de su caja delimitadora (> 90%, silueta demasiado rectangular).`,
          pr.center[0],
          pr.center[1],
          pr.id
        );
      }
    }
  }

  // empty-zone: zona vacía >= 10x10 compuesta íntegramente por celdas 'ground' lisas sin caminos, parches, stamps ni landmarks
  const landmarkSet = new Set<string>(
    (source.landmarks || []).map((lm) => `${Math.round(lm.x)},${Math.round(lm.y)}`)
  );
  let emptyZoneFound = false;
  for (let ey = 0; ey <= H - 10 && !emptyZoneFound; ey += 2) {
    for (let ex = 0; ex <= W - 10 && !emptyZoneFound; ex += 2) {
      let allPlainGround = true;
      for (let y = ey; y < ey + 10 && allPlainGround; y++) {
        for (let x = ex; x < ex + 10; x++) {
          if (baked.cells[y][x] !== 'ground' || landmarkSet.has(`${x},${y}`)) {
            allPlainGround = false;
            break;
          }
        }
      }
      if (allPlainGround) {
        emptyZoneFound = true;
        addIssue(
          'empty-zone',
          'warning',
          `Zona vacía de >= 10×10 tiles de suelo liso sin caminos, parches, edificios ni landmarks en (${ex}, ${ey}).`,
          ex + 5,
          ey + 5
        );
      }
    }
  }

  // Resumen por regla y cálculo de puntuación
  const ruleIds = Object.keys(RULE_STAGE_MAP) as ValidationRuleId[];
  const ruleSummary = {} as MapValidationReport['ruleSummary'];
  for (const rId of ruleIds) {
    const count = issues.filter((iss) => iss.ruleId === rId).length;
    ruleSummary[rId] = {
      stage: RULE_STAGE_MAP[rId],
      passed: count === 0,
      issueCount: count,
    };
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - 20 * errorCount - 5 * warningCount);

  return {
    valid: errorCount === 0,
    score,
    errorCount,
    warningCount,
    issues,
    ruleSummary,
    windows,
  };
}
