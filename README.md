# WARDENS

A mobile tower-defense with **merge** mechanics (Rush Royale-like): a 6×10 grid, continuous mana,
card-choice summon, on-board unit fusion, a **gravity** unit family as the differentiator, a
20-node PvE saga, and a PvP arena against calibrated bots. Portrait, F2P, no dark patterns.

Built with Vite + TypeScript, Canvas for the battle board and DOM/CSS for the meta screens.
Packaged for iOS/Android via Capacitor (see `docs/capacitor.md`).

## Run it

```bash
npm install
npm run dev        # play in a browser (portrait viewport)
npm run build      # production build -> dist/
npm run preview    # serve the build
```

## Checks & simulations

```bash
npm run typecheck        # tsc, strict
npm test                 # vitest (sim + meta unit tests)
npm run simulate         # headless campaign balance sweep (20 nodes)
npm run simulate:pvp     # PvP league calibration ramp
```

Balance is never tuned by feel: every change to `src/data` is re-validated by the simulations
(the studio rule "aucun tuning sans re-simulation").

## Architecture

```
src/
  sim/        Pure, deterministic combat engine (no DOM). Fixed timestep, spatial targeting,
              path-following enemies, mana/summon/merge, BotPolicy (shared by live PvP + sims).
  data/       ALL balancing: units (12, incl. 3 gravity), enemies, levels, campaign (20 nodes),
              meta (upgrade curve, rewards), arena (leagues/bots), shop (chests, offers).
  render/     Canvas battle renderer + board/HUD layout (pure pixel↔cell math).
  ui/         Design tokens (from the Claude Design maquettes) + DOM helpers.
  app/        Meta shell: Router, AppState (single source of truth), and the DOM screens
              (hub, collection, unit detail, deck, arena, shop, chest, settings, results).
  meta/       Versioned local save (schema v3 + migrations).
  platform/   Boundary interfaces (Save/Ads/IAP/Analytics) + NullProviders. Real SDKs plug in here.
  main.ts     Boots AppState + Router into the Hub.
docs/design/  The 6 reference maquettes + token summary (visual source of truth).
decisions.md  Per-mission journal: briefs, design decisions, quality gates, balance results.
```

Design principle: `sim` is deterministic and DOM-free, so combats are reproducible and the same
engine drives both the player and the bots — in game and in the headless balance scripts.

## Status

Missions M1–M6 of the studio pipeline are implemented (playable combat, wireframe-faithful battle
screen, full meta, PvP arena, shop/monetization hooks, Capacitor prep). Art is intentionally
placeholder (geometric shapes) pending the Phase 3 juice/art pass. See `decisions.md` for the full
audit and remaining work.
