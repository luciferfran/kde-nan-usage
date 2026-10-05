// Node test for the pure quota model. Run with: node tests/quotaModel.test.js

const assert = require("node:assert")
const m = require("../contents/code/quotaModel.js")

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
    try {
        fn()
        passed++
        console.log(`  ok  ${name}`)
    } catch (e) {
        failed++
        failures.push({ name, error: e })
        console.error(`FAIL  ${name}\n      ${e.message}`)
    }
}

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

console.log("quotaModel")

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

test("fmtPct rounds and adds a decimal below 10 % when fine", () => {
    assert.strictEqual(m.fmtPct(0), "0%")
    assert.strictEqual(m.fmtPct(9.95), "10%")
    assert.strictEqual(m.fmtPct(5.5, true), "5,5%")
    assert.strictEqual(m.fmtPct(75), "75%")
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

test("shortModel abbreviates known model ids", () => {
    assert.strictEqual(m.shortModel("deepseek-v4-flash"), "ds4f")
    assert.strictEqual(m.shortModel("something-flash"), "somethingf")
    assert.strictEqual(m.shortModel("glm-5.2"), "glm-5.2")
    assert.strictEqual(m.shortModel(null), "")
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

test("projectedUtil extrapolates the average rate", () => {
    const w = windowAt(50, SEP1, OCT1)
    const proj = m.projectedUtil(w, SEP15)
    assert.ok(Math.abs(proj - (50 * 30) / 14) < 1e-9, `projection was ${proj}`)
})

test("projectedUtil does not extrapolate in the first 5 % of the period", () => {
    const w = windowAt(50, SEP1, OCT1)
    assert.strictEqual(m.projectedUtil(w, SEP1 + 0.5 * DAY), 50)
})

test("exhaustMs and lockoutMs detect running out before the reset", () => {
    const w = windowAt(50, SEP1, OCT1)
    assert.strictEqual(m.exhaustMs(w, SEP15), 14 * DAY)
    assert.strictEqual(m.lockoutMs(w, SEP15), 2 * DAY)
})

test("lockoutMs is null when the rate does not exhaust the quota", () => {
    const w = windowAt(10, SEP1, OCT1)
    assert.strictEqual(m.exhaustMs(w, SEP15), null)
    assert.strictEqual(m.lockoutMs(w, SEP15), null)
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

console.log("")
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) {
    for (const f of failures)
        console.error(`\n${f.name}:\n${f.error.stack || f.error.message}`)
    process.exit(1)
}
