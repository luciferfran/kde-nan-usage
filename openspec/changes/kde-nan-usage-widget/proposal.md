# Proposal: KDE NaN Usage Widget

## Why

`gnome-nan-usage` brings NaN subscription quota visibility to the GNOME top bar.
KDE Plasma users have no equivalent. This proposal describes a Plasma 6 Plasmoid
that surfaces the same information (per-model usage, reset time, burn-rate level)
so KDE users can monitor their NaN quota without leaving the desktop.

## What Changes

Create a new Plasma 6 Plasmoid, `org.kde.nan-usage`, written in QML/JavaScript
with a small JavaScript model layer. The Plasmoid will:

- Show a compact representation (icon + worst-model ring/percentage + days to
  reset) suitable for a panel or system tray.
- Show a full representation (popup) with one progress bar per model, showing
  tokens used, cap, remaining, and projection notes.
- Read the NaN API key from `~/.config/nan/api-key` (same file as the `nan` CLI
  and the GNOME extension), with a configurable path.
- Poll the NaN cloud backend at a configurable interval (default 300 s) using
  `GET /api/usage/quota`; optionally fetch `GET /api/metrics/usage` for
  aggregated 24 h / month / 30 d figures.
- Derive alert levels by consequence (projected overshoot, lockout duration),
  porting the logic from `gnome-nan-usage/lib/quotaModel.js`.
- Handle API failures gracefully: keep the last good data and show an error
  state instead of clearing the display.

## Out of Scope

- OAuth or any authentication other than the API-key file.
- Historical storage or charts. No data is persisted beyond the current session.
- GNOME Shell compatibility or cross-desktop packaging.
- Languages other than JavaScript/QML for the first version.
- Advanced configuration UI beyond the basics needed for phase 1 (API key path,
  poll interval, panel model selection, gauge style).

## Impact

- New repository content only; no existing code is modified.
- Requires Plasma 6 runtime (QML, PlasmaCore, KConfigXT) and network access to
  `cloud-api.nan.builders`.
- API endpoints are undocumented; breakage is an accepted risk and must degrade
  gracefully.

## Success Criteria

1. The Plasmoid can be added to a panel and to the system tray.
2. The compact view shows a ring/bar with the worst-model percentage and the
   time until reset.
3. Clicking opens a popup listing per-model usage with bars and projection notes.
4. Polling works at the configured interval and refreshes on demand.
5. Missing or invalid API key shows a clear, non-blocking error state.
6. A pure-logic test (Node or QML test) covers token formatting, projection,
   lockout, and level derivation.
