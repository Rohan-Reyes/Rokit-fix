// Injected into <head> BEFORE the page scripts: remember the real Web Serial support, then put a fake
// USB port (wired to the simulated Zumi) in its place so the page's own buttons can be driven end to end.
window.__real = { secure: window.isSecureContext, serial: 'serial' in navigator };
window.__log = [];
(function () {
  var sim = null, stream = null, pumpT = null;
  window.__getSim = function () { return sim; };
  var port = {
    open: async function (o) {
      if (!sim) sim = ZumiSim.makeZumi({ stayInBoot: true });   // first reset stays in the bootloader (flash)
      window.__log.push('open baud=' + o.baudRate);
      var s = sim;
      stream = new ReadableStream({
        start: function (c) { pumpT = setInterval(function () { var b = s.takeAll(); if (b.length) c.enqueue(new Uint8Array(b)); }, 2); },
        cancel: function () { clearInterval(pumpT); }
      });
    },
    close: async function () { clearInterval(pumpT); window.__log.push('close'); },
    setSignals: function (x) { return sim.io.setSignals(x); },
    get readable() { return stream; },
    writable: new WritableStream({ write: function (chunk) { return sim.io.write(chunk); } })
  };
  Object.defineProperty(navigator, 'serial', { configurable: true, value: {
    requestPort: async function () { window.__log.push('requestPort'); return port; },
    getPorts: async function () { return [port]; }
  } });
})();
