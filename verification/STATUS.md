# Gate status (single source of truth)

Update this table **only** when the artifact exists in this directory. Legend:
✅ artifact committed · ⏳ implemented, not yet verified · ⛔ blocked · n/a.

| Gate | iOS | Android | Notes |
|---|---|---|---|
| G0 static | ✅ | ✅ | CI green on every PR |
| G1 LGPL provenance | n/a | ✅ | Android build output: FFmpeg `CONFIG_GPL 0` + mpv `gpl=false`, verifier PASSED (`lgpl/verify-output.txt`). iOS uses MPVKit LGPL |
| G2 compile+link | ✅ | ✅ | iOS sim build succeeded (PR #7); Android example assembles with the LGPL AAR linked, libmpv/FFmpeg `.so`s + module classes in the APK (`android/g2-compile.md`) |
| G3 launch | ✅ | ⏳ | iOS launches; +20× mount/unmount stress, no crash (`ios/g3-teardown-stress.md`). Android: needs emulator |
| G4 render | ✅ | ⏳ | iOS renders video (`ios/g4-render.png`); root cause was a React version mismatch, fixed by pinning react 19.2.3. Android: needs emulator |
| G5 hwdec (device) | ⏳ | ⏳ | physical device required |
| G6 headers | ✅ | ⏳ | iOS: exact comma-bearing header reaches the server (`ios/g6-headers.*`). Android code done, needs emulator |
| G7 onError | ✅ | ⏳ | iOS: 401 → on"loading failed" (`ios/g7-onerror.md`). Android: wrapper lacks END_FILE reason (documented) |

iOS G4 verified on the simulator (software decode). G5 (hwdec) still needs a
physical device. Android now compiles & links the LGPL AAR (G2 ✅); its runtime
gates (G3/G4/G6/G7) await an emulator run.
