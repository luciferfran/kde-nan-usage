// Node tests for the pure quota model. Run with: npm test

const assert = require("node:assert")
const { test } = require("node:test")
const m = require("../contents/code/quotaModel.js")

const DAY = 24 * 3600 * 1000
const SEP1 = Date.parse("2026-09-01T00:00:00Z")
const SEP15 = Date.parse("2026-09-15T00:00:00Z")
const OCT1 = Date.parse("2026-10-01T00:00:00Z")

function windowAt(util, startMs, endMs) {
    return {
        model: "test-model",
        used: util,
        cap: 100,
        utilization: util,
        startsAt: startMs,
        resetsAt: endMs
    }
}

test("fmtTokens formats compact token counts", () => {
    assert.strictEqual(m.fmtTokens(0), "0")
    assert.strictEqual(m.fmtTokens(999), "999")
    assert.strictEqual(m.fmtTokens(1000), "1K")
    assert.strictEqual(m.fmtTokens(1500), "2K")
    assert.strictEqual(m.fmtTokens(398000), "398K")
    assert.strictEqual(m.fmtTokens(500e6), "500M")
    assert.strictEqual(m.fmtTokens(79.9e6), "79,9M")
    assert.strictEqual(m.fmtTokens(1e9), "1B")
    assert.strictEqual(m.fmtTokens(1.5e9), "1,5B")
    assert.strictEqual(m.fmtTokens(3e9), "3B")
    assert.strictEqual(m.fmtTokens(-5), "0")
})

test("fmtTokens handles NaN, Infinity, and float edge cases", () => {
    // NaN → 0 (via || 0)
    assert.strictEqual(m.fmtTokens(NaN), "0")
    // Non-finite values → 0
    assert.strictEqual(m.fmtTokens(Infinity), "0")
    assert.strictEqual(m.fmtTokens(-Infinity), "0")
    // Float precision
    assert.strictEqual(m.fmtTokens(0.5), "1")
    assert.strictEqual(m.fmtTokens(99.5), "100")
    assert.strictEqual(m.fmtTokens(1.5), "2")
    assert.strictEqual(m.fmtTokens(999.5), "1000")
})

test("fmtPct rounds and adds a decimal below 10 % when fine", () => {
    assert.strictEqual(m.fmtPct(0), "0%")
    assert.strictEqual(m.fmtPct(9.95), "10%")
    assert.strictEqual(m.fmtPct(5.5, true), "5,5%")
    assert.strictEqual(m.fmtPct(75), "75%")
})

test("fmtPct handles negative, NaN, and values above 100", () => {
    assert.strictEqual(m.fmtPct(-10), "0%")
    assert.strictEqual(m.fmtPct(NaN), "0%")
    assert.strictEqual(m.fmtPct(undefined), "0%")
    assert.strictEqual(m.fmtPct(150), "150%")
    // JavaScript rounding: 0.05.toFixed(1) = "0.1" (banker's rounding)
    assert.strictEqual(m.fmtPct(0.5, true), "0,5%")
    assert.strictEqual(m.fmtPct(9.9, true), "9,9%")
})

test("humanDuration produces compact and verbose forms", () => {
    assert.strictEqual(m.humanDuration(30000, true), "30s")
    assert.strictEqual(m.humanDuration(30000, false), "30 s")
    assert.strictEqual(m.humanDuration(90000, true), "2m")
    assert.strictEqual(m.humanDuration(90000, false), "2 min")
    assert.strictEqual(m.humanDuration(3600000, true), "1h0m")
    assert.strictEqual(m.humanDuration(3600000, false), "1 h 0 min")
    assert.strictEqual(m.humanDuration(15660000, true), "4h21m")
    assert.strictEqual(m.humanDuration(2592000000, true), "30d")
    assert.strictEqual(m.humanDuration(2592000000, false), "30 d 0 h")
})

test("humanDuration handles edge values (0, negative, very large)", () => {
    assert.strictEqual(m.humanDuration(0, true), "0s")
    assert.strictEqual(m.humanDuration(0, false), "0 s")
    assert.strictEqual(m.humanDuration(-1000, true), "0s")
    // 59999ms → 59s (floor)
    assert.strictEqual(m.humanDuration(59999, true), "59s")
    // 60000ms → 60s → Math.round(60/60) = 1m
    assert.strictEqual(m.humanDuration(60000, true), "1m")
    // 3599999ms → 3599s → Math.round(3599/60) = 60m → 1h0m
    assert.strictEqual(m.humanDuration(3599999, true), "1h0m")
    // Boundary between days and hours
    assert.strictEqual(m.humanDuration(3600000 * 24, true), "1d")
    // Very large value: 999999999ms ≈ 11.57 days
    assert.strictEqual(m.humanDuration(999999999, true), "11d")
})

