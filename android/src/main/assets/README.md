# Android assets

## `subfont.ttf` (required for SRT subtitles)

mpv/libass needs a fallback font to render text subtitles (SRT and similar). The
renderer copies `subfont.ttf` from this `assets/` directory into mpv's
`config-dir` at init (`MPVRenderer.prepareConfigDir`). **Without it, plain-text
subtitles will not render.**

This font is a binary and is intentionally **not** something the wrapper source
fabricates. Add a real `subfont.ttf` here as part of the build/release:

- It ships with the upstream libmpv-android build output, or
- Use mpv's bundled subtitle font (a Noto/DejaVu-derived TTF with a
  redistribution-compatible license), or
- Drop in any license-compatible Unicode TTF named `subfont.ttf`.

`android/libmpv-build/` produces the engine; wire the font copy into your release
step (or commit a vetted `subfont.ttf` alongside this README). The native code
degrades gracefully if the file is missing (it just skips the copy), so the build
still succeeds — only text-subtitle rendering is affected.
