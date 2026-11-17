// Rendering: camera, city, entities, effects and the full HUD (health, cash,
// wanted stars, minimap, objective, messages) plus title / pause / end screens.
import { WORLD, VIEW, DISTRICTS, PLAYER, CAR } from './config.js';
import { districtAt } from './city.js';
import { currentObjective, missionTargetPoint, MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function drawCar(ctx, x, y, angle, model, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const L = CAR.length;
  const W = CAR.width;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
  ctx.fillStyle = model.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // cabin
  ctx.fillStyle = 'rgba(20,26,34,0.9)';
  roundRect(ctx, -L / 2 + 12, -W / 2 + 5, L - 26, W - 10, 5);
  ctx.fill();
  // windshield + lights
  ctx.fillStyle = '#bfe8ff';
  ctx.fillRect(L / 2 - 6, -W / 2 + 4, 3, W - 8);
  ctx.fillStyle = opts.brake ? '#ff2222' : '#ffdd55';
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 6);
  ctx.fillRect(-L / 2, W / 2 - 8, 3, 6);
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(L / 2 - 1, -W / 2 + 2, 3, 6);
  ctx.fillRect(L / 2 - 1, W / 2 - 8, 3, 6);
  if (opts.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-4, -W / 2 + 2, 8, 4);
    ctx.fillRect(-4, W / 2 - 6, 8, 4);
    const flash = Math.sin(opts.siren || 0) > 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e7bff';
    ctx.beginPath();
    ctx.arc(-2, 0, 6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
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

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  const bob = Math.sin(ped.walkPhase) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 10, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f2c98a';
  ctx.beginPath();
  ctx.arc(4 + bob, 0, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.rotate(p.angle);
  const swing = p.speed > 10 ? Math.sin(time * 14) * 3 : 0;
  // legs
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-6, -8 + swing, 8, 5);
  ctx.fillRect(-6, 3 - swing, 8, 5);
  // body — teal jacket, Mara's look
  ctx.fillStyle = '#0fa3a3';
  roundRect(ctx, -10, -9, 20, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#ffcf9e';
  ctx.beginPath();
  ctx.arc(10, 0, 6.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath();
  ctx.arc(8, 0, 6.8, Math.PI * 0.6, Math.PI * 1.5);
  ctx.fill();
  // gun arm when shooting
  if (p.shootTimer > 0.1) {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(8, -2, 16, 4);
  }
  ctx.restore();
}

export function renderWorld(ctx, world, camera, time) {
  const { state, city } = world;
  const { width, height } = VIEW;
  // Sky-tinted ground
  ctx.fillStyle = '#2b2f3a';
  ctx.fillRect(0, 0, width, height);

  const x0 = camera.x - width / 2;
  const y0 = camera.y - height / 2;
  const x1 = camera.x + width / 2;
  const y1 = camera.y + height / 2;

  ctx.save();
  ctx.translate(-x0, -y0);

  // District ground tint
  for (const d of DISTRICTS) {
    const [dx0, dy0, dx1, dy1] = d.rect;
    ctx.fillStyle = d.id === 'neon' ? '#3a3348' : d.id === 'port' ? '#33383f' : '#40382e';
    ctx.fillRect(dx0, dy0, dx1 - dx0, dy1 - dy0);
  }

  // Roads
  ctx.fillStyle = '#23262e';
  for (const rx of city.roadsX) ctx.fillRect(rx - WORLD.road / 2, 0, WORLD.road, WORLD.height);
  for (const ry of city.roadsY) ctx.fillRect(0, ry - WORLD.road / 2, WORLD.width, WORLD.road);
  // Lane dashes
  ctx.strokeStyle = 'rgba(255,214,90,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const rx of city.roadsX) {
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, WORLD.height);
  }
  for (const ry of city.roadsY) {
    ctx.moveTo(0, ry);
    ctx.lineTo(WORLD.width, ry);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Sidewalk blocks
  ctx.fillStyle = '#3d3a35';
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      ctx.fillRect(rx - WORLD.road / 2 - 6, ry - WORLD.road / 2 - 6, 12, 12);
    }
  }

  // Buildings
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // windows
    ctx.fillStyle = 'rgba(255,220,120,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 22));
    const rows = Math.max(1, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 3 + b.height) % 3 === 0) {
          ctx.fillRect(b.x + 8 + i * 22, b.y + 8 + j * 22, 10, 12);
        }
      }
    }
    if (b.neon) {
      ctx.strokeStyle = b.neonColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = b.neonColor;
      ctx.shadowBlur = 12;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.shadowBlur = 0;
    }
  }

  // Palm trees
  for (const palm of city.palms) {
    if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
    ctx.strokeStyle = '#6e4a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 14);
    ctx.stroke();
    ctx.fillStyle = '#2fae5f';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * TAU + 0.4;
      ctx.beginPath();
      ctx.ellipse(palm.x + 3 + Math.cos(a) * 9, palm.y - 14 + Math.sin(a) * 5, 9, 3.5, a, 0, TAU);
      ctx.fill();
    }
  }

  // Street lamps
  ctx.fillStyle = '#ffe9a8';
  for (const lamp of city.lamps) {
    if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, TAU);
    ctx.fill();
  }

  // Points of interest labels
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(city.points)) {
    const pt = city.points[key];
    if (pt.x < x0 - 100 || pt.x > x1 + 100 || pt.y < y0 - 100 || pt.y > y1 + 100) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(pt.label).width + 16;
    roundRect(ctx, pt.x - w / 2, pt.y - 34, w, 22, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(pt.label, pt.x, pt.y - 19);
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, TAU);
    ctx.fill();
  }

  // Pickups
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.shadowColor = pk.kind === 'cash' ? '#3dff7a' : '#ff5a5a';
    ctx.shadowBlur = 14;
    ctx.fillStyle = pk.kind === 'cash' ? '#3dff7a' : '#ff5a5a';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0c1a10';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : '+', 0, 5);
    ctx.restore();
  }

  // Mission target beacon
  const target = missionTargetPoint(world);
  if (target && state.mission) {
    const pulse = 26 + Math.sin(time * 4) * 6;
    ctx.strokeStyle = '#ffcf3d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,207,61,0.25)';
    ctx.beginPath();
    ctx.arc(target.x, target.y, pulse, 0, TAU);
    ctx.fill();
    // Guide line from player to target
    ctx.strokeStyle = 'rgba(255,207,61,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Traffic + parked cars
  for (const car of state.cars) {
    if (car.x < x0 - 80 || car.x > x1 + 80 || car.y < y0 - 80 || car.y > y1 + 80) continue;
    drawCar(ctx, car.x, car.y, car.angle, car.model, { brake: car.brakeLight });
  }

  // Police
  for (const cop of state.cops) {
    drawCar(
      ctx,
      cop.x,
      cop.y,
      cop.angle,
      { color: '#20242c', name: 'Vice Patrol' },
      { police: true, siren: cop.siren },
    );
  }

  // Pedestrians
  for (const ped of state.peds) {
    if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
    drawPed(ctx, ped);
  }

  // Bullets
  ctx.strokeStyle = '#ffe95e';
  ctx.lineWidth = 3;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }

  // Particles
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player
  const p = state.player;
  if (p.onFoot) {
    drawPlayer(ctx, p, time);
  } else if (p.car) {
    drawCar(ctx, p.car.x, p.car.y, p.car.angle, p.car.model, { brake: p.car.brakeLight });
  }

  ctx.restore();

  // Sunset vignette
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(255,120,60,0.10)');
  grad.addColorStop(0.5, 'rgba(255,120,60,0)');
  grad.addColorStop(1, 'rgba(20,10,40,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Wanted flash at high stars
  if (state.wanted >= 4) {
    const a = 0.05 + 0.04 * Math.sin(time * 6);
    ctx.fillStyle = `rgba(255,30,60,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function renderHUD(ctx, world, camera) {
  const { state } = world;
  const { width, height } = VIEW;
  const p = state.player;

  // Top-left: cash + health
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, 14, 14, 210, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#3dff7a';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 28, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Health ${Math.round(state.health)}`, 28, 64);
  ctx.fillStyle = '#222';
  ctx.fillRect(110, 54, 100, 10);
  ctx.fillStyle = state.health > 30 ? '#3dff7a' : '#ff3b30';
  ctx.fillRect(110, 54, 100 * (state.health / PLAYER.maxHealth), 10);

  // Top-right: wanted stars
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, width - 224, 14, 210, 46, 10);
  ctx.fill();
  ctx.font = '22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#ffcf3d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', width - 210 + i * 40, 46);
  }

  // District label
  const d = districtAt(p.x, p.y);
  ctx.fillStyle = 'rgba(10,14,20,0.6)';
  const label = `${d.name} — ${d.desc}`;
  ctx.font = 'bold 14px system-ui, sans-serif';
  const lw = ctx.measureText(label).width + 20;
  roundRect(ctx, width / 2 - lw / 2, 14, lw, 30, 10);
  ctx.fill();
  ctx.fillStyle = d.color;
  ctx.textAlign = 'center';
  ctx.fillText(label, width / 2, 34);

  // Objective bar (bottom centre)
  const obj = currentObjective(world);
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.font = '15px system-ui, sans-serif';
  const ow = ctx.measureText(obj).width + 32;
  roundRect(ctx, width / 2 - ow / 2, height - 92, ow, 32, 10);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'center';
  ctx.fillText(obj, width / 2, height - 71);
  if (state.mission) {
    ctx.fillStyle = '#ffcf3d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`MISSION: ${state.mission.def.title}  •  $${state.mission.def.reward}`, width / 2, height - 100);
    if (state.mission.timer > 0) {
      ctx.fillStyle = '#ff6b5e';
      ctx.fillText(`Time left: ${Math.ceil(state.mission.timer)}s`, width / 2, height - 118);
    }
  }

  // Controls hint
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive  •  E enter/exit car  •  Click shoot  •  F punch  •  Shift run  •  M mission  •  P pause  •  H save', 16, height - 16);

  // Message toast
  if (state.messageTimer > 0 && state.message) {
    ctx.fillStyle = 'rgba(10,14,20,0.8)';
    ctx.font = 'bold 16px system-ui, sans-serif';
    const mw = ctx.measureText(state.message).width + 28;
    roundRect(ctx, width / 2 - mw / 2, 62, mw, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, width / 2, 85);
  }

  renderMinimap(ctx, world, camera);
}

