# Archive: KDE NaN Usage Widget

## Change

`kde-nan-usage-widget` — a Plasma 6 Plasmoid that shows the NaN subscription
quota in the panel and in a popup, ported from
[gnome-nan-usage](https://github.com/prgr1no/gnome-nan-usage).

## Delivered

- A complete `org.nan.usage` Plasmoid package with compact and full
  representations, KConfigXT settings and a `nan.svg` icon.
- Pure logic in `contents/code/quotaModel.js` (token/percentage/duration
  formatting, normalization, projection, lockout and level derivation,
  panel-window selection, metrics summary) with Node unit tests.
- HTTP layer in `contents/code/nanClient.js` using `XMLHttpRequest`, with
  user-facing error mapping and shell-safe key-file command building.
- `install.sh`, `README.md` and `LICENSE` (GPL-2.0-or-later).

## Verification

Automated: 21 unit tests (16 model + 5 client helpers), `qmllint` with no errors,
a `qmlscene6` smoke test of the UI components, package install/upgrade via
`kpackagetool6`, and a live 401 check against the real NaN quota endpoint.
See [verify.md](verify.md).

## Known limitations and follow-ups

- The happy path with a real API key has not been exercised in a live Plasma
  session from this environment; a manual acceptance pass and screenshots are
  pending.
- The bar gauge is a simple two-rectangle implementation; the ring is the
  primary style.
- UI strings are in Spanish (matching the reference project). English
  translations can be added later.
- The API routes are undocumented and can change without notice; the client
  degrades to cached data and a warning.

## Artifacts

- [proposal.md](proposal.md)
- [spec.md](spec.md)
- [design.md](design.md)
- [tasks.md](tasks.md)
- [apply.md](apply.md)
- [verify.md](verify.md)
