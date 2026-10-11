# PokéSurvivor para Android (consolas con mando)

Envoltorio nativo del juego web para consolas Android con mando (probado
pensando en las Retroid Pocket): el juego va entero dentro de la APK (sin
navegador; como invitado funciona sin conexión) y los botones de la consola
se mandan al juego (`js/core/gamepad.js`).

| Mando | En partida | En menús |
|---|---|---|
| Stick izq. / cruceta | Moverse | Mover el foco |
| Stick der. | Apuntar (al soltar, apuntado automático) | — |
| L / R (y L2 / R2) | Ataque anterior / siguiente | — |
| A | — | Pulsar |
| B | — | Volver |
| Start | Pausa | Volver / reanudar |

En PC, con mando (Gamepad API) funciona igual, y mantener el clic izquierdo
sobre el juego apunta al ratón.

## Cómo funciona

- El juego se sirve desde `https://appassets.androidplatform.net/juego/`
  (`WebViewAssetLoader`): un origen https normal, así `localStorage` y
  Firebase funcionan como en la web. Carga `dev.html` (no hace falta
  compilar `app.min.js`).
- `MainActivity` lee los botones y sticks nativos y manda el estado completo
  al juego con `G.Pad.nativo({...})`, como mucho una vez por fotograma.
- `window.PSNativo` existe solo dentro de la app: el juego lo usa para no
  registrar el service worker y para avisar de que Google no deja iniciar
  sesión dentro de un WebView.

## Compilar

    cd android && gradle :app:assembleDebug    # SDK 34, Gradle 8.7, JDK 17+

- **Firma:** pon un keystore en `android/app/release.keystore` (no se sube
  al repositorio; las contraseñas están en `app/build.gradle`). Usa siempre
  el mismo para que las actualizaciones se instalen encima.
- **Autoactualización (opcional):**
  `gradle :app:assembleDebug -PurlActualizaciones=https://tu-web/version.json`.
  Ese JSON es `{"versionCode", "versionName", "apkUrl", "apkSha1"}`. Al abrir la
  app se comprueba; si hay versión nueva, se descarga, se verifica el SHA-1 y
  se abre el instalador. Sin la propiedad, la APK no se autoactualiza.

La tarea `copiarJuego` mete en la APK el juego de la raíz del repositorio.

## Entrar con Google en la app

Hoy no es posible: el juego usa `signInWithPopup` y Google bloquea su inicio
de sesión dentro de los WebView. Las cuentas con nombre y contraseña y el modo
invitado funcionan. Para tenerlo habría que registrar la app Android
(`es.sund.pokesurvivor` + SHA-1 del keystore) en el proyecto de Firebase y hacer
el login de forma nativa (Credential Manager), pasando el token al juego con
`firebase.auth.GoogleAuthProvider.credential(idToken)`.

## Licencias

Código: MIT (ver `LICENSE`). Sprites: SpriteCollab, CC BY-NC 4.0 (uso NO
comercial y con atribución, `CREDITS.md`).
