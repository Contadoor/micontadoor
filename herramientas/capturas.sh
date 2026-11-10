#!/bin/zsh
# Atajo: capturas del modo demo (ver herramientas/capturas.mjs). Uso: herramientas/capturas.sh <carpeta_salida> [puerto]
exec node "${0:A:h}/capturas.mjs" "$@"
