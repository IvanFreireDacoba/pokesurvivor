# PokéSurvivor para Android (consolas con mando)

Envoltorio nativo del juego web: el juego va entero dentro de la APK (sin
navegador, funciona sin conexión como invitado) y los botones de la consola
se mandan al juego (`js/core/gamepad.js`).

| Mando | En partida | En menús |
|---|---|---|
| Stick izq. / cruceta | Moverse | Mover el foco |
| Stick der. | Apuntar (al soltar, apuntado automático) | — |
| L / R (y L2 / R2) | Ataque anterior / siguiente | — |
| A | — | Pulsar |
| B | — | Volver |
| Start | Pausa | Volver / reanudar |

En PC, mantener el clic izquierdo sobre el juego apunta al ratón.

## Compilar

El keystore NO está en el repositorio: copiar la copia de seguridad
(`~/.secrets/pokesurvivor/release.keystore` en netcup) a `android/app/release.keystore`.

    cd android && gradle :app:assembleDebug    # SDK 34, Gradle 8.7, JDK 17+

La tarea `copiarJuego` mete en la APK el juego de la raíz del repositorio
(dev.html y sus scripts, sin compilar app.min.js).

## Licencias

Código del juego: MIT (JPTER78), ver `LICENSE`. Sprites: SpriteCollab, CC BY-NC 4.0
(uso NO comercial y con atribución, `CREDITS.md`). Esta APK es para uso
personal y no se distribuye con ánimo de lucro.
