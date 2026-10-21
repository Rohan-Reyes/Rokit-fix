const core = require('../core.js'); const fs = require('fs'); const path = require('path');
const tpl = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'template.json'), 'utf8'));
const cases = {
  'BT-full': '5AR, 5AR, 2AR, B1, W2, F1, L, 2A F0.5 L, B1, W2, 5AL, 4A F0.5 LT',
  'BT-turns': 'R L U T45 W1.5',
  'BT-line': 'F2.5 LT900 B0.5',
};
for (const [name, sh] of Object.entries(cases)) {
  const p = core.parseShorthand(sh);
  if (p.errors.length) throw new Error(name + ' parse errors ' + p.errors);
  const r = core.generate({ name, steps: p.steps, settings: {} }, tpl);
  if (!r.ok) throw new Error(name + ' ' + r.errors);
  fs.writeFileSync(path.join(__dirname, name + '.xml'), r.xml);
  console.log(name, p.steps.length, 'steps, hats:', r.hats.join(','), 'blocks:', r.blocks);
}
// error cases
const bad = core.generate({ steps: [{ type: 'fwd', value: 1.3 }, { type: 'across', value: 2.5 }], settings: { acrossSpeed: 300 } }, tpl);
console.log('bad ->', bad.ok, bad.errors);
console.log('unknown token ->', core.parseShorthand('5AR XQ F1').errors);
