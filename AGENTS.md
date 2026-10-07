# AGENTS.md

SoulDolls: 2.5D creature-capture RPG. TypeScript + Three.js (3D overworld) + PixiJS v8 (HUD/battle) on Vite.
**Not React** — `package.json` keeps the historical name `react-example` but no longer lists any React dependency; zero `.tsx` files, no React imports, no react plugin in `vite.config.ts`. UI = PixiJS scenes. Don't add React.

## Setup

- Install: `npm install` (plain, sin ERESOLVE: se retiró el pin `esbuild@^0.25` que chocaba con `vite@8`).
- `bun.lock` es el lockfile commiteado y **está desactualizado** (no hay bun en este entorno); npm genera un `package-lock.json` sin trackear — no commitearlo.
- No CI, no pre-commit, no ESLint/Prettier. The only static check is `npm run lint` = `tsc --noEmit` (~2.5s, TypeScript 7 native).

## Commands (all verified in this repo)

- `npm run dev` → http://localhost:3000 (port fixed; also the Playwright baseURL).
- `npm run lint` → typecheck. `tsconfig.json` includes only `src/**/*`: `scripts/`, `tools/`, `e2e/`, `playwright.config.ts` are **not** typechecked.
- `npm run test:all` → the full gate (~11s): data, battle, evolution, party, gacha, quests, vfx, transition + `validate:maps` + `validate:tilesets`.
- Single suite: `npm run test:data | test:battle | test:evolution | test:party | test:gacha | test:quests | test:vfx | test:transition`.
- `npm run build` = `validate-tilesets` → `mapgen` → `vite build` (~6s). `npm run clean` drops `dist/`.
- E2E: `npm run test:e2e` (Playwright auto-starts the dev server on :3000). Browsers are not installed → `npx playwright install chromium`.

Recommended order: `npm run lint` → `npm run test:all`.

## Testing quirks

- **No test framework.** Each `src/tests/*.test.ts` is a `tsx` script that self-executes (e.g. `runAllBattleTests()` at module scope) and `throw`s on failure; a new test is just another script wired into `package.json`.
- `src/systems/**/BloqueNNN*TestRunner.ts` classes also run **in the browser** from `Game.init` (50 ms timer, every boot) and only `console.error` on failure — those failures never fail a CLI command.
- Data errors are fatal at boot: `Game.init` calls `DataValidator.validateAll()` and throws, so a bad data edit breaks game start. Always run `npm run test:data` after touching `src/data/`.

## Generated files / codegen

- **Maps**: source of truth is `src/data/maps/src/*.map.json`. `npm run mapgen` bakes `src/data/maps/*.ts` + `src/data/maps/baked/*.json` (deterministic seeds). The `.ts` files start with `AUTO-GENERATED — DO NOT EDIT MANUALLY`; edit the JSON and re-run.
- **Timestamp churn**: `validate:tilesets` (run by `test:all` and `build`) rewrites only the `generatedAt` field of `src/data/tilesets/assets_manifest.json`, leaving the tree dirty. Revert that noise; don't commit it.
- **License gate**: `tools/validate-tilesets.mjs` fails the build if a tileset pack lacks `pack.json`/`LICENSE.txt`, isn't `approved: true`, or is a prohibited pack. It regenerates `docs/CREDITS.md`.
- Art pipeline (see `docs/ART_GUIDE.md`): `prepare:atlas`, `prepare:sprites`, `bake:tilesets`, `convert:webp`, `pack:atlas`.
- **WebP**: `convert:webp` solo genera `.webp` reales con `sharp` (devDependency) usando `lossless+exact` y verificación píxel a píxel; si falta `sharp` borra los `.webp` obsoletos y el manifest queda solo con PNG (nunca escribe contenedores falsos).

## Architecture

