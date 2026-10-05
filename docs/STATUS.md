# SOULDOLLS — STATUS.md

Estado vivo del repositorio conforme a **SOULDOLLS HARNESS v1.0**.

## 1. Tabla de Bloques

| Bloque | Título | Depende | Estado | Verificado (fecha, evidencia) | Notas |
|---|---|---|---|---|---|
| B0 | Contexto maestro (original) | — | COMPLETO | 2026-10-04, arquitectura base | Modificado por B15 |
| B1 | Scaffold y estructura profesional | 0 | COMPLETO | 2026-10-04, `vite.config.ts`, `src/` | Vite + TS + Three + Pixi |
| B2 | Modelo de datos y contenido base | 1 | COMPLETO | 2026-10-04, `DataValidator.validateAll()` | 14 almas, 8 cuerpos, 30 movimientos |
| B3 | Sprites procedurales y sistema de assets | 1, 2 | COMPLETO | 2026-10-04, `AssetRegistry.ts` | — |
| B4 | Mundo 3D explorable (Three.js) | 1, 3 | COMPLETO | 2026-10-04, `OverworldScene.ts`, `MapRenderer.ts` | — |
| B5 | Mundo de mapas conectados y transiciones | 2, 4 | COMPLETO | 2026-10-05, `src/tests/transition.test.ts` (3/3 OK), `ScreenWipeTransition.ts` | 6 exteriores + 4 interiores + Transición de barrido de pantalla PixiJS (Diagonal Slash / Diamond Shards / Radial Iris / Curtain) para conectar Overworld 3D y Combate 2D |
| B6 | Diálogos, NPCs y sistema de quests | 5 | COMPLETO | 2026-10-04, `DialogueSystem.ts`, `QuestSystem.ts` | — |
| B7 | Motor de batalla (lógica pura) | 2 | COMPLETO | 2026-10-04, `src/tests/battle.test.ts` | Determinista por seed |
| B8 | Escena de batalla y efectos de habilidades (Pixi) | 3, 7 | COMPLETO | 2026-10-05, `src/tests/vfx.test.ts` (4/4 OK), `VFXSystem.ts`, `BattleScene.ts` | Sistema de partículas ampliado (chispas angulares, estrellas, anillos de choque, succión etérea, sacudidas y auras para críticos, captura de almas y buffs/debuffs) |
| B9 | Equipo, inventario, menús y captura integrada | 6, 7, 8 | COMPLETO | 2026-10-05, `src/tests/party-management.test.ts` (4/4 OK), `PartyScene.ts` | Roster con reordenación interactiva (▲/▼, swap, líder), estadísticas completas de 6 atributos y partes |
| B10 | Sistema de evolución (Ascenso) | 7, 9 | COMPLETO | 2026-10-04, `src/tests/evolution.test.ts` | — |
| B11 | Códice de Almas (Pokédex) | 9, 10 | COMPLETO | 2026-10-04, `PokedexScene.ts`, `SoulCodexSystem.ts` | — |
| B12 | Servicios (curación, tienda) e inicial | 6, 9, 11 | COMPLETO | 2026-10-04, `WorkshopScene.ts`, `ShopScene.ts` | — |
| B13 | Cierre del loop jugable y jefe final | 5-12 | COMPLETO | 2026-10-04, `CreditsScene.ts` | — |
| B14 | Pulido, rendimiento y QA | 13 | COMPLETO | 2026-10-04, `compile_applet` OK | — |
| B15 | Contexto maestro v2 (instrucciones del sistema) | 0 | COMPLETO | 2026-10-04, glosario Souldolls | — |
| B16 | Rediseño de datos (Alma, Cuerpo, Souldoll) | 2, 15 | COMPLETO | 2026-10-04, `DataValidator.validateAll()` | 14 almas + 8 cuerpos validados |
| B17 | Motor de batalla por partes (lógica pura) | 7, 16 | COMPLETO | 2026-10-04, `BattleEngine.ts` | Partes: cabeza, torso, brazos, piernas |
| B18 | UI de batalla con partes (Pixi) | 8, 17 | COMPLETO | 2026-10-04, `BattleScene.ts` | — |
| B19 | Sprites por capas y armas únicas | 3, 16 | COMPLETO | 2026-10-04, `LayeredSpriteComposer.ts` | — |
| B20 | Soul Bottles, cuerpos, Taller, Mercado y Almacén | 9, 12, 16, 17 | COMPLETO | 2026-10-04, `StorageBoxScene.ts`, `SoulBindingScene.ts` | — |
| B21 | Ascenso, cristales, reliquias y sincronía | 10, 16, 19 | COMPLETO | 2026-10-04, `EvolutionSystem.ts` | — |
| B22 | Narrativa isekai, mapas y quests | 5, 6, 12, 13, 20, 21 | COMPLETO | 2026-10-04, `quests/index.ts`, `dialogue/index.ts` | — |
| B23 | Móvil, PWA y estabilidad | 14 | COMPLETO | 2026-10-04, `manifest.json`, `sw.js` | — |
| B24 | Pipeline de arte real | 19 | COMPLETO | 2026-10-04, `scripts/pack-atlas.ts` | — |
| B25 | Expansión de contenido (solo JSON) | 22 | COMPLETO | 2026-10-04, `DataValidator.validateAll()` | 14 almas (incl. Paladín/Templario) |
| B26 | Profundidad de combate | 17 | COMPLETO | 2026-10-04, `BattleEngine.ts` | — |
| B27 | Mundo vivo y publicación | 22, 23 | COMPLETO | 2026-10-04, `AudioService.ts`, ciclo día/noche | — |
| B28A | Lógica del gacha (sistema puro) | 16, 20 | COMPLETO | 2026-10-04, `GachaTestRunner.runAllTests()` (8/8 OK) | Determinista, pity, duplicados |
| B28B | Escáner QR, overlay AR y pantallas | 23, 28A | COMPLETO | 2026-10-04, `Bloque28BQrTestRunner` (5/5 OK), `QrScannerService.ts`, `GachaResonanceScene.ts`, `GachaResonanceVM.ts` | Escáner QR 100% en dispositivo (I-14), fallbacks imagen/sello manual, overlay AR, tasas exactas, pity y progreso x/5 de cuerpos |
| B29 | Marca y tema visual | 15 | COMPLETO | 2026-10-04, `theme.json`, `styles.ts` | — |
| B30 | Importación de spritesheets propios | 19, 29 | COMPLETO | 2026-10-04, `SpriteSheetLoader.ts` | — |
| B31 | Taller de Artífices (datos y escena) | 20 | COMPLETO | 2026-10-04, `WorkshopScene.ts`, `interior_center.ts` | — |
| B32 | Mercado de Artífices (datos y escena) | 20, 28A | COMPLETO | 2026-10-04, `ShopScene.ts`, `interior_shop.ts` | — |
| B33 | Uso correcto del atlas del Taller (UV y recortes) | 4 | COMPLETO | 2026-10-04, `TallerAtlas.ts` | — |
| B34 | Atlas del Mercado de Artífices | 33 | COMPLETO | 2026-10-04, `MercadoAtlas.ts` | — |
| B35 | Laboratorio del Maestro Artífice e inicial | 12, 22, 33 | COMPLETO | 2026-10-04, `Bloque35LabTestRunner` (5/5 OK), `LabAtlas.ts`, `StarterLabSystem.ts`, `StarterSelectionModal.ts` | Fachada con torre y cúpula de cobre, interior 14x12 con 7 interactuables, Regla de Oro (Soul Bottle + Cuerpo de Madera) y tutorial de partes con Kael |
| B36 | Decorados del overworld con billboards y hierba | 4, 33 | COMPLETO | 2026-10-04, `DecorRenderer.ts` | Chunked `InstancedMesh` 16x16 |
| B37 | Corrección de la pantalla de combate | 8, 30 | COMPLETO | 2026-10-04, `BattleScene.ts` | Escala entera, chroma key, nitidez |
| B38 | Vistas de batalla (3/4 frontal y 3/4 trasera con flip) | 30, 37 | COMPLETO | 2026-10-04, `BattleScene.ts` | — |
| B39 | Animación idle por franjas (respiración y rebote) | 38 | COMPLETO | 2026-10-04, `StripIdleAnimator.ts` | Ajuste Apagada/Sutil/Normal |
| B40 | Ficha de Souldoll (layout tipo tarjeta de unidad) | 18, 29, 39, 41 | COMPLETO | 2026-10-04, `CreatureDetailScene.ts` | Pedestal, pestañas y comparación |
| B41 | Sistema de diseño UI unificado (Souldolls UI Kit) | 29 | COMPLETO | 2026-10-04, `src/ui/kit/` | `UIKitLinter` activo en DEV |
| B42 | Migración de pantallas al UI Kit (por grupos) | 41 | COMPLETO | 2026-10-04, Grupos A y B migrados | `Title`, `Party`, `Bag`, `Pokedex`, `QuestLog`, `Shop`, `Workshop`, `StorageBox`, `SoulBinding` |
| B43 | Limpieza del HUD del overworld y acceso físico | 23, 41 | COMPLETO | 2026-10-04, `Bloque43HudTestRunner` (6/6 OK) | HUD limpio, ciclo pause/resume verificado |
| B44 | Migración a tilesets PNG (RPG Maker) y WebP | 33, 36 | COMPLETO | 2026-10-04, `Bloque44TilesetTestRunner` (7/7 OK), `validate-tilesets.mjs` | Compuerta de licencia + autotiles + chunks 16x16 |
| B45 | Diseño y construcción de mapas (level design y estética) | 5, 33, 34, 36, 44 | COMPLETO | 2026-10-04, `Bloque45MapgenTestRunner` (6/6 OK), `tools/mapgen/index.mjs` | 6 mapas horneados con semilla, casas 2.5D, horizonte sin vacío, etapas 1..6 en F2 |
| B46 | Pantalla de elección del primer Souldoll (rediseño) | 29, 35, 37, 38, 39, 40, 41 | COMPLETO | 2026-10-05, `Bloque46StarterUiTestRunner` (5/5 OK), `StarterSelectVM.ts`, `StarterSelectionModal.ts`, `data/starters.json` | Escenario de 3 columnas con enfocada al centro, vistas por ranura, escala entera + máscara, tarjetas oscuras sin cambio de paleta, detalle con scroll, Regla de Oro, modal Confirm con apodo, test de glifos y Debug F2 |
