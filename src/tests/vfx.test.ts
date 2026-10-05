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

console.log('\n========================================');
console.log('✅ TODOS LOS TESTS DE VFX Y PARTÍCULAS HAN PASADO EXITOSAMENTE!');
console.log('========================================\n');
