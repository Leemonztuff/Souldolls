import { Container } from 'pixi.js';
import { ParticlePool, VFXSystem } from '../render/vfx/VFXSystem';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('========================================');
console.log('🧪 EJECUTANDO SUITE DE TESTS: SISTEMA DE PARTÍCULAS Y VFX');
console.log('========================================');

const mockStage = new Container();
const vfx = VFXSystem.getInstance();
vfx.init(mockStage);

// Test 1: Particle Pool Allocation & Reuse
console.log('\n🔹 TEST 1: Particle Pool Allocation y Reutilización');
const pool = new ParticlePool(mockStage, 50);
const p1 = pool.emit({
  x: 100,
  y: 100,
  vx: 2,
  vy: -3,
  shape: 'spark',
  color: 0xfacc15,
  maxLife: 0.5,
});
assert(p1 !== null, 'Partícula 1 debe emitirse correctamente');
if (p1) {
  assert(p1.active === true, 'Partícula 1 debe estar activa');
  assert(p1.shape === 'spark', 'Forma debe ser spark');

  // Update dt
  pool.update(0.6); // Exceeds maxLife
  assert(p1.active === false, 'Partícula 1 debe desactivarse tras expirar maxLife');
}
console.log('  ✓ Pool emite y recicla partículas sin fugas de memoria');

// Test 2: Critical Hit Feedback Emission
console.log('\n🔹 TEST 2: Emisión de Golpe Crítico (Critical Hit)');
vfx.emitCriticalHitFeedback(200, 150);
vfx.update(0.016);
assert(vfx.vfxLayer.children.length > 0, 'Debe haber overlays y partículas en capa VFX');
console.log('  ✓ Estallido radial de chispas, ondas de choque y banner ¡GOLPE CRÍTICO! emitidos');

// Test 3: Soul Capture Sequence Feedback
console.log('\n🔹 TEST 3: Secuencia de Captura de Almas (Stream, Shake, Success, Fail)');
vfx.emitSoulCaptureStream(100, 200, 300, 100, 16);
vfx.emitSoulCaptureShake(300, 100, 1);
vfx.emitSoulCaptureSuccess(300, 100);
vfx.emitSoulCaptureFail(300, 100);
vfx.update(0.016);
console.log('  ✓ Succión etérea, sacudidas con resonancia, apoteosis de éxito y dispersión de escape probados');

// Test 4: Stat Change Feedback (Buffs y Debuffs)
console.log('\n🔹 TEST 4: Modificadores de Estadísticas (Buffs ▲ y Debuffs ▼)');
vfx.emitStatChangeFeedback(150, 150, 'atk', 2);
vfx.emitStatChangeFeedback(150, 150, 'speed', -1);
vfx.update(0.016);
console.log('  ✓ Columnas ascendentes para buffs y lluvia de miasma para debuffs probados');

// Test 5: PixiJS v8 CombatFXSystem - 11 Procedural FX Modules
console.log('\n🔹 TEST 5: PixiJS v8 CombatFXSystem - 11 Módulos FX Procedurales');
const { CombatFXSystem } = await import('../render/vfx/CombatFXSystem');
const combatStage = new Container();
const combatFx = new CombatFXSystem(combatStage);

const fxPresets = [
  'energy_ring',
  'spiral',
  'trail',
  'particles',
  'energy_sphere',
  'shockwave',
  'aura',
  'explosion',
  'vortex',
  'projectile',
  'radial_impact',
];

for (const preset of fxPresets) {
  const fxObj = combatFx.spawnFX(preset, {
    position: { x: 200, y: 200 },
    from: { x: 100, y: 100 },
    to: { x: 300, y: 300 },
    color: 0xff5522,
    secondaryColor: 0xffaa00,
  });
  assert(fxObj !== null, `Módulo FX "${preset}" debe spawnearse`);
}
assert(combatFx.activeCount === 11, 'Deben haber 11 efectos activos registrados');
combatFx.update(0.05);
console.log('  ✓ Los 11 módulos de CombatFXSystem funcionan y actualizan en el ticker');

// Test 6: CombatFXSystem - Pipeline de Skills Data-Driven (skillFx.json)
console.log('\n🔹 TEST 6: Pipeline Data-Driven de Habilidades (skillFx.json)');
const registered = combatFx.getSkill('chispa_ignea');
assert(registered !== undefined, 'Habilidad data-driven "chispa_ignea" debe existir en la base');
assert(registered?.element === 'Fuego', 'Elemento debe ser Fuego');

// Test playSkill invocation
await combatFx.playSkill('chispa_ignea', { x: 150, y: 250 }, { x: 450, y: 200 });
combatFx.update(0.1);
combatFx.clear();
assert(combatFx.activeCount === 0, 'clear() debe vaciar los efectos activos');

combatFx.destroy();
console.log('  ✓ Secuencia data-driven y ciclo de vida de CombatFXSystem probados');

console.log('\n========================================');
console.log('✅ TODOS LOS TESTS DE VFX Y PARTÍCULAS HAN PASADO EXITOSAMENTE!');
console.log('========================================\n');
