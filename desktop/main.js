// PokéSurvivor de escritorio (Linux / Steam Deck): el juego web va dentro de
// la app y se sirve como https://juego.pokesurvivor.internal/ (la app intercepta
// ese dominio y devuelve los ficheros locales; el resto de https sale a la red).
// Con un origen https el juego activa la nube (cuentas, partidas, ranking) y
// localStorage/IndexedDB funcionan igual que en la web. El mando lo lee el propio
// juego con la Gamepad API (js/core/gamepad.js); en la Steam Deck, Steam Input
// lo presenta como un mando de Xbox estándar.
const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const HOST = 'juego.pokesurvivor.internal';
const INICIO = `https://${HOST}/dev.html`;

// Empaquetado: resources/juego. En desarrollo (npm start): build/juego.
const RAIZ = app.isPackaged ? path.join(process.resourcesPath, 'juego') : path.join(__dirname, 'build', 'juego');

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

function servirJuego() {
  protocol.handle('https', (peticion) => {
    const url = new URL(peticion.url);
    if (url.host !== HOST) return net.fetch(peticion, { bypassCustomProtocolHandlers: true });
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

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: PANTALLA_COMPLETA,
    backgroundColor: '#0a1430',
    autoHideMenuBar: true,
    title: 'PokéSurvivor',
    icon: path.join(RAIZ, 'assets/icons/icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
  servirJuego();
  crearVentana();
  buscarActualizaciones();
});

app.on('window-all-closed', () => app.quit());
