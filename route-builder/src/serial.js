// Zumi direct upload over USB (Web Serial): flash the Route Player firmware (STK500v1 / optiboot, like
// Rokitbrick's avrdude -carduino -b115200), and send a route image to it.
// Works on any "io" object: { write(Uint8Array) -> Promise, readByte(ms) -> Promise<int|-1>, setSignals(obj) -> Promise, sleep(ms) }
(function (root) {
  'use strict';

  // ---------------- Intel HEX -> bytes ----------------
  function parseHex(text) {
    var mem = [], base = 0, max = 0, eof = false;
    String(text).split(/\r?\n/).forEach(function (line, n) {
      line = line.trim();
      if (!line) return;
      if (line[0] !== ':') throw new Error('hex line ' + (n + 1) + ': no colon');
      var b = [];
      for (var i = 1; i < line.length; i += 2) b.push(parseInt(line.substr(i, 2), 16));
      var sum = b.reduce(function (a, x) { return (a + x) & 255; }, 0);
      if (sum !== 0) throw new Error('hex line ' + (n + 1) + ': bad checksum');
      var len = b[0], addr = (b[1] << 8) | b[2], type = b[3];
      if (type === 0) {
        for (var k = 0; k < len; k++) { mem[base + addr + k] = b[4 + k]; max = Math.max(max, base + addr + k + 1); }
      } else if (type === 1) { eof = true; }
      else if (type === 2) { base = ((b[4] << 8) | b[5]) << 4; }
      else if (type === 4) { base = ((b[4] << 8) | b[5]) << 16; }
    });
    if (!eof) throw new Error('hex: no end record');
    var out = new Uint8Array(max);
    for (var j = 0; j < max; j++) out[j] = mem[j] === undefined ? 0xFF : mem[j];
    return out;
  }

  // ---------------- STK500v1 (optiboot) ----------------
  var PLAYER = 'ZRP4 READY';   // must match the Route Player firmware's hello line
  var OK = 0x10, INSYNC = 0x14, EOP = 0x20, PAGE = 128, SIG = [0x1E, 0x95, 0x0F];   // ATmega328P
  var FLASH_MAX = 30720;                                                              // below the bootloader

  async function reset(io) {   // like avrdude "arduino": drop DTR/RTS, raise them -> the board resets
    await io.setSignals({ dataTerminalReady: false, requestToSend: false });
    await io.sleep(250);
    await io.setSignals({ dataTerminalReady: true, requestToSend: true });
    await io.sleep(50);
  }
  async function drain(io) { while ((await io.readByte(20)) >= 0) {} }
  async function expect(io, n, ms) {   // INSYNC, n bytes, OK
    var a = await io.readByte(ms || 500);
    if (a !== INSYNC) throw new Error('no reply from bootloader (got ' + a + ')');
    var data = [];
    for (var i = 0; i < n; i++) { var x = await io.readByte(ms || 500); if (x < 0) throw new Error('bootloader reply cut short'); data.push(x); }
    var z = await io.readByte(ms || 500);
    if (z !== OK) throw new Error('bootloader did not confirm (got ' + z + ')');
    return data;
  }
  async function cmd(io, bytes, n, ms) { await io.write(new Uint8Array(bytes)); return expect(io, n || 0, ms); }

  async function flash(io, image, progress) {
    progress = progress || function () {};
    if (image.length > FLASH_MAX) throw new Error('program too big');
    progress('Resetting the Zumi...', 0);
    await reset(io);
    var synced = false;
    for (var t = 0; t < 12 && !synced; t++) {
      await drain(io);
      try { await cmd(io, [0x30, EOP], 0, 200); synced = true; } catch (e) { await io.sleep(50); }
    }
    if (!synced) throw new Error('Zumi bootloader not found. Check the cable / COM port, switch the Zumi on, and try again.');
    var sig = await cmd(io, [0x75, EOP], 3);
    if (sig.join() !== SIG.join()) throw new Error('This is not an ATmega328P board (signature ' + sig.map(function (x) { return x.toString(16); }).join(' ') + ').');
    await cmd(io, [0x50, EOP]);                                  // enter programming mode
    var pages = Math.ceil(image.length / PAGE);
    function page(p) { var d = new Uint8Array(PAGE).fill(0xFF); d.set(image.subarray(p * PAGE, Math.min(image.length, (p + 1) * PAGE))); return d; }
    function load(p) { var w = (p * PAGE) >> 1; return cmd(io, [0x55, w & 255, (w >> 8) & 255, EOP]); }
    for (var p = 0; p < pages; p++) {
      await load(p);
      var pkt = new Uint8Array(5 + PAGE);
      pkt.set([0x64, 0x00, PAGE, 0x46]); pkt.set(page(p), 4); pkt[4 + PAGE] = EOP;
      await io.write(pkt); await expect(io, 0, 1000);
      progress('Writing ' + (p + 1) + ' / ' + pages, (p + 1) / pages * 0.8);
    }
    for (var q = 0; q < pages; q++) {                            // verify
      await load(q);
      var got = await cmd(io, [0x74, 0x00, PAGE, 0x46, EOP], PAGE, 1000);
      var want = page(q);
      for (var i = 0; i < PAGE; i++) if (got[i] !== want[i]) throw new Error('verify failed at byte ' + (q * PAGE + i));
      progress('Checking ' + (q + 1) + ' / ' + pages, 0.8 + (q + 1) / pages * 0.2);
    }
    await cmd(io, [0x51, EOP]);                                  // leave programming mode -> program starts
    progress('Done', 1);
    return pages * PAGE;
  }

  // ---------------- route upload to the Route Player ----------------
  async function readLine(io, ms) {
    var s = '', end = Date.now() + ms;
    while (Date.now() < end) {
      var b = await io.readByte(Math.max(1, end - Date.now()));
      if (b < 0) break;
      if (b === 10) return s.replace(/\r$/, '');
      s += String.fromCharCode(b);
    }
    return s.length ? s : null;
  }
  async function waitFor(io, text, ms) {
    var end = Date.now() + ms, line;
    while (Date.now() < end) {
      line = await readLine(io, end - Date.now());
      if (line !== null && line.indexOf(text) >= 0) return line;
    }
    return null;
  }
  async function uploadRoute(io, bytes, progress) {
    progress = progress || function () {};
    progress('Restarting the Zumi...', 0);
    await reset(io);
    // bootloader waits ~1 s, then the Route Player says hello and listens 1.5 s
    var hello = await waitFor(io, ' READY', 4000);
    if (!hello || hello.indexOf('ZRP') < 0)
      throw new Error('Route Player not found on the Zumi. Press "Install Route Player" first (once).');
    if (hello.indexOf(PLAYER) < 0)
      throw new Error('The Route Player on the Zumi is an older version. Press "Install Route Player" once to update it.');
    await io.write(new Uint8Array([0x5A, 0x55, bytes.length & 255, (bytes.length >> 8) & 255]));
    if ((await io.readByte(1000)) !== 0x41) throw new Error('Zumi did not accept the upload.');
    for (var i = 0; i < bytes.length; i += 16) {
      var chunk = bytes.slice(i, i + 16);
      await io.write(new Uint8Array(chunk));
      if ((await io.readByte(1500)) !== 0x2E) throw new Error('Upload interrupted at byte ' + i + '.');
      progress('Sending ' + Math.min(bytes.length, i + 16) + ' / ' + bytes.length + ' bytes', Math.min(1, (i + 16) / bytes.length));
    }
    var res = await waitFor(io, 'OK', 2000);
    if (!res) throw new Error('Zumi reported a problem saving the route.');
    return res;
  }

  // ---------------- Web Serial transport ----------------
  function webSerialIO(port) {
    var queue = [], waiters = [], reader = null, closed = false;
    function push(b) { if (waiters.length) waiters.shift()(b); else queue.push(b); }
    (async function pump() {
      try {
        reader = port.readable.getReader();
        while (!closed) {
          var r = await reader.read();
          if (r.done) break;
          for (var i = 0; i < r.value.length; i++) push(r.value[i]);
        }
      } catch (e) { /* port closed */ }
    })();
    return {
      write: async function (u8) { var w = port.writable.getWriter(); try { await w.write(u8); } finally { w.releaseLock(); } },
      readByte: function (ms) {
        if (queue.length) return Promise.resolve(queue.shift());
        return new Promise(function (res) {
          var done = false;
          var f = function (b) { if (!done) { done = true; clearTimeout(t); res(b); } };
          var t = setTimeout(function () { if (!done) { done = true; var k = waiters.indexOf(f); if (k >= 0) waiters.splice(k, 1); res(-1); } }, ms);
          waiters.push(f);
        });
      },
      setSignals: function (s) { return port.setSignals(s); },
      sleep: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
      close: async function () { closed = true; try { if (reader) { await reader.cancel(); reader.releaseLock(); } } catch (e) {} try { await port.close(); } catch (e) {} }
    };
  }

  var api = { parseHex: parseHex, flash: flash, uploadRoute: uploadRoute, webSerialIO: webSerialIO, PAGE: PAGE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZumiSerial = api;
})(this);
