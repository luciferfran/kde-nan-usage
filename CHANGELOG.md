# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/);
versionado [SemVer](https://semver.org/lang/es/).

## [No publicado]

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
