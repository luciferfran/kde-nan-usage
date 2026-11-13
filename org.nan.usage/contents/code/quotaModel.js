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
    const num = Number(n)
    const v = Number.isFinite(num) ? Math.max(0, num) : 0
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

// Credits: integer from 100, one decimal below (13,5; 7).
function fmtCredits(n) {
    const num = Number(n)
    const v = Number.isFinite(num) ? Math.max(0, num) : 0
    if (v >= 100) return String(Math.round(v))
    return v.toFixed(1).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")
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
//    windowHours, windowCap, updatedAt, extraTokens, extraUsable}
// extraTokens/extraUsable are null when the API does not send them.
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
            updatedAt: parseDate(m.updatedAt),
            extraTokens: Number.isFinite(Number(m.extraTokens))
                ? Math.max(0, Number(m.extraTokens))
                : null,
            extraUsable:
                typeof m.extraUsable === "boolean" ? m.extraUsable : null
        })
    }
    out.sort(
        (a, b) =>
            b.utilization - a.utilization || a.model.localeCompare(b.model)
    )
    return out
}

// UTC calendar day (YYYY-MM-DD) of a timestamp in ms.
function isoDay(ms) {
    return new Date(ms).toISOString().slice(0, 10)
}

// First day of the month of `now`, to bound GET /v1/usage to one page.
function monthStart(now) {
    if (now == null) now = Date.now()
    return `${isoDay(now).slice(0, 7)}-01`
}

// Summary of GET /v1/usage (the live report, unlike the frozen quota):
//   {credits, models, totalTokens, totalCredits, partial}
// credits: the credit fund {used, allowance, remaining, startsAt, resetsAt,
//   frozen} or null when the account has none (the block is optional).
// models: [{model, tokens, requests, credits, lastDate}] summed over the
//   current period (the fund's, or the whole report without a fund).
//   lastDate is the latest day with activity in the whole report.
// partial: the report has more pages, so the sums are incomplete.
// Returns null when the response is not a usage report.
function normalizeUsage(report) {
    if (report?.object !== "usage.report" || !Array.isArray(report.data))
        return null

    const c = report.credits
    const allowance = Number(c?.allowance)
    let credits = null
    if (Number.isFinite(allowance) && allowance > 0) {
        const used = Math.max(0, Number(c.used) || 0)
        credits = {
            used: used,
            allowance: allowance,
            remaining:
                typeof c.remaining === "number" && Number.isFinite(c.remaining)
                    ? Math.max(0, c.remaining)
                    : Math.max(0, allowance - used),
            startsAt: parseDate(c.period_start),
            resetsAt: parseDate(c.period_end),
            frozen: c.frozen === true
        }
    }

    const since = credits?.startsAt
        ? isoDay(credits.startsAt)
        : String(report.start_date || "")
    const byModel = Object.create(null)
    for (let i = 0; i < report.data.length; i++) {
        const row = report.data[i]
        if (!row?.model || typeof row.date !== "string") continue
        const tokens = Math.max(
            0,
            Number(row.total_tokens) ||
                (Number(row.prompt_tokens) || 0) +
                    (Number(row.completion_tokens) || 0)
        )
        const requests = Math.max(0, Number(row.api_requests) || 0)
        if (!byModel[row.model])
            byModel[row.model] = {
                model: String(row.model),
                tokens: 0,
                requests: 0,
                credits: 0,
                lastDate: ""
            }
        const entry = byModel[row.model]
        if (tokens > 0 || requests > 0) {
            if (row.date > entry.lastDate) entry.lastDate = row.date
        }
        if (row.date < since) continue
        entry.tokens += tokens
        entry.requests += requests
        entry.credits += Math.max(0, Number(row.credits) || 0)
    }

    const models = Object.keys(byModel).map((k) => byModel[k])
    let totalTokens = 0
    let totalCredits = 0
    for (let i = 0; i < models.length; i++) {
        totalTokens += models[i].tokens
        totalCredits += models[i].credits
    }
    return {
        credits: credits,
        models: models,
        totalTokens: totalTokens,
        totalCredits: credits ? credits.used : totalCredits,
        partial: report.has_more === true
    }
}

// The credit fund as a window the gauges and projections understand.
function creditsWindow(credits) {
    return {
        key: "credits",
        kind: "credits",
        model: "credits",
        label: "Créditos",
        used: credits.used,
        cap: credits.allowance,
        remaining: credits.remaining,
        utilization: (credits.used / credits.allowance) * 100,
        startsAt: credits.startsAt,
        resetsAt: credits.resetsAt,
        windowHours: 0,
        windowCap: 0,
        updatedAt: null,
        extraTokens: null,
        extraUsable: null,
        frozen: credits.frozen
    }
}

