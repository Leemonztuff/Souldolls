# Guía de Organización de Assets y Datos (`SOULDOLLS — Ánima & Cuerpo`)

## 1. Estructura Canónica de Directorios

El proyecto sigue una convención estricta en **minúsculas (`lowercase`)** sin carpetas duplicadas:

```text
├── assets/                          # Recursos fuente (Raw / Offline Authoring)
│   ├── raw/                         # Imágenes fuente originales sin procesar (JPG)
│   │   ├── maga_battle_raw.jpg
│   │   ├── mercado_raw.jpg
│   │   ├── overworld_decor_raw.jpg
│   │   └── taller_raw.jpg
│   └── tilesets/                    # Packs de tilesets fuente con metadatos de licencia
│       └── anima_core/              # Hojas RPG Maker (A1..A5, B), pack.json y LICENSE.txt
│
├── public/                          # Recursos estáticos servidos en producción por Vite
│   ├── assets/
│   │   ├── atlases/                 # Atlas 3D del Overworld con canal alfa limpio
│   │   │   ├── mercado_atlas.png
│   │   │   ├── overworld_decor_atlas.png
│   │   │   └── taller_atlas.png
│   │   ├── souldolls/               # Hojas de combate de 4 vistas para las 14 Souldolls
│   │   │   └── <speciesId>_battle_sheet.png
│   │   └── tilesets/                # Tilesets horneados (PNG + WebP lossless)
│   │       └── anima_core/
│   └── data/                        # Metadatos JSON consumidos por fetch() en el cliente
│       ├── art/
│       │   ├── souldolls/           # Atlas JSON de cada especie (<speciesId>_battle_atlas.json)
│       │   ├── souldolls_sprites_manifest.json
│       │   ├── mercado_atlas.json
│       │   ├── overworld_decor_atlas.json
│       │   └── taller_atlas.json
│       └── decor/
│           └── biomes.json
│
└── src/data/                        # Datos tipados e importados por TypeScript en compilación
    ├── art/                         # Manifiesto de sprites y atlas importados en bundle
    ├── config/                      # Configuraciones globales (art.json, battle.json, scale.json)
    ├── maps/                        # Definiciones de mapas (src/, baked/ y módulos TS)
    ├── souldolls/                   # Catálogo de las 14 Souldolls (souls.ts)
    └── tilesets/                    # Índices horneados (anima_core_baked.json, assets_manifest.json)
```

## 2. Scripts de Pipeline de Arte

- `npm run prepare:atlas`: Procesa los JPG crudos de `assets/raw/` eliminando fondos (chroma-key y despill) y genera los atlas PNG en `public/assets/atlases/`.
- `npm run prepare:sprites`: Genera las 14 hojas de batalla (`public/assets/souldolls/<id>_battle_sheet.png`), sus atlas JSON y actualiza `souldolls_sprites_manifest.json`.
- `npm run bake:tilesets` / `npm run validate:tilesets`: Hornea los autotiles de `assets/tilesets/anima_core` hacia `public/assets/tilesets/anima_core` y valida licencias y dimensiones.
- `npm run mapgen`: Hornea los mapas deterministas desde `src/data/maps/src/*.map.json` hacia `src/data/maps/baked/` y módulos TypeScript.
