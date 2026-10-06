# BLOQUE 47: Entidades de Almas Errantes con Efecto Metaball / Fluido Orgánico en el Overworld
- Depende de: B4, B36, B45
- Modifica: OverworldScene.ts, STATUS.md
- Estado: EN CURSO · Spec: v1.0
## Objetivo
Renderizar almas silvestres y latentes en la hierba alta y cuevas del overworld 3D (Three.js) mediante una técnica de metaballs / fluidos orgánicos dinámicos que se fusionan y estiran, con bordes brillantes y colores de la paleta oficial de Souldolls, moviéndose de forma errática.

## Requisitos (medibles)
1. **Técnica Metaball Procedural**: Generación de texturas o sprites dinámicos en canvas que simulan gotas orgánicas fusionándose con gradientes de neón.
2. **Paleta Oficial**: Uso exclusivo de colores de `theme.json` / `COLOR_NUM` (Soul Violet, Cyan Ki, Bronce, Oro).
3. **Movimiento Errático**: Deriva orgánica basada en funciones senoidales/harmónicas sobre las zonas de hierba y cuevas de los mapas.
4. **Integración Overworld**: Inserción en `OverworldScene.ts` sin impacto negativo en rendimiento (30+ FPS, sin draw calls excesivos).
5. **Pruebas y Test Runner**: `Bloque47SoulMetaballTestRunner.ts` validando la correcta inicialización y actualización de las entidades.
