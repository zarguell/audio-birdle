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

## huashu-bird-sticker art

The species reveal can show a sticker illustration from
[huashu-bird-sticker](https://github.com/alchaincyf/huashu-bird-sticker) by
Huashu, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The art is **not vendored**: `sitegen/static/js/core/sticker.js` builds a URL to
the upstream jsDelivr copy at runtime, so nothing of it is redistributed in this
repository or in the built site. Attribution is displayed on the card next to
the sticker, and the credit line must stay with the image.

The set does not cover every species — extinct and very rare birds are missing,
and a few files answer 403 — so a failed load falls back to the photo carousel.

## Discord Embedded App SDK

The Discord Activity handshake uses
[`@discord/embedded-app-sdk`](https://github.com/discord/embedded-app-sdk)
2.5.0, licensed under the MIT License. The ESM entry point is bundled into the
committed artifact `sitegen/static/vendor/embedded-app-sdk.js`; the exact
version, npm tarball, integrity hash, build command, and output SHA-256 are
recorded in
[`sitegen/vendor/embedded-app-sdk.json`](sitegen/vendor/embedded-app-sdk.json).
It is not a `package.json` dependency and is never loaded from a CDN.

MIT License

Copyright (c) 2024 Discord Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

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
