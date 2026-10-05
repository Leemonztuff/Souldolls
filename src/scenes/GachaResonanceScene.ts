import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { IScene } from './IScene';
import { GlobalPixiRenderer } from '../render/PixiRenderer';
import { GlobalSceneManager } from '../core/SceneManager';
import { GlobalSaveService } from '../services/SaveService';
import { GlobalAudioService } from '../services/AudioService';
import { GlobalInput } from '../core/Input';
import { GlobalRng } from '../core/Rng';
import { GlobalQrScanner, QrScannerService } from '../services/QrScannerService';
import { GachaService } from '../systems/gacha/GachaService';
import { GachaRarity, GachaResult } from '../types/gacha';
import { BODY_CHASSIS_DATA } from '../data/bodies/chassis';
import {
  buildGachaResonanceVM,
  GachaResonanceTabId,
} from '../ui/viewmodels/GachaResonanceVM';
import {
  ScreenFrame,
  KitCard,
  KitTabBar,
  KitButton,
  KitBadge,
  KitBar,
  KitListRow,
  KitModal,
  IconRegistry,
  FocusManager,
  UIKitLinter,
} from '../ui/kit';
import { COLOR_NUM, COLOR_HEX, FONTS, COLOR_RARITY } from '../ui/styles';
import esText from '../data/text/es.json';

/**
 * BLOQUE 28B: Escena de Cámara de Resonancia QR, Overlay AR y Pantallas (UI Kit).
 */
export class GachaResonanceScene implements IScene {
  public name = 'GachaResonance';
  private container: Container = new Container();
  private screenFrame!: ScreenFrame;
  private focusManager: FocusManager = new FocusManager();
  private activeTab: GachaResonanceTabId = 'scan';
  private activeTableId: 'standard_resonance' | 'brilliant_resonance' = 'standard_resonance';
  private activeModal: KitModal | null = null;

  // AR Viewfinder animation state
  private arReticleGfx: Graphics | null = null;
  private arScanlineGfx: Graphics | null = null;
  private arParticlesGfx: Graphics | null = null;
  private arTimer = 0;
  private arBoxW = 280;
  private arBoxH = 200;
  private cameraStatusText = 'MODO LOCAL: CÁMARA EN ESPERA';
  private fileInputEl: HTMLInputElement | null = null;

  public async enter(params?: {
    tableId?: 'standard_resonance' | 'brilliant_resonance';
    tab?: GachaResonanceTabId;
  }): Promise<void> {
    if (params?.tableId) {
      this.activeTableId = params.tableId;
    }
    if (params?.tab) {
      this.activeTab = params.tab;
    }
    this.container = new Container();
    this.container.roundPixels = true;
    this.container.zIndex = 1000;
    GlobalPixiRenderer.menuLayer.addChild(this.container);
    this.buildUI();
  }

  public pause(): void {
    GlobalQrScanner.stopCamera();
    if (this.container && !this.container.destroyed) {
      this.container.visible = false;
    }
  }

  public async resume(): Promise<void> {
    if (!this.container || this.container.destroyed) {
      this.container = new Container();
      this.container.roundPixels = true;
      this.container.zIndex = 1000;
    }
    this.container.visible = true;
    if (this.container.parent !== GlobalPixiRenderer.menuLayer) {
      GlobalPixiRenderer.menuLayer.addChild(this.container);
    }
    this.buildUI();
  }

  public onResize(_width: number, _height: number): void {
    this.buildUI();
  }

  private mapRarityKey(r: GachaRarity): 'comun' | 'poco_comun' | 'rara' | 'epica' {
    if (r === 'uncommon') return 'poco_comun';
    if (r === 'rare') return 'rara';
    if (r === 'epic') return 'epica';
    return 'comun';
  }

