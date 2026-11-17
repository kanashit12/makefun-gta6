// World state and simulation: player on foot / in car, traffic, pedestrians,
// police pursuit, wanted level, combat, money and pickups. Deterministic stepping.
import { WORLD, PLAYER, CAR, WANTED, CAR_MODELS, STEP } from './config.js';
import { mulberry32, range, pick } from './random.js';
import { buildCity, isOnRoad, nearestRoadPoint, collideBuildings } from './city.js';

export const EVENT_NONE = 0;
export const EVENT_BOUNTY = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_MISSION_DONE = 8;

const TAU = Math.PI * 2;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function createWorld(seed) {
  const city = buildCity(seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const state = {
    seed,
    time: 0,
    dayTime: 17.4, // golden hour, 17:24
    money: 250,
    health: PLAYER.maxHealth,
    wanted: 0,
    wantedTimer: 0,
    kills: 0,
    carsStolen: 0,
    distanceDriven: 0,
    missionsDone: 0,
    screen: 'title',
    message: '',
    messageTimer: 0,
    paused: false,
    busted: false,
    wasted: false,
    player: {
      x: city.points.home.x,
      y: city.points.home.y,
      angle: -Math.PI / 2,
      speed: 0,
      onFoot: true,
      car: null,
      punchTimer: 0,
      shootTimer: 0,
      invuln: 0,
    },
    cars: [],
    peds: [],
    cops: [],
    pickups: [],
    bullets: [],
    particles: [],
    mission: null,
    missionIndex: 0,
    stats: { shotsFired: 0, hits: 0 },
  };
  const world = { state, city, rng };
  spawnTraffic(world, 26);
  spawnPeds(world, 34);
  spawnPickups(world);
  return world;
}

function spawnTraffic(world, n) {
  const { state, city, rng } = world;
  for (let i = 0; i < n; i += 1) {
    const vertical = rng() < 0.5;
    const road = vertical
      ? pick(rng, city.roadsX)
      : pick(rng, city.roadsY);
    const along = range(rng, 60, (vertical ? WORLD.height : WORLD.width) - 60);
    const dir = rng() < 0.5 ? 1 : -1;
    const model = pick(rng, CAR_MODELS.filter((m) => m.price > 0));
    state.cars.push({
      id: `traffic-${i}`,
      x: vertical ? road + (dir > 0 ? 22 : -22) : along,
      y: vertical ? along : road + (dir > 0 ? 22 : -22),
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      speed: range(rng, 90, 170),
      model,
      traffic: true,
      color: model.color,
      brakeLight: false,
      stuck: 0,
    });
  }
  // Parked stealable cars
  for (let i = 0; i < city.parkingSpots.length; i += 1) {
    const spot = city.parkingSpots[i];
    state.cars.push({
      id: `parked-${i}`,
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      speed: 0,
      model: spot.model,
      traffic: false,
      parked: true,
      color: spot.model.color,
      brakeLight: false,
      stuck: 0,
    });
  }
}

function spawnPeds(world, n) {
  const { state, city, rng } = world;
  const palette = ['#e8b04b', '#7fb069', '#c96f4a', '#6a8caf', '#b06fa8', '#4ac9b0'];
  for (let i = 0; i < n; i += 1) {
    const x = range(rng, 80, WORLD.width - 80);
    const y = range(rng, 80, WORLD.height - 80);
    state.peds.push({
      x,
      y,
      angle: rng() * TAU,
      speed: range(rng, 28, 55),
      color: pick(rng, palette),
      panic: 0,
      target: null,
      walkPhase: rng() * TAU,
    });
  }
}

function spawnPickups(world) {
  const { state, city, rng } = world;
  const spots = [
    { x: 700, y: 1050, kind: 'cash', value: 150 },
    { x: 2100, y: 900, kind: 'cash', value: 200 },
    { x: 1200, y: 1900, kind: 'cash', value: 150 },
    { x: 3000, y: 1500, kind: 'health', value: 50 },
    { x: 900, y: 2200, kind: 'health', value: 50 },
    { x: 2600, y: 500, kind: 'cash', value: 300 },
    { x: 3400, y: 2000, kind: 'cash', value: 250 },
    { x: 1700, y: 300, kind: 'health', value: 50 },
  ];
  for (const s of spots) state.pickups.push({ ...s, taken: false, bob: rng() * TAU });
}

export function addWanted(world, stars) {
  const { state } = world;
  state.wanted = clamp(state.wanted + stars, 0, 5);
  state.wantedTimer = 0;
}

export function setMessage(world, text, seconds = 3) {
  world.state.message = text;
  world.state.messageTimer = seconds;
}

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.state.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function tryEnterCar(world) {
  const { state } = world;
  const p = state.player;
  if (!p.onFoot) return false;
  const car = nearestCar(world, p.x, p.y, 70);
  if (!car) return false;
  if (car.traffic && Math.abs(car.speed) > 20) return false;
  p.onFoot = false;
  p.car = car;
  car.traffic = false;
  car.parked = false;
  if (car.id.startsWith('parked') || car.id.startsWith('traffic')) {
    state.carsStolen += 1;
    addWanted(world, 1);
    setMessage(world, `Stole a ${car.model.name}! The cops noticed.`, 3);
  }
  return true;
}

export function exitCar(world) {
  const { state } = world;
  const p = state.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.angle = car.angle;
  p.onFoot = true;
  p.car = null;
  car.speed = 0;
  car.parked = true;
}

export function playerShoot(world) {
  const { state } = world;
  const p = state.player;
  if (!p.onFoot || p.shootTimer > 0) return;
  p.shootTimer = 0.28;
  state.stats.shotsFired += 1;
  state.bullets.push({
    x: p.x + Math.cos(p.angle) * 20,
    y: p.y + Math.sin(p.angle) * 20,
    vx: Math.cos(p.angle) * 900,
    vy: Math.sin(p.angle) * 900,
    life: 0.6,
  });
  addWanted(world, 0); // shooting in public draws heat only on hit
}

export function playerPunch(world) {
  const { state } = world;
  const p = state.player;
  if (!p.onFoot || p.punchTimer > 0) return;
  p.punchTimer = 0.35;
  const reach = 34;
  const hx = p.x + Math.cos(p.angle) * reach;
  const hy = p.y + Math.sin(p.angle) * reach;
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - hx, ped.y - hy) < 26) {
      ped.panic = 3;
      ped.x += Math.cos(p.angle) * 30;
      ped.y += Math.sin(p.angle) * 30;
      addWanted(world, 1);
      setMessage(world, 'You knocked someone down! Wanted level up.', 2.5);
      return;
    }
  }
}

