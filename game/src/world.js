// Sunset Streets — the simulation: world creation, player on foot and
// in a car, traffic, pedestrians, police, bullets, pickups, wanted level,
// particles, messages, entering and exiting cars, shooting, punching,
// and the fixed-step update (1/60 s).

import { CAR, CAR_MODELS, HEAT_COOLDOWN, MAX_WANTED, PLAYER, WANTED, WORLD } from './config.js';
import { districtAt, generateCity, isOnRoad, nearestIntersection, resolveCarBuildings, resolveCircleBuildings } from './city.js';
import { angleDiff, clamp, dist, mulberry32, pick, range, rangeInt } from './random.js';
import { advanceMission } from './missions.js';

const DT = 1 / 60;

function makeCar(x, y, angle, model, extra = {}) {
  return {
    x, y, angle, speed: 0, model,
    hp: 100, smoke: 0, wrecked: false,
    axis: 'v', dir: 1, turnCooldown: 0, stuck: 0,
    ...extra,
  };
}

function randomRoadPoint(rng, city) {
  if (rng() < 0.5) {
    const cx = pick(rng, city.roads.v);
    return { x: cx + range(rng, -30, 30), y: range(rng, 80, WORLD.height - 80), vertical: true, centre: cx };
  }
  const cy = pick(rng, city.roads.h);
  return { x: range(rng, 80, WORLD.width - 80), y: cy + range(rng, -30, 30), vertical: false, centre: cy };
}

export function createWorld() {
  const city = generateCity(WORLD.seed);
  const rng = mulberry32(WORLD.seed ^ 0x9e3779b9);

  // Mara starts on foot outside her apartment on the Strip.
  const player = {
    x: 1296, y: 520, angle: -Math.PI / 2, speed: 0,
    health: PLAYER.health, cash: 250, inCar: null,
    punchCooldown: 0, shootCooldown: 0, invuln: 0,
  };

  // Parked cars all over the city — free to steal.
  const parked = [];
  const usedSpots = [];
  for (let i = 0; i < 46; i++) {
    const p = randomRoadPoint(rng, city);
    const along = p.vertical ? p.y : p.x;
    const key = `${p.vertical ? 'v' : 'h'}:${Math.round(p.centre)}:${Math.round(along / 120)}`;
    if (usedSpots.includes(key)) continue;
    usedSpots.push(key);
    const side = rng() < 0.5 ? -1 : 1;
    parked.push(makeCar(
      p.vertical ? p.centre + side * 34 : p.x,
      p.vertical ? p.y : p.centre + side * 34,
      p.vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
      pick(rng, CAR_MODELS.filter((m) => m.id !== 'police')),
      { parked: true },
    ));
  }

  // Traffic: 26 cars driving the road network.
  const traffic = [];
  for (let i = 0; i < 26; i++) {
    const p = randomRoadPoint(rng, city);
    const dir = rng() < 0.5 ? -1 : 1;
    traffic.push(makeCar(
      p.x, p.y,
      p.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      pick(rng, CAR_MODELS.filter((m) => m.id !== 'police')),
      {
        traffic: true, axis: p.vertical ? 'v' : 'h', dir,
        speed: range(rng, 90, 150), turnCooldown: range(rng, 0, 3),
      },
    ));
  }

  // Pedestrians: 34 people walking the sidewalks.
  const pedestrians = [];
  for (let i = 0; i < 34; i++) {
    const p = randomRoadPoint(rng, city);
    const dir = rng() < 0.5 ? -1 : 1;
    const off = (rng() < 0.5 ? -1 : 1) * range(rng, 58, 72);
    pedestrians.push({
      x: p.vertical ? p.centre + off : p.x,
      y: p.vertical ? p.y : p.centre + off,
      angle: p.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: range(rng, 34, 62), panic: 0, panicX: 0, panicY: 0,
      axis: p.vertical ? 'v' : 'h', dir,
      color: pick(rng, ['#e8d44d', '#4dd2e8', '#e87fb0', '#7fe89a', '#e8a04d', '#b07fe8', '#e8e8e8']),
      turnCooldown: range(rng, 0, 4),
    });
  }

  // Cash and health pickups scattered around the city.
  const pickups = [];
  for (let i = 0; i < 26; i++) {
    const p = randomRoadPoint(rng, city);
    const kind = rng() < 0.6 ? 'cash' : 'health';
    pickups.push({
      x: p.x, y: p.y, kind,
      amount: kind === 'cash' ? rangeInt(rng, 40, 150) : 30,
      respawn: 0, taken: false,
    });
  }

  return {
    city, rng, time: 0,
    player, parked, traffic, pedestrians, pickups,
    police: [], bullets: [], particles: [],
    messages: [],
    wanted: { stars: 0, heat: 0, spawn: 0 },
    mission: { active: false, index: 0, stage: 0, timer: 0, done: [false, false, false, false, false], failed: false },
    busted: false, wasted: false, won: false,
    stats: { carsStolen: 0, shotsFired: 0, missionsDone: 0 },
    shake: 0,
  };
}

