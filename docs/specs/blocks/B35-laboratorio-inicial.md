# BLOQUE 35: Laboratorio del Maestro Artífice e inicial
- Depende de: 12, 22, 33, 41
- Modifica: Reemplaza el punto 3 del Bloque 12 (`prof_roble_intro`) y amplía el punto 3 del Bloque 22 y el mapa interior `interior_lab` (`lab_interior.json`)
- Estado: COMPLETO (SPEC) · Spec: v1.0

## Objetivo
Construir el **Laboratorio del Maestro Artífice** (fachada exterior en la Aldea Marioneta e interior explorable `14x12`) utilizando la infraestructura de atlas por rectángulos del Bloque 33 y el UI Kit del Bloque 41, e implementar la **secuencia cinemática e interactiva de elección del inicial** que materializa visualmente la Regla de Oro de Souldolls (`Souldoll = Alma en Soul Bottle + Cuerpo contenedor`), culminando con el combate tutorial de partes contra el rival.

---

## 1. Huecos detectados en el borrador y resolución

1. **Esquema y dimensiones del mapa interior y atlas (`lab_atlas.json` + `lab_interior.json`):**
   - *Hueco:* El borrador menciona `lab_interior.json` y una fachada con torre redonda y cúpula de cobre, pero no fijaba dimensiones en tiles, coordenadas de objetos interactivos, ni la lista de frames del atlas.
   - *Resolución:* Dimensiones `14x12` tiles **[PROPUESTA]** (homologado con `workshop_interior` de B31:1 y `market_interior` de B32:1). Fachada y muebles extraídos de las secciones *5. Laboratorio del Maestro Artífice (Exterior, Interior A, Interior B)* de `docs/art/ART_PROMPTS.md`.
2. **Flujo paso a paso de la secuencia del inicial (Alma + Cuerpo):**
   - *Hueco:* El borrador listaba los hitos pero no especificaba cómo interactúan el escritorio del Maestro, el pedestal de las tres Soul Bottles y el tubo de cristal con el Cuerpo de Madera, ni qué ocurre si el jugador intenta salir del edificio sin elegir o intenta tomar el cuerpo antes que el alma.
   - *Resolución:* Máquina de estados guiada por flags (`lab_intro_seen` → `starter_chosen` → `body_linked` → `codex_unlocked` → `rival_tutorial_done`) **[PROPUESTA]** con bloqueos diegéticos en la salida y diálogos contextuales.
3. **Datos exactos de las 3 opciones iniciales y del rival:**
   - *Hueco:* No estaban fijados los IDs exactos de `SoulSpecies`, nivel, chasis inicial, IVs ni la tabla de emparejamiento del rival y su perfil de IA.
   - *Resolución:* Opciones en Nv.5 (`maga` Fuego, `sacerdotisa` Planta, `hidromante` Agua — *fuente: `lore.md` §1.4 y B22:3*) vinculadas a `chassis_madera_t1` (*Cuerpo de Madera*, Tier 1 — *fuente: B16:3*). El rival elige la especie con ventaja elemental (`maga` → `hidromante`, `sacerdotisa` → `maga`, `hidromante` → `sacerdotisa`) en Nv.5 con `chassis_madera_t1` **[PROPUESTA]**.
4. **Casos límite (Edge Cases):**
   - *Hueco:* No se definía el comportamiento al cancelar el apodo, perder el combate tutorial contra el rival, reentrar al Laboratorio tras completar la secuencia, o cargar partidas antiguas con `has_starter: true`.
   - *Resolución:* Especificados en la Sección 3 (Casos límite). Perder o ganar el combate tutorial avanza la historia sin Game Over punitivo (restauración inmediata en el Laboratorio) **[PROPUESTA]**.
