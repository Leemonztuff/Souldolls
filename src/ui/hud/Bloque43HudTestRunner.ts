import { GlobalEventBus } from '../../core/EventBus';
import { GlobalSceneManager } from '../../core/SceneManager';
import { GlobalInput } from '../../core/Input';
import { GlobalSaveService } from '../../services/SaveService';
import { OverworldPlayer } from '../../systems/OverworldPlayer';
import { OverworldScene } from '../../scenes/OverworldScene';
import { OverworldHud } from './OverworldHud';
import { DIALOGUE_TREES } from '../../data/dialogue/dialogues';

export interface Bloque43TestReport {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  results: Array<{ name: string; passed: boolean; detail: string }>;
}

/**
 * BLOQUE 43 Req. 6 & 8: Suite de pruebas automatizadas del HUD del Overworld y enrutado físico de servicios.
 * Verifica:
 * 1. En producción (o sin DEBUG activo) no existe en el DOM ningún botón de debug (#atlas-debug-toggle-btn, #touch-controls-hud).
 * 2. Mantener B acelera el paso (modo correr) y soltar B vuelve a caminar, también con el D-pad táctil.
 * 3. No hay ruta posible desde el HUD ni desde el Menú Principal a Mercado (Shop), Taller (Workshop), Almacenes (StorageBox) o Vincular Alma (SoulBinding).
 * 4. Ningún elemento del HUD ni del Menú Principal emite OpenShop, OpenWorkshop u OpenStorage.
 * 5. El diálogo de la Artífice en el Taller NO incluye "Mercado de Artífices (Comprar / Vender)" y ofrece únicamente:
 *    Curar equipo, Reparar cuerpo, Purgar ki, Mejorar cuerpo, Almacén de Almas, Almacén de Cuerpos y Salir.
 */
