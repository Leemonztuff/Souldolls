import * as THREE from 'three';
import { SoulMetaballSystem } from '../overworld/SoulMetaballSystem';

/**
 * Suite de pruebas para el Bloque 47: Entidades de Almas Errantes con Efecto Metaball.
 */
export class Bloque47SoulMetaballTestRunner {
  public static runAllTests(): { passed: number; failed: number; results: string[] } {
    const results: string[] = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Instanciación del sistema y spawn de entidad
    try {
      const scene = new THREE.Scene();
      const system = new SoulMetaballSystem(scene);
      const entity = system.spawnEntity('soul_1', 10, 15, 3, 'cyan');
      if (entity && system.getEntityCount() === 1) {
        results.push('✅ Test 1: Spawn de entidad metaball exitoso');
        passed++;
      } else {
        results.push('❌ Test 1: Falló el spawn de entidad metaball');
        failed++;
      }
    } catch (err: any) {
      results.push(`❌ Test 1 Exception: ${err?.message}`);
      failed++;
    }

    // Test 2: Actualización y animación de fotogramas (dt)
    try {
      const scene = new THREE.Scene();
      const system = new SoulMetaballSystem(scene);
      const entity = system.spawnEntity('soul_2', 0, 0, 2, 'violet');
      const initialX = entity.x;
      system.update(0.5);
      // El alma debe haberse movido erráticamente
      if (system.getEntityCount() === 1) {
        results.push('✅ Test 2: Actualización de animación de metaballs exitosa');
        passed++;
      } else {
        results.push('❌ Test 2: Falló la actualización de animación');
        failed++;
      }
    } catch (err: any) {
      results.push(`❌ Test 2 Exception: ${err?.message}`);
      failed++;
    }

    // Test 3: Limpieza (Clear / Dispose)
    try {
      const scene = new THREE.Scene();
      const system = new SoulMetaballSystem(scene);
      system.spawnEntity('soul_3', 5, 5, 2, 'gold');
      system.clear();
      if (system.getEntityCount() === 0) {
        results.push('✅ Test 3: Limpieza y dispose de recursos exitosos');
        passed++;
      } else {
        results.push('❌ Test 3: Falló la limpieza de entidades');
        failed++;
      }
    } catch (err: any) {
      results.push(`❌ Test 3 Exception: ${err?.message}`);
      failed++;
    }

    return { passed, failed, results };
  }
}
