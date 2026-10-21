// Zumi route builder core: steps + settings -> Rokitbrick 1.2.7 project XML, or a route image for the Route Player.
// Move scripts come verbatim from a robot-tested project (template.json); only the main script is built here.
(function (root) {
  'use strict';

  var SETTINGS = [
    // key, default, min, max, used by, note, decimals allowed
    ['straightSpeed', 160, 60, 220, 'drive', 'Speed for forward / backward blocks and the gap move. Keep 160: secPerBlock was measured at 160.'],
    ['secPerBlock', 1, 0.1, 10, 'perBlock', 'Seconds to cross ONE grid block at straightSpeed (1 = 1 s at 160). Decimals OK (1.05). Raise if Forward stops short, lower if too far.', true],
    ['acrossSpeed', 200, 60, 230, 'across', 'Speed for Across. Lower if it misses blocks or stops too far past the last one.'],
    ['steerStrength', 8, 1, 30, 'steer', 'Straight-line steering per degree off. Raise (10-12) if it veers, lower (5) if it wiggles.'],
    ['traceCs', 810, 10, 30000, 'lineTrace', 'Line trace: follow time in 1/100 s (810 = 8.1 s) after the line is found, then it stops.'],
    ['BL', 100, 0, 255, 'sensors', 'Left bottom sensor threshold. Line trace: ABOVE this = on the black line. Across: BELOW this = white block, above BL + 30 = black again.'],
    ['BR', 100, 0, 255, 'sensors', 'Right bottom sensor threshold. Line trace: ABOVE this = on the black line. Across: BELOW this = white block, above BR + 30 = black again.'],
    ['spdStraight', 150, 0, 255, 'lineTrace', 'Line trace: speed when BOTH sensors are on the line (Default_values: 150; In-OutV4: 120).'],
    ['spdFast', 175, 0, 255, 'lineTrace', 'Line trace: outer wheel while correcting (Default_values: 175; In-OutV4: 135).'],
    ['spdSlow', 110, 0, 255, 'lineTrace', 'Line trace: inner wheel while correcting, and speed while finding the line at the start (Default_values: 110; In-OutV4: 90).'],
    ['spdPivot', 110, 0, 255, 'lineTrace', 'Line trace: line lost after a correction - this wheel turns, the other stops (Default_values: 110; In-OutV4: 90).'],
    ['lostSpd', 30, 0, 255, 'lineTrace', 'Line trace: both sensors lost the line, no side known - creep at this speed (30; 0 = stop silently).'],
    ['gapMs', 650, 0, 5000, 'gap', 'Gap for 5AR / 5AL: drive forward this long after the Across, before turning, in ms (650 = 0.65 s). A step like 5AR300 uses its own gap.']
  ];
  // the route from Default_values.xml (robot-tuned), loaded when the page is opened for the first time
  var DEFAULT_ROUTE = '5AR650, 5AR650, 5AL650, 5AL650, 4A, M0.5, LT820, W2, R, LT820';
  var GAP_MAX = 5000;

  // variables each move script reads/writes (all Zumi variables are 16-bit whole numbers, except secPerBlock)
  var HAT_VARS = {
    turn: ['targetHeading', 'headingError'],
    straight: ['targetHeading', 'headingError', 'startTime', 'straightTime', 'straightSpeed', 'errorSum', 'correction', 'steerStrength'],
    back: ['targetHeading', 'headingError', 'startTime', 'straightTime', 'straightSpeed', 'correction', 'steerStrength'],
    across: ['targetHeading', 'headingError', 'acrossBlocks', 'acrossSpeed', 'blocksSeen', 'onWhite', 'errorSum', 'correction', 'steerStrength', 'BL', 'BR'],
    lineTrace: ['traceCs', 'BL', 'BR', 'spdStraight', 'spdFast', 'spdSlow', 'spdPivot', 'lostSpd', 'S_BL', 'S_BR', 'prev', 'currrent', 'lastTurn']
  };
  var HAT_ORDER = ['turn', 'straight', 'back', 'across', 'lineTrace'];
  // secPerBlock holds decimals, so it is declared as a C float through the project's code header for the
  // "script variables" block (Rokitbrick puts that header above setup()); every other variable stays int.
  var FLOAT_HEADER = '<headers><doDeclareVariables>float secPerBlock = 1;</doDeclareVariables></headers>';

  // step types: what the user picks
  var STEP_TYPES = {
    across: { label: 'Across', unit: 'blocks', def: 5, min: 1, max: 30, step: 1, hats: ['across'] },
    acrossR: { label: 'Across + gap + Right 90', unit: 'blocks', def: 5, min: 1, max: 30, step: 1, hats: ['across', 'straight', 'turn'], gap: true },
    acrossL: { label: 'Across + gap + Left 90', unit: 'blocks', def: 5, min: 1, max: 30, step: 1, hats: ['across', 'straight', 'turn'], gap: true },
    acrossIR: { label: 'Across + in-place Right 90', unit: 'blocks', def: 5, min: 1, max: 30, step: 1, hats: ['across', 'turn'] },
    acrossIL: { label: 'Across + in-place Left 90', unit: 'blocks', def: 5, min: 1, max: 30, step: 1, hats: ['across', 'turn'] },
    fwd: { label: 'Forward', unit: 'blocks', def: 1, min: 0.5, max: 20, step: 0.5, hats: ['straight'], perBlock: true },
    back: { label: 'Backward', unit: 'blocks', def: 1, min: 0.5, max: 20, step: 0.5, hats: ['back'], perBlock: true },
    right: { label: 'Turn right 90', hats: ['turn'] },
    left: { label: 'Turn left 90', hats: ['turn'] },
    uturn: { label: 'U-turn 180', hats: ['turn'] },
    turn: { label: 'Turn (degrees, + = right)', unit: 'deg', def: 45, min: -180, max: 180, step: 1, hats: ['turn'] },
    wait: { label: 'Wait', unit: 'sec', def: 2, min: 0.01, max: 600, step: 0.01, hats: [] },
    move: { label: 'Move forward (no gyro, keeps rolling)', unit: 'sec', def: 0.5, min: 0.01, max: 30, step: 0.01, hats: [], move: true },
    line: { label: 'Line trace', unit: '1/100 s', def: 0, min: 0, max: 30000, step: 10, hats: ['lineTrace'], optional: true }
  };

  // ---------------- tiny XML builders (same forms as the Python generators) ----------------
  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(n) { // Snap writes numbers as plain text
    var s = String(n);
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('not a number: ' + n);
    return s;
  }
  function lit(v) { return '<l>' + esc(v) + '</l>'; }
  function V(name) { return '<block var="' + name + '"/>'; }
  function setLit(name, v) { return '<block s="doSetVar">' + lit(name) + lit(num(v)) + '</block>'; }
  function setRep(name, rep) { return '<block s="doSetVar">' + lit(name) + rep + '</block>'; }
  function chg(name, v) { return '<block s="doChangeVar">' + lit(name) + lit(num(v)) + '</block>'; }
  function times(a, b) { return '<block s="reportProduct">' + a + b + '</block>'; }
  function quot(a, b) { return '<block s="reportQuotient">' + a + b + '</block>'; }
  function N(n) { return lit(num(n)); }
  function bc(msg) { return '<block s="doBroadcastAndWait">' + lit(msg) + '</block>'; }
  function wait(s) { return '<block s="doWait">' + lit(num(s)) + '</block>'; }
  function decl(names) {
    return '<block s="doDeclareVariables"><list>' + names.map(lit).join('') + '</list></block>';
  }
  var GO = '<block s="receiveGo"></block>';
  var STOP = '<block s="zumiDCmotor"><l><option>M1</option></l><l><option>STOP</option></l><l>0</l></block>' +
             '<block s="zumiDCmotor"><l><option>M2</option></l><l><option>STOP</option></l><l>0</l></block>';
  var HEADING = '<block s="doSetVar"><l>targetHeading</l><block s="reportRound"><block s="eulerAngle"><l><option>YAW</option></l></block></block></block>';
  function note(blockXml, text, collapsed, w) { // attach a comment bubble to a block
    if (blockXml.slice(-8) !== '</block>') throw new Error('note needs a block');
    return blockXml.slice(0, -8) + '<comment w="' + (w || 260) + '" collapsed="' + (collapsed ? 'true' : 'false') + '">' +
      esc(text) + '</comment></block>';
  }

  // ---------------- shorthand: "5AR, 5AR300, 2IR, B1, W2, F1, L, 2AL, B1, W2, 5IL, 4A F0.5 LT" ----------------
  // 5A = across 5 | 5AR/5AL = across 5, forward gapMs, turn | 5AR300 = same with a 300 ms gap | 5IR/5IL = across 5, turn in place
  var ACROSS_KIND = { '': 'across', R: 'acrossR', L: 'acrossL', IR: 'acrossIR', IL: 'acrossIL' };
  function parseShorthand(text) {
    var steps = [], errors = [];
    var src = String(text).toUpperCase()
      .replace(/\b([FBWTM])\s+(-?\s*\d*\.?\d)/g, function (_, a, b) { return a + b.replace(/\s+/g, ''); }) // "W 2" -> "W2", "T -45" -> "T-45"
      .replace(/\bLT\s+(\d)/g, 'LT$1')               // "LT 900" -> "LT900"
      .replace(/(^|[^T\d])-/g, '$1 ')               // dashes separate steps ("5AR-5AR-2IR"); "T-45" keeps its minus
      .replace(/(\d)-(?=\d*\.?\d*[A-Z])/g, '$1 ');   // "W2-5A", "1A-5A" -> separate steps
    var tokens = src.replace(/[;,\n]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    tokens.forEach(function (t) {
      var m;
      if ((m = t.match(/^(\d+)A([RL])(\d+)$/)) || (m = t.match(/^A(\d+)([RL])(\d+)$/))) {   // 5AR300 / A5R300: own gap in ms
        steps.push({ type: ACROSS_KIND[m[2]], value: +m[1], gap: +m[3] });
      } else if ((m = t.match(/^(\d+)(?:A(I?[RL])?|(I[RL]))$/))) {          // 5A 5AR 5AL 5AIR 5IR 5IL
        steps.push({ type: ACROSS_KIND[m[3] || m[2] || ''], value: +m[1] });
      } else if ((m = t.match(/^A(\d+)(I?[RL])?$/))) {                // A5 A5R A5IR
        steps.push({ type: ACROSS_KIND[m[2] || ''], value: +m[1] });
      } else if ((m = t.match(/^F(\d*\.?\d+)$/))) {
        steps.push({ type: 'fwd', value: +m[1] });
      } else if ((m = t.match(/^B(\d*\.?\d+)$/))) {
        steps.push({ type: 'back', value: +m[1] });
      } else if ((m = t.match(/^W(\d*\.?\d+)$/))) {
        steps.push({ type: 'wait', value: +m[1] });
      } else if ((m = t.match(/^M(\d*\.?\d+)$/))) {                  // M0.5 = Move forward 160 + wait 0.5 (no stop)
        steps.push({ type: 'move', value: +m[1] });
      } else if ((m = t.match(/^T(-?\d+)$/))) {
        steps.push({ type: 'turn', value: +m[1] });
      } else if ((m = t.match(/^LT(\d+)?$/))) {
        steps.push({ type: 'line', value: m[1] ? +m[1] : 0 });
      } else if (t === 'R') {
        steps.push({ type: 'right' });
      } else if (t === 'L') {
        steps.push({ type: 'left' });
      } else if (t === 'U') {
        steps.push({ type: 'uturn' });
      } else {
        errors.push(t);
      }
    });
    return { steps: steps, errors: errors };
  }

  function hasGap(s) { return s.gap !== undefined && s.gap !== null && s.gap !== ''; }
  var gapLabel = 650, moveLabel = 160;   // gapMs / straightSpeed settings, for step labels
  function stepText(s) {
    var T = STEP_TYPES[s.type];
    if (s.type === 'acrossR' || s.type === 'acrossL')
      return 'Across ' + s.value + ', forward ' + (hasGap(s) ? s.gap + ' ms' : gapLabel + ' ms (gapMs)') +
        ', turn ' + (s.type === 'acrossR' ? 'right' : 'left') + ' 90';
    if (s.type === 'acrossIR' || s.type === 'acrossIL')
      return 'Across ' + s.value + ', stop, turn ' + (s.type === 'acrossIR' ? 'right' : 'left') + ' 90 in place';
    if (!T.unit) return T.label;
    if (s.type === 'line') return s.value ? 'Line trace ' + s.value + ' (1/100 s)' : 'Line trace (traceCs)';
    if (s.type === 'move') return 'Move forward ' + moveLabel + ' for ' + s.value + ' s (no gyro, keeps rolling)';
    return T.label + ' ' + s.value + ' ' + T.unit;
  }

  // ---------------- validation ----------------
  function checkStep(s, i) {
    var T = STEP_TYPES[s.type];
    if (!T) return 'Step ' + (i + 1) + ': unknown step type';
    if (T.gap && hasGap(s)) {
      var g = Number(s.gap);
      if (!isFinite(g) || g !== Math.round(g) || g < 0 || g > GAP_MAX)
        return 'Step ' + (i + 1) + ' (' + T.label + '): gap must be a whole number of ms, 0 to ' + GAP_MAX + ' (empty = gapMs)';
    }
    if (!T.unit) return null;
    var v = Number(s.value);
    if (!isFinite(v)) return 'Step ' + (i + 1) + ' (' + T.label + '): value is not a number';
    if (s.type === 'line' && v === 0) return null;
    if (v < T.min || v > T.max) return 'Step ' + (i + 1) + ' (' + T.label + '): must be ' + T.min + ' to ' + T.max;
    if (T.step === 1 && v !== Math.round(v)) return 'Step ' + (i + 1) + ' (' + T.label + '): whole numbers only';
    if (T.step === 0.5 && v * 2 !== Math.round(v * 2)) return 'Step ' + (i + 1) + ' (' + T.label + '): use 0.5 steps';
    return null;
  }
  function settingValue(settings, row) {
    var x = settings[row[0]];
    return x === undefined || x === '' ? row[1] : Number(x);
  }
  function checkSetting(row, v) {
    if (!isFinite(v)) return row[0] + ': number needed';
    if (row[6]) { if (Math.abs(v * 100 - Math.round(v * 100)) > 1e-9) return row[0] + ': at most 2 decimals'; }
    else if (v !== Math.round(v)) return row[0] + ': whole number needed';
    if (v < row[2] || v > row[3]) return row[0] + ': must be ' + row[2] + ' to ' + row[3];
    return null;
  }

  // ---------------- main generator ----------------
  function generate(opts, tpl) {
    var steps = opts.steps || [], settings = opts.settings || {};
    var name = String(opts.name || 'Zumi-Route').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'Zumi-Route';
    var errs = [];
    steps.forEach(function (s, i) { var e = checkStep(s, i); if (e) errs.push(e); });
    if (!steps.length) errs.push('Add at least one step.');

    // which move scripts / settings are needed
    var used = {}, perBlock = false, gapVar = false, move = false;
    steps.forEach(function (s) {
      var T = STEP_TYPES[s.type]; if (!T) return;
      T.hats.forEach(function (h) { used[h] = true; });
      if (T.perBlock) perBlock = true;
      if (T.gap && !hasGap(s)) gapVar = true;
      if (T.move) move = true;
    });
    var hats = HAT_ORDER.filter(function (h) { return used[h]; });
    var groups = { drive: used.straight || used.back || move, perBlock: perBlock, gap: gapVar, across: used.across,
                   steer: used.straight || used.back || used.across, lineTrace: used.lineTrace,
                   sensors: used.lineTrace || used.across };   // BL / BR: line trace and Across share them

    var setBlocks = [], settingVals = {}, settingsAll = {};
    SETTINGS.forEach(function (row) {
      var key = row[0], v = settingValue(settings, row);
      settingsAll[key] = v;
      if (!groups[row[4]] && !opts.allSettings) return;
      var e = checkSetting(row, v); if (e) { errs.push(e); return; }
      settingVals[key] = v;
      if (groups[row[4]]) setBlocks.push(note(setLit(key, v), key + ': ' + row[5], true));
    });
    if (errs.length) return { ok: false, errors: errs };
    gapLabel = settingsAll.gapMs; moveLabel = settingsAll.straightSpeed;

    // variables to declare (secPerBlock is the float from the code header, not declared here)
    var vars = [], seen = {};
    function addVar(v) { if (!seen[v]) { seen[v] = true; vars.push(v); } }
    addVar('targetHeading');
    if (groups.gap) addVar('gapMs');
    hats.forEach(function (h) { HAT_VARS[h].forEach(addVar); });

    // route
    var route = [], n = 0, commands = 0;
    function put(label, blocks) {
      n += 1;
      blocks[0] = note(blocks[0], n + '. ' + label, false, 200);
      route = route.concat(blocks);
      commands += blocks.length;
    }
    var perBlockTime = function (v) { return setRep('straightTime', times(N(v), times(V('secPerBlock'), N(100)))); };  // 1/100 s
    steps.forEach(function (s) {
      var v = Number(s.value);
      switch (s.type) {
        case 'across': put(stepText(s), [setLit('acrossBlocks', v), bc('across')]); break;
        case 'acrossR': case 'acrossL':
          var gapMove = hasGap(s)
            ? (Number(s.gap) ? [setRep('straightTime', quot(N(Number(s.gap)), N(10))), bc('straight')] : [])
            : [setRep('straightTime', quot(V('gapMs'), N(10))), bc('straight')];
          put(stepText(s), [setLit('acrossBlocks', v), bc('across')].concat(gapMove).concat([
            chg('targetHeading', s.type === 'acrossR' ? 90 : -90), bc('turn')]));
          break;
        case 'acrossIR': case 'acrossIL':
          put(stepText(s), [setLit('acrossBlocks', v), bc('across'), chg('targetHeading', s.type === 'acrossIR' ? 90 : -90), bc('turn')]);
          break;
        case 'fwd': put(stepText(s), [perBlockTime(v), bc('straight')]); break;
        case 'back': put(stepText(s), [perBlockTime(v), bc('back')]); break;
        case 'right': put(stepText(s), [chg('targetHeading', 90), bc('turn')]); break;
        case 'left': put(stepText(s), [chg('targetHeading', -90), bc('turn')]); break;
        case 'uturn': put(stepText(s), [chg('targetHeading', 180), bc('turn')]); break;
        case 'turn': put(stepText(s), [chg('targetHeading', v), bc('turn')]); break;
        case 'wait': put(stepText(s), [wait(v)]); break;
        case 'move':   // the plain Rokitbrick "move forward" + wait, as in Default_values.xml (motors keep running)
          put(stepText(s), ['<block s="zumiDCMove"><l><option>FORWARD</option></l><l><option>' + num(settingsAll.straightSpeed) +
                            '</option></l></block>', wait(v)]);
          break;
        case 'line': put(stepText(s), v ? [setLit('traceCs', v), bc('lineTrace')] : [bc('lineTrace')]); break;
      }
    });

    var header = 'ZUMI ROUTE: ' + steps.map(stepText).join(' > ') +
      '. Made with Zumi Route Builder. Place the Zumi straight on the start, keep it still at the green flag.';
    var declNote = 'Variables. Only the "set" blocks below are settings; the rest are used inside the move scripts.' +
      (perBlock ? ' secPerBlock is a decimal number: it is declared as a float in this project\'s code header, not here.' : '');
    var main = GO + note(decl(vars), declNote, true) + setBlocks.join('') + wait(0.5) +
      note(HEADING, 'Start heading is taken here. Every turn is measured from the last target heading, so errors do not add up.', true) +
      route.join('') + STOP;

    // layout: everything in ONE column so every "when I receive" is visible by scrolling down
    var mainH = 120 + (4 + setBlocks.length + commands) * 34;
    var y = 200 + mainH + 200, body = [];
    body.push('<script x="30" y="200">' + main + '</script>');
    body.push('<comment x="30" y="10" w="520" collapsed="false">' + esc(header) + '</comment>');
    hats.forEach(function (h) {
      body.push('<comment x="30" y="' + (y - 70) + '" w="520" collapsed="false">' + esc("MOVE SCRIPT (don't edit): " + h + ': ' + tpl.notes[h]) + '</comment>');
      body.push('<script x="30" y="' + y + '">' + tpl.hats[h].xml + '</script>');
      y += tpl.hats[h].h + 250;
    });
    var xml = tpl.prefix.replace('@@NAME@@', esc(name)) + body.join('') + tpl.suffix;
    if (perBlock) {
      if (xml.split('<headers></headers>').length !== 2) throw new Error('template needs exactly one empty <headers> section');
      xml = xml.replace('<headers></headers>', FLOAT_HEADER);
    }
    return { ok: true, xml: xml, name: name, hats: hats, vars: vars, settings: settingVals, settingsAll: settingsAll,
             blocks: (xml.match(/<block /g) || []).length };
  }

  // ---------------- route image for the Zumi Route Player firmware (direct USB upload) ----------------
  // 'Z' 'R' version nSettings | nSettings x int16 LE (secPerBlock in ms) | nSteps | nSteps x (op, uint16 LE) | CRC-8
  function crc8(bytes) {   // polynomial 0x07, same as imageValid() in the firmware
    var c = 0;
    bytes.forEach(function (x) { c ^= x; for (var k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 255 : (c << 1) & 255; });
    return c;
  }
  var IMG_VERSION = 4;
  var OP = { across: 1, fwd: 2, back: 3, turn: 4, wait: 5, line: 6, gap: 7, move: 8 };   // gap value 65535 = use gapMs
  var IMG_MAX = 900, MAX_OPS = 255, GAP_DEFAULT = 65535;
  function encodeImage(opts) {
    var steps = opts.steps || [], settings = opts.settings || {};
    // reuse every check the XML generator does (same limits, same messages)
    var chk = generate({ name: 'x', steps: steps, settings: settings, allSettings: true },
                       { prefix: '@@NAME@@', suffix: '<headers></headers>', hats: FAKE_HATS, notes: {} });
    if (!chk.ok) return chk;
    var ops = [];
    steps.forEach(function (s) {
      var v = Number(s.value);
      switch (s.type) {
        case 'across': ops.push([OP.across, v]); break;
        case 'acrossR': case 'acrossL':
          ops.push([OP.across, v]);
          if (!hasGap(s)) ops.push([OP.gap, GAP_DEFAULT]); else if (Number(s.gap)) ops.push([OP.gap, Number(s.gap)]);
          ops.push([OP.turn, s.type === 'acrossR' ? 90 : -90]);
          break;
        case 'acrossIR': case 'acrossIL':
          ops.push([OP.across, v]); ops.push([OP.turn, s.type === 'acrossIR' ? 90 : -90]); break;
        case 'fwd': ops.push([OP.fwd, v * 2]); break;     // half blocks
        case 'back': ops.push([OP.back, v * 2]); break;
        case 'right': ops.push([OP.turn, 90]); break;
        case 'left': ops.push([OP.turn, -90]); break;
        case 'uturn': ops.push([OP.turn, 180]); break;
        case 'turn': ops.push([OP.turn, v]); break;
        case 'wait': ops.push([OP.wait, Math.round(v * 100)]); break;
        case 'move': ops.push([OP.move, Math.round(v * 100)]); break;    // 1/100 s at straightSpeed, no stop
        case 'line': ops.push([OP.line, v || 0]); break;
      }
    });
    if (ops.length > MAX_OPS) return { ok: false, errors: ['Route too long for direct upload (' + ops.length + ' moves, max ' + MAX_OPS + ').'] };
    var b = [0x5A, 0x52, IMG_VERSION, SETTINGS.length];
    function u16(x) { x = Math.round(x); if (x < 0) x += 65536; b.push(x & 255, (x >> 8) & 255); }
    SETTINGS.forEach(function (row) { u16(row[0] === 'secPerBlock' ? chk.settingsAll[row[0]] * 1000 : chk.settingsAll[row[0]]); });
    b.push(ops.length);
    ops.forEach(function (o) { b.push(o[0]); u16(o[1]); });
    b.push(crc8(b));
    if (b.length > IMG_MAX) return { ok: false, errors: ['Route too long for direct upload.'] };
    return { ok: true, bytes: b, ops: ops };
  }
  var FAKE_HATS = { turn: { xml: '', h: 0 }, straight: { xml: '', h: 0 }, back: { xml: '', h: 0 }, across: { xml: '', h: 0 }, lineTrace: { xml: '', h: 0 } };

  var api = { DEFAULT_ROUTE: DEFAULT_ROUTE, crc8: crc8, encodeImage: encodeImage, OP: OP, IMG_VERSION: IMG_VERSION, SETTINGS: SETTINGS, STEP_TYPES: STEP_TYPES,
              parseShorthand: parseShorthand, stepText: stepText, generate: generate, hasGap: hasGap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZumiCore = api;
})(this);