function renderMinimap(ctx, world, camera) {
  const { state, city } = world;
  const { width, height } = VIEW;
  const size = 168;
  const mx = width - size - 16;
  const my = height - size - 16;
  const scale = size / WORLD.width;
  ctx.fillStyle = 'rgba(10,14,20,0.78)';
  roundRect(ctx, mx - 6, my - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  // districts
  for (const d of DISTRICTS) {
    const [x0, y0, x1, y1] = d.rect;
    ctx.fillStyle = d.id === 'neon' ? '#4a3f63' : d.id === 'port' ? '#3d464f' : '#4a4136';
    ctx.fillRect(mx + x0 * scale, my + y0 * scale, (x1 - x0) * scale, (y1 - y0) * scale);
  }
  // roads
  ctx.fillStyle = '#6a6f7a';
  for (const rx of city.roadsX) ctx.fillRect(mx + (rx - 4) * scale, my, 8 * scale, size);
  for (const ry of city.roadsY) ctx.fillRect(mx, my + (ry - 4) * scale, size, 8 * scale);
  // mission target
  const target = missionTargetPoint(world);
  if (target) {
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath();
    ctx.arc(mx + target.x * scale, my + target.y * scale, 5, 0, TAU);
    ctx.fill();
  }
  // cops
  ctx.fillStyle = '#ff3b30';
  for (const cop of state.cops) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * scale, my + cop.y * scale, 3, 0, TAU);
    ctx.fill();
  }
  // player arrow
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * scale, my + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // view rectangle
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + (camera.x - VIEW.width / 2) * scale, my + (camera.y - VIEW.height / 2) * scale, VIEW.width * scale, VIEW.height * scale);
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my - 10 + 0);
}