test("shortModel abbreviates known model ids", () => {
    assert.strictEqual(m.shortModel("deepseek-v4-flash"), "ds4f")
    assert.strictEqual(m.shortModel("something-flash"), "somethingf")
    assert.strictEqual(m.shortModel("glm-5.2"), "glm-5.2")
    assert.strictEqual(m.shortModel(null), "")
})

test("shortModel handles empty and special model ids", () => {
    assert.strictEqual(m.shortModel(""), "")
    assert.strictEqual(m.shortModel(42), "42")
    assert.strictEqual(m.shortModel("gpt-4o"), "gpt-4o")
    assert.strictEqual(m.shortModel("claude-3-5-sonnet"), "claude-3-5-sonnet")
    assert.strictEqual(m.shortModel("llama-3-70b-flash"), "llama-3-70bf")
})

test("normalizeQuota drops invalid rows and sorts by utilization", () => {
    const quota = {
        periodStart: "2026-09-01T00:00:00Z",
        models: [
            {
                model: "low",
                tokensUsed: 10,
                cap: 100,
                periodEnd: "2026-10-01T00:00:00Z"
            },
            {
                model: "high",
                tokensUsed: 90,
                cap: 100,
                periodEnd: "2026-10-01T00:00:00Z"
            },
            { model: "nocap", tokensUsed: 10, cap: 0 },
            { tokensUsed: 10, cap: 100 }
        ]
    }
    const out = m.normalizeQuota(quota)
    assert.strictEqual(out.length, 2)
    assert.strictEqual(out[0].model, "high")
    assert.strictEqual(out[1].model, "low")
    assert.strictEqual(out[0].utilization, 90)
    assert.strictEqual(out[0].startsAt, SEP1)
    assert.strictEqual(out[0].resetsAt, OCT1)
    assert.strictEqual(out[0].remaining, 10)
})

test("normalizeQuota tolerates a missing response", () => {
    assert.deepStrictEqual(m.normalizeQuota(null), [])
})

test("normalizeQuota handles edge data (NaN cap, string cap, missing periodEnd)", () => {
    const quota = {
        periodStart: "2026-09-01T00:00:00Z",
        models: [
            {
                model: "nan",
                tokensUsed: 50,
                cap: NaN,
                periodEnd: "2026-10-01T00:00:00Z"
            },
            {
                model: "str",
                tokensUsed: 50,
                cap: "500",
                periodEnd: "2026-10-01T00:00:00Z"
            },
            { model: "noperiod", tokensUsed: 50, cap: 100 },
            {
                model: "zero",
                tokensUsed: 0,
                cap: 100,
                periodEnd: "2026-10-01T00:00:00Z"
            },
            {
                model: "negative",
                tokensUsed: 50,
                cap: -10,
                periodEnd: "2026-10-01T00:00:00Z"
            }
        ]
    }
    const out = m.normalizeQuota(quota)
    // NaN cap: dropped (Number.isFinite(NaN) = false). str cap: 500 (valid). noperiod: no resetsAt (valid). zero: valid. negative: dropped.
    assert.strictEqual(out.length, 3)
    assert.ok(out.some((w) => w.model === "noperiod"))
    assert.ok(out.some((w) => w.model === "str"))
    assert.ok(out.some((w) => w.model === "zero"))
    assert.strictEqual(out.filter((w) => w.model === "nan").length, 0)
    assert.strictEqual(out.filter((w) => w.model === "negative").length, 0)
})

test("normalizeQuota handles models with string tokensUsed and remaining", () => {
    const quota = {
        periodStart: "2026-09-01T00:00:00Z",
        models: [
            {
                model: "str-used",
                tokensUsed: "30",
                cap: 100,
                periodEnd: "2026-10-01T00:00:00Z"
            }
        ]
    }
    const out = m.normalizeQuota(quota)
    assert.strictEqual(out.length, 1)
    assert.strictEqual(out[0].used, 30)
    assert.strictEqual(out[0].utilization, 30)
})

test("projectedUtil extrapolates the average rate", () => {
    const w = windowAt(50, SEP1, OCT1)
    const proj = m.projectedUtil(w, SEP15)
    assert.ok(Math.abs(proj - (50 * 30) / 14) < 1e-9, `projection was ${proj}`)
})

test("projectedUtil handles zero utilization and no period", () => {
    const wNoPeriod = { model: "test", utilization: 0 }
    assert.strictEqual(m.projectedUtil(wNoPeriod, SEP15), 0)

    const wZero = windowAt(0, SEP1, OCT1)
    assert.strictEqual(m.projectedUtil(wZero, SEP15), 0)
})

test("projectedUtil does not extrapolate in the first 5 % of the period", () => {
    const w = windowAt(50, SEP1, OCT1)
    assert.strictEqual(m.projectedUtil(w, SEP1 + 0.5 * DAY), 50)
})

