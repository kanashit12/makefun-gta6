// Keyboard + mouse input, mapped to game actions.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    enter: false,
    punch: false,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
    pressed: new Set(), // edge-triggered keys, consumed each frame
  };

  function sync() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.enter = input.pressed.has('KeyE');
    input.punch = input.pressed.has('KeyF') || input.pressed.has('Space');
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    keys.add(e.code);
    sync();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    sync();
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.mouseX = e.offsetX;
    input.mouseY = e.offsetY;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    input.mouseX = e.offsetX;
    input.mouseY = e.offsetY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.endFrame = () => {
    input.pressed.clear();
    sync();
  };
  input.isPressed = (code) => input.pressed.has(code);
  return input;
}
