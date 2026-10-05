// Node test for the HTTP client helpers. Run with:
//   node tests/nanClient.test.js

const assert = require("node:assert")
const c = require("../contents/code/nanClient.js")

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

console.log("nanClient")

test("shellQuote wraps and escapes single quotes", () => {
    assert.strictEqual(c.shellQuote("abc"), "'abc'")
    assert.strictEqual(c.shellQuote("a'b"), "'a'\\''b'")
    assert.strictEqual(c.shellQuote(""), "''")
})

test("keyCommand expands home-relative paths", () => {
    assert.strictEqual(c.keyCommand(""), 'cat "$HOME"')
    assert.strictEqual(c.keyCommand("~"), 'cat "$HOME"')
    assert.strictEqual(
        c.keyCommand("~/.config/nan/api-key"),
        "cat \"$HOME\"/'.config/nan/api-key'"
    )
})

test("keyCommand shell-quotes home-relative paths with spaces and quotes", () => {
    assert.strictEqual(
        c.keyCommand("~/my config/api-key"),
        "cat \"$HOME\"/'my config/api-key'"
    )
    assert.strictEqual(
        c.keyCommand("~/it's key"),
        "cat \"$HOME\"/'it'\\''s key'"
    )
})

test("describeError maps the API status codes", () => {
    assert.strictEqual(
        c.describeError({ status: 401 }),
        "NaN rechaza la API key (401)"
    )
    assert.strictEqual(
        c.describeError({ status: 403 }),
        "Acceso denegado (403): Cloudflare o key sin permisos"
    )
    assert.strictEqual(
        c.describeError({ status: 429 }),
        "Demasiadas peticiones (429); se reintenta en el próximo sondeo"
    )
    assert.strictEqual(
        c.describeError({ status: 503 }),
        "NaN no responde (HTTP 503)"
    )
    assert.strictEqual(c.describeError({ status: 418 }), "Error HTTP 418")
    assert.strictEqual(
        c.describeError({ status: 0, message: "Network error" }),
        "Sin conexión: Network error"
    )
    assert.strictEqual(c.describeError({ status: 0 }), "Sin conexión")
})

test("describeError reports a missing key with its path", () => {
    assert.strictEqual(
        c.describeError({ kind: "nokey", path: "/home/u/.config/nan/api-key" }),
        "Falta la API key en /home/u/.config/nan/api-key"
    )
    assert.strictEqual(
        c.describeError({ kind: "parse" }),
        "Respuesta inesperada del servidor"
    )
    assert.strictEqual(c.describeError(null), "Error desconocido")
})

console.log("")
console.log(`${passed} passed, ${failed} failed`)
if (failed > 0) {
    for (const f of failures)
        console.error(`\n${f.name}:\n${f.error.stack || f.error.message}`)
    process.exit(1)
}

test("describeError handles additional status codes", () => {
    assert.strictEqual(c.describeError({ status: 400 }), "Error HTTP 400")
    assert.strictEqual(c.describeError({ status: 404 }), "Error HTTP 404")
    assert.strictEqual(
        c.describeError({ status: 500 }),
        "NaN no responde (HTTP 500)"
    )
    assert.strictEqual(
        c.describeError({ status: 502 }),
        "NaN no responde (HTTP 502)"
    )
    assert.strictEqual(
        c.describeError({ status: 504 }),
        "NaN no responde (HTTP 504)"
    )
    assert.strictEqual(c.describeError({ status: 408 }), "Error HTTP 408")
})

test("describeError handles response body in errors", () => {
    const err = {
        status: 500,
        kind: "http",
        message: "HTTP 500",
        body: '{"error":"internal server error","code":500}'
    }
    assert.strictEqual(c.describeError(err), "NaN no responde (HTTP 500)")
    // Body is not included in user-facing text
    assert.ok(!c.describeError(err).includes("internal"))
})

test("describeError handles unknown error objects", () => {
    assert.strictEqual(c.describeError({ code: "ENETUNREACH" }), "Sin conexión")
    assert.strictEqual(
        c.describeError({ type: "NetworkError" }),
        "Sin conexión"
    )
    assert.strictEqual(c.describeError({ error: "timeout" }), "Sin conexión")
})

