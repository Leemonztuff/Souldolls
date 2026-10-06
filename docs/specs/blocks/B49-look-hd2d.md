# BLOQUE 49: Look HD-2D (Three.js) — auditoría y plan

- Depende de: B4, B36, B44, B45, **B48**
- Modifica: `src/render/**`, `src/data/config/`, `src/data/maps/src/*.map.json`, `src/data/quality.json` (nuevo), `src/scenes/OverworldScene.ts`, `src/ui/**` (selector de calidad), `docs/look/**`
- Estado: **PLAN · esperando aprobación** · v1.0 (2026-10-05)
- Restricción: **sin tocar `/systems` ni lógica de juego**; sólo `/render` y configuración/datos.

---

## 1. Auditoría (solo lectura, 2026-10-05)

### 1.1 `src/render/ThreeRenderer.ts` (110 líneas)

| Aspecto | Estado actual | Implicación |
|---|---|---|
| Render | `render()` = `renderer.render(scene, camera)` único (`ThreeRenderer.ts:83`) | **Punto único de enganche** para el pipeline; `resize()` (:71) debe redimensionar los RTs |
| Calidad | `antialias:true`, `setPixelRatio(min(dpr,2))`, `ACESFilmicToneMapping` exp 1.1, `PCFShadowMap` (:44-48) | MSAA + postproceso = doble coste; en HIGH conviene RT con `samples` y sin MSAA |
| Postproceso | **No existe** (ni composer, ni RTs, ni pases) | Hay que crear `src/render/post/` completo |
| Robustez | Sin `capabilities` (WebGL2 / float RT); `clearScene()` sólo recorre hijos de 1er nivel (:87-107) | Flags de fallback y dispose de RTs por calidad |
| Contexto | `webglcontextlost/restored` en `main.ts:50-57`; **restored = `location.reload()`** | B49 pide reconstruir el pipeline **sin** recargar |

Bucle: `Game.onRender` → `SceneManager.render` → `ThreeRenderer.render()` → `PixiRenderer.render()`
(`src/core/Game.ts:179-183`). **Pixi es un canvas distinto → queda fuera del postproceso por
diseño** (sólo hay que no tocarlo). `GameLoop` = 60 Hz fijo + rAF (`src/core/GameLoop.ts`).

### 1.2 `src/render/overworld/MapRenderer.ts` (697 líneas)

- `buildMap` (:53) → `TileRenderer` (suelo chunked 16×16; fachadas/props aún **1 mesh por tile**),
  `GlobalOverworldDecor` (InstancedMesh 16×16 con `sway`, hojas, luciérnagas), atlas custom
  Lab/Taller/Mercado.
- **Agua**: sólo desplazamiento de UV con `uWaterTime` (:591) → sin reflejo ni brillo para bloom.
- **Niebla**: `FogExp2(skyColor, 0.022 / 0.035)` en `buildMap` (:68-69) → sin gradiente por
  altura ni capa baja; `scene.background = Color` → **sin cielo**.
- **Luces puntuales**: ~12 `PointLight` en el fichero (:112, :116, :120, :260, :276, :413, :428,
  :546…) **sin límite N ni culado por distancia** (todas entran en el shader de cada material).
- **Ciclo día/noche parcial**: sólo faroles/ventanas (:613-638) y luciérnagas
  (`DecorRenderer.ts:1551`) leen la hora; **la luz del sol NO varía con la hora**.
- `updateOcclusion()` (:645) muta `material.opacity` → acopla el look a los materiales
  (conflicto directo con la fusión de materiales de B48 P1.2/P1.3).

### 1.3 Cámara — `src/render/overworld/OverworldCamera.ts` (112 líneas)

- `PerspectiveCamera` FOV 38, distancia 12, altura 11, yaw sólo en 4 pasos, lerp follow 10 /
  rot 8, bounds por mapa, `lookAt(target, 0.5, z)` (:87-112). Estable y centrada → **buena base
  para la banda nítida central del tilt-shift**; falta focal/DOF, shake y parámetros de "diorama".
- **Defecto de sombras**: `OverworldScene.ts:1017` mueve `sunLight.position = jugador + (10,22,12)`
  **cada frame**, pero la `shadow.camera` es la por defecto (±5, far 500), `bias -0.0005`, sin
  `normalBias` y **sin texel snapping** → parpadeo/recorte. `shadow.mapSize` fijo **2048**
  (`OverworldScene.ts:273-274`), independiente de la calidad.

### 1.4 Otros hallazgos

- Iluminación actual: 1 `AmbientLight(0xfffaed, 0.9)` + 1 `DirectionalLight(1.8)`
  (`OverworldScene.ts:267-276`). **No hay `HemisphereLight`** ni tinte por mapa/hora en la luz
  (sólo `sunlightColor` del mapa y `art.json.biomeTints` aplicados a la textura).
- Los sprites ya se iluminan con `MeshStandardMaterial` del atlas (`TileRenderer.createTileMaterial`)
  → pixel-art funciona, con coste PBR. AO falso hoy = sombras de contacto "blob" + `sway` del decor.
- Infra reutilizable: `PerfProbe` + overlay F3 (`src/perf/`, admite "ms por pase"), panel debug F2,
  `?debug`/`?perf`, `src/data/config/art.json` (`biomeTints`), campos de mapa
  `sunlightColor / skyColor / category / indoor`, tests = scripts `tsx` en `src/tests/`.
- Dependencias: **no** hay `postprocessing` ni `@react-three`. `three@0.186` trae
  `three/addons/postprocessing/*` **sin `.d.ts`** ⇒ con `strict:true` hará falta un shim
  (`src/types/three-addons.d.ts`). **No existe** `src/data/quality.json`.
