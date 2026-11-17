// Sunset Streets — drawing: camera, city and entity drawing, cars,
// pedestrians, the player, the HUD (cash, health, stars, district,
// objective, timer, toasts), the live minimap, and the title, pause,
// busted, wasted and win screens with their overlays.

import { CAR, DISTRICTS, VIEW, WORLD } from './config.js';
import { districtAt } from './city.js';
import { clamp } from './random.js';
import { missionObjectiveText, missionTargetPoint, currentMission } from './missions.js';

export function cameraFor(world) {
  const p = world.player;
  let lx = 0;
  let ly = 0;
  if (p.inCar) {
    const look = clamp(Math.abs(p.inCar.speed) * 0.14, 0, 95);
    lx = Math.cos(p.angle) * look;
    ly = Math.sin(p.angle) * look;
  } else {
    lx = Math.cos(p.angle) * 26;
    ly = Math.sin(p.angle) * 26;
  }
  const cx = clamp(p.x + lx - VIEW.width / 2, 0, WORLD.width - VIEW.width);
  const cy = clamp(p.y + ly - VIEW.height / 2, 0, WORLD.height - VIEW.height);
  const shakeX = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
  const shakeY = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
  return { x: cx + shakeX, y: cy + shakeY };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = CAR.length;
  const W = CAR.width;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 9);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.model.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, -L / 2 + 6, -W / 2 + 3, L - 12, 7, 4);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = car.wrecked ? '#222222' : '#10151f';
  roundRect(ctx, -8, -W / 2 + 4, 18, W - 8, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,255,0.5)';
  ctx.fillRect(8, -W / 2 + 5, 3, W - 10);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
  // Taillights.
  ctx.fillStyle = '#ff2e3e';
  ctx.fillRect(-L / 2, -W / 2 + 3, 3, 5);
  ctx.fillRect(-L / 2, W / 2 - 8, 3, 5);
  if (car.police) {
    const phase = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e3e' : '#2e7bff';
    ctx.fillRect(-14, -W / 2 + 2, 10, 5);
    ctx.fillStyle = phase ? '#2e7bff' : '#ff2e3e';
    ctx.fillRect(-14, W / 2 - 7, 10, 5);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VICE', 2, 3);
  }
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(-L / 2 - 6, 0, 8 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorldScene(ctx, world, cam, time) {
  const city = world.city;
  const vx0 = cam.x;
  const vy0 = cam.y;
  const vx1 = cam.x + VIEW.width;
  const vy1 = cam.y + VIEW.height;

  ctx.fillStyle = '#14101f';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // District ground.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  // Sunset tint on the ground: warm wash near the top of the map.
  const wash = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  wash.addColorStop(0, 'rgba(255,120,60,0.10)');
  wash.addColorStop(0.5, 'rgba(255,120,60,0.03)');
  wash.addColorStop(1, 'rgba(80,40,160,0.08)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Roads.
  ctx.fillStyle = '#26262e';
  for (const x of city.roads.v) ctx.fillRect(x - 48, 0, 96, WORLD.height);
  for (const y of city.roads.h) ctx.fillRect(0, y - 48, WORLD.width, 96);
  // Centre dashes.
  ctx.fillStyle = '#c8a83e';
  for (const x of city.roads.v) {
    for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(x - 2, y, 4, 30);
  }
  for (const y of city.roads.h) {
    for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, y - 2, 30, 4);
  }

  // Buildings.
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows.
    ctx.fillStyle = 'rgba(255,220,120,0.28)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13 + b.h) % 3 === 0) {
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 12, 14);
        }
      }
    }
    if (b.neon) {
      ctx.save();
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255,46,136,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
  }

  // Landmarks: plaza disc + label.
  ctx.textAlign = 'center';
  for (const lm of city.landmarks) {
    const d = districtAt(lm.x, lm.y);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = d.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lm.x, lm.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(lm.name, lm.x, lm.y - 42);
  }

  // Palms and lamps.
  for (const palm of city.palms) {
    if (palm.x < vx0 - 20 || palm.x > vx1 + 20 || palm.y < vy0 - 20 || palm.y > vy1 + 20) continue;
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 10);
    ctx.stroke();
    ctx.fillStyle = '#2fae5f';
    ctx.beginPath();
    ctx.arc(palm.x + 3, palm.y - 13, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d8d8d8';
  for (const lamp of city.lamps) {
    if (lamp.x < vx0 || lamp.x > vx1 || lamp.y < vy0 || lamp.y > vy1) continue;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pickups.
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (pk.x < vx0 - 20 || pk.x > vx1 + 20 || pk.y < vy0 - 20 || pk.y > vy1 + 20) continue;
    const bob = Math.sin(time * 3 + pk.x) * 2;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae5f';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('$', pk.x, pk.y + bob + 5);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e33b3b';
      ctx.fillRect(pk.x - 6, pk.y + bob - 2, 12, 4);
      ctx.fillRect(pk.x - 2, pk.y + bob - 6, 4, 12);
    }
  }

  // Mission target beacon.
  const target = missionTargetPoint(world);
  if (target) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 44 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,62,0.16)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 44 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Parked, traffic and police cars.
  for (const car of world.parked) drawCarShape(ctx, car, time);
  for (const car of world.traffic) drawCarShape(ctx, car, time);
  for (const car of world.police) drawCarShape(ctx, car, time);
  if (world.player.inCar) drawCarShape(ctx, world.player.inCar, time);

  // Pedestrians.
  for (const ped of world.pedestrians) {
    ctx.fillStyle = ped.panic > 0 ? '#ff5a5a' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The player, on foot.
  const p = world.player;
  if (!p.inCar) {
    ctx.fillStyle = '#19b8a6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 13, p.y + Math.sin(p.angle) * 13);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    ctx.stroke();
  }

  // Bullets.
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  for (const b of world.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 10, b.y - Math.sin(b.angle) * 10);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Off-screen mission target arrow.
  if (target) {
    const sx = target.x - cam.x;
    const sy = target.y - cam.y;
    if (sx < 40 || sx > VIEW.width - 40 || sy < 40 || sy > VIEW.height - 40) {
      const cx = clamp(sx, 60, VIEW.width - 60);
      const cy = clamp(sy, 90, VIEW.height - 60);
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Sunset vignette.
  const vig = ctx.createRadialGradient(640, 360, 260, 640, 360, 780);
  vig.addColorStop(0, 'rgba(255,140,60,0)');
  vig.addColorStop(1, 'rgba(40,10,60,0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Red flash at 4–5 stars.
  if (world.wanted.stars >= 4) {
    ctx.fillStyle = `rgba(255,20,40,${0.05 + 0.05 * Math.sin(time * 5)})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function drawHud(ctx, world, time) {
  const p = world.player;
  // Top-left panel: cash, health, stars.
  ctx.fillStyle = 'rgba(8,6,18,0.72)';
  roundRect(ctx, 14, 12, 250, 92, 10);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7fe89a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${Math.floor(p.cash).toLocaleString('en-US')}`, 28, 42);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 28, 52, 150, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 50 ? '#37d67a' : p.health > 25 ? '#ffb02e' : '#ff3b3b';
  roundRect(ctx, 28, 52, 150 * clamp(p.health / 100, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.health)} HP`, 186, 62);
  // Wanted stars.
  ctx.font = '20px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < world.wanted.stars ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 28 + i * 24, 92);
  }
  if (world.wanted.stars > 0) {
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('WANTED', 152, 90);
  }

  // Top-right: district.
  const d = districtAt(p.x, p.y);
  ctx.fillStyle = 'rgba(8,6,18,0.72)';
  const dw = ctx.measureText(d.name).width + 34;
  roundRect(ctx, VIEW.width - 14 - dw - 120, 12, dw + 120, 34, 10);
  ctx.fill();
  ctx.fillStyle = d.accent;
  ctx.beginPath();
  ctx.arc(VIEW.width - 14 - dw - 120 + 20, 29, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.name, VIEW.width - 14 - dw - 120 + 32, 34);
  ctx.textAlign = 'right';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Solmar Bay', VIEW.width - 26, 34);
  ctx.textAlign = 'left';

  // Top-centre: objective + timer.
  const objective = missionObjectiveText(world);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(objective).width + 36;
  ctx.fillStyle = 'rgba(8,6,18,0.72)';
  roundRect(ctx, (VIEW.width - ow) / 2, 12, ow, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.textAlign = 'center';
  ctx.fillText(objective, VIEW.width / 2, 34);
  const m = currentMission(world);
  if (m && m.timeLimit) {
    const t = Math.max(0, world.mission.timer);
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60).toString().padStart(2, '0');
    ctx.fillStyle = t < 30 ? '#ff3b3b' : '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`${mm}:${ss}`, VIEW.width / 2, 70);
  }
  ctx.textAlign = 'left';

  // Toasts, bottom-left.
  ctx.font = '14px system-ui, sans-serif';
  let ty = VIEW.height - 20 - (world.messages.length - 1) * 26;
  for (const msg of world.messages) {
    const alpha = clamp((msg.ttl - msg.t) / 0.8, 0, 1);
    ctx.globalAlpha = alpha;
    const tw = ctx.measureText(msg.text).width + 24;
    ctx.fillStyle = 'rgba(8,6,18,0.78)';
    roundRect(ctx, 14, ty - 18, tw, 24, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(msg.text, 26, ty - 1);
    ty += 26;
  }
  ctx.globalAlpha = 1;

  drawMinimap(ctx, world, time);
}

function drawMinimap(ctx, world, time) {
  const scale = 200 / WORLD.width;
  const mw = WORLD.width * scale;
  const mh = WORLD.height * scale;
  const mx = VIEW.width - 16 - mw;
  const my = VIEW.height - 16 - mh;
  ctx.fillStyle = 'rgba(8,6,18,0.78)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(mx + d.x * scale, my + d.y * scale, d.w * scale, d.h * scale);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (const x of world.city.roads.v) {
    ctx.beginPath();
    ctx.moveTo(mx + x * scale, my);
    ctx.lineTo(mx + x * scale, my + mh);
    ctx.stroke();
  }
  for (const y of world.city.roads.h) {
    ctx.beginPath();
    ctx.moveTo(mx, my + y * scale);
    ctx.lineTo(mx + mw, my + y * scale);
    ctx.stroke();
  }
  const target = missionTargetPoint(world);
  if (target) {
    const pulse = 3 + Math.sin(time * 5) * 1.5;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(mx + target.x * scale, my + target.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of world.police) {
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(mx + car.x * scale, my + car.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = world.player;
  ctx.fillStyle = '#19b8a6';
  ctx.beginPath();
  ctx.arc(mx + p.x * scale, my + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx + p.x * scale, my + p.y * scale, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my - 10);
}

function overlay(ctx, alpha) {
  ctx.fillStyle = `rgba(6,4,14,${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function bigTitle(ctx, text, y, color) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(255,46,136,0.8)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.width / 2, y);
  ctx.restore();
}

function menuLine(ctx, text, y, size = 18, color = '#ffffff') {
  ctx.textAlign = 'center';
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, VIEW.width / 2, y);
}

export function render(ctx, world, screen, ui) {
  const time = ui.time;
  const cam = cameraFor(world);
  drawWorldScene(ctx, world, cam, time);
  if (screen === 'playing' || screen === 'paused') {
    drawHud(ctx, world, time);
  }

  if (screen === 'title') {
    overlay(ctx, 0.55);
    const grad = ctx.createLinearGradient(0, 180, 0, 300);
    grad.addColorStop(0, '#ff2e88');
    grad.addColorStop(1, '#ffb02e');
    bigTitle(ctx, 'SUNSET STREETS', 250, grad);
    menuLine(ctx, 'Solmar Bay — a driver for hire', 292, 20, '#ffd9a8');
    menuLine(ctx, 'Steal cars. Outrun Vice Patrol. Run five jobs and own the city.', 330, 16, 'rgba(255,255,255,0.85)');
    if (ui.saveExists) {
      menuLine(ctx, 'ENTER — Continue your run', 420, 20, '#7fe89a');
      menuLine(ctx, 'or press N for a new game', 452, 15, 'rgba(255,255,255,0.7)');
    } else {
      menuLine(ctx, 'ENTER — Start', 420, 22, '#7fe89a');
    }
    menuLine(ctx, 'WASD drive / walk · SHIFT run · E steal car · Click shoot · F punch · M next job', 540, 15, 'rgba(255,255,255,0.75)');
    menuLine(ctx, 'P pause · H save · N music', 566, 15, 'rgba(255,255,255,0.75)');
    menuLine(ctx, 'Mara Solis  •  Dante Cole  •  Five jobs  •  One sunset', 620, 14, '#ffb02e');
  } else if (screen === 'paused') {
    overlay(ctx, 0.6);
    bigTitle(ctx, 'PAUSED', 300, '#ffffff');
    menuLine(ctx, 'P — Resume', 380, 20);
    menuLine(ctx, 'R — Restart the run', 414, 20);
    menuLine(ctx, 'ENTER — Back to title', 448, 20);
    menuLine(ctx, 'H — Save your run', 482, 16, 'rgba(255,255,255,0.75)');
  } else if (screen === 'busted') {
    overlay(ctx, 0.62);
    bigTitle(ctx, 'BUSTED', 300, '#2e9bff');
    menuLine(ctx, 'The Vice Patrol caught you on foot.', 360, 18);
    menuLine(ctx, 'ENTER — Retry', 430, 20, '#7fe89a');
    menuLine(ctx, 'ESC — Back to title', 464, 18);
  } else if (screen === 'wasted') {
    overlay(ctx, 0.62);
    bigTitle(ctx, 'WASTED', 300, '#ff3b3b');
    menuLine(ctx, 'Mara went down in Solmar Bay.', 360, 18);
    menuLine(ctx, 'ENTER — Retry', 430, 20, '#7fe89a');
    menuLine(ctx, 'ESC — Back to title', 464, 18);
  } else if (screen === 'win') {
    overlay(ctx, 0.55);
    const grad = ctx.createLinearGradient(0, 180, 0, 300);
    grad.addColorStop(0, '#ffd23e');
    grad.addColorStop(1, '#ff2e88');
    bigTitle(ctx, 'YOU OWN SOLMAR BAY', 280, grad);
    menuLine(ctx, 'All five jobs done. The Sunset Score is yours.', 340, 18);
    menuLine(ctx, `Final cash: $${Math.floor(world.player.cash).toLocaleString('en-US')}  •  Cars stolen: ${world.stats.carsStolen}`, 390, 17, '#7fe89a');
    menuLine(ctx, 'ENTER — Back to title', 460, 20);
    menuLine(ctx, 'Keep cruising — the city is yours now.', 500, 15, 'rgba(255,255,255,0.75)');
  }
}