// --- Security tests ---
test("isValidKeyPath blocks path traversal and shell injection", () => {
    assert.strictEqual(c.isValidKeyPath(""), true)
    assert.strictEqual(c.isValidKeyPath("~"), true)
    assert.strictEqual(c.isValidKeyPath("~/.config/nan/api-key"), true)
    assert.strictEqual(c.isValidKeyPath("./nan/api-key"), true) // relative, no injection chars
    assert.strictEqual(c.isValidKeyPath("/etc/shadow"), false) // absolute
    assert.strictEqual(c.isValidKeyPath("/root/.ssh/id_rsa"), false) // absolute
    assert.strictEqual(c.isValidKeyPath("../../../etc/passwd"), false) // traversal
    assert.strictEqual(c.isValidKeyPath("dir/../secret"), false) // traversal
    assert.strictEqual(c.isValidKeyPath("key; rm -rf /"), false) // shell injection
    assert.strictEqual(c.isValidKeyPath("key`whoami`"), false) // backtick injection
    assert.strictEqual(c.isValidKeyPath("key$(id)"), false) // subshell injection
    assert.strictEqual(c.isValidKeyPath("key|cat /etc/passwd"), false) // pipe injection
    assert.strictEqual(c.isValidKeyPath("key&&cat /etc/passwd"), false) // && injection
    assert.strictEqual(c.isValidKeyPath("key\nid"), false) // newline injection
    assert.strictEqual(c.isValidKeyPath("api-key.txt"), true) // valid filename
})

test("isValidKeyPath accepts valid key paths", () => {
    assert.strictEqual(c.isValidKeyPath("api-key"), true) // valid filename, shellQuote handles it
    assert.strictEqual(c.isValidKeyPath("~/.config/nan/api-key"), true)
    assert.strictEqual(c.isValidKeyPath("~/.config/nan.api-key"), true)
    assert.strictEqual(c.isValidKeyPath("~/.config/nan/api_key"), true)
    assert.strictEqual(c.isValidKeyPath("~/.config/nan/api-key.backup"), true)
})

test("validateResponse checks API response structure", () => {
    // Valid quota response
    assert.strictEqual(
        c.validateResponse("/api/usage/quota", {
            periodStart: "2026-01-01",
            models: [{ model: "x", tokensUsed: 10, cap: 100 }]
        }),
        true
    )
    assert.strictEqual(c.validateResponse("/api/usage/quota", {}), false)
    assert.strictEqual(
        c.validateResponse("/api/usage/quota", { models: [] }),
        false
    ) // no periodStart
    assert.strictEqual(c.validateResponse("/api/usage/quota", null), null)
    assert.strictEqual(c.validateResponse("/api/usage/quota", "string"), false)
    assert.strictEqual(c.validateResponse("/api/usage/quota", 42), false)
    assert.strictEqual(
        c.validateResponse("/api/usage/quota", { periodStart: 123 }),
        false
    ) // no models array

    // Valid me response
    assert.strictEqual(
        c.validateResponse("/api/auth/me", { handle: "test" }),
        true
    )
    assert.strictEqual(
        c.validateResponse("/api/auth/me", { email: "test@test.com" }),
        true
    )
    assert.strictEqual(
        c.validateResponse("/api/auth/me", { name: "Test" }),
        true
    )
    assert.strictEqual(c.validateResponse("/api/auth/me", null), null)

    // Valid metrics response
    assert.ok(c.validateResponse("/api/metrics/usage", { last24h: {} }))
    assert.ok(c.validateResponse("/api/metrics/usage", { monthToDate: {} }))
    assert.ok(c.validateResponse("/api/metrics/usage", { last30d: {} }))
    assert.strictEqual(c.validateResponse("/api/metrics/usage", {}), undefined)
    assert.strictEqual(c.validateResponse("/api/metrics/usage", null), null)

    // No validator for unknown paths — trust them
    assert.strictEqual(
        c.validateResponse("/api/unknown", { anything: true }),
        true
    )
})

test("keyCommand throws on invalid paths", () => {
    assert.throws(() => c.keyCommand("../../../etc/passwd"), /Invalid key path/)
    assert.throws(() => c.keyCommand("/etc/shadow"), /Invalid key path/)
    assert.throws(() => c.keyCommand("key; rm -rf /"), /Invalid key path/)
    // Safe paths should not throw
    assert.doesNotThrow(() => c.keyCommand("~/.config/nan/api-key"))
    assert.doesNotThrow(() => c.keyCommand(""))
    assert.doesNotThrow(() => c.keyCommand("~"))
})
