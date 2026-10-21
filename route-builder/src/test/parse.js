const core = require('../core.js');
const show = s => s.map(x => x.type + (x.value !== undefined ? ':' + x.value : '')).join(' ');
const cases = {
  '1A 2A 3A 4A 5A 12A': 'across:1 across:2 across:3 across:4 across:5 across:12',
  '1A-5A': 'across:1 across:5',
  '5AR,5AL': 'acrossR:5 acrossL:5',
  '5IR 5IL': 'acrossIR:5 acrossIL:5',
  '5AIR': 'acrossIR:5',
  'A5R A5IL': 'acrossR:5 acrossIL:5',
  '5AR-5AR-2IR-B1-W2': 'acrossR:5 acrossR:5 acrossIR:2 back:1 wait:2',
  'W0.5 W10 W.5 W 2 W100': 'wait:0.5 wait:10 wait:0.5 wait:2 wait:100',
  'T-45 T 90 T -30': 'turn:-45 turn:90 turn:-30',
  'W2-5A': 'wait:2 across:5',
  '5a r': 'across:5 right',
  'f1.5 b0.5 lt lt 900 U': 'fwd:1.5 back:0.5 line:0 line:900 uturn',
};
let bad = 0;
for (const [inp, want] of Object.entries(cases)) {
  const p = core.parseShorthand(inp); const got = show(p.steps) + (p.errors.length ? ' ERR:' + p.errors : '');
  const ok = got === want; if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + JSON.stringify(inp).padEnd(26) + ' -> ' + got);
}
console.log('errors for junk:', core.parseShorthand('5X Q W').errors);
process.exit(bad ? 1 : 0);
