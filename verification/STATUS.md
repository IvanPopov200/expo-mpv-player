# Gate status (single source of truth)

Update this table **only** when the artifact exists in this directory. Legend:
✅ artifact committed · ⏳ implemented, not yet verified · ⛔ blocked · n/a.

| Gate | iOS | Android | Notes |
|---|---|---|---|
| G0 static | ✅ | ✅ | CI green on every PR |
| G1 LGPL provenance | n/a | ✅ | Android build output: FFmpeg `CONFIG_GPL 0` + mpv `gpl=false`, verifier PASSED (`lgpl/verify-output.txt`). iOS uses MPVKit LGPL |
| G2 compile+link | ✅ | ✅ | iOS sim build succeeded (PR #7); Android example assembles with the LGPL AAR linked, libmpv/FFmpeg `.so`s + module classes in the APK (`android/g2-compile.md`) |
| G3 launch | ✅ | 🅟 | iOS launches; +20× mount/unmount stress, no crash (`ios/g3-teardown-stress.md`). Android: UI + view instantiate on emulator (`android/g3-g4-g6-g7-runtime.md`) — see 🅟 caveat |
| G4 render | ✅ | 🅟 | iOS renders video (`ios/g4-render.png`); root cause was a React version mismatch, fixed by pinning react 19.2.3. Android: `gpu-next` renders `sample.mp4` on emulator (`android/g4-render.png`) — see 🅟 caveat |
| G5 hwdec (device) | ⏳ | ⏳ | physical device required |
| G6 headers | ✅ | 🅟 | iOS: exact comma-bearing header reaches the server (`ios/g6-headers.*`). Android: same exact header → `206` on emulator (`android/g6-headers.json`) — see 🅟 caveat |
| G7 onError | ✅ | ⛔ | iOS: 401 → on"loading failed" (`ios/g7-onerror.md`). Android: JNI wrapper's `EventObserver.event(int)` carries no end-file reason (binary-verified) — cannot fire onError; documented limitation |

**🅟 = player stack verified, but the stock AAR is blocked by an NDK/libc++
skew.** The AAR is built with NDK r29 (clang 21); a stock RN app bundles RN's
NDK r27 (clang 18) `libc++_shared.so`, so `dlopen(libmpv.so)` fails with
`UnsatisfiedLinkError` and the view never loads (`android/g2b-libcxx-skew.txt`).
The Android G3/G4/G6 runs above used a debug APK repackaged with the AAR's
compatible libc++ — symbol-equivalent to the real fix, so they validate the
player. The production fix (pin the AAR build to RN's NDK r27) is committed in
`android/libmpv-build/build-lgpl-aar.sh`; the AAR must be rebuilt in CI and these
gates re-verified on the **unpatched** app before they become ✅.

iOS G4 verified on the simulator (software decode). G5 (hwdec) still needs a
physical device on both platforms.
