import { GameState } from '../../types';
import { Souldoll } from '../../types/souldolls';
import { BodyInstance } from '../../types/bodies';
import { EncounterEntry } from '../../types/maps';
import { SOUL_SPECIES_DATA } from '../../data/souldolls/souls';
import { BODY_CHASSIS_DATA } from '../../data/bodies/chassis';
import { QUESTS_DATA } from '../../data/quests/quests';
import { StatCalculator } from '../battle/StatCalculator';
import { Rng } from '../../core/Rng';
import starterLabConfig from '../../data/config/starter_lab.json';
import esText from '../../data/text/es.json';

export type StarterSpeciesId = 'maga' | 'sacerdotisa' | 'hidromante';

export type LabInteractableId =
  | 'master_desk'
  | 'starter_pedestal'
  | 'body_tube'
  | 'codex_pedestal'
  | 'anima_world_map'
  | 'rift_diagram'
  | 'soul_purifier';

export interface StarterOptionInfo {
  speciesId: StarterSpeciesId;
  name: string;
  element: string;
  bottleFrame: string;
  roleDescription: string;
  loreDescription: string;
  weaponId: string;
  rivalCounterSpeciesId: StarterSpeciesId;
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    spAtk: number;
    spDef: number;
    speed: number;
  };
}

export interface LabInspectResult {
  interactableId: LabInteractableId;
  action: 'start_intro' | 'open_starter_modal' | 'open_codex' | 'dialogue';
  speaker: string;
  lines: string[];
  activeFrame: string;
}

/**
 * BLOQUE 35 (R3, R4, Casos límite): Sistema puro del Laboratorio del Maestro Artífice.
 * Cumple Invariante I-03: 0 imports de render, ui, Three, Pixi ni DOM. Determinista con Rng.
 */
export class StarterLabSystem {
  public static getStarterOptions(): StarterOptionInfo[] {
    const tLab = (esText as any).terms.lab;
    return starterLabConfig.options.map((opt) => {
      const speciesId = opt.speciesId as StarterSpeciesId;
      const species = SOUL_SPECIES_DATA[speciesId];
      const roleDesc =
        speciesId === 'maga'
          ? tLab.role_maga
          : speciesId === 'sacerdotisa'
          ? tLab.role_sacerdotisa
          : tLab.role_hidromante;

      return {
        speciesId,
        name: species.name,
        element: opt.element,
        bottleFrame: opt.bottleFrame,
        roleDescription: roleDesc,
        loreDescription: species.description,
        weaponId: species.weaponId || 'baculo_aprendiz',
        rivalCounterSpeciesId: opt.rivalCounterSpeciesId as StarterSpeciesId,
        baseStats: { ...species.baseStats },
      };
    });
  }

  public static recordIntroSeen(state: GameState): void {
    if (!state.flags) state.flags = {};
    state.flags[starterLabConfig.flags.introSeen] = true;

    if (state.quests?.main_1_starter) {
      state.quests.main_1_starter.objectiveProgress['talk_to_prof'] = 1;
      if (state.quests.main_1_starter.currentObjectiveIndex === 0) {
        state.quests.main_1_starter.currentObjectiveIndex = 1;
      }
    }
  }

