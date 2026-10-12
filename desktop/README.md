# PokéSurvivor para Linux y Steam Deck

Versión de escritorio del juego: un AppImage (un solo fichero, sin instalar
nada) con el juego dentro. Funciona sin conexión como invitado; con conexión,
las cuentas con nombre y contraseña, el ranking y el cooperativo van igual que
en la web.

## Instalar en la Steam Deck

1. Pasa a **Modo escritorio** (botón Steam → Apagar → Cambiar al escritorio).
2. Descarga `PokeSurvivor-x.y.z-x86_64.AppImage` de *Releases* y guárdalo, por
   ejemplo, en `~/Aplicaciones/`.
3. Clic derecho en el fichero → *Propiedades → Permisos* → marca **Es ejecutable**.
4. Abre Steam → *Juegos → Añadir un juego que no es de Steam* → *Examinar* →
   elige el AppImage → *Añadir los programas seleccionados*.
5. Vuelve al **Modo juego**: aparece en tu biblioteca como «PokeSurvivor». La
   plantilla de mando por defecto (Mando) ya funciona.

En el Modo juego arranca a pantalla completa. En el escritorio, F11 la activa
o la quita.

## Controles

| Mando | En partida | En menús |
|---|---|---|
| Stick izq. / cruceta | Moverse | Mover el foco |
| Stick der. | Apuntar (al soltar, apuntado automático) | — |
| L1 / R1 (y L2 / R2) | Ataque anterior / siguiente | — |
| A | — | Pulsar |
| B | — | Volver |
| Start (☰) | Pausa | Volver / reanudar |

Con teclado y ratón: los controles de la web, y mantener el clic izquierdo
apunta al ratón. La pantalla táctil de la Deck también funciona.

## Cómo funciona

- [Electron](https://www.electronjs.org/): el juego se sirve desde
  `https://juego.pokesurvivor.internal/`. La app intercepta ese dominio y
  devuelve los ficheros locales; el resto del tráfico https (Firebase) sale a
  la red con normalidad. Al ser un origen https, el juego activa la nube igual
  que en la web.
- El mando lo lee el propio juego con la Gamepad API (`js/core/gamepad.js`).
  En la Deck, Steam Input lo presenta como un mando de Xbox estándar.
- «Entrar con Google» no funciona dentro de la app: Google no permite iniciar
  sesión en navegadores integrados. El juego lo explica al pulsarlo.

## Compilar

Node 20 o posterior:

    ./compilar.sh                          # AppImage sin autoactualización
    ./compilar.sh https://tu-web/linux     # con autoactualización

Con URL, el AppImage busca actualizaciones al arrancar en
`<url>/latest-linux.yml`. Hay que publicar ahí ese fichero y el AppImage nuevo,
los dos están en `dist/`. La actualización se descarga en segundo plano y se
aplica al cerrar el juego.
