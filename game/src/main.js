// Sunset Streets — main loop, screens, save/load, camera, wiring.
// Original open-world crime game for the make.fun GTA 6 bounty.
import { WORLD, VIEW, STEP, SAVE_KEY } from './config.js';
import { createWorld, stepWorld, resetRun } from './world.js';
import { startMission, updateMission, MISSIONS } from './missions.js';
import { createInput } from './input.js';
import { renderWorld, renderHUD, renderScreen, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_WIN } from './render.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const sound = new SoundBank();
const input = createInput(canvas);

const world = createWorld(WORLD.seed);
const camera = { x: world.state.player.x, y: world.state.player.y };
let screen = SCREEN_TITLE;
let last = performance.now();
let acc = 0;
let sirenTimer = 0;

function saveGame() {
  const s = world.state;
  const data = {
    money: s.money,
    health: s.health,
    missionsDone: s.missionsDone,
    missionIndex: s.missionIndex,
    carsStolen: s.carsStolen,
    distanceDriven: Math.round(s.distanceDriven),
    x: s.player.x,
    y: s.player.y,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(data) {
  const s = world.state;
  s.money = data.money;
  s.health = data.health;
  s.missionsDone = data.missionsDone;
  s.missionIndex = data.missionIndex;
  s.carsStolen = data.carsStolen;
  s.distanceDriven = data.distanceDriven;
  s.player.x = data.x;
  s.player.y = data.y;
  camera.x = data.x;
  camera.y = data.y;
}

function startPlaying() {
  sound.ensure();
  screen = SCREEN_PLAY;
  world.state.screen = 'play';
  if (!world.state.mission && world.state.missionIndex < MISSIONS.length) {
    startMission(world, world.state.missionIndex);
  }
}

function backToTitle() {
  screen = SCREEN_TITLE;
  world.state.screen = 'title';
  resetRun(world);
  camera.x = world.state.player.x;
  camera.y = world.state.player.y;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  // Screen-level keys
  if (input.isPressed('Enter')) {
    if (screen === SCREEN_TITLE) startPlaying();
    else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) backToTitle();
    else if (screen === SCREEN_WIN) {
      screen = SCREEN_PLAY;
      world.state.screen = 'play';
    }
  }
  if (input.isPressed('KeyH')) {
    if (screen === SCREEN_TITLE) {
      const data = loadSave();
      if (data) {
        applySave(data);
        startPlaying();
      }
    } else if (screen === SCREEN_PLAY) {
      if (saveGame()) {
        world.state.message = 'Game saved.';
        world.state.messageTimer = 2;
      }
    }
  }
  if (input.isPressed('KeyP') && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
    screen = screen === SCREEN_PLAY ? SCREEN_PAUSE : SCREEN_PLAY;
    world.state.screen = screen === SCREEN_PLAY ? 'play' : 'pause';
  }
  if (input.isPressed('KeyM') && screen === SCREEN_PLAY) {
    if (!world.state.mission && world.state.missionIndex < MISSIONS.length) {
      startMission(world, world.state.missionIndex);
    }
  }
  if (input.isPressed('KeyR') && screen === SCREEN_PAUSE) backToTitle();
  if (input.isPressed('KeyN')) {
    const on = sound.toggleMusic();
    world.state.message = on ? 'Music on' : 'Music off';
    world.state.messageTimer = 1.5;
  }

  if (screen === SCREEN_PLAY) {
    // Mouse world position for aiming
    input.mouseWorldX = camera.x - VIEW.width / 2 + input.mouseX;
    input.mouseWorldY = camera.y - VIEW.height / 2 + input.mouseY;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 8) {
      const event = stepWorld(world, input, STEP);
      if (event !== 0) {
        if (event & 4) {
          screen = SCREEN_WASTED;
          sound.busted();
        } else if (event & 2) {
          screen = SCREEN_BUSTED;
          sound.busted();
        }
      }
      if (updateMission(world, STEP)) {
        sound.missionDone();
        if (world.state.missionsDone >= MISSIONS.length) {
          screen = SCREEN_WIN;
          world.state.screen = 'win';
        }
      }
      acc -= STEP;
      guard += 1;
    }
    // Camera follows the player with a slight look-ahead while driving
    const p = world.state.player;
    const look = p.onFoot ? 0 : 90;
    const tx = p.x + Math.cos(p.angle) * look;
    const ty = p.y + Math.sin(p.angle) * look;
    camera.x += (tx - camera.x) * Math.min(1, dt * 4);
    camera.y += (ty - camera.y) * Math.min(1, dt * 4);
    camera.x = Math.max(VIEW.width / 2 - 200, Math.min(WORLD.width - VIEW.width / 2 + 200, camera.x));
    camera.y = Math.max(VIEW.height / 2 - 200, Math.min(WORLD.height - VIEW.height / 2 + 200, camera.y));

    // Sound: engine + sirens
    const speed01 = p.onFoot ? 0 : Math.abs(p.speed || 0) / 560;
    sound.setEngine(speed01);
    if (world.state.cops.length > 0) {
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sound.sirenTick();
        sirenTimer = 0.9;
      }
    }
  }

  // Draw
  if (screen === SCREEN_TITLE) {
    renderScreen(ctx, world, SCREEN_TITLE);
  } else if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) {
    renderWorld(ctx, world, camera, world.state.time);
    renderHUD(ctx, world, camera);
    if (screen === SCREEN_PAUSE) renderScreen(ctx, world, SCREEN_PAUSE);
  } else if (screen === SCREEN_BUSTED) {
    renderWorld(ctx, world, camera, world.state.time);
    renderScreen(ctx, world, SCREEN_BUSTED, { money: world.state.money, missions: world.state.missionsDone });
  } else if (screen === SCREEN_WASTED) {
    renderWorld(ctx, world, camera, world.state.time);
    renderScreen(ctx, world, SCREEN_WASTED, { missions: world.state.missionsDone });
  } else if (screen === SCREEN_WIN) {
    renderWorld(ctx, world, camera, world.state.time);
    renderScreen(ctx, world, SCREEN_WIN, { money: world.state.money, cars: world.state.carsStolen });
  }

  input.endFrame();
}

// Screenshot mode: stage a deterministic scene (?shot=start|drive|chase|mission)
// and draw one frame — the same seed always gives the same frame.
if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  world.state.screen = staged.screen === SCREEN_PLAY ? 'play' : 'title';
  if (staged.screen === SCREEN_PLAY) {
    const p = world.state.player;
    camera.x = p.x;
    camera.y = p.y;
  }
  renderWorld(ctx, world, camera, world.state.time);
  if (staged.screen === SCREEN_PLAY) renderHUD(ctx, world, camera);
  else renderScreen(ctx, world, SCREEN_TITLE);
  document.title = `Sunset Streets — shot ${shotName}`;
} else {
  requestAnimationFrame(frame);
}
