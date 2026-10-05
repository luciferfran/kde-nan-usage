// SPDX-License-Identifier: GPL-2.0-or-later
// Minimal HTTP client for the NaN cloud backend. The inference API
// (api.nan.builders/v1, LiteLLM) does not expose usage; the SPA backend
// (cloud-api.nan.builders) does, with the same API key as a Bearer token.
// These routes are undocumented and may change without notice.

const CLOUD_API = "https://cloud-api.nan.builders"

// User-facing text for an error from this client. Never includes the key.
function describeError(e) {
    if (!e) return "Error desconocido"
    if (e.kind === "nokey") return `Falta la API key en ${e.path}`
    if (e.kind === "parse") return "Respuesta inesperada del servidor"
    if (e.status === 401) return "NaN rechaza la API key (401)"
    if (e.status === 403)
        return "Acceso denegado (403): Cloudflare o key sin permisos"
    if (e.status === 429)
        return "Demasiadas peticiones (429); se reintenta en el próximo sondeo"
    if (e.status >= 500) return `NaN no responde (HTTP ${e.status})`
    if (e.status > 0) return `Error HTTP ${e.status}`
    return e.message ? `Sin conexión: ${e.message}` : "Sin conexión"
}

// Quote a value so it survives a POSIX shell as a single literal argument.
function shellQuote(value) {
    return `'${String(value).replace(/'/g, "'\\''")}'`
}

// Build the shell command that prints the API key file. Home-relative paths use
// $HOME so the shell expands them; everything else is single-quoted.
function keyCommand(path) {
    const p = String(path || "").trim()
    if (p === "" || p === "~") return 'cat "$HOME"'
    if (p.startsWith("~/")) return `cat "$HOME"/${shellQuote(p.slice(2))}`
    return `cat ${shellQuote(p)}`
}

// GET path with the given API key. Calls onSuccess(parsedBody) or onError(err)
// exactly once. The error object carries {status, kind, message} and is safe to
// pass to describeError().
function request(path, key, onSuccess, onError) {
    const xhr = new XMLHttpRequest()
    let finished = false

    function fail(err) {
        if (finished) return
        finished = true
        onError(err)
    }

    function succeed(body) {
        if (finished) return
        finished = true
        onSuccess(body)
    }

    try {
        xhr.open("GET", CLOUD_API + path)
        xhr.setRequestHeader("Authorization", `Bearer ${key}`)
        xhr.setRequestHeader("Accept", "application/json")
    } catch (e) {
        fail({ status: 0, kind: "request", message: String(e) })
        return
    }

    xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return
        if (xhr.status >= 200 && xhr.status < 300) {
            let body = {}
            if (xhr.responseText) {
                try {
                    body = JSON.parse(xhr.responseText)
                } catch (e) {
                    fail({
                        status: xhr.status,
                        kind: "parse",
                        message: `Invalid JSON: ${String(e)}`
                    })
                    return
                }
            }
            succeed(body)
        } else {
            fail({
                status: xhr.status,
                kind: "http",
                message: `HTTP ${xhr.status}`,
                body: String(xhr.responseText || "").slice(0, 200)
            })
        }
    }
    xhr.onerror = () => {
        fail({ status: 0, kind: "network", message: "Network error" })
    }
    xhr.ontimeout = () => {
        fail({ status: 0, kind: "timeout", message: "Timeout" })
    }
    xhr.timeout = 15000
    xhr.send()
}

function fetchQuota(key, onSuccess, onError) {
    request("/api/usage/quota", key, onSuccess, onError)
}

function fetchMe(key, onSuccess, onError) {
    request("/api/auth/me", key, onSuccess, onError)
}

function fetchMetrics(key, onSuccess, onError) {
    request("/api/metrics/usage", key, onSuccess, onError)
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        CLOUD_API: CLOUD_API,
        describeError: describeError,
        shellQuote: shellQuote,
        keyCommand: keyCommand,
        request: request,
        fetchQuota: fetchQuota,
        fetchMe: fetchMe,
        fetchMetrics: fetchMetrics
    }
}