5. **Textos y glosario (`es.json`):**
   - *Hueco:* En el código actual (`dialogues.ts` e `interior_lab.ts`) quedaban restos del Bloque 12 antiguo (*"Prof. Roble"*, *"Flamín"*, *"Aquilo"*, *"Brotín"*, *"TERMINAL DE CÓDICE"* con emoji).
   - *Resolución:* Sustitución total por **Maestro Artífice**, **Maga**, **Sacerdotisa**, **Hidromante**, **Soul Bottle** y **Cuerpo de Madera** (*fuente: Invariante I-05 y `brand.md` §2.7*). Cero emojis (*fuente: Invariante I-06*).

---

## 2. Requisitos (numerados y medibles)

### R1. Atlas del Laboratorio (`/data/art/lab_atlas.json` y `LabAtlas.ts`)
1. Reutiliza la infraestructura `AtlasRegion` del Bloque 33 sin duplicar lógica de recorte UV ni de detección de componentes conectados del canal alpha.
2. Textura con `SRGBColorSpace`, `magFilter = minFilter = NearestFilter`, `generateMipmaps = false`, inset UV de `0.5 px` y fallback magenta con el nombre del frame si falta un recorte (*fuente: B33:2, B33:8*).
3. Frames exteriores obligatorios (*fuente: `ART_PROMPTS.md` §5 Exterior*):
   - `lab_facade_left` (ala izquierda con ventana redonda), `lab_facade_center` (puerta doble de madera y placa de bronce sin texto), `lab_facade_right` (gran ventanal arqueado con luz cálida `#E8B84A`).
   - `lab_roof_slate_violet` (teja de pizarra violeta `#4B3A5E` como banda frontal con hastial recto).
   - `lab_tower_observatory` (torre redonda en alzado frontal con cúpula semicircular de cobre `#3F8C8A` y antena de cristal de ki violeta `#9B6BFF`).
   - `lab_chimney_ki` (chimenea de piedra con humo fino cian/violeta `#5FE3D2` / `#9B6BFF`, 2 frames) y `lab_sign_gear_bottle` (letrero colgante con engranaje de bronce y Soul Bottle, sin texto).
4. Frames interiores obligatorios (*fuente: `ART_PROMPTS.md` §5 Interior A/B*):
   - Suelos y paredes: `lab_floor_wood_dark` (`tile: true`), `lab_floor_stone` (`tile: true`), `lab_rug_emblem` (alfombra cenital con emblema de engranaje y llama de alma), `lab_wall_timber`.
   - Props interactivos y científicos (alzado frontal, pivote en los pies `[0.5, 1.0]`):
     - `starter_pedestal_full` (pedestal de piedra con 3 frascos), `starter_bottle_ember` (`#FF6B35`), `starter_bottle_leaf` (`#5CBF5A`), `starter_bottle_water` (`#3FA9F5`), `starter_pedestal_empty`.
     - `body_tube_wood_off` (tubo de cristal con Cuerpo de Madera inactivo), `body_tube_wood_lit` (tubo iluminado con brillo de ki `#5FE3D2`), `body_tube_empty` (tubo vacío tras extraer el cuerpo).
     - `master_desk` (escritorio con libros, pluma y lente), `codex_pedestal` (atril con libro abierto luminoso), `anima_world_map` (mapa mural de Anima), `rift_diagram_intact` y `rift_diagram_awakened` (diagrama enmarcado de la Grieta antes y después del Guardián), `soul_purifier` (máquina purificadora con manómetros), `puppet_workbench` (banco con extremidades y carretes de hilo), `bookshelf_tall_a`, `bookshelf_tall_b`.