  private buildUI(): void {
    this.container.removeChildren();
    this.focusManager.clear();
    this.arReticleGfx = null;
    this.arScanlineGfx = null;
    this.arParticlesGfx = null;

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const isTwoCol = width >= 840;
    const state = GlobalSaveService.getCurrentState();
    const vm = buildGachaResonanceVM(state, this.activeTableId);
    const t = (esText as any).terms.gacha;

    this.screenFrame = new ScreenFrame({
      width,
      height,
      title: t.title,
      currencies: [
        { iconId: 'soul_fragment', value: vm.standardFragments + vm.brilliantFragments },
        { iconId: 'ki_dust', value: vm.kiDust },
        { iconId: 'coin', value: vm.money },
      ],
      onClose: () => {
        GlobalQrScanner.stopCamera();
        GlobalAudioService.playSfx('cancel');
        GlobalSceneManager.popScene();
      },
      secondaryAction: {
        label: esText.terms.group_a.options.btn_cancel,
        iconId: 'back',
        onClick: () => {
          GlobalQrScanner.stopCamera();
          GlobalAudioService.playSfx('cancel');
          GlobalSceneManager.popScene();
        },
      },
      primaryAction:
        this.activeTab === 'scan'
          ? {
              label: t.btn_manual_code,
              iconId: 'soul_fragment',
              onClick: () => this.openManualCodePrompt(),
            }
          : undefined,
    });
    this.container.addChild(this.screenFrame);

    const cw = this.screenFrame.contentWidth;

    const tabBar = new KitTabBar({
      width: cw,
      absX: 0,
      tabs: [
        { id: 'scan', label: t.tab_scan, iconId: 'soul_fragment' },
        { id: 'pieces', label: t.tab_pieces, iconId: 'workshop' },
        { id: 'rates', label: t.tab_rates, iconId: 'codex_book' },
      ],
      activeId: this.activeTab,
      onSelect: (id) => {
        if (id !== 'scan') {
          GlobalQrScanner.stopCamera();
        }
        this.activeTab = id as GachaResonanceTabId;
        this.buildUI();
      },
    });
    tabBar.position.set(0, 0);
    this.screenFrame.contentRoot.addChild(tabBar);

    const startY = 52;

    if (this.activeTab === 'scan') {
      this.renderScanTab(cw, startY, isTwoCol, vm, t);
    } else if (this.activeTab === 'pieces') {
      this.renderPiecesTab(cw, startY, vm, t);
    } else {
      this.renderRatesTab(cw, startY, isTwoCol, vm, t);
    }

    if (this.activeModal) {
      this.container.addChild(this.activeModal);
    }

    UIKitLinter.inspectTree(this.screenFrame, 'GachaResonanceScene');
  }

