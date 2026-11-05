export type Action =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'attack'
  | 'dash'
  | 'confirm'
  | 'back'
  | 'pause'
  | 'mute'
  | 'debug'
  | 'fly'
  | 'warp';

const KEYS: Record<string, Action[]> = {
  ArrowLeft: ['left'],
  KeyA: ['left'],
  ArrowRight: ['right'],
  KeyD: ['right'],
  ArrowUp: ['up'],
  KeyW: ['up'],
  ArrowDown: ['down'],
  KeyS: ['down'],
  KeyZ: ['jump', 'confirm'],
  Space: ['jump', 'confirm'],
  KeyK: ['jump', 'confirm'],
  KeyX: ['attack', 'back'],
  KeyJ: ['attack', 'back'],
  KeyC: ['dash'],
  KeyL: ['dash'],
  ShiftLeft: ['dash'],
  ShiftRight: ['dash'],
  Enter: ['confirm', 'pause'],
  Escape: ['pause', 'back'],
  KeyP: ['pause'],
  KeyM: ['mute'],
  Backquote: ['debug'],
  KeyF: ['fly'],
  KeyN: ['warp'],
};

/** Standard-mapping gamepad buttons. */
const PAD: [number, Action[]][] = [
  [0, ['jump', 'confirm']], // A
  [1, ['dash', 'back']], // B
  [2, ['attack']], // X
  [3, ['attack']], // Y
  [5, ['dash']], // RB
  [7, ['dash']], // RT
  [9, ['pause']], // Start
  [12, ['up']],
  [13, ['down']],
  [14, ['left']],
  [15, ['right']],
];

/**
 * Action-based input sampled once per fixed update tick, so a press is seen by exactly
 * one tick even when the display runs faster or slower than the simulation.
 */
export class Input {
  private keysDown = new Set<string>();
  private queued = new Set<Action>();
  private held = new Set<Action>();
  private pressedNow = new Set<Action>();
  private padPrev = new Set<Action>();
  /** Called on the first key/button press (browsers only allow audio after a gesture). */
  onGesture: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const acts = KEYS[e.code];
      this.onGesture?.();
      if (!acts) return;
      e.preventDefault();
      if (e.repeat) return;
      this.keysDown.add(e.code);
      for (const a of acts) this.queued.add(a);
    });
    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });
    window.addEventListener('blur', () => this.keysDown.clear());
    window.addEventListener('pointerdown', () => this.onGesture?.());
  }

  poll() {
    this.held.clear();
    for (const code of this.keysDown) for (const a of KEYS[code]) this.held.add(a);
    this.pressedNow = this.queued;
    this.queued = new Set();

    const padHeld = new Set<Action>();
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad) continue;
      for (const [b, acts] of PAD) if (pad.buttons[b]?.pressed) for (const a of acts) padHeld.add(a);
      const [ax = 0, ay = 0] = pad.axes;
      if (ax < -0.45) padHeld.add('left');
      if (ax > 0.45) padHeld.add('right');
      if (ay < -0.55) padHeld.add('up');
      if (ay > 0.55) padHeld.add('down');
    }
    for (const a of padHeld) {
      this.held.add(a);
      if (!this.padPrev.has(a)) {
        this.pressedNow.add(a);
        this.onGesture?.();
      }
    }
    this.padPrev = padHeld;
  }

  /** Held this tick (a tap shorter than a tick still counts for one tick). */
  down(a: Action) {
    return this.held.has(a) || this.pressedNow.has(a);
  }

  pressed(a: Action) {
    return this.pressedNow.has(a);
  }

  /** Mark a press as handled so nothing else reacts to it this tick. */
  consume(a: Action) {
    this.pressedNow.delete(a);
  }

  get x() {
    return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
  }

  get y() {
    return (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
  }
}
