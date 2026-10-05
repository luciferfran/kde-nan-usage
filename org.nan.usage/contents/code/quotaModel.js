// SPDX-License-Identifier: GPL-2.0-or-later
// Pure logic for the NaN usage Plasmoid. No Plasma or Qt imports so this file
// can run under Node.js for tests and be imported from QML unchanged.

const LEVEL_RANK = { ok: 0, warn: 1, crit: 2 }

// Minimum fraction of the period that must have elapsed before extrapolating:
// early in the month the average is noise.
const MIN_ELAPSED_FRAC = 0.05
// Losing quota for at least this fraction of the period is critical; running
// out just before the reset is only a warning.
const LOCKOUT_CRIT_FRAC = 0.1

// Level from the raw percentage: how full the bucket is right now.
function utilLevel(util) {
    if (util >= 90) return "crit"
    if (util >= 75) return "warn"
    return "ok"
}

function maxLevel(a, b) {
    return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b
}

function parseDate(v) {
    if (v == null) return null
    if (typeof v === "number") return v < 1e12 ? v * 1000 : v
    const t = Date.parse(String(v))
    return Number.isNaN(t) ? null : t
}

// Compact token format: 3B, 1,5B, 79,9M, 500M, 398K, 42.
function fmtTokens(n) {
    const v = Math.max(0, Number(n) || 0)
    const trim = (s) =>
        s.replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")
    if (v >= 1e9) return `${trim((v / 1e9).toFixed(2))}B`
    if (v >= 1e6) return `${trim((v / 1e6).toFixed(1))}M`
    if (v >= 1e3) return `${Math.round(v / 1e3)}K`
    return String(Math.round(v))
}

// Percentage: integer for the panel; one decimal below 10 % in the popup,
// where "0 %" for weeks says nothing.
function fmtPct(util, fine) {
    const v = Math.max(0, Number(util) || 0)
    if (fine && v < 10) return `${v.toFixed(1).replace(".", ",")}%`
    return `${Math.round(v)}%`
}

// Short model name for the panel, like `nan status`: deepseek-v4-flash -> ds4f.
function shortModel(id) {
    return String(id == null ? "" : id)
        .replace("deepseek-v4-flash", "ds4f")
        .replace("-flash", "f")
}

