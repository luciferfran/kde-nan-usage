# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/);
versionado [SemVer](https://semver.org/lang/es/).

## [No publicado]

### Añadido

- Fondo de créditos (#1): el widget lee `GET api.nan.builders/v1/usage`
  (informe en vivo por día y modelo) además de `/api/usage/quota`. Si la
  respuesta trae `credits`, el medidor del panel es `used / allowance` con
  reinicio en `period_end` y proyección de ritmo; las barras por modelo
  muestran los créditos gastados (su parte del fondo) y la línea `mes:` suma
  tokens y créditos. `credits` es opcional y un fondo `frozen` se indica en
  la nota de la barra.
- Una barra de la cuota cuyo `updatedAt` es anterior a la última actividad
  del modelo se marca «sin actualizar desde …», no genera alertas y el panel
  no la elige.
- `/api/usage/quota` sigue siendo el respaldo: si `/v1/usage` falla, el
  widget funciona como antes. Solo hay error si fallan las dos rutas.

- Popup: bajo cada barra, una línea con los tokens extra del modelo
  (`extraTokens`) y si los puede usar (`extraUsable`), p. ej.
  «extra: 0 · utilizable». Se oculta si la API no envía esos campos.

### Fijo

- Tests: `nanClient.test.js` salía con código 0 aunque fallaran los tests
  declarados tras el resumen. Migrados ambos archivos a `node:test`.
- `hideUnused` no tenía efecto: el popup ahora usa `visibleWindows()`.
- Ajustes: los desplegables «Modelo del panel» e «Indicador del panel» no
  mostraban el valor guardado al reabrir el diálogo.
- Una ruta de API key inválida dejaba el widget colgado sin mensaje; ahora
  muestra «Ruta de API key no válida».
- `install.sh` no llamaba a la verificación de permisos de la key; ahora usa
  `scripts/check-key-perms.sh`, que no pregunta si no hay terminal.
- «Actualizar ahora» vuelve a esperar como máximo 30 s (podía esperar el
  intervalo de sondeo completo).
- `validateResponse` devuelve siempre un booleano; `fmtTokens` muestra `0`
  para valores no finitos.

### Cambiado

- `nanClient.request()` acepta un host (`INFERENCE_API` o `CLOUD_API`) y
  `validateResponse` ignora la query string; nuevo validador para
  `/v1/usage`. README corregido: la API de inferencia sí expone uso.
- Comprobado contra los modelos que NaN ofrece desde noviembre de 2026
  (`glm5.3`, `glm5.3-flash`, `qwen3.8-flash`, `mimo-v2.6-flash`, además de
  `deepseek-v4-flash` y `glm5.2`): aparecen solos en el popup porque las
  barras salen de `GET /api/usage/quota`, sin lista fija. En el panel se
  abrevian como `glm5.3f`, `qwen3.8f` y `mimo-v2.6f`. Los campos nuevos
  `extraTokens` y `extraUsable` se muestran en el popup (ver «Añadido»). Tests con la forma
  actual de la respuesta.
- El widget ya no pide `GET /api/auth/me` ni `GET /api/metrics/usage`: desde
  octubre de 2026 responden `401 session_required` a las API keys. La línea de
  consumo del popup ahora deriva el total del mes de `GET /api/usage/quota`,
  sin peticiones extra; eliminada la opción `showMetrics`.
- Tests de `request()` con un `XMLHttpRequest` simulado.
- `npm run check` agrupa lint, tests y validación QML; `lint:fix` usa
  `--write` (Biome 2); Biome fijado a 2.5.15.
- CI: Node 22, `biome ci .`, job de ShellCheck y validación QML dentro del
  job de tests.

## [0.2.0] - 2026-09-11

Mejoras de calidad: seguridad, error handling, CI/CD, tests y modernización JS.

### Añadido

- **Seguridad**: validación de rutas de API key contra path traversal, rutas
  absolutas e inyección shell (`isValidKeyPath`).
- **Seguridad**: validación de estructura de respuesta de API antes de pasar
  datos a consumidores (`validateResponse`).
- **Seguridad**: timeout dinámico basado en `pollSeconds` (70% del intervalo,
  entre 5s y 15s).
- **Seguridad**: verificación de permisos de fichero de API key en `install.sh`
  (alerta si no es 600/400).
- **Error handling**: clasificación de UI states (`waiting-for-key`,
  `no-api-key`, `api-error`, `ok`) para mensajes claros al usuario.
- **Error handling**: preservación de caché cuando falta la key (no se borra
  `windows`, se marca `stale = true`).
- **Error handling**: cooldown dinámico basado en `pollTimer.interval` en vez
  de 30s fijos.
- **CI/CD**: lint con Biome, validación de estructura QML, tests de Node.
- **Tests**: +31 tests para `quotaModel`, +14 tests para `nanClient`.
- **Modernización**: reemplazo de `var` por `const`/`let`, template literals,
  optional chaining, `biome.json` configurado.
- **Documentación**: README en inglés (`README.en.md`), enlace de referido,
  sección de seguridad en README.

### Cambiado

- `install.sh`: la función `check_key_perms()` verifica y ajusta permisos de la
  API key al instalar.
- Cooldown entre sondeos: usa `pollTimer.interval` (configurable vía
  `pollSeconds`) en vez de 30s hardcodeados.

### Fijo

- `main.qml`: al perder la API key, conserva datos en caché en vez de borrarlos.
- `biome.json`: corrección de tabs a spaces (fallaba el CI).

[0.2.0]: https://github.com/luciferfran/kde-nan-usage/compare/v0.1.0...v0.2.0
[No publicado]: https://github.com/luciferfran/kde-nan-usage/compare/v0.2.0...HEAD

## [0.1.0] - 2026-09-11

Primera versión. Port de
[gnome-nan-usage](https://github.com/prgr1no/gnome-nan-usage) a KDE Plasma 6.

### Añadido

- Widget de Plasma 6 (`org.nan.usage`) que muestra la cuota de NaN en el panel,
  la bandeja del sistema y el escritorio.
- Vista compacta: icono, anillo (o barra) con el porcentaje del modelo que peor
  va y el tiempo hasta el reset.
- Popup con una barra por modelo (tokens usados frente al cap, restante y
  porcentaje), notas de proyección, consumo agregado 24 h / mes / 30 d y botón
  al panel de NaN.
- Nivel por consecuencia (ámbar/rojo) según el ritmo proyecte pasarse o agotar
  la cuota antes del reset, no solo por el porcentaje actual.
- Ajustes KConfigXT: ruta de la API key, intervalo de sondeo, modelo del panel,
  estilo de indicador y qué partes mostrar.
- Lee la API key de `~/.config/nan/api-key` (misma fuente que el CLI `nan`).
- Modo cuadrado para la bandeja del sistema, que fuerza applets cuadrados.
- Instalador de un comando (`scripts/install-online.sh`) y script de desarrollo
  (`install.sh`).
- Tests de la lógica pura y del cliente con Node, más CI con GitHub Actions.
- Licencia GPL-2.0-or-later.

[No publicado]: https://github.com/luciferfran/kde-nan-usage/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/luciferfran/kde-nan-usage/releases/tag/v0.1.0
