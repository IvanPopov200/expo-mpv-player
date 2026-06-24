# Android runtime gates (G3 launch / G4 render / G6 headers / G7 onError)

Run on a headless **arm64-v8a Android 36 emulator** (`google_apis`, Apple Silicon
host, `-gpu swiftshader_indirect`), example app debug build, Metro + the fixture
server bridged in via `adb reverse` (8081 / 8099).

## Method caveat (important — read first)

The AAR *as built today* (NDK r29 / clang 21) does **not** load in the stock
example app: AGP packages React Native's older `libc++_shared.so` (NDK r27 /
clang 18), and `dlopen(libmpv.so)` fails with `UnsatisfiedLinkError` — see
`g2b-libcxx-skew.txt`. To exercise the runtime **render/decode/header/error
path** below, the debug APK was repackaged with the AAR's own (compatible)
`libc++_shared.so` and re-signed. That swap is **symbol-for-symbol equivalent**
to what the proper fix produces, so these results validate the player stack
itself. The production fix (build libmpv with RN's NDK r27, so the stock AAR
loads with no swap) is implemented in `android/libmpv-build/build-lgpl-aar.sh`
and must be re-verified on the freshly-built AAR before these are called clean.

## G3 — launch + UI ✅

App launched (`am start … /.MainActivity`), Hermes loaded, JS bundle served
(703 modules), `Running "main" with … "fabric":true` (New Architecture). The
full example UI rendered. Screenshot: `g3-launch.png`. No `UnsatisfiedLinkError`
after the libc++ swap; `MpvPlayerView` instantiates.

## G4 — render ✅

Loading the `/ok` fixture (a real 320×240 H.264 `sample.mp4`) drove mpv's
`vo/gpu-next` + libplacebo to actually decode and display frames. logcat:

```
[vo/gpu-next:v] Video borders: l=135 t=0 r=135 b=0
[vo/gpu-next/libplacebo:v] Spent 14.762 ms generating shader LUT
event: playback-restart
[cplayer:v] first video frame after restart shown
[cplayer:v] playback restart complete @ 0.000000, audio=eof, video=playing
```

Screenshot `g4-render.png` shows the decoded test-card frame on screen, with the
example's live readout: `2.1s / 3.0s · cache 0.3s` and tech info
(`videoWidth 320, videoHeight 240, videoCodec H.264/AVC, fps 15`). Progress
ticks, technical-info, and the gpu-next render path all work.

## G6 — HTTP headers (exact, comma-bearing) ✅

`/ok` requires the exact header
`MediaBrowser Client="ExpoMpvPlayer", Token="fixture-token-123"` (note the
internal comma) and serves the video only on an exact match. The fixture server
recorded (`g6-headers.json`):

```json
{ "url": "/ok",
  "authorization": "MediaBrowser Client=\"ExpoMpvPlayer\", Token=\"fixture-token-123\"",
  "status": 206 }
```

`206` = the header arrived verbatim and the video was served. This proves the
`change-list http-header-fields clr/append` encoding survives the embedded comma
(a plain comma-joined `http-header-fields` would have split it).

## G7 — onError ⛔ (JNI-wrapper limitation, binary-verified)

mpv correctly fails the load and emits the error end-file (`g7-mpv-failure.txt`):

```
[stream:error] Failed to open http://localhost:8099/unauth.
[cplayer:v] finished playback, loading failed (reason 4)   # reason 4 = MPV_END_FILE_REASON_ERROR
```

But the bundled JNI wrapper's observer interface is `event(int)` only — it does
**not** carry the end-file *reason* (verified by `javap` on the AAR:
`dev.jdtech.mpv.MPVLib$EventObserver` exposes `event(int)` and `eventProperty(…)`
and nothing else). So the Android module cannot distinguish a load error from a
normal EOF, and cannot fire a meaningful `onError` the way iOS does (iOS reads
`mpv_event_end_file.reason` directly). The failure surfaces as a
playback-state-stopped transition, not an error event. This is a real limitation
of the prebuilt wrapper, not a regression; closing it requires a log-observer
based heuristic or a patched JNI layer (tracked as future work).

## Artifacts

`g3-launch.png` · `g4-render.png` · `g4-render-2.png` · `g7-onerror.png` ·
`g6-headers.json` · `g7-mpv-failure.txt` · `g2b-libcxx-skew.txt`
