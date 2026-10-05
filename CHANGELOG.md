# CHANGELOG — SOULDOLLS

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
