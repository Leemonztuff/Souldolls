import { DialogueTree } from '../../types/dialogue';

export const DIALOGUE_TREES: Record<string, DialogueTree> = {
  // --- MAESTRO ARTÍFICE (Laboratorio & Secuencia Inicial B35) ---
  prof_roble_intro: {
    id: 'prof_roble_intro',
    startNodeId: 'node_start',
    nodes: {
      node_start: {
        id: 'node_start',
        speakerName: 'Maestro Artífice',
        speakerPaletteId: 'professor',
        text: 'Tu ki no tiene color, muchacho. Eso es raro… y un poco inquietante. Ven, que las muñecas ya hacen apuestas sobre ti.',
        effects: [{ setFlag: { flag: 'lab_intro_seen', value: true } }],
        nextNodeId: 'node_explain_golden_rule',
      },
      node_explain_golden_rule: {
        id: 'node_explain_golden_rule',
        speakerName: 'Maestro Artífice',
        speakerPaletteId: 'professor',
        text: 'Recuerda la Regla de Oro de nuestro Gremio: una Souldoll nace al unir un Alma sellada en su Soul Bottle con un Cuerpo contenedor.',
        nextNodeId: 'node_direct_to_pedestal',
      },
      node_direct_to_pedestal: {
        id: 'node_direct_to_pedestal',
        speakerName: 'Maestro Artífice',
        speakerPaletteId: 'professor',
        text: 'Acércate al pedestal de piedra para elegir tu primera Soul Bottle (Maga, Sacerdotisa o Hidromante) y vincularla al Cuerpo de Madera del tubo de cristal.',
      },
      node_already_has_starter: {
        id: 'node_already_has_starter',
        speakerName: 'Maestro Artífice',
        speakerPaletteId: 'professor',
        text: 'Tu Souldoll inicial y tú formáis un vínculo extraordinario. Explora la Ruta Claro, cuida las cuatro partes de tu Cuerpo contenedor y registra tus hallazgos en el Códice de Almas.',
      },
    },
  },

  // --- APRENDIZ KAEL (Rival en el Laboratorio B35) ---
  rival_kael_dialogue: {
    id: 'rival_kael_dialogue',
    startNodeId: 'node_kael_start',
    nodes: {
      node_kael_start: {
        id: 'node_kael_start',
        speakerName: 'Aprendiz Kael',
        speakerPaletteId: 'rival',
        text: 'Así que tú eres el forastero del ki incoloro del que tanto habla el Maestro Artífice. Elige rápido tu Soul Bottle en el pedestal si quieres poner a prueba tu Cuerpo de Madera.',
      },
    },
  },

  // --- MAMÁ / ANFITRIONA (Casa del Jugador) ---
  mom_dialogue: {
    id: 'mom_dialogue',
    startNodeId: 'node_mom_start',
    nodes: {
      node_mom_start: {
        id: 'node_mom_start',
        speakerName: 'Anfitriona Clara',
        speakerPaletteId: 'lass',
        text: 'Te veo con mucha energía hoy, joven Soultrainer. ¿Quieres descansar un momento para restaurar el ki de tu equipo?',
        options: [
          {
            label: 'Sí, descansar un momento',
            nextNodeId: 'node_mom_rest',
            effects: [{ healParty: true }],
          },
          {
            label: 'Solo venía a saludar',
            nextNodeId: 'node_mom_bye',
          },
        ],
      },
      node_mom_rest: {
        id: 'node_mom_rest',
        speakerName: 'Anfitriona Clara',
        speakerPaletteId: 'lass',
        text: 'Listo. Tú y tus Souldolls habéis recuperado vuestra resonancia por completo. Mucho ánimo en tu viaje por Anima.',
      },
      node_mom_bye: {
        id: 'node_mom_bye',
        speakerName: 'Anfitriona Clara',
        speakerPaletteId: 'lass',
        text: 'Ten mucho cuidado en los senderos y no olvides visitar el Laboratorio del Maestro Artífice.',
      },
    },
  },

  // --- ARTÍFICE DE ALMAS (Taller de Artífices) ---
  nurse_joy_dialogue: {
    id: 'nurse_joy_dialogue',
    startNodeId: 'node_joy_start',
    nodes: {
      node_joy_start: {
        id: 'node_joy_start',
        speakerName: 'Artífice de Almas',
        speakerPaletteId: 'nurse',
        text: 'Saludos, Soultrainer. Te doy la bienvenida al Taller de Artífices de la Aldea Marioneta. Cuidamos el ki y los cuerpos de tus Souldolls. ¿En qué podemos servirte hoy?',
        options: [
          {
            label: 'Curar equipo',
            nextNodeId: 'node_joy_heal',
            effects: [
              { healParty: true },
              { completeQuest: 'side_nurse_aid' },
            ],
          },
          {
            label: 'Reparar cuerpo',
            nextNodeId: 'node_joy_workshop',
            effects: [{ openWorkshop: true }],
          },
          {
            label: 'Purgar ki',
            nextNodeId: 'node_joy_workshop',
            effects: [{ openWorkshop: true }],
          },
          {
            label: 'Mejorar cuerpo',
            nextNodeId: 'node_joy_workshop',
            effects: [{ openWorkshop: true }],
          },
          {
            label: 'Almacén de Almas',
            nextNodeId: 'node_joy_storage',
            effects: [{ openStorageBox: true }],
          },
          {
            label: 'Almacén de Cuerpos',
            nextNodeId: 'node_joy_storage',
            effects: [{ openStorageBox: true }],
          },
          {
            label: 'Salir',
            nextNodeId: 'node_joy_leave',
          },
        ],
      },
      node_joy_heal: {
        id: 'node_joy_heal',
        speakerName: 'Artífice de Almas',
        speakerPaletteId: 'nurse',
        text: 'Sincronizando el flujo de ki con la cámara de resonancia... Listo. Tus Souldolls han restaurado el 100% de sus PS en todas sus partes, su energía y sus movimientos.',
      },
      node_joy_workshop: {
        id: 'node_joy_workshop',
        speakerName: 'Artífice de Almas',
        speakerPaletteId: 'nurse',
        text: 'Abriendo banco de trabajo... Aquí puedes inspeccionar los cuerpos por partes (Cabeza, Torso, Brazos, Piernas), reforzarlos con aleaciones o reparar daños.',
      },
      node_joy_storage: {
        id: 'node_joy_storage',
        speakerName: 'Artífice de Almas',
        speakerPaletteId: 'nurse',
        text: 'Conectando con el Almacén de Cuerpos y Almas. Aquí puedes resguardar cuerpos contenedores y almas selladas en reserva.',
      },
      node_joy_lore: {
        id: 'node_joy_lore',
        speakerName: 'Artífice de Almas',
        speakerPaletteId: 'nurse',
        text: 'Una Souldoll = Alma + Cuerpo.\n• Cabeza o Torso a 0: KO inmediato.\n• Brazos a 0: -50% ATK físico y no puedes usar armas.\n• Piernas a 0: -50% Velocidad y menor evasión.\nMantenlos siempre reparados aquí.',
      },
      node_joy_leave: {
        id: 'node_joy_leave',
        speakerName: 'Artífice de Almas',
        speakerPaletteId: 'nurse',
        text: 'Que el ki guíe tus pasos por Anima. Vuelve cuando tus Souldolls necesiten mantenimiento.',
      },
    },
  },

  // --- TENDERO / MERCADER (Mercado de Artífices) ---
  shopkeeper_dialogue: {
    id: 'shopkeeper_dialogue',
    startNodeId: 'node_shop_start',
    nodes: {
      node_shop_start: {
        id: 'node_shop_start',
        speakerName: 'Mercader Artífice',
        speakerPaletteId: 'clerk',
        text: 'Saludos, Soultrainer. Bienvenido al Mercado de Artífices. ¿Qué buscas para tu viaje?',
        options: [
          {
            label: 'COMPRAR ARTÍCULOS',
            nextNodeId: 'node_shop_buy',
            effects: [{ openShop: true, shopMode: 'buy' }],
          },
          {
            label: 'VENDER BOTÍN',
            nextNodeId: 'node_shop_sell',
            effects: [{ openShop: true, shopMode: 'sell' }],
          },
          {
            label: 'NOVEDADES DEL GREMIO',
            nextNodeId: 'node_shop_talk',
            effects: [{ startQuest: 'side_collector' }],
          },
        ],
      },
      node_shop_buy: {
        id: 'node_shop_buy',
        speakerName: 'Mercader Artífice',
        speakerPaletteId: 'clerk',
        text: 'Explora nuestras vitrinas y expositores. Puedes interactuar directamente con cada estante y maniquí de la tienda.',
      },
      node_shop_sell: {
        id: 'node_shop_sell',
        speakerName: 'Mercader Artífice',
        speakerPaletteId: 'clerk',
        text: 'Compramos reliquias, cristales de maná sobrantes y materiales de forja al mejor precio de Anima.',
      },
      node_shop_talk: {
        id: 'node_shop_talk',
        speakerName: 'Mercader Artífice',
        speakerPaletteId: 'clerk',
        text: 'Si logras registrar al menos 6 almas distintas en tu Códice de Almas, ven a verme y te daré una gran recompensa.',
      },
    },
  },

  // --- GUÍA LEO (Aldea Marioneta Norte) ---
  guide_leo_dialogue: {
    id: 'guide_leo_dialogue',
    startNodeId: 'node_leo_start',
    nodes: {
      node_leo_start: {
        id: 'node_leo_start',
        speakerName: 'Guía Leo',
        speakerPaletteId: 'hiker',
        text: 'Hacia el norte comienza Ruta Claro. ¿Estás listo para llevar el paquete de piezas de articulación a Clara?',
        options: [
          {
            label: 'Aceptar encargo (Ruta Claro)',
            nextNodeId: 'node_leo_accept',
            effects: [{ startQuest: 'main_2_package' }],
          },
          {
            label: 'Pedir consejo táctico',
            nextNodeId: 'node_leo_advice',
          },
        ],
      },
      node_leo_accept: {
        id: 'node_leo_accept',
        speakerName: 'Guía Leo',
        speakerPaletteId: 'hiker',
        text: 'Excelente. Clara te estará esperando en el sendero junto al lago de Ruta Claro. Buen camino.',
      },
      node_leo_advice: {
        id: 'node_leo_advice',
        speakerName: 'Guía Leo',
        speakerPaletteId: 'hiker',
        text: 'Recuerda: el Fuego vence a la Planta, la Planta al Agua, y el Agua al Fuego. Aprovecha siempre la ventaja elemental.',
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
        speakerName: 'Soultrainer Clara',
        speakerPaletteId: 'lass',
        text: '¿Traes el paquete de piezas de articulación desde la Aldea Marioneta?',
        options: [
          {
            label: 'Entregar paquete y combatir',
            nextNodeId: 'node_clara_deliver',
            effects: [
              { completeQuest: 'main_2_package' },
              { startQuest: 'main_3_forest_boss' },
            ],
          },
          {
            label: 'Saludar',
            nextNodeId: 'node_clara_chat',
          },
        ],
      },
      node_clara_deliver: {
        id: 'node_clara_deliver',
        speakerName: 'Soultrainer Clara',
        speakerPaletteId: 'lass',
        text: 'Muchísimas gracias. Toma esta recompensa. Y ahora que tienes tu primera Souldoll... vamos a medir nuestra sincronía en un combate.',
      },
      node_clara_chat: {
        id: 'node_clara_chat',
        speakerName: 'Soultrainer Clara',
        speakerPaletteId: 'lass',
        text: 'Combatir junto a tus Souldolls en las rutas es la mejor forma de elevar su Sincronía.',
      },
    },
  },

  // --- MÍA (Aldea Marioneta - Cazador de Almas) ---
  mia_dialogue: {
    id: 'mia_dialogue',
    startNodeId: 'node_mia_start',
    nodes: {
      node_mia_start: {
        id: 'node_mia_start',
        speakerName: 'Mía',
        speakerPaletteId: 'lass',
        text: '¿Has probado a sellar almas errantes en la hierba alta con tus Soul Bottles?',
        options: [
          {
            label: 'Aceptar misión "Cazador de almas"',
            nextNodeId: 'node_mia_accept',
            effects: [{ startQuest: 'side_novice_hunter' }],
          },
          {
            label: 'Entregar misión (3 almas)',
            nextNodeId: 'node_mia_check',
            effects: [{ completeQuest: 'side_novice_hunter' }],
          },
        ],
      },
      node_mia_accept: {
        id: 'node_mia_accept',
        speakerName: 'Mía',
        speakerPaletteId: 'lass',
        text: 'Genial. Sella al menos 3 almas en la hierba alta y te regalaré un lote de 10 Soul Bottles comunes.',
      },
      node_mia_check: {
        id: 'node_mia_check',
        speakerName: 'Mía',
        speakerPaletteId: 'lass',
        text: 'Qué gran destreza. Sigue ampliando tu Códice de Almas.',
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
        text: 'Has cruzado el bosque y alcanzado la Grieta de Ki. ¿Estás preparado para la prueba final de resonancia?',
        options: [
          {
            label: 'Acepto el desafío',
            nextNodeId: 'node_guard_accept',
            effects: [{ completeQuest: 'main_3_forest_boss' }],
          },
          {
            label: 'Necesito prepararme más',
            nextNodeId: 'node_guard_wait',
          },
        ],
      },
      node_guard_accept: {
        id: 'node_guard_accept',
        speakerName: 'Guardián del Eco',
        speakerPaletteId: 'professor',
        text: 'Admirable determinación. Has demostrado ser digno del Sello del Eco del Gremio de Artífices.',
      },
      node_guard_wait: {
        id: 'node_guard_wait',
        speakerName: 'Guardián del Eco',
        speakerPaletteId: 'professor',
        text: 'La prudencia honra a los grandes Soultrainers. Regresa cuando tus Souldolls estén listas.',
      },
    },
  },
};
