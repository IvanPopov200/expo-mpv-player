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

## Remaining (toolchain-heavy) steps

- ⏳ **Build the LGPL AAR** — `android/libmpv-build/build-lgpl-aar.sh` cross-
  compiles FFmpeg + mpv with the NDK (tens of minutes). This is the project's
  highest-risk item; it runs via `android-aar.yml`.
- ⏳ **Full Gradle compile / run** — `gradlew :app:assembleDebug` on the example
  needs the SDK platform + NDK + the LGPL AAR in `android/libs/`, then an
  emulator/device. The hardware-decode smoke test (`hwdec=mediacodec-copy`)
  needs a real device.

The Kotlin API audit gives high confidence the sources compile against the AAR;
the Gradle build is the mechanical confirmation plus the native binary.
