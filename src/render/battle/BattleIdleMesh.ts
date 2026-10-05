import { Container, MeshPlane, Texture } from 'pixi.js';
import { IdleBandMeta } from '../procedural/SoulDollSpriteFactory';
import { BustAnimationMode } from '../../types';
import battleConfigRaw from '../../data/config/battle.json';

export interface BattleIdleMeshOptions {
  texture: Texture;
  idleMeta?: IdleBandMeta | null;
  bustMode?: BustAnimationMode;
  phaseOffsetSec?: number;
  cycleJitterFactor?: number;
}

/**
 * BLOQUE 39: Animación idle por franjas (respiración y rebote de busto) con pies anclados.
 * - Renderiza el sprite "full" como un único MeshPlane de Pixi v8 con:
 *   verticesX = ancho nativo + 1, verticesY = alto nativo + 1 (un vértice por píxel nativo).
 * - Filas por debajo de waist: desplazamiento 0 (pies anclados al suelo, 0 px de movimiento).
 * - Filas entre neck y waist: estiramiento hacia arriba desde waist (dy = -Math.round(((waist - r) / (waist - neck)) * breathDispPx)).
 * - Filas por encima de neck (cabeza/cuello/sombrero): bloque rígido que sube -breathDispPx entero.
 * - Zona bust opcional (solo vistas frontales): rebote secundario con peso en campana sin(pi * t) en vertical
 *   y limitado a columnas x0..x1 (sin arrastrar los brazos), gobernado por resorte amortiguado de paso fijo
 *   x'' = -k*x - c*v + drive (k=90, c=7).
 * - Todas las coordenadas de vértices se redondean a píxeles nativos enteros (Math.round).
 * - El buffer de vértices solo se recalcula y sube a GPU cuando cambia la clave entera (breathInt | bustInt).
 */
export class BattleIdleMesh extends Container {
  private meshPlane: MeshPlane;
  private currentTexture: Texture;
  private nativeW = 64;
  private nativeH = 160;
  private verticesX = 65;
  private verticesY = 161;

  // Idle Band Metadata (editable en vivo desde el Debug F2)
  public idleMeta: IdleBandMeta | null = null;
  public forceFallbackMode = false;

  // Breathing cycle parameters
  public cycleDurationSec = 3.0;
  public inhaleRatio = 0.40;
  public pauseRatio = 0.07;
  public exhaleRatio = 0.53;
  public breathAmpPx = 2;
  public bustJigglePx = 2;
  public timeScale = 1.0;

  // Fixed-step damped spring parameters (x'' = -k*x - c*v + drive)
  public springK = 90;
  public springC = 7;
  public driveGain = 18;
  public bustMode: BustAnimationMode = 'subtle';

  // Internal animation state (preserved across pauses/interrupts so it never jumps)
  private cycleTimer = 0;
  private prevPhaseBucket: 'inhale' | 'pause' | 'exhale' = 'inhale';
  private prevBreathVel = 0;
  private springX = 0;
  private springV = 0;
  private physicsAccum = 0;
  private pendingImpulse = 0;
  private paused = false;

  // Current quantized integer displacements (in native pixels)
  public currentBreathPx = 0;
  public currentBustPx = 0;
  public currentFallbackOffsetY = 0;
  private lastCacheKey = '';

  // Telemetry & compliance verification for Debug (Bloque 39 Req 4 & 6)
  private bufferUpdatesCounter = 0;
  private bufferUpdatesPerSec = 0;
  private telemetryTimer = 0;
  public hasNonIntegerWarning = false;
  public feetMovedWarning = false;
  public bottomRowMaxDeltaY = 0;

  constructor(options: BattleIdleMeshOptions) {
    super();
    this.roundPixels = true;

    const cfgIdle = (battleConfigRaw as any).idle || {};
    const baseCycle = cfgIdle.cycleSec ?? 3.0;
    const jitter = options.cycleJitterFactor ?? 1 + (Math.random() * 2 - 1) * (cfgIdle.durationJitterPct ?? 0.1);

    this.cycleDurationSec = Number((baseCycle * jitter).toFixed(3));
    this.inhaleRatio = cfgIdle.inhaleRatio ?? 0.40;
    this.pauseRatio = cfgIdle.pauseRatio ?? 0.07;
    this.exhaleRatio = cfgIdle.exhaleRatio ?? 0.53;
    this.breathAmpPx = cfgIdle.breathAmpPx ?? 2;
    this.bustJigglePx = cfgIdle.bustJigglePx ?? 2;
    this.springK = cfgIdle.springK ?? 90;
    this.springC = cfgIdle.springC ?? 7;
    this.driveGain = cfgIdle.driveGain ?? 18;

    this.cycleTimer = options.phaseOffsetSec ?? Math.random() * this.cycleDurationSec;
    this.idleMeta = options.idleMeta ? JSON.parse(JSON.stringify(options.idleMeta)) : null;
    this.bustMode = options.bustMode ?? 'subtle';

    this.currentTexture = options.texture || Texture.WHITE;
    this.nativeW = Math.max(2, Math.round(this.currentTexture.width || 64));
    this.nativeH = Math.max(2, Math.round(this.currentTexture.height || 160));
    this.verticesX = this.nativeW + 1;
    this.verticesY = this.nativeH + 1;

    this.meshPlane = new MeshPlane({
      texture: this.currentTexture,
      verticesX: this.verticesX,
      verticesY: this.verticesY,
    });
    this.meshPlane.roundPixels = true;
    this.addChild(this.meshPlane);

    this.rebuildVerticesIfChanged(true);
  }

