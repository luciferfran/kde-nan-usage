# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/);
versionado [SemVer](https://semver.org/lang/es/).

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