export function toast(world, text, ttl = 4) {
  world.messages.push({ text, t: 0, ttl });
  if (world.messages.length > 4) world.messages.shift();
}

export function addCrime(world, stars) {
  const w = world.wanted;
  const wasZero = w.stars === 0;
  w.stars = clamp(w.stars + stars, 0, MAX_WANTED);
  w.heat = 0;
  // The first patrol car takes a full spawn interval to arrive.
  if (wasZero && w.stars > 0) w.spawn = WANTED[w.stars].interval;
}

function spawnParticles(world, x, y, color, count, speed, life = 0.6) {
  for (let i = 0; i < count; i++) {
    const a = world.rng() * Math.PI * 2;
    const s = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: range(world.rng, life * 0.5, life), maxLife: life,
      color, size: range(world.rng, 2, 5),
    });
  }
}

// --- entering / exiting cars -------------------------------------------

export function nearestParkedCar(world, maxDist) {
  const p = world.player;
  let best = null;
  let bd = maxDist;
  for (const car of world.parked) {
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function enterCar(world, car) {
  const p = world.player;
  world.parked = world.parked.filter((c) => c !== car);
  car.parked = false;
  car.traffic = false;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  world.stats.carsStolen++;
  addCrime(world, 1);
  toast(world, `Stole a ${car.model.name} — the law noticed. (+1★)`);
}

export function exitCar(world) {
  const p = world.player;
  const car = p.inCar;
  if (!car) return;
  const sideX = Math.cos(p.angle + Math.PI / 2);
  const sideY = Math.sin(p.angle + Math.PI / 2);
  let px = car.x + sideX * 34;
  let py = car.y + sideY * 34;
  const fixed = resolveCircleBuildings(world.city, px, py, PLAYER.radius + 2);
  px = fixed.x; py = fixed.y;
  car.parked = true;
  car.speed = 0;
  world.parked.push(car);
  p.inCar = null;
  p.x = px; p.y = py;
  p.speed = 0;
}

// --- combat ------------------------------------------------------------

export function shoot(world, tx, ty) {
  const p = world.player;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = 0.28;
  world.stats.shotsFired++;
  const ox = p.inCar ? p.inCar.x : p.x;
  const oy = p.inCar ? p.inCar.y : p.y;
  const angle = Math.atan2(ty - oy, tx - ox);
  const gx = ox + Math.cos(angle) * 26;
  const gy = oy + Math.sin(angle) * 26;
  world.bullets.push({ x: gx, y: gy, angle, speed: 780, life: 0.9, fromPlayer: true });
  spawnParticles(world, gx, gy, '#ffd76a', 4, 120, 0.15);
  if (p.inCar) p.inCar.speed *= 0.995;
  // Nearby pedestrians panic at the gunshot.
  for (const ped of world.pedestrians) {
    if (dist(ped.x, ped.y, ox, oy) < 320) {
      ped.panic = 3;
      ped.panicX = ox; ped.panicY = oy;
    }
  }
}

export function punch(world) {
  const p = world.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.38;
  const ox = p.inCar ? p.inCar.x : p.x;
  const oy = p.inCar ? p.inCar.y : p.y;
  const rangePx = 46;
  const hit = (car) => {
    const d = dist(ox, oy, car.x, car.y);
    if (d > rangePx + 20) return;
    const a = Math.atan2(car.y - oy, car.x - ox);
    if (Math.abs(angleDiff(p.angle, a)) > 1.1) return;
    car.hp -= 20;
    car.speed *= 0.6;
    spawnParticles(world, car.x, car.y, '#ffffff', 6, 160, 0.3);
    if (car.police) addCrime(world, 1);
  };
  for (const car of world.police) hit(car);
  for (const car of world.traffic) hit(car);
  for (const car of world.parked) hit(car);
}

// --- per-system updates -------------------------------------------------

function updatePlayerOnFoot(world, input, dt) {
  const p = world.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, 20, WORLD.width - 20);
  p.y = clamp(p.y, 20, WORLD.height - 20);
  const fixed = resolveCircleBuildings(world.city, p.x, p.y, PLAYER.radius);
  p.x = fixed.x; p.y = fixed.y;
  if (input.mouseX !== undefined) {
    p.aimAngle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);
  }
}

