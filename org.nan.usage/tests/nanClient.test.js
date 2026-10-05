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

test("keyCommand quotes absolute paths with spaces and quotes", () => {
    assert.strictEqual(c.keyCommand("/tmp/my key"), "cat '/tmp/my key'")
    assert.strictEqual(c.keyCommand("/tmp/it's"), "cat '/tmp/it'\\''s'")
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
