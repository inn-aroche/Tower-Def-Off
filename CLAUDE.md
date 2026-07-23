# WARDENS — notes for AI agents

Mobile tower-defense with merge (Rush Royale-like). Read `decisions.md` first — it is the
authoritative per-mission journal (design decisions, deviations, quality gates, balance results).
The 6 reference maquettes live in `docs/design/` and are the **visual source of truth**.

## Non-negotiable architecture

- **`src/sim` is pure and deterministic**: no DOM, no rendering imports, fixed timestep, no ambient
  `Math.random`/`Date.now`. The same engine runs the player, the PvP bots, and the headless
  balance sims. Keep it that way — it's what makes combats reproducible and the sims trustworthy.
- **ALL balancing lives in `src/data`** — never hardcode combat/economy constants in `sim` or
  `render`.
- **Meta screens are DOM/CSS (`src/app/screens`, `src/ui`); the battle board is Canvas
  (`src/render`).** `AppState` is the single source of truth for meta; screens read/mutate through
  it and it persists.
- **Platform boundary**: native concerns (Save/Ads/IAP/Analytics) go behind interfaces in
  `src/platform/types.ts` with `Null*` defaults. The web build stays on Null providers.

## Rules that must hold

- **No tuning without re-simulation.** After any `src/data` change run `npm run simulate` (campaign)
  and `npm run simulate:pvp` (arena) and record the result in `decisions.md`.
- **No dark patterns** (studio rule): no energy, chests show contents, honest prices, rewarded is
  opt-in, never interstitials.
- Before finishing a change: `npm run typecheck`, `npm test`, `npm run build` must be green.
- Save changes require a schema-version bump + a migration branch + a migration test.

## Gotchas

- Preview/verify in-browser by serving `dist/` over http (Playwright), not `file://` (ES modules +
  CORS). Google Fonts CDN is blocked in the sandbox/artifact → system fallback (fine); self-host
  before store submission.
- When publishing the shared artifact, keep the same file path to keep the same URL.
- Deterministic sim ⇒ balance scripts sweep a *skill* knob (player reaction interval) rather than
  RNG seeds.