test("periodTimes returns null for edge conditions", () => {
    // periodTimes is not exported but tested via windowLevel/lockoutMs
    // These functions internally call periodTimes and return null for edge cases

    // windowLevel at 0% with no projection should be ok
    const wEmpty = { model: "test", utilization: 0 }
    assert.strictEqual(m.windowLevel(wEmpty, SEP15), "ok")

    // windowLevel with equal start/end dates (no period)
    const wSameDate = {
        model: "test",
        utilization: 50,
        startsAt: SEP1,
        resetsAt: SEP1
    }
    // resetsAt <= startsAt → periodTimes returns null → utilLevel(50) = ok
    assert.strictEqual(m.windowLevel(wSameDate, SEP15), "ok")
})

test("exhaustMs and lockoutMs detect running out before the reset", () => {
    const w = windowAt(50, SEP1, OCT1)
    assert.strictEqual(m.exhaustMs(w, SEP15), 14 * DAY)
    assert.strictEqual(m.lockoutMs(w, SEP15), 2 * DAY)
})

test("exhaustMs handles boundary values (0, 100, no period)", () => {
    const wFull = windowAt(100, SEP1, OCT1)
    assert.strictEqual(m.exhaustMs(wFull, SEP15), 0)

    const wNoPeriod = { model: "test", utilization: 50 }
    assert.strictEqual(m.exhaustMs(wNoPeriod, SEP15), null)

    const wZero = windowAt(0, SEP1, OCT1)
    assert.strictEqual(m.exhaustMs(wZero, SEP15), null)
})

test("lockoutMs is null when the rate does not exhaust the quota", () => {
    const w = windowAt(10, SEP1, OCT1)
    assert.strictEqual(m.lockoutMs(w, SEP15), null)
})

test("lockoutMs handles 100% utilization — remaining period is the lockout", () => {
    // At 100% utilization, exhaustMs returns 0, so lockout = remaining period time
    const wAt100 = windowAt(100, SEP1, OCT1)
    // lockoutMs = Math.max(0, resetsAt - now - 0) = Math.max(0, 30d - 14d) = 16d
    assert.strictEqual(m.lockoutMs(wAt100, SEP15), 16 * DAY)
})

test("windowLevel warns when the lockout is short and crits when it is long", () => {
    assert.strictEqual(m.windowLevel(windowAt(50, SEP1, OCT1), SEP15), "warn")
    assert.strictEqual(m.windowLevel(windowAt(90, SEP1, OCT1), SEP15), "crit")
})

test("windowLevel stays ok early in the period", () => {
    assert.strictEqual(
        m.windowLevel(windowAt(50, SEP1, OCT1), SEP1 + 0.5 * DAY),
        "ok"
    )
})

test("windowLevel handles boundary utilization values", () => {
    // At 0%, no lockout, stays ok
    assert.strictEqual(m.windowLevel(windowAt(0, SEP1, OCT1), SEP15), "ok")
    // 74% at mid-period: projection is high, lockout is long enough → crit
    assert.strictEqual(m.windowLevel(windowAt(74, SEP1, OCT1), SEP15), "crit")
    // 75% → utilLevel = warn
    assert.strictEqual(m.windowLevel(windowAt(75, SEP1, OCT1), SEP15), "crit")
    // 89% at mid-period: projection is very high, lockout is long → crit
    assert.strictEqual(m.windowLevel(windowAt(89, SEP1, OCT1), SEP15), "crit")
    // 90% → utilLevel = crit
    assert.strictEqual(m.windowLevel(windowAt(90, SEP1, OCT1), SEP15), "crit")
    // 100% → locked out
    assert.strictEqual(m.windowLevel(windowAt(100, SEP1, OCT1), SEP15), "crit")
})

test("windowLevel handles period with no available times", () => {
    const w = { model: "test", utilization: 95 }
    // No period times, utilLevel(95) = crit
    assert.strictEqual(m.windowLevel(w, SEP15), "crit")
})

test("utilLevel and maxLevel boundaries", () => {
    assert.strictEqual(m.utilLevel(0), "ok")
    assert.strictEqual(m.utilLevel(74.99), "ok")
    assert.strictEqual(m.utilLevel(75), "warn")
    assert.strictEqual(m.utilLevel(89.99), "warn")
    assert.strictEqual(m.utilLevel(90), "crit")
    assert.strictEqual(m.utilLevel(100), "crit")

    assert.strictEqual(m.maxLevel("ok", "warn"), "warn")
    assert.strictEqual(m.maxLevel("crit", "ok"), "crit")
    assert.strictEqual(m.maxLevel("warn", "warn"), "warn")
})

