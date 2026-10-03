# ESPECIFICACIÓN DE ARTE PARA SOULDOLLS (ART_SPEC.md)

Este documento detalla el formato de importación de sprites, la estructura de capas, la paleta de colores oficial y el funcionamiento del cargador de assets (`SoulDollSpriteFactory`) en el motor **Souldolls**.

---

## 1. Dimensiones y Estructura del Spritesheet

* **Tamaño del Frame:** Cada frame de animación debe estar contenido en una cuadrícula cuadrada perfecta de **64x64 píxeles** (con escalado nearest-neighbor en rendering).
* **Padding:** 0px de margen entre frames.
* **Pivote:** El centro de gravedad/pivote se sitúa en los **pies del personaje**, exactamente en las coordenadas relativas `(32, 60)` del frame.

---

## 2. Orden de Vistas y Filas

Cada spritesheet importado de un Souldoll contiene 4 columnas dispuestas horizontalmente que representan las vistas tridimensionales:

| Columna | Vista | Ángulo | Uso en Juego |
| :--- | :--- | :--- | :--- |
| **Columna 1 (0)** | Frente 3/4 | Frente-Izquierda | Vista enemiga en batalla / Overworld |
| **Columna 2 (1)** | Perfil Lado | Lado-Izquierda | Menú de resumen / Pose estática |
| **Columna 3 (2)** | Atrás Recto | Espaldas | Overworld caminando hacia arriba |
| **Columna 4 (3)** | Atrás 3/4 | Atrás-Derecha | Vista del Souldoll aliado en batalla (Jugador) |

---

## 3. Nomenclatura y Estructura de Capas (Data-Driven)

Para la composición de marionetas procedurales o la carga de spritesheets segmentados, se utiliza la siguiente nomenclatura de archivos y nombres de capas:

1. `body_<chassis_id>_<view>.png`: El chasis del cuerpo contenedor (madera, hierro, cristal, etc.).
2. `outfit_<species_id>_<style_id>_<view>.png`: Las vestimentas que definen la clase del alma. `style_id` puede ser `clasico` (por defecto) o `atrevido` (glamour).
3. `weapon_<weapon_id>_<view>_<frame>.png`: El arma equipada de la Souldoll.
4. `accessory_<item_id>_<view>.png`: Accesorios estéticos, reliquias y efectos de estado dinámicos.

---

## 4. Paleta de Colores de Referencia (Design Tokens)

Todos los sprites deben pintarse respetando estrictamente los valores hexadecimales definidos en `theme.json`:

* **Tonos de Chasis (Cuerpos):**
  * Madera: Base `#874C26` | Sombra `#422513` | Brillo `#A3623B`
  * Hierro: Base `#64748B` | Sombra `#334155` | Brillo `#94A3B8`
  * Cristal: Base `#0284C7` | Sombra `#0369A1` | Brillo `#38BDF8`
* **Ki (Auras y Núcleos):**
  * Cian de Ki: `#5FE3D2`
  * Violeta de Alma: `#9B6BFF`
  * Grieta / Rift: `#C2234B`

---

## 5. Algoritmo de Carga Dinámica (Fallback Procedural)

El sistema `SoulDollSpriteFactory` está diseñado para ser totalmente tolerante a fallos:
1. Al renderizar un Souldoll, el cargador busca el spritesheet real en el directorio `/Assets/`.
2. Si el archivo con el patrón esperado existe, se carga, se corta en las secciones correspondientes y se renderiza aplicando la orientación de combate correcta (3/4 espaldas para aliado, 3/4 frente para enemigo).
3. Si el asset no existe o no ha terminado de cargarse, el motor aplica de forma instantánea el renderizado procedural por capas por medio del Canvas API, garantizando que el juego sea jugable en todo momento sin imágenes caídas o vacías.
