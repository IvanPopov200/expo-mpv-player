# Android integration & validation status

## Engine: a custom LGPL libmpv AAR

Android links a custom **LGPL** `libmpv` AAR built from the public scripts in
[`android/libmpv-build/`](../android/libmpv-build/) (FFmpeg without
`--enable-gpl`; mpv `--enable-lgpl`). The prebuilt GPL Maven artifact is never
used. The Kotlin targets the **1.0.0 instance JNI API** (`MPVLib.create(context)`).

## Validation status

Verified on this machine (Android SDK cmdline-tools, JDK 17):

- ✅ **Config plugin** — `expo prebuild --platform android` runs the plugin
  against a real project and produces the expected mods: `INTERNET` permission,
  PiP `<uses-feature required=false>`, `usesCleartextTraffic="true"` (when opted
  in), the `DEFAULT_VO_DRIVER` `<meta-data>`, and
  `reactNativeArchitectures=arm64-v8a,x86_64` in `gradle.properties`.
- ✅ **Kotlin API audit** — every `MPVLib` call the renderer makes
  (`create`, `init`, `command`, `get/setProperty{Int,Double,Boolean,String}`,
  `observeProperty(name, format)`, `addObserver`/`removeObserver`,
  `attachSurface`/`detachSurface`/`destroy`), the 6-method `EventObserver`
  interface, and the `MpvFormat`/`MpvEvent` constants match the authoritative
  upstream `dev.jdtech.mpv.MPVLib` (libmpv-android `main`) exactly. The Expo
  Modules Kotlin DSL used (`Module`/`ModuleDefinition`, `Name`, `View`,
  `Events`, `Prop`, `AsyncFunction`, `OnViewDestroys`, `ExpoView(context,
  appContext)`, `by EventDispatcher()`) matches the installed
  `expo-modules-core`.

## NDK version (must match React Native's)

`build-lgpl-aar.sh` pins the NDK to **r27 (`27.1.12297006`)** — the version
React Native 0.85 bundles. This is deliberate: libmpv links `libc++_shared.so`,
and a prebuilt `.so` only loads if its libc++ symbols are a subset of the one the
consumer app packages. Upstream `libmpv-android` defaults to a bleeding-edge NDK
(r29 / clang 21), whose `libmpv.so` references libc++ symbols
(`std::__from_chars_floating_point`) that RN's older libc++ lacks → a runtime
`UnsatisfiedLinkError` and the view never loads. Override with `NDK_VERSION=…`
only in lockstep with RN's bundled NDK. See
`verification/android/g2b-libcxx-skew.txt`.

## Status

- ✅ **G2 — assemble + link.** `gradlew :app:assembleDebug` builds the example
  with the LGPL AAR linked (`verification/android/g2-compile.md`).
- 🅟 **G3/G4/G6 — runtime** verified on an arm64 emulator (gpu-next renders the
  sample clip, exact comma-bearing auth header reaches the server). These ran on
  a debug APK repackaged with the AAR's compatible libc++; re-verify on a stock
  AAR rebuilt with the r27 pin above. See `verification/android/`.
- ⛔ **G7 — onError:** the prebuilt JNI wrapper's `EventObserver.event(int)`
  carries no end-file reason, so the module cannot fire `onError` on a load
  failure (iOS can). Documented limitation.
- ⏳ **G5 — hardware decode** (`hwdec=mediacodec-copy`) needs a real device.
