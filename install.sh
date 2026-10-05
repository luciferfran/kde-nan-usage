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

check_key_perms() {
    local KEY="$HOME/.config/nan/api-key"
    if [ ! -f "$KEY" ]; then
        return
    fi
    local PERMS
    PERMS=$(stat -c '%a' "$KEY" 2>/dev/null || stat -f '%Lp' "$KEY" 2>/dev/null || echo "unknown")
    if [ "$PERMS" != "600" ] && [ "$PERMS" != "400" ]; then
        printf "\033[1;33mAdvertencia: fichero de API key tiene permisos inseguros (mode %s, debería ser 600 o 400)\033[0m\n" "$PERMS"
        printf "Fijar ahora? [y/N] "
        read -r RESP
        if [[ "$RESP" =~ ^[Yy] ]]; then
            chmod 600 "$KEY" && printf "\033[1;32mPermisos fijados\033[0m\n" || printf "\033[1;31mError al fijar permisos\033[0m\n"
        else
            printf "Fijar manualmente: chmod 600 %s\n" "$KEY"
        fi
    fi
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
