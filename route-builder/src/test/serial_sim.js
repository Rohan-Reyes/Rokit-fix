// Simulated Zumi on a fake serial line: optiboot bootloader (STK500v1) + the Route Player's upload
// receiver (a line-by-line JS mirror of receiveUpload()/imageValid() in ZumiRoutePlayer.ino).
const fs = require('fs'), path = require('path');
const ser = require('../serial.js'), core = require('../core.js');

const { makeZumi } = require('./zumi_sim.js');
(async () => {
  const hex = fs.readFileSync(path.join(__dirname, '..', 'fwbuild', 'ZumiRoutePlayer.ino.hex'), 'utf8');
  const img = ser.parseHex(hex);
  console.log('firmware bytes:', img.length);

  // 1. flash the Route Player
  const z = makeZumi({ stayInBoot: true });
  const n = await ser.flash(z.io, img, () => {});
  const same = img.every((b, i) => z.flashMem[i] === b);
  console.log('flash: wrote', n, 'bytes, flash matches firmware:', same, 'player running:', z.installed);

  // 2. upload a route
  const p = core.parseShorthand('5AR, 5AR300, 2IR, B1, W2, F1, L, 2AL0, B1, W0.5, 5IL, 4A F0.5 LT');
  const enc = core.encodeImage({ steps: p.steps, settings: { secPerBlock: 1.05, gapMs: 650 } });
  const res = await ser.uploadRoute(z.io, enc.bytes, () => {});
  const eeOk = enc.bytes.every((b, i) => z.eeprom[i] === b);
  console.log('route upload:', res, '| EEPROM == image:', eeOk, '|', enc.ops.length, 'moves,', enc.bytes.length, 'bytes');

  // decode EEPROM like the firmware does
  const ee = z.eeprom, s16 = a => { const v = ee[a] | (ee[a + 1] << 8); return v > 32767 ? v - 65536 : v; };
  console.log('decoded settings:', Array.from({ length: 13 }, (_, i) => s16(4 + 2 * i)).join(','));
  const nOps = ee[30], ops = [];
  for (let k = 0; k < nOps; k++) ops.push(ee[31 + 3 * k] + ':' + (ee[32 + 3 * k] | (ee[33 + 3 * k] << 8)));
  console.log('decoded moves:', ops.join(' '));

  // 3. failure cases
  for (const [label, o, fn] of [
    ['no board', { dead: true }, zz => ser.flash(zz.io, img, () => {})],
    ['player missing', { playerInstalled: false }, zz => ser.uploadRoute(zz.io, enc.bytes, () => {})],
    ['old v3 player', { playerInstalled: true, oldPlayer: true }, zz => ser.uploadRoute(zz.io, enc.bytes, () => {})],
    ['corrupted upload (1 bit)', { playerInstalled: true, corrupt: 'one' }, zz => ser.uploadRoute(zz.io, enc.bytes, () => {})],
    ['corrupted upload (4 bits)', { playerInstalled: true, corrupt: 'many' }, zz => ser.uploadRoute(zz.io, enc.bytes, () => {})],
  ]) {
    const zz = makeZumi(o);
    try { const rr = await fn(zz); console.log(label, '-> UNEXPECTED SUCCESS', JSON.stringify(rr), zz.eeprom.slice(0, 4)); }
    catch (e) { console.log(label, '->', e.message, label.startsWith('corrupted') ? '| old route invalid now: ' + (zz.eeprom[0] !== 0x5A) : ''); }
  }
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