  private renderScanTab(
    cw: number,
    startY: number,
    isTwoCol: boolean,
    vm: ReturnType<typeof buildGachaResonanceVM>,
    t: any
  ): void {
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    // 1. Tarjeta Izquierda: Visor AR con Retícula de Bronce y Partículas de Ki
    const vfCardH = 310;
    const vfCard = new KitCard({
      width: colW,
      height: vfCardH,
      variant: 'inkCrypt',
      title: t.sec_viewfinder,
    });
    vfCard.position.set(0, startY);
    this.screenFrame.contentRoot.addChild(vfCard);

    this.arBoxW = colW - 28;
    this.arBoxH = 196;

    const arViewport = new Container();
    arViewport.roundPixels = true;
    arViewport.position.set(14, 40);
    vfCard.addChild(arViewport);

    // Fondo del altar / visor
    const arBg = new Graphics();
    arBg.roundRect(0, 0, this.arBoxW, this.arBoxH, 8);
    arBg.fill({ color: COLOR_NUM.inkCrypt, alpha: 0.96 });
    arBg.stroke({ color: COLOR_NUM.bronze, width: 2 });
    arViewport.addChild(arBg);

    // Emblema central del Altar de Resonancia
    const centerIcon = IconRegistry.create('soul_fragment', 36);
    centerIcon.position.set(
      Math.round((this.arBoxW - 36) / 2),
      Math.round((this.arBoxH - 36) / 2) - 8
    );
    arViewport.addChild(centerIcon);

    // Capas animadas del Overlay AR (partículas, scanline y retícula de bronce)
    this.arParticlesGfx = new Graphics();
    arViewport.addChild(this.arParticlesGfx);

    this.arScanlineGfx = new Graphics();
    arViewport.addChild(this.arScanlineGfx);

    this.arReticleGfx = new Graphics();
    arViewport.addChild(this.arReticleGfx);
    this.drawArOverlay(0);

    const statusBadge = new KitBadge(
      GlobalQrScanner.isRunning() ? 'CÁMARA QR ACTIVA (10 HZ)' : this.cameraStatusText,
      'rarity',
      GlobalQrScanner.isRunning() ? 'rara' : 'comun'
    );
    statusBadge.position.set(14, 246);
    vfCard.addChild(statusBadge);

    const dailyBadge = new KitBadge(
      t.daily_label.replace('{used}', String(vm.dailyUsed)).replace('{limit}', String(vm.dailyLimit)),
      'tier',
      't1'
    );
    dailyBadge.position.set(14, 274);
    vfCard.addChild(dailyBadge);

    // 2. Tarjeta Derecha: Selector de Fragmento, Botones de Escaneo/Fallback y Barra de Pity
    const ctrlCardH = 310;
    const ctrlCard = new KitCard({
      width: colW,
      height: ctrlCardH,
      variant: 'smokedWood',
      title: t.sec_controls,
    });
    ctrlCard.position.set(isTwoCol ? colW + 12 : 0, isTwoCol ? startY : startY + vfCardH + 12);
    this.screenFrame.contentRoot.addChild(ctrlCard);

    // Selector de tipo de Fragmento (Estándar vs Brillante)
    const halfBtnW = Math.floor((colW - 36) / 2);
    const stdBtn = new KitButton({
      width: halfBtnW,
      height: 44,
      label: `ESTÁNDAR (${vm.standardFragments})`,
      variant: this.activeTableId === 'standard_resonance' ? 'primary' : 'secondary',
      fontSize: 12,
      onClick: () => {
        this.activeTableId = 'standard_resonance';
        GlobalAudioService.playSfx('select');
        this.buildUI();
      },
    });
    stdBtn.position.set(14, 40);
    ctrlCard.addChild(stdBtn);
    this.focusManager.register(stdBtn.toFocusable());

    const brlBtn = new KitButton({
      width: halfBtnW,
      height: 44,
      label: `BRILLANTE (${vm.brilliantFragments})`,
      variant: this.activeTableId === 'brilliant_resonance' ? 'primary' : 'secondary',
      fontSize: 12,
      onClick: () => {
        this.activeTableId = 'brilliant_resonance';
        GlobalAudioService.playSfx('select');
        this.buildUI();
      },
    });
    brlBtn.position.set(14 + halfBtnW + 8, 40);
    ctrlCard.addChild(brlBtn);
    this.focusManager.register(brlBtn.toFocusable());

    // Barra de Pity
    const pityTitle = t.pity_label
      .replace('{current}', String(vm.currentPity))
      .replace('{max}', String(vm.pityThreshold));
    const pityBar = new KitBar({
      width: colW - 28,
      height: 24,
      value: vm.currentPity,
      max: vm.pityThreshold,
      kind: 'exp',
      labelText: pityTitle,
      showText: true,
    });
    pityBar.position.set(14, 96);
    ctrlCard.addChild(pityBar);

    // Botón 1: Activar / Detener Cámara QR
    const camBtn = new KitButton({
      width: colW - 28,
      height: 44,
      label: GlobalQrScanner.isRunning() ? t.btn_stop_cam : t.btn_start_cam,
      iconId: 'compass',
      variant: GlobalQrScanner.isRunning() ? 'danger' : 'secondary',
      onClick: () => this.toggleCameraScan(),
    });
    camBtn.position.set(14, 132);
    ctrlCard.addChild(camBtn);
    this.focusManager.register(camBtn.toFocusable());

    // Botón 2 (Fallback 1): Subir imagen QR local
    const uploadBtn = new KitButton({
      width: colW - 28,
      height: 44,
      label: t.btn_upload_qr,
      iconId: 'codex_book',
      variant: 'secondary',
      onClick: () => this.triggerImageUpload(),
    });
    uploadBtn.position.set(14, 184);
    ctrlCard.addChild(uploadBtn);
    this.focusManager.register(uploadBtn.toFocusable());

    // Botón 3 (Fallback 2): Introducir código/sello manual
    const manualBtn = new KitButton({
      width: colW - 28,
      height: 44,
      label: t.btn_manual_code,
      iconId: 'soul_fragment',
      variant: 'primary',
      onClick: () => this.openManualCodePrompt(),
    });
    manualBtn.position.set(14, 236);
    ctrlCard.addChild(manualBtn);
    this.focusManager.register(manualBtn.toFocusable());

    const totalH = isTwoCol ? startY + vfCardH + 20 : startY + vfCardH + ctrlCardH + 32;
    this.screenFrame.setContentTotalHeight(totalH);
  }

