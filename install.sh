#!/usr/bin/env bash
# Install, copy or remove the org.nan.usage plasmoid for development.
#
# Usage:
#   ./install.sh          # symlink the package (live reload of QML on plasma restart)
#   ./install.sh copy     # copy a clean package instead of linking
#   ./install.sh uninstall
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
package="$here/org.nan.usage"
data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
target="$data_home/plasma/plasmoids/org.nan.usage"
icon_target="$data_home/icons/hicolor/scalable/apps/nan.svg"

install_icon() {
    mkdir -p "$(dirname "$icon_target")"
    cp "$package/contents/icons/nan.svg" "$icon_target"
    echo "Icono instalado en $icon_target"
}

case "${1:-install}" in
install)
    mkdir -p "$(dirname "$target")"
    rm -rf "$target"
    ln -s "$package" "$target"
    install_icon
    echo "Enlazado $target -> $package"
    ;;
copy)
    mkdir -p "$(dirname "$target")"
    rm -rf "$target"
    cp -r "$package" "$target"
    install_icon
    echo "Copiado a $target"
    ;;
uninstall)
    rm -rf "$target"
    rm -f "$icon_target"
    echo "Eliminado $target y $icon_target"
    ;;
*)
    echo "Uso: $0 [install|copy|uninstall]" >&2
    exit 1
    ;;
esac

echo "Reiniciá Plasma (o cerrá y volvé a entrar) para cargar el widget."