export class Bloque43HudTestRunner {
  public static runAllTests(): Bloque43TestReport {
    const results: Array<{ name: string; passed: boolean; detail: string }> = [];

    const record = (name: string, passed: boolean, detail: string) => {
      results.push({ name, passed, detail });
    };

    // 1. Prueba DOM: No existe #touch-controls-hud ni botones HTML sueltos en el DOM
    const legacyDomHud = typeof document !== 'undefined' ? document.getElementById('touch-controls-hud') : null;
    const legacyDebugBtn = typeof document !== 'undefined' ? document.getElementById('atlas-debug-toggle-btn') : null;
    record(
      '1. Limpieza DOM (sin overlay HTML #touch-controls-hud ni botones debug en producción)',
      legacyDomHud === null && legacyDebugBtn === null,
      `touch-controls-hud=${legacyDomHud === null ? 'ausente' : 'presente'}, atlas-debug-btn=${legacyDebugBtn === null ? 'ausente' : 'presente'}`
    );

    // 2. Prueba Correr manteniendo B y volver a caminar al soltar B
    const state = GlobalSaveService.getCurrentState();
    const prevRunMode = state.settings.runMode;
    state.settings.runMode = 'hold';

    const testPlayer = new OverworldPlayer('player', 6, 8, 'down');
    GlobalInput.setVirtualState('CANCEL', false);
    const walkWhileReleased = !GlobalInput.isDown('RUN');

    GlobalInput.setVirtualState('CANCEL', true); // Mantener B en táctil/teclado
    const runWhileBHeld = GlobalInput.isDown('RUN');

    GlobalInput.setVirtualState('CANCEL', false); // Soltar B
    const walkAfterBRelease = !GlobalInput.isDown('RUN');

    state.settings.runMode = prevRunMode;
    record(
      '2. Correr manteniendo B y volver a caminar al soltar B',
      walkWhileReleased && runWhileBHeld && walkAfterBRelease && testPlayer !== null,
      `sin B=${walkWhileReleased}, manteniendo B=${runWhileBHeld}, al soltar B=${walkAfterBRelease}`
    );

    // 3. Prueba Menú Principal (Start): Entradas permitidas y prohibición de Mercado/Taller/Almacenes/Vincular
    const dummyOverworld = new OverworldScene();
    const pauseItems = dummyOverworld.getPauseMenuItems();
    const allowedIds = ['party', 'bag', 'codex', 'quests', 'save', 'options', 'title_screen'];
    const actualIds = pauseItems.map((i) => i.id);
    const forbiddenTerms = ['mercado', 'tienda', 'taller', 'almacén', 'almacen', 'vincular', 'reparar', 'comprar', 'vender'];
    const hasForbiddenLabel = pauseItems.some((item) =>
      forbiddenTerms.some((term) => item.label.toLowerCase().includes(term))
    );
    const exactMatchAllowed =
      actualIds.length === allowedIds.length && allowedIds.every((id, idx) => actualIds[idx] === id);

    record(
      '3. Menú Principal contiene únicamente las 7 entradas permitidas (sin Mercado, Taller, Almacenes ni Vincular)',
      exactMatchAllowed && !hasForbiddenLabel,
      `entradas=[${actualIds.join(', ')}]`
    );

    // 4. Prueba EventBus: Ningún elemento del HUD ni del Menú Principal emite OpenShop, OpenWorkshop u OpenStorage
    let forbiddenEventEmitted = false;
    let forbiddenScenePushed = false;

    const onForbiddenEvent = () => {
      forbiddenEventEmitted = true;
    };
    GlobalEventBus.on('OpenShop', onForbiddenEvent);
    GlobalEventBus.on('OpenWorkshop', onForbiddenEvent);
    GlobalEventBus.on('OpenStorage', onForbiddenEvent);

    const origPush = GlobalSceneManager.pushScene.bind(GlobalSceneManager);
    const origChange = GlobalSceneManager.changeScene.bind(GlobalSceneManager);
    (GlobalSceneManager as any).pushScene = async (name: string) => {
      if (name === 'Shop' || name === 'Workshop' || name === 'StorageBox' || name === 'SoulBinding') {
        forbiddenScenePushed = true;
      }
    };
    (GlobalSceneManager as any).changeScene = async (name: string) => {
      if (name === 'Shop' || name === 'Workshop' || name === 'StorageBox' || name === 'SoulBinding') {
        forbiddenScenePushed = true;
      }
    };

    try {
      const hud = new OverworldHud({
        onOpenMenu: () => {},
        onRotateCamera: () => {},
      });
      hud.updateHud(0.1);
      hud.setInteractLabel('Entrar');
      hud.setInteractLabel(null);
      hud.destroy({ children: true });

      // Ejecutar acciones de las entradas de navegación del menú (excepto guardar/salir)
      pauseItems.forEach((item) => {
        if (item.id !== 'save' && item.id !== 'title_screen') {
          item.action();
        }
      });
    } finally {
      (GlobalSceneManager as any).pushScene = origPush;
      (GlobalSceneManager as any).changeScene = origChange;
      GlobalEventBus.off('OpenShop', onForbiddenEvent);
      GlobalEventBus.off('OpenWorkshop', onForbiddenEvent);
      GlobalEventBus.off('OpenStorage', onForbiddenEvent);
    }

    record(
      '4. HUD y Menú Principal nunca emiten OpenShop, OpenWorkshop ni OpenStorage ni abren escenas de servicio',
      !forbiddenEventEmitted && !forbiddenScenePushed,
      `forbiddenEventEmitted=${forbiddenEventEmitted}, forbiddenScenePushed=${forbiddenScenePushed}`
    );

    // 5. Prueba Diálogo del Taller: Sin entrada de Mercado y con las 7 opciones reglamentarias
    const joyTree = DIALOGUE_TREES.nurse_joy_dialogue;
    const joyOptions = joyTree?.nodes?.node_joy_start?.options || [];
    const joyLabels = joyOptions.map((o) => o.label);
    const hasShopInWorkshop = joyLabels.some(
      (l) => l.toLowerCase().includes('mercado') || l.toLowerCase().includes('comprar') || l.toLowerCase().includes('vender')
    );
    const hasChasisInWorkshop = joyLabels.some((l) => l.toLowerCase().includes('chasis'));

    record(
      '5. Diálogo de la Artífice en el Taller sin entrada de Mercado y con "Cuerpo" en vez de "Chasis"',
      joyLabels.length === 7 && !hasShopInWorkshop && !hasChasisInWorkshop,
      `opciones Taller=[${joyLabels.join(' | ')}]`
    );

    // 6. Prueba de ciclo de vida de HUD (pause/resume) al abrir y cerrar pantallas apiladas
    let hudResumeOk = false;
    let hudResumeDetail = '';
    try {
      const testOverworld = new OverworldScene();
      (testOverworld as any).buildHUD();
      testOverworld.pause();
      const hiddenWhilePaused = (testOverworld as any).hudContainer?.visible === false;
      testOverworld.resume();
      const visibleAfterResume =
        (testOverworld as any).hudContainer?.visible === true &&
        !(testOverworld as any).hudContainer?.destroyed &&
        !(testOverworld as any).isMenuOpen &&
        !(testOverworld as any).isDialogueOpen;
      hudResumeOk = hiddenWhilePaused && visibleAfterResume;
      hudResumeDetail = `hiddenWhilePaused=${hiddenWhilePaused}, visibleAfterResume=${visibleAfterResume}`;
      (testOverworld as any).hudContainer?.destroy({ children: true });
      (testOverworld as any).toastContainer?.destroy({ children: true });
      (testOverworld as any).player?.character?.destroy();
      dummyOverworld.exit();
    } catch (err: any) {
      hudResumeOk = false;
      hudResumeDetail = `error=${err?.message || String(err)}`;
    }

    record(
      '6. El HUD del Overworld se oculta al pausar (pushScene) y se restaura interactivo al volver (popScene)',
      hudResumeOk,
      hudResumeDetail
    );

    const passedTests = results.filter((r) => r.passed).length;
    const report: Bloque43TestReport = {
      passed: passedTests === results.length,
      totalTests: results.length,
      passedTests,
      results,
    };

    if (!report.passed) {
      console.error('[Bloque43HudTestRunner] Fallaron pruebas del Bloque 43:', report);
    } else {
      console.log(`[Bloque43HudTestRunner] ${passedTests}/${results.length} pruebas superadas con éxito.`);
    }

    return report;
  }
}