  public get texture(): Texture {
    return this.currentTexture;
  }

  public set texture(tex: Texture) {
    if (!tex) return;
    const newW = Math.max(2, Math.round(tex.width || 64));
    const newH = Math.max(2, Math.round(tex.height || 160));
    const dimensionsChanged = newW !== this.nativeW || newH !== this.nativeH;

    this.currentTexture = tex;
    this.nativeW = newW;
    this.nativeH = newH;
    this.verticesX = this.nativeW + 1;
    this.verticesY = this.nativeH + 1;

    if (dimensionsChanged) {
      const oldTint = this.meshPlane.tint;
      const oldAlpha = this.meshPlane.alpha;
      this.removeChild(this.meshPlane);
      this.meshPlane.destroy();

      this.meshPlane = new MeshPlane({
        texture: this.currentTexture,
        verticesX: this.verticesX,
        verticesY: this.verticesY,
      });
      this.meshPlane.roundPixels = true;
      this.meshPlane.tint = oldTint;
      this.meshPlane.alpha = oldAlpha;
      this.addChild(this.meshPlane);
      this.lastCacheKey = '';
      this.rebuildVerticesIfChanged(true);
    } else {
      this.meshPlane.texture = this.currentTexture;
      this.lastCacheKey = '';
      this.rebuildVerticesIfChanged(true);
    }
  }

  public override get tint(): number {
    return this.meshPlane ? this.meshPlane.tint : 0xffffff;
  }

  public override set tint(value: number) {
    if (this.meshPlane) {
      this.meshPlane.tint = value;
    }
  }

  public setTint(value: number): void {
    this.tint = value;
  }

  public setIntegerScale(intScale: number, flipX = false): void {
    const s = Math.max(1, Math.floor(Math.abs(intScale)));
    this.scale.set(flipX ? -s : s, s);
  }