  /**
   * Ejecuta los Pasos 2, 3 y 4 de la secuencia del inicial:
   * - Registra la Soul Bottle elegida
   * - Instancia el Cuerpo de Madera (chassis_madera_t1) con IVs deterministas 15/15/15/15
   * - Vincula la Souldoll Nv.5 con sus 4 partes al 100%
   * - Entrega 5 Soul Bottles comunes + 1 Elixir de ki + Códice de Almas
   * - Libera las otras 2 almas iniciales a las rutas salvajes
   */
  public static chooseStarterBottle(
    state: GameState,
    speciesId: StarterSpeciesId,
    rng?: Rng
  ): {
    souldoll: Souldoll;
    body: BodyInstance;
    rivalSpeciesId: StarterSpeciesId;
  } {
    const option = starterLabConfig.options.find((o) => o.speciesId === speciesId);
    if (!option) {
      throw new Error(`[StarterLabSystem] Especie inicial inválida: ${speciesId}`);
    }

    if (!state.flags) state.flags = {};
    if (!state.vars) state.vars = {};
    if (!state.inventory) state.inventory = {};
    if (!state.bodies) state.bodies = {};
    if (!state.soulCodex) state.soulCodex = {};
    if (!state.pokedex) state.pokedex = {};

    const chassisId = starterLabConfig.initialChassisId;
    const chassis = BODY_CHASSIS_DATA[chassisId];
    const bodyIvs = { ...starterLabConfig.initialBodyIvs };
    const seedSuffix = rng ? String(rng.rangeInt(1000, 9999)) : '3501';
    const bodyInstanceId = `body_${chassisId}_starter_${speciesId}_${seedSuffix}`;

    const body: BodyInstance = {
      instanceId: bodyInstanceId,
      chassisId,
      ivs: bodyIvs,
      evs: { head: 0, torso: 0, arms: 0, legs: 0 },
      partDurability: { head: 100, torso: 100, arms: 100, legs: 100 },
      nickname: chassis?.name || 'Cuerpo de Madera',
    };
    state.bodies[bodyInstanceId] = body;

    const balancedSoulIvs = {
      hp: bodyIvs.head,
      atk: bodyIvs.arms,
      def: bodyIvs.torso,
      spAtk: 15,
      spDef: 15,
      speed: bodyIvs.legs,
    };

    const souldoll = StatCalculator.createSouldoll(
      speciesId,
      starterLabConfig.starterLevel,
      chassisId,
      SOUL_SPECIES_DATA[speciesId].name,
      'docil',
      balancedSoulIvs
    );
    souldoll.uid = `starter_${speciesId}_${seedSuffix}`;
    souldoll.bodyInstanceId = bodyInstanceId;
    StatCalculator.ensurePartHp(souldoll);
    souldoll.partHP = { ...souldoll.maxPartHP };
    souldoll.currentHp = souldoll.maxHp;

    // Caso límite 2: Si aún no se había vinculado el inicial real, reemplaza cualquier placeholder de prueba
    if (!state.flags[starterLabConfig.flags.bodyLinked]) {
      state.party = [souldoll];
    } else {
      state.party.unshift(souldoll);
    }

    // Entrega de suministros de starter_lab.json (+5 soul_bottle_comun, +1 elixir_ki)
    for (const gift of starterLabConfig.gifts) {
      state.inventory[gift.itemId] = (state.inventory[gift.itemId] || 0) + gift.count;
    }

    // Activación de flags y Códice de Almas
    state.flags[starterLabConfig.flags.introSeen] = true;
    state.flags[starterLabConfig.flags.starterChosen] = true;
    state.flags[starterLabConfig.flags.bodyLinked] = true;
    state.flags[starterLabConfig.flags.codexUnlocked] = true;
    state.flags[starterLabConfig.flags.wildStartersReleased] = true;
    state.flags.has_starter = true;
    state.flags.received_starter = true;
    state.vars.starter_species_id = speciesId;

    state.soulCodex[speciesId] = { seen: true, caught: true };
    state.pokedex[speciesId] = { seen: true, caught: true };

    return {
      souldoll,
      body,
      rivalSpeciesId: option.rivalCounterSpeciesId as StarterSpeciesId,
    };
  }

  /**
   * Caso límite 4: Apodo opcional (máx. 14 caracteres; si se cancela o deja vacío, conserva el nombre de la especie)
   */
  public static applyStarterNickname(state: GameState, rawNickname?: string | null): string {
    const lead = state.party[0];
    if (!lead) return '';
    const species = SOUL_SPECIES_DATA[lead.soulSpeciesId || lead.speciesId] || SOUL_SPECIES_DATA.maga;
    const cleaned = (rawNickname || '').trim().slice(0, 14);
    lead.nickname = cleaned.length > 0 ? cleaned : species.name;
    return lead.nickname;
  }

  /**
   * R4.5: El rival elige siempre la especie con ventaja elemental (maga -> hidromante, sacerdotisa -> maga, hidromante -> sacerdotisa)
   */
  public static getRivalCounterSpecies(playerStarterSpeciesId: string): StarterSpeciesId {
    const found = starterLabConfig.options.find((o) => o.speciesId === playerStarterSpeciesId);
    if (found) {
      return found.rivalCounterSpeciesId as StarterSpeciesId;
    }
    if (playerStarterSpeciesId === 'maga') return 'hidromante';
    if (playerStarterSpeciesId === 'sacerdotisa') return 'maga';
    return 'sacerdotisa';
  }

  public static createRivalSouldoll(playerStarterSpeciesId: string): Souldoll {
    const rivalSpeciesId = this.getRivalCounterSpecies(playerStarterSpeciesId);
    const species = SOUL_SPECIES_DATA[rivalSpeciesId];
    const ivs = { hp: 15, atk: 15, def: 15, spAtk: 15, spDef: 15, speed: 15 };
    const rivalDoll = StatCalculator.createSouldoll(
      rivalSpeciesId,
      starterLabConfig.starterLevel,
      starterLabConfig.initialChassisId,
      species.name,
      'docil',
      ivs
    );
    StatCalculator.ensurePartHp(rivalDoll);
    rivalDoll.partHP = { ...rivalDoll.maxPartHP };
    rivalDoll.currentHp = rivalDoll.maxHp;

    // Registra avistamiento del inicial del rival en el Códice
    return rivalDoll;
  }

