// Sunset Streets — keyboard and mouse input for the canvas.
// Tracks held keys, just-pressed edges (cleared once per frame by the
// game loop), and the mouse position / clicks in canvas pixels.

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 640, y: 360, clicked: false, clickX: 0, clickY: 0, down: false };

  const GAME_KEYS = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyM',
    'KeyP', 'KeyH', 'KeyN', 'KeyR', 'Enter', 'ShiftLeft', 'ShiftRight',
  ];

  window.addEventListener('keydown', (e) => {
    if (!GAME_KEYS.includes(e.code)) return;
    e.preventDefault();
    if (!e.repeat) justPressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  canvas.addEventListener('mousemove', (e) => {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toCanvas(e);
    mouse.x = p.x; mouse.y = p.y;
    mouse.clicked = true;
    mouse.clickX = p.x; mouse.clickY = p.y;
    mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    justPressed,
    mouse,
    down(...codes) {
      return codes.some((c) => keys.has(c));
    },
    pressed(...codes) {
      return codes.some((c) => justPressed.has(c));
    },
    // Movement keys as a control bundle for the simulation.
    controls() {
      return {
        up: this.down('KeyW', 'ArrowUp'),
        down: this.down('KeyS', 'ArrowDown'),
        left: this.down('KeyA', 'ArrowLeft'),
        right: this.down('KeyD', 'ArrowRight'),
        run: this.down('ShiftLeft', 'ShiftRight'),
      };
    },
    endFrame() {
      justPressed.clear();
      mouse.clicked = false;
    },
  };
}
