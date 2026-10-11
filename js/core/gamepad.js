/* ============ gamepad.js — mando físico (consolas Android, PC) y apuntado ============
 * Dos fuentes de mando, la que tenga algo pulsado manda:
 *   - Gamepad API del navegador (mandos en PC).
 *   - La app Android (RetroidNova/consolas portátiles): sus botones nativos
 *     llegan con G.Pad.nativo({...}) desde el envoltorio (ver android/).
 *
 * En partida:  stick izq / cruceta = moverse · stick der = apuntar
 *              L / R = ataque anterior / siguiente · Start = pausa
 * En menús:    stick izq / cruceta = mover el foco · A = pulsar · B = volver
 *
 * Apuntado manual: con el stick derecho (o manteniendo el clic izquierdo del
 * ratón en PC) los ataques salen hacia donde apuntas; al soltar, vuelve el
 * apuntado automático de siempre. G.Input.axis() y player.js lo consultan.
 */
G.Pad = (() => {
  const DEAD = 0.25, AIM_DEAD = 0.35;
  // Estado lógico: botones por nombre y ejes [-1..1].
  const nat = { btn: {}, lx: 0, ly: 0, rx: 0, ry: 0 };
  let prev = {};
  let foco = null;
  let repetirT = 0, dirPrev = null;
  let ratonApunta = false;
  let usado = false;

  /** La app Android manda aquí el estado completo de su mando en cada cambio. */
  function nativo(e) {
    nat.btn = e.btn || {};
    nat.lx = +e.lx || 0; nat.ly = +e.ly || 0;
    nat.rx = +e.rx || 0; nat.ry = +e.ry || 0;
  }

  // Gamepad API estándar (mapping "standard").
  const STD = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'select', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right'];
  function leerNavegador() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const btn = {};
      STD.forEach((n, i) => { if (p.buttons[i] && p.buttons[i].pressed) btn[n] = true; });
      const ax = p.axes || [];
      return { btn, lx: ax[0] || 0, ly: ax[1] || 0, rx: ax[2] || 0, ry: ax[3] || 0 };
    }
    return null;
  }

  function estado() {
    const web = leerNavegador();
    if (!web) return nat;
    const algoNat = Object.keys(nat.btn).length || Math.hypot(nat.lx, nat.ly) > DEAD || Math.hypot(nat.rx, nat.ry) > DEAD;
    return algoNat ? nat : web;
  }

  let s = nat;

  function stick(x, y, dead) {
    const d = Math.hypot(x, y);
    if (d < dead) return null;
    const k = Math.min(1, (d - dead) / (1 - dead));
    return [x / d * k, y / d * k];
  }

  /** Movimiento: stick izquierdo o cruceta. Null si no se toca. */
  function vector() {
    if (!jugando()) return null;
    const v = stick(s.lx, s.ly, DEAD);
    if (v) return v;
    let x = 0, y = 0;
    if (s.btn.left) x -= 1;
    if (s.btn.right) x += 1;
    if (s.btn.up) y -= 1;
    if (s.btn.down) y += 1;
    return x || y ? G.U.norm(x, y) : null;
  }

  /** Ángulo de apuntado manual (stick derecho o ratón pulsado), o null. */
  function aimAngle(pl) {
    const r = stick(s.rx, s.ry, AIM_DEAD);
    if (r) return Math.atan2(r[1], r[0]);
    if (ratonApunta && G.Input && G.Camera && G.Camera.scale) {
      const m = G.Input.mouse();
      const wx = G.Camera.left() + m.x / G.Camera.scale, wy = G.Camera.top() + m.y / G.Camera.scale;
      return Math.atan2(wy - (pl.y - (G.LIFT || 0)), wx - pl.x);
    }
    return null;
  }

  /** Blanco en la dirección apuntada (cono de ±35°): el más cercano a tiro. */
  function targetInCone(list, pl, ang, maxDist = 520) {
    let best = null, bd = Infinity;
    for (const e of list) {
      if (e.dead) continue;
      const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
      if (d > maxDist) continue;
      const da = Math.abs(((Math.atan2(dy, dx) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (da <= 0.61 && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function jugando() {
    return G.Game && G.Game.state === 'playing' && !(G.SettingsUI && G.SettingsUI.isOpen);
  }

  // Teclas sintéticas: así el juego las trata igual que el teclado.
  function tecla(code) {
    dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
    dispatchEvent(new KeyboardEvent('keyup', { code, key: code }));
  }

  const pulsado = n => s.btn[n] && !prev[n];

  // ---------------- navegación de menús ----------------

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) return false;
    // Fuera de la pantalla pero mostrado: parte de una lista con scroll
    // (Pokédex, colección...). Se puede elegir y scrollIntoView lo trae.
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return true;
    // Tapado por otra capa (p.ej. el menú debajo de un diálogo): el punto
    // central tiene que caer en el propio elemento.
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!t && (t === el || el.contains(t) || t.contains(el));
  }

  function pulsables() {
    const todos = [...document.querySelectorAll('button, a[href], input, select, textarea, [onclick], [role="button"], .card, [tabindex]')];
    // Además, todo lo que el CSS marca como clicable (cursor: pointer).
    for (const el of document.querySelectorAll('body *')) {
      if (todos.includes(el)) continue;
      if (getComputedStyle(el).cursor === 'pointer' && (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer')) todos.push(el);
    }
    return todos.filter(el => !el.disabled && el.tagName !== 'CANVAS' && visible(el));
  }

  function centro(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function marcar(el) {
    if (foco) foco.classList.remove('gp-foco');
    foco = el;
    if (!el) return;
    el.classList.add('gp-foco');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function mover(dx, dy) {
    const lista = pulsables();
    if (!lista.length) { marcar(null); return; }
    if (!foco || !lista.includes(foco)) { marcar(lista[0]); return; }
    const o = centro(foco);
    let mejor = null, md = Infinity;
    for (const el of lista) {
      if (el === foco) continue;
      const c = centro(el), vx = c.x - o.x, vy = c.y - o.y;
      const along = vx * dx + vy * dy;           // avance en la dirección pedida
      if (along <= 2) continue;
      const cross = Math.abs(vx * dy - vy * dx); // desvío lateral
      const d = along + cross * 2.5;
      if (d < md) { md = d; mejor = el; }
    }
    if (mejor) marcar(mejor);
  }

  function menus(dt) {
    let dir = null;
    const v = stick(s.lx, s.ly, 0.5);
    if (s.btn.up || (v && v[1] < -0.7)) dir = [0, -1];
    else if (s.btn.down || (v && v[1] > 0.7)) dir = [0, 1];
    else if (s.btn.left || (v && v[0] < -0.7)) dir = [-1, 0];
    else if (s.btn.right || (v && v[0] > 0.7)) dir = [1, 0];

    const clave = dir && dir.join();
    if (clave && clave !== dirPrev) { mover(dir[0], dir[1]); repetirT = 0.38; }
    else if (clave) { repetirT -= dt; if (repetirT <= 0) { mover(dir[0], dir[1]); repetirT = 0.11; } }
    dirPrev = clave;

    if (foco && !document.contains(foco)) foco = null;
    if (pulsado('a')) {
      if (!foco || !visible(foco)) mover(0, 1);
      else if (/^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) foco.focus();
      else foco.click();
    }
    if (pulsado('b') || pulsado('start')) tecla('Escape');
  }

  // ---------------- bucle ----------------

  function poll(dt) {
    s = estado();
    const hay = Object.keys(s.btn).length || stick(s.lx, s.ly, DEAD) || stick(s.rx, s.ry, DEAD);
    if (hay && !usado) { usado = true; document.body.classList.add('gamepad'); }

    if (jugando()) {
      if (foco) marcar(null);
      if (pulsado('l1') || pulsado('l2')) tecla('KeyQ');
      if (pulsado('r1') || pulsado('r2')) tecla('KeyE');
      if (pulsado('start')) tecla('Escape');
    } else if (usado) {
      menus(dt || 0.016);
    }
    prev = { ...s.btn };
  }

  // Ratón en PC: mantener el clic izquierdo sobre el juego apunta al cursor.
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0 && e.target.tagName === 'CANVAS') ratonApunta = true; });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') ratonApunta = false; });
  addEventListener('blur', () => { ratonApunta = false; });

  // Anillo de foco para la navegación con mando.
  const css = document.createElement('style');
  css.textContent = '.gp-foco{outline:3px solid #ffd84a!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(255,216,74,.25)!important;border-radius:6px}';
  document.head.appendChild(css);

  return { nativo, poll, vector, aimAngle, targetInCone };
})();
