# Sunset Streets — game documentation

Sunset Streets is a 2D top-down open-world crime game that runs in a
desktop browser from plain static files. You are Mara Solis, a driver for
hire in Solmar Bay, a sun-soaked coastal city. Steal cars, outrun the Vice
Patrol, and run five story jobs to own the city.

## The city

Solmar Bay is a 3840 by 2560 pixel city, generated from the fixed seed
20261117, so the same seed always builds the same streets, buildings and
landmarks. Three districts divide the map:

- **Neon Strip** (north-west): glowing boulevards, clubs and casinos.
  Pink-red neon edges on the buildings. Home to the Sunset Garage, Mara's
  Apartment, Club Flamingo and Casino Sol.
- **Portside** (north-east): docks, warehouses and container yards in
  blue. Home to the Portside Docks and Warehouse 9.
- **Old Town** (south): brick lanes, markets and the old plaza in amber.
  Home to the Night Market and the Old Plaza.

The city holds 100+ buildings, palm trees, street lamps and eight named
landmarks. Roads form a grid; buildings fill the blocks; cars and the
player cannot pass through buildings. Traffic (26 cars) drives the road
network, slows for the car ahead, and turns at intersections. 34
pedestrians walk the sidewalks and panic at gunshots or speeding cars.

## What is in it

- On-foot and driving movement with a camera that follows with
  look-ahead in the driving direction.
- 8 car models, each with its own name, colour, speed and price. Parked
  cars all over the city can be stolen with E (stealing raises heat).
- A 0–5 star wanted level: more stars mean more Vice Patrol cars, faster
  spawns and higher cop top speeds. Heat cools off after 45 seconds
  without a new crime. On foot, a patrol car that pulls up close busts
  you.
- Combat: punch (F or Space) and shoot (mouse click), on foot and as a
  drive-by from a car. Bullets damage cars; hitting police raises heat.
  Hard crashes throw particles, damage the car and shake the camera.
- Cash and health pickups scattered around the city.
- Five story missions (press M to start the next one), paying $500,
  $900, $1,400, $2,200 and $5,000: First Ride, Club Pickup, Warehouse
  Heat, Night Market Run (150-second limit) and The Sunset Score.
  Finishing all five shows the win screen: "You own Solmar Bay".
- HUD: cash, health bar and wanted stars (top-left), district name
  (top-right), current objective and mission timer (top-centre), message
  toasts (bottom), and a live minimap (bottom-right) showing the player,
  police cars and the mission target.
- Title, pause, busted, wasted and win screens. Save/load through
  localStorage (H to save, Continue on the title screen).
- Procedural WebAudio sound only: engine hum that follows speed, police
  siren, gunshot, punch, pickup chime, mission jingle, busted sting and
  a synthwave music loop (N toggles it). No audio files.
- Sunset vignette over the scene, neon-glow building edges on the Strip,
  and a red flash overlay at 4–5 stars.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Move on foot / drive |
| Shift | Run (on foot) |
| E | Enter or exit a car |
| Mouse click | Shoot toward the mouse |
| F or Space | Punch |
| M | Start the next mission |
| P | Pause |
| H | Save |
| N | Toggle music |
| R | Restart the run (from pause) |
| Enter | Start / retry |
| Esc | Back to title (from busted / wasted) |

## How to play

1. Open `game/index.html` through a static server (for example
   `node serve.ts`, then http://localhost:8080) and press Enter.
2. Walk the Strip with WASD. Press E near a parked car to steal it —
   expect a wanted star.
3. Press M to start the first job: bring a stolen car to the Sunset
   Garage. Each completed job pays cash and unlocks the next.
4. Watch the minimap for police and for the yellow mission marker.
   Lose the cops by staying clean for 45 seconds.
5. Press H any time to save; the title screen offers Continue.

## Deterministic screenshot scenes

Open the game with a `?shot=` query to stage a fixed scene from the
seed (the same seed always renders the same frame):

- `?shot=start` — the title screen over the living city.
- `?shot=drive` — cruising the Neon Strip in a stolen car.
- `?shot=chase` — a three-star police pursuit in progress.
- `?shot=mission` — mid-mission at Club Flamingo with the HUD visible.

## File structure

```
main.ts                  entry program: copies game/ + screenshots/ to
                         the output dir and writes dossier.json
serve.ts                 dev server: serves game/ on port 8080
game/
  index.html             page shell: 1280x720 canvas, loads src/main.js
  src/
    config.js            constants (world, districts, player, cars,
                         wanted levels, models, rewards, save key)
    random.js            seeded RNG (mulberry32) + helpers
    city.js              city generation, districts, roads, collision
    world.js             simulation: player, traffic, pedestrians,
                         police, bullets, pickups, wanted, particles
    missions.js          the five-mission story arc
    render.js            camera, drawing, HUD, minimap, screens
    input.js             keyboard + mouse input
    audio.js             procedural WebAudio sound bank + music loop
    main.js              game loop, screen states, save/load
    shots.js             deterministic ?shot= scenes
  levels/
    solmar-bay.json      city + mission data (name, seed, size,
                         districts, landmarks, mission ids)
screenshots/             1-start.jpg, 2-drive.jpg, 3-chase.jpg,
                         4-mission.jpg (renders of this game's code)
docs/
  README.md              this file
```

No build step, no dependencies, no network requests at runtime.
