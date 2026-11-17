// Sunset Streets — all tunable constants in one place.
// World, districts, player, cars, wanted levels, car models, mission
// rewards and the save key. Nothing here touches the network.

export const WORLD = {
  width: 3840,
  height: 2560,
  block: 320,
  roadWidth: 96,
  seed: 20261117,
};

export const DISTRICTS = [
  { id: 'neon', name: 'Neon Strip', x: 0, y: 0, w: 1920, h: 1280, accent: '#ff2e88', ground: '#241a33' },
  { id: 'port', name: 'Portside', x: 1920, y: 0, w: 1920, h: 1280, accent: '#2e9bff', ground: '#16202e' },
  { id: 'old', name: 'Old Town', x: 0, y: 1280, w: 3840, h: 1280, accent: '#ffb02e', ground: '#2b2118' },
];

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 290,
  radius: 13,
  health: 100,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 520,
  brake: 900,
  topSpeed: 560,
  reverseTop: 180,
  turnRate: 2.9,
};

// Wanted level table: index = stars. spawn = how many police cars at
// most, interval = seconds between new spawns, topSpeed = cop top speed.
export const WANTED = [
  { stars: 0, maxCops: 0, interval: 0, topSpeed: 0 },
  { stars: 1, maxCops: 1, interval: 6.0, topSpeed: 380 },
  { stars: 2, maxCops: 2, interval: 4.0, topSpeed: 430 },
  { stars: 3, maxCops: 3, interval: 3.0, topSpeed: 470 },
  { stars: 4, maxCops: 4, interval: 2.2, topSpeed: 510 },
  { stars: 5, maxCops: 5, interval: 1.6, topSpeed: 545 },
];

export const HEAT_COOLDOWN = 45; // seconds without a crime: lose one star
export const MAX_WANTED = 5;

export const CAR_MODELS = [
  { id: 'sunny', name: 'Sunny Coupe', color: '#e33b3b', speed: 1.0, price: 400 },
  { id: 'cruiser', name: 'Bay Cruiser', color: '#3b6fe3', speed: 0.92, price: 350 },
  { id: 'taxi', name: 'Palm Taxi', color: '#f2c531', speed: 0.95, price: 300 },
  { id: 'hauler', name: 'Dock Hauler', color: '#8a5a2b', speed: 0.8, price: 250 },
  { id: 'racer', name: 'Neon Racer', color: '#9b3bf2', speed: 1.18, price: 900 },
  { id: 'gullwing', name: 'Gullwing GT', color: '#2ec8b8', speed: 1.12, price: 750 },
  { id: 'van', name: 'Surf Van', color: '#e8e8e8', speed: 0.78, price: 280 },
  { id: 'police', name: 'Vice Patrol', color: '#1c2433', speed: 1.05, price: 0 },
];

export const MISSION_REWARDS = [500, 900, 1400, 2200, 5000];

export const SAVE_KEY = 'sunset-streets-save-v1';

export const VIEW = { width: 1280, height: 720 };
