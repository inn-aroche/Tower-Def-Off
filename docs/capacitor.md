# Wrapping WARDENS for mobile (Capacitor)

The game is a self-contained web app (`base: './'` in `vite.config.ts`), so Capacitor packages the
`dist/` output into native iOS/Android shells with no code changes.

## One-time setup

```bash
npm install
npm run build            # produces dist/
npx cap add android      # requires Android Studio + JDK
npx cap add ios          # requires Xcode (macOS only)
```

This creates the native `android/` and `ios/` project folders (gitignored until you decide to
commit them).

## Build & run loop

```bash
npm run cap:android      # build web -> sync -> open Android Studio
npm run cap:ios          # build web -> sync -> open Xcode
```

`cap sync` copies the fresh `dist/` into the native projects and installs native plugins.

## Recommended plugins (wire behind the existing platform interfaces)

The `src/platform` layer already abstracts everything native so the sim/render code never depends
on Capacitor:

| Need | Plugin | Wire into |
|---|---|---|
| Local save (already localStorage) | `@capacitor/preferences` (optional) | `platform/LocalStorageSave.ts` |
| Haptics on merge/impact | `@capacitor/haptics` | new `HapticsProvider` (juice, Phase 3) |
| Rewarded / no-ads | AdMob (`@capacitor-community/admob`) | replace `NullAdProvider` |
| IAP (pass, gems) | `@capacitor-community/in-app-purchases` or RevenueCat | replace `NullIapProvider` |
| Analytics | GameAnalytics / Firebase | replace `NullAnalyticsProvider` |
| Cloud save / leaderboards (v2, P-2) | Supabase JS | new provider behind a `CloudSaveProvider` |

Keep the pattern: **interface in `platform/types.ts`, a `Null*` default, and a real adapter picked
at boot** — the same way the web build stays on the Null providers.

## Notes

- Fonts: the meta UI links Google Fonts (Baloo 2 / Nunito). Self-host them (bundle the `.woff2`
  and drop the CDN `<link>` in `ui/theme.ts`) before store submission so the UI never depends on
  network at launch. See the M6 audit in `decisions.md`.
- `backgroundColor` is set to the cream `#efe8d6` in `capacitor.config.ts` to avoid white flashes.
- Portrait-only: lock orientation in the native projects (Android `manifest`, iOS deployment info).