function updatePlayerCar(world, input, dt) {
  const p = world.player;
  const car = p.inCar;
  const top = CAR.topSpeed * car.model.speed;
  const revTop = CAR.reverseTop * car.model.speed;
  if (input.up) car.speed += CAR.accel * dt;
  else if (input.down) {
    if (car.speed > 10) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.accel * 0.55 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 260 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -revTop, top);
  const turnInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.angle += turnInput * CAR.turnRate * dirSign * clamp(Math.abs(car.speed) / 120, 0, 1) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCarBuildings(world.city, nx, ny, car.angle, CAR.length / 2 - 6, 15);
  const hitWall = fixed.blocked;
  if (hitWall && Math.abs(car.speed) > 220) {
    spawnParticles(world, nx, ny, '#ffb02e', 14, 260, 0.7);
    spawnParticles(world, nx, ny, '#ffffff', 6, 180, 0.4);
    car.hp -= Math.round(Math.abs(car.speed) / 40);
    world.shake = Math.min(10, world.shake + 5);
    car.speed *= -0.25;
    if (car.hp <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      toast(world, 'Your ride is wrecked. Get out and find another.');
    }
  }
  car.x = clamp(fixed.x, 20, WORLD.width - 20);
  car.y = clamp(fixed.y, 20, WORLD.height - 20);
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  if (car.wrecked) car.speed = 0;
  if (Math.abs(car.speed) > 300) car.smoke = Math.max(car.smoke, 0.4);
  if (car.hp < 40) car.smoke = Math.max(car.smoke, 0.5);
}

function carAhead(world, car, maxDist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = maxDist;
  const all = [...world.traffic, ...world.police];
  if (world.player.inCar && world.player.inCar !== car) all.push(world.player.inCar);
  for (const other of all) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 10 || along > maxDist) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 34 && along < best) best = along;
  }
  return best;
}

