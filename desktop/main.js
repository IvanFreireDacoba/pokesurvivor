// PokéSurvivor de escritorio (Linux / Steam Deck): el juego web va dentro de
// la app y se sirve como https://juego.pokesurvivor.internal/ (la app intercepta
// ese dominio y devuelve los ficheros locales; el resto de https sale a la red).
// Con un origen https el juego activa la nube (cuentas, partidas, ranking) y
// localStorage/IndexedDB funcionan igual que en la web. El mando lo lee el propio
// juego con la Gamepad API (js/core/gamepad.js); en la Steam Deck, Steam Input
// lo presenta como un mando de Xbox estándar.
//
// Variante OFFLINE (compilar.sh ... offline, o --offline): el juego arranca en
// su modo local (window.PSOffline: cuentas y partidas en este equipo, nunca
// carga Firebase) y su sesión no puede salir a la red: solo llega a los
// ficheros del propio juego. Así no se toca la nube ni el ranking del autor.
const { app, BrowserWindow, net, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const HOST = 'juego.pokesurvivor.internal';
const INICIO = `https://${HOST}/dev.html`;

// Empaquetado: resources/juego. En desarrollo (npm start): build/juego.
const RAIZ = app.isPackaged ? path.join(process.resourcesPath, 'juego') : path.join(__dirname, 'build', 'juego');

function leerVariante() {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, 'build'), 'variante.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}
const OFFLINE = leerVariante().offline === true || process.argv.includes('--offline');

// En el Modo Juego de la Steam Deck (gamescope) o con --fullscreen: pantalla completa.
const PANTALLA_COMPLETA = process.env.SteamDeck === '1' || /gamescope/i.test(process.env.XDG_CURRENT_DESKTOP || '')
  || process.argv.includes('--fullscreen');

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

function servirJuego(sesion) {
  sesion.protocol.handle('https', (peticion) => {
    const url = new URL(peticion.url);
    if (url.host !== HOST) {
      return OFFLINE ? new Response('Versión sin conexión', { status: 503 })
        : net.fetch(peticion, { bypassCustomProtocolHandlers: true });
    }
    const relativa = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'dev.html';
    const fichero = path.resolve(RAIZ, relativa);
    if (!fichero.startsWith(RAIZ + path.sep) || !fs.existsSync(fichero)) {
      return new Response('No encontrado', { status: 404 });
    }
    // Leído directamente de disco: net.fetch(file://) fallaba (ERR_UNEXPECTED)
    // con las decenas de scripts que pide el juego a la vez.
    return fs.promises.readFile(fichero).then(
      datos => new Response(datos, { headers: { 'content-type': TIPOS[path.extname(fichero).toLowerCase()] || 'application/octet-stream' } }),
      () => new Response('Error de lectura', { status: 500 }));
  });
}

/** Offline: cualquier petición que no sea al propio juego (http, ws, otros https...) se corta. */
function cortarRed(sesion) {
  const propio = `https://${HOST}/`;
  sesion.webRequest.onBeforeRequest((detalles, responder) => {
    const url = detalles.url;
    responder({ cancel: !(url.startsWith(propio) || /^(data|blob|devtools|chrome-extension):/.test(url)) });
  });
}

function crearVentana(sesion) {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: PANTALLA_COMPLETA,
    backgroundColor: '#0a1430',
    autoHideMenuBar: true,
    title: OFFLINE ? 'PokéSurvivor Offline' : 'PokéSurvivor',
    icon: path.join(RAIZ, 'assets/icons/icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      session: sesion,
      additionalArguments: OFFLINE ? ['--ps-offline'] : [],
      contextIsolation: true,
      sandbox: true
    }
  });
  ventana.setMenu(null);

  // Enlaces externos (créditos, apoyar...): al navegador del sistema.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (evento, url) => {
    if (new URL(url).host !== HOST) {
      evento.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  // F11: pantalla completa (Esc es del juego: pausa).
  ventana.webContents.on('before-input-event', (evento, tecla) => {
    if (tecla.type === 'keyDown' && tecla.key === 'F11') {
      ventana.setFullScreen(!ventana.isFullScreen());
      evento.preventDefault();
    }
  });

  ventana.loadURL(INICIO);
}

// Chromium escribe localStorage (cuentas y partidas locales) a disco con
// retraso: si Steam cierra el juego con una señal, lo último se perdía. Se
// vuelca al salir, al recibir la señal y cada 15 s.
function guardarAlCerrar(sesion) {
  const volcar = () => { try { sesion.flushStorageData(); } catch (e) { /* cerrando */ } };
  setInterval(volcar, 15000);
  app.on('before-quit', volcar);
  for (const senal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(senal, () => { volcar(); app.quit(); });
  }
}

// Autoactualización: solo si la build trae su app-update.yml (se compila con
// una URL de actualizaciones, ver README) y se ejecuta como AppImage.
function buscarActualizaciones() {
  if (!app.isPackaged || !process.env.APPIMAGE) return;
  if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify().catch(() => { /* sin conexión: se juega con la versión actual */ });
}

app.whenReady().then(() => {
  // La offline va en su propia sesión: el bloqueo de red no afecta al
  // proceso principal (autoactualización desde sund.es, si hay conexión).
  const sesion = OFFLINE ? session.fromPartition('persist:offline') : session.defaultSession;
  servirJuego(sesion);
  if (OFFLINE) cortarRed(sesion);
  guardarAlCerrar(sesion);
  crearVentana(sesion);
  buscarActualizaciones();
});

app.on('window-all-closed', () => app.quit());
