# Tasks: KDE NaN Usage Widget

Legend: `[ ]` pending, `[~]` in progress, `[x]` done, `[!]` blocked.

## Phase 0: Scaffolding

- [x] 0.1 Create `org.nan.usage/` package skeleton with `metadata.json`
  (Plasma 6, `X-Plasma-API-Minimum-Version: 6.0`,
  `X-Plasma-NotificationAreaCategory: ApplicationStatus`).
- [x] 0.2 Create `contents/ui/`, `contents/code/`, `contents/config/`,
  `contents/icons/`, `tests/` directories.
- [x] 0.3 Add `nan.svg` icon (derived from the public NaN favicon, GPL-compatible).

## Phase 1: Pure Logic (TDD)

- [x] 1.1 **RED** — Wrote `tests/quotaModel.test.js`; ran with Node against a
  stub and confirmed 12 failures.
- [x] 1.2 **GREEN** — Implemented `contents/code/quotaModel.js`; 16/16 tests pass.
- [x] 1.3 **TRIANGULATE** — Covered missing response, early-period guard,
  zero-usage filtering, fixed-model fallback, and overshoot.
- [x] 1.4 **REFACTOR** — Kept functions pure and documented; no Qt/Plasma imports.

## Phase 2: Network Client

- [x] 2.1 Implemented `contents/code/nanClient.js` with callback-based
  `request(path, key, onSuccess, onError)` using `XMLHttpRequest`.
- [x] 2.2 Implemented `describeError(error)` mapping status codes; never includes
  the key.
- [x] 2.3 Added `fetchQuota`, `fetchMe`, `fetchMetrics` wrappers.

## Phase 3: QML UI

- [x] 3.1 Implemented `main.qml`: state, config mirrors, poll/cooldown timers,
  key reading via `Plasma5Support.DataSource`, compact vs full representation.
- [x] 3.2 Implemented `RingGauge.qml` with `Canvas`.
- [x] 3.3 Implemented `CompactRepresentation.qml` (icon, ring, bar, percentage,
  reset text, level color).
- [x] 3.4 Implemented `ModelRow.qml` (name, bar, used/cap, percentage, note).
- [x] 3.5 Implemented `FullRepresentation.qml` (heading, refresh button, list,
  metrics footer, warning/error message).

## Phase 4: Configuration

- [x] 4.1 Wrote `contents/config/main.xml` with the settings from spec FR-4.
- [x] 4.2 Wrote `contents/config/config.qml` and `contents/ui/configGeneral.qml`.
- [x] 4.3 Wired `Plasmoid.configuration.*` into `main.qml`; key path change
  re-reads the key, poll interval restarts the timer.

## Phase 5: Packaging and Docs

- [x] 5.1 Added `install.sh` (symlink/copy/uninstall).
- [x] 5.2 Wrote `README.md` (install, key setup, settings, development, privacy).
- [x] 5.3 Added `LICENSE` (GPL-2.0-or-later, matching the reference project).
- [x] 5.4 Added `scripts/install-online.sh` for the one-line install and
  documented it at the top of the README.
- [x] 5.5 Added `CHANGELOG.md`, a GitHub Actions workflow (Node tests and
  `qmllint`) and a CI badge in the README.

## Phase 6: Verification

- [x] 6.1 `node org.nan.usage/tests/quotaModel.test.js` — 16 passed, 0 failed;
  `node org.nan.usage/tests/nanClient.test.js` — 5 passed, 0 failed.
- [x] 6.2 `qmllint` on all QML and JS files — no errors (only `i18n`
  unqualified-access warnings, expected outside a Plasma runtime).
- [x] 6.3 UI smoke test with `qmlscene6` and mock data (compact, model row and
  full representation) — exit 0. Live endpoint with a fake key — HTTP 401 mapped
  to the expected message. Full live-key flow pending user key.
- [x] 6.4 Captured screenshots and added them to the README (`screenshots/`).

## Phase 7: Archive

- [x] 7.1 Wrote `apply.md` with completion notes and evidence.
- [x] 7.2 Wrote `verify.md` with test output and manual verification results.
- [x] 7.3 Wrote `archive.md` summarizing the delivered change.
