#!/usr/bin/env node
// Validate QML file structure: pragma, imports, and root type.
// Exit 0 when clean, exit 1 and print diagnostics on failure.
//
// This check runs on a CI runner without KDE modules, so qmllint can't
// validate types — it only validates syntax. This script enforces
// structural rules that qmllint can't check remotely:
//
// 1. Every QML file starts with pragma ComponentBehavior: Bound
// 2. Every QML file has an import statement
// 3. Every QML file defines a known root type (Item, PlasmoidItem, etc.)
// 4. JavaScript files export an object literal via module.exports
// 5. JavaScript files do not use eval()
//
// This is intentionally lightweight — full static analysis needs qmllint.

const fs = require("node:fs")
const path = require("node:path")

const ROOT = path.join(__dirname, "..", "org.nan.usage", "contents")
const errors = []

function scanFiles(dir, relativePath = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name

        if (entry.name === "icons") continue // Skip icons dir

        if (entry.isDirectory()) {
            scanFiles(fullPath, rel)
            continue
        }

        if (entry.name.endsWith(".qml")) {
            validateQmlFile(fullPath, rel)
        } else if (entry.name.endsWith(".js")) {
            validateJsFile(fullPath, rel)
        }
    }
}

function validateQmlFile(filePath, relPath) {
    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.split("\n")

    // Check 1: pragma ComponentBehavior: Bound
    if (!lines[0].includes("pragma ComponentBehavior: Bound")) {
        errors.push(
            `${relPath}: missing "pragma ComponentBehavior: Bound" on line 1`
        )
    }

    // Check 2: has at least one import
    const hasImport = lines.some((line) => /^\s*import\s/.test(line))
    if (!hasImport) {
        errors.push(`${relPath}: no import statement found`)
    }

    // Check 3: defines a root type (first non-empty, non-comment, non-import, non-pragma line)
    let foundRootType = false

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        // Skip empty, pragma, imports, comments
        if (
            line === "" ||
            line.startsWith("pragma ") ||
            line.startsWith("//") ||
            line.startsWith("import ")
        ) {
            continue
        }

        // Check if line starts a type definition
        const typeMatch = line.match(/^(\w+)\s*\{?\s*$/)
        if (typeMatch) {
            const typeName = typeMatch[1]
            // Expanded list of known QML root types
            if (
                typeName.match(
                    /^(Item|Component|Window|ApplicationWindow|Rectangle|PlasmoidItem|PlasmaCore|PlasmaExtras|PlasmaComponents|Kirigami|KCM|Row|Column|ColumnLayout|RowLayout|GridLayout|StackLayout|Flow|Grid|Canvas|TextInput|Text|CheckBox|Label|ProgressBar|Button|ToolButton|ComboBox|SpinBox|Popup|Representation|PlasmoidHeading|MouseArea|ConfigModel)$/
                )
            ) {
                foundRootType = true
            }
        }

        if (foundRootType) break
    }

    if (!foundRootType) {
        errors.push(
            `${relPath}: no root type defined (expected Item, Component, PlasmoidItem, etc.)`
        )
    }
}

function validateJsFile(filePath, relPath) {
    const content = fs.readFileSync(filePath, "utf-8")

    // Check: JS files should use module.exports guard for Node compatibility
    const hasModuleGuard = content.includes("module.exports")
    if (hasModuleGuard) {
        // Verify exports are an object (not undefined)
        const moduleExports = content.match(/module\.exports\s*=\s*(\{[^}]*\})/)
        if (!moduleExports) {
            errors.push(`${relPath}: module.exports not an object literal`)
        }
    }

    // Check: no eval() usage (security)
    if (content.includes("eval(")) {
        errors.push(`${relPath}: uses eval() — security risk`)
    }
}

console.log("Validating QML structure...")

try {
    if (!fs.existsSync(ROOT)) {
        console.error(`FATAL: contents directory not found at ${ROOT}`)
        process.exit(2)
    }

    scanFiles(ROOT)

    if (errors.length === 0) {
        console.log("✓ QML structure clean")
        process.exit(0)
    } else {
        console.error(`✗ QML structure failed (${errors.length} errors)`)
        for (const err of errors) {
            console.error(`  ✗ ${err}`)
        }
        process.exit(1)
    }
} catch (e) {
    console.error(`FATAL: ${e.message}`)
    process.exit(2)
}
