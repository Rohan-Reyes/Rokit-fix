# Rokit-fix: Zumi toolkit for Rokitbrick

Block projects for the **ROKIT Zumi** robot car, made for **Rokitbrick 1.2.7** (Snap4Arduino 1.0.6).
Open any `.xml` with **File > Import** in Rokitbrick, then upload the **main script** (green flag).

## Files

| File | What it is |
|---|---|
| `Zumi-Toolkit-NoBeep.xml` | Full toolkit: gyro-locked moves (`R90`, `L90`, `U180`, `across`, `acrossR90`, `acrossL90`, `stopR90`, `stopL90`, `acrossTrace`, `lineTrace`, `goForward`, `goBackward`) called with `broadcast ... and wait`. Includes the stall-beep fix. |
| `minis/LineTrace-Mini.xml` | Smallest line trace (43 blocks). All values typed into the blocks. |
| `minis/LineTrace-Mini-Vars.xml` | Same line trace, every value a variable with a collapsed note. |
| `minis/Euler-Mini.xml` | Shortest gyro (Euler angle) turn + straight. Short variable names. |
| `minis/Euler-MiniV2.xml` | Same as Euler-Mini with long variable names and notes. |
| `route-builder/Zumi-Route-Builder.html` | Offline page: build a route from shorthand (`5AR650, 4A, LT820`), download the Rokitbrick `.xml` or upload straight to the Zumi over USB. See `route-builder/README.md`. |
| `docs/Zumi-Toolkit Guide.txt` | How to build a route with the toolkit by hand. |
| `docs/Context.txt` | Full technical context. Paste it into an AI chat before asking it to edit a route. |

## Quick start (toolkit)

1. Import `Zumi-Toolkit-NoBeep.xml`.
2. In the main script, find the comment **ROUTE STARTS HERE**.
3. Build the route from `set` + `broadcast` blocks (copy them from the floating-blocks column):

   ```
   set nBlocks to 5
   broadcast acrossR90 and wait
   broadcast acrossL90 and wait
   set nBlocks to 4
   set traceCs to 810
   broadcast acrossTrace and wait
   motor M1 STOP / motor M2 STOP   (keep last)
   ```
4. Place the Zumi square to the grid, keep it still for 1-2 s after the green flag (gyro calibration).

## Quick start (Euler mini)

| Move | Blocks |
|---|---|
| Turn right 90 | `change targetHeading by 90` -> `broadcast turn and wait` |
| Turn left 90 | `change targetHeading by -90` -> `broadcast turn and wait` |
| Straight 1 s | `set straightTime to 100` -> `broadcast straight and wait` |

## Notes

- **Beeping** was stalled motors whining at their PWM pitch (about 490 / 980 Hz), not the buzzer. The NoBeep toolkit switches off wheels that would run too slowly to turn, adds a stall kick to turns (`boostStep`), and raises the line trace's "line lost" speed (`lostSpd`).
- Times ending in `Ms` are milliseconds; times ending in `Cs` are 1/100 s (the Zumi only has 16-bit whole numbers).
- Never put a `broadcast` inside a `when I receive` script: the Arduino converter can't call one move from another.
- Never name a move `forward` or `backward`: those names are reserved by the Zumi library.
- Can't see the move scripts? Scroll right or down, or right-click the canvas > **clean up**.