### R2. Fachada en la Aldea Marioneta y Mapa Interior (`14x12`)
1. En `villa_brote` (*Aldea Marioneta*), el stamp `resonance_lab` (`6x5` tiles según `/data/config/scale.json`) renderiza la fachada compuesta con tejado de pizarra violeta, torre de observatorio con cúpula de cobre, antena de ki violeta y sombra de contacto en la base.
2. El mapa interior (`/data/maps/lab_interior.json` y `/src/data/maps/interior_lab.ts`) mide **`14x12` tiles** **[PROPUESTA]**, con:
   - Puerta de salida sur en `(7, 11)` hacia `villa_brote` `(22, 9)` con `interactLabel: "Salir"`.
   - **Maestro Artífice** (`npc_master_artificer`, antes `npc_prof_roble_lab`) en `(7, 3)` frente a su escritorio.
   - **Rival Soultrainer** (`npc_rival_kyle`) **[PROPUESTA]** en `(10, 5)` observando los tubos de contención.

### R3.Los 7 Objetos Interactivos del Laboratorio (con `interactLabel` en datos)
Cada objeto define su posición, huella de colisión y etiqueta contextual para el botón `A` del HUD (Bloque 43 Req. 4):
1. **Escritorio del Maestro (`master_desk`, tiles `6..8, 2`):** `interactLabel: "Hablar"`. Inicia el diálogo principal de introducción isekai (*"Tu ki no tiene color, muchacho..."* — *fuente: `brand.md` §2.7*) si `lab_intro_seen` es `false`, o consejos de progreso si ya se completó.
2. **Pedestal de Iniciales (`starter_pedestal`, tiles `4..5, 5`):** `interactLabel: "Examinar"`.
   - Antes de hablar con el Maestro (`!lab_intro_seen`): muestra un aviso breve indicando hablar primero con el Maestro Artífice.
   - Con `lab_intro_seen && !starter_chosen`: abre el modal/overlay `StarterSelectionModal` (UI Kit, Bloque 41) con las 3 Soul Bottles.
   - Con `starter_chosen`: muestra qué frasco fue elegido y que los otros dos resonaron y escaparon hacia las rutas de Anima (*fuente: B35:3*).
3. **Tubo de Cristal de Cuerpo (`body_tube`, tiles `9..10, 4`):** `interactLabel: "Examinar"`.
   - Antes de elegir Soul Bottle (`!starter_chosen`): explica la Regla de Oro (*"Un Cuerpo de Madera de Tier 1 en suspensión. Necesitas elegir primero una Soul Bottle para vincularla"*).
   - Al elegir la Soul Bottle (`starter_chosen && !body_linked`): se ilumina (`body_tube_wood_lit`), ejecuta la vinculación del alma elegida con el `chassis_madera_t1` y cambia a `body_tube_empty`.
4. **Pedestal del Códice (`codex_pedestal`, tile `3, 3`):** `interactLabel: "Leer"`.
   - Si `! starter_chosen`: indica que el registro se activará tras vincular tu primera Souldoll.
   - Si `starter_chosen`: activa `codex_unlocked = true` (si aún no lo estaba) y abre un resumen del Códice o permite consultar el progreso de las 14 almas.
5. **Mapa de Anima (`anima_world_map`, pared norte `2, 1`):** `interactLabel: "Examinar"`. Muestra la geografía de Anima (*Aldea Marioneta → Ruta Claro → Bosque Eco → Cueva del Eco*) y una pista sobre el aumento de almas salvajes alrededor de la Grieta.
6. **Diagrama de la Grieta (`rift_diagram`, pared norte `11, 1`):** `interactLabel: "Examinar"`.
   - Antes de derrotar al Guardián (`!defeated_forest_boss`): muestra `rift_diagram_intact` y describe la anomalía sísmica de ki en la Cueva del Eco.
   - Tras derrotar al Guardián (`defeated_forest_boss == true`): cambia visualmente a `rift_diagram_awakened` y revela el análisis del Maestro sobre la facción **Los Hueco** (*fuente: `lore.md` §1.1, B22:5*).
