import { MapData } from '../../types/maps';
import { TileType } from '../../types/tilesets';

/**
 * BLOQUE 35 Req. 2 & 3: Mapa interior del Laboratorio del Maestro Artífice (14x12).
 * Contiene los 7 objetos interactivos con interactLabel en datos:
 * 1. master_desk (x: 6..8, y: 2) - Escritorio del Maestro (interactLabel: "Hablar")
 * 2. starter_pedestal (x: 4..5, y: 5) - Mesa/pedestal de las 3 Soul Bottles iniciales (interactLabel: "Examinar")
 * 3. body_tube (x: 9..10, y: 4) - Tubo de cristal con el Cuerpo de Madera (interactLabel: "Examinar")
 * 4. codex_pedestal (x: 3, y: 3) - Pedestal del Códice de Almas (interactLabel: "Leer")
 * 5. anima_world_map (x: 2, y: 1) - Mapa mural de Anima (interactLabel: "Examinar")
 * 6. rift_diagram (x: 11, y: 1) - Diagrama de la Grieta (interactLabel: "Examinar", cambia tras el Guardián)
 * 7. soul_purifier (x: 11..12, y: 8) - Purificador de ki corrupto (interactLabel: "Examinar")
 */
const W = 14;
const H = 12;

const ground: TileType[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => 'interior_floor')
);
const decor: (string | null)[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => null)
);
const collision: boolean[][] = Array.from({ length: H }, () =>
  Array.from({ length: W }, () => false)
);

// 1. Muros perimetrales
for (let x = 0; x < W; x++) {
  decor[0][x] = 'wall';
  collision[0][x] = true;
  decor[H - 1][x] = 'wall';
  collision[H - 1][x] = true;
}
for (let y = 0; y < H; y++) {
  decor[y][0] = 'wall';
  collision[y][0] = true;
  decor[y][W - 1] = 'wall';
  collision[y][W - 1] = true;
}

// Puerta de salida sur en (7, 11) (y alfombra en 6..7)
collision[H - 1][7] = false;
decor[H - 1][7] = 'door';

// 2. Escritorio del Maestro Artífice (x: 6..8, y: 2)
for (let x = 6; x <= 8; x++) {
  decor[2][x] = 'counter';
  collision[2][x] = true;
}

// 3. Pedestal de Iniciales con 3 Soul Bottles (x: 4..5, y: 5)
decor[5][4] = 'starter_pedestal';
collision[5][4] = true;
decor[5][5] = 'starter_pedestal';
collision[5][5] = true;

// 4. Tubo de Cristal con Cuerpo de Madera (x: 9..10, y: 4)
decor[4][9] = 'body_tube';
collision[4][9] = true;
decor[4][10] = 'body_tube';
collision[4][10] = true;

// 5. Pedestal del Códice de Almas (x: 3, y: 3)
decor[3][3] = 'codex_pedestal';
collision[3][3] = true;

// 6. Mapa de Anima (x: 2, y: 1) y Estanterías (x: 3..4, y: 1)
decor[1][2] = 'anima_world_map';
collision[1][2] = true;
decor[1][3] = 'shelf';
collision[1][3] = true;
decor[1][4] = 'shelf';
collision[1][4] = true;

// 7. Diagrama de la Grieta (x: 11, y: 1) y Estanterías derechas (x: 9..10, y: 1)
decor[1][9] = 'shelf';
collision[1][9] = true;
decor[1][10] = 'shelf';
collision[1][10] = true;
decor[1][11] = 'rift_diagram';
collision[1][11] = true;

// 8. Purificador de Almas (x: 11..12, y: 8) y Banco de Marionetas (x: 1..2, y: 8)
decor[8][11] = 'soul_purifier';
collision[8][11] = true;
decor[8][12] = 'soul_purifier';
collision[8][12] = true;

decor[8][1] = 'puppet_workbench';
collision[8][1] = true;
decor[8][2] = 'puppet_workbench';
collision[8][2] = true;

