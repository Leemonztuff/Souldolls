import { DialogueTree } from '../../types/dialogue';

export const DIALOGUE_TREES: Record<string, DialogueTree> = {
  // --- PROFESSOR ROBLE (Lab & Starter Choice) ---
  prof_roble_intro: {
    id: 'prof_roble_intro',
    startNodeId: 'node_start',
    nodes: {
      node_start: {
        id: 'node_start',
        speakerName: 'Prof. Roble',
        speakerPaletteId: 'professor',
        text: '¡Ah, bienvenido a mi laboratorio, Red! El mundo está repleto de criaturas maravillosas con afinidades elementales.',
        nextNodeId: 'node_choose_starter',
      },
      node_choose_starter: {
        id: 'node_choose_starter',
        speakerName: 'Prof. Roble',
        speakerPaletteId: 'professor',
        text: 'He preparado a tres compañeros iniciales para ti. ¿A cuál deseas confiar tu viaje?',
        options: [
          {
            label: '🔥 Flamín (Tipo Fuego)',
            nextNodeId: 'node_picked_flamin',
            effects: [
              { giveCreature: { speciesId: 'flamin', level: 5 } },
              { setFlag: { flag: 'has_starter', value: true } },
              { giveItem: { itemId: 'potion', count: 5 } },
              { giveItem: { itemId: 'capsule_basic', count: 5 } },
              { giveMoney: 500 },
              { completeQuest: 'main_1_starter' },
              { startQuest: 'main_2_package' },
            ],
          },
          {
            label: '💧 Aquilo (Tipo Agua)',
            nextNodeId: 'node_picked_aquilo',
            effects: [
              { giveCreature: { speciesId: 'aquilo', level: 5 } },
              { setFlag: { flag: 'has_starter', value: true } },
              { giveItem: { itemId: 'potion', count: 5 } },
              { giveItem: { itemId: 'capsule_basic', count: 5 } },
              { giveMoney: 500 },
              { completeQuest: 'main_1_starter' },
              { startQuest: 'main_2_package' },
            ],
          },
          {
            label: '🌿 Brotín (Tipo Planta)',
            nextNodeId: 'node_picked_brotin',
            effects: [
              { giveCreature: { speciesId: 'brotin', level: 5 } },
              { setFlag: { flag: 'has_starter', value: true } },
              { giveItem: { itemId: 'potion', count: 5 } },
              { giveItem: { itemId: 'capsule_basic', count: 5 } },
              { giveMoney: 500 },
              { completeQuest: 'main_1_starter' },
              { startQuest: 'main_2_package' },
            ],
          },
        ],
      },
      node_picked_flamin: {
        id: 'node_picked_flamin',
        speakerName: 'Prof. Roble',
        speakerPaletteId: 'professor',
        text: '¡Excelente elección! Flamín posee un corazón ardiente y gran velocidad. ¡Cuídalo bien en tu camino por Ruta Claro!',
      },
      node_picked_aquilo: {
        id: 'node_picked_aquilo',
        speakerName: 'Prof. Roble',
        speakerPaletteId: 'professor',
        text: '¡Magnífico! Aquilo es noble, resistente y domina las corrientes acuáticas. ¡Será un aliado formidable!',
      },
      node_picked_brotin: {
        id: 'node_picked_brotin',
        speakerName: 'Prof. Roble',
        speakerPaletteId: 'professor',
        text: '¡Una sabia elección! Brotín tiene una gran conexión con la naturaleza y puede absorber energía vital. ¡Buen viaje!',
      },
      node_already_has_starter: {
        id: 'node_already_has_starter',
        speakerName: 'Prof. Roble',
        speakerPaletteId: 'professor',
        text: '¡Tu criatura inicial y tú hacéis un equipo prometedor! Explora la hierba alta de Ruta Claro y completa la enciclopedia.',
      },
    },
  },

  // --- MAMÁ (Casa del Jugador) ---
  mom_dialogue: {
    id: 'mom_dialogue',
    startNodeId: 'node_mom_start',
    nodes: {
      node_mom_start: {
        id: 'node_mom_start',
        speakerName: 'Mamá',
        speakerPaletteId: 'lass',
        text: '¡Hola hijo! Te veo muy activo hoy. ¿Quieres que prepare algo rico y descanses un momento?',
        options: [
          {
            label: '🛏 Sí, por favor (Descansar)',
            nextNodeId: 'node_mom_rest',
            effects: [{ healParty: true }],
          },
          {
            label: '🚶 Solo venía a saludar',
            nextNodeId: 'node_mom_bye',
          },
        ],
      },
      node_mom_rest: {
        id: 'node_mom_rest',
        speakerName: 'Mamá',
        speakerPaletteId: 'lass',
        text: '¡Listo! Tú y tus criaturas os habéis recuperado por completo. ¡Mucho ánimo en tus aventuras!',
      },
      node_mom_bye: {
        id: 'node_mom_bye',
        speakerName: 'Mamá',
        speakerPaletteId: 'lass',
        text: 'Ten mucho cuidado y no olvides visitar el Laboratorio del Profesor Roble.',
      },
    },
  },

  // --- ENFERMERA JOY (Centro de Sanación) ---
  nurse_joy_dialogue: {
    id: 'nurse_joy_dialogue',
    startNodeId: 'node_joy_start',
    nodes: {
      node_joy_start: {
        id: 'node_joy_start',
        speakerName: 'Enfermera Joy',
        speakerPaletteId: 'nurse',
        text: '¡Hola! Te damos la bienvenida al Centro de Sanación. ¿Deseas restaurar la salud de tus criaturas?',
        options: [
          {
            label: '💖 Curar a mi equipo',
            nextNodeId: 'node_joy_heal',
            effects: [
              { healParty: true },
              { completeQuest: 'side_nurse_aid' },
            ],
          },
          {
            label: '❓ Consultar sobre misiones',
            nextNodeId: 'node_joy_quest',
            effects: [{ startQuest: 'side_nurse_aid' }],
          },
          {
            label: '✕ Salir',
            nextNodeId: 'node_joy_leave',
          },
        ],
      },
      node_joy_heal: {
        id: 'node_joy_heal',
        speakerName: 'Enfermera Joy',
        speakerPaletteId: 'nurse',
        text: '¡Un momento, por favor!... ... ... ¡Listo! Tus criaturas han recuperado todos sus PS y puntos de movimiento. ¡Esperamos verte pronto!',
      },
      node_joy_quest: {
        id: 'node_joy_quest',
        speakerName: 'Enfermera Joy',
        speakerPaletteId: 'nurse',
        text: '¡Gracias por preguntar! Siempre necesitamos entrenadores responsables que mantengan a sus criaturas en perfecto estado de salud.',
      },
      node_joy_leave: {
        id: 'node_joy_leave',
        speakerName: 'Enfermera Joy',
        speakerPaletteId: 'nurse',
        text: '¡Que tengas un viaje seguro y lleno de descubrimientos!',
      },
    },
  },

  // --- TENDERO (Tienda de Objetos) ---
  shopkeeper_dialogue: {
    id: 'shopkeeper_dialogue',
    startNodeId: 'node_shop_start',
    nodes: {
      node_shop_start: {
        id: 'node_shop_start',
        speakerName: 'Tendero',
        speakerPaletteId: 'clerk',
        text: '¡Buenas tardes! Tenemos los mejores artículos de expedición de la región.',
        options: [
          {
            label: '🛒 Comprar provisiones ($200 Cápsula / $300 Poción)',
            nextNodeId: 'node_shop_buy',
            effects: [
              { giveItem: { itemId: 'capsule_basic', count: 2 } },
              { giveItem: { itemId: 'potion', count: 1 } },
            ],
          },
          {
            label: '📜 Hablar de la región',
            nextNodeId: 'node_shop_talk',
            effects: [{ startQuest: 'side_collector' }],
          },
        ],
      },
      node_shop_buy: {
        id: 'node_shop_buy',
        speakerName: 'Tendero',
        speakerPaletteId: 'clerk',
        text: '¡Aquí tienes un paquete de bienvenida! ¡Vuelve cuando necesites más equipo!',
      },
      node_shop_talk: {
        id: 'node_shop_talk',
        speakerName: 'Tendero',
        speakerPaletteId: 'clerk',
        text: 'Si logras registrar al menos 6 especies distintas en tu Pokédex, ¡ven a verme y te daré una gran recompensa!',
      },
    },
  },

  // --- GUÍA LEO (Villa Brote Norte) ---
  guide_leo_dialogue: {
    id: 'guide_leo_dialogue',
    startNodeId: 'node_leo_start',
    nodes: {
      node_leo_start: {
        id: 'node_leo_start',
        speakerName: 'Guía Leo',
        speakerPaletteId: 'hiker',
        text: '¡Hola Red! Hacia el norte comienza Ruta Claro. ¿Estás listo para llevar el paquete de provisiones a Clara?',
        options: [
          {
            label: '📦 Aceptar encargo (Ruta Claro)',
            nextNodeId: 'node_leo_accept',
            effects: [{ startQuest: 'main_2_package' }],
          },
          {
            label: '💡 Pedir consejo',
            nextNodeId: 'node_leo_advice',
          },
        ],
      },
      node_leo_accept: {
        id: 'node_leo_accept',
        speakerName: 'Guía Leo',
        speakerPaletteId: 'hiker',
        text: '¡Excelente! Clara te estará esperando en el sendero junto al lago de Ruta Claro. ¡Buen camino!',
      },
      node_leo_advice: {
        id: 'node_leo_advice',
        speakerName: 'Guía Leo',
        speakerPaletteId: 'hiker',
        text: 'Recuerda: el Fuego vence a la Planta, la Planta al Agua, y el Agua al Fuego. ¡Aprovecha siempre la ventaja elemental!',
      },
    },
  },

  // --- CHICA CLARA (Ruta Claro) ---
  trainer_clara_dialogue: {
    id: 'trainer_clara_dialogue',
    startNodeId: 'node_clara_start',
    nodes: {
      node_clara_start: {
        id: 'node_clara_start',
        speakerName: 'Chica Clara',
        speakerPaletteId: 'lass',
        text: '¡Hola! ¿Traes el paquete de provisiones de Villa Brote?',
        options: [
          {
            label: '📦 Entregar paquete y combatir',
            nextNodeId: 'node_clara_deliver',
            effects: [
              { completeQuest: 'main_2_package' },
              { startQuest: 'main_3_forest_boss' },
            ],
          },
          {
            label: '👋 Saludar',
            nextNodeId: 'node_clara_chat',
          },
        ],
      },
      node_clara_deliver: {
        id: 'node_clara_deliver',
        speakerName: 'Chica Clara',
        speakerPaletteId: 'lass',
        text: '¡Muchísimas gracias! Toma esta recompensa. Y ahora que tienes tu criatura inicial... ¡vamos a medir fuerzas en un combate!',
      },
      node_clara_chat: {
        id: 'node_clara_chat',
        speakerName: 'Chica Clara',
        speakerPaletteId: 'lass',
        text: 'Entrenar con criaturas en la naturaleza es la mejor forma de fortalecer el vínculo con ellas.',
      },
    },
  },

  // --- MÍA (Villa Brote - Cazador Novato) ---
  mia_dialogue: {
    id: 'mia_dialogue',
    startNodeId: 'node_mia_start',
    nodes: {
      node_mia_start: {
        id: 'node_mia_start',
        speakerName: 'Mía',
        speakerPaletteId: 'lass',
        text: '¡Hola Red! ¿Te gusta atrapar criaturas salvajes en la hierba alta?',
        options: [
          {
            label: '🎯 Aceptar misión "Cazador novato"',
            nextNodeId: 'node_mia_accept',
            effects: [{ startQuest: 'side_novice_hunter' }],
          },
          {
            label: '🏆 Entregar misión (3 criaturas)',
            nextNodeId: 'node_mia_check',
            effects: [{ completeQuest: 'side_novice_hunter' }],
          },
        ],
      },
      node_mia_accept: {
        id: 'node_mia_accept',
        speakerName: 'Mía',
        speakerPaletteId: 'lass',
        text: '¡Genial! Atrapa al menos 3 criaturas en la hierba alta y te regalaré un lote de 10 Cápsulas.',
      },
      node_mia_check: {
        id: 'node_mia_check',
        speakerName: 'Mía',
        speakerPaletteId: 'lass',
        text: '¡Qué gran destreza! ¡Sigue aumentando tu colección de criaturas!',
      },
    },
  },

  // --- GUARDIÁN DEL ECO (Bosque Eco Boss) ---
  guardian_dialogue: {
    id: 'guardian_dialogue',
    startNodeId: 'node_guard_start',
    nodes: {
      node_guard_start: {
        id: 'node_guard_start',
        speakerName: 'Guardián del Eco',
        speakerPaletteId: 'professor',
        text: '¡Has cruzado el bosque y alcanzado la caverna mística! ¿Estás preparado para el desafío final de la prueba?',
        options: [
          {
            label: '⚔️ ¡Acepto el desafío!',
            nextNodeId: 'node_guard_accept',
            effects: [{ completeQuest: 'main_3_forest_boss' }],
          },
          {
            label: '🛡 Necesito prepararme más',
            nextNodeId: 'node_guard_wait',
          },
        ],
      },
      node_guard_accept: {
        id: 'node_guard_accept',
        speakerName: 'Guardián del Eco',
        speakerPaletteId: 'professor',
        text: '¡Admirable valentía! ¡Has superado todas las pruebas de la región y te has convertido en un maestro legendario!',
      },
      node_guard_wait: {
        id: 'node_guard_wait',
        speakerName: 'Guardián del Eco',
        speakerPaletteId: 'professor',
        text: 'La prudencia es una virtud de los grandes entrenadores. Regresa cuando tu equipo esté en su máximo poder.',
      },
    },
  },
};
