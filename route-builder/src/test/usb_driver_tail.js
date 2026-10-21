window.addEventListener('load', async function () {
  var out = [], $ = function (id) { return document.getElementById(id); };
  function log(k, v) { out.push(k + ' = ' + v); }
  function show() {
    var pre = document.getElementById('TESTOUT') || document.createElement('pre');
    pre.id = 'TESTOUT';
    pre.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9;background:#fff;color:#000;font:14px monospace;padding:8px;margin:0;white-space:pre-wrap;border-bottom:3px solid red';
    pre.textContent = out.join('\n'); document.body.appendChild(pre);
  }
  function until(fn, ms) {
    return new Promise(function (res) {
      var t0 = Date.now(), iv = setInterval(function () { if (fn() || Date.now() - t0 > ms) { clearInterval(iv); res(fn()); } }, 20);
    });
  }
  try {
    log('REAL browser: file:// is secure context', window.__real.secure);
    log('REAL browser: Web Serial available', window.__real.serial);
    log('usb section visible', !$('usbBox').hidden);
    $('short').value = '5AR, 5AR, 2IR, B1, W2, F1, L, 2AL, B1, W0.5, 5IL, 4A F0.5 LT';
    $('shortReplace').click();
    log('upload button enabled', !$('usbUpload').disabled);

    $('usbInstall').click();
    var okI = await until(function () { return /installed/.test($('usbMsg').textContent) || /bad/.test(($('usbMsg').firstChild || {}).className || ''); }, 60000);
    log('install message', $('usbMsg').textContent);
    var sim = window.__getSim();
    var img = ZumiSerial.parseHex(document.getElementById('fwhex').textContent);
    log('flash matches firmware', img.every(function (b, i) { return sim.flashMem[i] === b; }));

    await until(function () { return !$('usbUpload').disabled; }, 5000);
    $('usbUpload').click();
    await until(function () { return /Saved|bad/.test($('usbMsg').textContent + (($('usbMsg').firstChild || {}).className || '')); }, 30000);
    log('upload message', $('usbMsg').textContent);
    var enc = ZumiCore.encodeImage({ steps: ZumiCore.parseShorthand($('short').value).steps, settings: {} });
    log('EEPROM == route image', enc.bytes.every(function (b, i) { return sim.eeprom[i] === b; }) + ' (' + enc.bytes.length + ' bytes)');

    // error path: invalid setting blocks upload before touching the port
    var s = document.querySelector('#settings input[aria-label=BL]'); s.value = '999'; s.dispatchEvent(new Event('input'));
    log('upload disabled on bad setting', $('usbUpload').disabled);
    log('port calls', window.__log.join(', '));
  } catch (e) { log('EXCEPTION', e && e.stack); }
  show();
});