7. **Purificador de Almas (`soul_purifier`, tiles `11..12, 8`):** `interactLabel: "Examinar"`.
   - Al inicio: diálogo descriptivo sobre cómo purga el ki corrupto de las marionetas.
   - Con la misión secundaria `"Reparaciones urgentes"` (`side_nurse_aid`) o tras visitar el Bosque Eco: permite calibrar un filtro de resonancia o purgar gratis el estado alterado del equipo **[PROPUESTA]**.

### R4. Secuencia Cinemática del Inicial (Regla de Oro visible)
1. **Paso 1 — Diagnóstico del Ki sin Color:** Al hablar con el Maestro Artífice, reproduce el diálogo oficial de marca (*"Tu ki no tiene color, muchacho. Eso es raro… y un poco inquietante. Ven, que las muñecas ya hacen apuestas sobre ti."*), activa `lab_intro_seen = true` y enfoca el pedestal de Soul Bottles.
2. **Paso 2 — Selección de Soul Bottle en UI Kit (`StarterSelectionModal`):**
   - Muestra 3 tarjetas del UI Kit (`KitCard`, `KitBadge`, `KitStatBox`, `KitButton` — sin colores ni fuentes fuera de `theme.json`):
     1. **Maga** (`maga`, elemento **Fuego**, rol: *Daño especial*, arma: *Báculo de Aprendiz*, frasco ámbar-brasa `#FF6B35`).
     2. **Sacerdotisa** (`sacerdotisa`, elemento **Planta**, rol: *Soporte y curación*, arma: *Cetro de Brote*, frasco verde-hoja `#5CBF5A`).
     3. **Hidromante** (`hidromante`, elemento **Agua**, rol: *Equilibrada*, arma: *Tridente de Coral*, frasco azul-marea `#3FA9F5`).
   - Cada opción muestra el sprite de la Souldoll (escala entera, `NearestFilter`, pivote en los pies), su descripción de lore, stats base y botón de confirmación con `KitModal` (`Confirm`).
3. **Paso 3 — Encendido del Tubo y Vinculación con Cuerpo de Madera:**
   - Al confirmar la Soul Bottle:
     - El frasco elegido desaparece de la mesa y el flag `starter_chosen = true` se registra junto con `starter_species_id`.
     - El tubo de cristal pasa a estado `body_tube_wood_lit` con destello cian `#5FE3D2` y sonido procedural `'crystal'` + `'soul_seal'`.
     - Se genera de forma determinista (`Rng` seedeable) una instancia `BodyInstance` de `chassis_madera_t1` (*Cuerpo de Madera*, Tier 1, reparto `15% Cabeza / 40% Torso / 20% Brazos / 25% Piernas`, IVs iniciales `15/15/15/15` **[PROPUESTA]** para garantizar consistencia en el tutorial).
     - Se instancia la `Souldoll` Nv.5 vinculada a ese `BodyInstance`, con sus 4 partes al 100% de PS, y se añade como líder de `state.party`.
     - Se activa `body_linked = true` y `codex_unlocked = true`, registrando la especie como `caught: true` en `state.soulCodex`.
4. **Paso 4 — Entrega de suministros y Apodo opcional:**
   - El jugador recibe exactamente: **1 Souldoll Nv.5** (vinculada a Cuerpo de Madera), **5 Soul Bottles comunes** (`soul_bottle_comun`), **1 Elixir de ki** (`elixir_ki`) (*fuente: B35:3*) y el **Códice de Almas**.
   - Se abre un `KitModal` tipo `TextPrompt` opcional para dar apodo a la Souldoll (máx. 14 caracteres; si se cancela o deja vacío, conserva el nombre de su especie).
   - Los otros dos iniciales quedan habilitados en las tablas de encuentros salvajes del mundo (`wild_starters_released = true`).
