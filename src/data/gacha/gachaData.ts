import {
  BodyPiece,
  TechniqueScroll,
  GachaTable,
  GachaConfigData,
} from '../../types/gacha';
import gachaConfigRaw from '../config/gacha.json';

export const GACHA_CONFIG: GachaConfigData = {
  piecesRequired: gachaConfigRaw.piecesRequired,
  useSaveSalt: gachaConfigRaw.useSaveSalt,
  redeemPolicy: gachaConfigRaw.redeemPolicy as GachaConfigData['redeemPolicy'],
  cooldownHours: gachaConfigRaw.cooldownHours,
  dailyRedeemLimit: gachaConfigRaw.dailyRedeemLimit,
  duplicateScrollPolicy: gachaConfigRaw.duplicateScrollPolicy as GachaConfigData['duplicateScrollPolicy'],
  duplicateScrollKiDustYield: gachaConfigRaw.duplicateScrollKiDustYield,
  defaultTableId: gachaConfigRaw.defaultTableId,
  brilliantTableId: gachaConfigRaw.brilliantTableId,
};

export const BODY_PIECES_DATA: Record<string, BodyPiece> = {
  piece_madera_t1: {
    id: 'piece_madera_t1',
    name: 'Pieza de Cuerpo de Madera',
    chassisId: 'chassis_madera_t1',
    rarity: 'common',
    description: 'Sección tallada en roble común. Reúne 5 piezas para ensamblar un Cuerpo de Madera completo.',
  },
  piece_madera_reforzada_t2: {
    id: 'piece_madera_reforzada_t2',
    name: 'Pieza de Madera Reforzada',
    chassisId: 'chassis_madera_reforzada_t2',
    rarity: 'uncommon',
    description: 'Componente de madera noble con herrajes de bronce. Reúne 5 piezas para ensamblar un chasis Tier 2.',
  },
  piece_hierro_forjado_t2: {
    id: 'piece_hierro_forjado_t2',
    name: 'Pieza de Hierro Forjado',
    chassisId: 'chassis_hierro_forjado_t2',
    rarity: 'uncommon',
    description: 'Placa articulada de hierro fundido. Reúne 5 piezas para ensamblar un chasis Hierro Forjado Tier 2.',
  },
  piece_berserker_t3: {
    id: 'piece_berserker_t3',
    name: 'Pieza de Chasis Berserker',
    chassisId: 'chassis_berserker_t3',
    rarity: 'rare',
    description: 'Engranaje de asalto marcial. Reúne 5 piezas para ensamblar un Chasis Berserker Tier 3.',
  },
  piece_acrobata_t3: {
    id: 'piece_acrobata_t3',
    name: 'Pieza de Chasis Acróbata',
    chassisId: 'chassis_acrobata_t3',
    rarity: 'rare',
    description: 'Articulación ultraligera de precisión. Reúne 5 piezas para ensamblar un Chasis Acróbata Tier 3.',
  },
  piece_guardian_piedra_t3: {
    id: 'piece_guardian_piedra_t3',
    name: 'Pieza de Guardián de Piedra',
    chassisId: 'chassis_guardian_piedra_t3',
    rarity: 'rare',
    description: 'Núcleo de granito grabado con runas. Reúne 5 piezas para ensamblar un Guardián de Piedra Tier 3.',
  },
  piece_cristalino_t4: {
    id: 'piece_cristalino_t4',
    name: 'Pieza de Chasis Cristalino',
    chassisId: 'chassis_cristalino_t4',
    rarity: 'epic',
    description: 'Prisma de cuarzo resonante. Reúne 5 piezas para ensamblar un Chasis Cristalino Tier 4.',
  },
  piece_arcano_t5: {
    id: 'piece_arcano_t5',
    name: 'Pieza de Chasis Arcano',
    chassisId: 'chassis_arcano_t5',
    rarity: 'epic',
    description: 'Aleación viva de los antiguos Artífices. Reúne 5 piezas para ensamblar un Chasis Arcano Tier 5.',
  },
};

