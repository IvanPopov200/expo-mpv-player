# Android runtime gates (G3 launch / G4 render / G6 headers / G7 onError)

Run on a headless **arm64-v8a Android 36 emulator** (`google_apis`, Apple Silicon
host, `-gpu swiftshader_indirect`), example app **debug build with the stock r27
AAR** (`android/libmpv-build/build-lgpl-aar.sh`, NDK `27.1.12297006`), Metro + the
fixture server bridged via `adb reverse` (8081 / 8099).

All four gates below were verified on the **unpatched** app — the AAR loads as
shipped, no libc++ substitution. (An earlier pass used an NDK r29 AAR that failed
to load — see `g2b-libcxx-skew.txt`; that skew is fixed by the r27 NDK pin.)

## G3 — launch + load ✅

`libmpv.so` and `libplayer.so` `dlopen` cleanly; **zero** `UnsatisfiedLinkError`
or view-create failures (`g3-dlopen.txt`). App launches, Hermes loads, JS bundle
served (703 modules), `Running "main" … "fabric":true` (New Architecture). The
example UI renders and `MpvPlayerView` instantiates (`g3-launch.png`).

```
Load …/lib/arm64-v8a/libmpv.so: ok
Load …/lib/arm64-v8a/libplayer.so: ok
UnsatisfiedLink / Couldn't-create-view count = 0
```

## G4 — render ✅

Loading the `/ok` fixture (a real H.264 `sample.mp4`) drove mpv's `vo/gpu-next` +
libplacebo to decode and display frames:

```
[cplayer:v] first video frame after restart shown
[cplayer:v] playback restart complete @ 0.000000, audio=eof, video=playing
[vo/gpu-next:v] Video display: 0,0 … OSD/Video borders …
```

`g4-render.png` shows the decoded test-card frame on screen with the live
readout: `1.1s / 3.0s · cache 1.3s`, `isReadyToSeek:true`, tech info
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
(a plain comma-joined `http-header-fields` would have split it into bogus fields).

## G7 — onError ✅ (event-ordering inference)

The bundled JNI wrapper's observer is `event(int)` only — no end-file *reason*
(verified by `javap`: `dev.jdtech.mpv.MPVLib$EventObserver` exposes `event(int)`
and `eventProperty(…)`, nothing else). So `MPVRenderer` infers a load failure
from event ordering: a file that `START_FILE`s but `END_FILE`s before
`FILE_LOADED` never opened → `onError`; a `pendingReplace` guard stops a normal
reload's superseded-file `END_FILE` from being misreported.

Loading `/unauth` (always 401) produced (`g7-onerror-android.txt`):

```
[cplayer:v] finished playback, loading failed (reason 4)   # reason 4 = MPV_END_FILE_REASON_ERROR
ReactNativeJS: onError {"error":"Failed to load media — the source could not be opened or decoded"}
```

The JS `onError` callback fired. The message is generic (the wrapper hides mpv's
reason string; iOS surfaces the exact `mpv_error_string`), but the gate —
**`onError` fires on a load failure** — is met. A normal EOF after a successful
load does not fire it.

## Artifacts

`g3-dlopen.txt` · `g3-launch.png` · `g4-render.png` · `g6-headers.json` ·
`g7-onerror.png` · `g7-onerror-android.txt` · `g7-mpv-failure.txt` ·
`g2b-libcxx-skew.txt` (the now-fixed skew)
