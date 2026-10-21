// gapMs / per-step gap / secPerBlock (float header) checks
const core = require('../core.js'), fs = require('fs'), path = require('path');
const tpl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'template.json'), 'utf8'));
const show = s => s.map(x => x.type + ':' + x.value + (x.gap !== undefined ? '/gap' + x.gap : '')).join(' ');
console.log('parse:', show(core.parseShorthand('5AR 5AR300 A3L250 5AR0 5IR 2AL F1.5 B0.5').steps));
const cases = [
  ['BT-v2', '5AR 5AR300 5AR0 5IR 2AL W0.75 F1.5 B0.5', { gapMs: 650, secPerBlock: 1.05 }],
  ['BT-v2-nofwd', '3IR 3IL', {}],
  ['BT-v2-onlygap', '3AR300', {}],
];
for (const [name, sh, set] of cases) {
  const p = core.parseShorthand(sh); if (p.errors.length) throw new Error(p.errors);
  const r = core.generate({ name, steps: p.steps, settings: set }, tpl);
  if (!r.ok) throw new Error(name + ': ' + r.errors);
  fs.writeFileSync(path.join(__dirname, name + '.xml'), r.xml);
  console.log(name, '| hats:', r.hats.join(','), '| float header:', r.xml.includes('float secPerBlock'), '| gapMs declared:', r.vars.includes('gapMs'));
}
const bad = (st, se) => core.generate({ steps: core.parseShorthand(st).steps, settings: se || {} }, tpl).errors;
console.log('bad gap 6000 ->', bad('5AR6000'));
console.log('bad secPerBlock 1.234 ->', bad('F1', { secPerBlock: 1.234 }));
console.log('bad gapMs 2.5 ->', bad('5AR', { gapMs: 2.5 }));
const enc = core.encodeImage({ steps: core.parseShorthand('5AR 5AR300 5AR0 F1.5').steps, settings: { secPerBlock: 1.05, gapMs: 650 } });
console.log('image ops:', enc.ops.map(o => o.join(':')).join(' '), '| settings[1] (secPerBlock ms) =', enc.bytes[6] | (enc.bytes[7] << 8), '| gapMs =', enc.bytes[28] | (enc.bytes[29] << 8), '| version', enc.bytes[2], 'n', enc.bytes[3]);
