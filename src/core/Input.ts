import { InputAction, Vector2D } from '../types';
import { GlobalEventBus } from './EventBus';

export class Input {
  private static instance: Input;

  private downStates: Map<InputAction, boolean> = new Map();
  private justPressedStates: Map<InputAction, boolean> = new Map();
  private justReleasedStates: Map<InputAction, boolean> = new Map();

  // Virtual touch button active states
  private virtualStates: Map<InputAction, boolean> = new Map();

  // Inactivity tracking
  private lastActivityTime = Date.now();
  private hudVisible = true;
  private readonly inactivityLimit = 8000; // 8 seconds of absolute inactivity

  private runPressStartTime = 0;

  private recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  private updateRunPressTracker(action: InputAction, pressed: boolean): void {
    if (action === 'RUN') {
      if (pressed) {
        if (this.runPressStartTime === 0) {
          this.runPressStartTime = Date.now();
        }
      } else {
        this.runPressStartTime = 0;
      }
    }
  }

  public isSprintActive(): boolean {
    if (!this.isDown('RUN') || this.runPressStartTime === 0) {
      return false;
    }
    return Date.now() - this.runPressStartTime >= 600; // 600ms threshold for sprint/long-press
  }

  // Keyboard mapping
  private keyMap: Record<string, InputAction[]> = {
    // Arrows
    ArrowUp: ['UP'],
    ArrowDown: ['DOWN'],
    ArrowLeft: ['LEFT'],
    ArrowRight: ['RIGHT'],

    // WASD
    KeyW: ['UP'],
    KeyS: ['DOWN'],
    KeyA: ['LEFT'],
    KeyD: ['RIGHT'],
    w: ['UP'],
    s: ['DOWN'],
    a: ['LEFT'],
    d: ['RIGHT'],

    // Action keys
    KeyZ: ['CONFIRM'],
    KeyC: ['CONFIRM'],
    Enter: ['CONFIRM', 'MENU'],
    Space: ['CONFIRM'],

    // Cancel / Back keys
    KeyX: ['CANCEL'],
    KeyK: ['CANCEL'],
    Escape: ['CANCEL', 'MENU'],
    Backspace: ['CANCEL'],

    // Menu / Journal / Select
    KeyM: ['MENU'],
    KeyJ: ['SELECT'],
    Tab: ['SELECT'],

    // Camera Rotation
    KeyQ: ['UP'],
    KeyE: ['DOWN'],

    // Run / Modifier
    ShiftLeft: ['RUN'],
    ShiftRight: ['RUN'],
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  private constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Track touch, click and movement interactions across screen to wake up HUD
    const onWindowInteraction = () => this.recordActivity();
    window.addEventListener('pointerdown', onWindowInteraction, { passive: true });
    window.addEventListener('pointermove', onWindowInteraction, { passive: true });
    window.addEventListener('touchstart', onWindowInteraction, { passive: true });
    window.addEventListener('keydown', onWindowInteraction, { passive: true });

    // Auto-mount physical GameBoy controls if present in DOM
    setTimeout(() => {
      this.mountTouchControls();
    }, 100);
  }

  public static getInstance(): Input {
    if (!Input.instance) {
      Input.instance = new Input();
    }
    return Input.instance;
  }

  /**
   * Triggers haptic vibration with fallback safety
   */
  public triggerVibration(pattern: number | number[] = 18): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.recordActivity();
    if (e.repeat) return;

    if (e.code === 'F2') {
      e.preventDefault();
      GlobalEventBus.emit('debug:toggle', undefined as any);
      return;
    }

    const actions = this.keyMap[e.code] || this.keyMap[e.key];
    if (actions) {
      actions.forEach((action) => {
        if (!this.downStates.get(action)) {
          this.downStates.set(action, true);
          this.justPressedStates.set(action, true);
          this.updateRunPressTracker(action, true);
          GlobalEventBus.emit('input:action', { action, pressed: true });
        }
      });
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.recordActivity();
    const actions = this.keyMap[e.code] || this.keyMap[e.key];
    if (actions) {
      actions.forEach((action) => {
        if (!this.virtualStates.get(action)) {
          this.downStates.set(action, false);
          this.justReleasedStates.set(action, true);
          this.updateRunPressTracker(action, false);
          GlobalEventBus.emit('input:action', { action, pressed: false });
        }
      });
    }
  }

  /**
   * Updates virtual button action state with tactile haptics
   */
  public setVirtualAction(action: InputAction, pressed: boolean): void {
    this.recordActivity();
    this.virtualStates.set(action, pressed);
    const current = this.downStates.get(action) || false;

    if (pressed && !current) {
      this.downStates.set(action, true);
      this.justPressedStates.set(action, true);
      this.updateRunPressTracker(action, true);
      GlobalEventBus.emit('input:action', { action, pressed: true });

      // Tactile haptic vibration on press
      this.triggerVibration(action === 'CONFIRM' ? 25 : 18);
    } else if (!pressed && current) {
      this.downStates.set(action, false);
      this.justReleasedStates.set(action, true);
      this.updateRunPressTracker(action, false);
      GlobalEventBus.emit('input:action', { action, pressed: false });
    }
  }

