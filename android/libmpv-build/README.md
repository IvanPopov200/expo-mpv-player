# Android LGPL libmpv build

This directory builds the **LGPL** libmpv AAR that `expo-mpv-player` links on
Android. Keeping these scripts public is both good practice and material to the
LGPL source-availability obligation (see the repo `NOTICE`).

## Why a custom build

The published `dev.jdtech.mpv:libmpv` Maven artifacts are **GPL** — their
`ffmpeg.sh` configures FFmpeg with the GPL flag. A closed-source consumer app
**cannot legally link a GPL build**. So we build our own:

- **FFmpeg:** configured **without** the GPL flag, using `--enable-version3`
  (LGPLv3).
- **mpv:** configured with `--enable-lgpl`.

The MIT license on the upstream POM covers only the JNI wrapper class
(`dev.jdtech.mpv.MPVLib`), **not** the linked native libraries — those follow
whatever FFmpeg/mpv were built as. That is exactly why this build exists.

## Requirements

Run on a machine or CI runner with the Android native toolchain:

- Android NDK **r29.x** (`ANDROID_NDK_HOME` or `ANDROID_NDK_ROOT`)
- CMake 4.x, Ninja, Meson, nasm/yasm, pkg-config, autoconf, libtool, python3
- git, curl, bash 4+

## Build

```sh
ANDROID_NDK_HOME=/path/to/ndk ./build-lgpl-aar.sh --abis arm64-v8a,x86_64
```

This:

1. Clones the upstream `jarnedemeulemeester/libmpv-android` buildscripts at a
   pinned ref.
2. Patches the FFmpeg config to LGPL (removes the GPL flag, ensures
   `--enable-version3`, drops GPL-only externals) and mpv to `--enable-lgpl`.
3. Builds for the requested ABIs (`arm64-v8a` + `x86_64` by default).
4. Runs `verify-lgpl.sh` to confirm the produced FFmpeg reports `CONFIG_GPL 0`.
5. Copies the result to `android/libs/expo-mpv-player-libmpv-lgpl-<version>.aar`.

Then enable the dependency in `android/build.gradle`:

```gradle
implementation files('libs/expo-mpv-player-libmpv-lgpl-<version>.aar')
```

## Verify only

```sh
./verify-lgpl.sh .work/libmpv-android
```

## CI

`.github/workflows/android-aar.yml` runs this on demand (and on a schedule),
verifies LGPL, and uploads the AAR as a release artifact. PR CI consumes the
prebuilt AAR rather than rebuilding it (the build takes tens of minutes).

## ⚠️ Binary build is a toolchain step

The AAR is a native binary; it is **not** committed to git (see `.gitignore`).
Produce it with the workflow or this script on an Android-toolchain machine. The
plan flags this as the project's highest-risk item — if a build cannot be made
LGPL, **do not** fall back to the GPL artifact; escalate.
