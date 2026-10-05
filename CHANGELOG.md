# CHANGELOG — SOULDOLLS

## [2026-10-05] — Bloque 46: Pantalla de Elección del Primer Souldoll (Rediseño) y Tutorial de Guía en Vivo
- **Auditoría y Spec (`docs/specs/blocks/B46-eleccion-primer-souldoll.md`):**
  - Verificados y documentados los 9 defectos del modal anterior (D-01 a D-09) y redactada la especificación completa v1.0.
- **View-Model Puro (`src/ui/viewmodels/StarterSelectVM.ts`, `data/starters.json`, `src/data/starters.json`):**
  - Implementado `buildStarterVM(gameState, startersData)` 100% libre de Pixi/DOM, alimentado por `starters.json`, `SoulSpecies`, `BODY_CHASSIS_DATA` y `es.json`, calculando los stats reales a Nv.5 con el *Cuerpo de Madera T1* (`StatCalculator`).
- **Layout Móvil Vertical y Horizontal (`src/ui/hud/StarterSelectionModal.ts`):**
  - Cabecera fija con botones `Volver` y `Cerrar` en espacios reservados (`44x44`), título autoajustable hasta `minTitlePx` o 2 líneas y subtítulo `"Paso 1 de 2 · El alma"`.
  - Escenario con arco del laboratorio, tubo de cristal encendido tenuemente, 3 columnas con la Souldoll enfocada al centro, orbe elemental con aura animada + icono/texto de rol, orientación por ranura (`view_front` al centro, `view_front34` a la izquierda, `view_front34` con `flipX` a la derecha), escala entera uniforme con pivote en los pies, máscara por columna e idle por franjas (`BattleIdleMesh`, B39) solo en la enfocada.
  - Tarjetas compactas siempre en madera oscura (`smokedWood`) con texto pergamino, etiquetas de stat arriba y valores abajo sin solapes, borde dorado + resplandor + marcador triangular en la enfocada y `70%` de opacidad en las laterales.
  - Zona inferior con scroll e inercia: tarjeta `DETALLE` (rol, arma, habilidad, lore de 3 líneas con botón `"Ver más"` y 4 movimientos con tipo) y tarjeta `REGLA DE ORO` (`Soul Bottle (Alma) + Cuerpo de Madera = Souldoll` y recompensas).
  - Paginación de 3 puntos y barra inferior fija (`Volver`, `Ver ficha` que abre B40 en vista previa de solo lectura y `Elegir [nombre]`).
  - Modal de confirmación con miniatura, aviso de almas salvajes y campo de apodo opcional (`KitTextInput`).
- **Arte Provisional, Glifos y Debug F2 (`SoulDollSpriteFactory.ts`, `UIKitLinter.ts`, `docs/art/STARTER_SHEETS_TODO.md`):**
  - Añadido overlay de arma propia en mano (`Bastón Ignis`, `Vara de Sauce`, `Tridente de Coral`) y tocado distintivo por inicial; documentadas las 3 hojas pendientes en `docs/art/STARTER_SHEETS_TODO.md`.
  - Añadida verificación de cobertura de glifos españoles (`¿ ¡ á é í ó ú ñ ü ( ) · / % +`) en `UIKitLinter.verifyEsJsonGlyphCoverage` y panel Debug `F2` con selector de viewport (`360x640`, `390x844`, `412x915`, `Horiz`), toggles de nombres largos, `4+` iniciales, arte faltante y rejilla/cajas.

## [2026-10-04] — Bloque 28B: Escáner QR, Overlay AR y Pantallas de Resonancia
- **Spec:** Completada `/docs/specs/blocks/B28B-escaner-qr-ar-pantallas.md` (Spec v1.0) mediante `/finish-spec B28B`.
- **Escáner QR y Privacidad en Dispositivo (`QrScannerService.ts`):**
  - Implementado `sanitizeQrPayload(raw)` conforme al Invariante I-14: neutraliza cualquier esquema ejecutable o URL (`http://`, `https://`, `javascript:`, `data:`, `mailto:`) convirtiéndolo en una huella inerte (`QR_SAFE::<hash>`) sin abrir ni ejecutar jamás el payload.
  - Implementado el ciclo de vida de cámara en dispositivo (`startCamera` / `stopCamera` con `track.stop()`) y 2 fallbacks locales sin cámara: decodificación de imagen local (`decodeFromImageFile`) e introducción de sello manual.
