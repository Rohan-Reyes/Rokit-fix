# Zumi Route Builder

One offline HTML page to build a Zumi route, then either **download the `.xml`** for Rokitbrick 1.2.7 or
**upload it straight to the Zumi over USB** (Chrome / Edge, Web Serial). No install, no internet.

Open `Zumi-Route-Builder.html` by double-clicking it.

## Building a route

Type a route in **Quick entry**, or click the step buttons, then edit / reorder the steps.

| Code | Step |
|---|---|
| `5A` | Across 5 blocks (any number) |
| `5AR` / `5AL` | Across 5, drive forward for `gapMs`, then turn right / left 90 |
| `5AR300` | Same, with its own 300 ms gap (`0` = no gap) |
| `5IR` / `5IL` | Across 5, stop, turn right / left 90 in place |
| `F1.5` / `B1` | Forward / backward N blocks (0.5 steps; time = blocks x `secPerBlock`) |
| `R` / `L` / `U` | Turn right 90 / left 90 / U-turn 180 |
| `T45` | Turn any angle (+ right, - left) |
| `W2` | Wait 2 s (any number) |
| `M0.5` | Plain "move forward" at `straightSpeed` for 0.5 s, no gyro, keeps rolling into the next step |
| `LT` / `LT900` | Line trace (`traceCs` / 9.00 s) |

Steps can be separated with commas, spaces or dashes: `5AR-5AR-2IR-B1-W2`.
**Tested route** loads the robot-tuned route: `5AR650, 5AR650, 5AL650, 5AL650, 4A, M0.5, LT820, W2, R, LT820`.

## Settings (tested defaults)

| Setting | Default | Meaning |
|---|---|---|
| `straightSpeed` | 160 | Forward / backward / gap / `M` speed |
| `secPerBlock` | 1 | Seconds per grid block at 160 (decimals OK - declared as a C `float` through the project's code header) |
| `acrossSpeed` | 200 | Across speed |
| `steerStrength` | 8 | Gyro steering per degree off |
| `gapMs` | 650 | Gap between an Across and its turn (5AR / 5AL) |
| `BL` / `BR` | 100 | Bottom sensor thresholds. Line trace: above = on the black line. Across: below = white block, above +30 = black again |
| `traceCs` | 810 | Line trace follow time (1/100 s) |
| `spdStraight` / `spdFast` / `spdSlow` / `spdPivot` / `lostSpd` | 150 / 175 / 110 / 110 / 30 | Line trace speeds |

Only the settings a route uses go into the `.xml`, each with a comment.

## Direct USB upload

1. Once: **Install Route Player** flashes a small program (the same tested move code) - STK500 at 115200 baud,
   like Rokitbrick's own upload. Needed again after uploading anything from Rokitbrick.
2. **Upload route** sends only the steps + settings (saved in EEPROM, CRC-8 checked) in about 2 s.
3. Unplug, place the Zumi on the start, switch it on: it waits 1.5 s, calibrates the gyro, runs the route.

Close Rokitbrick first (only one program can use the COM port).

## What is in the `.xml`

The main script (settings + one numbered step per route step) plus only the move scripts the route needs,
stacked under it: `turn`, `straight`, `back`, `across` (gyro-locked), `lineTrace` (the In-OutV4 line trace).

## Source (`src/`)

| File | |
|---|---|
| `core.js` | Shorthand parser, validation, `.xml` generator, route image encoder |
| `serial.js` | Intel HEX parser, STK500v1 flasher, route upload (Web Serial) |
| `ui.html` | The page (placeholders for the parts above) |
| `template.json` | Project wrapper + move scripts taken from a robot-tested project |
| `build_html.py` | Inlines everything into one `Zumi-Route-Builder.html` (`python build_html.py OUT.html`, run in `src/`) |
| `gen_firmware.py` | Builds the Route Player sketch from the tested move functions |
| `firmware/` | Route Player sketch + compiled `.hex` (ATmega328P, 16 MHz) |
| `transpile_mimic.py` | Mimics Rokitbrick's block-to-C converter, for checking generated `.xml` |
| `test/` | Node tests (parser, generator, simulated bootloader + Route Player) and browser drivers |
