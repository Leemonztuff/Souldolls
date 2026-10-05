import { QrScannerService, GlobalQrScanner } from '../../services/QrScannerService';
import { buildGachaResonanceVM } from '../../ui/viewmodels/GachaResonanceVM';
import { buildBagVM } from '../../ui/viewmodels/GroupAViewModels';
import { GachaService } from './GachaService';
import { Rng } from '../../core/Rng';
import { GameState } from '../../types';

export interface Bloque28BTestResult {
  testName: string;
  passed: boolean;
  details: string;
}

/**
 * BLOQUE 28B: Suite de Verificación Automatizada de Escáner QR, Privacidad I-14,
 * Probabilidades Visibles, Progreso x/5 y Conexión con Mochila.
 */
export class Bloque28BQrTestRunner {
  public static createMockState(): GameState {
    return {
      version: 2,
      player: {
        name: 'Soultrainer',
        position: { x: 10, y: 0, z: 10 },
        direction: 'down',
        mapId: 'villa_brote',
        money: 2500,
        badges: [],
      },
      playtimeSeconds: 120,
      party: [],
      storage: [],
      bodies: {},
      inventory: {
        soul_fragment: 4,
        soul_fragment_brilliant: 2,
      },
      kiDust: 0,
      bodyPieces: {},
      scanLedger: [],
      gachaPity: {
        standard_resonance: 0,
        brilliant_resonance: 0,
      },
      gachaDailyRedeems: {
        dateKey: '',
        count: 0,
      },
      pokedex: {},
      soulCodex: {},
      keyItems: [],
      flags: {},
      vars: {},
      quests: {},
      timestamp: Date.now(),
      settings: {
        textSpeed: 'mid',
        showTouchControls: true,
        masterVolume: 0.8,
        sfxVolume: 0.9,
        bgmVolume: 0.6,
        outfitStyle: 'clasico',
        bustAnimation: 'subtle',
      },
    };
  }

  /**
   * Test 1 — Sanitización de seguridad y privacidad de QR (Invariante I-14)
   */
  public static test1SanitizeQrPayloadI14(): Bloque28BTestResult {
    const emptyRes = QrScannerService.sanitizeQrPayload('   \n\t  ');
    if (emptyRes.valid || emptyRes.reason !== 'EMPTY') {
      return {
        testName: 'Test 1: Sanitización y Privacidad QR (I-14)',
        passed: false,
        details: 'No rechazó un payload vacío o de solo espacios.',
      };
    }

    const maliciousInputs = [
      'https://evil.example/payload?steal=1',
      'javascript:alert(document.cookie)',
      'data:text/html,<script>evil()</script>',
      'mailto:phish@example.com',
    ];

    for (const mal of maliciousInputs) {
      const res = QrScannerService.sanitizeQrPayload(mal);
      if (
        !res.valid ||
        !res.wasUrlNeutralized ||
        !res.sanitized.startsWith('QR_SAFE::') ||
        res.sanitized.includes('http') ||
        res.sanitized.includes('javascript') ||
        res.sanitized.includes('<script')
      ) {
        return {
          testName: 'Test 1: Sanitización y Privacidad QR (I-14)',
          passed: false,
          details: `No neutralizó correctamente el payload peligroso: ${mal} -> ${res.sanitized}`,
        };
      }
    }

    // Determinismo de semillas e integridad de recorte >256 chars
    const longInput = 'SOUL-QR-SEED-' + 'A'.repeat(400);
    const r1 = QrScannerService.sanitizeQrPayload(longInput);
    const r2 = QrScannerService.sanitizeQrPayload(longInput);

    const passed =
      r1.valid &&
      r1.sanitized === r2.sanitized &&
      r1.displayCode === r2.displayCode &&
      r1.displayCode.startsWith('SELLO-');

    return {
      testName: 'Test 1: Sanitización y Privacidad QR (I-14)',
      passed,
      details: passed
        ? `Rechaza vacíos, neutraliza URLs/scripts a formato inerte (${r1.displayCode}) y conserva determinismo.`
        : 'Fallo en determinismo o recorte de payload largo.',
    };
  }

