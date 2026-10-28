# terminal-farm — asset package

Everything the design canvas draws, as separate files. Nothing here is bundled HTML.

| Folder | What |
|---|---|
| `sprites/normal/<species>/` | 6×6 px animal sprites, transparent PNG. `<status>_f<n>.png` is native size; `@8x` and `@16x` are nearest-neighbour. `<status>.gif` is the animation at its real frame timing (16×). |
| `sprites/mini/<species>/` | Same, 4×4 px (the 50-agent tier). |
| big tier | There is no separate art: big = normal sprite scaled ×2 (12×12 px). Use the normal PNGs. |
| `atlas/` | One PNG per tier (`atlas-normal.png`, `atlas-mini.png`, plus `@8x`/`@16x`) with a `.json` of frame rectangles. Rows: sheep, pig, cow, hen. Columns: working 0-3, idle 0-3, unknown 0-1. |
| `decor/` | tree, bush, pond, hay (native + @8x + @16x). |
| `sky/` | moon phases, clouds, windmill frames, `sky.json` rules. |
| `screens/` | Every screen as a PNG, 3× resolution (2631 px wide for 120×40): day, night, dusk, compact 80×24, overflow, wide 200×60, sparse, the 256-colour day, directions B and C, and the sprite sheets. |
| `ansi/` | The same screens as real terminal output. `cat ansi/day.truecolor.ans` in a truecolor terminal shows it. `.256.ans` is the 256-colour fallback, `.txt` is plain characters. |
| `data/` | `palette.json` (every role, sky keyframes, per-species palettes, xterm-256 index for each hex), `sprites.json` (pixel maps), `animation.json` (frame order, ms, effect glyphs, 125 ms tick), `layout.json` (tier sizes), `decor.json`. |
| `src/` | `engine.js` is the reference renderer and the source of truth for the numbers. UMD, no dependencies. `dirs.js` is directions B and C. `sample.js` is the sample data. |
| `fonts/` | JetBrains Mono, used for the screen PNGs. |

## Notes for the build

- In the terminal there are no PNGs. Sprites are drawn with `▀` (fg = top pixel, bg = bottom pixel). The PNGs are for docs, a web preview, or tests. `data/sprites.json` plus `src/engine.js` (`spriteFrame`, `render`) is what the Node app needs.
- The `♪ ♫ z Z ?` effect glyphs are text, not pixels, so they are in `data/animation.json` and not in the PNGs.
- Idle sprites are tinted 16% toward `#4A5C8F` and unknown sprites are checkerboarded and greyed. The PNGs already include this.
- The screen PNGs are renders of the engine's cell grid in JetBrains Mono, not photographs of a real terminal. Your terminal font will change glyph shapes slightly.
- Sample data names come from your brief. The moon colour in `sky/` PNGs is a stand-in for the sky-mixed limb colour.
