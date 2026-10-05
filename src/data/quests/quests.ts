import { QuestData } from '../../types/quests';

export const QUESTS_DATA: Record<string, QuestData> = {
  main_1_starter: {
    id: 'main_1_starter',
    title: 'El ki sin color',
    category: 'main',
    giverNpcId: 'npc_guide_leo',
    turnInNpcId: 'npc_prof_roble_lab',
    summary: 'Habla con el Maestro Artífice en el Laboratorio para vincular tu primera alma y cuerpo.',
    description:
      'Despertaste cerca de la Aldea Marioneta sin recuerdos. El Maestro Artífice notó que tu ki "no tiene ningún color" fijo, lo que te permite resonar con cualquier alma de Anima.',
    objectives: [
      {
        id: 'talk_to_prof',
        type: 'talk_to',
        description: 'Habla con el Maestro Artífice en su laboratorio.',
        targetId: 'npc_prof_roble_lab',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
      {
        id: 'choose_starter',
        type: 'talk_to',
        description: 'Elige tu Soul Bottle inicial (Maga, Sacerdotisa o Hidromante) y colócala en un Cuerpo de Madera.',
        targetId: 'npc_prof_roble_lab',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 500,
      items: [
        { itemId: 'elixir_ki', count: 5 },
        { itemId: 'soul_bottle_comun', count: 5 },
      ],
      message: '¡Has recibido tu primer frasco de alma, un Cuerpo de Madera y $500!',
    },
  },

  main_2_package: {
    id: 'main_2_package',
    title: 'Camino a Ruta Claro',
    category: 'main',
    giverNpcId: 'npc_guide_leo',
    turnInNpcId: 'npc_trainer_clara',
    summary: 'Avanza por Ruta Claro y entrega el paquete de piezas a Chica Clara.',
    description:
      'Guía Leo te ha pedido que lleves un paquete de piezas de articulación a la Soultrainer Clara en los senderos de Ruta Claro.',
    unlockConditions: {
      requiredCompletedQuests: ['main_1_starter'],
    },
    objectives: [
      {
        id: 'reach_route_1',
        type: 'reach_map',
        description: 'Viaja hacia el norte por Ruta Claro.',
        targetId: 'ruta_claro',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
      {
        id: 'deliver_package',
        type: 'talk_to',
        description: 'Encuentra y desafía a Chica Clara.',
        targetId: 'npc_trainer_clara',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 1000,
      items: [
        { itemId: 'elixir_ki_mayor', count: 3 },
        { itemId: 'purga_ki', count: 3 },
      ],
      message: '¡Clara te agradece la entrega con $1000, Elixires y Purgas de Ki!',
    },
  },

  main_3_forest_boss: {
    id: 'main_3_forest_boss',
    title: 'El eco del bosque',
    category: 'main',
    giverNpcId: 'npc_hiker_marcos',
    turnInNpcId: 'npc_boss_guardian',
    summary: 'Explora el Bosque Eco y desafía al Guardián en la Grieta de Ki de la Cueva.',
    description:
      'Las almas salvajes están aumentando debido a una fuerte resonancia en la Cueva del Eco. Llega al fondo de la caverna y estabiliza la Grieta de Ki.',
    unlockConditions: {
      requiredCompletedQuests: ['main_2_package'],
    },
    objectives: [
      {
        id: 'reach_forest',
        type: 'reach_map',
        description: 'Adéntrate en el Bosque Eco.',
        targetId: 'bosque_eco',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
      {
        id: 'defeat_guardian',
        type: 'talk_to',
        description: 'Derrota al Guardián del Eco junto a la Grieta de Ki.',
        targetId: 'npc_boss_guardian',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 2500,
      items: [
        { itemId: 'sello_eco', count: 1 },
        { itemId: 'soul_bottle_plata', count: 5 },
        { itemId: 'reencarnacion', count: 2 },
      ],
      message: '¡Has obtenido el Sello del Gremio del Eco y $2500!',
    },
  },

  side_novice_hunter: {
    id: 'side_novice_hunter',
    title: 'Cazador de almas',
    category: 'side',
    giverNpcId: 'npc_girl_mia',
    turnInNpcId: 'npc_girl_mia',
    summary: 'Atrapa 3 almas distintas con Soul Bottles.',
    description:
      'Mía quiere comprobar la atracción de tu ki. Sal a la maleza y captura al menos 3 almas con Soul Bottles.',
    objectives: [
      {
        id: 'catch_3',
        type: 'catch_species',
        description: 'Atrapa almas errantes en la hierba alta.',
        requiredCount: 3,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 600,
      items: [{ itemId: 'soul_bottle_comun', count: 10 }],
      message: '¡Mía te premia con 10 Soul Bottles Comunes y $600!',
    },
  },

  side_nurse_aid: {
    id: 'side_nurse_aid',
    title: 'Reparaciones urgentes',
    category: 'side',
    giverNpcId: 'npc_nurse_joy',
    turnInNpcId: 'npc_nurse_joy',
    summary: 'Lleva un Kit de reparación al Taller de Artífices.',
    description:
      'El Artífice del Taller necesita herramientas para mantener los chasis y reparar la durabilidad de las partes dañadas.',
    objectives: [
      {
        id: 'talk_joy',
        type: 'talk_to',
        description: 'Habla con la Artífice en el Taller.',
        targetId: 'npc_nurse_joy',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 400,
      items: [
        { itemId: 'kit_reparacion', count: 2 },
        { itemId: 'purga_ki', count: 3 },
      ],
      message: '¡El Taller te entrega Kits de reparación y $400!',
    },
  },

  side_collector: {
    id: 'side_collector',
    title: 'Coleccionista de almas',
    category: 'side',
    giverNpcId: 'npc_clerk_outdoor',
    turnInNpcId: 'npc_clerk_outdoor',
    summary: 'Registra al menos 8 almas en tu Códice de Almas.',
    description:
      'El mercader del Mercado está impresionado con la diversidad de almas en Anima. Te recompensará si registras 8 almas distintas.',
    objectives: [
      {
        id: 'dex_6',
        type: 'dex_count',
        description: 'Registra almas en el Códice de Almas.',
        requiredCount: 8,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 1200,
      items: [
        { itemId: 'soul_bottle_plata', count: 3 },
        { itemId: 'reencarnacion', count: 1 },
      ],
      message: '¡Has recibido 3 Soul Bottles de Plata, 1 Reencarnación y $1200!',
    },
  },

  side_perfect_body: {
    id: 'side_perfect_body',
    title: 'El cuerpo perfecto',
    category: 'side',
    giverNpcId: 'npc_explorer_alicia',
    turnInNpcId: 'npc_explorer_alicia',
    summary: 'Obtén un Chasis de Tier 3 o superior y vincula una Souldoll a él.',
    description:
      'Las almas de mayor poder requieren contenedores más resistentes. Consigue un chasis de Tier 3 o superior en el Taller o como botín.',
    objectives: [
      {
        id: 'tier_3_body',
        type: 'talk_to',
        description: 'Posee y vincula una Souldoll a un Chasis Tier 3.',
        targetId: 'npc_explorer_alicia',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 2000,
      items: [{ itemId: 'nucleo_resonancia', count: 1 }],
      message: '¡Obtuviste 1 Núcleo de Resonancia y $2000 por forjar el cuerpo perfecto!',
    },
  },

  main_4_coastal_journey: {
    id: 'main_4_coastal_journey',
    title: 'El susurro del océano',
    category: 'main',
    giverNpcId: 'npc_guide_leo',
    turnInNpcId: 'npc_sailor_paco',
    summary: 'Viaja hacia el oeste hasta Puerto Marea y habla con el Marinero Paco.',
    description:
      'La costa oeste alberga Puerto Marea, un próspero enclave costero donde entrenadores marinos perfeccionan sus técnicas con criaturas acuáticas.',
    unlockConditions: {
      requiredCompletedQuests: ['main_3_forest_boss'],
    },
    objectives: [
      {
        id: 'reach_coastal',
        type: 'reach_map',
        description: 'Llega a la playa de Puerto Marea.',
        targetId: 'pueblo_costero',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
      {
        id: 'talk_paco',
        type: 'talk_to',
        description: 'Habla con el Marinero Paco en los muelles.',
        targetId: 'npc_sailor_paco',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 1500,
      items: [{ itemId: 'super_capsula', count: 5 }],
      message: '¡Paco te entrega 5 Súper Cápsulas para tu expedición marítima!',
    },
  },

  main_5_marine_gym: {
    id: 'main_5_marine_gym',
    title: 'Desafío en las olas',
    category: 'main',
    giverNpcId: 'npc_sailor_paco',
    turnInNpcId: 'npc_leader_marina',
    summary: 'Derrota a la Líder Marina en el Gimnasio de Puerto Marea para ganar la Medalla Marina.',
    description:
      'Marina comanda las corrientes marinas con su poderoso equipo acuático. Vence en su gimnasio para demostrar tu dominio.',
    unlockConditions: {
      requiredCompletedQuests: ['main_4_coastal_journey'],
    },
    objectives: [
      {
        id: 'defeat_marina',
        type: 'talk_to',
        description: 'Desafía y vence a la Líder Marina.',
        targetId: 'npc_leader_marina',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 3000,
      items: [
        { itemId: 'medalla_marina', count: 1 },
        { itemId: 'mt_rayo_hielo', count: 1 },
      ],
      message: '¡Has obtenido la oficial Medalla Marina y la MT Rayo Hielo!',
    },
  },

  main_6_climb_summit: {
    id: 'main_6_climb_summit',
    title: 'Hacia las altas cumbres',
    category: 'main',
    giverNpcId: 'npc_leader_marina',
    turnInNpcId: 'npc_guard_mountain',
    summary: 'Con la Medalla Marina, avanza hacia el norte por Ruta Claro hasta Ciudad Cumbre.',
    description:
      'La gran cordillera aguarda al norte de Ruta Claro. Ciudad Cumbre es el baluarte de los entrenadores de las alturas.',
    unlockConditions: {
      requiredCompletedQuests: ['main_5_marine_gym'],
    },
    objectives: [
      {
        id: 'reach_summit_city',
        type: 'reach_map',
        description: 'Cruza el norte de Ruta Claro y entra en Ciudad Cumbre.',
        targetId: 'ciudad_gimnasio',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
      {
        id: 'speak_guard',
        type: 'talk_to',
        description: 'Habla con el Guardia del Paso en Ciudad Cumbre.',
        targetId: 'npc_guard_mountain',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 2000,
      items: [{ itemId: 'max_pocion', count: 3 }],
      message: '¡El guardia te reconoce y te entrega 3 Pociones Máximas!',
    },
  },

  main_7_summit_gym: {
    id: 'main_7_summit_gym',
    title: 'Vencedor del viento',
    category: 'main',
    giverNpcId: 'npc_guard_mountain',
    turnInNpcId: 'npc_leader_ciro',
    summary: 'Supera el desafío del Gimnasio Cumbre y vence al Líder Ciro para obtener la Medalla Cúspide.',
    description:
      'Ciro es el maestro de las ráfagas y las criaturas aladas. Su aprobación es el requisito indispensable para ascender a la montaña.',
    unlockConditions: {
      requiredCompletedQuests: ['main_6_climb_summit'],
    },
    objectives: [
      {
        id: 'defeat_ciro',
        type: 'talk_to',
        description: 'Enfrenta al Líder Ciro en el Gimnasio Cumbre.',
        targetId: 'npc_leader_ciro',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 4500,
      items: [
        { itemId: 'medalla_cuspide', count: 1 },
        { itemId: 'mt_fuerza_lunar', count: 1 },
      ],
      message: '¡Has conquistado la Medalla Cúspide! El paso montañoso está ahora abierto.',
    },
  },

  main_8_mountain_pass: {
    id: 'main_8_mountain_pass',
    title: 'Paso por la ventisca',
    category: 'main',
    giverNpcId: 'npc_guard_mountain',
    turnInNpcId: 'npc_climber_bruno',
    summary: 'Asciende por la Ruta Escarpada superando los ventisqueros hacia el santuario de la cumbre.',
    description:
      'Las nieves perpetuas y los desfiladeros de la Ruta Escarpada pondrán a prueba la resistencia de tu equipo.',
    unlockConditions: {
      requiredCompletedQuests: ['main_7_summit_gym'],
    },
    objectives: [
      {
        id: 'reach_mountain',
        type: 'reach_map',
        description: 'Adéntrate en la Ruta Escarpada.',
        targetId: 'ruta_montana',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
      {
        id: 'talk_bruno',
        type: 'talk_to',
        description: 'Encuentra al Montañero Bruno en el campamento alpino.',
        targetId: 'npc_climber_bruno',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 3000,
      items: [{ itemId: 'ultra_capsula', count: 5 }],
      message: '¡Bruno te entrega 5 Ultra Cápsulas para la cumbre!',
    },
  },

  main_9_elite_four: {
    id: 'main_9_elite_four',
    title: 'El Torneo del Alto Mando',
    category: 'main',
    giverNpcId: 'npc_climber_bruno',
    turnInNpcId: 'npc_elite_valeria',
    summary: 'Alcanza la cima del mundo y desafía a la Campeona Valeria en la gran prueba final.',
    description:
      'La consagración definitiva como Campeón de la Región. Enfrenta a Valeria y su legendario Auroradon en la cumbre.',
    unlockConditions: {
      requiredCompletedQuests: ['main_8_mountain_pass'],
    },
    objectives: [
      {
        id: 'defeat_valeria',
        type: 'talk_to',
        description: 'Derrota a la Campeona Valeria en la Cumbre del Mundo.',
        targetId: 'npc_elite_valeria',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 10000,
      items: [
        { itemId: 'restaura_todo', count: 5 },
        { itemId: 'cinta_elegida', count: 1 },
      ],
      message: '¡HAS SIDO CORONADO CAMPEÓN DE LA REGIÓN! ¡ENHORABUENA!',
    },
  },

  side_rare_bird: {
    id: 'side_rare_bird',
    title: 'El halcón de las cumbres',
    category: 'side',
    giverNpcId: 'npc_citizen_vera',
    turnInNpcId: 'npc_citizen_vera',
    summary: 'Captura un ejemplar de la especie voladora Piropío o Plumaveloz.',
    description:
      'Vera desea estudiar las plumas aerodinámicas de las aves autóctonas de la cordillera.',
    objectives: [
      {
        id: 'catch_bird',
        type: 'catch_species',
        description: 'Captura a Piropío en la naturaleza.',
        targetId: 'piropio',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 1500,
      items: [{ itemId: 'baya_arand', count: 5 }],
      message: '¡Vera te regala 5 Bayas Arand por tu descubrimiento!',
    },
  },

  side_ice_specimen: {
    id: 'side_ice_specimen',
    title: 'Glaciología aplicada',
    category: 'side',
    giverNpcId: 'npc_expert_dario',
    turnInNpcId: 'npc_expert_dario',
    summary: 'Captura una criatura de hielo (Escarchín) para investigación.',
    description:
      'Darío estudia la adaptación biológica al frío extremo en los ecosistemas de altura.',
    objectives: [
      {
        id: 'catch_ice',
        type: 'catch_species',
        description: 'Captura a Escarchín en la Ruta Escarpada.',
        targetId: 'escarchin',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 2000,
      items: [{ itemId: 'piedra_evolutiva', count: 1 }],
      message: '¡Darío te premia con una preciada Piedra Evolutiva!',
    },
  },

  side_expert_dex: {
    id: 'side_expert_dex',
    title: 'Gran Enciclopedia',
    category: 'side',
    giverNpcId: 'npc_prof_roble_lab',
    turnInNpcId: 'npc_prof_roble_lab',
    summary: 'Registra al menos 15 criaturas diferentes en la Pokédex.',
    description:
      'El Prof. Roble te desafía a registrar más de la mitad del catálogo regional de especies.',
    objectives: [
      {
        id: 'dex_15',
        type: 'dex_count',
        description: 'Registra 15 especies en tu Pokédex.',
        requiredCount: 15,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 5000,
      items: [{ itemId: 'ultra_capsula', count: 10 }],
      message: '¡El Prof. Roble te recompensa con 10 Ultra Cápsulas y $5000!',
    },
  },

  // -------------------------------------------------------------
  // BLOQUE 28A: MISIONES DE FRAGMENTOS DE ALMA, ENSAMBLAJE Y PERGAMINOS
  // -------------------------------------------------------------
  side_first_fragment: {
    id: 'side_first_fragment',
    title: 'Primer fragmento',
    category: 'side',
    giverNpcId: 'npc_prof_roble_lab',
    turnInNpcId: 'npc_prof_roble_lab',
    summary: 'Resuena 1 Fragmento de alma mediante un código QR para manifestar una reliquia o pieza.',
    description:
      'El Maestro Artífice ha descubierto que los Fragmentos de alma reaccionan ante patrones rúnicos (códigos QR). Utiliza 1 Fragmento de alma para comprobar la resonancia.',
    objectives: [
      {
        id: 'use_fragment_1',
        type: 'use_fragment',
        description: 'Usa 1 Fragmento de alma en el resonador de códigos.',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 800,
      items: [
        { itemId: 'soul_fragment', count: 3 },
        { itemId: 'soul_fragment_brilliant', count: 1 },
      ],
      message: '¡Has completado "Primer fragmento" y recibido 3 Fragmentos de Alma y 1 Fragmento Brillante!',
    },
  },

  side_body_assembler: {
    id: 'side_body_assembler',
    title: 'Ensamblador',
    category: 'side',
    giverNpcId: 'npc_nurse_joy',
    turnInNpcId: 'npc_nurse_joy',
    summary: 'Reúne 5 piezas del mismo chasis y fabrica un cuerpo completo por piezas.',
    description:
      'Al acumular 5 piezas idénticas de chasis mediante resonancia de fragmentos, los mecanismos se ensamblan automáticamente en un Cuerpo contenedor nuevo con calidades (IVs) propias.',
    objectives: [
      {
        id: 'assemble_body_1',
        type: 'assemble_body',
        description: 'Fabrica 1 cuerpo contenedor completo reuniendo 5 piezas.',
        requiredCount: 1,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 1500,
      items: [
        { itemId: 'kit_reparacion', count: 3 },
        { itemId: 'soul_fragment', count: 2 },
      ],
      message: '¡Has completado "Ensamblador" y recibido 3 Kits de Reparación, 2 Fragmentos y $1500!',
    },
  },

  side_scroll_master: {
    id: 'side_scroll_master',
    title: 'Maestro de técnicas',
    category: 'side',
    giverNpcId: 'npc_prof_roble_lab',
    turnInNpcId: 'npc_prof_roble_lab',
    summary: 'Enseña 3 movimientos a tus Souldolls utilizando Pergaminos de técnica.',
    description:
      'Los Pergaminos obtenidos en resonancias contienen técnicas ancestrales de un solo uso. Úsalos sobre Souldolls compatibles de tu equipo para transmitirles su conocimiento.',
    objectives: [
      {
        id: 'learn_scroll_3',
        type: 'learn_technique',
        description: 'Aprende 3 movimientos usando Pergaminos de técnica.',
        requiredCount: 3,
        currentCount: 0,
        isCompleted: false,
      },
    ],
    rewards: {
      money: 2500,
      items: [
        { itemId: 'soul_fragment_brilliant', count: 2 },
        { itemId: 'nucleo_resonancia', count: 1 },
      ],
      message: '¡Has completado "Maestro de técnicas" y recibido 2 Fragmentos Brillantes y 1 Núcleo de Resonancia!',
    },
  },
};