  public setIdleMeta(meta: IdleBandMeta | null | undefined): void {
    this.idleMeta = meta ? JSON.parse(JSON.stringify(meta)) : null;
    this.lastCacheKey = '';
    this.rebuildVerticesIfChanged(true);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  /**
   * Dispara un impulso sobre el resorte secundario del busto
   * (al inhalar/exhalar, embestir en ataque, recibir golpe o caer en KO).
   */
  public applyImpulse(impulseVelocity: number): void {
    this.pendingImpulse += impulseVelocity;
  }

  public getBufferUpdatesPerSec(): number {
    return this.bufferUpdatesPerSec;
  }

  /**
   * Evalúa la curva de respiración (0..1) y su derivada temporal aproximada
   * Ciclo: inhalar 40%, pausa 7%, exhalar 53% con ease seno.
   */
  private evaluateBreathingCurve(u: number): { value01: number; phase: 'inhale' | 'pause' | 'exhale' } {
    const inhEnd = this.inhaleRatio;
    const pauseEnd = this.inhaleRatio + this.pauseRatio;

    if (u < inhEnd) {
      const p = u / Math.max(0.001, inhEnd);
      const val = 0.5 * (1 - Math.cos(Math.PI * p));
      return { value01: val, phase: 'inhale' };
    } else if (u < pauseEnd) {
      return { value01: 1.0, phase: 'pause' };
    } else {
      const p = (u - pauseEnd) / Math.max(0.001, 1.0 - pauseEnd);
      const val = 0.5 * (1 + Math.cos(Math.PI * p));
      return { value01: val, phase: 'exhale' };
    }
  }

  public update(dt: number): void {
    // 1. Actualizar contador de actualizaciones de buffer por segundo
    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 1.0) {
      this.bufferUpdatesPerSec = Math.round(this.bufferUpdatesCounter / this.telemetryTimer);
      this.bufferUpdatesCounter = 0;
      this.telemetryTimer = 0;
    }

    // 2. Pausa automática si la pestaña del navegador está oculta o si una animación de combate tomó control
    if (this.paused || (typeof document !== 'undefined' && document.hidden)) {
      return;
    }

    const scaledDt = Math.min(0.1, dt * this.timeScale);
    if (scaledDt <= 0) return;

    this.cycleTimer = (this.cycleTimer + scaledDt) % this.cycleDurationSec;
    const u = this.cycleTimer / this.cycleDurationSec;
    const { value01, phase } = this.evaluateBreathingCurve(u);

    // Impulso pequeño al iniciar inhalación o exhalación (Bloque 39 Req 3)
    const cfgIdle = (battleConfigRaw as any).idle || {};
    if (phase !== this.prevPhaseBucket) {
      if (phase === 'inhale') {
        this.pendingImpulse += cfgIdle.inhaleImpulse ?? 8;
      } else if (phase === 'exhale') {
        this.pendingImpulse += cfgIdle.exhaleImpulse ?? -6;
      }
      this.prevPhaseBucket = phase;
    }

    // Velocidad instantánea de respiración (derivada numérica)
    const eps = 0.004;
    const uNext = (u + eps) % 1.0;
    const nextEval = this.evaluateBreathingCurve(uNext);
    const breathVel = ((nextEval.value01 - value01) / (eps * this.cycleDurationSec)) * this.breathAmpPx;
    this.prevBreathVel = breathVel;

    // 3. Paso fijo para el resorte amortiguado: x'' = -k*x - c*v + drive (k=90, c=7)
    const FIXED_STEP = 1 / 120;
    this.physicsAccum += scaledDt;
    while (this.physicsAccum >= FIXED_STEP) {
      this.physicsAccum -= FIXED_STEP;

      if (this.pendingImpulse !== 0) {
        this.springV += this.pendingImpulse;
        this.pendingImpulse = 0;
      }

      const drive = -this.prevBreathVel * this.driveGain;
      const accel = -this.springK * this.springX - this.springC * this.springV + drive;
      this.springV += accel * FIXED_STEP;
      this.springX += this.springV * FIXED_STEP;
    }

    // 4. Cuantización estricta a píxeles nativos enteros (1-2 px)
    const rawBreathPx = Math.round(value01 * this.breathAmpPx);

    let modeMult = 0.5; // 'subtle' (50% por defecto)
    if (this.bustMode === 'off') modeMult = 0;
    else if (this.bustMode === 'normal') modeMult = 1.0;

    const hasBustZone = Boolean(this.idleMeta && this.idleMeta.bust && !this.forceFallbackMode);
    let rawBustPx = 0;
    if (hasBustZone && modeMult > 0) {
      const clampedSpring = Math.max(
        -this.bustJigglePx,
        Math.min(this.bustJigglePx, this.springX * this.bustJigglePx * modeMult)
      );
      rawBustPx = Math.round(clampedSpring);
      if (Object.is(rawBustPx, -0)) rawBustPx = 0;
    }

    // Req 4: Si el atlas no tiene datos de "idle" para una vista, usar el idle anterior de 1 px sin deformar
    if (!this.idleMeta || this.forceFallbackMode) {
      this.currentBreathPx = 0;
      this.currentBustPx = 0;
      this.currentFallbackOffsetY = Math.round(Math.sin((this.cycleTimer / this.cycleDurationSec) * Math.PI * 2));
      this.rebuildVerticesIfChanged(false);
      return;
    }

    this.currentFallbackOffsetY = 0;
    this.currentBreathPx = rawBreathPx;
    this.currentBustPx = rawBustPx;

    this.rebuildVerticesIfChanged(false);
  }

