# Verification artifacts & gate ladder

This directory holds **evidence** that runtime behaviors actually work. Per the
project's Evidence-Gated Claims rule, a fix may be called "verified/works/
renders/plays" only when its gate below has been run **and its artifact is
committed here** (logs as `.txt`, screenshots as `.png`, captured JSON).
"Compiles"/"builds"/"links" is **not** "works".

## The gate ladder

| Gate | Proves | Runs on | Artifact |
|---|---|---|---|
| G0 | TS static checks | CI | CI green |
| G1 | engine is **LGPL** not GPL | build host | `lgpl/` — FFmpeg `config.h` `CONFIG_GPL 0`, mpv `gpl=false`, verifier output |
| G2 | native compile + link | iOS/Android build host | build-log tail (`BUILD SUCCEEDED` / `assembleDebug`) |
| G3 | launch, native module loads | sim/emulator | launch log + screenshot |
| G4 | `<MpvPlayerView>` renders **frames** | sim/emulator (software-decodable stream) | screenshot of video pixels + console log |
| G5 | direct-play via **hwdec** | **physical device** | screenshot + `getTechnicalInfo()` JSON (`hwdec` active, expected codec) |
| G6 | auth headers (incl. comma value) | sim/emulator + fixture | fixture `/log` showing the exact header + file loaded |
| G7 | failures fire `onError` | sim/emulator + fixture | screenshot/log of `onError` payload on 401 / bad URL |

> **G4 vs G5:** iOS simulators can't use VideoToolbox and Android emulators
> generally can't use MediaCodec hwdec. G4 (shows *any* video, software decode)
> is provable on a sim/emulator; **G5 (direct-plays the hard file via hwdec) is
> only provable on real hardware** — never report G5 from a simulator.

## Fixture server (G6/G7)

```sh
# 1. generate the small sample once (gitignored):
ffmpeg -f lavfi -i testsrc=duration=5:size=320x240:rate=15 \
       -f lavfi -i sine=frequency=440:duration=5 \
       -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest \
       verification/assets/sample.mp4
# (video-only is fine too:
#  ffmpeg -f lavfi -i testsrc=duration=5:size=320x240:rate=15 \
#         -c:v libx264 -pix_fmt yuv420p verification/assets/sample.mp4)

# 2. run the server (binds 0.0.0.0:8099 so a device/emulator can reach the host):
node example/scripts/fixture-server.mjs --port 8099
```

Routes: `/ok` (200 only with the exact comma-bearing `Authorization`), `/unauth`
(401), `/notfound` (404), `/log` (captured requests as JSON), `/reset-log`.

The expected header is
`MediaBrowser Client="ExpoMpvPlayer", Token="fixture-token-123"` — its comma is
exactly what the naive header-join bug corrupts.

In the example app, the **Fixture** buttons point `source` at these routes; the
**Copy technical info** button dumps `getTechnicalInfo()` + last
`onProgress`/`onError` to the console.

## How to capture evidence

**iOS simulator**

```sh
xcrun simctl boot "iPhone 17 Pro"
xcrun simctl install booted <path>.app
xcrun simctl launch booted com.expompvplayer.example
xcrun simctl io booted screenshot verification/ios/g4-render.png
xcrun simctl spawn booted log stream --predicate \
  'subsystem == "expo-mpv-player"' > verification/ios/g4.log
```

**Android emulator/device**

```sh
adb install -r <path>.apk
adb shell am start -n com.expompvplayer.example/.MainActivity
adb exec-out screencap -p > verification/android/g4-render.png
adb logcat -s mpv:* ExpoMpvPlayer:* > verification/android/g4.log
```

## Status of each gate

See `STATUS.md` in this directory — it is the single source of truth for which
gates have artifacts. Do not claim a gate green without updating it AND adding
the artifact.