- Medición: entorno headless SwiftShader → **los ms de GPU del postproceso no son
  representativos aquí**; sólo deltas relativos, draw calls, RT/memoria y CPU-side. El
  presupuesto "4 ms en HIGH" exigirá validación en GPU real.

---

## 2. Plan (aprobación pendiente)

**F0 — Estado limpio.** `npm run lint` en verde (B48 P1.3 revertido a P1.1; ver
`B48-optimizacion-render.md`).

**F1 — Pipeline de postproceso** `src/render/post/` (nuevo)
- `EffectComposer` de three (**0 deps nuevas**) + `RenderPass` + cadena de blur/bloom a media
  resolución + **un único ShaderPass final** fusionado: bloom selectivo (umbral alto; sólo
  luces/agua/magia) + tilt-shift/DOF por banda + viñeta + grading + grano, con RTs reutilizados,
  sin `readPixels` ni asignaciones por frame.
- Enganche en `ThreeRenderer.render()/resize()`; **Pixi intacto y siempre nítido**.
- Núcleo central nítido (`nearest`, alineado a píxel, sin filtrado); desenfoque sólo arriba/abajo
  y fondo. Sprites **nunca** en la banda desenfocada.
- Shim de tipos + flags de fallback (sin float RT / WebGL2 → degradado sin errores).

**F2 — Iluminación.** Shadow camera que sigue al foco con **texel snapping**, `PCFSoft`/VSM por
calidad, `mapSize` desde la calidad; `HemisphereLight` tintado por `look`+hora; **registry de luces
puntuales** (data-driven en el JSON de mapa: posición, color, intensidad, radio, parpadeo; límite N
+ culado por distancia a cámara); sprite que recibe luz ambiente/direccional sin romper el
pixel-art; sombra "blob" + proyección alargada según el sol; AO falso con decals (sin SSAO en
LOW/MEDIUM).

**F3 — Mundo.** Agua (reflejo falso del cielo, espuma, ondas, brillo que alimenta el bloom);
viento (extender el `sway` existente a árboles/pasto por vértice/instancia); pasto alto que se
aparta del jugador (uniform de posición); niebla por profundidad con color de bioma/altura + capa
baja en el bosque; partículas ambientales (polvo, hojas, luciérnagas, chispas, god rays falsos)
reutilizando `DecorRenderer`; cielo procedural con nubes y sombras de nube multiplicadas en la luz
principal.

**F4 — Niveles de calidad.** `src/data/quality.json` + `QualityManager`:
- LOW: sin postproceso salvo viñeta/grading, sombras sólo blob, 2 luces, partículas 30 %, pixelRatio 1.
- MEDIUM: bloom + grading + tilt-shift a resolución media, sombras 1024, 4 luces, partículas 60 %.
- HIGH: todo, sombras 2048, 8 luces, DOF mejor, agua con reflejo, partículas 100 %, pixelRatio ≤ 2.
- Benchmark de 2-3 s tras Boot (GPU info, dpr, memoria, frame time) + selector Auto/Bajo/Medio/Alto
  en Opciones; **gobernador**: p95 > 22 ms durante 3 s ⇒ baja escalonado (resolución de efectos →
  sombras → partículas → efectos) y sube sólo con margen sostenido e histéresis; **integrado con el
  escalado de B48 sin duplicar lógica**; aplica cambios sin recrear el renderer y libera RTs.

**F5 — Look por zona** (bloque `"look"` en cada `src/data/maps/src/*.map.json`, vía `mapgen`,
interpolación ~0.6 s): Villa Brote cálida/dorada/bloom bajo · Ruta Claro luminosa/sombras largas ·
Bosque Eco verdes profundos/rayos/niebla baja/luciérnagas · Cueva del Eco casi oscura/bloom alto/
viñeta fuerte · Interiores luz cálida puntual, sin sol, DOF mínimo.

**F6 — Debug (F2/F3).** Toggle por efecto, selector de calidad, slider de intensidad por efecto,
vista de mapa de sombras, vista de luces activas, modo comparar (split con/sin), captura de
pantalla; en F3, **ms por pase** del pipeline.

**F7 — Pruebas y entrega.** `src/tests/quality.test.ts` (cada nivel carga sin errores de shader en
3 mapas + interiores y fallbacks), capturas de referencia por mapa y calidad en `docs/look/`
(antes/después), tabla de rendimiento (ms de frame, draw calls, memoria GPU) por nivel × mapa,
`npm run lint` + `npm run test:all`, **revertir cualquier efecto que exceda el presupuesto**.

### Riesgos a vigilar
Postproceso HIGH ≤4 ms y total p95 <20 ms (medible sólo en GPU real) · LOW sin cadena de blur ·
coste de las luces puntuales sobre el atlas · que el tilt-shift no toque el canvas de Pixi ·
`updateOcclusion` frente a materiales compartidos.

---

## 3. Checkpoint (definición de hecho)

En cada mapa se nota el cambio de ambiente; los sprites se mantienen nítidos; HIGH/MEDIUM/LOW
funcionan; el gobernador baja y sube de nivel sin parpadeos al simular carga (throttling CPU en
devtools); la UI de Pixi no se ve afectada.

## 4. Entregables

Sólo ficheros nuevos o modificados + tabla de rendimiento antes/después + lista de parámetros
ajustables + bugs conocidos.

## 5. Decisiones abiertas (requieren aprobación)

1. **B48 P1.3** (fusión de billboards): ¿terminarlo antes de arrancar B49 o dejarlo para después?
2. **Postproceso**: `EffectComposer` de three + shader propio (**0 deps**) vs `pmndrs/postprocessing`.
3. **LOW**: viñeta/grading como pass barato sobre el canvas de Three (propuesta) vs overlay DOM
   por encima de ambos canvases.
