import { GameLoop } from '../core/GameLoop';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`[game-loop.test] ${message}`);
}

const callbacks = new Map<number, FrameRequestCallback>();
let nextId = 1;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  configurable: true,
  value: (callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  },
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  configurable: true,
  value: (id: number) => callbacks.delete(id),
});

try {
  let renderedFrames = 0;
  const p95Samples: number[] = [];
  const loop = new GameLoop(
    () => {},
    () => renderedFrames++,
    (p95) => p95Samples.push(p95)
  );

  loop.start();
  let timestamp = performance.now();
  for (let i = 0; i < 80; i++) {
    const [id, callback] = callbacks.entries().next().value!;
    callbacks.delete(id);
    timestamp += 16;
    callback(timestamp);
  }

  assert(p95Samples.length > 0, 'reports a rolling p95 after enough frames');
  assert(p95Samples.every((p95) => p95 >= 15 && p95 <= 17), 'measures frame intervals in milliseconds');

  loop.stop();
  const stoppedAt = renderedFrames;
  assert(callbacks.size === 0, 'stop cancels the pending animation frame');
  assert(renderedFrames === stoppedAt, 'stop prevents further renders');

  loop.start();
  assert(callbacks.size === 1, 'start resumes with a fresh animation frame');
  loop.stop();
  assert(callbacks.size === 0, 'stop also cancels a resumed loop');
} finally {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: originalRequestAnimationFrame,
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: originalCancelAnimationFrame,
  });
}

console.log('[game-loop.test] p95 reporting and pause/resume OK');
