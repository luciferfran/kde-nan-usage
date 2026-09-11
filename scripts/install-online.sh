#!/usr/bin/env bash
# Instalación en un comando de «Uso de NaN» (Plasma 6).
#
#   curl -fsSL https://raw.githubusercontent.com/luciferfran/kde-nan-usage/main/scripts/install-online.sh | bash
#
# Clona el repo, instala el plasmoid org.nan.usage en
# ~/.local/share/plasma/plasmoids y deja el icono en el tema del usuario.
# No toca nada más.
set -euo pipefail

REPO="https://github.com/luciferfran/kde-nan-usage.git"
PLUGIN_ID="org.nan.usage"

msg() { printf '\033[1;35m»\033[0m %s\n' "$*"; }
die() {
    printf '\033[1;31m✗\033[0m %s\n' "$*" >&2
    exit 1
}

command -v git >/dev/null 2>&1 || die "falta git"

data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
target="$data_home/plasma/plasmoids/$PLUGIN_ID"
icon_target="$data_home/icons/hicolor/scalable/apps/nan.svg"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

msg "Descargando…"
git clone --depth 1 "$REPO" "$tmp/src" >/dev/null 2>&1 || die "no pude clonar $REPO"

src="$tmp/src/$PLUGIN_ID"
[ -d "$src" ] || die "no encuentro $PLUGIN_ID dentro del repo"

msg "Instalando el widget en $target"
if command -v kpackagetool6 >/dev/null 2>&1; then
    kpackagetool6 --type Plasma/Applet --install "$src" >/dev/null 2>&1 ||
        kpackagetool6 --type Plasma/Applet --upgrade "$src" >/dev/null
else
    mkdir -p "$(dirname "$target")"
    rm -rf "$target"
    cp -r "$src" "$target"
fi

msg "Instalando el icono en $icon_target"
mkdir -p "$(dirname "$icon_target")"
cp "$src/contents/icons/nan.svg" "$icon_target"

KEY="$HOME/.config/nan/api-key"
if [ ! -s "$KEY" ]; then
    msg "Aún falta tu API key. Ponla así (queda solo para tu usuario):"
    printf "    mkdir -p ~/.config/nan && (umask 177; printf %%s 'TU_API_KEY' > ~/.config/nan/api-key)\n"
fi

msg "Instalado. Reiniciá Plasma para cargarlo:"
printf "    kquitapp6 plasmashell && kstart plasmashell\n"
printf "    Después: clic derecho en el panel → Agregar widgets → «Uso de NaN»\n"
