// Sunset Streets — deterministic screenshot scenes.
// ?shot=start|drive|chase|mission stages the exact same frame from the
// fixed seed every time: the player and cars are placed, then the
// simulation runs forward a fixed number of steps with scripted inputs.

import { CAR_MODELS } from './config.js';
import { landmarkById } from './city.js';
import { enterCar, updateWorld } from './world.js';
import { startNextMission } from './missions.js';
import { dist } from './random.js';

const STEP = 1 / 60;

function idle(world, steps) {
  const blank = { up: false, down: false, left: false, right: false, run: false };
  for (let i = 0; i < steps; i++) updateWorld(world, blank, STEP);
}

function driveInput(up, left, right) {
  return { up, down: false, left, right, run: false };
}

function nearestParkedTo(world, x, y) {
  let best = null;
  let bd = Infinity;
  for (const car of world.parked) {
    const d = dist(car.x, car.y, x, y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

// Stage a stolen car at an exact road spot: take the nearest parked car,
// move it onto the staging lane, and steal it. (Parked-car placement is
// random, so a staged scene must not depend on one being parked exactly
// where the shot needs it.)
function stageCarAt(world, x, y, angle, modelId) {
  const car = nearestParkedTo(world, x, y);
  if (!car) return null;
  if (modelId) car.model = CAR_MODELS.find((m) => m.id === modelId) ?? car.model;
  car.x = x;
  car.y = y;
  car.angle = angle;
  world.player.x = x;
  world.player.y = y;
  enterCar(world, car);
  car.hp = 1000; // the shot must not end in a wreck
  car.angle = angle;
  world.player.angle = angle;
  return car;
}

function spawnPoliceNear(world, px, py, count) {
  const policeModel = CAR_MODELS.find((m) => m.id === 'police');
  // Behind the player (west — the player drives east), far enough to
  // chase rather than instantly ram.
  const spots = [
    { dx: -430, dy: 70 }, { dx: -380, dy: -170 }, { dx: -540, dy: -30 },
    { dx: -460, dy: 190 }, { dx: -620, dy: 90 },
  ];
  for (let i = 0; i < count; i++) {
    const s = spots[i % spots.length];
    world.police.push({
      x: px + s.dx, y: py + s.dy,
      angle: Math.atan2(py - (py + s.dy), px - (px + s.dx)),
      speed: 300, model: policeModel, hp: 100, smoke: 0, wrecked: false,
      police: true, axis: 'v', dir: 1, turnCooldown: 0, stuck: 0,
    });
  }
}

export function stageShot(world, name) {
  if (name === 'start') {
    // Title screen over the living city: Mara on foot near Club Flamingo.
    world.player.x = 880;
    world.player.y = 560;
    world.player.angle = -Math.PI / 2;
    idle(world, 150);
  } else if (name === 'drive') {
    // Cruising the Neon Strip in a stolen car: south down road x=464,
    // ending mid-block in the Strip with neon all around.
    stageCarAt(world, 484, 120, Math.PI / 2);
    for (let i = 0; i < 90; i++) updateWorld(world, driveInput(true, false, false), STEP);
  } else if (name === 'chase') {
    // A three-star Vice Patrol pursuit in progress: east along road y=464,
    // in the fastest car, with patrol cars closing in from behind.
    stageCarAt(world, 700, 484, 0, 'racer');
    world.wanted.stars = 3;
    world.wanted.heat = 0;
    world.wanted.spawn = 3;
    spawnPoliceNear(world, world.player.x, world.player.y, 3);
    for (let i = 0; i < 150; i++) {
      // Weave gently: straight, then a left lean, then straight.
      const right = i > 70 && i < 100;
      updateWorld(world, driveInput(true, false, right), STEP);
    }
  } else if (name === 'mission') {
    // Mid-mission at Club Flamingo: the Club Pickup job is active.
    world.mission.done[0] = true; // First Ride already done
    startNextMission(world); // starts Club Pickup
    const club = landmarkById('flamingo');
    world.player.x = club.x;
    world.player.y = club.y + 120;
    world.player.angle = -Math.PI / 2;
    world.player.cash = 1250;
    idle(world, 90);
  } else {
    idle(world, 60);
  }
  // Freeze any camera shake so the frame is identical every render.
  world.shake = 0;
  world.messages = world.messages.filter((m) => m.text.length > 0).slice(0, 3);
}
