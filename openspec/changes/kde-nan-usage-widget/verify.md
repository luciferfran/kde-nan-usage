# Verify: KDE NaN Usage Widget

## Automated checks

### Unit tests — pure quota logic

```text
$ node org.nan.usage/tests/quotaModel.test.js

16 passed, 0 failed
```

Covered: `fmtTokens`, `fmtPct`, `humanDuration`, `shortModel`,
`normalizeQuota` (including invalid rows and missing response), `projectedUtil`
(with and without the early-period guard), `exhaustMs`, `lockoutMs`,
`windowLevel` (`ok`/`warn`/`crit`), `projectionNote`, `visibleWindows`,
`selectPanelWindow` (`worst`/`max`/`fixed` + fallback), `metricsSummary`.

### Unit tests — client helpers

```text
$ node org.nan.usage/tests/nanClient.test.js

5 passed, 0 failed
```

Covered: `shellQuote` (including embedded single quotes), `keyCommand`
(`~`, `~/…`, absolute paths with spaces/quotes), and `describeError` for 401,
403, 429, 5xx, unknown 4xx, network error, missing key, parse error and null.

### Static analysis

```text
$ /usr/lib/qt6/bin/qmllint -I /usr/lib/qt6/qml org.nan.usage/contents/ui/*.qml
(no errors; only i18n unqualified-access warnings, expected outside Plasma)

$ /usr/lib/qt6/bin/qmllint -I /usr/lib/qt6/qml org.nan.usage/contents/code/*.js
(clean)
```

### UI smoke test (qmlscene6, Qt 6.11.2)

A harness instantiated `CompactRepresentation` (ring gauge, warn level),
`ModelRow` (mid-period projection) and `FullRepresentation` (one model, metrics
footer) with mock data:

```text
EXIT=0
```

Only environment warnings appeared (`kf.windowsystem` plugin missing under
offscreen, `kf.i18n` domain unset outside Plasma). No QML errors.

### Package installation

```text
$ kpackagetool6 --type Plasma/Applet --install org.nan.usage
/home/francisco/.local/share/plasma/plasmoids/org.nan.usage/ instalado con éxito

$ kpackagetool6 --type Plasma/Applet --upgrade org.nan.usage
... actualizado con éxito
```

### Live endpoint check

With a fake API key, `XMLHttpRequest` reached the real endpoint:

```text
STATUS=401 KIND=http DESC=NaN rechaza la API key (401)
EXIT=0
```

### Key-file read integration

`Plasma5Support.DataSource` (executable engine) using the exact command built by
`NanClient.keyCommand()` read a temporary key file, both with a plain path and
with a path containing spaces:

```text
KEY=test-key-123   EXIT=0
KEY=spaced-key-456 EXIT=0
```

## Fixes during manual verification

- `metadata.json`: the `X-Plasma-*` keys were nested inside `KPlugin`, but
  Plasma 6 requires them at the top level. Moved `X-Plasma-API-Minimum-Version`
  and `X-Plasma-NotificationAreaCategory` out of `KPlugin`, and added
  `X-Plasma-API: declarativeappletscript` and `X-Plasma-MainScript: ui/main.qml`.
  Without this, Plasma showed “unrecognized widget” and refused to load it.
- Icon: `Kirigami.Icon { source: "nan" }` searches the icon theme, not the
  package's `contents/icons/`. The compact representation now uses
  `Image { source: Qt.resolvedUrl("../icons/nan.svg") }`. `install.sh` also
  copies the icon to `~/.local/share/icons/hicolor/scalable/apps/nan.svg` so the
  widget explorer can resolve `KPlugin.Icon`.
- Panel overlap: the containment sizes applets from the representation's `Layout`
  hints. The compact representation now pins `Layout.minimumWidth`,
  `Layout.preferredWidth` and `Layout.maximumWidth` (and the height equivalents)
  to its content size, and `RingGauge` exposes an implicit size. Without this the
  widget was allocated a square slot and its ring/labels overlapped the
  neighbouring panel icons.
- Metadata credit: removed the `Website` pointing at the original
  `gnome-nan-usage` repository and added `prgr1no (gnome-nan-usage)` to
  `KPlugin.Authors`. The README still credits the original project. A later
  update set `Website` to the author's own repository
  (`https://github.com/luciferfran/kde-nan-usage`).
- System tray: the tray forces square applets
  (`PlasmaCore.Types.ContainmentForcesSquarePlasmoids`), so the wide compact
  representation overlapped its neighbours there. `CompactRepresentation` now
  has a `square` mode (icon with a level ring, 22x22) selected from
  `Plasmoid.containmentDisplayHints`; the wide form is used on normal panels.
- Popup model names: `ModelRow` was using `shortModel()` (the panel abbreviation)
  for the popup rows. It now shows the full `model` id from the API with elision,
  matching the reference gnome-nan-usage menu. The panel still uses the short
  form. `KPlugin.Authors` first entry renamed from `Francisco` to `luciferfran`.

## Manual verification

Performed in a live Plasma 6.7 session with a real API key:

- Panel: compact view shows icon, ring, percentage and reset time without
  overlapping neighbouring applets.
- System tray: square mode (icon with a level ring) fits the tray slot.
- Desktop: the full representation is shown inline.
- Popup: one row per model with the full model id, projection notes, metrics
  footer and the “Panel de NaN” dashboard button.
- Screenshots captured in `screenshots/`.

Still to check:

- Settings changes (poll interval, gauge style, panel model, key path).
- Failure modes: missing key file, invalid key (401), network down.

## Result

All automated verification passes. The change is ready for manual Plasma
acceptance testing.