// Human duration with at most two units. compact is the panel form:
// 20d, 4h21m, 45m.
function humanDuration(ms, compact) {
    const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000))
    if (s < 60) return compact ? `${s}s` : `${s} s`
    const mins = Math.round(s / 60)
    if (mins < 60) return compact ? `${mins}m` : `${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)
        return compact ? `${hrs}h${mins % 60}m` : `${hrs} h ${mins % 60} min`
    const days = Math.floor(hrs / 24)
    return compact ? `${days}d` : `${days} d ${hrs % 24} h`
}

// Sorted (usage desc) list of normalized windows:
//   {key, model, label, used, cap, remaining, utilization, startsAt, resetsAt,
//    windowHours, windowCap, updatedAt}
// Dates in ms. Entries without model or cap are dropped.
function normalizeQuota(quota) {
    const startsAt = parseDate(quota?.periodStart)
    const list = Array.isArray(quota?.models) ? quota.models : []
    const out = []
    for (let i = 0; i < list.length; i++) {
        const m = list[i]
        const cap = Number(m?.cap)
        if (!m?.model || !Number.isFinite(cap) || cap <= 0) continue
        const used = Math.max(0, Number(m.tokensUsed) || 0)
        const remaining = Number.isFinite(Number(m.remaining))
            ? Number(m.remaining)
            : Math.max(0, cap - used)
        out.push({
            key: String(m.model),
            model: String(m.model),
            label: String(m.model),
            used: used,
            cap: cap,
            remaining: remaining,
            // Not clamped to 100: if NaN lets usage overshoot, show it.
            utilization: (used / cap) * 100,
            startsAt: startsAt,
            resetsAt: parseDate(m.periodEnd),
            windowHours: Number(m.windowHours) || 0,
            windowCap: Number(m.fullWindowTokens) || 0,
            updatedAt: parseDate(m.updatedAt)
        })
    }
    out.sort(
        (a, b) =>
            b.utilization - a.utilization || a.model.localeCompare(b.model)
    )
    return out
}

// Period timing for a window, or null when there is nothing to extrapolate
// from (no dates, finished period, or period just started).
function periodTimes(w, now) {
    const startsAt = w.startsAt
    const resetsAt = w.resetsAt
    if (!startsAt || !resetsAt || resetsAt <= startsAt) return null
    const total = resetsAt - startsAt
    const elapsed = now - startsAt
    const remaining = resetsAt - now
    if (remaining <= 0 || elapsed <= 0 || elapsed / total < MIN_ELAPSED_FRAC)
        return null
    return { total: total, elapsed: elapsed, remaining: remaining }
}

// Usage projected to the end of the period at the current average rate; never
// lower than the current usage.
function projectedUtil(w, now) {
    if (now == null) now = Date.now()
    const t = periodTimes(w, now)
    if (!t) return w.utilization
    return Math.max(w.utilization, (w.utilization * t.total) / t.elapsed)
}

// ms until quota runs out at the average rate, only when that happens before
// the reset; null if the rate does not exhaust it.
function exhaustMs(w, now) {
    if (now == null) now = Date.now()
    const t = periodTimes(w, now)
    if (!t || w.utilization <= 0) return null
    if (w.utilization >= 100) return 0
    const toExhaust = (t.elapsed * (100 - w.utilization)) / w.utilization
    return toExhaust < t.remaining ? toExhaust : null
}

// ms that would be spent without quota before the reset at the current rate.
function lockoutMs(w, now) {
    if (now == null) now = Date.now()
    const ex = exhaustMs(w, now)
    if (ex === null) return null
    return Math.max(0, w.resetsAt - now - ex)
}

// Window level from the consequence of the rate, not only the percentage:
// red if there is no headroom left or the lockout would be long; amber if the
// rate points high or runs out just before the reset.
function windowLevel(w, now) {
    if (now == null) now = Date.now()
    let level = utilLevel(w.utilization)
    const t = periodTimes(w, now)
    const lock = lockoutMs(w, now)
    if (lock !== null && t)
        level = maxLevel(
            level,
            lock >= t.total * LOCKOUT_CRIT_FRAC ? "crit" : "warn"
        )
    else if (projectedUtil(w, now) >= 75) level = maxLevel(level, "warn")
    return level
}

// Footer note for a bar, tied to the same threshold as windowLevel.
function projectionNote(w, now) {
    if (now == null) now = Date.now()
    const t = periodTimes(w, now)
    if (!t) return ""
    const lock = lockoutMs(w, now)
    if (lock !== null) {
        if (lock >= t.total * LOCKOUT_CRIT_FRAC)
            return `a este ritmo se agota en ~${humanDuration(exhaustMs(w, now))}`
        return "a este ritmo se agota justo antes del reset"
    }
    const proj = projectedUtil(w, now)
    if (proj >= 75 && Math.round(proj) > Math.round(w.utilization))
        return `camino de ~${Math.round(proj)}% al reset`
    return ""
}

// Windows listed in the popup: with hideUnused, zero-usage windows are removed
// except the model pinned to the panel, which is always shown.
function visibleWindows(windows, options) {
    options = options || {}
    const hideUnused = options.hideUnused !== false
    const pinned = options.pinned == null ? null : options.pinned
    if (!hideUnused) return windows
    return windows.filter((w) => w.used > 0 || w.model === pinned)
}

// Window reflected in the panel. worst: first by level, then by usage.
// max: highest usage. fixed: the given model, or worst if it is missing.
function selectPanelWindow(windows, mode, modelId, now) {
    if (now == null) now = Date.now()
    if (!windows?.length) return null
    if (mode === "fixed") {
        const hit = windows.find((w) => w.model === modelId)
        if (hit) return hit
    }
    const used = windows.filter((w) => w.used > 0)
    const pool = used.length ? used : windows
    if (mode === "max")
        return pool.reduce((best, w) =>
            w.utilization > best.utilization ? w : best
        )
    const score = (w) => LEVEL_RANK[windowLevel(w, now)] * 1000 + w.utilization
    return pool.reduce((best, w) => (score(w) > score(best) ? w : best))
}

// Aggregated usage line from GET /api/metrics/usage.
function metricsSummary(metrics) {
    if (!metrics) return ""
    const total = (b) =>
        fmtTokens(b && b.totalTokens != null ? b.totalTokens : 0)
    const parts = []
    if (metrics.last24h) parts.push(`24 h: ${total(metrics.last24h)}`)
    if (metrics.monthToDate) parts.push(`mes: ${total(metrics.monthToDate)}`)
    if (metrics.last30d) parts.push(`30 d: ${total(metrics.last30d)}`)
    return parts.join(" · ")
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        LEVEL_RANK: LEVEL_RANK,
        utilLevel: utilLevel,
        maxLevel: maxLevel,
        fmtTokens: fmtTokens,
        fmtPct: fmtPct,
        shortModel: shortModel,
        humanDuration: humanDuration,
        normalizeQuota: normalizeQuota,
        projectedUtil: projectedUtil,
        exhaustMs: exhaustMs,
        lockoutMs: lockoutMs,
        windowLevel: windowLevel,
        projectionNote: projectionNote,
        visibleWindows: visibleWindows,
        selectPanelWindow: selectPanelWindow,
        metricsSummary: metricsSummary
    }
}
