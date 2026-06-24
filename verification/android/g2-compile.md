# G2 — Android example compiles & links the LGPL libmpv AAR

**Gate:** The example app assembles with the custom LGPL libmpv AAR linked, the
module's Kotlin compiled, and the libmpv/FFmpeg native libraries packaged into
the APK.

**Status:** PASSED (compile/link only — this is *not* a runtime/render claim; see
G4/G6/G7 for runtime behavior, still pending on an emulator).

## Environment

- Host: macOS (darwin 25.3.0, arm64)
- JDK: `openjdk@17` (`/opt/homebrew/opt/openjdk@17`)
- Android SDK: `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`
- NDK: `27.1.12297006` (auto-installed by AGP)
- AAR: `android/libs/expo-mpv-player-libmpv-lgpl-0.1.0.aar` (the verified-LGPL
  build from `android/libmpv-build/`, see `verification/lgpl/`)

## Commands

```bash
# config plugin raises android.minSdkVersion to 26 (libmpv .so's need API 26)
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --no-daemon
```

`android/gradle.properties` after prebuild (written by the config plugin):

```
reactNativeArchitectures=arm64-v8a,x86_64
android.minSdkVersion=26
```

## Result

```
BUILD SUCCESSFUL in 52s
181 actionable tasks: 153 executed, 28 up-to-date
```

Full tail: `g2-build-tail.txt`.

## Evidence the AAR is actually linked (not compiled-around)

`app-debug.apk` (≈66 MB) bundles the full libmpv + FFmpeg stack for arm64-v8a —
see `g2-apk-libs.txt`. Key entries:

```
   6452840  lib/arm64-v8a/libmpv.so
     19456  lib/arm64-v8a/libplayer.so
  11967352  lib/arm64-v8a/libavcodec.so
   2974544  lib/arm64-v8a/libavformat.so
    726872  lib/arm64-v8a/libavutil.so
    141536  lib/arm64-v8a/libavfilter.so
      9128  lib/arm64-v8a/libavdevice.so
     96656  lib/arm64-v8a/libswresample.so
   1152648  lib/arm64-v8a/libswscale.so
```

DEX classes (via `dexdump`) confirm both the module and the AAR's JNI binding
are packaged:

```
Lexpo/modules/mpvplayer/MpvPlayerModule
Lexpo/modules/mpvplayer/MpvPlayerView
Lexpo/modules/mpvplayer/MPVRenderer
Lexpo/modules/mpvplayer/MpvRendererDelegate
Lexpo/modules/mpvplayer/MpvLoadConfig
Ldev/jdtech/mpv/MPVLib            <- libmpv JNI wrapper from the AAR
```

## Bugs this gate caught (only a real build finds these)

1. **Module `android/build.gradle` declared no `compileSdk`.** Newer AGP requires
   it. Fixed by calling Expo's `useDefaultAndroidSdkVersions()` (compileSdk 36),
   then overriding `minSdk` to 26.
2. **Consumer app `minSdkVersion` (24) < library `minSdk` (26).** Manifest merge
   failed. Fixed in the config plugin: `ensureMinSdkVersion` raises
   `android.minSdkVersion` to ≥ 26 in `gradle.properties` for every consumer
   (never lowers an already-higher value). Covered by unit tests.
