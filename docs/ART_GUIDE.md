# Guía de Estilo de Arte — Pokémon 2.5D HD-2D RPG

Esta guía establece las especificaciones técnicas y artísticas para reemplazar o ampliar los sprites procedurales del juego con arte real (PNG + JSON Atlas) manteniendo coherencia visual HD-2D.

---

## 🎨 1. Paletas de Color por Tipo Elemental
Cada criatura debe mantener una paleta coherente según su elemento principal:
- **Fuego**: Tonos rojos y anaranjados vibrantes (`#ef4444`, `#f97316`, `#b91c1c`).
- **Agua**: Tonos azules oceánicos y cian (`#3b82f6`, `#0ea5e9`, `#1d4ed8`).
- **Planta**: Verdes naturales y esmeralda (`#22c55e`, `#15803d`, `#86efac`).
- **Eléctrico**: Amarillos eléctricos y dorados (`#eab308`, `#facc15`, `#a16207`).
- **Tierra / Roca**: Marrones terrosos y grises piedra (`#78350f`, `#b45309`, `#64748b`).
- **Sombra / Psíquico**: Morados místicos y oscuros (`#7c3aed`, `#581c87`, `#c084fc`).

---

## 📐 2. Dimensiones y Requisitos Técnicos de Sprites

### A. Criaturas (Front / Back / Icon)
- **Tamaño estándar**: 128x128 píxeles por frame (o 64x64 escalado sin pérdida).
- **Formato**: PNG con transparencia alfa de 32 bits.
- **Outline**: Borde exterior sólido de 1 píxel en tono oscuro (`#0f172a` o negro con 80% opacidad) para contraste HD-2D sobre terreno 3D.
- **Estructura Atlas JSON**:
  ```json
  {
    "frames": {
      "flamin_front": { "x": 0, "y": 0, "w": 128, "h": 128 },
      "flamin_back": { "x": 128, "y": 0, "w": 128, "h": 128 },
      "flamin_icon": { "x": 256, "y": 0, "w": 32, "h": 32 }
    },
    "meta": { "scale": "1" }
  }
  ```

### B. Personajes de Overworld (Player / NPCs)
- **Grilla**: 4 direcciones (`down`, `up`, `left`, `right`) × 3 frames de animación (pie izquierdo, reposo, pie derecho).
- **Tamaño de celda**: 32x32 o 48x48 píxeles por frame.
- **Padding**: Mínimo 2 píxeles de separación entre celdas para evitar sangrado de textura en WebGL.

### C. Tiles del Mundo (Suelos y Decoración)
- **Tamaño**: 64x64 píxeles (texturas tileables sin costuras).
- **Filtro**: `NearestFilter` para conservar estética pixel art nítida.

---

## 🔍 3. Validador y Empaquetado
Todo sprite externo se verifica mediante `scripts/pack-atlas.ts` antes de ser incorporado al `AssetLoader` para garantizar que cumple con las dimensiones y el padding estipulado.
