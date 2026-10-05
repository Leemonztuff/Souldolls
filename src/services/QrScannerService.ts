import { GachaService } from '../systems/gacha/GachaService';

export interface SanitizedQrResult {
  valid: boolean;
  sanitized: string;
  displayCode: string;
  wasUrlNeutralized: boolean;
  reason?: 'EMPTY' | 'OK';
}

export interface CameraStartResult {
  active: boolean;
  mode: 'camera' | 'fallback';
  error?: string;
}

/**
 * BLOQUE 28B R1: Servicio de Escáner QR y Privacidad en Dispositivo.
 * Cumple estrictamente Invariante I-14:
 * - La cámara y las imágenes se procesan 100% en el dispositivo.
 * - El payload de un QR nunca se abre, navega ni ejecuta (neutraliza URLs, javascript:, data:, etc.).
 */
export class QrScannerService {
  private static instance: QrScannerService;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private scanCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private scanTimer: any = null;
  private isCameraActive = false;

  private constructor() {}

  public static getInstance(): QrScannerService {
    if (!QrScannerService.instance) {
      QrScannerService.instance = new QrScannerService();
    }
    return QrScannerService.instance;
  }

  /**
   * Sanitiza cualquier payload de QR para garantizar que nunca se ejecute ni se abra como URL (Invariante I-14),
   * conservando el 100% de su entropía determinista para GachaService.hashPayload.
   */
  public static sanitizeQrPayload(raw: string): SanitizedQrResult {
    if (typeof raw !== 'string') {
      return {
        valid: false,
        sanitized: '',
        displayCode: '',
        wasUrlNeutralized: false,
        reason: 'EMPTY',
      };
    }

    // 1. Eliminar caracteres de control (\x00-\x1F, \x7F) y recortar a máx 256 chars
    const stripped = raw.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 256);
    if (!stripped) {
      return {
        valid: false,
        sanitized: '',
        displayCode: '',
        wasUrlNeutralized: false,
        reason: 'EMPTY',
      };
    }

    // 2. Detectar cualquier esquema de URL o script ejecutable (http, https, javascript, data, file, vbscript, mailto)
    const dangerousSchemeRegex = /^(https?:\/\/|javascript:|data:|file:|vbscript:|mailto:|tel:|ftp:\/\/)/i;
    const htmlTagRegex = /<[^>]*script|<[^>]*iframe|onerror\s*=|onload\s*=/i;
    const isUrlOrExecutable = dangerousSchemeRegex.test(stripped) || htmlTagRegex.test(stripped);

    const { hash } = GachaService.hashPayload(stripped, 0);
    const sanitized = isUrlOrExecutable
      ? `QR_SAFE::${hash}`
      : `QR_TEXT::${stripped.replace(/[^a-zA-Z0-9_\-.:@#]/g, '_')}::${hash}`;

    const displayCode = `SELLO-${hash.slice(0, 8).toUpperCase()}`;

    return {
      valid: true,
      sanitized,
      displayCode,
      wasUrlNeutralized: isUrlOrExecutable,
      reason: 'OK',
    };
  }

  public isRunning(): boolean {
    return this.isCameraActive;
  }

  public getVideoCanvas(): HTMLCanvasElement | OffscreenCanvas | null {
    return this.scanCanvas;
  }

  /**
   * Inicia la cámara trasera del dispositivo a 320x240 y escanea a 10 Hz.
   * Si no hay cámara o se deniega el permiso, cae limpiamente a modo fallback.
   */
  public async startCamera(onDetect: (sanitizedPayload: string, displayCode: string) => void): Promise<CameraStartResult> {
    this.stopCamera();

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof document === 'undefined'
    ) {
      return {
        active: false,
        mode: 'fallback',
        error: 'CAMERA_API_UNAVAILABLE',
      };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
        audio: false,
      });

      this.stream = stream;
      const video = document.createElement('video');
      video.setAttribute('playsinline', 'true');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      this.videoEl = video;

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      this.scanCanvas = canvas;
      this.isCameraActive = true;

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;
      const detector = BarcodeDetectorCtor ? new BarcodeDetectorCtor({ formats: ['qr_code'] }) : null;

      this.scanTimer = setInterval(async () => {
        if (!this.isCameraActive || !this.videoEl || !this.scanCanvas) return;
        const ctx = this.scanCanvas.getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctx || this.videoEl.readyState < 2) return;

        ctx.drawImage(this.videoEl, 0, 0, 320, 240);

        if (detector) {
          try {
            const barcodes = await detector.detect(this.scanCanvas);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              const res = QrScannerService.sanitizeQrPayload(String(barcodes[0].rawValue));
              if (res.valid) {
                onDetect(res.sanitized, res.displayCode);
              }
            }
          } catch {
            // Ignorar errores transitorios de frame
          }
        }
      }, 100);

      return {
        active: true,
        mode: 'camera',
      };
    } catch (err: any) {
      this.stopCamera();
      return {
        active: false,
        mode: 'fallback',
        error: err?.name || 'CAMERA_PERMISSION_DENIED',
      };
    }
  }

  /**
   * Detiene todos los MediaStreamTracks y limpia temporizadores (Caso límite 4).
   */
  public stopCamera(): void {
    this.isCameraActive = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.stream) {
      try {
        for (const track of this.stream.getTracks()) {
          track.stop();
        }
      } catch {
        // Ignore cleanup errors
      }
      this.stream = null;
    }
    if (this.videoEl) {
      try {
        this.videoEl.pause();
        this.videoEl.srcObject = null;
      } catch {
        // Ignore cleanup errors
      }
      this.videoEl = null;
    }
  }

  /**
   * Decodifica una imagen QR local en memoria sin subir nada a servidores externos (Invariante I-14).
   */
  public async decodeFromImageFile(file: Blob | { name?: string; size?: number; text?: () => Promise<string> }): Promise<SanitizedQrResult> {
    if (!file) {
      return QrScannerService.sanitizeQrPayload('');
    }

    // 1. Intentar BarcodeDetector nativo si estamos en navegador y es un Blob de imagen real
    if (typeof window !== 'undefined' && (window as any).BarcodeDetector && typeof createImageBitmap === 'function' && file instanceof Blob) {
      try {
        const bitmap = await createImageBitmap(file);
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(bitmap);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          return QrScannerService.sanitizeQrPayload(String(codes[0].rawValue));
        }
      } catch {
        // Continúa al hash determinista local de bytes/luminancia
      }
    }

    // 2. Huella determinista local a partir de los bytes del archivo en el dispositivo
    let byteSignature = `IMG::${(file as any).name || 'qr'}::${(file as any).size || 0}`;
    if (file instanceof Blob && typeof file.arrayBuffer === 'function') {
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let acc = 2166136261;
        const step = Math.max(1, Math.floor(bytes.length / 256));
        for (let i = 0; i < bytes.length; i += step) {
          acc ^= bytes[i];
          acc = Math.imul(acc, 16777619) >>> 0;
        }
        byteSignature += `::${acc.toString(16)}`;
      } catch {
        // Fallback to name+size signature
      }
    }

    return QrScannerService.sanitizeQrPayload(byteSignature);
  }
}

export const GlobalQrScanner = QrScannerService.getInstance();
