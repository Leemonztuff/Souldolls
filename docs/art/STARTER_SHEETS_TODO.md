# Hojas de Batalla y Atlas de Souldolls (14 Especies)

## 1. Hojas generadas y configuradas en uso

Todas las **14 especies** de Souldolls cuentan con su propia hoja PNG de 4 vistas (`view_front34`, `view_front`, `view_back`, `view_back34`) con transparencia real (`RGBA`), paleta de atuendo por clase, tocado distintivo y arma propia en la mano, además de su atlas JSON con bandas de animación idle (`neck`, `waist`, `bust`) y su registro en `souldolls_sprites_manifest.json` y `SOUL_SPECIES_DATA[id].spriteConfig`:

| # | Especie (`speciesId`) | Elemento | Arma característica en sprite | Tocado / Emblema | Hoja PNG (`sheetPath`) | Atlas JSON (`atlasPath`) |
|---|---|---|---|---|---|---|
| 01 | `maga` (Maga) | Fuego | Bastón Ignis (rubí ígneo) | Sombrero de bruja ígneo | `/Assets/souldolls/maga_battle_sheet.png` | `/data/art/souldolls/maga_battle_atlas.json` |
| 02 | `archimaga` (Archimaga) | Fuego | Cetro Piroclástico | Tiara Ignis dorada | `/Assets/souldolls/archimaga_battle_sheet.png` | `/data/art/souldolls/archimaga_battle_atlas.json` |
| 03 | `sacerdotisa` (Sacerdotisa) | Planta | Vara de Sauce (báculo-raíz) | Guirnalda de sauce y flores | `/Assets/souldolls/sacerdotisa_battle_sheet.png` | `/data/art/souldolls/sacerdotisa_battle_atlas.json` |
| 04 | `hierofante` (Hierofante) | Planta | Báculo Solaria | Corona Solar de raíces | `/Assets/souldolls/hierofante_battle_sheet.png` | `/data/art/souldolls/hierofante_battle_atlas.json` |
| 05 | `gladiadora` (Gladiadora) | Tierra | Guantelete de Piedra | Cresta de bronce | `/Assets/souldolls/gladiadora_battle_sheet.png` | `/data/art/souldolls/gladiadora_battle_atlas.json` |
| 06 | `titanide` (Titánide) | Tierra | Guantelete Titán | Corona Titánica | `/Assets/souldolls/titanide_battle_sheet.png` | `/data/art/souldolls/titanide_battle_atlas.json` |
| 07 | `bruja` (Bruja) | Neutro | Grimorio Polvo flotante | Sombrero arcano púrpura | `/Assets/souldolls/bruja_battle_sheet.png` | `/data/art/souldolls/bruja_battle_atlas.json` |
| 08 | `hechicera` (Hechicera) | Neutro | Tomo Arcano iluminado | Tiara de Velo Estelar | `/Assets/souldolls/hechicera_battle_sheet.png` | `/data/art/souldolls/hechicera_battle_atlas.json` |
| 09 | `hidromante` (Hidromante) | Agua | Tridente de Coral | Diadema de coral y perla | `/Assets/souldolls/hidromante_battle_sheet.png` | `/data/art/souldolls/hidromante_battle_atlas.json` |
| 10 | `cantora_marea` (Cantora de Marea) | Agua | Arpa Abismal / Tridente real | Corona de Perla Abismal | `/Assets/souldolls/cantora_marea_battle_sheet.png` | `/data/art/souldolls/cantora_marea_battle_atlas.json` |
| 11 | `monje` (Monje) | Eléctrico | Guantes Chispa | Cinta de disciplina dorada | `/Assets/souldolls/monje_battle_sheet.png` | `/data/art/souldolls/monje_battle_atlas.json` |
| 12 | `maestro_trueno` (Maestro del Trueno) | Eléctrico | Nunchaku Rayo | Halo de Trueno | `/Assets/souldolls/maestro_trueno_battle_sheet.png` | `/data/art/souldolls/maestro_trueno_battle_atlas.json` |
| 13 | `asesina` (Asesina) | Sombra | Daga Penumbra | Capucha umbría | `/Assets/souldolls/asesina_battle_sheet.png` | `/data/art/souldolls/asesina_battle_atlas.json` |
| 14 | `espectro` (Espectro) | Sombra | Guadaña del Vacío | Corona del Vacío | `/Assets/souldolls/espectro_battle_sheet.png` | `/data/art/souldolls/espectro_battle_atlas.json` |

## 2. Cómo regenerar o actualizar una hoja

Ejecuta el comando:
```bash
npm run prepare:sprites
```
O reemplaza directamente cualquier archivo `/public/Assets/souldolls/<speciesId>_battle_sheet.png` manteniendo las 4 columnas (`view_front34`, `view_front`, `view_back`, `view_back34`): `SoulDollSpriteFactory` y `AssetRegistry` lo cargarán automáticamente en batalla, en el Códice de Almas, en la Ficha de Souldoll (B40) y en la pantalla de elección de inicial (B46).