  /**
   * Polls connected gamepads for input
   */
  private pollGamepad(): void {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      const dpadUp = gp.buttons[12]?.pressed || (gp.axes[1] && gp.axes[1] < -0.4);
      const dpadDown = gp.buttons[13]?.pressed || (gp.axes[1] && gp.axes[1] > 0.4);
      const dpadLeft = gp.buttons[14]?.pressed || (gp.axes[0] && gp.axes[0] < -0.4);
      const dpadRight = gp.buttons[15]?.pressed || (gp.axes[0] && gp.axes[0] > 0.4);

      const btnConfirm = gp.buttons[0]?.pressed;
      const btnCancel = gp.buttons[1]?.pressed;
      const btnMenu = gp.buttons[9]?.pressed;
      const btnSelect = gp.buttons[8]?.pressed;
      const btnRun = gp.buttons[5]?.pressed || gp.buttons[7]?.pressed;

      if (dpadUp) this.setVirtualAction('UP', true);
      if (dpadDown) this.setVirtualAction('DOWN', true);
      if (dpadLeft) this.setVirtualAction('LEFT', true);
      if (dpadRight) this.setVirtualAction('RIGHT', true);

      if (btnConfirm) this.setVirtualAction('CONFIRM', true);
      if (btnCancel) this.setVirtualAction('CANCEL', true);
      if (btnMenu) this.setVirtualAction('MENU', true);
      if (btnSelect) this.setVirtualAction('SELECT', true);
      if (btnRun) this.setVirtualAction('RUN', true);
    }
  }

  /**
   * Initializes Handheld GameBoy tactile buttons & D-Pad sliding touch controller
   */
  public mountTouchControls(_unusedContainer?: HTMLElement): void {
    const bindTouchBtn = (id: string, action: InputAction, vibMs = 18) => {
      const el = document.getElementById(id);
      if (!el) return;

      const press = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('active');
        this.triggerVibration(vibMs);
        this.setVirtualAction(action, true);
      };

      const release = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('active');
        this.setVirtualAction(action, false);
      };

      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
    };

    // 1. Action Buttons with custom tactile haptic pulses
    bindTouchBtn('btn-touch-a', 'CONFIRM', 25);
    bindTouchBtn('btn-touch-b', 'CANCEL', 20);
    bindTouchBtn('btn-touch-start', 'MENU', 22);
    bindTouchBtn('btn-touch-select', 'SELECT', 18);
    bindTouchBtn('btn-touch-run', 'RUN', 15);

    // 2. Discrete D-Pad buttons
    bindTouchBtn('btn-touch-up', 'UP', 14);
    bindTouchBtn('btn-touch-down', 'DOWN', 14);
    bindTouchBtn('btn-touch-left', 'LEFT', 14);
    bindTouchBtn('btn-touch-right', 'RIGHT', 14);

    // 3. Shoulder & Utility buttons
    const btnL = document.getElementById('btn-touch-l');
    if (btnL) {
      btnL.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.triggerVibration(16);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ' }));
      });
    }

    const btnR = document.getElementById('btn-touch-r');
    if (btnR) {
      btnR.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.triggerVibration(16);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE' }));
      });
    }

    const debugBtn = document.getElementById('btn-touch-debug');
    if (debugBtn) {
      debugBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerVibration(20);
        GlobalEventBus.emit('debug:toggle', undefined as any);
      });
    }

    // 4. Smooth D-Pad Touch-Slide / Pointer-Slide Handler
    const dpadContainer = document.getElementById('dpad-container');
    const elUp = document.getElementById('btn-touch-up');
    const elDown = document.getElementById('btn-touch-down');
    const elLeft = document.getElementById('btn-touch-left');
    const elRight = document.getElementById('btn-touch-right');

    if (dpadContainer) {
      let isDragging = false;
      let lastDirMask = '';

      const updateDpadFromCoords = (clientX: number, clientY: number) => {
        const rect = dpadContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Deadzone check
        if (dist < 12) {
          this.setVirtualAction('UP', false);
          this.setVirtualAction('DOWN', false);
          this.setVirtualAction('LEFT', false);
          this.setVirtualAction('RIGHT', false);
          elUp?.classList.remove('active');
          elDown?.classList.remove('active');
          elLeft?.classList.remove('active');
          elRight?.classList.remove('active');
          lastDirMask = '';
          return;
        }

        const angle = Math.atan2(dy, dx); // radians -PI to PI
        const deg = (angle * 180) / Math.PI;

        // Reset directions
        let up = false;
        let down = false;
        let left = false;
        let right = false;

        // Angle sectors
        if (deg >= -157.5 && deg <= -22.5) up = true;
        if (deg >= 22.5 && deg <= 157.5) down = true;
        if (deg >= 112.5 || deg <= -112.5) left = true;
        if (deg >= -67.5 && deg <= 67.5) right = true;

        // Update active CSS button highlights on slide
        elUp?.classList.toggle('active', up);
        elDown?.classList.toggle('active', down);
        elLeft?.classList.toggle('active', left);
        elRight?.classList.toggle('active', right);

        const currentDirMask = `${up ? 'U' : ''}${down ? 'D' : ''}${left ? 'L' : ''}${right ? 'R' : ''}`;
        if (currentDirMask !== lastDirMask && currentDirMask !== '') {
          this.triggerVibration(12); // subtle tactile click on directional change while sliding thumb
          lastDirMask = currentDirMask;
        }

        this.setVirtualAction('UP', up);
        this.setVirtualAction('DOWN', down);
        this.setVirtualAction('LEFT', left);
        this.setVirtualAction('RIGHT', right);
      };

      const handleStart = (clientX: number, clientY: number) => {
        isDragging = true;
        updateDpadFromCoords(clientX, clientY);
      };

      const handleMove = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        updateDpadFromCoords(clientX, clientY);
      };

      const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        lastDirMask = '';
        elUp?.classList.remove('active');
        elDown?.classList.remove('active');
        elLeft?.classList.remove('active');
        elRight?.classList.remove('active');
        this.setVirtualAction('UP', false);
        this.setVirtualAction('DOWN', false);
        this.setVirtualAction('LEFT', false);
        this.setVirtualAction('RIGHT', false);
      };

      // Pointer Event listeners
      dpadContainer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dpadContainer.setPointerCapture?.(e.pointerId);
        handleStart(e.clientX, e.clientY);
      });

      dpadContainer.addEventListener('pointermove', (e) => {
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
      });

      const stopPointer = (e: PointerEvent) => {
        try {
          dpadContainer.releasePointerCapture?.(e.pointerId);
        } catch (_) {}
        handleEnd();
      };

      dpadContainer.addEventListener('pointerup', stopPointer);
      dpadContainer.addEventListener('pointercancel', stopPointer);
      dpadContainer.addEventListener('pointerleave', stopPointer);

      // Explicit Touch-Move & Touch-Start event handlers for mobile devices
      dpadContainer.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length > 0) {
          e.preventDefault();
          handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });

      dpadContainer.addEventListener('touchmove', (e: TouchEvent) => {
        if (e.touches.length > 0) {
          e.preventDefault();
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: false });

      dpadContainer.addEventListener('touchend', (e: TouchEvent) => {
        e.preventDefault();
        handleEnd();
      }, { passive: false });

      dpadContainer.addEventListener('touchcancel', (e: TouchEvent) => {
        e.preventDefault();
        handleEnd();
      }, { passive: false });
    }
  }

  public isDown(action: InputAction): boolean {
    return !!this.downStates.get(action);
  }

  public justPressed(action: InputAction): boolean {
    return !!this.justPressedStates.get(action);
  }

  public justReleased(action: InputAction): boolean {
    return !!this.justReleasedStates.get(action);
  }

  public getAxis(): Vector2D {
    let x = 0;
    let y = 0;
    if (this.isDown('LEFT')) x -= 1;
    if (this.isDown('RIGHT')) x += 1;
    if (this.isDown('UP')) y -= 1;
    if (this.isDown('DOWN')) y += 1;
    return { x, y };
  }

  public update(): void {
    this.pollGamepad();
    this.justPressedStates.clear();
    this.justReleasedStates.clear();

    // Check inactivity to fade out the touch controls HUD
    const now = Date.now();
    if (now - this.lastActivityTime > this.inactivityLimit) {
      if (this.hudVisible) {
        this.hudVisible = false;
        const hud = document.getElementById('touch-controls-hud');
        if (hud) {
          hud.style.transition = 'opacity 0.6s ease-in-out';
          hud.style.opacity = '0';
          // Temporarily block touch control buttons when invisible to prevent accidental triggers
          const interactiveElements = hud.querySelectorAll('.pointer-events-auto, button');
          interactiveElements.forEach((el) => {
            (el as HTMLElement).style.pointerEvents = 'none';
          });
        }
      }
    } else {
      if (!this.hudVisible) {
        this.hudVisible = true;
        const hud = document.getElementById('touch-controls-hud');
        if (hud) {
          hud.style.opacity = '1';
          // Restore button interaction
          const interactiveElements = hud.querySelectorAll('.pointer-events-auto, button');
          interactiveElements.forEach((el) => {
            (el as HTMLElement).style.pointerEvents = '';
          });
        }
      }
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }
}

export const GlobalInput = Input.getInstance();