- Layering rule (README): `src/systems` and `src/core` must not import `src/render`/`src/ui`; decouple via the typed `EventBus` and serializable state. It is **not enforced by tooling** and already violated in `src/core/Game.ts`, `src/core/SceneManager.ts`, `src/systems/battle/BattlePlayer.ts`, `src/systems/overworld/OverworldPlayer.ts`, and the `*TestRunner` files. Don't add new violations.
- Path aliases (declared in both `vite.config.ts` and `tsconfig.json` — keep them in sync): `@core` `@data` `@systems` `@scenes` `@render` `@ui` `@services` `@types` `@`.
- Flow: `index.html` → `src/main.ts` → `core/Game.ts` (validate data → init Three + Pixi renderers → `AssetRegistry` → register scenes) → `core/SceneManager.ts`. Scenes orchestrate in `src/scenes/`, pure logic in `src/systems/`, content in `src/data/`.
- Adding content is data-only (`creatures`, `moves`, `quests`, maps) — see README "Guía de Desarrollo". New map → register in `src/data/maps/worldGraph.ts`.
- UI: use the kit in `src/ui/kit` (`ScreenFrame`, `KitPrimitives`, `KitModal`) and keep logic in pure view-models under `src/ui/viewmodels` (no Pixi/DOM). `UIKitLinter.inspectTree` runs in DEV.
- Player-facing strings live in `src/data/text/es.json` (Spanish); `UIKitLinter.verifyEsJsonGlyphCoverage` checks Spanish glyph coverage (¿ ¡ á é í ó ú ñ …).

## Environment quirks

- `DISABLE_HMR=true` turns off Vite HMR/watch in `vite.config.ts`; the comment says not to modify that block (AI Studio flicker). Leave it.
- Debug: `?debug=1` / `?debug=0` URL param (persisted to localStorage) or 5 taps on the version number in Options; `F2` opens the debug panel (viewport presets, missing-art toggles).
- PWA: `sw.js` is deliberately self-unregistering and `main.ts` unregisters service workers on load to defeat stale caches — don't add caching there.

## Repo workflow

- Feature work is a numbered **Bloque (B##)**: spec in `docs/specs/blocks/B##-*.md`, status row with verification evidence in `docs/STATUS.md`, entry in `CHANGELOG.md`. Commit style is Conventional Commits (`feat:`, `chore:`).
- **Open blocks (read before starting work):** `B48` optimización de render = *EN CURSO* (spec `docs/specs/blocks/B48-optimizacion-render.md`: harness listo, P1.1 medido y conservado, P1.3 con diseño cerrado y sin implementar); `B49` look HD-2D = *PLAN esperando aprobación* (auditoría + plan F0-F7 en `docs/specs/blocks/B49-look-hd2d.md`, 3 decisiones abiertas). Never renumber: `B47` is taken by the metaball block.
- Specs reference slash commands like `/finish-spec B35` and files such as `docs/lore.md`, `docs/brand.md`, `docs/art/ART_PROMPTS.md` that are **not in this repo** — treat them as historical.
- Prose, comments, test output and specs are in Spanish; keep new ones consistent.

## Perf harness (B48)

- `src/perf/` = probe + overlay + `window.__perf` harness, loaded only with `?perf=1` or in DEV (hook in `src/main.ts`). Never let it allocate per frame or load in prod silently.
- `npx tsx scripts/perf-scenarios.ts [boot|walk|stand|battle|menus|transitions|all] --label NAME [--maps a,b,c] [--no-build]` → `docs/perf/raw/<NAME>.json`. **`stand` is the deterministic group (player idle) — use it for before/after comparisons; `walk`/`battle` paths are fps-dependent and noisy.**
- `npx tsx scripts/_dc.ts <map...>` = draw-call diagnosis per scene subtree (temp script; delete when B48 closes).
- Headless Chromium runs on SwiftShader (no GPU): FPS absolutes are meaningless — compare draw calls, geometries/textures, bytes, heap and p95 deltas only. `--enable-precise-memory-info` is required for heap/alloc metrics. For allocations use `allocPerSecondKB` (fps-independent); `allocPerFrameKB` is per browser frame, i.e. ≈ per second at SwiftShader speeds.
- The harness saves its own state in slot 9 (`PERF_SLOT`); player slots 1-3 are never touched.

