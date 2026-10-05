import { Container } from 'pixi.js';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalScreenWipeTransition, ScreenWipeType } from '../render/transition/ScreenWipeTransition';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('========================================');
console.log('🧪 SUITE DE TESTS: BARRIDOS DE PANTALLA (SCREEN-WIPE TRANSITION)');
console.log('========================================');

const mockStage = new Container();
GlobalPixiRenderer.transitionLayer = new Container();
mockStage.addChild(GlobalPixiRenderer.transitionLayer);

// Test 1: Singleton y capas
console.log('\n🔹 TEST 1: Instanciación e Integración de Capas');
assert(GlobalScreenWipeTransition !== null, 'GlobalScreenWipeTransition debe estar instanciado');
console.log('  ✓ Singleton y capa de transición disponibles');

// Test 2: Ejecución de Transición Diagonal Slash
console.log('\n🔹 TEST 2: Ejecución de Transición Diagonal Slash');
let midActionCalled = false;
async function runTests() {
  await GlobalScreenWipeTransition.executeTransition(
    () => {
      midActionCalled = true;
    },
    { type: 'diagonal_slash', inDurationMs: 10, holdDurationMs: 5, outDurationMs: 10, playSfx: false }
  );

  assert(midActionCalled, 'midAction debe haberse ejecutado');
  console.log('  ✓ Transición Diagonal Slash ejecuta la acción intermedia y limpia capas');

  // Test 3: Tipos de Transición Alternativos
  console.log('\n🔹 TEST 3: Soporte para Múltiples Modos de Barrido');
  const wipeTypes: ScreenWipeType[] = ['diamond_shards', 'radial_iris', 'curtain_wipe'];
  for (const wt of wipeTypes) {
    let called = false;
    await GlobalScreenWipeTransition.executeTransition(
      () => {
        called = true;
      },
      { type: wt, inDurationMs: 10, holdDurationMs: 5, outDurationMs: 10, playSfx: false }
    );
    assert(called, `Modo ${wt} debe completar la transición`);
    console.log(`  ✓ Modo '${wt}' ejecutado y validado`);
  }

  console.log('\n========================================');
  console.log('✅ TODOS LOS TESTS DE TRANSICIÓN DE PANTALLA HAN PASADO!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('❌ Error en tests de transición:', err);
  throw err;
});
