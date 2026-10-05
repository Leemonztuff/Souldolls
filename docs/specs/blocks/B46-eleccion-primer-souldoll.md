# BLOQUE 46: Pantalla de elección del primer Souldoll (rediseño)
- **Depende de:** B29, B35, B37, B38, B39, B40, B41
- **Modifica:** `StarterSelectionModal.ts` (y añade `StarterSelectVM.ts`, `/data/starters.json`, `/docs/art/STARTER_SHEETS_TODO.md`)
- **Estado:** COMPLETO · Spec: v1.0

---

## 0. Auditoría inicial de defectos (`StarterSelectionModal.ts`)

| # | Defecto denunciado | Estado | Evidencia en el código anterior |
|---|---|---|---|
| D-01 | Título cortado y pisado por el botón de cerrar | ✅ Confirmado | `ScreenFrame.ts:74-100`: `titleTxt` en `x=16` con `fontSize=20` fijo sin restar ancho del botón cerrar (`44px`), solapándose en `360px`. |
| D-02 | Sprites sin máscara que tapan títulos y texto de otras tarjetas | ✅ Confirmado | `StarterSelectionModal.ts:205-210`: `spr` de `~160px` con `anchor(0.5, 1.0)` en `pedY=128` sin `mask`, sobresaliendo `32px` por encima de la tarjeta (`y=-32`). |
| D-03 | Descripción dibujada bajo las cajas de stats | ✅ Confirmado | `StarterSelectionModal.ts:236-280`: `loreTxt` multi-línea en `y=88..168` se extiende por debajo de `statsY=132/226`, quedando detrás de `KitStatBox`. |
| D-04 | Etiqueta "AT.ESP" superpuesta con su valor | ✅ Confirmado | `StarterSelectionModal.ts:252-271` y `KitPrimitives.ts:818-859`: `statW` en vertical o tres columnas se reduce a `~60px` y `AT.ESP` + valor comparten espacio vertical en `height=28`. |
| D-05 | Paréntesis renderizados como llaves (la fuente pixel no los tiene) | ✅ Confirmado | Textos con paréntesis `(...)` renderizados con `FONTS.hud` (`Pixelify Sans`), cuyo glifo de paréntesis se dibuja con remates tipo llave `{}`. |
| D-06 | Chip "CUERPO DE MADERA" cortado | ✅ Confirmado | `StarterSelectionModal.ts:217-219`: `KitBadge('CUERPO DE MADERA T1')` colocado en `x=196` dentro de tarjeta de `320px`, desbordando el borde derecho. |
| D-07 | Tercera opción fuera de pantalla | ✅ Confirmado | `StarterSelectionModal.ts:161-166`: apilado vertical de 3 tarjetas de `168px` (`curY=52 + 3*178 = 586px`), dejando la 3.ª tarjeta fuera del área visible en `360x640`. |
| D-08 | Estado enfocado que cambia la paleta de la tarjeta | ✅ Confirmado | `StarterSelectionModal.ts:178,228,241`: `variant: isSel ? 'parchment' : 'smokedWood'`, cambiando el fondo oscuro por pergamino claro al enfocar. |
| D-09 | Las tres opciones comparten el mismo sprite con distinto tinte | ✅ Confirmado | `SoulDollSpriteFactory.ts:463-492`: `sacerdotisa` e `hidromante` reutilizan la hoja de `maga` aplicando únicamente `applySpeciesPaletteShift`. |

---

## 1. Objetivo
Rediseñar la pantalla de elección del primer Souldoll (**Bloque 46**) en formato móvil vertical (y adaptación horizontal/escritorio) sin modificar `/systems` ni romper la secuencia del Laboratorio (**Bloque 35**), separando la lógica de presentación en un view-model puro (`StarterSelectVM.ts`) alimentado por `/data/starters.json`, `SoulSpecies`, `BODY_CHASSIS_DATA` y `es.json`.

---

## 2. Requisitos medibles

1. **View-Model Puro (`src/ui/viewmodels/StarterSelectVM.ts`):**
   - Sin imports de Pixi, Three ni DOM.
   - `buildStarterVM(gameState, startersData, focusIndex)` devuelve `{ title, step, options[], focusIndex, rewards }`.
   - Cada opción incluye `{ soulSpeciesId, name, element, roleText, weaponId, weaponName, level: 5, stats: { hp, primaryAtk, primaryAtkLabel, isSpAtk, speed }, abilityName, abilityDescription, flavor, moves[4]: { id, name, type }, spriteFrames }` calculados con `chassis_madera_t1` y `StatCalculator`.
