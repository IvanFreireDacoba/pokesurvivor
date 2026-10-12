// Su mera existencia le dice al juego que va dentro de una app (sin service
// worker, y aviso si se pulsa «Entrar con Google»).
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('PSNativo', { plataforma: () => 'linux' });