function updatePlayer(world, input, dt) {
  const { state, city } = world;
  const p = state.player;
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootTimer = Math.max(0, p.shootTimer - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (p.onFoot) {
    let mx = 0;
    let my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || my !== 0;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (moving) {
      const len = Math.hypot(mx, my);
      const nx = p.x + (mx / len) * speed * dt;
      const ny = p.y + (my / len) * speed * dt;
      p.angle = Math.atan2(my, mx);
      if (!collideBuildings(city, nx, p.y, PLAYER.radius)) p.x = nx;
      if (!collideBuildings(city, p.x, ny, PLAYER.radius)) p.y = ny;
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, WORLD.height - 20);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    if (input.mouseDown) {
      p.angle = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);
      playerShoot(world);
    }
    if (input.punch) playerPunch(world);
    if (input.enter) tryEnterCar(world);
  } else if (p.car) {
    const car = p.car;
    const model = car.model;
    const maxSpeed = CAR.maxSpeed * model.speed;
    if (input.up) car.speed += CAR.accel * dt;
    else if (input.down) car.speed -= CAR.brake * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
    car.speed = clamp(car.speed, -CAR.maxReverse, maxSpeed);
    const turn = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    if (Math.abs(car.speed) > 5) {
      car.angle += turn * CAR.turnRate * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 200, 0.25, 1);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = collideBuildings(city, nx, ny, 26);
    if (hit) {
      if (Math.abs(car.speed) > 150) spawnCrash(world, car.x, car.y);
      car.speed *= -0.3;
    } else {
      car.x = nx;
      car.y = ny;
      state.distanceDriven += Math.abs(car.speed) * dt;
    }
    car.x = clamp(car.x, 30, WORLD.width - 30);
    car.y = clamp(car.y, 30, WORLD.height - 30);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    car.brakeLight = !!input.down;
    if (input.enter) exitCar(world);
    if (input.mouseDown) {
      // Drive-by: shoot from the car window
      p.angle = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);
      if (p.shootTimer <= 0) {
        p.shootTimer = 0.3;
        state.stats.shotsFired += 1;
        state.bullets.push({
          x: p.x + Math.cos(p.angle) * 24,
          y: p.y + Math.sin(p.angle) * 24,
          vx: Math.cos(p.angle) * 900,
          vy: Math.sin(p.angle) * 900,
          life: 0.6,
        });
      }
    }
  }
}

