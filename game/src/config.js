// Solmar Bay — configuration and shared constants for "Sunset Streets".
// Original open-world crime game. No assets from any commercial game.
export const WORLD = {
  seed: 20261117,
  width: 3840,
  height: 2560,
  block: 320, // city block size in px
  road: 96, // road width in px
};

export const VIEW = { width: 1280, height: 720 };

export const DISTRICTS = [
  {
    id: 'neon',
    name: 'Neon Strip',
    color: '#ff2e88',
    desc: 'Glowing boulevards, clubs and casinos',
    // x0, y0, x1, y1 in world coordinates
    rect: [0, 0, 1920, 1280],
  },
  {
    id: 'port',
    name: 'Portside',
    color: '#2e9bff',
    desc: 'Docks, warehouses and container yards',
    rect: [1920, 0, 3840, 1280],
  },
  {
    id: 'oldtown',
    name: 'Old Town',
    color: '#ffb02e',
    desc: 'Brick lanes, markets and the old plaza',
    rect: [0, 1280, 3840, 2560],
  },
];

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 290,
  radius: 13,
  maxHealth: 100,
};

export const CAR = {
  accel: 520,
  brake: 900,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.9,
  length: 54,
  width: 26,
};

export const WANTED = {
  // stars -> police cars chasing, spawn interval (s), cop top speed
  levels: [
    { cars: 0, interval: 0, speed: 0 },
    { cars: 1, interval: 6, speed: 380 },
    { cars: 2, interval: 4, speed: 430 },
    { cars: 3, interval: 3, speed: 470 },
    { cars: 4, interval: 2.2, speed: 510 },
    { cars: 5, interval: 1.6, speed: 545 },
  ],
  decaySeconds: 45, // wanted drops one star after this long with no crime
};

export const STEP = 1 / 60;

export const CAR_MODELS = [
  { name: 'Sunny Coupe', color: '#e33f2f', speed: 1.0, price: 400 },
  { name: 'Bay Cruiser', color: '#2f7fe3', speed: 0.92, price: 350 },
  { name: 'Palm Taxi', color: '#f2c200', speed: 0.95, price: 300 },
  { name: 'Dock Hauler', color: '#7a5a3a', speed: 0.8, price: 250 },
  { name: 'Neon Racer', color: '#c42fe3', speed: 1.18, price: 900 },
  { name: 'Gullwing GT', color: '#18c8a0', speed: 1.12, price: 750 },
  { name: 'Surf Van', color: '#e3e3e3', speed: 0.78, price: 280 },
  { name: 'Vice Patrol', color: '#20242c', speed: 1.05, price: 0 },
];

export const MISSION_REWARDS = [500, 900, 1400, 2200, 5000];

export const SAVE_KEY = 'sunset-streets-save-v1';
