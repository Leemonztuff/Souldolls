import { GlobalEventBus } from '../core/EventBus';
import { GlobalQuestSystem } from '../systems/quest/QuestSystem';
import { GlobalSaveService } from '../services/SaveService';
import { SoulCodexSystem } from '../systems/SoulCodexSystem';
import { QUESTS_DATA } from '../data/quests/quests';
import { MAP_REGISTRY } from '../data/maps/worldGraph';
import { ITEMS_DATA } from '../data/items/items';
import { SOUL_SPECIES_DATA } from '../data/souldolls/souls';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

console.log('========================================');
console.log('🧪 SUITE DE TESTS: SISTEMA DE MISIONES (BLOQUE A5)');
console.log('========================================\n');

(GlobalSaveService as any).currentState = GlobalSaveService.createInitialState();
const state = GlobalSaveService.getCurrentState();
GlobalQuestSystem.ensureQuestsInitialized();

const npcIds = new Set<string>();
Object.values(MAP_REGISTRY).forEach((map) => map.npcs.forEach((npc) => npcIds.add(npc.id)));

Object.values(QUESTS_DATA).forEach((quest) => {
  assert(npcIds.has(quest.giverNpcId), `${quest.id}: giverNpcId inexistente "${quest.giverNpcId}"`);
  assert(npcIds.has(quest.turnInNpcId), `${quest.id}: turnInNpcId inexistente "${quest.turnInNpcId}"`);
  (quest.rewards.items || []).forEach((reward) => {
    assert(!!ITEMS_DATA[reward.itemId], `${quest.id}: recompensa inexistente "${reward.itemId}"`);
  });
  quest.objectives.forEach((objective) => {
    if (objective.type === 'catch_species' && objective.targetId) {
      assert(!!SOUL_SPECIES_DATA[objective.targetId], `${quest.id}: especie inexistente "${objective.targetId}"`);
    }
    if (objective.type === 'reach_map') {
      assert(!!MAP_REGISTRY[objective.targetId || ''], `${quest.id}: mapa inexistente "${objective.targetId}"`);
    }
    if (objective.type === 'talk_to' && objective.targetId) {
      assert(npcIds.has(objective.targetId), `${quest.id}: NPC inexistente "${objective.targetId}"`);
    }
    if (objective.type === 'collect_item' && objective.targetId) {
      assert(!!ITEMS_DATA[objective.targetId], `${quest.id}: ítem inexistente "${objective.targetId}"`);
    }
  });
});
console.log('✓ 1. Integridad de datos: NPCs, recompensas y objetivos de las misiones');

assert(
  GlobalQuestSystem.getQuestStatus('side_rare_bird') === 'available',
  'side_rare_bird debe quedar disponible tras inicializar'
);
GlobalQuestSystem.handleTalkToNpc('npc_citizen_vera');
assert(
  GlobalQuestSystem.getQuestStatus('side_rare_bird') === 'active',
  'hablar con el giver debe iniciar la misión'
);
GlobalQuestSystem.handleTalkToNpc('npc_mom');
assert(
  GlobalQuestSystem.getQuestStatus('side_novice_hunter') !== 'active',
  'hablar con un NPC que no es giver no debe iniciar misiones'
);
console.log('✓ 2. Aceptación automática al hablar con el NPC giver');

GlobalEventBus.emit('creature:caught', { speciesId: 'maga', level: 5 });
assert(
  (state.quests['side_rare_bird'].objectiveProgress['catch_bird'] || 0) === 0,
  'capturar una especie distinta no debe avanzar el objetivo'
);
GlobalEventBus.emit('creature:caught', { speciesId: 'espectro', level: 18 });
assert(
  (state.quests['side_rare_bird'].objectiveProgress['catch_bird'] || 0) === 1,
  'capturar la especie objetivo debe avanzar el objetivo'
);
assert(
  GlobalQuestSystem.getQuestStatus('side_rare_bird') === 'completable',
  'la misión debe quedar completable al cumplir el objetivo'
);
console.log('✓ 3. Capturas filtradas por targetId (catch_species)');

const moneyBefore = state.player.money;
GlobalQuestSystem.handleTalkToNpc('npc_citizen_vera');
assert(
  GlobalQuestSystem.getQuestStatus('side_rare_bird') === 'completed',
  'volver con el turnInNpcId debe completar la misión'
);
assert(state.player.money === moneyBefore + 1500, 'la recompensa en dinero debe entregarse');
assert((state.inventory['baya_arand'] || 0) === 5, 'los ítems de la recompensa deben entregarse');
console.log('✓ 4. Entrega de la misión y reparto de recompensas');

GlobalQuestSystem.handleTalkToNpc('npc_girl_mia');
assert(GlobalQuestSystem.getQuestStatus('side_novice_hunter') === 'active', 'side_novice_hunter activa');
GlobalEventBus.emit('creature:caught', { speciesId: 'bruja', level: 8 });
GlobalEventBus.emit('creature:caught', { speciesId: 'monje', level: 9 });
assert(
  GlobalQuestSystem.getQuestStatus('side_novice_hunter') === 'active',
  'dos capturas no deben completar un objetivo de tres'
);
GlobalEventBus.emit('creature:caught', { speciesId: 'hidromante', level: 7 });
assert(
  GlobalQuestSystem.getQuestStatus('side_novice_hunter') === 'completable',
  'objetivo sin targetId acepta cualquier especie'
);
console.log('✓ 5. Objetivo catch_species sin especie concreta (cualquier alma cuenta)');

GlobalQuestSystem.handleTalkToNpc('npc_shop_clerk');
assert(GlobalQuestSystem.getQuestStatus('side_collector') === 'active', 'side_collector activa con npc_shop_clerk');
[
  'maga',
  'sacerdotisa',
  'hidromante',
  'bruja',
  'monje',
  'asesina',
  'gladiadora',
  'espectro',
].forEach((speciesId) => SoulCodexSystem.markCaught(speciesId));
GlobalEventBus.emit('creature:caught', { speciesId: 'maga', level: 5 });
assert(
  (state.quests['side_collector'].objectiveProgress['dex_6'] || 0) >= 8,
  'el Códice de Almas debe avanzar el objetivo dex_count'
);
assert(
  GlobalQuestSystem.getQuestStatus('side_collector') === 'completable',
  'side_collector debe quedar completable con 8 almas registradas'
);
console.log('✓ 6. Objetivo dex_count a partir del Códice de Almas');

GlobalQuestSystem.advanceObjective('main_1_starter', 'talk_to_prof', 1);
GlobalQuestSystem.advanceObjective('main_1_starter', 'choose_starter', 1);
GlobalQuestSystem.handleTalkToNpc('npc_prof_roble_lab');
assert(
  GlobalQuestSystem.getQuestStatus('main_1_starter') === 'completed',
  'main_1_starter debe completarse con su turnInNpcId'
);
assert(
  GlobalQuestSystem.getQuestStatus('main_2_package') === 'available',
  'completar main_1 debe desbloquear main_2_package'
);
GlobalQuestSystem.handleTalkToNpc('npc_guide_leo');
assert(
  GlobalQuestSystem.getQuestStatus('main_2_package') === 'active',
  'main_2_package debe aceptarse hablando con su giver'
);
console.log('✓ 7. Cadena principal: desbloqueo y aceptación encadenada de misiones');

console.log('========================================');
console.log('✅ TODOS LOS TESTS DEL SISTEMA DE MISIONES HAN PASADO!');
console.log('========================================');