- **UI Kit, Overlay AR y Transparencia (`GachaResonanceScene.ts`, `GachaResonanceVM.ts`, `es.json`):**
  - Construida `GachaResonanceScene` con el Souldolls UI Kit (Bloque 41) y 3 pestañas: `ESCANEAR QR` (visor AR con retícula de bronce, línea de barrido de ki y partículas orbitales), `PIEZAS (X/5)` (progreso `x/5` de los 8 Cuerpos contenedores y ensamblaje directo) y `PROBABILIDADES` (tasas oficiales `55/28/13/4` y `20/35/30/15`, barra de Pity `x/10` y `x/5`, aviso de ética I-14 e historial `scanLedger`).
- **Integración Diegética (`BagScene.ts`, `WorkshopScene.ts`, `Game.ts`):**
  - Usar `soul_fragment` o `soul_fragment_brilliant` desde la Mochila o pulsar el acceso en el Taller de Artífices abre `GachaResonanceScene`.
- **Verificación:** `Bloque28BQrTestRunner` (5/5 OK), `lint_applet` y `compile_applet` en verde.

## [2026-10-04] — Bloque 35: Laboratorio del Maestro Artífice e Inicial
- **Spec:** Completada `/docs/specs/blocks/B35-laboratorio-inicial.md` (Spec v1.0) mediante `/finish-spec B35`.
- **Atlas y 3D (`LabAtlas.ts`, `/data/art/lab_atlas.json`, `MapRenderer.ts`):**
  - Implementado `LabAtlasManager` reutilizando la convención `AtlasRegion` del Bloque 33 (`SRGBColorSpace`, `NearestFilter`, `generateMipmaps = false`, inset UV de `0.5 px` y fallback magenta).
  - Construida la fachada exterior del Laboratorio en la Aldea Marioneta (`villa_brote`) con tejado de pizarra violeta (`#4B3A5E`), torre de observatorio con cúpula de cobre (`#3F8C8A`), antena de cristal de ki violeta (`#9B6BFF`) y chimenea de ki.
  - Construido el mapa interior `14x12` (`/src/data/maps/interior_lab.ts` y `/data/maps/lab_interior.json`) con los 7 objetos interactivos y su `interactLabel` contextual: `master_desk`, `starter_pedestal`, `body_tube`, `codex_pedestal`, `anima_world_map`, `rift_diagram` y `soul_purifier`.
- **Lógica pura (`StarterLabSystem.ts`, `/data/config/starter_lab.json`, `EncounterSystem.ts`):**
  - Implementada la secuencia de elección de Soul Bottle (**Maga**, **Sacerdotisa**, **Hidromante** Nv.5) y vinculación determinista con `chassis_madera_t1` (*Cuerpo de Madera* T1, IVs `15/15/15/15`, 4 partes al 100%).
  - Entrega de suministros (`+5 soul_bottle_comun`, `+1 elixir_ki`, Códice de Almas) y liberación de las 2 almas iniciales no elegidas en las tablas de encuentros de `ruta_claro` y `bosque_eco`.
  - Implementado el emparejamiento elemental del rival (**Aprendiz Kael**) y el cierre no punitivo del combate tutorial (`main_1_starter` → `main_2_package`).
- **UI Kit y Glosario (`StarterSelectionModal.ts`, `dialogues.ts`, `es.json`):**
  - Construido `StarterSelectionModal` 100% con el Souldolls UI Kit (Bloque 41) y tokens de `theme.json`, incluyendo modal de apodo opcional (`TextPrompt`).
  - Eliminados todos los restos de términos antiguos (`Prof. Roble`, `Flamín`, `Aquilo`, `Brotín`, `Villa Brote`) y emojis en `dialogues.ts`.
- **Verificación:** `Bloque35LabTestRunner` (5/5 OK), `lint_applet` y `compile_applet` en verde.
