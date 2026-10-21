"""Pull the project wrapper + move scripts out of the tested trial XML -> template.json for the route builder.
usage: extract_template.py TRIAL.xml template.json relayout.py"""
import re, json, sys
import xml.etree.ElementTree as ET
SRC, OUT, RELAYOUT = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(SRC, encoding='utf-8').read()
rl = open(RELAYOUT, encoding='utf-8').read()
ns = {'ET': ET}
exec(rl[rl.index('CH, CW ='):rl.index('def relayout')], ns)
size = ns['size']

m = re.search(r'(<sprite [^>]*>.*?<scripts>)(.*?)(</scripts>)', s, re.S)
prefix, body, suffix = s[:m.start(2)], m.group(2), s[m.end(2):]
prefix = re.sub(r'<project name="[^"]*"', '<project name="@@NAME@@"', prefix, count=1)
assert '@@NAME@@' in prefix


def top_items(text):
    """split into top-level <script>...</script> / <comment>...</comment> strings, exactly as written"""
    out, i = [], 0
    tok = re.compile(r'<(/?)(script|comment)\b[^>]*?(/?)>')
    while True:
        first = tok.search(text, i)
        if not first:
            return out
        depth, start, tag = 0, first.start(), first.group(2)
        for t in tok.finditer(text, start):
            if t.group(2) != tag or t.group(3):
                continue
            depth += -1 if t.group(1) else 1
            if depth == 0:
                out.append(text[start:t.end()])
                i = t.end()
                break


hats, notes = {}, {}
for it in top_items(body):
    mm = re.match(r'<script x="[^"]*" y="[^"]*">(<block s="receiveMessage"><l>(\w+)</l></block>.*)</script>$', it, re.S)
    if mm:
        xml, name = mm.group(1), mm.group(2)
        hats[name] = {'xml': xml, 'h': round(size('<script>' + xml + '</script>')[1])}
    cm = re.match(r"<comment [^>]*>MOVE SCRIPT \(don(?:'|&apos;)t edit\): (\w+): (.*)</comment>$", it, re.S)
    if cm:
        notes[cm.group(1)] = cm.group(2)

assert set(hats) == {'turn', 'straight', 'back', 'across', 'lineTrace'}, hats.keys()
for k, v in hats.items():
    assert v['xml'] in s, k
json.dump({'prefix': prefix, 'suffix': suffix, 'hats': hats, 'notes': notes}, open(OUT, 'w', encoding='utf-8'))
print({k: v['h'] for k, v in hats.items()}, list(notes))
