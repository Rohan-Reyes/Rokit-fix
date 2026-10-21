window.addEventListener('load', function () {
  var out = [], $ = function (id) { return document.getElementById(id); };
  function log(k, v) { out.push(k + ' = ' + v); }
  try {
    log('first open loads tested route', $('asShort').textContent);
    $('clear').click();
    log('empty route download disabled', $('download').disabled);
    $('short').value = '5AR-5AR-2IR, B1, W 2, F1, L, 2AL, B1, W0.5, 5IL, 4A F0.5 LT';
    $('shortReplace').click();
    log('steps after replace', document.querySelectorAll('#steps li').length);
    log('shorthand echo', $('asShort').textContent);
    log('download enabled', !$('download').disabled);
    log('summary', $('summary').textContent);
    // bad token
    $('short').value = '5AR ZZ'; $('shortAppend').click();
    log('bad token msg', $('shortMsg').textContent);
    log('steps unchanged', document.querySelectorAll('#steps li').length);
    // palette add + edit value + delete
    var pal = document.querySelectorAll('#palette button'); log('palette buttons', pal.length);
    pal[5].click(); // Forward
    var lastLi = document.querySelectorAll('#steps li'); lastLi = lastLi[lastLi.length - 1];
    var inp = lastLi.querySelector('input'); inp.value = '1.3'; inp.dispatchEvent(new Event('input'));
    log('error on 1.3', $('genMsg').textContent);
    inp.value = '1.5'; inp.dispatchEvent(new Event('input'));
    log('fixed', $('genMsg').textContent === '' );
    lastLi.querySelectorAll('button')[0].click(); // move up
    log('moved up -> shorthand tail', $('asShort').textContent.split(', ').slice(-2).join(', '));
    var lis = document.querySelectorAll('#steps li'); lis[lis.length - 2].querySelectorAll('button')[3].click(); // delete
    log('after delete count', document.querySelectorAll('#steps li').length);
    // settings edit
    var s = document.querySelector('#settings input[aria-label=acrossSpeed]'); s.value = '300'; s.dispatchEvent(new Event('input'));
    log('setting range error', $('genMsg').textContent);
    $('resetSet').click(); log('reset ok', $('genMsg').textContent === '');
    $('name').value = 'My Route 1'; $('name').dispatchEvent(new Event('input'));
    log('file name', $('summary').textContent.match(/File: .*/)[0]);
  } catch (e) { log('EXCEPTION', e.stack); }
  var pre = document.createElement('pre'); pre.id = 'TESTOUT'; pre.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9;background:#fff;color:#000;font:14px monospace;padding:8px;margin:0;white-space:pre-wrap;border-bottom:3px solid red'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
});
window.addEventListener('load', function () {
  var g = document.querySelector('#settings input[aria-label=gapMs]');
  var spb = document.querySelector('#settings input[aria-label=secPerBlock]');
  var pre0 = document.getElementById('TESTOUT');
  pre0.textContent += '\nsecPerBlock row step = ' + (spb && spb.step) + ', old turnGap row gone = ' + !document.querySelector('#settings input[aria-label=turnGap]');
  // per-step gap: put 5AR300 in, check the step's gap box and the shorthand echo
  document.getElementById('short').value = '5AR300 5AR 5IL F1.5'; document.getElementById('shortReplace').click();
  var gapBoxes = document.querySelectorAll('#steps input[aria-label$="gap ms"]');
  pre0.textContent += '\ngap boxes = ' + gapBoxes.length + ' (values: ' + [].map.call(gapBoxes, function (x) { return x.value || '(empty)'; }).join(', ') + ')';
  gapBoxes[1].value = '650'; gapBoxes[1].dispatchEvent(new Event('input'));
  pre0.textContent += '\nshorthand after typing 650 in 2nd gap = ' + document.getElementById('asShort').textContent;
  var spbIn = document.querySelector('#settings input[aria-label=secPerBlock]'); spbIn.value = '1.05'; spbIn.dispatchEvent(new Event('input'));
  pre0.textContent += '\nsecPerBlock 1.05 accepted = ' + (document.getElementById('genMsg').textContent === '');
  var pre = document.getElementById('TESTOUT');
  pre.textContent += '\ngapMs row present = ' + !!g + '\npalette labels = ' + [].map.call(document.querySelectorAll('#palette button'), function (b) { return b.firstChild.textContent; }).slice(0, 5).join(' | ');
});
