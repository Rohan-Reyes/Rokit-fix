"""across move: white/black detection uses the line-trace thresholds BL / BR instead of 125 / 155.
white = sensor < BL (left) / < BR (right); black again = sensor > BL + 30 / BR + 30 (same 30 margin as before)."""
import json, re
T = 'template.json'
t = json.load(open(T, encoding='utf-8'))
x = t['hats']['across']['xml']
SENS = '<block s="readSensor"><l><option>%s</option></l></block>'
for side, var in [('THE_BOTTOM_LEFT', 'BL'), ('THE_BOTTOM_RIGHT', 'BR')]:
    lt = '<block s="reportLessThan">' + SENS % side + '<l>125</l></block>'
    gt = '<block s="reportGreaterThan">' + SENS % side + '<l>155</l></block>'
    assert x.count(lt) == 1 and x.count(gt) == 1, side
    x = x.replace(lt, '<block s="reportLessThan">' + SENS % side + '<block var="%s"/></block>' % var)
    x = x.replace(gt, '<block s="reportGreaterThan">' + SENS % side +
                  '<block s="reportSum"><block var="%s"/><l>30</l></block></block>' % var)
assert '<l>125</l>' not in x and '<l>155</l>' not in x
t['hats']['across']['xml'] = x
t['notes']['across'] = ('forward at acrossSpeed until it has crossed acrossBlocks white blocks, holding targetHeading '
                        '(counts the block it starts on). White = sensor below BL / BR, black again = above BL + 30 / BR + 30 '
                        '(the same BL / BR as the line trace).')
json.dump(t, open(T, 'w', encoding='utf-8'))
print('across now uses BL / BR')
