// Su mera existencia le dice al juego que va dentro de una app (sin service
// worker, y aviso si se pulsa «Entrar con Google»). En la variante offline,
// además PSOffline: el juego se queda en su modo local (ver js/core/db.js).
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('PSNativo', { plataforma: () => 'linux' });
if (process.argv.includes('--ps-offline')) contextBridge.exposeInMainWorld('PSOffline', true);
