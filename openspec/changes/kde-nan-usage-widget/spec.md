# Spec: KDE NaN Usage Widget

## Functional Requirements

### FR-1: Compact Representation

- **FR-1.1** The compact representation shows a NaN icon.
- **FR-1.2** It shows the utilization percentage of the selected panel model.
- **FR-1.3** It shows the time until the next reset (e.g. `12d`, `4h21m`).
- **FR-1.4** The gauge style is configurable: `ring`, `bar`, or `none`.
- **FR-1.5** The panel model is configurable: `worst` (highest level, then
  utilization), `max` (highest utilization), or `fixed` (a specific model id).
- **FR-1.6** The color/level reflects consequence, not only raw percentage:
  - `ok` (green): safe.
  - `warn` (amber): projected usage >= 75% at reset, or lockout before reset.
  - `crit` (red): lockout would last >= 10% of the period, or utilization >= 90%.

### FR-2: Full Representation (Popup)

- **FR-2.1** Lists one row per model with a progress bar.
- **FR-2.2** Each row shows: model name, used tokens, cap, remaining, and
  utilization percentage.
- **FR-2.3** Each row may show a projection note when applicable.
- **FR-2.4** Models with zero usage are hidden by default; a settings option
  `hideUnused` controls this.
- **FR-2.5** A refresh button triggers an immediate poll.
- **FR-2.6** The menu header shows the user handle, region, and tier when
  `GET /api/auth/me` succeeds.
- **FR-2.7** The popup includes a button that opens
  `https://cloud.nan.builders/dashboard` in the default browser.

### FR-3: Aggregated Metrics (optional)

- **FR-3.1** When enabled, the popup shows a footer line with aggregated usage
  for 24 h, month-to-date, and last 30 days.
- **FR-3.2** This requires one extra request to `GET /api/metrics/usage`.
- **FR-3.3** Failure of this request must not affect quota display.

### FR-4: Configuration

- **FR-4.1** `keyPath`: path to the API-key file, `~` expands to home.
  Default: `~/.config/nan/api-key`.
- **FR-4.2** `pollSeconds`: polling interval, 60–1800 s. Default: 300.
- **FR-4.3** `panelModel`: `worst` | `max` | `fixed`. Default: `worst`.
- **FR-4.4** `panelModelId`: model id used when `panelModel` is `fixed`.
- **FR-4.5** `panelGauge`: `ring` | `bar` | `none`. Default: `ring`.
- **FR-4.6** `showIcon`, `showPercentage`, `showReset` booleans. Default: true.
- **FR-4.7** `hideUnused`: hide zero-usage models. Default: true.
- **FR-4.8** `showMetrics`: show aggregated metrics. Default: true.

### FR-5: Error Handling

- **FR-5.1** Missing key file or empty key: show a dedicated "no key" state and
  offer a hint to create the file.
- **FR-5.2** HTTP 401: show "API key rejected".
- **FR-5.3** HTTP 403: show "access denied".
- **FR-5.4** HTTP 429: show "rate limited; will retry next poll".
- **FR-5.5** HTTP 5xx or network error: keep and display the last successful
  data, mark it stale, and show the error in the popup.
- **FR-5.6** The API key must never appear in logs or error messages.

### FR-6: Polling

- **FR-6.1** Poll immediately on startup, then every `pollSeconds`.
- **FR-6.2** A manual refresh triggers a poll, with a minimum of 30 s between
  network requests.
- **FR-6.3** Polling pauses when no data is needed (e.g. system sleep) and
  resumes on wake.

## Non-Functional Requirements

- **NFR-1** The Plasmoid must not block the Plasma shell UI thread; network I/O
  must be asynchronous.
- **NFR-2** Memory and CPU overhead should be negligible when idle.
- **NFR-3** The code must be testable; pure logic lives in a JavaScript module
  that can run under Node.js without Plasma.
- **NFR-4** The API key is read from disk on each request so users can rotate it
  without restarting Plasma.
- **NFR-5** Icons and text must remain legible on both light and dark themes.