export const TECHNIQUE_SCROLLS_DATA: Record<string, TechniqueScroll> = {
  scroll_chispa_ignea: {
    id: 'scroll_chispa_ignea',
    name: 'Pergamino: Chispa Ígnea',
    moveId: 'chispa_ignea',
    rarity: 'common',
    compatibility: {
      classIds: ['maga', 'archimaga', 'bruja', 'hechicera'],
      types: ['Fuego'],
      tags: ['spell'],
    },
    price: 600,
    description: 'Pergamino de técnica de un solo uso. Enseña Chispa Ígnea a Souldolls afines al Fuego o conjuros.',
  },
  scroll_latigazo_ki: {
    id: 'scroll_latigazo_ki',
    name: 'Pergamino: Latigazo de Ki',
    moveId: 'latigazo_ki',
    rarity: 'common',
    compatibility: {
      classIds: ['sacerdotisa', 'hierofante', 'monje', 'maestro_trueno'],
      types: ['Planta', 'Eléctrico'],
    },
    price: 600,
    description: 'Pergamino de técnica de un solo uso. Enseña Latigazo de Ki a Souldolls de Planta o canalización marcial.',
  },
  scroll_orbe_flamigero: {
    id: 'scroll_orbe_flamigero',
    name: 'Pergamino: Orbe Flamígero',
    moveId: 'orbe_flamigero',
    rarity: 'uncommon',
    compatibility: {
      classIds: ['maga', 'archimaga', 'bruja', 'hechicera'],
      types: ['Fuego'],
    },
    price: 1400,
    description: 'Pergamino arcano de un solo uso. Enseña Orbe Flamígero a clases mágicas o de elemento Fuego.',
  },
  scroll_pulso_arrecife: {
    id: 'scroll_pulso_arrecife',
    name: 'Pergamino: Pulso de Arrecife',
    moveId: 'pulso_arrecife',
    rarity: 'uncommon',
    compatibility: {
      classIds: ['hidromante', 'cantora_marea', 'sacerdotisa', 'hierofante'],
      types: ['Agua', 'Planta'],
    },
    price: 1400,
    description: 'Pergamino oceánico de un solo uso. Enseña Pulso de Arrecife a Souldolls de Agua o Planta.',
  },
  scroll_llamarada_arcana: {
    id: 'scroll_llamarada_arcana',
    name: 'Pergamino: Llamarada Arcana',
    moveId: 'llamarada_arcana',
    rarity: 'rare',
    compatibility: {
      classIds: ['maga', 'archimaga', 'hechicera'],
      types: ['Fuego'],
    },
    price: 2800,
    description: 'Pergamino de alto rango. Enseña Llamarada Arcana a Souldolls de Fuego o Hechiceras.',
  },
  scroll_impacto_telurico: {
    id: 'scroll_impacto_telurico',
    name: 'Pergamino: Impacto Telúrico',
    moveId: 'impacto_telurico',
    rarity: 'rare',
    compatibility: {
      classIds: ['paladin', 'templario', 'gladiadora', 'titanide', 'monje', 'maestro_trueno'],
      types: ['Tierra'],
    },
    price: 2800,
    description: 'Pergamino marcial pesado. Enseña Impacto Telúrico a clases acorazadas o de elemento Tierra.',
  },
  scroll_meteorito_ki: {
    id: 'scroll_meteorito_ki',
    name: 'Pergamino: Meteorito de Ki',
    moveId: 'meteorito_ki',
    rarity: 'epic',
    compatibility: {
      classIds: ['maga', 'archimaga', 'bruja', 'hechicera'],
      types: ['Fuego', 'Neutro'],
    },
    price: 5000,
    description: 'Reliquia escrita por antiguos Artífices. Enseña la técnica suprema Meteorito de Ki.',
  },
  scroll_juicio_sagrado: {
    id: 'scroll_juicio_sagrado',
    name: 'Pergamino: Juicio Sagrado',
    moveId: 'juicio_sagrado',
    rarity: 'epic',
    compatibility: {
      classIds: ['sacerdotisa', 'hierofante', 'paladin', 'templario', 'cantora_marea'],
      types: ['Planta', 'Tierra', 'Agua'],
    },
    price: 5000,
    description: 'Códice ancestral de un solo uso. Enseña Juicio Sagrado a clases devotas y guardianes.',
  },
};

export const GACHA_TABLES_DATA: Record<string, GachaTable> = (gachaConfigRaw as any).tables;
