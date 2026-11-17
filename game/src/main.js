// Sunset Streets — the game loop (requestAnimationFrame), screen state
// machine, save and load, wiring input, world, render and audio together.

import { SAVE_KEY, VIEW } from './config.js';
import { createInput } from './input.js';
import { createWorld, toast, updateWorld } from './world.js';
import { render, cameraFor } from './render.js';
import { SoundBank } from './audio.js';
import { startNextMission, MISSIONS } from './missions.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = new SoundBank();

const STEP = 1 / 60;
let world = createWorld();
let screen = 'title'; // title | playing | paused | busted | wasted | win
let time = 0;
let last = performance.now();
let acc = 0;
let lastMissionsDone = 0;
let saveExists = false;
try {
  saveExists = !!localStorage.getItem(SAVE_KEY);
} catch {
  saveExists = false;
}

// Deterministic screenshot scenes: ?shot=start|drive|chase|mission
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const SHOT_MODE = !!shotName;
if (SHOT_MODE) {
  stageShot(world, shotName);
  screen = shotName === 'start' ? 'title' : 'playing';
}

// Small debug handle for automated smoke tests (read-only state view).
window.__sunset = {
  get world() { return world; },
  get screen() { return screen; },
  get time() { return time; },
};

function saveGame() {
  try {
    const p = world.player;
    const data = {
      x: p.x, y: p.y, angle: p.angle, health: p.health, cash: p.cash,
      inCar: p.inCar ? p.inCar.model.id : null,
      wanted: world.wanted.stars,
      mission: world.mission,
      stats: world.stats,
      time: world.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    saveExists = true;
    toast(world, 'Run saved.');
  } catch {
    toast(world, 'Save failed — storage unavailable.');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    const fresh = createWorld();
    fresh.player.x = data.x;
    fresh.player.y = data.y;
    fresh.player.angle = data.angle;
    fresh.player.health = data.health;
    fresh.player.cash = data.cash;
    fresh.wanted.stars = data.wanted ?? 0;
    fresh.mission = data.mission;
    fresh.stats = data.stats ?? fresh.stats;
    fresh.time = data.time ?? 0;
    if (data.inCar) {
      const car = fresh.parked.find((c) => c.model.id === data.inCar);
      if (car) {
        fresh.parked = fresh.parked.filter((c) => c !== car);
        car.parked = false;
        fresh.player.inCar = car;
      }
    }
    world = fresh;
    lastMissionsDone = world.stats.missionsDone;
    return true;
  } catch {
    return false;
  }
}

function newGame() {
  world = createWorld();
  lastMissionsDone = 0;
  screen = 'playing';
  toast(world, 'Welcome to Solmar Bay. Press M for your first job.');
}

function respawn() {
  const p = world.player;
  world.police = [];
  world.wanted.stars = 0;
  world.wanted.heat = 0;
  world.wanted.spawn = 0;
  world.busted = false;
  world.wasted = false;
  p.health = 100;
  p.invuln = 3;
  if (p.inCar) {
    p.inCar.parked = true;
    world.parked.push(p.inCar);
    p.inCar = null;
  }
  p.x = 1296;
  p.y = 520;
  p.angle = -Math.PI / 2;
  p.speed = 0;
  screen = 'playing';
}

function handleScreenKeys() {
  if (screen === 'title') {
    if (input.pressed('Enter')) {
      if (saveExists && loadGame()) {
        screen = 'playing';
        toast(world, 'Welcome back to Solmar Bay.');
      } else {
        newGame();
      }
    } else if (input.pressed('KeyN')) {
      newGame();
    }
  } else if (screen === 'paused') {
    if (input.pressed('KeyP')) screen = 'playing';
    else if (input.pressed('KeyR')) newGame();
    else if (input.pressed('Enter')) screen = 'title';
  } else if (screen === 'busted' || screen === 'wasted') {
    if (input.pressed('Enter')) respawn();
    else if (input.pressed('Escape')) screen = 'title';
  } else if (screen === 'win') {
    if (input.pressed('Enter')) screen = 'title';
  }
}

function handlePlayingKeys() {
  if (input.pressed('KeyP')) {
    screen = 'paused';
    return;
  }
  if (input.pressed('KeyH')) saveGame();
  if (input.pressed('KeyN')) {
    const on = audio.toggleMusic();
    toast(world, on ? 'Music on.' : 'Music off.');
  }
  if (input.pressed('KeyM') && !world.mission.active) {
    const idx = world.mission.done.findIndex((d) => !d);
    if (idx === -1) {
      toast(world, 'All five jobs are done. The city is yours.');
    } else if (startNextMission(world)) {
      const m = MISSIONS[idx];
      toast(world, `${m.title} — ${m.giver}: ${m.brief}`, 6);
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!SHOT_MODE) time += dt;

  // Audio unlocks on the first gesture.
  if (input.justPressed.size > 0 || input.mouse.clicked) audio.unlock();

  const wasPlaying = screen === 'playing';
  if (!SHOT_MODE) handleScreenKeys();
  // Playing keys only run when the screen was already playing at the
  // start of this frame: otherwise a key that just changed the screen
  // (e.g. P resuming from pause) would fire again in the same frame.
  if (screen === 'playing' && wasPlaying && !SHOT_MODE) handlePlayingKeys();

  if (screen === 'playing' && !SHOT_MODE) {
    const cam = cameraFor(world);
    const controls = input.controls();
    controls.interactPressed = input.pressed('KeyE');
    controls.punchPressed = input.pressed('KeyF', 'Space');
    controls.mouseX = input.mouse.x + cam.x;
    controls.mouseY = input.mouse.y + cam.y;
    controls.shootAt = input.mouse.clicked
      ? { x: input.mouse.clickX + cam.x, y: input.mouse.clickY + cam.y }
      : null;

    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      updateWorld(world, controls, STEP);
      acc -= STEP;
      guard++;
      // Edge-triggered inputs fire once per frame, not per step.
      controls.interactPressed = false;
      controls.punchPressed = false;
      controls.shootAt = null;
    }
    if (guard === 5) acc = 0;

    if (world.stats.missionsDone > lastMissionsDone) {
      lastMissionsDone = world.stats.missionsDone;
      audio.missionComplete();
    }
    if (world.busted) {
      audio.busted();
      screen = 'busted';
    } else if (world.wasted) {
      audio.busted();
      screen = 'wasted';
    } else if (world.won) {
      audio.missionComplete();
      screen = 'win';
    }

    const speed01 = world.player.inCar
      ? Math.abs(world.player.inCar.speed) / 560
      : Math.abs(world.player.speed) / 290;
    audio.update(dt, speed01, world.wanted.stars);
  }

  render(ctx, world, screen, { time: SHOT_MODE ? 1.25 : time, saveExists });
  input.endFrame();
}

requestAnimationFrame(frame);