  private renderPiecesTab(
    cw: number,
    startY: number,
    vm: ReturnType<typeof buildGachaResonanceVM>,
    t: any
  ): void {
    const rowH = 66;
    const cardH = vm.bodyPieces.length * rowH + 54;
    const card = new KitCard({
      width: cw,
      height: cardH,
      variant: 'smokedWood',
      title: t.sec_pieces,
    });
    card.position.set(0, startY);
    this.screenFrame.contentRoot.addChild(card);

    vm.bodyPieces.forEach((bp, idx) => {
      const yPos = 42 + idx * rowH;
      const row = new KitListRow({
        width: cw - 24,
        height: 58,
        iconId: 'workshop',
        title: `${bp.chassisName} (${bp.currentPieces}/${bp.requiredPieces} piezas)`,
        subtitle: bp.pieceName,
        valueText: bp.canAssemble ? 'LISTO (5/5)' : `${Math.round(bp.ratio * 100)}%`,
        selected: bp.canAssemble,
        onClick: () => {
          if (bp.canAssemble) {
            this.handleAssembleBody(bp.chassisId);
          }
        },
      });
      row.position.set(12, yPos);
      card.addChild(row);
      this.focusManager.register({
        container: row,
        width: cw - 24,
        height: 58,
        onActivate: () => {
          if (bp.canAssemble) {
            this.handleAssembleBody(bp.chassisId);
          }
        },
      });
    });

    this.screenFrame.setContentTotalHeight(startY + cardH + 20);
  }