  /**
   * R4.5 y Caso límite 3: Al terminar el combate tutorial (victoria o derrota),
   * restaura el equipo al 100%, marca rival_tutorial_done = true, completa main_1_starter y activa main_2_package.
   */
  public static completeRivalTutorial(state: GameState, _victory: boolean): void {
    if (!state.flags) state.flags = {};
    if (!state.quests) state.quests = {};

    // Restauración completa de todas las partes y PS en la máquina del Laboratorio
    for (const doll of state.party) {
      StatCalculator.ensurePartHp(doll);
      doll.partHP.head = doll.maxPartHP.head;
      doll.partHP.torso = doll.maxPartHP.torso;
      doll.partHP.arms = doll.maxPartHP.arms;
      doll.partHP.legs = doll.maxPartHP.legs;
      doll.currentHp = doll.maxHp;
      doll.status = null;
      for (const m of doll.moves) {
        m.currentPp = m.maxPp;
      }
    }

    const chosenId = (state.vars?.starter_species_id as string) || state.party[0]?.speciesId || 'maga';
    const rivalId = this.getRivalCounterSpecies(chosenId);
    if (state.soulCodex && !state.soulCodex[rivalId]) {
      state.soulCodex[rivalId] = { seen: true, caught: false };
    }
    if (state.pokedex && !state.pokedex[rivalId]) {
      state.pokedex[rivalId] = { seen: true, caught: false };
    }

    state.flags[starterLabConfig.flags.rivalDefeated] = true;

    // Completar "El ki sin color" (main_1_starter) y activar "Camino a Ruta Claro" (main_2_package)
    state.quests.main_1_starter = {
      status: 'completed',
      currentObjectiveIndex: QUESTS_DATA.main_1_starter.objectives.length,
      objectiveProgress: {
        talk_to_prof: 1,
        choose_starter: 1,
      },
    };

    if (!state.quests.main_2_package || state.quests.main_2_package.status !== 'completed') {
      state.quests.main_2_package = {
        status: 'active',
        currentObjectiveIndex: 0,
        objectiveProgress: {},
      };
    }
  }

