#!/bin/bash
# Compila el AppImage (Linux x86_64 / Steam Deck). Requiere Node 20+.
#   ./compilar.sh                      -> sin autoactualización
#   ./compilar.sh https://.../linux    -> con autoactualización desde esa URL
#                                         (ahí van el AppImage y latest-linux.yml)
set -euo pipefail
cd "$(dirname "$0")"
rm -rf build/juego && mkdir -p build/juego recursos
( cd .. && tar cf - --exclude=js/app.min.js --exclude=assets/og-image.jpg \
    dev.html manifest.webmanifest favicon.ico LICENSE CREDITS.md css js assets ) | tar xf - -C build/juego
cp ../assets/icons/icon-512.png recursos/icono.png
npm ci --no-audit --no-fund
if [ -n "${1:-}" ]; then
  npx electron-builder --linux AppImage --x64 -c.publish.provider=generic -c.publish.url="$1" --publish never
else
  npx electron-builder --linux AppImage --x64 --publish never
fi
ls -la dist/*.AppImage