function spawnCrash(world, x, y) {
  for (let i = 0; i < 8; i += 1) {
    world.state.particles.push({
      x,
      y,
      vx: (world.rng() - 0.5) * 260,
      vy: (world.rng() - 0.5) * 260,
      life: 0.5,
      color: '#ffb02e',
      size: 3 + world.rng() * 4,
    });
  }
}

function updateTraffic(world, dt) {
  const { state, city, rng } = world;
  for (const car of state.cars) {
    if (!car.traffic) continue;
    const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
    // Slow down if a car is ahead on the same lane
    let blocked = false;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 30) {
        blocked = true;
        break;
      }
    }
    const target = blocked ? 0 : 150;
    car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the city edge
    if (car.x < -80) car.x = WORLD.width + 70;
    if (car.x > WORLD.width + 80) car.x = -70;
    if (car.y < -80) car.y = WORLD.height + 70;
    if (car.y > WORLD.height + 80) car.y = -70;
    // Keep on its road: nudge back if drifted (traffic never drifts, but safety)
    if (!isOnRoad(city, car.x, car.y)) {
      const near = nearestRoadPoint(city, car.x, car.y);
      car.x = near.x;
      car.y = near.y;
    }
    void rng;
  }
}

function updatePeds(world, dt) {
  const { state, city, rng } = world;
  const p = state.player;
  for (const ped of state.peds) {
    ped.walkPhase += dt * 6;
    const distP = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = angleLerp(ped.angle, away, 0.2);
      ped.speed = 130;
    } else if (distP < 60 && !p.onFoot && Math.abs(p.speed) > 100) {
      ped.panic = 2;
    } else {
      ped.speed = 42;
      if (rng() < dt * 0.15) ped.angle = rng() * TAU;
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!collideBuildings(city, nx, ny, 10)) {
      ped.x = nx;
      ped.y = ny;
    } else if (!collideBuildings(city, nx, ped.y, 10)) {
      ped.x = nx;
    } else if (!collideBuildings(city, ped.x, ny, 10)) {
      ped.y = ny;
    }
    ped.x = clamp(ped.x, 20, WORLD.width - 20);
    ped.y = clamp(ped.y, 20, WORLD.height - 20);
    // Run over by the player's car
    if (!p.onFoot && p.car && Math.abs(p.speed) > 120) {
      if (Math.hypot(ped.x - p.x, ped.y - p.y) < 34) {
        ped.panic = 4;
        ped.x += Math.cos(p.angle) * 60;
        ped.y += Math.sin(p.angle) * 60;
        addWanted(world, 1);
        setMessage(world, 'Pedestrian hit! Wanted level up.', 2.5);
      }
    }
  }
}

