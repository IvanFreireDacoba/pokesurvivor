#!/bin/bash
# Compila el AppImage (Linux x86_64 / Steam Deck). Requiere Node 20+.
#   ./compilar.sh                          -> sin autoactualización
#   ./compilar.sh https://.../linux        -> con autoactualización desde esa URL
#                                             (ahí van el AppImage y latest-linux.yml)
#   ./compilar.sh <url|""> offline         -> variante OFFLINE («PokeSurvivor Offline»:
#                                             sin nube, app y datos aparte de la normal)
set -euo pipefail
cd "$(dirname "$0")"
rm -rf build && mkdir -p build/juego recursos
OPCIONES=()
if [ "${2:-}" = offline ]; then
  echo '{"offline": true}' > build/variante.json
  OPCIONES=(-c.appId=es.sund.pokesurvivor.offline -c.productName="PokeSurvivor Offline"
            -c.extraMetadata.name=pokesurvivor-offline -c.extraMetadata.productName="PokeSurvivor Offline"
            -c.artifactName='PokeSurvivor-Offline-${version}-x86_64.${ext}' -c.linux.executableName=pokesurvivor-offline)
else
  echo '{}' > build/variante.json
fi
( cd .. && tar cf - --exclude=js/app.min.js --exclude=assets/og-image.jpg \
    dev.html second.html manifest.webmanifest favicon.ico LICENSE CREDITS.md css js assets ) | tar xf - -C build/juego
cp ../assets/icons/icon-512.png recursos/icono.png
npm ci --no-audit --no-fund
if [ -n "${1:-}" ]; then
  npx electron-builder --linux AppImage --x64 "${OPCIONES[@]}" -c.publish.provider=generic -c.publish.url="$1" --publish never
else
  npx electron-builder --linux AppImage --x64 "${OPCIONES[@]}" --publish never
fi
ls -la dist/*.AppImage
