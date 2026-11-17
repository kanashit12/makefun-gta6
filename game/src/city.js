// Sunset Streets — Solmar Bay, generated from a fixed seed.
// A road grid, buildings filling the blocks, palms and lamps lining the
// streets, and eight named landmarks. Same seed, same city, every run.

import { DISTRICTS, WORLD } from './config.js';
import { chance, mulberry32, pick, range, rangeInt } from './random.js';

const PITCH = WORLD.block + WORLD.roadWidth; // 416 px between road centres
const HALF_ROAD = WORLD.roadWidth / 2; // 48

// Road centre lines, in pixels.
export function roadCentres() {
  const v = [];
  const h = [];
  for (let x = HALF_ROAD; x < WORLD.width; x += PITCH) v.push(x);
  for (let y = HALF_ROAD; y < WORLD.height; y += PITCH) h.push(y);
  return { v, h };
}

export const LANDMARKS = [
  { id: 'garage', name: 'Sunset Garage', x: 464, y: 880, district: 'neon' },
  { id: 'apartment', name: "Mara's Apartment", x: 1296, y: 464, district: 'neon' },
  { id: 'flamingo', name: 'Club Flamingo', x: 880, y: 464, district: 'neon' },
  { id: 'casino', name: 'Casino Sol', x: 1712, y: 880, district: 'neon' },
  { id: 'docks', name: 'Portside Docks', x: 2960, y: 464, district: 'port' },
  { id: 'warehouse9', name: 'Warehouse 9', x: 3376, y: 880, district: 'port' },
  { id: 'market', name: 'Night Market', x: 1296, y: 2128, district: 'old' },
  { id: 'plaza', name: 'Old Plaza', x: 2128, y: 1712, district: 'old' },
];

export function landmarkById(id) {
  return LANDMARKS.find((l) => l.id === id);
}

const BUILDING_COLORS = {
  neon: ['#3a2b52', '#4a2f5e', '#33284a', '#57304f', '#2e3a5e'],
  port: ['#2c3540', '#3a3f45', '#37424e', '#2f3a33', '#40382c'],
  old: ['#5a3d2b', '#6b4630', '#4a3527', '#63402e', '#54402a'],
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[2];
}

export function districtIdAt(x, y) {
  return districtAt(x, y).id;
}

function nearestCentre(list, v) {
  let best = list[0];
  let bd = Math.abs(v - best);
  for (const c of list) {
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return { centre: best, dist: bd };
}

export function isOnRoad(city, x, y) {
  return (
    nearestCentre(city.roads.v, x).dist <= HALF_ROAD ||
    nearestCentre(city.roads.h, y).dist <= HALF_ROAD
  );
}

// Nearest road intersection to (x, y), or null when too far away.
export function nearestIntersection(city, x, y, maxDist) {
  const nx = nearestCentre(city.roads.v, x);
  const ny = nearestCentre(city.roads.h, y);
  if (nx.dist > maxDist || ny.dist > maxDist) return null;
  return { x: nx.centre, y: ny.centre };
}

// Push a circle (x, y, r) out of every building it overlaps.
// Returns the corrected position.
export function resolveCircleBuildings(city, x, y, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of city.buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 < 0.0001) {
        // Centre inside the rect: push out along the smallest penetration.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      } else {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      }
    }
  }
  return { x, y };
}

// A car is two circles (front and rear axle). Returns corrected centre.
export function resolveCarBuildings(city, x, y, angle, halfLen, radius) {
  const fx = x + Math.cos(angle) * halfLen;
  const fy = y + Math.sin(angle) * halfLen;
  const bx = x - Math.cos(angle) * halfLen;
  const by = y - Math.sin(angle) * halfLen;
  const f = resolveCircleBuildings(city, fx, fy, radius);
  const b = resolveCircleBuildings(city, bx, by, radius);
  const nx = (f.x + b.x) / 2;
  const ny = (f.y + b.y) / 2;
  return { x: nx, y: ny, blocked: Math.hypot(f.x - fx, f.y - fy) + Math.hypot(b.x - bx, b.y - by) > 1 };
}

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const roads = roadCentres();
  const buildings = [];
  const palms = [];
  const lamps = [];

  // Buildings fill every block between the roads.
  for (let i = 0; i < roads.v.length - 1; i++) {
    for (let j = 0; j < roads.h.length - 1; j++) {
      const bx0 = roads.v[i] + HALF_ROAD + 14;
      const by0 = roads.h[j] + HALF_ROAD + 14;
      const bw = PITCH - WORLD.roadWidth - 28;
      const bh = PITCH - WORLD.roadWidth - 28;
      const cx = bx0 + bw / 2;
      const cy = by0 + bh / 2;
      const district = districtAt(cx, cy);
      const palette = BUILDING_COLORS[district.id];
      const count = rangeInt(rng, 1, 3);
      if (count === 1) {
        buildings.push({
          x: bx0 + 8, y: by0 + 8, w: bw - 16, h: bh - 16,
          color: pick(rng, palette), neon: district.id === 'neon', district: district.id,
          h: rangeInt(rng, 2, 6),
        });
      } else if (count === 2) {
        const splitV = chance(rng, 0.5);
        for (let k = 0; k < 2; k++) {
          buildings.push({
            x: splitV ? bx0 + 8 + k * (bw / 2) : bx0 + 8,
            y: splitV ? by0 + 8 : by0 + 8 + k * (bh / 2),
            w: splitV ? bw / 2 - 16 : bw - 16,
            h: splitV ? bh - 16 : bh / 2 - 16,
            color: pick(rng, palette), neon: district.id === 'neon', district: district.id,
            h: rangeInt(rng, 1, 5),
          });
        }
      } else {
        for (let k = 0; k < 4; k++) {
          buildings.push({
            x: bx0 + 8 + (k % 2) * (bw / 2),
            y: by0 + 8 + Math.floor(k / 2) * (bh / 2),
            w: bw / 2 - 16, h: bh / 2 - 16,
            color: pick(rng, palette), neon: district.id === 'neon', district: district.id,
            h: rangeInt(rng, 1, 4),
          });
        }
      }
      // A couple of palms on the block corners.
      for (let k = 0; k < 2; k++) {
        palms.push({
          x: bx0 + range(rng, 0, bw),
          y: by0 + (k === 0 ? -4 : bh + 4),
        });
      }
    }
  }

  // Street lamps at intersections, palms along the roads.
  for (const x of roads.v) {
    for (const y of roads.h) {
      if (chance(rng, 0.6)) lamps.push({ x: x + HALF_ROAD - 6, y: y + HALF_ROAD - 6 });
      if (chance(rng, 0.5)) {
        palms.push({ x: x + HALF_ROAD - 10 + range(rng, -6, 6), y: y + range(rng, -120, 120) });
      }
    }
  }

  return { seed, roads, buildings, palms, lamps, landmarks: LANDMARKS };
}