// Windows shown by the widget, combining the quota (caps, extra tokens) with
// the live usage report (credit fund, activity). `usage` comes from
// normalizeUsage(); without it the widget falls back to the quota alone.
//   - With a credit fund: the fund is the main gauge and the per-model rows
//     are the credits spent (kind "spend"), since the quota caps no longer
//     limit anything.
//   - Without one: the quota windows, but any whose counters stopped before
//     the model's last activity are marked stale.
function buildWindows(quota, usage) {
    const quotaWindows = normalizeQuota(quota)
    if (!usage) return quotaWindows

    const lastDate = Object.create(null)
    for (let i = 0; i < usage.models.length; i++)
        lastDate[usage.models[i].model] = usage.models[i].lastDate

    if (!usage.credits || usage.partial) {
        for (let i = 0; i < quotaWindows.length; i++) {
            const w = quotaWindows[i]
            const last = lastDate[w.model]
            const updated = w.updatedAt ? isoDay(w.updatedAt) : ""
            if (last && updated && updated < last) {
                w.stale = true
                w.staleSince = updated
            }
        }
    }
    if (!usage.credits) return quotaWindows

    const out = [creditsWindow(usage.credits)]
    if (usage.partial) return out.concat(quotaWindows)

    const rows = usage.models.slice()
    for (let i = 0; i < quotaWindows.length; i++) {
        if (!rows.some((r) => r.model === quotaWindows[i].model))
            rows.push({
                model: quotaWindows[i].model,
                tokens: 0,
                requests: 0,
                credits: 0,
                lastDate: ""
            })
    }
    const byCredits = usage.totalCredits > 0
    let share = 0
    for (let i = 0; i < rows.length; i++)
        share += byCredits ? rows[i].credits : rows[i].tokens
    rows.sort(
        (a, b) =>
            b.credits - a.credits ||
            b.tokens - a.tokens ||
            a.model.localeCompare(b.model)
    )
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const q = quotaWindows.find((w) => w.model === r.model)
        out.push({
            key: r.model,
            kind: "spend",
            model: r.model,
            label: r.model,
            // Tokens, so "used > 0" keeps meaning "has activity".
            used: r.tokens,
            credits: r.credits,
            requests: r.requests,
            cap: 0,
            remaining: 0,
            // Share of the fund (or of the tokens, before credits were
            // billed) taken by this model: the bar is not a quota.
            utilization:
                share > 0
                    ? ((byCredits ? r.credits : r.tokens) / share) * 100
                    : 0,
            startsAt: null,
            resetsAt: null,
            windowHours: 0,
            windowCap: 0,
            updatedAt: null,
            extraTokens: q ? q.extraTokens : null,
            extraUsable: q ? q.extraUsable : null
        })
    }
    return out
}

// Right-hand figure of a popup row, by kind of window.
function windowDetail(w) {
    if (w?.kind === "credits")
        return `${fmtCredits(w.used)} / ${fmtCredits(w.cap)} cr`
    if (w?.kind === "spend")
        return w.credits > 0
            ? `${fmtCredits(w.credits)} cr · ${fmtTokens(w.used)}`
            : fmtTokens(w.used)
    return `${fmtTokens(w?.used)} / ${fmtTokens(w?.cap)}`
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
    // A stale counter says nothing about the present; a spend row is a share.
    if (w.stale || w.kind === "spend") return "ok"
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
    if (w.stale) return `sin actualizar desde ${w.staleSince}`
    if (w.frozen) return "fondo de créditos congelado"
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

// Extra-token line for a popup row: "extra: 0 · utilizable". Empty when the
// API sent neither field.
function extraLine(w) {
    const hasTokens = w?.extraTokens != null
    const hasUsable = w?.extraUsable != null
    if (!hasTokens && !hasUsable) return ""
    const parts = []
    parts.push(`extra: ${hasTokens ? fmtTokens(w.extraTokens) : "?"}`)
    if (hasUsable) parts.push(w.extraUsable ? "utilizable" : "no utilizable")
    return parts.join(" · ")
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
    // Stale counters and spend shares are not gauges; use them only if there
    // is nothing else to show.
    const live = windows.filter((w) => !w.stale && w.kind !== "spend")
    const candidates = live.length ? live : windows
    if (mode === "fixed") {
        const hit = candidates.find((w) => w.model === modelId)
        if (hit) return hit
    }
    const used = candidates.filter((w) => w.used > 0)
    const pool = used.length ? used : candidates
    if (mode === "max")
        return pool.reduce((best, w) =>
            w.utilization > best.utilization ? w : best
        )
    const score = (w) => LEVEL_RANK[windowLevel(w, now)] * 1000 + w.utilization
    return pool.reduce((best, w) => (score(w) > score(best) ? w : best))
}

// Aggregated usage line for the popup. From the live usage report when there
// is one (tokens and credits of the current period); otherwise the sum of
// tokens used in the quota windows.
function usageLine(windows, usage) {
    if (usage) {
        const credits =
            usage.totalCredits > 0
                ? ` · ${fmtCredits(usage.totalCredits)} cr`
                : ""
        return `mes: ${fmtTokens(usage.totalTokens)}${credits}`
    }
    if (!windows?.length) return ""
    let total = 0
    for (let i = 0; i < windows.length; i++)
        total += Math.max(0, Number(windows[i]?.used) || 0)
    return `mes: ${fmtTokens(total)}`
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        LEVEL_RANK: LEVEL_RANK,
        utilLevel: utilLevel,
        maxLevel: maxLevel,
        fmtTokens: fmtTokens,
        fmtPct: fmtPct,
        fmtCredits: fmtCredits,
        isoDay: isoDay,
        monthStart: monthStart,
        normalizeUsage: normalizeUsage,
        buildWindows: buildWindows,
        windowDetail: windowDetail,
        shortModel: shortModel,
        humanDuration: humanDuration,
        normalizeQuota: normalizeQuota,
        projectedUtil: projectedUtil,
        exhaustMs: exhaustMs,
        lockoutMs: lockoutMs,
        windowLevel: windowLevel,
        projectionNote: projectionNote,
        extraLine: extraLine,
        visibleWindows: visibleWindows,
        selectPanelWindow: selectPanelWindow,
        usageLine: usageLine
    }
}
