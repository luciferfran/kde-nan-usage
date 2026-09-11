# Design: KDE NaN Usage Widget

## Architecture Overview

A single Plasma 6 Plasmoid package, `org.kde.nan-usage`, installed under
`~/.local/share/plasma/plasmoids/` (or linked during development). The Plasmoid
can be added to a panel, a system tray, or the desktop. It exposes:

- a **compact representation** (icon, ring/bar, percentage, reset countdown) for
  panels and the system tray;
- a **full representation** (popup) with per-model bars and metrics;
- a **configuration page** for settings.

A pure JavaScript module holds the quota logic so it can be tested outside
Plasma. Network and file access are thin adapters in QML/JS.

## Package Layout

```text
org.kde.nan-usage/
├── metadata.json
├── contents/
│   ├── config/
│   │   ├── main.xml            # KConfigXT settings schema
│   │   └── config.qml          # config page list
│   ├── code/
│   │   ├── quotaModel.js       # pure logic (testable with Node)
│   │   └── nanClient.js        # XMLHttpRequest wrapper
│   ├── icons/
│   │   └── nan.svg             # NaN logo / fallback icon
│   └── ui/
│       ├── main.qml            # Plasmoid root, polling, compact/full switch
│       ├── CompactRepresentation.qml
│       ├── FullRepresentation.qml
│       ├── ModelRow.qml
│       ├── RingGauge.qml
│       └── configGeneral.qml
└── tests/
    └── quotaModel.test.js      # Node test for pure logic
```

## Data Flow

1. **Key read.** A `Plasma5Support.DataSource` with `engine: "executable"` runs
   `cat` against the configured key path. Its output is stored in an `apiKey`
   property. Reading is re-triggered before each poll so key rotation is picked
   up without restarting Plasma.
2. **Poll.** `main.qml` starts a `Timer` with `interval: pollSeconds * 1000`.
   On timeout (and on manual refresh), it calls `nanClient.request(path, key)`,
   which uses `XMLHttpRequest` with `Authorization: Bearer <key>`.
3. **Model.** The JSON response is passed to `quotaModel.normalizeQuota()`, then
   to `selectPanelWindow()` and `windowLevel()` to compute the compact view.
4. **Render.** `CompactRepresentation` binds to the computed level, percentage,
   and reset text. `FullRepresentation` builds a `Repeater` over
   `visibleWindows()`.
5. **Errors.** `nanClient` rejects with an error object carrying `status`.
   `main.qml` maps it to a user-facing string via `describeError()` and keeps the
   previous `windows` array intact.

## Key Decisions

### Language: QML + JavaScript

Plasma widgets are natively QML. Keeping the logic in a JS module that has no
Plasma imports makes it testable with Node and mirrors the reference project's
`lib/quotaModel.js`.

### Network: `XMLHttpRequest`

Qt 6 QML provides `XMLHttpRequest` globally. It supports async requests and
custom headers, which is all the NaN API needs. No C++ plugin is required.

### File read: `Plasma5Support.DataSource` (executable engine)

QML has no first-class file-read API. The `executable` engine in
`org.kde.plasma.plasma5support` can run `cat` and capture stdout. The key path is
escaped by passing the command as an argument array rather than a shell string.

Alternative considered: a small C++ helper. Rejected for the first version to
avoid build tooling and ABI coupling to Plasma.

### Ring gauge: QML `Canvas`

No Plasma/Kirigami component provides a ring gauge. A `Canvas` drawing two arcs
(background track and value arc) is simple, themable via palette colors, and has
no dependencies.

### Configuration: KConfigXT

Plasma's standard config mechanism (`main.xml` + generated config bindings via
`plasmoid.configuration.*`) provides persistence, defaults, and the settings UI
for free.

### Error policy

Network errors never clear existing data. A `stale` flag and `lastError` string
are shown in the popup; the compact view keeps the last level but can dim the
icon. This matches the reference extension's behavior.

## Testing Strategy

- **Unit (Node):** `tests/quotaModel.test.js` imports the pure module and checks
  `fmtTokens`, `fmtPct`, `humanDuration`, `normalizeQuota`, `projectedUtil`,
  `exhaustMs`, `lockoutMs`, `windowLevel`, `selectPanelWindow`, and
  `metricsSummary` against synthetic data and a fixed clock.
- **Manual/integration:** run the Plasmoid in a Plasma session
  (`plasmashell --replace` or a nested session) and verify polling against the
  live API with a real key. Document exact commands in the README.
- **Static:** `qmllint` on `contents/ui/*.qml` if available.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Undocumented API changes | Keep parsing defensive; show error but retain data. |
| `plasma5support` unavailable on some distros | Fallback: read key via `sh -c` executable engine; document dependency. |
| Qt version differences | Target Plasma 6 / Qt 6; use only documented QML types. |
| Key leakage in logs | Never `console.log` the key; `describeError` never includes it. |
