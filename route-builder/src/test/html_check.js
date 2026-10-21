// Check the built page the way a browser reads it: each <script> runs until the FIRST "</script".
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [];
let i = 0;
while (true) {
  const open = html.indexOf('<script', i);
  if (open < 0) break;
  const tagEnd = html.indexOf('>', open) + 1;
  const close = html.toLowerCase().indexOf('</script', tagEnd);
  blocks.push({ tag: html.slice(open, tagEnd), body: html.slice(tagEnd, close) });
  i = html.indexOf('>', close) + 1;
}
console.log('script elements seen by a browser:', blocks.map(b => b.tag).join(' '));
if (blocks.length !== 5) throw new Error('expected 5 script elements');
const tpl = JSON.parse(blocks[0].body);
const orig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'template.json'), 'utf8'));
if (JSON.stringify(tpl) !== JSON.stringify(orig)) throw new Error('template changed by inlining');
const ctx = {}; vm.createContext(ctx); vm.runInContext(blocks[3].body, ctx);
const core = ctx.ZumiCore;
const p = core.parseShorthand('5AR, 5AR, 2AR, B1, W2, F1, L, 2A F0.5 L, B1, W2, 5AL, 4A F0.5 LT');
const r = core.generate({ name: 'BT-full', steps: p.steps, settings: {} }, tpl);
const ref = fs.readFileSync(path.join(__dirname, 'BT-full.xml'), 'utf8');
console.log('inline template identical: yes; output identical to tested core:', r.xml === ref);
new Function(blocks[4].body); const sctx = {}; vm.createContext(sctx); vm.runInContext(blocks[2].body, sctx); const img = sctx.ZumiSerial.parseHex(blocks[1].body); console.log('embedded firmware parses:', img.length, 'bytes');
console.log('UI script parses: yes');