5. **Paso 5 — Reto del Rival y Primer Tutorial de Partes:**
   - Al intentar salir o inmediatamente tras vincular el cuerpo, el rival se acerca y elige el alma con **ventaja elemental** sobre la del jugador (`maga` → rival usa `hidromante`; `sacerdotisa` → rival usa `maga`; `hidromante` → rival usa `sacerdotisa`), Nv.5 en `chassis_madera_t1`.
   - Inicia una batalla (`BattleScene`) con el flag `tutorial_parts_battle = true`, donde el narrador explica brevemente en el primer turno las 4 zonas del cuerpo (Cabeza, Torso, Brazos, Piernas) y el efecto de romper brazos/piernas.
   - Al terminar el combate (victoria o derrota), el Maestro restaura el equipo al 100% en la máquina del Laboratorio, activa `rival_tutorial_done = true`, completa la misión principal 1 **`"El ki sin color"`** (`main_1_starter`) y desbloquea **`"Camino a Ruta Claro"`** (`main_2_package`).

---

## 3. Casos límite (Edge Cases)

1. **Intento de salir del Laboratorio sin Souldoll:** Si `!body_linked`, el trigger en `(7, 10)` antes de la alfombra de salida detiene al jugador con un mensaje del Maestro Artífice (*"¡Alto ahí! Las almas salvajes de Ruta Claro te harán pedazos si sales sin vincular tu primera Souldoll."*).
2. **Partida nueva con equipo vacío vs. partida migrada:** Si una partida cargada aún no tiene `starter_chosen`, `state.party` puede estar vacío hasta completar el Paso 3 en el Laboratorio; una vez elegido el inicial, `state.party` reemplaza cualquier placeholder de prueba por la Souldoll Nv.5 elegida.
3. **Derrota en el combate tutorial del rival:** Nunca provoca pantalla de Game Over ni pérdida de Monedas de Ki. El combate termina con un diálogo deportivo del rival, el Maestro cura todas las partes y la misión `"El ki sin color"` se completa igualmente **[PROPUESTA]**.
4. **Apodo inválido o cancelado:** Si el jugador pulsa Cancelar o introduce solo espacios en el modal de apodo, `nickname` queda `undefined` y se usa el nombre canónico de la especie (`Maga`, `Sacerdotisa` o `Hidromante`).
5. **Reentrada posterior y post-Guardián:** Al volver al Laboratorio tras derrotar al Guardián de la Cueva del Eco (`defeated_forest_boss == true`), el diagrama de la Grieta cambia de sprite (`rift_diagram_awakened`) y su texto se actualiza con la investigación sobre Los Hueco.

---

## 4. Datos y esquemas

### 4.1 Configuración de secuencia inicial (`/data/config/starter_lab.json`) **[PROPUESTA]**
```json
{
  "version": "1.0.0",
  "starterLevel": 5,
  "initialChassisId": "chassis_madera_t1",
  "initialBodyIvs": { "head": 15, "torso": 15, "arms": 15, "legs": 15 },
  "gifts": [
    { "itemId": "soul_bottle_comun", "count": 5 },
    { "itemId": "elixir_ki", "count": 1 }
  ],
  "options": [
    {
      "speciesId": "maga",
      "bottleFrame": "starter_bottle_ember",
      "element": "Fuego",
      "roleKey": "terms.lab.role_maga",
      "rivalCounterSpeciesId": "hidromante"
    },
    {
      "speciesId": "sacerdotisa",
      "bottleFrame": "starter_bottle_leaf",
      "element": "Planta",
      "roleKey": "terms.lab.role_sacerdotisa",
      "rivalCounterSpeciesId": "maga"
    },
    {
      "speciesId": "hidromante",
      "bottleFrame": "starter_bottle_water",
      "element": "Agua",
      "roleKey": "terms.lab.role_hidromante",
      "rivalCounterSpeciesId": "sacerdotisa"
    }
  ],
  "flags": {
    "introSeen": "lab_intro_seen",
    "starterChosen": "starter_chosen",
    "bodyLinked": "body_linked",
    "codexUnlocked": "codex_unlocked",
    "rivalDefeated": "rival_tutorial_done",
    "wildStartersReleased": "wild_starters_released"
  }
}
```

