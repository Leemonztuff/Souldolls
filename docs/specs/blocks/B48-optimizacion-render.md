# BLOQUE 48: Optimización de render (Three / Pixi / resolución / pausa)

- Depende de: B4, B36, B44, B45
- Modifica: `src/render/**`, `src/perf/**`, `scripts/perf-scenarios.ts`, `src/main.ts`, `src/core/GameLoop.ts`, `docs/perf/**`
- Estado: **EN CURSO** · Spec v1.0 (2026-10-05)

> Nota de numeración: la "auditoría + línea base" que el usuario pidió como *B47* queda
> absorbida aquí, porque **B47 ya está ocupado** en `docs/STATUS.md` por el Bloque de Almas Metaball.

## Objetivo (presupuesto)

- 60 fps (móvil medio) / 1080p escritorio, **p95 < 20 ms**.
- Draw calls: **Three < 150** y **Pixi < 60** en batalla.
- Carga inicial < 3 s en 4G; bundle inicial < 1 MB gzip.
- Cero fugas tras 10 viajes (geo/texturas a la línea base).

## Plan aprobado — aplicar **en orden**, midiendo antes/después y **revirtiendo lo que no mejore**

1. **Three**: `InstancedMesh` por tile, chunking + culling, atlas de texturas, materiales
   compartidos, dispose verificado, sombras selectivas.
2. **Pixi**: render por diferencias, pooling de partículas/números flotantes, atlas de sprites,
   cero objetos por frame, `BitmapText`.
3. **Escalado dinámico de resolución**: bajar `pixelRatio` si p95 > 22 ms.
4. **Pausa total** del loop con la pestaña oculta + `webglcontextlost/restored`.

Sin tocar lógica de juego fuera del plan. Cada punto: reportar antes/después.

## Harness de medición (CONSTRUIDO ✔)

| Pieza | Archivo |
|---|---|
| Sonda por frame (`Float64Array`, sin alloc/frame, percentiles, draw calls GL, objetos Pixi, heap, alloc/frame) | `src/perf/PerfProbe.ts` |
| Overlay F3 (captura de tecla, `Shift+F3` la delega a Overworld) | `src/perf/PerfOverlay.ts` |
| Conducción de escenarios `window.__perf` (`init/scene/begin/end/gotoMap/setEncounters/forceBattle/battleMove/openMenu/gc/baseline/frames…`) | `src/perf/harness.ts` |
| Carga diferida única (`?perf=1` o DEV) | `src/perf/index.ts` + hook en `src/main.ts` |
| Driver de escenarios | `scripts/perf-scenarios.ts` (`npm run perf:scenarios`) |

Grupos: `boot` (4G 9/3 Mbps 150 ms + CPU 4×), `walk`, **`stand`** (determinista: inmóvil en el
spawn ⇒ misma cámara/contenido entre builds → es el grupo que sirve para *antes/después*),
`battle`, `menus`, `transitions` (+ prueba de fugas de 10 warps).
Opciones: `--label`, `--maps a,b,c`, `--walk-secs`, `--battles`, `--no-build`, `--base <url>`.

```bash
npx tsx scripts/perf-scenarios.ts stand --label X [--maps villa_brote,bosque_eco]
npx tsx scripts/perf-scenarios.ts all   --label X        # corrida completa
npx tsx scripts/_dc.ts <mapa...>        # diagnóstico de draw calls por subárbol/atributo
```

**Limitación del entorno**: headless Chromium + SwiftShader (sin GPU). Los FPS absolutos **no**
son representativos; sí lo son draw calls, triángulos, geometrías/texturas, bytes y deltas
relativos. El presupuesto de ms en GPU real sólo se puede validar en dispositivo.

## Línea base — `docs/perf/raw/baseline.json` (2026-10-05, 1280×720)

| Métrica | Valor |
|---|---|
| Boot a Title (4G + CPU 4×) | **12,3 s** / 8,38 MB (PNG 7,71 MB · JS 569 KB) |
| Walk `ruta_claro` / `bosque_eco` / `villa_brote` | 531 / 691 / 531 draw calls de media (máx. 666 / 761 / 531) |
| Menús (p95) | 1,5 – 2,7 s por frame; hasta 104 calls Pixi, 732 objetos |
| Batalla (3 VFX) | p95 1,52 s; Three 490 calls; Pixi 40 calls / 495 objetos |
| Warp | 5,4 – 9,1 s por cambio de mapa |
| Fugas (10 warps) | geometrías +0, texturas +2, heap +0,88 MB |
| Diagnóstico por subárbol | `TileRenderer_FacadesAndProps` concentra 768–1348 meshes individuales |