export const INTERIOR_LAB_MAP: MapData = {
  id: 'interior_lab',
  name: 'Laboratorio del Maestro Artífice',
  category: 'interior',
  indoor: true,
  width: W,
  height: H,
  tileSize: 1,
  ground,
  decor,
  collision,
  signs: [
    // 1. Escritorio del Maestro (6..8, 2)
    {
      x: 6,
      y: 2,
      labInteractable: 'master_desk',
      interactLabel: 'Hablar',
      text: 'ESCRITORIO DEL MAESTRO ARTÍFICE\n"Planos de articulación esférica, tratados de resonancia y notas sobre el ki incoloro."',
    },
    {
      x: 7,
      y: 2,
      labInteractable: 'master_desk',
      interactLabel: 'Hablar',
      text: 'ESCRITORIO DEL MAESTRO ARTÍFICE\n"Planos de articulación esférica, tratados de resonancia y notas sobre el ki incoloro."',
    },
    {
      x: 8,
      y: 2,
      labInteractable: 'master_desk',
      interactLabel: 'Hablar',
      text: 'ESCRITORIO DEL MAESTRO ARTÍFICE\n"Planos de articulación esférica, tratados de resonancia y notas sobre el ki incoloro."',
    },
    // 2. Mesa/Pedestal de Iniciales (4..5, 5)
    {
      x: 4,
      y: 5,
      labInteractable: 'starter_pedestal',
      interactLabel: 'Examinar',
      text: 'PEDESTAL DE SOUL BOTTLES\n"Tres almas ancestrales aguardan en frascos de cristal: Maga (Fuego), Sacerdotisa (Planta) e Hidromante (Agua)."',
    },
    {
      x: 5,
      y: 5,
      labInteractable: 'starter_pedestal',
      interactLabel: 'Examinar',
      text: 'PEDESTAL DE SOUL BOTTLES\n"Tres almas ancestrales aguardan en frascos de cristal: Maga (Fuego), Sacerdotisa (Planta) e Hidromante (Agua)."',
    },
    // 3. Tubo de Cristal con Cuerpo de Madera (9..10, 4)
    {
      x: 9,
      y: 4,
      labInteractable: 'body_tube',
      interactLabel: 'Examinar',
      text: 'TUBO DE CONTENCIÓN DE CUERPO\n"Un Cuerpo de Madera de Tier 1 suspendido en conductos de ki, listo para recibir un alma."',
    },
    {
      x: 10,
      y: 4,
      labInteractable: 'body_tube',
      interactLabel: 'Examinar',
      text: 'TUBO DE CONTENCIÓN DE CUERPO\n"Un Cuerpo de Madera de Tier 1 suspendido en conductos de ki, listo para recibir un alma."',
    },
    // 4. Pedestal del Códice (3, 3)
    {
      x: 3,
      y: 3,
      labInteractable: 'codex_pedestal',
      interactLabel: 'Leer',
      text: 'PEDESTAL DEL CÓDICE DE ALMAS\n"Registro vivo del Gremio de Artífices con las 14 especies de almas y los 8 cuerpos contenedores de Anima."',
    },
    // 5. Mapa de Anima (2, 1)
    {
      x: 2,
      y: 1,
      labInteractable: 'anima_world_map',
      interactLabel: 'Examinar',
      text: 'MAPA DE ANIMA\n"Muestra la Aldea Marioneta al sur, el sendero sinuoso de Ruta Claro y el Bosque Eco que rodea la Cueva del Eco. Las marcas indican un aumento inusual de almas salvajes."',
    },
    // 6. Diagrama de la Grieta (11, 1)
    {
      x: 11,
      y: 1,
      labInteractable: 'rift_diagram',
      interactLabel: 'Examinar',
      text: 'DIAGRAMA DE LA GRIETA DE KI\n"Un grabado de la fractura espiritual en el fondo de la Cueva del Eco. Algo desde el otro lado está llamando a las almas."',
    },
    // 7. Purificador de Almas (11..12, 8)
    {
      x: 11,
      y: 8,
      labInteractable: 'soul_purifier',
      interactLabel: 'Examinar',
      text: 'PURIFICADOR DE RESONANCIA\n"Instrumento de bronce y cristal diseñado para disipar el ki corrupto acumulado en los núcleos de las Souldolls."',
    },
    {
      x: 12,
      y: 8,
      labInteractable: 'soul_purifier',
      interactLabel: 'Examinar',
      text: 'PURIFICADOR DE RESONANCIA\n"Instrumento de bronce y cristal diseñado para disipar el ki corrupto acumulado en los núcleos de las Souldolls."',
    },
  ],
  warps: [
    {
      x: 7,
      y: 11,
      targetMapId: 'villa_brote',
      targetX: 29,
      targetY: 8,
      targetDirection: 'down',
      interactLabel: 'Salir',
    },
  ],
  triggers: [
    {
      x: 7,
      y: 10,
      triggerId: 'lab_exit_guard',
    },
  ],
  npcs: [
    {
      id: 'npc_prof_roble_lab',
      name: 'Maestro Artífice',
      paletteId: 'professor',
      x: 7,
      y: 1,
      direction: 'down',
      interactLabel: 'Hablar',
      dialogueLines: [
        'Tu ki no tiene color, muchacho. Eso es raro… y un poco inquietante. Ven, que las muñecas ya hacen apuestas sobre ti.',
        'Recuerda la Regla de Oro de nuestro Gremio: una Souldoll nace al unir un Alma sellada en su Soul Bottle con un Cuerpo contenedor.',
        'Acércate al pedestal de piedra para elegir tu primera Soul Bottle (Maga, Sacerdotisa o Hidromante) y vincúlala al Cuerpo de Madera del tubo de cristal.',
      ],
    },
    {
      id: 'npc_rival_kael',
      name: 'Aprendiz Kael',
      paletteId: 'rival',
      x: 10,
      y: 6,
      direction: 'left',
      interactLabel: 'Hablar',
      dialogueLines: [
        'Así que tú eres el forastero del ki incoloro del que tanto habla el Maestro Artífice.',
        'Elige rápido tu Soul Bottle en el pedestal. Quiero comprobar en un combate real qué tan bien manejas las partes de tu Cuerpo de Madera.',
      ],
    },
  ],
  spawnPoints: {
    default: { x: 7, y: 10, direction: 'up' },
  },
  ambientMusic: 'lab',
  sunlightColor: 0xffe8b0,
  skyColor: 0x14101c,
};
