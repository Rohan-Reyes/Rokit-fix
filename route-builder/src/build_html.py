"""Inline core.js + serial.js + template.json + Route Player firmware into ui.html -> one offline file.
usage: build_html.py OUT.html   (run inside the builder folder)"""
import json, sys
ui = open('ui.html', encoding='utf-8').read()
core = open('core.js', encoding='utf-8').read()
serial = open('serial.js', encoding='utf-8').read()
fwhex = open('fwbuild/ZumiRoutePlayer.ino.hex', encoding='utf-8').read().strip()
assert set(fwhex) <= set('0123456789ABCDEFabcdef:\r\n'), 'unexpected characters in firmware hex'
tpl = json.dumps(json.load(open('template.json', encoding='utf-8')), separators=(',', ':'))
# "</script" would close the inline <script>; "<\/" means the same inside JSON and JS strings
tpl = tpl.replace('</', '<\\/')
core = core.replace('</script', '<\\/script')     # only appears inside string literals (a blanket "</" swap breaks regexes)
serial = serial.replace('</script', '<\\/script')
for name, text in [('core', core), ('tpl', tpl), ('serial', serial), ('fwhex', fwhex)]:
    assert '</script' not in text.lower(), name
out = (ui.replace('/*TPL*/', tpl, 1).replace('/*CORE*/', core, 1)
         .replace('/*SERIAL*/', serial, 1).replace('/*FWHEX*/', fwhex, 1))
assert all(m not in out for m in ['/*TPL*/', '/*CORE*/', '/*SERIAL*/', '/*FWHEX*/'])
open(sys.argv[1], 'w', encoding='utf-8', newline='').write(out)
print('wrote', sys.argv[1], len(out))