## P1.1 ✔ COMPLETO — Sombras de contacto fusionadas (1 malla por opacidad)

`src/render/overworld/TileRenderer.ts`: `addContactShadow()` acumula `CircleGeometry` y
`flushContactShadows()` funde por opacidad (0,36 props / 0,44 casas) → **1 o 2 mallas** en vez
de 144–276; materiales del lote se disposed en `clearMaterials()`.

Comparativa `stand` (misma cámara, mismo spawn):

| Mapa | Draw calls | Geometrías | Materiales |
|---|---|---|---|
| `ruta_claro` | 490 → **461** | 207 → 176 | — |
| `bosque_eco` | 629 → **567** | 290 → 227 | — |
| `villa_brote` | 532 → **487** | 278 → 235 | 203 → **62** |

fps dentro del ruido (0,7–1,0) ⇒ se conserva. Evidencia: `docs/perf/raw/base-stand.json` y
`docs/perf/raw/p1.1-stand.json`.

## P1.3 ⏳ PENDIENTE — Fusión de fachadas/props billboards (diseño cerrado, **no implementado**)

**Problema**: 666–1125 quads de 4 vértices (fachadas, bases de props, copas, siluetas de la
falda de horizonte) son 1 `THREE.Mesh` cada uno → ~400 draw calls visibles.

**Diseño aprobado (reanudar desde aquí):**

1. Lotes `Map<string, BillboardBatch>` con clave `chunk(16) × material(prop|star) × renderOrder ×
   castShadow/receiveShadow`; los quads se guardan en **espacio mundo**.
2. `addBillboardQuad({ geo, worldX/Y/Z, tiltX, renderOrder, castShadow, … })` → devuelve
   `{ mesh, start, count }` (`BillboardFadeRange`) y `flushMergedBillboards(starGroup, propsGroup)`
   construye 1 malla por lote (`renderOrder ≥ 25` → `starOverlayGroup`).
3. Atributos por vértice: `aPivot` (vec3 = posición mundial del mesh), `aTiltX` (float),
   `aFade` (float = 1).
4. Shader en `createTileMaterial({ billboardYaw: true })`: uniform compartido
   `cameraYawUniform`, en `<beginnormal_vertex>` y `<begin_vertex>` rotar `position − aPivot`
   por **Y (yaw) y después X (tilt)** — mismo orden Euler `'XYZ'` de Three — y
   `diffuseColor.a *= vPropFade` antes de `<alphatest_fragment>`.
5. `OccludableEntry` pasa a `fadeRanges` y `MapRenderer.updateOcclusion()` escribe en `aFade`
   (el material ya es compartido: hoy el fade muta el material y se aplica a **todos** los props).
6. `TileRenderer.update(dt, cameraYaw)` deja de ignorar `cameraYaw` → `cameraYawUniform.value`.
7. Sólo se fusionan los quads que hoy van a `billboardMeshes`; **no** tocar modo plano clásico,
   etapas de autoría, alfombras ni los atlas custom (Lab/Taller/Mercado).

**Trampas detectadas:** un `aFade` ausente = 0 ⇒ quad invisible (los atributos faltantes caen a
(0,0,0,1) en WebGL); los materiales con inyección han de ser **dedicados** (no `propMat`/`starMat`
compartidos con mallas sin fusión); los cuadernos de sombra de contacto ya no culling por mesh
(los lotes grandes siempre se dibujan ⇒ medir fps, no sólo draw calls).

Estado del fichero: los cambios parciales de P1.3 se **revertieron** para dejar `npm run lint`
en verde; este documento conserva el diseño.

## Pendiente

- **P1.2** materiales compartidos de casas (`buildArchitecturalHouses` crea ~8 por casa).
- **P1.4** fusión de las cajas de las casas (vertex colors ⇒ ~2 mallas por casa).
- **P1.5** dispose verificado: `MapRenderer.clear()` no dispone materiales ni texturas.
- **P1.6** sombras selectivas (hoy sólo ~25 draw calls de más: medir coste de relleno).
- **P2** Pixi (render por diferencias, pooling, atlas, `BitmapText`).
- **P3** escalado dinámico de resolución (p95 > 22 ms).
- **P4** pausa con pestaña oculta + `webglcontextlost/restored` sin `location.reload()`.

## Verificación por punto

`npm run lint` → `npm run test:all` → `npx tsx scripts/perf-scenarios.ts stand --label pN`
(y `walk`/`all` al cierre). Guardar cada corrida en `docs/perf/raw/` y reportar la tabla
antes/después. Revertir todo lo que no mejore.