function overlay(ctx, title, lines, accent) {
  const { width, height } = VIEW;
  ctx.fillStyle = 'rgba(8,8,18,0.82)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, height / 2 - 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, height / 2 - 40 + i * 30);
  });
}

export function renderScreen(ctx, world, screen, extra = {}) {
  const { width, height } = VIEW;
  if (screen === SCREEN_TITLE) {
    const { state, city } = world;
    // Draw the city behind the title
    renderWorld(ctx, world, { x: 1500, y: 1100 }, world.state.time);
    ctx.fillStyle = 'rgba(10,8,24,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 30;
    ctx.fillText('SUNSET', width / 2, 210);
    ctx.fillStyle = '#ffb02e';
    ctx.shadowColor = '#ffb02e';
    ctx.fillText('STREETS', width / 2, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in Solmar Bay', width / 2, 345);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('Three districts. Five missions. One sunset score.', width / 2, 380);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Press ENTER to start  •  H to continue a save', width / 2, 460);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('WASD move / drive   •   E steal & enter cars   •   Click shoot   •   F punch   •   M mission   •   P pause', width / 2, 505);
    ctx.fillText('Steal cars, dodge the Vice Patrol, finish all five missions.', width / 2, 535);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('A wholly original game. Not affiliated with Rockstar Games or Grand Theft Auto.', width / 2, 690);
    void city;
    void state;
    return;
  }
  if (screen === SCREEN_PAUSE) {
    overlay(ctx, 'PAUSED', ['Press P to resume', 'H — save game    •    R — restart run', 'M — start the next mission'], '#ffb02e');
    return;
  }
  if (screen === SCREEN_BUSTED) {
    overlay(ctx, 'BUSTED!', [`The Vice Patrol caught you.`, `Cash kept: $${extra.money ?? 0}   •   Missions done: ${extra.missions ?? 0}`, 'Press ENTER to try again'], '#2e9bff');
    return;
  }
  if (screen === SCREEN_WASTED) {
    overlay(ctx, 'WASTED', ['Solmar Bay got the better of you.', `Missions done: ${extra.missions ?? 0}`, 'Press ENTER to try again'], '#ff3b30');
    return;
  }
  if (screen === SCREEN_WIN) {
    overlay(ctx, 'SOLMAR BAY IS YOURS', ['All five missions complete.', `Final cash: $${extra.money ?? 0}   •   Cars stolen: ${extra.cars ?? 0}`, 'Press ENTER to keep cruising in free roam'], '#3dff7a');
  }
}
