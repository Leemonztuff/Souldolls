# Data Schemas & Content Architecture

This directory contains pure, validated data structures for the RPG game engine.

## Subdirectories & Modules
- `/creatures`: Monster definitions (Base stats, types, learnsets, evolutions, sprite frames)
- `/moves`: Attacks and spells (Power, accuracy, category, PP, status effects, animation cues)
- `/types`: Elemental types & effectiveness chart
- `/items`: Consumables, Pokéballs, Key Items, TMs
- `/maps`: 3D low-poly tile definitions, spawns, collision grids, triggers
- `/npcs`: Overworld characters, trainers, dialogue trees
- `/quests`: Main storyline and side quests
- `/text`: Localization JSON files (es.json, etc.)

## Data Principles
- 100% Data-Driven: No hardcoded game stats or formulas in rendering code.
- Fully validated with strict TypeScript interfaces.
- Serialized in pure JSON / immutable TS records.
