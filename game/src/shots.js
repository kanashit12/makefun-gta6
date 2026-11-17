// Deterministic screenshot scenes (?shot=start|drive|chase|mission).
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission, updateMission } from './missions.js';
import { stepWorld, tryEnterCar, exitCar } from './world.js';

const IDLE = {
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
};

function straightInput(tx, ty) {
  return {
    up: true,
    down: false,
    left: false,
    right: false,
    run: false,
    enter: false,
    punch: false,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: tx,
    mouseWorldY: ty,
  };
}

/**
 * An autopilot that drives toward a point along the road grid and then
 * keeps cruising straight past it. It latches "straight" the first time it
 * comes within 150 px of the target or passes it on the lane axis: without
 * the latch the steering flips as the target falls behind and the car turns
 * around on itself and wedges into a building.
 */
function makeCruiseInput(tx, ty) {
  let latched = false;
  let initialSign = 0;
  return function cruiseInput(world) {
    const p = world.state.player;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (initialSign === 0) initialSign = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : Math.sign(dy);
    const passed =
      Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) !== initialSign : Math.sign(dy) !== initialSign;
    if (latched || dist < 150 || passed) {
      latched = true;
      return straightInput(tx, ty);
    }
    // Steer toward the target but clamp the heading to the road's lane:
    // aiming straight at a near point makes the heading swing wildly.
    const horizontal = Math.abs(dx) > Math.abs(dy);
    const laneAngle = horizontal ? (dx > 0 ? 0 : Math.PI) : dy > 0 ? Math.PI / 2 : -Math.PI / 2;
    let want = Math.atan2(dy, dx);
    let laneDiff = want - laneAngle;
    while (laneDiff > Math.PI) laneDiff -= Math.PI * 2;
    while (laneDiff < -Math.PI) laneDiff += Math.PI * 2;
    laneDiff = Math.max(-0.45, Math.min(0.45, laneDiff));
    want = laneAngle + laneDiff;
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return {
      up: true,
      down: false,
      left: diff < -0.15,
      right: diff > 0.15,
      run: false,
      enter: false,
      punch: false,
      mouseDown: false,
      mouseX: 0,
      mouseY: 0,
      mouseWorldX: tx,
      mouseWorldY: ty,
    };
  };
}

function walkInput(world, tx, ty) {
  const p = world.state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  return {
    up: dy < -20,
    down: dy > 20,
    left: dx < -20,
    right: dx > 20,
    run: true,
    enter: false,
    punch: false,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: tx,
    mouseWorldY: ty,
  };
}

/** Put the player beside the first parked car and steal it. */
function stealFirstParked(world) {
  const car = world.state.cars.find((c) => c.parked);
  if (!car) return false;
  world.state.player.x = car.x + 30;
  world.state.player.y = car.y + 30;
  return tryEnterCar(world);
}

/** Put the stolen car on a road, facing along it, so the autopilot can cruise. */
function placeOnRoad(world, rxIndex, ryIndex, angle) {
  const p = world.state.player;
  const car = p.car;
  if (!car) return;
  const x = world.city.roadsX[rxIndex];
  const y = world.city.roadsY[ryIndex];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  p.x = x;
  p.y = y;
  p.angle = angle;
}

function runSteps(world, seconds, inputFn) {
  world.state.screen = 'play';
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, inputFn ? inputFn(world) : IDLE, STEP);
    updateMission(world, STEP);
    if (world.state.wasted || world.state.busted) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over the living city. drive: cruising the Neon Strip in a
 * stolen car. chase: three-star police pursuit. mission: mid-mission at
 * Club Flamingo with the objective beacon and HUD.
 */
export function stageShot(name, world) {
  const city = world.city;
  if (name === 'drive') {
    // Steal a parked car, pull onto the Strip boulevard, then cruise east.
    // Staged as a clean cruise: the heat from the theft has cooled off.
    stealFirstParked(world);
    world.state.wanted = 0;
    world.state.cops = [];
    placeOnRoad(world, 1, 2, 0);
    runSteps(world, 3.5, makeCruiseInput(city.roadsX[3], city.roadsY[2]));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    stealFirstParked(world);
    placeOnRoad(world, 1, 1, 0);
    // Three stars, then keep driving the boulevard while the patrol closes in.
    world.state.wanted = 3;
    world.state.wantedTimer = 0;
    runSteps(world, 5, makeCruiseInput(city.roadsX[5], city.roadsY[1]));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    startMission(world, 1);
    stealFirstParked(world);
    placeOnRoad(world, 2, 1, Math.PI / 2);
    // Cruise past the club at ~140 px so the pickup does not trigger yet:
    // the shot catches Mara on foot, about to grab the package, with the
    // beacon ring on Club Flamingo and the mission HUD live.
    runSteps(world, 1.2, makeCruiseInput(city.points.club.x, city.points.club.y + 140));
    exitCar(world);
    runSteps(world, 0.5, (w) => walkInput(w, city.points.club.x, city.points.club.y));
    return { screen: SCREEN_PLAY };
  }
  // Default: title screen over a living city.
  runSteps(world, 5, null);
  world.state.screen = 'title';
  return { screen: SCREEN_TITLE };
}