  private renderRatesTab(
    cw: number,
    startY: number,
    isTwoCol: boolean,
    vm: ReturnType<typeof buildGachaResonanceVM>,
    t: any
  ): void {
    const colW = isTwoCol ? Math.floor((cw - 12) / 2) : cw;

    // 1. Tarjeta de Transparencia de Probabilidades y Ética I-14
    const ratesCardH = 310;
    const ratesCard = new KitCard({
      width: colW,
      height: ratesCardH,
      variant: 'parchment',
      title: t.sec_rates,
    });
    ratesCard.position.set(0, startY);
    this.screenFrame.contentRoot.addChild(ratesCard);

    vm.rates.forEach((r, idx) => {
      const y = 44 + idx * 42;
      const badge = new KitBadge(r.rarityLabel, 'rarity', this.mapRarityKey(r.rarity));
      badge.position.set(14, y);
      ratesCard.addChild(badge);

      const rateTxt = new Text({
        text: `${r.ratePercent}  •  Duplicado: +${r.kiDustYield} Polvo de Ki`,
        style: new TextStyle({
          fontFamily: FONTS.hud,
          fontSize: 14,
          fontWeight: 'bold',
          fill: COLOR_HEX.inkCrypt,
        }),
      });
      rateTxt.roundPixels = true;
      rateTxt.position.set(140, y + 4);
      ratesCard.addChild(rateTxt);
    });

    const privacyTxt = new Text({
      text: vm.privacyNotice,
      style: new TextStyle({
        fontFamily: FONTS.body,
        fontSize: 13,
        fontWeight: 'bold',
        fill: COLOR_HEX.smokedWood,
        wordWrap: true,
        wordWrapWidth: colW - 28,
        lineHeight: 18,
      }),
    });
    privacyTxt.roundPixels = true;
    privacyTxt.position.set(14, 218);
    ratesCard.addChild(privacyTxt);

    // 2. Tarjeta de Historial de Sellos Escaneados (scanLedger)
    const ledgerCardH = Math.max(310, vm.recentScans.length * 48 + 64);
    const ledgerCard = new KitCard({
      width: colW,
      height: ledgerCardH,
      variant: 'smokedWood',
      title: t.sec_ledger,
    });
    ledgerCard.position.set(isTwoCol ? colW + 12 : 0, isTwoCol ? startY : startY + ratesCardH + 12);
    this.screenFrame.contentRoot.addChild(ledgerCard);

    if (vm.recentScans.length === 0) {
      const emptyTxt = new Text({
        text: t.ledger_empty,
        style: new TextStyle({
          fontFamily: FONTS.body,
          fontSize: 14,
          fill: COLOR_HEX.parchmentDark,
          wordWrap: true,
          wordWrapWidth: colW - 28,
        }),
      });
      emptyTxt.roundPixels = true;
      emptyTxt.position.set(14, 48);
      ledgerCard.addChild(emptyTxt);
    } else {
      vm.recentScans.forEach((sc, idx) => {
        const row = new KitListRow({
          width: colW - 24,
          height: 44,
          iconId: 'soul_fragment',
          title: sc.hashShort,
          subtitle: sc.dateFormatted,
          valueText: sc.tableId === 'brilliant_resonance' ? 'BRILLANTE' : 'ESTÁNDAR',
          onClick: () => {},
        });
        row.position.set(12, 42 + idx * 46);
        ledgerCard.addChild(row);
      });
    }

    const totalH = isTwoCol
      ? startY + Math.max(ratesCardH, ledgerCardH) + 20
      : startY + ratesCardH + ledgerCardH + 32;
    this.screenFrame.setContentTotalHeight(totalH);
  }

