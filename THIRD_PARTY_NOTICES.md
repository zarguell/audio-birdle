# Third-party notices

## Forever AI Components

Audio-Birdle borrows and adapts several UI patterns from
[Forever AI Components](https://github.com/isas1/forever-ai-components), a
zero-dependency component registry by isas1, licensed under the MIT License.

The exact source revision and the adapted files are recorded in
[`sitegen/vendor/forever-components.json`](sitegen/vendor/forever-components.json).
The upstream license text is preserved in
[`sitegen/vendor/forever-ai-components.LICENSE`](sitegen/vendor/forever-ai-components.LICENSE).

Adapted patterns:

- `infinite/loaders/08-equalizer-bars.html` — equalizer bars used while audio
  is playing and as a static hero mark.
- `infinite/feedback-states/01-success-check.html` — one-shot SVG success
  confirmation on a winning game.
- `infinite/buttons/06-jelly-press.html` — squash-and-stretch press feedback.
- `infinite/navigation/09-morphing-bottom-nav.html` — floating mobile bottom
  navigation surface and active state.

All auto-replay loops, idle animations, and theme broadcast hooks were removed.
The adapted CSS lives in lintable files under `sitegen/static/css/`; no upstream
HTML or inline scripts are shipped.

## Bird data and recordings

Bird observations are provided by [eBird](https://ebird.org). Audio recordings
come from the [Macaulay Library](https://www.macaulaylibrary.org/) and
[Xeno-canto](https://xeno-canto.org/). Attribution metadata is rendered with the
bird completion card where the data provides it.

## VT323

The display typeface is [VT323](https://fonts.google.com/specimen/VT323) by
Peter Hull and contributors, licensed under the SIL Open Font License 1.1. The
woff2 file is vendored at `sitegen/static/fonts/vt323-latin.woff2`; its source
URL and SHA-256 are recorded in `sitegen/vendor/fonts.json`, and the license
text is preserved in `sitegen/vendor/vt323.OFL.txt`.