### 4.2 Claves nuevas en `/src/data/text/es.json` (`terms.lab`)
- `terms.lab.title`: `"LABORATORIO DEL MAESTRO ARTÍFICE"`
- `terms.lab.choose_title`: `"ELIGE TU PRIMERA SOUL BOTTLE"`
- `terms.lab.golden_rule_banner`: `"REGLA DE ORO: SOULDOLL = ALMA (FRASCO) + CUERPO (MARIONETA)"`
- `terms.lab.role_maga`: `"Daño especial ígneo • Báculo de Aprendiz"`
- `terms.lab.role_sacerdotisa`: `"Soporte y curación • Cetro de Brote"`
- `terms.lab.role_hidromante`: `"Equilibrada y táctica • Tridente de Coral"`
- `terms.lab.confirm_bottle`: `"¿Deseas resonar con la Soul Bottle de {name} ({element}) y vincularla al Cuerpo de Madera?"`
- `terms.lab.tube_activated`: `"¡El tubo de resonancia se ha encendido! El alma de {name} ha cobrado forma en el Cuerpo de Madera."`
- `terms.lab.nickname_prompt`: `"¿Quieres dar un apodo a tu {name}?"`
- `terms.lab.items_received`: `"Recibiste {name} Nv.5, 5 Soul Bottles comunes, 1 Elixir de ki y el Códice de Almas."`
- `terms.lab.exit_blocked`: `"¡Espera, muchacho! No salgas a la Ruta Claro sin vincular tu primera Soul Bottle a un Cuerpo de Madera."`

---

## 5. Tests (`Bloque35LabTestRunner.ts`)

1. **Test 1 — Atlas y recortes UV del Laboratorio:** Verifica que `LabAtlas` resuelva todos los frames exteriores e interiores requeridos con `NearestFilter`, `generateMipmaps = false`, `SRGBColorSpace` y devuelva fallback magenta ante un frame inexistente.
2. **Test 2 — Estructura de `lab_interior` (`14x12`) y los 7 interactuables:** Verifica dimensiones `14x12`, conectividad BFS desde la puerta `(7, 11)` hasta los 7 objetos interactivos (`master_desk`, `starter_pedestal`, `body_tube`, `codex_pedestal`, `anima_world_map`, `rift_diagram`, `soul_purifier`) y presencia de `interactLabel` válido en cada uno.
3. **Test 3 — Elección de Soul Bottle, vinculación con Cuerpo de Madera y suministros:** Simula la elección de cada una de las 3 opciones (`maga`, `sacerdotisa`, `hidromante`) y comprueba que:
   - Se crea una `Souldoll` Nv.5 con `bodyInstanceId` no nulo (`chassis_madera_t1`) y las 4 partes al 100%.
   - El inventario suma exactamente `+5 soul_bottle_comun` y `+1 elixir_ki`.
   - Los flags `starter_chosen`, `body_linked`, `codex_unlocked` y `wild_starters_released` quedan en `true`.
4. **Test 4 — Emparejamiento elemental del rival y cierre de quest:** Verifica que el rival seleccione siempre la especie con ventaja elemental (`maga` → `hidromante`, `sacerdotisa` → `maga`, `hidromante` → `sacerdotisa`) y que al concluir el combate tutorial se complete la quest `main_1_starter` (*"El ki sin color"*) y se active `main_2_package`.
5. **Test 5 — Cambio de estado del Diagrama de la Grieta y cumplimiento de glosario (I-05, I-06):** Verifica que el diagrama cambie su texto y frame al activarse `defeated_forest_boss`, y que ningún diálogo ni cartel del Laboratorio contenga emojis, `"Prof. Roble"`, `"Flamín"`, `"Aquilo"`, `"Brotín"`, `"Villa Brote"` ni `"Chasis"`.

