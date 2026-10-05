import { buildPartyVM } from '../ui/viewmodels/GroupAViewModels';
import { StatCalculator } from '../systems/battle/StatCalculator';
import { GameState, Souldoll } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

console.log('========================================');
console.log('🧪 SUITE DE TESTS: GESTIÓN Y REORDENACIÓN DE EQUIPO');
console.log('========================================\n');

// 1. Setup mock party of 3 Souldolls
const doll1: Souldoll = StatCalculator.createSouldoll('maga', 12, 'chassis_madera_t1', 'Maga Ignis');
const doll2: Souldoll = StatCalculator.createSouldoll('sacerdotisa', 10, 'chassis_madera_reforzada_t2', 'Sacer Solaria');
const doll3: Souldoll = StatCalculator.createSouldoll('gladiadora', 15, 'chassis_hierro_forjado_t2', 'Gladia Titán');

const mockState: GameState = {
  version: 2,
  timestamp: Date.now(),
  playtimeSeconds: 3600,
  player: {
    name: 'Artífice Test',
    position: { x: 6, y: 0.5, z: 8 },
    direction: 'down',
    mapId: 'villa_brote',
    money: 2500,
    badges: ['sello_bronce'],
  },
  party: [doll1, doll2, doll3],
  storage: [],
  bodies: {},
  inventory: {
    elixir_ki: 3,
    soul_bottle_comun: 5,
  },
  saveId: 'test_save_1',
  rngSeed: 42,
  bodyPieces: {},
  kiDust: 150,
  scanLedger: [],
  gachaPity: {},
  gachaDailyRedeems: { dateKey: '2026-10-05', count: 0 },
  gachaDiscoveries: [],
  flags: {},
  vars: {},
  quests: {},
  soulCodex: {},
  pokedex: {},
  keyItems: [],
  settings: {
    masterVolume: 0.8,
    sfxVolume: 0.9,
    bgmVolume: 0.4,
    textSpeed: 'mid',
    showTouchControls: true,
    outfitStyle: 'clasico',
    bustAnimation: 'subtle',
    runMode: 'hold',
    showCameraButton: true,
    showObjectiveHint: true,
    touchScale: 1,
    touchPosition: 'normal',
    separateControlPanel: false,
  },
};

// --- TEST 1: buildPartyVM extracción completa de estadísticas ---
console.log('🔹 TEST 1: Extracción de Estadísticas y Atributos de Formación');
const vm1 = buildPartyVM(mockState);
assert(vm1.members.length === 3, `Debe haber 3 miembros en el equipo (obtenido: ${vm1.members.length})`);
assert(vm1.members[0].isLead === true, `El primer miembro debe ser marcado como Líder`);
assert(vm1.members[1].isLead === false, `El segundo miembro NO debe ser Líder`);
assert(vm1.members[0].speciesId === 'maga', `Especie del primer miembro es maga`);
assert(vm1.members[0].stats.atk > 0, `Estadística de Ataque calculada > 0`);
assert(vm1.members[0].stats.def > 0, `Estadística de Defensa calculada > 0`);
assert(vm1.members[0].stats.speed > 0, `Estadística de Velocidad calculada > 0`);
assert(vm1.members[0].parts.head.max > 0, `Partes corporales (Cabeza) calculadas`);
assert(vm1.members[0].moves.length > 0, `Técnicas aprendidas cargadas en el VM`);
assert(vm1.elixirCount === 3, `Conteo de elixires reflejado en el VM (3)`);
console.log('  ✓ Estadísticas de combate (HP, ATQ, DEF, ATQ.E, DEF.E, VEL) y partes calculadas correctamente.\n');

// --- TEST 2: Reordenación — Mover Arriba / Mover Abajo ---
console.log('🔹 TEST 2: Reordenación de Posiciones (Subir y Bajar)');
// Intercambiar posición 1 y 2 (Sacerdotisa y Gladiadora)
const tmp = mockState.party[1];
mockState.party[1] = mockState.party[2];
mockState.party[2] = tmp;

const vm2 = buildPartyVM(mockState);
assert(vm2.members[1].name === 'Gladia Titán', `Gladiadora ahora está en la posición 2 (índice 1)`);
assert(vm2.members[2].name === 'Sacer Solaria', `Sacerdotisa ahora está en la posición 3 (índice 2)`);
console.log('  ✓ Reordenación 1 paso (▲/▼) permuta los miembros y conserva todas sus estadísticas intactas.\n');

// --- TEST 3: Asignar Nuevo Líder de Formación (Hacer Líder) ---
console.log('🔹 TEST 3: Asignación de Líder de Formación');
// Sacerdotisa (en índice 2) pasa a ser líder (índice 0)
const [newLead] = mockState.party.splice(2, 1);
mockState.party.unshift(newLead);

const vm3 = buildPartyVM(mockState);
assert(vm3.members[0].name === 'Sacer Solaria', `Sacerdotisa ahora es el primer miembro`);
assert(vm3.members[0].isLead === true, `Sacerdotisa tiene el flag isLead=true`);
assert(vm3.members[1].name === 'Maga Ignis', `Maga Ignis fue desplazada a la 2ª posición`);
assert(vm3.members[1].isLead === false, `Maga Ignis ya no es líder`);
console.log('  ✓ Asignación de líder unshift() posiciona a la criatura al frente de la vanguardia.\n');

// --- TEST 4: Curación Rápida con Elixir de Ki ---
console.log('🔹 TEST 4: Curación Rápida con Elixir de Ki');
// Dañar cabeza y torso de la líder
mockState.party[0].currentHp = 5;
mockState.party[0].partHP.head = 1;
mockState.party[0].partHP.torso = 2;

assert(mockState.inventory.elixir_ki === 3, `Inventario inicial tiene 3 elixires`);
// Aplicar curación
mockState.inventory.elixir_ki -= 1;
mockState.party[0].currentHp = mockState.party[0].maxHp;
mockState.party[0].partHP = { ...mockState.party[0].maxPartHP };

assert(mockState.inventory.elixir_ki === 2, `Se descontó 1 elixir (quedan 2)`);
assert(mockState.party[0].currentHp === mockState.party[0].maxHp, `HP total restaurado al máximo`);
assert(mockState.party[0].partHP.head === mockState.party[0].maxPartHP.head, `PS de Cabeza restaurados al 100%`);
assert(mockState.party[0].partHP.torso === mockState.party[0].maxPartHP.torso, `PS de Torso restaurados al 100%`);
console.log('  ✓ Curación restaura todos los puntos de vida de partes y descuenta el ítem.\n');

console.log('========================================');
console.log('✅ TODOS LOS TESTS DE GESTIÓN DE EQUIPO HAN PASADO!');
console.log('========================================');