  /**
   * R3: Inspección contextual de los 7 objetos interactivos del Laboratorio
   */
  public static inspectLabObject(
    state: GameState,
    interactableId: LabInteractableId
  ): LabInspectResult {
    const tLab = (esText as any).terms.lab;
    const flags = state.flags || {};
    const introSeen = Boolean(flags[starterLabConfig.flags.introSeen]);
    const starterChosen = Boolean(flags[starterLabConfig.flags.starterChosen]);
    const bodyLinked = Boolean(flags[starterLabConfig.flags.bodyLinked]);
    const bossDefeated = Boolean(flags.defeated_forest_boss || flags.bosque_eco_boss);

    switch (interactableId) {
      case 'master_desk': {
        if (!introSeen) {
          this.recordIntroSeen(state);
          return {
            interactableId,
            action: 'start_intro',
            speaker: 'Maestro Artífice',
            lines: [
              'Tu ki no tiene color, muchacho. Eso es raro… y un poco inquietante. Ven, que las muñecas ya hacen apuestas sobre ti.',
              'Recuerda la Regla de Oro de nuestro Gremio: una Souldoll nace al unir un Alma sellada en su Soul Bottle con un Cuerpo contenedor.',
              'Acércate al pedestal de piedra para elegir tu primera Soul Bottle (Maga, Sacerdotisa o Hidromante) y vincularla al Cuerpo de Madera del tubo de cristal.',
            ],
            activeFrame: 'master_desk',
          };
        }
        return {
          interactableId,
          action: 'dialogue',
          speaker: 'Maestro Artífice',
          lines: starterChosen
            ? [
                'Tu Souldoll inicial y tú formáis un vínculo extraordinario. Explora la Ruta Claro y registra las 14 especies en el Códice de Almas.',
              ]
            : [
                'Las tres Soul Bottles te esperan en el pedestal de piedra a tu izquierda. Elige la que mejor resuene con tu ki incoloro.',
              ],
          activeFrame: 'master_desk',
        };
      }

      case 'starter_pedestal': {
        if (!introSeen) {
          return {
            interactableId,
            action: 'dialogue',
            speaker: 'Pedestal de Iniciales',
            lines: [tLab.pedestal_need_intro],
            activeFrame: 'starter_pedestal_full',
          };
        }
        if (!starterChosen) {
          return {
            interactableId,
            action: 'open_starter_modal',
            speaker: 'Pedestal de Iniciales',
            lines: [tLab.choose_title],
            activeFrame: 'starter_pedestal_full',
          };
        }
        const chosenId = (state.vars?.starter_species_id as string) || 'maga';
        const chosenName = SOUL_SPECIES_DATA[chosenId]?.name || 'Maga';
        return {
          interactableId,
          action: 'dialogue',
          speaker: 'Pedestal de Iniciales',
          lines: [tLab.pedestal_after_choice.replace('{name}', chosenName)],
          activeFrame: 'starter_pedestal_empty',
        };
      }

      case 'body_tube': {
        if (!starterChosen) {
          return {
            interactableId,
            action: 'dialogue',
            speaker: 'Tubo de Cristal',
            lines: [tLab.tube_before_bottle],
            activeFrame: 'body_tube_wood_off',
          };
        }
        if (!bodyLinked) {
          state.flags[starterLabConfig.flags.bodyLinked] = true;
          const chosenId = (state.vars?.starter_species_id as string) || 'maga';
          const chosenName = SOUL_SPECIES_DATA[chosenId]?.name || 'Maga';
          return {
            interactableId,
            action: 'dialogue',
            speaker: 'Tubo de Cristal',
            lines: [tLab.tube_activated.replace('{name}', chosenName)],
            activeFrame: 'body_tube_wood_lit',
          };
        }
        return {
          interactableId,
          action: 'dialogue',
          speaker: 'Tubo de Cristal',
          lines: [tLab.tube_after_link],
          activeFrame: 'body_tube_empty',
        };
      }

      case 'codex_pedestal': {
        if (!starterChosen) {
          return {
            interactableId,
            action: 'dialogue',
            speaker: 'Pedestal del Códice',
            lines: [tLab.codex_locked],
            activeFrame: 'codex_pedestal',
          };
        }
        state.flags[starterLabConfig.flags.codexUnlocked] = true;
        return {
          interactableId,
          action: 'open_codex',
          speaker: 'Pedestal del Códice',
          lines: [tLab.codex_unlocked_msg],
          activeFrame: 'codex_pedestal',
        };
      }

      case 'anima_world_map': {
        return {
          interactableId,
          action: 'dialogue',
          speaker: 'Mapa de Anima',
          lines: [tLab.map_anima_text],
          activeFrame: 'anima_world_map',
        };
      }

      case 'rift_diagram': {
        return {
          interactableId,
          action: 'dialogue',
          speaker: 'Diagrama de la Grieta',
          lines: [bossDefeated ? tLab.rift_awakened_text : tLab.rift_intact_text],
          activeFrame: bossDefeated ? 'rift_diagram_awakened' : 'rift_diagram_intact',
        };
      }

      case 'soul_purifier': {
        const hasNurseQuest =
          state.quests?.side_nurse_aid?.status === 'active' ||
          state.quests?.side_nurse_aid?.status === 'completed' ||
          state.quests?.main_3_forest_boss?.status === 'active' ||
          state.quests?.main_3_forest_boss?.status === 'completed';
        const hasAilment = (state.party || []).some((d) => Boolean(d.status));
        if (hasNurseQuest || hasAilment) {
          for (const d of state.party || []) {
            d.status = null;
          }
          return {
            interactableId,
            action: 'dialogue',
            speaker: 'Purificador de Almas',
            lines: [tLab.purifier_active_text],
            activeFrame: 'soul_purifier',
          };
        }
        return {
          interactableId,
          action: 'dialogue',
          speaker: 'Purificador de Almas',
          lines: [tLab.purifier_idle_text],
          activeFrame: 'soul_purifier',
        };
      }
    }
  }

  /**
   * R4.4 y Q4: Devuelve los 2 iniciales no elegidos como encuentros raros (weight: 5)
   * cuando wild_starters_released está activo.
   */
  public static getWildStarterEntries(state?: GameState | null): EncounterEntry[] {
    if (!state?.flags?.[starterLabConfig.flags.wildStartersReleased]) {
      return [];
    }
    const chosenId = (state.vars?.starter_species_id as string) || 'maga';
    return starterLabConfig.options
      .filter((opt) => opt.speciesId !== chosenId)
      .map((opt) => ({
        speciesId: opt.speciesId,
        minLevel: 4,
        maxLevel: 6,
        weight: 5,
      }));
  }
}