function updateCops(world, dt) {
  const { state, rng } = world;
  const p = state.player;
  const level = WANTED.levels[state.wanted];
  // Spawn cops up to the wanted level's count
  if (state.cops.length < level.cars && state.wanted > 0) {
    const a = rng() * TAU;
    const d = 700;
    state.cops.push({
      x: clamp(p.x + Math.cos(a) * d, 40, WORLD.width - 40),
      y: clamp(p.y + Math.sin(a) * d, 40, WORLD.height - 40),
      angle: a,
      speed: 0,
      siren: rng() * TAU,
    });
  }
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    cop.siren += dt * 6;
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    cop.angle = angleLerp(cop.angle, want, clamp(dt * 2.2, 0, 1));
    cop.speed = clamp(cop.speed + 300 * dt, 0, level.speed);
    const cnx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const cny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    // Cops respect buildings too: slide along them instead of driving through.
    if (!collideBuildings(world.city, cnx, cny, 24)) {
      cop.x = cnx;
      cop.y = cny;
    } else if (!collideBuildings(world.city, cnx, cop.y, 24)) {
      cop.x = cnx;
    } else if (!collideBuildings(world.city, cop.x, cny, 24)) {
      cop.y = cny;
    } else {
      cop.speed *= 0.5;
    }
    // Cop rams the player (at most once every 0.9s per cop)
    if (dist < 46) {
      cop.ramTimer = (cop.ramTimer || 0) - dt;
      if (cop.ramTimer <= 0) {
        cop.ramTimer = 0.9;
        if (p.onFoot) {
          if (p.invuln <= 0) {
            state.health -= 12;
            p.invuln = 0.8;
            if (state.health <= 0) {
              state.health = 0;
              state.wasted = true;
              return EVENT_WASTED;
            }
          }
        } else if (p.car) {
          p.car.speed *= 0.55;
          cop.speed *= 0.4;
          spawnCrash(world, cop.x, cop.y);
        }
      }
    }
    // Cop busted the player on foot at close range for a while
    if (dist < 40 && p.onFoot && state.wanted >= 1) {
      cop.bustTimer = (cop.bustTimer || 0) + dt;
      if (cop.bustTimer > 1.6) {
        state.busted = true;
        return EVENT_BUSTED;
      }
    } else {
      cop.bustTimer = 0;
    }
    // Despawn far cops when wanted drops
    if (state.wanted === 0 || dist > 1600) {
      state.cops.splice(i, 1);
    }
  }
  return EVENT_NONE;
}

function updateBullets(world, dt) {
  const { state } = world;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 16) {
        ped.panic = 4;
        ped.x += b.vx * 0.02;
        ped.y += b.vy * 0.02;
        state.stats.hits += 1;
        state.kills += 1;
        addWanted(world, 1);
        setMessage(world, 'Shot fired in public! Wanted level up.', 2.5);
        dead = true;
        break;
      }
    }
    if (!dead) {
      for (const cop of state.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 22) {
          state.stats.hits += 1;
          addWanted(world, 1);
          cop.speed *= 0.5;
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function updatePickups(world, dt) {
  const { state } = world;
  const p = state.player;
  for (const pk of state.pickups) {
    pk.bob += dt * 3;
    if (pk.taken) continue;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < 40) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        state.money += pk.value;
        setMessage(world, `Picked up $${pk.value} in cash.`, 2.5);
      } else {
        state.health = Math.min(PLAYER.maxHealth, state.health + pk.value);
        setMessage(world, `Health +${pk.value}.`, 2.5);
      }
    }
  }
}

function updateWanted(world, dt) {
  const { state } = world;
  if (state.wanted > 0) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= WANTED.decaySeconds) {
      state.wanted -= 1;
      state.wantedTimer = 0;
      setMessage(world, 'The heat is cooling off…', 2.5);
    }
  }
}

function updateParticles(world, dt) {
  const { state } = world;
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
}

/** Advance the simulation one fixed step. Returns an event bitmask. */
export function stepWorld(world, input, dt = STEP) {
  const { state } = world;
  state.time += dt;
  state.dayTime = (17.4 + state.time / 240) % 24; // slow drift toward evening
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.screen !== 'play') return EVENT_NONE;
  updatePlayer(world, input, dt);
  updateTraffic(world, dt);
  updatePeds(world, dt);
  const copEvent = updateCops(world, dt);
  if (copEvent !== EVENT_NONE) return copEvent;
  updateBullets(world, dt);
  updatePickups(world, dt);
  updateWanted(world, dt);
  updateParticles(world, dt);
  return EVENT_NONE;
}

export function resetRun(world) {
  const fresh = createWorld(world.state.seed);
  world.state = fresh.state;
  world.city = fresh.city;
  world.rng = fresh.rng;
}

export function playerPos(world) {
  return { x: world.state.player.x, y: world.state.player.y };
}