---

## 6. Criterios de aceptación (checkpoint)
- [ ] Exterior del Laboratorio en la Aldea Marioneta muestra casa de piedra y madera con tejado de pizarra violeta, torre de observatorio con cúpula de cobre y antena de ki violeta.
- [ ] Interior `14x12` explorable con suelo de madera/piedra, alfombra con emblema y los 7 objetos interactivos con su etiqueta contextual (`Hablar`, `Examinar`, `Leer`) sobre el botón `A`.
- [ ] Hablar con el Maestro Artífice presenta el diálogo del ki *"sin color"* y habilita el pedestal con las 3 Soul Bottles (**Maga**, **Sacerdotisa**, **Hidromante**).
- [ ] Al confirmar una Soul Bottle en la UI (construida 100% con el UI Kit y tokens de `theme.json`), el frasco desaparece del pedestal, el tubo de cristal se ilumina con el Cuerpo de Madera, se vinculan y el jugador recibe la Souldoll Nv.5 + 5 Soul Bottles comunes + 1 Elixir de ki, con opción de apodo.
- [ ] Los dos iniciales no elegidos pasan a estar disponibles como encuentros salvajes en el mundo.
- [ ] El rival elige el alma con ventaja de tipo y lanza el combate tutorial de partes; al terminar, se completa la misión *"El ki sin color"* (`main_1_starter`).
- [ ] `Bloque35LabTestRunner` (5/5), `lint_applet` y `compile_applet` pasan en verde.

---

## 7. Fuera de alcance
- Modificar las fórmulas de combate de `/systems/battle` (cerradas en el Bloque 17).
- Añadir más de 3 opciones iniciales en el pedestal.
- Cualquier compra o venta de objetos dentro del Laboratorio (exclusivo del Mercado de Artífices, Invariante I-11).

---

## 8. Preguntas abiertas (máx. 5, con opción por defecto)

1. **Q1 — Momento de inicio de la secuencia al crear "Nueva Partida":**
   - *Por defecto:* El jugador aparece en la Aldea Marioneta con su equipo vacío (o bloqueado para salir a la Ruta Claro) y la pista de objetivo apuntando al Laboratorio del Maestro Artífice; la secuencia comienza al entrar al Laboratorio y hablar con el Maestro. *(Alternativa: aparecer directamente dentro del Laboratorio tras el diálogo de intro isekai).*
2. **Q2 — Nombre del rival Soultrainer:**
   - *Por defecto:* **Kael, Aprendiz de Artífice** **[PROPUESTA]**.
3. **Q3 — IVs del Cuerpo de Madera inicial (`chassis_madera_t1`):**
   - *Por defecto:* IVs equilibrados fijos `15 / 15 / 15 / 15` para que el combate tutorial contra el rival sea 100% justo y predecible. *(Alternativa: tirada aleatoria con `Rng` seedeable de la partida).*
4. **Q4 — Ubicación salvaje de los 2 iniciales no elegidos:**
   - *Por defecto:* Se habilitan como encuentros raros (`weight: 5`) en `ruta_claro` y `bosque_eco` cuando el flag `wild_starters_released` está activo.
5. **Q5 — Utilidad del Purificador de Almas (`soul_purifier`) en misiones:**
   - *Por defecto:* Decorativo con lore al inicio; una vez iniciada la misión *"El eco del bosque"* (`main_3_forest_boss`), permite purgar gratis estados alterados del equipo e inspeccionar muestras de ki corrupto.

---

## 9. Notas de reconciliación
- **v1.0 (2026-10-04):** Especificación completada mediante `/finish-spec B35` a partir del borrador del Harness v1.0, `docs/lore.md`, `docs/brand.md` y la sección 5 de `docs/art/ART_PROMPTS.md`. Sustituye definitivamente a `prof_roble_intro` (Flamín/Aquilo/Brotín) del Bloque 12 original.
