"""Mimic Rokitbrick's Snap4Arduino transpiler (rokits/zumi objects.js + morphic.js) to check generated C."""
import re
import sys
import xml.etree.ElementTree as ET

src, out = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
code = {c.tag: (c.text or '') for c in root.find('code')}
code['receiveMessage'] = 'void <#1>() {'
code['doBroadcastAndWait'] = ' !call!<#1>();'
# project code headers (<headers><selector>text</selector>): like BlockMorph.mappedCode, each selector used in a
# top-level script adds its header once, joined with blank lines, in front of that script's code
hdr_el = root.find('headers')
headers = {c.tag: (c.text or '') for c in hdr_el} if hdr_el is not None else {}
USED = []

def is_num(t):
    try:
        float(t)
        return True
    except ValueError:
        return False

def lit(el, raw=False):
    o = el.find('option')
    if o is not None:
        return o.text
    t = el.text or ''
    if raw or is_num(t):
        return t
    return code['string'].replace('<#1>', t)

def inp(el, raw=False):
    if el.tag == 'l':
        return lit(el, raw)
    if el.tag == 'block':
        return block(el)
    if el.tag == 'script':
        return script(el)
    if el.tag == 'list':
        return code['tempvars_delim'].join(lit(x, True) for x in el)
    raise ValueError(el.tag)

def block(el):
    if 'var' in el.attrib:
        return el.attrib['var']
    s = el.attrib['s']
    if s not in USED:
        USED.append(s)
    if s not in code:
        raise SystemExit('NOT TRANSPILABLE: ' + s)
    ins = [c for c in el if c.tag != 'comment']
    raw_first = s in ('doSetVar', 'doChangeVar')
    vals = [inp(c, raw=(raw_first and i == 0)) for i, c in enumerate(ins)]
    t = code[s]
    for i, v in enumerate(vals):
        t = t.replace('<#%d>' % (i + 1), v)
    return t

def script(el):
    return '\n'.join(block(b) for b in el if b.tag == 'block')

def top(el):
    USED.clear()
    c = script(el)
    h = [headers[k] for k in USED if headers.get(k)]
    return ('\n\n'.join(h) + '\n\n' + c) if h else c

scripts = root.find('stage/sprites/sprite/scripts').findall('script')
main = [s for s in scripts if s[0].attrib.get('s') == 'receiveGo' and s.find(".//block[@s='doDeclareVariables']") is not None][0]
hats = [s for s in scripts if s[0].attrib.get('s') == 'receiveMessage']
body = top(main)

broadcasts = ''
if '!call!' in body:
    body = re.sub(r'!call!"(.*)"', r'\1', body)
    for h in hats:
        broadcasts += re.sub(r'void "(.*)"\(\) {', r'void \1() {', top(h)) + '\n}\n\n'
header = '#define OLED_USE\n#include "Zumi.h"\n' if 'OLED' in body + broadcasts else '#include "Zumi.h"\n'
var_lines = re.findall(r'int .* = 0;', body)
body = re.sub(r'int .* = 0;\n', '', body)
body = ''.join(v + '\n' for v in var_lines) + '\n' + body
setup_hdr = ('\n  Zumi.IRsensorInit();\n  Zumi.startIRreceiver();\n  Zumi.setIRChannel(1);\n'
             '  Zumi.MotorInit();\n  Zumi.DCMotor(M1, STOP, 0);\n  Zumi.DCMotor(M2, STOP, 0);\n'
             '  Zumi.GyroCalibration();\n')
body = body.replace('void setup() {', 'void setup() {' + setup_hdr, 1)
if 'void loop()' not in body:
    body += '\n}\n\nvoid loop() {}\n'
res = header + body + broadcasts
if '!call!' in res:
    raise SystemExit('LEFTOVER !call! (nested broadcast)')
open(out, 'w', newline='\n').write(res)
print('ok', len(res.splitlines()), 'lines')