2. **Layout Móvil Vertical y Horizontal:**
   - **Cabecera fija:** botón Volver a la izquierda (`44x44`), botón Cerrar a la derecha (`44x44`), título autoajustable hasta el mínimo de tokens y máx. 2 líneas, y subtítulo `"Paso 1 de 2 · El alma"`.
   - **Escenario (~38% del alto):** arco arquitectónico del laboratorio, tubo de cristal encendido tenuemente al fondo, tres columnas con la Souldoll enfocada siempre en la **columna central**, orbe elemental con aura animada + icono + texto de rol encima, pedestal de piedra con sombra elíptica debajo, flechas `<` `>` laterales y soporte de swipe táctil y D-pad.
   - **Orientación por ranura y escala entera:** ranura central `view_front`, ranura izquierda `view_front34` mirando a la derecha, ranura derecha `view_front34` espejada (`flipX = true`) mirando a la izquierda. Escala entera uniforme con pivote en los pies `(0.5, 1.0)`, `NearestFilter`, sin mipmaps, cada sprite dentro de su contenedor con máscara propia. El idle por franjas (`BattleIdleMesh`, B39) solo corre en la enfocada; las laterales quedan quietas y atenuadas (`tint` con brillo `0.6` si comparten escala entera).
   - **Tarjetas compactas (3 columnas):** fondo **siempre** de madera oscura (`smokedWood`) con texto pergamino. Nombre en `Cinzel` con ellipsis, `"Nv. 5"`, y 3 cajas de stat (`PS`, `AT.ESP` o `ATK`, `VEL`) con etiqueta pequeña arriba y valor grande abajo, ancho medido sin solapes. La enfocada muestra borde dorado, resplandor suave y marcador triangular inferior; las no enfocadas al `70%` de opacidad.
   - **Zona con scroll e inercia:** tarjeta **DETALLE** (rol, arma, habilidad, lore de 3 líneas con botón `"Ver más"` que abre modal, y 4 movimientos con icono/color de tipo) + tarjeta **REGLA DE ORO** (diagrama visual `Alma + Cuerpo de Madera = Souldoll` y texto `"Recibes: Souldoll Nv.5 · Cuerpo de Madera · 5 Soul Bottles · 1 Elixir de ki"`).
   - **Paginación y barra inferior fija:** 3 puntos de paginación y 3 botones táctiles (`>= 44 px`): `Volver` (secundario, izquierda), `Ver ficha` (secundario, abre `CreatureDetailScene` B40 en vista previa de solo lectura) y `Elegir [nombre]` (primario, derecha).
3. **Comportamiento y Confirmación:**
   - Pulsar `Elegir [nombre]` o `CONFIRM` abre un modal de confirmación con miniatura del Souldoll, pregunta `"¿Elegir a [nombre] como tu primera Souldoll?"`, aviso de que las otras dos quedarán disponibles como almas salvajes, y campo de apodo opcional (`KitTextInput`).
   - Confirmar vincula la Soul Bottle con el Cuerpo de Madera mediante `StarterLabSystem`, emite el evento por `EventBus` y continúa con la secuencia del Laboratorio (B35).
4. **Texto, Fuentes y Cobertura de Glifos:**
   - Todos los textos en `es.json` (`terms.starter_select`).
   - Comprobación automática de cobertura de glifos (`¿ ¡ á é í ó ú ñ ü ( ) · / % +`) y uso de `Nunito` (`FONTS.body`) para cualquier frase con puntuación o paréntesis, reservando `Pixelify Sans` (`FONTS.hud`) para números y etiquetas cortas sin paréntesis.
5. **Arte Provisional Diferenciado y Documentación:**
   - Cada inicial muestra silueta, tocado, vestimenta, aura elemental y arma propia claramente distinguibles a simple vista (`Bastón Ignis` con rubí ígneo, `Vara de Sauce` con brote florido, `Tridente de Coral` de tres puntas).
   - Lista de pendientes de arte definitivo documentada en `/docs/art/STARTER_SHEETS_TODO.md`.
6. **Debug (F2) y Linter:**
   - Panel de diagnóstico en `F2` con selector de viewport (`360x640`, `390x844`, `412x915`, `Horizontal 844x390`), toggles de nombres largos, `4+` iniciales, arte faltante, rejilla de píxeles y cajas de límite, más linter de truncado/solape, glifos y escalas enteras.