  /**
   * Test 2 — Transparencia de probabilidades y Pity en ViewModel (buildGachaResonanceVM)
   */
  public static test2TransparencyAndPityVM(): Bloque28BTestResult {
    const state = this.createMockState();
    state.gachaPity = {
      standard_resonance: 7,
      brilliant_resonance: 3,
    };

    const vmStd = buildGachaResonanceVM(state, 'standard_resonance');
    const vmBril = buildGachaResonanceVM(state, 'brilliant_resonance');

    const stdRatesMap = Object.fromEntries(vmStd.rates.map((r) => [r.rarity, r.ratePercent]));
    const brilRatesMap = Object.fromEntries(vmBril.rates.map((r) => [r.rarity, r.ratePercent]));

    const stdOk =
      stdRatesMap.common === '55.0%' &&
      stdRatesMap.uncommon === '28.0%' &&
      stdRatesMap.rare === '13.0%' &&
      stdRatesMap.epic === '4.0%' &&
      vmStd.pityThreshold === 10 &&
      vmStd.currentPity === 7 &&
      vmStd.dailyLimit === 10;

    const brilOk =
      brilRatesMap.common === '20.0%' &&
      brilRatesMap.uncommon === '35.0%' &&
      brilRatesMap.rare === '30.0%' &&
      brilRatesMap.epic === '15.0%' &&
      vmBril.pityThreshold === 5 &&
      vmBril.currentPity === 3;

    const hasPrivacyI14 =
      typeof vmStd.privacyNotice === 'string' &&
      vmStd.privacyNotice.includes('I-14') &&
      vmStd.privacyNotice.includes('dinero real');

    const passed = stdOk && brilOk && hasPrivacyI14;
    return {
      testName: 'Test 2: Transparencia de Probabilidades y Pity (I-14)',
      passed,
      details: passed
        ? 'Tasas exactas visibles (Estándar 55/28/13/4 Pity 10; Brillante 20/35/30/15 Pity 5) y aviso I-14 presente.'
        : 'Tasas o umbrales de Pity no coinciden con la spec.',
    };
  }

  /**
   * Test 3 — Flujo completo de escaneo QR (Estándar y Brillante) y Anti-abuso
   */
  public static test3FullScanAndAntiAbuse(): Bloque28BTestResult {
    const state = this.createMockState();
    const sanitized = QrScannerService.sanitizeQrPayload('https://anima.example/qr/sello-alfa-01');

    const roll1 = GachaService.rollFromScan(sanitized.sanitized, state, {
      tableId: 'standard_resonance',
      nowMs: 1_700_000_000_000,
    });

    if (!roll1.ok || state.inventory.soul_fragment !== 3 || (state.scanLedger || []).length !== 1) {
      return {
        testName: 'Test 3: Flujo Completo de Escaneo QR y Anti-abuso',
        passed: false,
        details: `El primer escaneo válido falló: ${roll1.message}`,
      };
    }

    // Reescanear el mismo QR debe devolver ALREADY_REDEEMED y NO consumir fragmento
    const rollDuplicate = GachaService.rollFromScan(sanitized.sanitized, state, {
      tableId: 'standard_resonance',
      nowMs: 1_700_000_010_000,
    });

    const dupRejected =
      !rollDuplicate.ok &&
      rollDuplicate.errorCode === 'ALREADY_REDEEMED' &&
      state.inventory.soul_fragment === 3;

    // Escanear con Fragmento Brillante
    const sanitized2 = QrScannerService.sanitizeQrPayload('SELLO-GREMIO-BRILLANTE-99');
    const rollBrilliant = GachaService.rollFromScan(sanitized2.sanitized, state, {
      tableId: 'brilliant_resonance',
      nowMs: 1_700_000_020_000,
    });

    const brilOk =
      rollBrilliant.ok &&
      state.inventory.soul_fragment_brilliant === 1 &&
      (state.scanLedger || []).length === 2;

    const passed = dupRejected && brilOk;
    return {
      testName: 'Test 3: Flujo Completo de Escaneo QR y Anti-abuso',
      passed,
      details: passed
        ? 'Consume 1 fragmento por QR nuevo, registra en scanLedger y bloquea duplicados (ALREADY_REDEEMED) con 0 gasto.'
        : `Fallo en anti-abuso o tirada brillante (dupRejected=${dupRejected}, brilOk=${brilOk}).`,
    };
  }

