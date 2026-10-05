import * as THREE from 'three';
import { GlobalLabAtlas } from '../../render/overworld/LabAtlas';
import { INTERIOR_LAB_MAP } from '../../data/maps/interior_lab';
import { RUTA_CLARO_MAP } from '../../data/maps/ruta_claro';
import { BOSQUE_ECO_MAP } from '../../data/maps/bosque_eco';
import { DIALOGUE_TREES } from '../../data/dialogue/dialogues';
import { StarterLabSystem, LabInteractableId, StarterSpeciesId } from './StarterLabSystem';
import { EncounterSystem } from '../EncounterSystem';
import { GlobalSaveService } from '../../services/SaveService';
import { Rng } from '../../core/Rng';

export interface Bloque35TestResult {
  name: string;
  passed: boolean;
  details: string;
}

/**
 * BLOQUE 35 §5: Suite de verificación automatizada del Laboratorio del Maestro Artífice y Secuencia Inicial.
 */
export class Bloque35LabTestRunner {
  public static runAllTests(): {
    allPassed: boolean;
    results: Bloque35TestResult[];
  } {
    const results: Bloque35TestResult[] = [
      this.test1LabAtlasAndUvs(),
      this.test2LabInteriorStructureAndBfs(),
      this.test3StarterChoiceBindingAndSupplies(),
      this.test4RivalElementalCounterAndQuestClosure(),
      this.test5RiftDiagramStateAndGlossaryCompliance(),
    ];

    const allPassed = results.every((r) => r.passed);
    console.log('==================================================');
    console.log('🧪 [BLOQUE 35 TEST SUITE] Laboratorio del Maestro Artífice');
    console.log('==================================================');
    for (const r of results) {
      console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.details}`);
    }
    console.log('--------------------------------------------------');
    console.log(
      `Resultado global Bloque 35: ${allPassed ? '5/5 PASS' : 'FALLOS DETECTADOS'}`
    );
    console.log('==================================================');

    return { allPassed, results };
  }

  /**
   * Test 1 — Atlas y recortes UV del Laboratorio
   */
  public static test1LabAtlasAndUvs(): Bloque35TestResult {
    const requiredFrames = [
      'lab_facade_left',
      'lab_facade_center',
      'lab_facade_right',
      'lab_roof_slate_violet',
      'lab_tower_observatory',
      'lab_chimney_ki',
      'lab_sign_gear_bottle',
      'lab_floor_wood_dark',
      'lab_floor_stone',
      'lab_rug_emblem',
      'lab_wall_timber',
      'starter_pedestal_full',
      'starter_pedestal_empty',
      'starter_bottle_ember',
      'starter_bottle_leaf',
      'starter_bottle_water',
      'body_tube_wood_off',
      'body_tube_wood_lit',
      'body_tube_empty',
      'master_desk',
      'codex_pedestal',
      'anima_world_map',
      'rift_diagram_intact',
      'rift_diagram_awakened',
      'soul_purifier',
      'puppet_workbench',
      'bookshelf_tall_a',
      'bookshelf_tall_b',
    ];

    const tex = GlobalLabAtlas.getSharedTexture();
    const filterOk =
      tex.magFilter === THREE.NearestFilter &&
      tex.minFilter === THREE.NearestFilter &&
      tex.generateMipmaps === false &&
      tex.colorSpace === THREE.SRGBColorSpace;

    const missingFrames: string[] = [];
    for (const f of requiredFrames) {
      const reg = GlobalLabAtlas.AtlasRegion(f);
      if (!reg || reg.u0 >= reg.u1 || reg.v0 >= reg.v1) {
        missingFrames.push(f);
      }
    }

    const fallbackCheck = GlobalLabAtlas.createPropGeometry('non_existent_lab_prop_xyz');
    const fallbackOk = fallbackCheck.isFallback === true;

    const passed = filterOk && missingFrames.length === 0 && fallbackOk;
    return {
      name: 'Test 1 — Atlas y recortes UV del Laboratorio (LabAtlas)',
      passed,
      details: passed
        ? `${requiredFrames.length} frames verificados con NearestFilter, SRGBColorSpace, mipmaps=false y fallback magenta activo.`
        : `Fallo en LabAtlas: filterOk=${filterOk}, missing=[${missingFrames.join(',')}], fallbackOk=${fallbackOk}`,
    };
  }

  /**
   * Test 2 — Estructura de lab_interior (14x12) y conectividad BFS a los 7 interactuables
   */
  public static test2LabInteriorStructureAndBfs(): Bloque35TestResult {
    const map = INTERIOR_LAB_MAP;
    const dimOk = map.width === 14 && map.height === 12;

    const requiredInteractables: LabInteractableId[] = [
      'master_desk',
      'starter_pedestal',
      'body_tube',
      'codex_pedestal',
      'anima_world_map',
      'rift_diagram',
      'soul_purifier',
    ];

    // BFS de tiles caminables desde el punto de aparición (7, 10)
    const startX = map.spawnPoints.default.x;
    const startY = map.spawnPoints.default.y;
    const visited = new Set<string>();
    const queue: [number, number][] = [[startX, startY]];
    visited.add(`${startX},${startY}`);

    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];

    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        const npcBlocked = (map.npcs || []).some((n) => n.x === nx && n.y === ny);
        if (!map.collision[ny][nx] && !npcBlocked) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    const unreachable: string[] = [];
    const missingLabel: string[] = [];

    for (const id of requiredInteractables) {
      const signsForId = (map.signs || []).filter((s) => s.labInteractable === id);
      if (signsForId.length === 0) {
        unreachable.push(id);
        continue;
      }
      if (!signsForId.every((s) => Boolean(s.interactLabel && s.interactLabel.trim().length > 0))) {
        missingLabel.push(id);
      }

      // Es alcanzable si al menos una casilla adyacente ortogonal a uno de sus signos es caminable en el BFS
      const canReach = signsForId.some((s) =>
        dirs.some(([dx, dy]) => visited.has(`${s.x + dx},${s.y + dy}`))
      );
      if (!canReach) {
        unreachable.push(id);
      }
    }

    const exitWarp = map.warps.find((w) => w.x === 7 && w.y === 11);
    const warpReachable = Boolean(exitWarp && exitWarp.interactLabel === 'Salir' && visited.has('7,11'));

    const passed =
      dimOk && unreachable.length === 0 && missingLabel.length === 0 && warpReachable;
    return {
      name: 'Test 2 — Estructura de lab_interior (14x12) y BFS a los 7 interactuables',
      passed,
      details: passed
        ? `Dimensiones 14x12, puerta (7,11) y los 7 objetos interactivos alcanzables por BFS con interactLabel válido.`
        : `dimOk=${dimOk}, unreachable=[${unreachable.join(',')}], missingLabel=[${missingLabel.join(',')}], warpReachable=${warpReachable}`,
    };
  }

  /**
   * Test 3 — Elección de Soul Bottle, vinculación con Cuerpo de Madera y suministros
   */
  public static test3StarterChoiceBindingAndSupplies(): Bloque35TestResult {
    const speciesList: StarterSpeciesId[] = ['maga', 'sacerdotisa', 'hidromante'];
    const errors: string[] = [];

    for (const sp of speciesList) {
      const state = GlobalSaveService.createInitialState('TestSoultrainer');
      state.flags = {};
      state.party = [];
      state.inventory = { soul_bottle_comun: 0, elixir_ki: 0 };

      const rng = new Rng(35001);
      const { souldoll, body } = StarterLabSystem.chooseStarterBottle(state, sp, rng);

      if (souldoll.speciesId !== sp || souldoll.level !== 5) {
        errors.push(`${sp}: nivel o especie incorrecta`);
      }
      if (souldoll.bodyInstanceId !== body.instanceId || body.chassisId !== 'chassis_madera_t1') {
        errors.push(`${sp}: bodyInstanceId no vinculado a chassis_madera_t1`);
      }
      if (
        souldoll.partHP.head !== souldoll.maxPartHP.head ||
        souldoll.partHP.torso !== souldoll.maxPartHP.torso ||
        souldoll.partHP.arms !== souldoll.maxPartHP.arms ||
        souldoll.partHP.legs !== souldoll.maxPartHP.legs
      ) {
        errors.push(`${sp}: las 4 partes no están al 100%`);
      }
      if (state.inventory.soul_bottle_comun !== 5 || state.inventory.elixir_ki !== 1) {
        errors.push(
          `${sp}: inventario incorrecto (bottles=${state.inventory.soul_bottle_comun}, elixir=${state.inventory.elixir_ki})`
        );
      }
      if (
        !state.flags.starter_chosen ||
        !state.flags.body_linked ||
        !state.flags.codex_unlocked ||
        !state.flags.wild_starters_released
      ) {
        errors.push(`${sp}: flags obligatorios incompletos`);
      }

      // Verificar liberación de los otros 2 iniciales en ruta_claro y bosque_eco
      const rutaTable = EncounterSystem.getEffectiveEncounterTable(RUTA_CLARO_MAP, state);
      const bosqueTable = EncounterSystem.getEffectiveEncounterTable(BOSQUE_ECO_MAP, state);
      const otherTwo = speciesList.filter((o) => o !== sp);
      for (const other of otherTwo) {
        if (!rutaTable.some((e) => e.speciesId === other) || !bosqueTable.some((e) => e.speciesId === other)) {
          errors.push(`${sp}: inicial no elegido ${other} no aparece en tablas salvajes`);
        }
      }

      // Caso límite 4: apodo vacío conserva nombre canónico; apodo largo se trunca a 14 chars
      const defaultNick = StarterLabSystem.applyStarterNickname(state, '   ');
      if (defaultNick !== souldoll.nickname || defaultNick.length === 0) {
        errors.push(`${sp}: fallo al conservar nombre por defecto`);
      }
      const longNick = StarterLabSystem.applyStarterNickname(state, 'NombreDemasiadoLargo12345');
      if (longNick.length !== 14) {
        errors.push(`${sp}: fallo al truncar apodo a 14 caracteres`);
      }
    }

    const passed = errors.length === 0;
    return {
      name: 'Test 3 — Elección de Soul Bottle, Cuerpo de Madera, suministros y liberación salvaje',
      passed,
      details: passed
        ? 'Las 3 opciones crean Souldoll Nv.5 en chassis_madera_t1 (partes 100%), +5 Soul Bottles, +1 Elixir de ki y liberan los otros 2 iniciales.'
        : errors.join(' | '),
    };
  }

  /**
   * Test 4 — Emparejamiento elemental del rival y cierre no punitivo de quest
   */
  public static test4RivalElementalCounterAndQuestClosure(): Bloque35TestResult {
    const cMaga = StarterLabSystem.getRivalCounterSpecies('maga');
    const cSac = StarterLabSystem.getRivalCounterSpecies('sacerdotisa');
    const cHidro = StarterLabSystem.getRivalCounterSpecies('hidromante');

    const counterOk = cMaga === 'hidromante' && cSac === 'maga' && cHidro === 'sacerdotisa';

    // Simular derrota en el combate tutorial (Caso límite 3: sin Game Over, cura partes y completa main_1_starter)
    const state = GlobalSaveService.createInitialState('TestSoultrainer');
    state.flags = {};
    StarterLabSystem.chooseStarterBottle(state, 'maga', new Rng(99));
    // Dañar partes a 0 para simular derrota
    state.party[0].partHP.head = 0;
    state.party[0].partHP.torso = 0;
    state.party[0].currentHp = 0;

    StarterLabSystem.completeRivalTutorial(state, false);

    const healedOk =
      state.party[0].currentHp === state.party[0].maxHp &&
      state.party[0].partHP.head === state.party[0].maxPartHP.head &&
      state.party[0].partHP.torso === state.party[0].maxPartHP.torso;

    const questsOk =
      state.flags.rival_tutorial_done === true &&
      state.quests.main_1_starter?.status === 'completed' &&
      state.quests.main_2_package?.status === 'active';

    const passed = counterOk && healedOk && questsOk;
    return {
      name: 'Test 4 — Emparejamiento elemental del rival y cierre de quest',
      passed,
      details: passed
        ? 'Emparejamiento (maga->hidromante, sacerdotisa->maga, hidromante->sacerdotisa), curación post-tutorial y transición main_1_starter -> main_2_package OK.'
        : `counterOk=${counterOk}, healedOk=${healedOk}, questsOk=${questsOk}`,
    };
  }

  /**
   * Test 5 — Cambio de estado del Diagrama de la Grieta y cumplimiento de glosario (I-05, I-06)
   */
  public static test5RiftDiagramStateAndGlossaryCompliance(): Bloque35TestResult {
    const state = GlobalSaveService.createInitialState('TestSoultrainer');
    state.flags = { defeated_forest_boss: false };

    const beforeBoss = StarterLabSystem.inspectLabObject(state, 'rift_diagram');
    state.flags.defeated_forest_boss = true;
    const afterBoss = StarterLabSystem.inspectLabObject(state, 'rift_diagram');

    const diagramSwitchOk =
      beforeBoss.activeFrame === 'rift_diagram_intact' &&
      afterBoss.activeFrame === 'rift_diagram_awakened' &&
      beforeBoss.lines[0] !== afterBoss.lines[0] &&
      afterBoss.lines[0].includes('Los Hueco');

    // Escaneo de glosario y cero emojis en interior_lab y dialogues.ts
    const forbiddenTerms = [
      'Prof. Roble',
      'Profesor Roble',
      'Flamín',
      'Aquilo',
      'Brotín',
      'Villa Brote',
      'Chasis',
    ];
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

    const textsToInspect: string[] = [];
    for (const s of INTERIOR_LAB_MAP.signs || []) {
      textsToInspect.push(s.text);
    }
    for (const n of INTERIOR_LAB_MAP.npcs || []) {
      textsToInspect.push(n.name, ...n.dialogueLines);
    }
    for (const tree of Object.values(DIALOGUE_TREES)) {
      for (const node of Object.values(tree.nodes)) {
        textsToInspect.push(node.speakerName || '', node.text);
        for (const opt of node.options || []) {
          textsToInspect.push(opt.label);
        }
      }
    }

    const violations: string[] = [];
    for (const txt of textsToInspect) {
      for (const term of forbiddenTerms) {
        if (txt.includes(term)) {
          violations.push(`Término prohibido "${term}" en: "${txt.slice(0, 40)}..."`);
        }
      }
      if (emojiRegex.test(txt)) {
        violations.push(`Emoji prohibido en: "${txt.slice(0, 40)}..."`);
      }
    }

    const passed = diagramSwitchOk && violations.length === 0;
    return {
      name: 'Test 5 — Cambio de estado del Diagrama de la Grieta y glosario (I-05, I-06)',
      passed,
      details: passed
        ? 'Diagrama de la Grieta conmuta a rift_diagram_awakened (Los Hueco) y 0 términos prohibidos / 0 emojis en Laboratorio y diálogos.'
        : `diagramSwitchOk=${diagramSwitchOk}, violations=[${violations.join('; ')}]`,
    };
  }
}
