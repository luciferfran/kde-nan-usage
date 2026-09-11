# Apply: KDE NaN Usage Widget

## Status

Implementation complete for the agreed scope (phase 1: basic usage display,
panel + system tray, QML/JavaScript). Pending: live-key manual verification and
screenshots.

## Delivered files

| Path | Purpose |
| --- | --- |
| `org.nan.usage/metadata.json` | Plasma 6 applet metadata, tray category |
| `org.nan.usage/contents/code/quotaModel.js` | Pure quota logic (UMD-style, Node-testable) |
| `org.nan.usage/contents/code/nanClient.js` | `XMLHttpRequest` client and error mapping |
| `org.nan.usage/contents/config/main.xml` | KConfigXT settings schema |
| `org.nan.usage/contents/config/config.qml` | Config page list |
| `org.nan.usage/contents/ui/main.qml` | Plasmoid root, polling, state |
| `org.nan.usage/contents/ui/CompactRepresentation.qml` | Panel/tray view |
| `org.nan.usage/contents/ui/FullRepresentation.qml` | Popup view |
| `org.nan.usage/contents/ui/ModelRow.qml` | Per-model row |
| `org.nan.usage/contents/ui/RingGauge.qml` | Canvas ring gauge |
| `org.nan.usage/contents/ui/configGeneral.qml` | Settings UI |
| `org.nan.usage/contents/icons/nan.svg` | Icon |
| `org.nan.usage/tests/quotaModel.test.js` | Node unit tests |
| `org.nan.usage/tests/nanClient.test.js` | Client helper tests |
| `install.sh` | Dev symlink/copy/uninstall |
| `scripts/install-online.sh` | One-line online installer |
| `screenshots/*.png` | README screenshots |
| `README.md`, `LICENSE` | Docs and license |

## TDD evidence

### RED

Stub implementation, `node org.nan.usage/tests/quotaModel.test.js`:

```text
4 passed, 12 failed
EXIT=1
```

### GREEN

Real implementation, same command:

```text
16 passed, 0 failed
EXIT=0
```

A second suite covers the client helpers (`tests/nanClient.test.js`):

```text
5 passed, 0 failed
```

## Static verification

Qt 6 `qmllint` (`/usr/lib/qt6/bin/qmllint`, Qt 6.11.2) over every QML file:
no errors. Only `i18n` unqualified-access warnings remain, which are expected
because `i18n` is injected by the Plasma runtime and is unknown to a bare
`qmllint` run.

`qmllint` over both `.js` files: clean.

## Package verification

```text
$ kpackagetool6 --type Plasma/Applet --install org.nan.usage
/home/francisco/.local/share/plasma/plasmoids/org.nan.usage/ instalado con éxito
```

`kpackagetool6 --show org.nan.usage` reports the plugin id, name and author.

## Live endpoint check

`XMLHttpRequest` against `cloud-api.nan.builders/api/usage/quota` with a fake key:

```text
STATUS=401 KIND=http DESC=NaN rechaza la API key (401)
EXIT=0
```

This confirms the URL, the Bearer header, the JSON error path and the message
mapping. A full happy-path run needs a real key in `~/.config/nan/api-key`.

## Design deviations

- The bundled icon is rendered with `Image { source: Qt.resolvedUrl("../icons/nan.svg") }`
  because `Kirigami.Icon` searches the icon theme and does not look inside the
  package's `contents/icons/` (`PlasmaCore.IconItem` no longer exists in Plasma
  6). `install.sh` also copies the icon into the user icon theme so the widget
  explorer can resolve `KPlugin.Icon`.
- `pragma ComponentBehavior: Bound` added to the QML files that reference outer
  ids from nested components, as required by Qt 6.
- `ModelRow` takes `windowData` instead of `modelData` to avoid clashing with the
  `Repeater`'s injected `modelData` binding.
- `metadata.json` keeps `X-Plasma-*` keys at the top level (Plasma 6 requirement);
  nesting them inside `KPlugin` makes Plasma reject the applet as an old
  version.
- The popup has a full-width “Panel de NaN” button that calls
  `Qt.openUrlExternally("https://cloud.nan.builders/dashboard")`, mirroring the
  reference extension's dashboard link.
- The compact representation pins its `Layout.minimumWidth`,
  `Layout.preferredWidth`, `Layout.maximumWidth` and the height equivalents to
  the content size. Plasma sizes applets from the representation's `Layout`
  hints; without them the widget got a square slot and overlapped its
  neighbours.
- `CompactRepresentation` has two forms: the wide one (icon + gauge + percentage
  - reset) for panels and a square one (icon with a level ring) selected via
  `Plasmoid.containmentDisplayHints & ContainmentForcesSquarePlasmoids`, which
  is what the system tray sets.