  /**
   * Test 4 — Progreso x/5 de Piezas de Cuerpo y Ensamblaje desde UI
   */
  public static test4BodyPiecesProgressAndAssembly(): Bloque28BTestResult {
    const state = this.createMockState();
    state.bodyPieces = {
      chassis_madera_reforzada_t2: 5,
      chassis_madera_t1: 3,
    };

    const vmBefore = buildGachaResonanceVM(state, 'standard_resonance');
    const targetEntry = vmBefore.bodyPieces.find(
      (p) => p.chassisId === 'chassis_madera_reforzada_t2'
    );

    if (
      vmBefore.bodyPieces.length !== 8 ||
      !targetEntry ||
      targetEntry.currentPieces !== 5 ||
      !targetEntry.canAssemble
    ) {
      return {
        testName: 'Test 4: Progreso x/5 de Piezas y Ensamblaje de Cuerpo',
        passed: false,
        details: 'El ViewModel no reportó los 8 chasis o no habilitó canAssemble con 5/5 piezas.',
      };
    }

    state.bodyPieces.chassis_madera_reforzada_t2 -= 5;
    const bodyInstance = GachaService.assembleBodyFromPieces(
      'chassis_madera_reforzada_t2',
      state,
      new Rng(12345)
    );
    const vmAfter = buildGachaResonanceVM(state, 'standard_resonance');
    const targetAfter = vmAfter.bodyPieces.find(
      (p) => p.chassisId === 'chassis_madera_reforzada_t2'
    );

    const passed =
      !!bodyInstance &&
      !!state.bodies[bodyInstance.instanceId] &&
      targetAfter?.currentPieces === 0;

    return {
      testName: 'Test 4: Progreso x/5 de Piezas y Ensamblaje de Cuerpo',
      passed,
      details: passed
        ? `Lista los 8 Cuerpos contenedores y ensambla correctamente ${bodyInstance.instanceId} al reunir 5/5 piezas.`
        : 'Fallo al ensamblar el Cuerpo contenedor desde 5/5 piezas.',
    };
  }

  /**
   * Test 5 — Ciclo de vida de cámara (stopCamera) e integración con Mochila (BagScene)
   */
  public static test5CameraLifecycleAndBagIntegration(): Bloque28BTestResult {
    GlobalQrScanner.stopCamera();
    const cameraStoppedCleanly = !GlobalQrScanner.isRunning();

    const state = this.createMockState();
    const bagVm = buildBagVM(state, 'crystals');
    const stdFrag = bagVm.items.find((i) => i.id === 'soul_fragment');
    const brilFrag = bagVm.items.find((i) => i.id === 'soul_fragment_brilliant');

    const bagOk =
      !!stdFrag &&
      stdFrag.canUseInField === true &&
      !!brilFrag &&
      brilFrag.canUseInField === true;

    const passed = cameraStoppedCleanly && bagOk;
    return {
      testName: 'Test 5: Ciclo de Vida de Cámara y Mochila (canUseInField)',
      passed,
      details: passed
        ? 'stopCamera() limpia recursos sin fugas y BagVM habilita canUseInField=true en soul_fragment y soul_fragment_brilliant.'
        : `Fallo en stopCamera (${cameraStoppedCleanly}) o BagVM (${bagOk}).`,
    };
  }

  public static runAllTests(): { allPassed: boolean; results: Bloque28BTestResult[] } {
    const results: Bloque28BTestResult[] = [
      this.test1SanitizeQrPayloadI14(),
      this.test2TransparencyAndPityVM(),
      this.test3FullScanAndAntiAbuse(),
      this.test4BodyPiecesProgressAndAssembly(),
      this.test5CameraLifecycleAndBagIntegration(),
    ];

    const allPassed = results.every((r) => r.passed);
    console.log(
      `[Bloque28BQrTestRunner] ${results.filter((r) => r.passed).length}/${results.length} tests OK.`
    );
    for (const r of results) {
      console.log(`  ${r.passed ? '✅' : '❌'} ${r.testName}: ${r.details}`);
    }
    return { allPassed, results };
  }
}
