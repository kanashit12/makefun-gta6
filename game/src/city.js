// City generation for Solmar Bay: a road grid, three districts, buildings,
// props and fixed points of interest. Pure function of the seed — deterministic.
import { WORLD, DISTRICTS, CAR_MODELS } from './config.js';
import { mulberry32, range, pick } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    const [x0, y0, x1, y1] = d.rect;
    if (x >= x0 && x < x1 && y >= y0 && y < y1) return d;
  }
  return DISTRICTS[2];
}

function roadCenters(size, block, road) {
  const centers = [];
  const pitch = block + road;
  for (let c = road / 2 + block / 2; c < size; c += pitch) centers.push(c);
  return centers;
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const { width, height, block, road } = WORLD;
  const pitch = block + road;
  const roadsX = [];
  const roadsY = [];
  for (let x = road / 2; x < width; x += pitch) roadsX.push(x);
  for (let y = road / 2; y < height; y += pitch) roadsY.push(y);

  const buildings = [];
  const palms = [];
  const lamps = [];
  const parkingSpots = [];

  for (let bx = 0; bx < roadsX.length - 1; bx += 1) {
    for (let by = 0; by < roadsY.length - 1; by += 1) {
      const x0 = roadsX[bx] + road / 2 + 14;
      const y0 = roadsY[by] + road / 2 + 14;
      const x1 = roadsX[bx + 1] - road / 2 - 14;
      const y1 = roadsY[by + 1] - road / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      // 1-3 buildings per block, deterministic layout
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i += 1) {
        const bw = range(rng, 70, 130);
        const bh = range(rng, 60, 120);
        const px = x0 + range(rng, 0, Math.max(1, x1 - x0 - bw));
        const py = y0 + range(rng, 0, Math.max(1, y1 - y0 - bh));
        const palette =
          d.id === 'neon'
            ? ['#3b2a63', '#5a2a6e', '#2a3a63', '#6e2a4a']
            : d.id === 'port'
              ? ['#33424e', '#4e3f33', '#2e4a4a', '#55504a']
              : ['#6e4a2a', '#7a5a33', '#5a3a2a', '#8a6a3a'];
        buildings.push({
          x: px,
          y: py,
          w: bw,
          h: bh,
          color: pick(rng, palette),
          roof: pick(rng, ['#1c1c26', '#26262e', '#20242c']),
          neon: d.id === 'neon' && rng() < 0.55,
          neonColor: pick(rng, ['#ff2e88', '#2ee6ff', '#ffe62e', '#7bff2e']),
          height: 1 + Math.floor(rng() * 3),
          district: d.id,
        });
      }
      // Palm trees along the block edge (Neon Strip + Old Town)
      if (d.id !== 'port') {
        const n = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < n; i += 1) {
          palms.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0) });
        }
      }
      // Parked cars on some blocks
      if (rng() < 0.75) {
        const model = pick(rng, CAR_MODELS.filter((m) => m.price > 0));
        parkingSpots.push({
          x: x0 + 30 + rng() * Math.max(1, x1 - x0 - 90),
          y: y0 + 30 + rng() * Math.max(1, y1 - y0 - 90),
          angle: (Math.floor(rng() * 4) * Math.PI) / 2,
          model,
        });
      }
    }
  }

  // Street lamps along every road intersection
  for (const rx of roadsX) {
    for (const ry of roadsY) {
      lamps.push({ x: rx + road / 2 - 6, y: ry + road / 2 - 6 });
    }
  }

  const points = {
    home: { x: 620, y: 980, label: 'Mara\u2019s Apartment' },
    garage: { x: 1500, y: 620, label: 'Sunset Garage' },
    club: { x: 980, y: 420, label: 'Club Flamingo' },
    docks: { x: 3300, y: 700, label: 'Portside Docks' },
    plaza: { x: 1500, y: 2100, label: 'Old Plaza' },
    market: { x: 2600, y: 1900, label: 'Night Market' },
    casino: { x: 700, y: 300, label: 'Casino Sol' },
    warehouse: { x: 2900, y: 420, label: 'Warehouse 9' },
  };

  return { roadsX, roadsY, buildings, palms, lamps, parkingSpots, points, rngState: 0 };
}

export function isOnRoad(city, x, y) {
  const { road } = WORLD;
  for (const rx of city.roadsX) if (Math.abs(x - rx) < road / 2) return true;
  for (const ry of city.roadsY) if (Math.abs(y - ry) < road / 2) return true;
  return false;
}

export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y, vertical: true };
    }
  }
  for (const ry of city.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = { x, y: ry, vertical: false };
    }
  }
  return best;
}

export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