  /**
   * Recalcula el buffer de posiciones del MeshPlane SOLO cuando cambian los valores enteros
   * o la configuración de franjas (neck/waist/bust).
   * Sitúa el origen local (0, 0) exactamente en el pivote de los pies (0.5, 1.0),
   * es decir x en [-nativeW/2 .. +nativeW/2] e y en [-nativeH .. 0].
   */
  public rebuildVerticesIfChanged(force = false): void {
    const metaKey = this.idleMeta
      ? `${this.idleMeta.neck.toFixed(3)}_${this.idleMeta.waist.toFixed(3)}_${
          this.idleMeta.bust
            ? `${this.idleMeta.bust.y0.toFixed(2)},${this.idleMeta.bust.y1.toFixed(2)},${this.idleMeta.bust.x0.toFixed(2)},${this.idleMeta.bust.x1.toFixed(2)}`
            : 'nobust'
        }`
      : 'fallback';

    const cacheKey = `${this.nativeW}x${this.nativeH}|${metaKey}|f:${this.forceFallbackMode ? 1 : 0}|b:${this.currentBreathPx}|j:${this.currentBustPx}`;
    if (!force && cacheKey === this.lastCacheKey) {
      return;
    }
    this.lastCacheKey = cacheKey;

    const positions = this.meshPlane.geometry.positions;
    const cols = this.verticesX;
    const rows = this.verticesY;
    const halfW = Math.round(this.nativeW * 0.5);

    const hasDeform = Boolean(this.idleMeta && !this.forceFallbackMode);
    const neckRow = hasDeform ? Math.round(this.idleMeta!.neck * this.nativeH) : 0;
    const waistRow = hasDeform ? Math.max(neckRow + 1, Math.round(this.idleMeta!.waist * this.nativeH)) : 1;

    const bust = hasDeform ? this.idleMeta!.bust : undefined;
    const bustY0 = bust ? Math.round(bust.y0 * this.nativeH) : 0;
    const bustY1 = bust ? Math.max(bustY0 + 1, Math.round(bust.y1 * this.nativeH)) : 0;
    const bustX0 = bust ? Math.round(bust.x0 * this.nativeW) : 0;
    const bustX1 = bust ? Math.max(bustX0 + 1, Math.round(bust.x1 * this.nativeW)) : 0;

    let nonIntFound = false;
    let maxBottomDelta = 0;

    let ptr = 0;
    for (let r = 0; r < rows; r++) {
      // Base Y en espacio nativo con pivote en los pies (fila rows-1 => y = 0)
      const baseY = r - this.nativeH;

      // Deformación por fila (Req 1):
      // - r >= waistRow: dy = 0 (anclado al piso)
      // - neckRow <= r < waistRow: se estira hacia arriba desde waist (dy = -Math.round(((waistRow - r) / (waistRow - neckRow)) * breathPx))
      // - r < neckRow: bloque rígido que sube -breathPx
      let rowBreathDy = 0;
      if (hasDeform && this.currentBreathPx !== 0) {
        if (r >= waistRow) {
          rowBreathDy = 0;
        } else if (r >= neckRow) {
          const bandRatio = (waistRow - r) / (waistRow - neckRow);
          rowBreathDy = -Math.round(bandRatio * this.currentBreathPx);
        } else {
          rowBreathDy = -this.currentBreathPx;
        }
      }

      // Peso vertical en campana sin(pi * t) dentro de la zona bust
      let rowBustWeight = 0;
      if (bust && this.currentBustPx !== 0 && r >= bustY0 && r <= bustY1) {
        const t = (r - bustY0) / (bustY1 - bustY0);
        rowBustWeight = Math.sin(Math.PI * t);
      }

      for (let c = 0; c < cols; c++) {
        const vx = Math.round(c - halfW);
        let bustDy = 0;
        if (rowBustWeight > 0 && c >= bustX0 && c <= bustX1) {
          bustDy = Math.round(this.currentBustPx * rowBustWeight);
        }

        const vy = Math.round(baseY + rowBreathDy + bustDy);

        if (!Number.isInteger(vx) || !Number.isInteger(vy)) {
          nonIntFound = true;
        }
        if (r === rows - 1 && Math.abs(vy - 0) > maxBottomDelta) {
          maxBottomDelta = Math.abs(vy - 0);
        }

        positions[ptr++] = vx;
        positions[ptr++] = vy;
      }
    }

    this.hasNonIntegerWarning = nonIntFound;
    this.bottomRowMaxDeltaY = maxBottomDelta;
    this.feetMovedWarning = maxBottomDelta > 0;

    if (this.hasNonIntegerWarning) {
      console.warn('⚠️ [BattleIdleMesh] Desplazamiento de vértice NO entero detectado.');
    }
    if (this.feetMovedWarning) {
      console.warn(`⚠️ [BattleIdleMesh] ¡Violación de anclaje en los pies! deltaY=${maxBottomDelta}`);
    }

    const posBuffer = this.meshPlane.geometry.getBuffer('aPosition');
    if (posBuffer) {
      posBuffer.update();
    }
    this.bufferUpdatesCounter++;
  }

  /**
   * Transforma un hotspot normalizado (dyNormalized en [-1..0] desde los pies)
   * aplicando exactamente la misma deformación por franjas que recibe esa fila nativa (Req 5).
   */
  public getDeformedRowDeltaY(dyNormalized: number): number {
    if (!this.idleMeta || this.forceFallbackMode) {
      return this.currentFallbackOffsetY;
    }

    // dyNormalized es negativo desde los pies (ej. -0.78 cabeza, -0.52 torso, -0.20 piernas)
    const rowFromTop = Math.max(0, Math.min(this.nativeH, Math.round((1 + dyNormalized) * this.nativeH)));
    const neckRow = Math.round(this.idleMeta.neck * this.nativeH);
    const waistRow = Math.max(neckRow + 1, Math.round(this.idleMeta.waist * this.nativeH));

    if (rowFromTop >= waistRow) {
      return 0;
    } else if (rowFromTop >= neckRow) {
      const bandRatio = (waistRow - rowFromTop) / (waistRow - neckRow);
      return -Math.round(bandRatio * this.currentBreathPx);
    } else {
      return -this.currentBreathPx;
    }
  }
}
