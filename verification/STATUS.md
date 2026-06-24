# Gate status (single source of truth)

Update this table **only** when the artifact exists in this directory. Legend:
✅ artifact committed · ⏳ implemented, not yet verified · ⛔ blocked · n/a.

| Gate | iOS | Android | Notes |
|---|---|---|---|
| G0 static | ✅ | ✅ | CI green on every PR |
| G1 LGPL provenance | n/a | ✅ | Android build output: FFmpeg `CONFIG_GPL 0` + mpv `gpl=false`, verifier PASSED (`lgpl/verify-output.txt`). iOS uses MPVKit LGPL |
| G2 compile+link | ✅ | ✅ | iOS sim build succeeded (PR #7); Android example assembles with the LGPL AAR linked, libmpv/FFmpeg `.so`s + module classes in the APK (`android/g2-compile.md`) |
| G3 launch | ✅ | ✅ | iOS launches; +20× mount/unmount stress, no crash (`ios/g3-teardown-stress.md`). Android: stock r27 AAR `dlopen`s clean (0 link errors), view instantiates (`android/g3-dlopen.txt`, `g3-launch.png`) |
| G4 render | ✅ | ✅ | iOS renders video (`ios/g4-render.png`); root cause was a React version mismatch, fixed by pinning react 19.2.3. Android: `gpu-next` renders `sample.mp4` on emulator, unpatched app (`android/g4-render.png`) |
| G5 hwdec (device) | ✅ | ✅ | iOS: H.264 + HEVC on a physical iPhone 14 Pro (A16) — `hwdec-current=videotoolbox`, 0 dropped frames (`ios/g5-hwdec.txt`). Android: H.264 + HEVC on a physical Retroid Pocket 6 (Snapdragon 8 Gen 2) — `c2.qti.{avc,hevc}.decoder`, `hwdec: mediacodec-copy`, 0 dropped frames (`android/g5-hwdec.md`) |
| G6 headers | ✅ | ✅ | iOS: exact comma-bearing header reaches the server (`ios/g6-headers.*`). Android: same exact header → `206`, unpatched app (`android/g6-headers.json`) |
| G7 onError | ✅ | ✅ | iOS: 401 → on"loading failed" (`ios/g7-onerror.md`). Android: 401 → `onError` via event-ordering inference (`START_FILE`/`FILE_LOADED`/`END_FILE`); message generic (wrapper hides reason) (`android/g7-onerror-android.txt`) |

Android G2–G7 verified on a headless arm64 Android-36 emulator against the
**stock r27 AAR** (NDK pinned to React Native's, fixing the libc++ skew that
previously blocked load — `android/g2b-libcxx-skew.txt`). Runtime details:
`android/g3-g4-g6-g7-runtime.md`.

**All gates pass on both platforms.** G5 (hardware decode) verified on physical
devices: iPhone 14 Pro / VideoToolbox (`ios/g5-hwdec.txt`) and Retroid Pocket 6 /
Snapdragon MediaCodec (`android/g5-hwdec.md`), both H.264 + HEVC, 0 dropped
frames. iOS G2–G4/G6/G7 were verified on the Simulator; G5 confirms the device
hwdec path. (Aside: device testing showed HTTPS works on iOS — a CDN probe got an
HTTP 403, i.e. the TLS handshake succeeded.)