  private drawArOverlay(dt: number): void {
    this.arTimer += dt;
    const w = this.arBoxW;
    const h = this.arBoxH;

    // 1. Retícula de bronce / oro en las 4 esquinas
    if (this.arReticleGfx) {
      this.arReticleGfx.clear();
      const pad = 18;
      const len = 24;
      const g = this.arReticleGfx;
      // Top-left
      g.moveTo(pad, pad + len).lineTo(pad, pad).lineTo(pad + len, pad);
      // Top-right
      g.moveTo(w - pad - len, pad).lineTo(w - pad, pad).lineTo(w - pad, pad + len);
      // Bottom-left
      g.moveTo(pad, h - pad - len).lineTo(pad, h - pad).lineTo(pad + len, h - pad);
      // Bottom-right
      g.moveTo(w - pad - len, h - pad).lineTo(w - pad, h - pad).lineTo(w - pad, h - pad - len);
      g.stroke({ color: COLOR_NUM.gold, width: 3 });
    }

    // 2. Línea de barrido horizontal en cian ki (#5FE3D2)
    if (this.arScanlineGfx) {
      this.arScanlineGfx.clear();
      const scanY = 24 + ((Math.sin(this.arTimer * 2.6) * 0.5 + 0.5) * (h - 48));
      this.arScanlineGfx.moveTo(22, scanY).lineTo(w - 22, scanY);
      this.arScanlineGfx.stroke({ color: COLOR_NUM.cyan, width: 2, alpha: 0.85 });
    }

    // 3. 12 Partículas orbitales de ki
    if (this.arParticlesGfx) {
      this.arParticlesGfx.clear();
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < 12; i++) {
        const angle = this.arTimer * 1.4 + (i * Math.PI * 2) / 12;
        const rx = 48 + (i % 3) * 14;
        const ry = 32 + (i % 2) * 12;
        const px = cx + Math.cos(angle) * rx;
        const py = cy + Math.sin(angle) * ry;
        const col = i % 2 === 0 ? COLOR_NUM.cyan : COLOR_NUM.soulViolet;
        this.arParticlesGfx.circle(px, py, 2.5);
        this.arParticlesGfx.fill({ color: col, alpha: 0.75 });
      }
    }
  }

  private async toggleCameraScan(): Promise<void> {
    if (GlobalQrScanner.isRunning()) {
      GlobalQrScanner.stopCamera();
      this.cameraStatusText = 'MODO LOCAL: CÁMARA DETENIDA';
      GlobalAudioService.playSfx('cancel');
      this.buildUI();
      return;
    }

    GlobalAudioService.playSfx('select');
    const res = await GlobalQrScanner.startCamera((sanitizedPayload) => {
      GlobalQrScanner.stopCamera();
      this.executeQrRoll(sanitizedPayload);
    });

    if (!res.active) {
      this.cameraStatusText = 'SIN CÁMARA: USA IMAGEN O SELLO MANUAL';
    } else {
      this.cameraStatusText = 'CÁMARA QR ACTIVA (10 HZ)';
    }
    this.buildUI();
  }

  private triggerImageUpload(): void {
    if (typeof document === 'undefined') return;
    if (!this.fileInputEl) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (file) {
          const decoded = await GlobalQrScanner.decodeFromImageFile(file);
          if (decoded.valid) {
            this.executeQrRoll(decoded.sanitized);
          }
        }
        input.value = '';
      });
      document.body.appendChild(input);
      this.fileInputEl = input;
    }
    this.fileInputEl.click();
  }

  private openManualCodePrompt(): void {
    if (this.activeModal) {
      this.activeModal.destroy({ children: true });
      this.activeModal = null;
    }

    const t = (esText as any).terms.gacha;
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;
    const sampleSeed = `ANIMA-QR-${GlobalRng.rangeInt(1000, 9999)}`;

    this.activeModal = new KitModal(width, height, {
      type: 'TextPrompt',
      size: 'L',
      title: t.manual_prompt_title,
      bodyText: t.manual_prompt_body,
      initialText: sampleSeed,
      confirmLabel: 'RESONAR CÓDIGO',
      cancelLabel: 'CANCELAR',
      onConfirm: (enteredCode?: string) => {
        this.activeModal = null;
        const sanitizedRes = QrScannerService.sanitizeQrPayload(enteredCode || '');
        if (!sanitizedRes.valid) {
          this.showAlertModal('CÓDIGO INVÁLIDO', 'El código introducido está vacío. No se consumió ningún Fragmento de alma.');
          return;
        }
        this.executeQrRoll(sanitizedRes.sanitized);
      },
      onCancel: () => {
        this.activeModal = null;
        this.buildUI();
      },
    });

    this.container.addChild(this.activeModal);
  }

  public executeQrRoll(sanitizedPayload: string): GachaResult {
    const state = GlobalSaveService.getCurrentState();
    const result = GachaService.rollFromScan(sanitizedPayload, state, {
      tableId: this.activeTableId,
    });
    GlobalSaveService.save();

    if (!result.ok) {
      GlobalAudioService.playSfx('cancel');
      this.showAlertModal('RESONANCIA RECHAZADA', result.message);
      return result;
    }

    GlobalAudioService.playSfx('crystal');
    GlobalAudioService.playSfx('soul_seal');
    this.showRewardModal(result);
    return result;
  }

  private handleAssembleBody(chassisId: string): void {
    const state = GlobalSaveService.getCurrentState();
    const curPieces = Number(state.bodyPieces?.[chassisId] || 0);
    if (curPieces < 5) {
      GlobalAudioService.playSfx('cancel');
      this.buildUI();
      return;
    }

    if (!state.bodyPieces) state.bodyPieces = {};
    state.bodyPieces[chassisId] = curPieces - 5;
    const bodyInstance = GachaService.assembleBodyFromPieces(chassisId, state, GlobalRng);
    GlobalSaveService.save();

    if (bodyInstance) {
      GlobalAudioService.playSfx('crystal');
      const chassisName = BODY_CHASSIS_DATA[chassisId]?.name || chassisId;
      const t = (esText as any).terms.gacha;
      this.showAlertModal(
        t.reward_title,
        t.assembled_notice.replace('{bodyName}', chassisName)
      );
    } else {
      GlobalAudioService.playSfx('cancel');
      this.buildUI();
    }
  }

  private showRewardModal(result: GachaResult): void {
    if (this.activeModal) {
      this.activeModal.destroy({ children: true });
      this.activeModal = null;
    }

    const t = (esText as any).terms.gacha;
    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    const lines: string[] = [result.message];
    for (const rw of result.rewards) {
      if (rw.assembledBodyInstanceId) {
        const bodyName = BODY_CHASSIS_DATA[rw.chassisId || '']?.name || rw.name;
        lines.push(t.assembled_notice.replace('{bodyName}', bodyName));
      }
      if (rw.convertedToKiDust) {
        lines.push(t.ki_dust_notice.replace('{dust}', String(rw.convertedToKiDust)));
      }
    }

    const modalItems = result.rewards.map((rw) => ({
      id: rw.id,
      title: `${rw.quantity}x ${rw.name}`,
      subtitle: `Rareza: ${rw.rarity.toUpperCase()}`,
      value: rw.convertedToKiDust ? `+${rw.convertedToKiDust} Ki` : 'NUEVO',
      iconId:
        rw.kind === 'scroll'
          ? ('quest_scroll' as const)
          : rw.kind === 'bodyPiece'
          ? ('workshop' as const)
          : ('soul_fragment' as const),
    }));

    this.activeModal = new KitModal(width, height, {
      type: 'Reward',
      size: 'M',
      title: `${t.reward_title} (${result.rarity.toUpperCase()})`,
      bodyText: lines.join('\n'),
      items: modalItems,
      confirmLabel: 'ACEPTAR BOTÍN',
      onConfirm: () => {
        this.activeModal = null;
        this.buildUI();
      },
    });

    this.buildUI();
  }

  private showAlertModal(title: string, bodyText: string): void {
    if (this.activeModal) {
      this.activeModal.destroy({ children: true });
      this.activeModal = null;
    }

    const width = GlobalPixiRenderer.width;
    const height = GlobalPixiRenderer.height;

    this.activeModal = new KitModal(width, height, {
      type: 'Alert',
      size: 'S',
      title,
      bodyText,
      confirmLabel: 'ENTENDIDO',
      onConfirm: () => {
        this.activeModal = null;
        this.buildUI();
      },
    });

    this.buildUI();
  }

  public update(dt: number): void {
    this.screenFrame?.updateInertia();
    this.focusManager.update();
    if (this.activeTab === 'scan') {
      this.drawArOverlay(dt);
    }
    if (!this.activeModal && GlobalInput.justPressed('CANCEL')) {
      GlobalQrScanner.stopCamera();
      GlobalAudioService.playSfx('cancel');
      GlobalSceneManager.popScene();
    }
  }

  public render(): void {}

  public async exit(): Promise<void> {
    GlobalQrScanner.stopCamera();
    if (this.fileInputEl && this.fileInputEl.parentNode) {
      this.fileInputEl.parentNode.removeChild(this.fileInputEl);
      this.fileInputEl = null;
    }
    this.focusManager.clear();
    this.container.destroy({ children: true });
  }
}
