# PokéSurvivor para Linux y Steam Deck

Versión de escritorio del juego: un AppImage (un solo fichero, sin instalar
nada) con el juego dentro. Hay dos:

| | **PokeSurvivor** | **PokeSurvivor Offline** |
|---|---|---|
| Cuentas y partidas | En la nube del juego, como en la web (también funciona sin conexión como invitado) | Solo en este equipo |
| Amigos, cooperativo y ranking | Sí | No |
| Conexión | La usa para la nube | El juego no se conecta nunca a internet |

Las dos se pueden tener a la vez: son apps distintas y no comparten partidas.
La Offline es para jugar sin conexión (en el tren, en el avión...) sin
depender de nada externo; sus puntuaciones nunca llegan al ranking online.

## Instalar en la Steam Deck

1. Pasa a **Modo escritorio** (botón Steam → Apagar → Cambiar al escritorio).
2. Descarga `PokeSurvivor-x.y.z-x86_64.AppImage` (o
   `PokeSurvivor-Offline-x.y.z-x86_64.AppImage`) de *Releases* y guárdalo,
   por ejemplo, en `~/Aplicaciones/`.
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
- **Offline:** el `preload.js` expone `window.PSOffline` y el juego se queda
  en su modo local (`js/core/db.js`): no carga Firebase y guarda cuentas y
  partidas en el `localStorage` de la app. Además, la sesión de la ventana
  corta cualquier petición que no sea a los ficheros del propio juego. Lo
  único que sale a la red es la comprobación de actualizaciones, desde el
  proceso principal, y si no hay conexión no pasa nada.
- Las partidas locales se vuelcan a disco cada 15 s, al salir y al recibir
  la señal de cierre de Steam, para no perder lo último jugado.

## Compilar

Node 20 o posterior:

    ./compilar.sh                          # AppImage sin autoactualización
    ./compilar.sh https://tu-web/linux     # con autoactualización
    ./compilar.sh "" offline               # variante Offline (con URL: autoactualización)

Con URL, el AppImage busca actualizaciones al arrancar en
`<url>/latest-linux.yml`. Hay que publicar ahí ese fichero y el AppImage nuevo,
los dos están en `dist/`. La actualización se descarga en segundo plano y se
aplica al cerrar el juego.

## Licencias

El AppImage es gratuito y así debe seguir: los sprites son de
[SpriteCollab](https://github.com/PMDCollab/SpriteCollab) bajo **CC BY-NC
4.0** (uso no comercial y con atribución). No se puede vender ni meter en un
producto de pago. Cada AppImage lleva dentro `LICENSE` y `CREDITS.md`, y el
juego muestra la atribución en pantalla.

- Código del juego y de esta versión de escritorio: MIT.
- Fuente Pixelify Sans: SIL OFL 1.1.
- Datos de PokeAPI.
- Pokémon y sus nombres son marcas de Nintendo, Creatures Inc., GAME FREAK y
  The Pokémon Company. Es un proyecto de fans sin ánimo de lucro, sin
  relación con ellos.
