# NaN Usage

Un widget de KDE Plasma 6 para la cuota de tu suscripción de
[NaN](https://nan.builders), inspirado en
[gnome-nan-usage](https://github.com/prgr1no/gnome-nan-usage).

Muestra en el panel el porcentaje del modelo que peor va, los días hasta el
reset y, al hacer clic, un popup con una barra por modelo, la proyección del
ritmo de consumo y el consumo agregado de las últimas 24 h, el mes y 30 días.

¿Todavía no tenés cuenta en NaN? Usá [este enlace de referido](https://cloud.nan.builders/r/BM7BJE4M) para registrarte.

<p align="center">
  <a href="https://github.com/luciferfran/kde-nan-usage/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/luciferfran/kde-nan-usage/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Licencia GPL-2.0-or-later" src="https://img.shields.io/badge/licencia-GPL--2.0--or--later-blue.svg">
  <img alt="KDE Plasma 6" src="https://img.shields.io/badge/KDE%20Plasma-6-1D99F3.svg?logo=kde&logoColor=white">
</p>

## Capturas

<p align="center">
  <img src="screenshots/panel.png" alt="Vista compacta del widget en el panel" width="166">
</p>
<p align="center"><sub>El indicador en el panel: icono, anillo de nivel, porcentaje y días hasta el reset.</sub></p>

<p align="center">
  <img src="screenshots/popup.png" alt="Popup con una barra por modelo, la proyección del ritmo y el consumo agregado" width="380">
</p>
<p align="center"><sub>El popup: una barra por modelo, la proyección del ritmo, el consumo agregado y el botón al panel de NaN.</sub></p>

<p align="center">
  <img src="screenshots/desktop.png" alt="El widget en el escritorio mostrando la vista completa" width="360">
</p>
<p align="center"><sub>El mismo widget en el escritorio, donde se muestra la vista completa.</sub></p>

## Características

- **Vista compacta en el panel**: icono, anillo (o barra) con el porcentaje del
  modelo más cargado y el tiempo hasta el reset.
- **Popup detallado**: una barra por modelo con tokens usados, cap, restante y
  la proyección del ritmo.
- **Aviso por consecuencia, no por porcentaje**: ámbar si al ritmo medio del
  periodo la cuota va camino de pasarse, rojo si se agotaría antes del reset
  dejándote bloqueado un buen rato.
- **Consumo agregado** de 24 h, mes y 30 días (opcional, una petición más).
- **Sin OAuth**: lee la API key del mismo fichero que usa el CLI `nan`.
- **Se porta bien con la API**: si NaN falla y ya había datos, los conserva y lo
  dice; entre sondeos recalcula los «reset en …» sin tocar la red.
- **Configurable**: ruta de la key, intervalo de sondeo, modelo del panel, estilo
  de indicador y qué partes mostrar.

## Requisitos

- **KDE Plasma 6.0 o superior.**
- Una suscripción de NaN con API key.

## Instalación

### En un comando

```sh
curl -fsSL https://raw.githubusercontent.com/luciferfran/kde-nan-usage/main/scripts/install-online.sh | bash
```

Clona el repo, instala el widget y el icono, y te recuerda cómo poner la API key.
Luego **reiniciá Plasma** o cerrá y volvé a entrar para que aparezca. ¿Preferís
leerlo antes de ejecutarlo? Está en
[`scripts/install-online.sh`](scripts/install-online.sh).

### Desarrollo (enlace simbólico)

```sh
git clone https://github.com/luciferfran/kde-nan-usage.git
cd kde-nan-usage
./install.sh          # enlaza org.nan.usage en ~/.local/share/plasma/plasmoids
```

`./install.sh copy` deja una copia limpia en vez de un enlace; `./install.sh
uninstall` la quita.

### Con kpackagetool6

```sh
kpackagetool6 --type Plasma/Applet --install org.nan.usage

# Icono del tema (para que aparezca en la lista de widgets):
mkdir -p ~/.local/share/icons/hicolor/scalable/apps
cp org.nan.usage/contents/icons/nan.svg ~/.local/share/icons/hicolor/scalable/apps/nan.svg
```

### Sin git

Descargá el código de la
[última release](https://github.com/luciferfran/kde-nan-usage/releases/latest)
(botón «Source code»), descomprimilo y dentro de la carpeta ejecutá `./install.sh`.

Después **reiniciá Plasma** o cerrá y volvé a entrar para que el widget aparezca.
En Wayland, Plasma no recarga QML en caliente.

Luego agregá el widget desde **Clic derecho en el panel → Agregar widgets →
NaN Usage**, desde la bandeja del sistema (**Configurar bandeja → Entradas**) o
desde el escritorio (**Clic derecho en el escritorio → Agregar widgets**). En el
panel y en la bandeja se ve la vista compacta; en el escritorio se muestra la
vista completa.

## La API key

El widget lee la key de `~/.config/nan/api-key` (una sola línea). Es el mismo
fichero que usan el CLI `nan` y demás herramientas de la comunidad. Para crearlo
con permisos correctos:

```sh
mkdir -p ~/.config/nan
(umask 177; printf %s 'TU_API_KEY' > ~/.config/nan/api-key)   # queda en modo 600
```

La ruta se puede cambiar en los ajustes. La key **nunca** sale en logs ni en
mensajes de error.

## Ajustes

Desde ⚙ en el popup o en la configuración del widget:

| clave | qué hace | por defecto |
| --- | --- | --- |
| `keyPath` | fichero con la API key (`~` vale) | `~/.config/nan/api-key` |
| `pollSeconds` | segundos entre sondeos (60 a 1800) | `300` |
| `panelModel` | qué modelo refleja el panel: `worst` (nivel y luego uso), `max` (mayor uso), `fixed` | `worst` |
| `panelModelId` | modelo para `fixed` | `deepseek-v4-flash` |
| `panelGauge` | `ring`, `bar` o `none` | `ring` |
| `showIcon` | mostrar el icono | sí |
| `showPercentage` | mostrar el porcentaje | sí |
| `showReset` | mostrar el tiempo hasta el reset | sí |
| `hideUnused` | ocultar en el popup los modelos con cero uso | sí |
| `showMetrics` | línea de consumo 24 h / mes / 30 d (una petición más) | sí |

## Cómo funciona

La API de inferencia de NaN (`api.nan.builders/v1`, LiteLLM) no expone uso. El
backend del panel web, `cloud-api.nan.builders`, sí, con la misma key como
`Bearer`. Sus rutas salen del bundle JS del panel y **no tienen contrato
público**: pueden cambiar sin aviso.

| ruta | uso aquí |
| --- | --- |
| `GET /api/usage/quota` | `periodStart` y `models[]` con `tokensUsed`, `cap`, `remaining`, `periodEnd`; alimenta las barras |
| `GET /api/auth/me` | handle, región y tier de la cabecera; se pide una vez |
| `GET /api/metrics/usage` | consumo agregado 24 h / mes / 30 d, opcional |

- **Nivel por consecuencia.** Ámbar si el ritmo medio del periodo proyecta ≥ 75 %
  al reset; rojo si a ese ritmo la cuota se agota y el bloqueo duraría al menos un
  10 % del periodo. Los primeros días (menos del 5 % transcurrido) no se
  extrapola: la media es ruido.
- **La key se lee del fichero en cada sondeo** (es diminuto), así cambiarla no
  obliga a reiniciar Plasma.
- **Sondeo cada 5 minutos** por defecto, otro al abrir el popup y con «↻
  Actualizar», con un mínimo de 30 s entre peticiones.

## Desarrollo y pruebas

```sh
node org.nan.usage/tests/quotaModel.test.js   # lógica pura con datos sintéticos y reloj fijo
/usr/lib/qt6/bin/qmllint -I /usr/lib/qt6/qml org.nan.usage/contents/ui/*.qml
```

El indicador, el popup y los ajustes solo se ven dentro de Plasma. Para iterar sin
cerrar sesión se puede reiniciar el shell:

```sh
kquitapp6 plasmashell && kstart plasmashell
```

Los errores de carga salen en:

```sh
journalctl --user -b -o cat /usr/bin/plasmashell | grep -i nan-usage
```

## Desinstalar

```sh
./install.sh uninstall
# o:
kpackagetool6 --type Plasma/Applet --remove org.nan.usage
```

## Seguridad

- La API key **nunca** sale en logs ni en mensajes de error.
- Se valida la ruta del fichero de key: no acepta path traversal (`..`), rutas
  absolutas fuera de `$HOME`, ni caracteres de inyección shell (`` ` ``, `;`, `|`,
  `&`).
- Se validan las respuestas de la API antes de procesarlas.
- El timeout de red se ajusta dinámicamente al intervalo de sondeo (70%, entre
  5 y 15 s).
- `install.sh` alerta si el fichero de API key tiene permisos inseguros
  (debe ser 600 o 400).
- Todo el tráfico va directamente a NaN; el widget no almacena datos ni los
  envía a terceros.

## Privacidad

Todo el tráfico va de tu equipo a NaN, con tu key. El widget no manda datos a
ningún otro sitio, no guarda histórico y no escribe la key en ninguna parte.

## Licencia

**GPL-2.0-or-later.** Es un port del proyecto
[gnome-nan-usage](https://github.com/prgr1no/gnome-nan-usage) de prgr1no, que a
su vez deriva el esqueleto (botón de panel, anillo, barras y proyección) de
[Claude Code Usage Monitor](https://github.com/dvdstelt/ClaudeCodeUsage) de David
Boike (GPL-2.0). Ver [LICENSE](LICENSE).

---

<sub>Proyecto de la comunidad, <strong>no oficial</strong>: no está afiliado ni
respaldado por nan.builders. «NaN» y su logotipo pertenecen a sus dueños.</sub>
