# Sunset Streets — an open-world crime game in Solmar Bay

A complete 2D top-down open-world crime game, built for the make.fun
**Make GTA 6** bounty (gta6-01). Wholly original: its own city, characters,
vehicles, names, story, art, sound and music — nothing from Rockstar Games
or any other commercial game.

## The game

You are **Mara Solis**, a driver for hire in **Solmar Bay**, a sun-soaked
coastal city with three districts:

- **Neon Strip** — glowing boulevards, clubs and casinos
- **Portside** — docks, warehouses and container yards
- **Old Town** — brick lanes, markets and the old plaza

### What is in it

- **Open world on foot and by car** — a 3840×2560 city grid with roads,
  100+ buildings, palm trees, street lamps and named landmarks
- **Traffic and pedestrians** — 26 moving cars that follow the roads and
  slow for traffic, 34 pedestrians who panic and flee
- **Cars to steal** — parked cars all over the city; stealing one raises
  your wanted level
- **Wanted level and police** — 0–5 stars; Vice Patrol cars chase, ram and
  try to bust you on foot; heat cools off over time
- **Missions and story** — a five-job arc from Mara and Dante Cole:
  First Ride, Club Pickup, Warehouse Heat, Night Market Run, and the
  Sunset Score finale, with a timer on the race job
- **Combat** — punch (F), shoot (mouse click), drive-by shooting from a car
- **HUD with minimap** — cash, health bar, wanted stars, district name,
  objective tracker, mission timer, message toasts and a live minimap
  showing the player, police and mission target
- **Start screen, pause and save** — title screen, pause menu, save/load
  via localStorage (H), busted / wasted / win screens
- **Sound and music** — fully procedural WebAudio: engine hum, sirens,
  gunshots, pickup chimes and a synthwave loop (no audio files)
- **Polish** — camera look-ahead while driving, crash particles, sunset
  vignette, red flash at 4–5 stars, neon-glow buildings on the Strip

### Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move on foot, drive |
| Shift | Run |
| E | Enter / exit a car (steal parked cars) |
| Mouse click | Shoot (on foot or drive-by) |
| F / Space | Punch |
| M | Start the next mission |
| P | Pause |
| H | Save (or continue a save from the title screen) |
| N | Toggle music |
| R | Restart run (from pause) |
| Enter | Start / retry |

## Play it

Serve `game/` with any static server and open `game/index.html`:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime — every file the page loads
lives under `game/`.

## Deterministic screenshots

The game stages its own screenshot scenes from a fixed seed:

- `?shot=start` — title screen over the living city
- `?shot=drive` — cruising the Neon Strip in a stolen car
- `?shot=chase` — three-star police pursuit
- `?shot=mission` — mid-mission at Club Flamingo with the HUD

The same seed always produces the same frame.

## Structure

```
main.ts                  entry program: copies game/ + screenshots/ to /output
vendor/makefun-game.ts   kit library, unchanged
game/
  index.html             page shell
  src/
    config.js            constants: world, districts, cars, wanted levels
    random.js            seeded RNG (mulberry32)
    city.js              city generation: roads, buildings, props, landmarks
    world.js             simulation: player, traffic, peds, police, combat
    missions.js          five-mission story arc
    render.js            camera, city/entities drawing, HUD, minimap, screens
    input.js             keyboard + mouse
    audio.js             procedural WebAudio sound + music
    main.js              game loop, screens, save/load
    shots.js             deterministic screenshot scenes
  levels/solmar-bay.json city + mission data
  assets/                (procedural art — no binary assets needed)
screenshots/             4 real renders of the game's own code
```

## License

MIT — see `LICENSE`.
