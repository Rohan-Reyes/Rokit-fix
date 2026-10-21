// Simulated Zumi (optiboot + Route Player upload receiver). Works in Node and in the browser.
(function (root) {
  let crc8;
function makeZumi(opts) {
  opts = opts || {};
  const flashMem = new Uint8Array(32768).fill(0xFF), eeprom = new Uint8Array(1024).fill(0xFF);
  let mode = 'off', inbuf = [], toHost = [], addr = 0, playerInstalled = !!opts.playerInstalled;
  let up = null;                                 // Route Player upload state
  const reply = (...b) => toHost.push(...b);
  function bootloader() {                        // consume complete STK500 commands from inbuf
    while (inbuf.length) {
      const c = inbuf[0];
      const need = { 0x30: 2, 0x75: 2, 0x50: 2, 0x51: 2, 0x55: 4, 0x64: 5 + 128, 0x74: 5 }[c];
      if (!need) { inbuf.shift(); continue; }
      if (inbuf.length < need) return;
      const p = inbuf.splice(0, need);
      if (p[need - 1] !== 0x20) { reply(0x15); continue; }
      if (c === 0x75) reply(0x14, 0x1E, 0x95, 0x0F, 0x10);
      else if (c === 0x55) { addr = (p[1] | (p[2] << 8)) * 2; reply(0x14, 0x10); }
      else if (c === 0x64) { flashMem.set(p.slice(4, 4 + 128), addr); reply(0x14, 0x10); }
      else if (c === 0x74) { reply(0x14, ...flashMem.slice(addr, addr + 128), 0x10); }
      else if (c === 0x51) { reply(0x14, 0x10); playerInstalled = true; startSketch(); }
      else reply(0x14, 0x10);
    }
  }
  function imageValid() {
    if (eeprom[0] !== 0x5A || eeprom[1] !== 0x52 || eeprom[2] !== 4 || eeprom[3] !== 13) return 0;
    const at = 4 + 26, len = at + 1 + 3 * eeprom[at];
    if (len + 1 > 900) return 0;
    return crc8(Array.from(eeprom.slice(0, len))) === eeprom[len] ? len + 1 : 0;
  }
  const line = s => reply(...Array.from(s + '\r\n', ch => ch.charCodeAt(0)));
  function startSketch() { mode = 'sketch'; up = { st: 'wait' }; inbuf = []; if (playerInstalled) line(opts.oldPlayer ? 'ZRP3 READY' : 'ZRP4 READY'); }
  function sketch() {
    while (inbuf.length) {
      const b = inbuf.shift();
      if (up.st === 'wait') { if (b === 0x5A) up.st = 'Z'; }
      else if (up.st === 'Z') { up.st = b === 0x55 ? 'lo' : 'wait'; }
      else if (up.st === 'lo') { up.lo = b; up.st = 'hi'; }
      else if (up.st === 'hi') {
        up.len = up.lo | (b << 8);
        if (up.len < 6 || up.len > 900) { line('ERR length'); up.st = 'halt'; continue; }
        eeprom[0] = 0; reply(0x41); up.i = 0; up.st = 'data';
      } else if (up.st === 'data') {
        if (up.i === 0) up.f0 = b; else if (up.i === 1) up.f1 = b; else eeprom[up.i] = b;
        if ((up.i & 15) === 15 || up.i === up.len - 1) reply(0x2E);
        up.i++;
        if (up.i === up.len) {
          eeprom[1] = up.f1; eeprom[0] = up.f0;
          if (imageValid() === up.len) line('OK ' + up.len); else { eeprom[0] = 0; line('ERR checksum'); }
          line('SAVED - unplug, then switch on to run'); up.st = 'halt';
        }
      }
    }
  }
  let dtr = true;
  return {
    flashMem, eeprom, get installed() { return playerInstalled; },
    takeAll: () => toHost.splice(0, toHost.length),
    io: {
      write: async u8 => { if (opts.corrupt && mode === 'sketch' && up.st === 'data' && up.i > 20 && (opts.corrupt === 'many' || !opts.flipped)) { opts.flipped = true;  u8 = u8.map((x, k) => k === 0 ? x ^ 1 : x); } inbuf.push(...u8); mode === 'boot' ? bootloader() : mode === 'sketch' ? sketch() : 0; },
      readByte: async ms => {
        if (toHost.length) return toHost.shift();
        await new Promise(r => setTimeout(r, Math.min(ms, 5)));
        return toHost.length ? toHost.shift() : -1;
      },
      setSignals: async s => {
        if (!dtr && s.dataTerminalReady) {              // rising DTR -> reset -> bootloader (or no response if dead)
          mode = opts.dead ? 'off' : 'boot'; inbuf = []; toHost = [];
          if (!opts.dead) setTimeout(() => { if (mode === 'boot' && !opts.stayInBoot) startSketch(); opts.stayInBoot = false; }, opts.bootMs || 300);
        }
        dtr = !!s.dataTerminalReady;
      },
      sleep: ms => new Promise(r => setTimeout(r, ms)),
    },
  };
}

  const api = { makeZumi: (o) => { crc8 = (root.ZumiCore || require('../core.js')).crc8; return makeZumi(o); } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZumiSim = api;
})(this);