function updateTraffic(world, dt) {
  const city = world.city;
  for (const car of world.traffic) {
    car.turnCooldown -= dt;
    // Lane: right-hand side of the road.
    const laneCentre = car.axis === 'v'
      ? nearestCentreOf(city.roads.v, car.x) + car.dir * 20
      : nearestCentreOf(city.roads.h, car.y) + car.dir * 20;
    const inter = nearestIntersection(city, car.x, car.y, 42);
    if (inter && car.turnCooldown <= 0 && world.rng() < 0.012) {
      // Turn onto the crossing road.
      const newAxis = car.axis === 'v' ? 'h' : 'v';
      const newDir = world.rng() < 0.5 ? -1 : 1;
      car.axis = newAxis;
      car.dir = newDir;
      car.turnCooldown = 2.5;
    }
    const ahead = carAhead(world, car, 110);
    let targetSpeed = 150 * car.model.speed;
    if (ahead < 110) targetSpeed = Math.min(targetSpeed, 40 + ahead * 0.5);
    if (car.speed < targetSpeed) car.speed += 260 * dt;
    else car.speed -= 320 * dt;
    car.speed = clamp(car.speed, 0, 220 * car.model.speed);
    // Steer toward the lane line ahead.
    let desired;
    if (car.axis === 'v') {
      const dx = (laneCentre - car.x) * 0.6;
      desired = Math.atan2(car.dir * 100, dx);
    } else {
      const dy = (laneCentre - car.y) * 0.6;
      desired = Math.atan2(dy, car.dir * 100);
    }
    const diff = angleDiff(car.angle, desired);
    car.angle += clamp(diff, -3.2 * dt, 3.2 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = resolveCarBuildings(city, nx, ny, car.angle, CAR.length / 2 - 6, 15);
    car.x = clamp(fixed.x, 20, WORLD.width - 20);
    car.y = clamp(fixed.y, 20, WORLD.height - 20);
    if (fixed.blocked) {
      car.speed *= 0.5;
      car.angle += (world.rng() < 0.5 ? -1 : 1) * 0.6 * dt * 10;
    }
    // World edge: turn around.
    if (car.x < 90 || car.x > WORLD.width - 90 || car.y < 90 || car.y > WORLD.height - 90) {
      car.dir *= -1;
      car.angle += Math.PI;
    }
  }
}

function nearestCentreOf(list, v) {
  let best = list[0];
  let bd = Math.abs(v - best);
  for (const c of list) {
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function updatePedestrians(world, input, dt) {
  const city = world.city;
  const px = world.player.x;
  const py = world.player.y;
  const playerCar = world.player.inCar;
  for (const ped of world.pedestrians) {
    ped.turnCooldown -= dt;
    if (ped.panic > 0) {
      ped.panic -= dt;
      const a = Math.atan2(ped.y - ped.panicY, ped.x - ped.panicX);
      ped.angle = a;
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
    } else {
      // A fast car bearing down on them causes panic.
      if (playerCar && Math.abs(playerCar.speed) > 260) {
        const d = dist(ped.x, ped.y, px, py);
        if (d < 110) {
          ped.panic = 2.5;
          ped.panicX = px; ped.panicY = py;
          continue;
        }
      }
      const inter = nearestIntersection(city, ped.x, ped.y, 30);
      if (inter && ped.turnCooldown <= 0 && world.rng() < 0.01) {
        ped.axis = ped.axis === 'v' ? 'h' : 'v';
        ped.dir = world.rng() < 0.5 ? -1 : 1;
        ped.turnCooldown = 3;
      }
      ped.angle = ped.axis === 'v'
        ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (ped.dir > 0 ? 0 : Math.PI);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = clamp(ped.x, 20, WORLD.width - 20);
    ped.y = clamp(ped.y, 20, WORLD.height - 20);
    const fixed = resolveCircleBuildings(city, ped.x, ped.y, 10);
    ped.x = fixed.x; ped.y = fixed.y;
  }
}

function updatePolice(world, dt) {
  const w = world.wanted;
  const level = WANTED[w.stars];
  const p = world.player;
  // Spawn new patrol cars while wanted.
  if (w.stars > 0) {
    w.spawn -= dt;
    if (w.spawn <= 0 && world.police.length < level.maxCops) {
      w.spawn = level.interval;
      const a = world.rng() * Math.PI * 2;
      let sx = p.x + Math.cos(a) * 620;
      let sy = p.y + Math.sin(a) * 620;
      sx = clamp(sx, 90, WORLD.width - 90);
      sy = clamp(sy, 90, WORLD.height - 90);
      const spot = randomRoadPoint(world.rng, world.city);
      const car = makeCar(spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x),
        CAR_MODELS.find((m) => m.id === 'police'),
        { police: true, speed: 200 });
      world.police.push(car);
      toast(world, 'Vice Patrol is on you!', 2.5);
    }
  }
  // Chase: steer at the player, ram the player's car, bust on foot.
  for (const car of world.police) {
    const d = dist(car.x, car.y, p.x, p.y);
    const desired = Math.atan2(p.y - car.y, p.x - car.x);
    const diff = angleDiff(car.angle, desired);
    car.angle += clamp(diff, -3.6 * dt, 3.6 * dt);
    // Pull up slowly when the player is on foot, so a bust can happen.
    const top = !p.inCar && d < 140 ? 90 : level.topSpeed;
    if (car.speed < top) car.speed += 620 * dt;
    else car.speed -= 200 * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = resolveCarBuildings(world.city, nx, ny, car.angle, CAR.length / 2 - 6, 15);
    car.x = clamp(fixed.x, 20, WORLD.width - 20);
    car.y = clamp(fixed.y, 20, WORLD.height - 20);
    if (fixed.blocked) car.speed *= 0.6;
    // Ram the player's car.
    if (p.inCar && d < 52 && Math.abs(car.speed) > 120) {
      const push = Math.atan2(p.y - car.y, p.x - car.x);
      p.inCar.x += Math.cos(push) * 26 * dt * 4;
      p.inCar.y += Math.sin(push) * 26 * dt * 4;
      p.inCar.hp -= 1;
      p.inCar.speed *= 0.92;
      world.shake = Math.min(10, world.shake + 3);
      spawnParticles(world, p.x, p.y, '#ffb02e', 5, 200, 0.4);
      if (p.inCar.hp <= 0 && !p.inCar.wrecked) {
        p.inCar.wrecked = true;
        p.inCar.speed = 0;
        toast(world, 'Your ride is wrecked. Run!');
      }
    }
    // Bust the player on foot when a patrol car pulls up close.
    if (!p.inCar && d < 46 && car.speed < 160 && p.invuln <= 0) {
      world.busted = true;
    }
    if (car.hp <= 0) {
      spawnParticles(world, car.x, car.y, '#ff6a2e', 26, 320, 0.9);
      spawnParticles(world, car.x, car.y, '#555555', 16, 160, 1.2);
      world.police = world.police.filter((c) => c !== car);
      toast(world, 'Patrol car down! The heat is on.', 3);
    }
  }
  // Heat cools off: 45 s with no new crime drops one star.
  if (w.stars > 0) {
    w.heat += dt;
    if (w.heat >= HEAT_COOLDOWN) {
      w.stars--;
      w.heat = 0;
      toast(world, w.stars === 0 ? 'You lost them. Heat is off.' : `Heat dropping — ${w.stars} star${w.stars > 1 ? 's' : ''} left.`);
    }
  }
  // No heat, no pursuit: patrol cars stand down. When stars drop, the
  // extra cars beyond the new level's cap peel off too.
  if (w.stars === 0) {
    if (world.police.length > 0) world.police = [];
  } else if (world.police.length > level.maxCops) {
    world.police.sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    world.police = world.police.slice(0, level.maxCops);
  }
}

function updateBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
    if (!dead) {
      const hitCar = (car, isPolice) => {
        if (dist(b.x, b.y, car.x, car.y) < 30) {
          car.hp -= 25;
          car.speed *= 0.85;
          spawnParticles(world, b.x, b.y, '#ffd76a', 8, 200, 0.35);
          if (isPolice) addCrime(world, 1);
          else addCrime(world, 1);
          return true;
        }
        return false;
      };
      for (const car of world.police) if (hitCar(car, true)) { dead = true; break; }
      if (!dead) for (const car of world.traffic) if (hitCar(car, false)) { dead = true; break; }
      if (!dead) {
        for (const car of world.parked) {
          if (dist(b.x, b.y, car.x, car.y) < 30) {
            car.hp -= 25;
            spawnParticles(world, b.x, b.y, '#ffd76a', 8, 200, 0.35);
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) world.bullets = world.bullets.filter((x) => x !== b);
  }
}

function updatePickups(world, dt) {
  const p = world.player;
  for (const pk of world.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        pk.taken = false;
        const spot = randomRoadPoint(world.rng, world.city);
        pk.x = spot.x; pk.y = spot.y;
      }
      continue;
    }
    const reach = p.inCar ? 44 : 32;
    if (dist(p.x, p.y, pk.x, pk.y) < reach) {
      pk.taken = true;
      pk.respawn = 45;
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        toast(world, `Picked up $${pk.amount}.`, 2);
      } else {
        p.health = clamp(p.health + pk.amount, 0, PLAYER.health);
        toast(world, `+${pk.amount} health.`, 2);
      }
      spawnParticles(world, pk.x, pk.y, pk.kind === 'cash' ? '#7fe89a' : '#ff6a8a', 10, 140, 0.5);
    }
  }
}

function collideCars(world) {
  const cars = [
    ...world.traffic,
    ...world.police,
    ...(world.player.inCar ? [world.player.inCar] : []),
    ...world.parked,
  ];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 48 || d < 0.01) continue;
      const overlap = (48 - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      const relSpeed = Math.abs(a.speed - b.speed);
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
      if (relSpeed > 180) {
        spawnParticles(world, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffb02e', 10, 240, 0.5);
        a.speed *= 0.7; b.speed *= 0.7;
        if (a === world.player.inCar || b === world.player.inCar) {
          world.shake = Math.min(10, world.shake + 4);
          if (relSpeed > 320) {
            world.player.health -= Math.round((relSpeed - 300) / 30);
            if (world.player.health <= 0) world.wasted = true;
          }
        }
      } else {
        a.speed *= 0.96; b.speed *= 0.96;
      }
    }
  }
}

function updateParticles(world, dt) {
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);
}

// --- the fixed-step update ---------------------------------------------

export function updateWorld(world, input, dt = DT) {
  world.time += dt;
  const p = world.player;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 22);

  if (input.interactPressed) {
    if (p.inCar) exitCar(world);
    else {
      const car = nearestParkedCar(world, 78);
      if (car) enterCar(world, car);
    }
  }
  if (input.punchPressed) punch(world);
  if (input.shootAt) shoot(world, input.shootAt.x, input.shootAt.y);

  if (p.inCar) updatePlayerCar(world, input, dt);
  else updatePlayerOnFoot(world, input, dt);

  updateTraffic(world, dt);
  updatePedestrians(world, input, dt);
  updatePolice(world, dt);
  updateBullets(world, dt);
  updatePickups(world, dt);
  collideCars(world);
  updateParticles(world, dt);

  for (const m of world.messages) m.t += dt;
  world.messages = world.messages.filter((m) => m.t < m.ttl);

  advanceMission(world, dt);

  if (p.health <= 0) world.wasted = true;
  if (world.mission.done.every(Boolean)) world.won = true;
}

export { CAR, PLAYER, WORLD };
