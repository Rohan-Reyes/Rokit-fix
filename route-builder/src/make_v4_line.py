"""Replace the builder's lineTrace move with the In-OutV4 line trace, block for block.
Only changes: the 8.6 s literal -> traceCs, the two pivot speeds -> spdPivot (default = spdSlow = V4's 90),
the lost-line creep literal 30 -> lostSpd (default 30 = V4). lastTurn is reset first, as V4 did before its 2nd trace.
usage: make_v4_line.py gen_zumi2.py In-OutV4.xml template.json"""
import re, sys, json
from xml.sax.saxutils import escape
G2, V4, TPL = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(G2, encoding='utf-8').read()
exec(src[src.index('# ---------------- XML builders'):src.index('# ---------------- settings / main')]
     .replace("TEMPLATE, OUT = sys.argv[1], sys.argv[2]", ""))
v4 = open(V4, encoding='utf-8').read()
first = '<block s="doSetVar"><l>S_BL</l>'
stopm = ('<block s="zumiDCmotor"><l><option>M1</option></l><l><option>STOP</option></l><l><option>0</option></l></block>'
         '<block s="zumiDCmotor"><l><option>M2</option></l><l><option>STOP</option></l><l><option>0</option></l></block>')
a = v4.index(first); b = v4.index(stopm, a) + len(stopm)
line = v4[a:b]
line, n = re.subn(r'(<block var="prev"/></block>)<l>(?!300<)\d+</l>', r'\g<1><block var="traceCs"/>', line); assert n == 1
# pivots: "M1 CCW spdSlow + M2 STOP" and "M1 STOP + M2 CW spdSlow" (the correcting pairs keep spdSlow)
piv1 = ('<block s="zumiDCmotor"><l><option>M1</option></l><l><option>CCW</option></l><block var="spdSlow"/></block>'
        '<block s="zumiDCmotor"><l><option>M2</option></l><l><option>STOP</option></l>')
piv2 = ('<block s="zumiDCmotor"><l><option>M1</option></l><l><option>STOP</option></l><l><option>0</option></l></block>'
        '<block s="zumiDCmotor"><l><option>M2</option></l><l><option>CW</option></l><block var="spdSlow"/></block>')
assert line.count(piv1) == 1 and line.count(piv2) == 1, (line.count(piv1), line.count(piv2))
line = line.replace(piv1, piv1.replace('spdSlow', 'spdPivot')).replace(piv2, piv2.replace('spdSlow', 'spdPivot'))
assert line.count('<l>30</l></block>') == 2
line = line.replace('<l>30</l></block>', '<block var="lostSpd"/></block>')
hat = HAT('lineTrace') + ''.join(flat([setv('lastTurn', 0)])) + line
t = json.load(open(TPL, encoding='utf-8'))
t['hats']['lineTrace'] = {'xml': hat, 'h': 1500}
t['notes']['lineTrace'] = ('your In-OutV4 line trace: finds the line first (spdSlow, up to 3 s), then follows it for traceCs '
                           '(1/100 s), then stops.')
json.dump(t, open(TPL, 'w', encoding='utf-8'))
print('lineTrace hat replaced,', len(hat), 'chars; vars:', sorted(set(re.findall(r'<block var="(\w+)"/>', hat)) | set(re.findall(r'<block s="doSetVar"><l>(\w+)</l>', hat))))
