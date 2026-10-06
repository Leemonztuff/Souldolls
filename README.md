# SoulDolls 2.5D HD-2D RPG — Arquitectura y Guía de Desarrollo

Un motor de juego RPG de captura de criaturas estilo 2.5D (perspectiva isométrica-inclinada con sprites billboard sobre terreno 3D low-poly), desarrollado con **TypeScript**, **Three.js** y **PixiJS (v8)** sobre **Vite**.

---

## 🏗️ Diagrama y Arquitectura de Módulos

El proyecto sigue un diseño estricta 100% data-driven con separación modular inquebrantable:

```
src/
├── core/             # Motor principal (GameLoop, SceneManager, Input, EventBus)
├── systems/          # Lógica de juego pura y testeable (BattleEngine, QuestSystem, Pokedex, Encounter, AI)
├── data/             # Contenido data-driven puramente en TS/JSON (Creaturas, Mapas, Movimientos, Ítems, Quests, Diálogos, Validación)
├── scenes/           # Orquestación de escenas (Boot, Title, Overworld, Battle, Pokedex, Shop, StorageBox, Credits, Debug)
├── render/           # Capa de renderizado (ThreeRenderer para el mundo 3D, PixiRenderer para HUD/UI, AssetRegistry, procedural)
├── ui/               # Componentes y paneles de interfaz en PixiJS
└── services/         # Servicios globales (SaveService, AudioService WebAudio)
```

> **Regla de oro de arquitectura**: Los módulos en `/systems` y `/core` **NUNCA** importan nada de `/render` o `/ui`. Toda la comunicación se realiza de manera desacoplada mediante estados serializables y el `EventBus` tipado.

---

## 📖 Guía de Desarrollo: Cómo Ampliar Contenido (Solo Editando Datos)

### 1. Añadir una Nueva Criatura
Edita `src/data/creatures/creatures.ts`:
```ts
new_creature: {
  id: 'new_creature',
  dexNumber: 13,
  name: 'Nuevomin',
  types: ['Fuego', 'Dragón'],
  baseStats: { hp: 50, atk: 65, def: 50, spAtk: 70, spDef: 50, speed: 80 },
  learnset: [
    { level: 1, moveId: 'placaje' },
    { level: 5, moveId: 'ascuas' },
  ],
  catchRate: 45,
  baseExpYield: 64,
  growthRate: 'medium_fast',
}
```

### 2. Añadir un Nuevo Movimiento
Edita `src/data/moves/moves.ts`:
```ts
super_llama: {
  id: 'super_llama',
  name: 'Super Llama',
  type: 'Fuego',
  category: 'special',
  power: 90,
  accuracy: 100,
  pp: 15,
  effect: [{ type: 'damage' }],
  description: 'Llama abrasadora que incinera al objetivo.',
}
```

### 3. Añadir una Nueva Quest
Edita `src/data/quests/quests.ts`:
```ts
main_4_expansion: {
  id: 'main_4_expansion',
  title: 'Exploración volcánica',
  category: 'main',
  giverNpcId: 'npc_guide_leo',
  turnInNpcId: 'npc_guide_leo',
  summary: 'Investiga las anomalías térmicas.',
  objectives: [{ id: 'talk_leo', type: 'talk_to', targetId: 'npc_guide_leo', requiredCount: 1 }],
  rewards: { money: 3000, items: [{ itemId: 'capsule_great', count: 5 }] }
}
```

### 4. Añadir un Nuevo Mapa
Crea `src/data/maps/nueva_zona.ts` definiendo matrices `ground`, `decor`, `collision` y regístralo en `src/data/maps/worldGraph.ts` dentro de `MAP_REGISTRY` y `worldGraph`.

---

## 🧪 Validación y Tests
Ejecuta la suite completa de validación de datos, motor de batalla y sistema de evolución:
```bash
npm run test:data
npm run test:battle
npm run test:evolution
```

---

## 🔍 Checklist de QA Manual (Demo de Cierre)
- [x] Title Screen con guardado automático y selector de partidas.
- [x] Exploración 3D en Villa Brote, Ruta Claro y Bosque Eco con cámara HD-2D rotatoria.
- [x] Sistema de colisiones y transiciones por warps fluidas.
- [x] Batallas por turnos con efectividad elemental, STAB, críticos, estados alterados e IA.
- [x] Sistema de captura con Cápsulas y registro en Pokédex.
- [x] Evoluciones automáticas al alcanzar el nivel requerido con actualización de stats y learnset.
- [x] Tienda, Caja de Almacenamiento y Sistema de Misiones principales y secundarias.
- [x] Jefe final (Guardián del Eco) con 3 criaturas y escena de créditos/epílogo al vencer.
- [x] Game Over suave (retirada a Centro Pokémon con la mitad del dinero).
- [x] Overlay de diagnóstico de frustum y cruz de 1px.
