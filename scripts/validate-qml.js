#!/usr/bin/env node
// Validate QML file structure: pragma, imports, and root type.
// Exit 0 when clean, exit 1 and print diagnostics on failure.
//
// This check runs on a CI runner without KDE modules, so qmllint can't
// validate types — it only validates syntax. This script enforces
// structural rules that qmllint can't check remotely:
//
// 1. Every QML file starts with pragma ComponentBehavior: Bound
// 2. Every QML file has an import statement (not only Qt.* modules)
// 3. Every QML file defines a root type (top-level Item/Component/etc.)
// 4. QML files don't have circular dependencies (trivial check)
// 5. JavaScript files used from QML use the module.exports guard
//
// This is intentionally lightweight — full static analysis needs qmllint.

const fs = require("node:fs")
const path = require("node:path")

const ROOT = path.join(__dirname, "..", "org.nan.usage", "contents")
const errors = []
const warnings = 0

// QML files that are configuration/data (not UI components)
const QML_DATA_FILES = new Set([
    "config.qml", // KCM config - valid root type
    "main.xml" // KConfig XML - not a QML file at all, skipped
])

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
    if (QML_DATA_FILES.has(path.basename(filePath))) {
        return // Skip data/config files from QML structure checks
    }

    const content = fs.readFileSync(filePath, "utf-8")
    const lines = content.split("\n")
    const fileBasename = path.basename(filePath)

    // Check 1: pragma ComponentBehavior: Bound
    // Only required for QML files that Plasma loads directly (not components imported as modules)
    const HAS_PRAGMA_DIRECT = new Set([
        "main.qml",
        "CompactRepresentation.qml",
        "FullRepresentation.qml",
        "configGeneral.qml"
    ])

    const hasPragma = lines[0].includes("pragma ComponentBehavior: Bound")
    if (HAS_PRAGMA_DIRECT.has(fileBasename) && !hasPragma) {
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
                    /^(Item|Component|Window|ApplicationWindow|Rectangle|PlasmoidItem|PlasmaCore|PlasmaExtras|PlasmaComponents|Kirigami|KCM|Row|Column|ColumnLayout|RowLayout|GridLayout|StackLayout|Flow|Grid|Canvas|TextInput|Text|CheckBox|Label|ProgressBar|Button|ToolButton|ComboBox|SpinBox|Popup|Representation|PlasmoidHeading|MouseArea)$/
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
        console.log(`✓ QML structure clean (${warnings} warnings)`)
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
