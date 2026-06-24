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

Run on **Linux** (this is what upstream supports). Upstream's `download.sh`
installs the Android SDK/NDK and the OS build deps for you on Debian/Ubuntu and
RHEL/Fedora, so the only hard prerequisites are `git`, `curl`, `bash`, and
`python3` (the GitHub `ubuntu-latest` runner is the reference environment).

## Build

```sh
./build-lgpl-aar.sh                      # all archs, assembles the AAR
./build-lgpl-aar.sh --archs "arm64 x86_64"   # subset (upstream arch names)
./build-lgpl-aar.sh --ref v1.0.0         # pin a different libmpv-android tag
```

This:

1. Clones `jarnedemeulemeester/libmpv-android` at the **pinned** ref
   (default `v1.0.0`).
2. Runs upstream `download.sh` (SDK/NDK + sources) and `patch.sh`.
3. Patches the build to **LGPL**, fail-closed:
   - FFmpeg `ffmpeg.sh`: `--enable-{gpl,version3}` → `--enable-version3`, then
     asserts no `gpl` token remains in any `--enable{…}` group.
   - mpv `mpv.sh`: adds **`-Dgpl=false`** to `meson setup` (mpv's `gpl` option
     defaults to `true`; there is **no** `-Dlgpl`).
4. Builds (upstream `build.sh`) and assembles the AAR.
5. Runs `verify-lgpl.sh` (below) and **fails** unless it passes.
6. Copies the result to `android/libs/expo-mpv-player-libmpv-lgpl-<version>.aar`.

Then enable the dependency in `android/build.gradle`:

```gradle
implementation files('libs/expo-mpv-player-libmpv-lgpl-<version>.aar')
```

## Verify only (build-output authoritative, fail-closed)

```sh
./verify-lgpl.sh .work/libmpv-android [verification/lgpl]
```

It inspects the **generated** FFmpeg `config.h` (requires `CONFIG_GPL 0`, not
`NONFREE`) and mpv's meson `intro-buildoptions.json` (requires `gpl=false`). A
missing artifact is a **failure** — a build that didn't complete cannot pass.

## CI

`.github/workflows/android-aar.yml` runs this on demand / monthly on
`ubuntu-latest`, uploads the AAR **and** the G1 evidence (`config.h` snippet,
mpv gpl option, verifier output). PR CI consumes the prebuilt AAR.

## ⚠️ Binary build is a toolchain step

The AAR is a native binary; it is **not** committed to git (see `.gitignore`).
Produce it with the workflow or this script on an Android-toolchain machine. The
plan flags this as the project's highest-risk item — if a build cannot be made
LGPL, **do not** fall back to the GPL artifact; escalate.
