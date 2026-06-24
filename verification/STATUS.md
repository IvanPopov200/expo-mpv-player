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
| G5 hwdec (device) | ⏳ | ✅ | Android: H.264 + HEVC hardware decode on a physical Retroid Pocket 6 (Snapdragon 8 Gen 2) — `c2.qti.{avc,hevc}.decoder`, `hwdec: mediacodec-copy`, 0 dropped frames (`android/g5-hwdec.md`). iOS: needs a physical device (`G5-HANDOFF.md`) |
| G6 headers | ✅ | ✅ | iOS: exact comma-bearing header reaches the server (`ios/g6-headers.*`). Android: same exact header → `206`, unpatched app (`android/g6-headers.json`) |
| G7 onError | ✅ | ✅ | iOS: 401 → on"loading failed" (`ios/g7-onerror.md`). Android: 401 → `onError` via event-ordering inference (`START_FILE`/`FILE_LOADED`/`END_FILE`); message generic (wrapper hides reason) (`android/g7-onerror-android.txt`) |

Android G2–G7 verified on a headless arm64 Android-36 emulator against the
**stock r27 AAR** (NDK pinned to React Native's, fixing the libc++ skew that
previously blocked load — `android/g2b-libcxx-skew.txt`). Runtime details:
`android/g3-g4-g6-g7-runtime.md`.

Android G5 (hardware decode) verified on a physical Retroid Pocket 6
(`android/g5-hwdec.md`). iOS G4 verified on the simulator (software decode).
**iOS G5 (VideoToolbox hardware decode) is the only open gate** — it needs a
physical iPhone/iPad (`G5-HANDOFF.md`).