test("projectionNote describes the projected outcome", () => {
    assert.strictEqual(
        m.projectionNote(windowAt(50, SEP1, OCT1), SEP15),
        "a este ritmo se agota justo antes del reset"
    )
    assert.strictEqual(
        m
            .projectionNote(windowAt(90, SEP1, OCT1), SEP15)
            .startsWith("a este ritmo se agota en ~"),
        true
    )
    assert.strictEqual(m.projectionNote(windowAt(10, SEP1, OCT1), SEP15), "")
})

test("projectionNote handles no period, zero utilization", () => {
    const wNoPeriod = { model: "test", utilization: 50 }
    assert.strictEqual(m.projectionNote(wNoPeriod, SEP15), "")

    const wZero = windowAt(0, SEP1, OCT1)
    assert.strictEqual(m.projectionNote(wZero, SEP15), "")
})

test("visibleWindows hides unused models unless pinned", () => {
    const windows = [
        { model: "a", used: 10 },
        { model: "b", used: 0 }
    ]
    assert.deepStrictEqual(
        m.visibleWindows(windows, { hideUnused: true }).map((w) => w.model),
        ["a"]
    )
    assert.deepStrictEqual(
        m
            .visibleWindows(windows, { hideUnused: true, pinned: "b" })
            .map((w) => w.model),
        ["a", "b"]
    )
    assert.deepStrictEqual(
        m.visibleWindows(windows, { hideUnused: false }).map((w) => w.model),
        ["a", "b"]
    )
})

test("visibleWindows handles empty array and all-zero case", () => {
    assert.deepStrictEqual(m.visibleWindows([], { hideUnused: true }), [])
    assert.deepStrictEqual(
        m
            .visibleWindows(
                [
                    { model: "x", used: 0 },
                    { model: "y", used: 0 }
                ],
                { hideUnused: true, pinned: "y" }
            )
            .map((w) => w.model),
        ["y"]
    )
})

test("selectPanelWindow honours worst, max and fixed modes", () => {
    const windows = [
        {
            model: "a",
            used: 10,
            utilization: 10,
            startsAt: SEP1,
            resetsAt: OCT1
        },
        {
            model: "b",
            used: 80,
            utilization: 80,
            startsAt: SEP1,
            resetsAt: OCT1
        },
        { model: "c", used: 0, utilization: 0, startsAt: SEP1, resetsAt: OCT1 }
    ]
    assert.strictEqual(
        m.selectPanelWindow(windows, "worst", null, SEP15).model,
        "b"
    )
    assert.strictEqual(
        m.selectPanelWindow(windows, "max", null, SEP15).model,
        "b"
    )
    assert.strictEqual(
        m.selectPanelWindow(windows, "fixed", "a", SEP15).model,
        "a"
    )
    assert.strictEqual(
        m.selectPanelWindow(windows, "fixed", "missing", SEP15).model,
        "b"
    )
    assert.strictEqual(m.selectPanelWindow([], "worst", null, SEP15), null)
})

test("selectPanelWindow handles single window and ties", () => {
    const w1 = windowAt(50, SEP1, OCT1)
    assert.strictEqual(
        m.selectPanelWindow([w1], "worst", null, SEP15).model,
        "test-model"
    )

    // Tie in utilization: reduce keeps the first one
    const tied = [
        {
            model: "a",
            used: 50,
            utilization: 50,
            startsAt: SEP1,
            resetsAt: OCT1
        },
        {
            model: "b",
            used: 50,
            utilization: 50,
            startsAt: SEP1,
            resetsAt: OCT1
        }
    ]
    const result = m.selectPanelWindow(tied, "max", null, SEP15)
    assert.strictEqual(result.model, "a")
})

test("metricsSummary builds the aggregated line", () => {
    const metrics = {
        last24h: { totalTokens: 1.5e6 },
        monthToDate: { totalTokens: 20e6 },
        last30d: { totalTokens: 30e6 }
    }
    assert.strictEqual(
        m.metricsSummary(metrics),
        "24 h: 1,5M · mes: 20M · 30 d: 30M"
    )
    assert.strictEqual(m.metricsSummary(null), "")
})

test("metricsSummary handles partial and zero data", () => {
    assert.strictEqual(m.metricsSummary({}), "")
    // Zero tokens still shown (not filtered out)
    assert.strictEqual(
        m.metricsSummary({ last24h: { totalTokens: 0 } }),
        "24 h: 0"
    )
    // Missing fields: only existing ones shown
    // Empty totalTokens object: fmtTokens(undefined) returns "0"
    assert.strictEqual(
        m.metricsSummary({ last24h: {}, last30d: { totalTokens: 1000 } }),
        "24 h: 0 · 30 d: 1K"
    )
    // Large values
    assert.strictEqual(
        m.metricsSummary({
            last24h: { totalTokens: 1e12 },
            last30d: { totalTokens: 1e9 }
        }),
        "24 h: 1000B · 30 d: 1B"
    )
})
