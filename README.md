# Sunset Streets — an open-world crime game in Solmar Bay

A complete 2D top-down open-world crime game, built for the make.fun
**Make GTA 6** bounty (gta6-01). Wholly original: its own city, characters,
vehicles, names, story, art, sound and music — nothing from Rockstar Games
or any other commercial game.

You are **Mara Solis**, a driver for hire in **Solmar Bay** — three districts
(Neon Strip, Portside, Old Town), five story missions, traffic, pedestrians,
cars to steal, a 0–5 star wanted level with Vice Patrol pursuits, combat, a
HUD with a live minimap, save/load, and procedural WebAudio sound + music.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime — every file the page loads
lives under `game/`.

## Controls

WASD / arrows move & drive · Shift run · E enter/exit car · Click shoot ·
F punch · M mission · P pause · H save · N music · R restart (from pause)

## Layout

- `main.ts` — entry program: copies `game/` + `screenshots/` to `/output`
- `game/` — the playable game as static files (`index.html` + `src/`)
- `game/levels/solmar-bay.json` — city + mission data
- `screenshots/` — 4 real renders of the game's own code
- `docs/README.md` — full documentation
- `vendor/makefun-game.ts` — kit library, unchanged

## License

MIT — see `LICENSE`.
