#!/usr/bin/env bash
#
# Build a custom **LGPL** libmpv AAR for expo-mpv-player.
#
# The published dev.jdtech.mpv:libmpv artifacts are GPL: upstream ffmpeg.sh
# configures FFmpeg with `--enable-{gpl,version3}` and mpv.sh does NOT pass
# `-Dgpl=false` (mpv's meson `gpl` option defaults to true). A closed-source
# consumer app cannot legally link a GPL build, so we patch both to LGPL:
#   - FFmpeg: `--enable-{gpl,version3}` -> `--enable-version3`  (LGPLv3, no GPL)
#   - mpv:    add `-Dgpl=false` to the meson setup line
# then build, VERIFY from build output (see verify-lgpl.sh), and copy out the AAR.
#
# This orchestrates the upstream buildscripts (download.sh -> patch.sh ->
# build.sh) at a PINNED ref. Designed to run on Linux CI (ubuntu); upstream's
# download.sh installs the SDK/NDK + OS deps there.
#
# Usage:
#   ./build-lgpl-aar.sh [--ref <tag>] [--archs "arm64 x86_64"]
#
set -euo pipefail

LIBMPV_ANDROID_REPO="https://github.com/jarnedemeulemeester/libmpv-android.git"
# PINNED — bump deliberately and re-run verify-lgpl after any bump.
LIBMPV_ANDROID_REF="${LIBMPV_ANDROID_REF:-v1.0.0}"
# Upstream arch names: armv7l arm64 x86 x86_64. Empty = all (full mpv-android
# target, which also assembles the AAR). The consumer app trims ABIs via
# reactNativeArchitectures (set by the config plugin).
ARCHS="${ARCHS:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="${WORK_DIR:-$SCRIPT_DIR/.work}"
SRC_DIR="$WORK_DIR/libmpv-android"
OUT_DIR="$REPO_ROOT/android/libs"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) LIBMPV_ANDROID_REF="$2"; shift 2 ;;
    --archs) ARCHS="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "==> LGPL libmpv AAR build (ref=$LIBMPV_ANDROID_REF archs=${ARCHS:-all})"

# --- Fetch upstream buildscripts at the pinned ref ----------------------------
mkdir -p "$WORK_DIR"
if [[ ! -d "$SRC_DIR/.git" ]]; then
  git clone "$LIBMPV_ANDROID_REPO" "$SRC_DIR"
fi
git -C "$SRC_DIR" fetch --all --tags
git -C "$SRC_DIR" checkout "$LIBMPV_ANDROID_REF"
git -C "$SRC_DIR" submodule update --init --recursive

cd "$SRC_DIR/buildscripts"
FFMPEG_SH="scripts/ffmpeg.sh"
MPV_SH="scripts/mpv.sh"

# --- Pin the NDK to match React Native's (avoid a libc++ ABI skew) ------------
# Upstream depinfo.sh pins a bleeding-edge NDK (v1.0.0 -> r29 / clang 21). The
# resulting libmpv.so then references libc++ symbols (e.g.
# std::__from_chars_floating_point<float>) that are ABSENT from the older libc++
# a React Native app bundles (RN 0.85 -> NDK r27 / clang 18). At runtime the app
# packages RN's libc++_shared.so and `dlopen(libmpv.so)` fails with
# UnsatisfiedLinkError, so MpvPlayerView never instantiates. Building libmpv with
# RN's NDK keeps it within that older libc++'s symbol set, so the .so loads in a
# stock app. Verified empirically (verification/android/g2b-libcxx-skew.txt).
# Bump this only in lockstep with React Native's bundled NDK.
NDK_VERSION="${NDK_VERSION:-27.1.12297006}"
[[ -f include/depinfo.sh ]] || { echo "ERROR: include/depinfo.sh missing — pin a known --ref." >&2; exit 1; }
sed -i.bak "s/^v_ndk=.*/v_ndk=$NDK_VERSION/" include/depinfo.sh
grep -q "^v_ndk=$NDK_VERSION\$" include/depinfo.sh || { echo "ERROR: failed to pin v_ndk to $NDK_VERSION" >&2; exit 1; }
echo "==> Pinned NDK to $NDK_VERSION (React-Native-compatible libc++)"

# --- Download sources + SDK/NDK, apply upstream patches -----------------------
# download.sh installs the SDK/NDK and OS deps (Linux) and fetches sources.
./download.sh
./patch.sh

# --- Patch FFmpeg to LGPL -----------------------------------------------------
echo "==> Patching $FFMPEG_SH: strip gpl from the --enable-{gpl,version3} brace"
[[ -f "$FFMPEG_SH" ]] || { echo "ERROR: $FFMPEG_SH missing — pin a known --ref." >&2; exit 1; }
sed -i.bak 's/--enable-{gpl,version3}/--enable-version3/g' "$FFMPEG_SH"
# Fail-closed: no 'gpl' may remain in any --enable group or as a bare flag.
if grep -Eq -- '--enable-\{[^}]*gpl|--enable-gpl([ \\]|$)' "$FFMPEG_SH"; then
  echo "ERROR: FFmpeg still enables gpl after patch:" >&2
  grep -nE -- '--enable-\{[^}]*gpl|--enable-gpl' "$FFMPEG_SH" >&2
  exit 1
fi
grep -q -- '--enable-version3' "$FFMPEG_SH" || { echo "ERROR: --enable-version3 missing" >&2; exit 1; }

# --- Patch mpv to LGPL --------------------------------------------------------
echo "==> Patching $MPV_SH: add -Dgpl=false to meson setup"
[[ -f "$MPV_SH" ]] || { echo "ERROR: $MPV_SH missing — pin a known --ref." >&2; exit 1; }
if ! grep -q -- '-Dgpl=false' "$MPV_SH"; then
  sed -i.bak 's/-Dmanpage-build=disabled/-Dmanpage-build=disabled -Dgpl=false/' "$MPV_SH"
fi
grep -q -- '-Dgpl=false' "$MPV_SH" || { echo "ERROR: failed to set -Dgpl=false in mpv meson" >&2; exit 1; }

# --- Build --------------------------------------------------------------------
# Build the native engine per ABI, then assemble ONLY the :libmpv AAR (not the
# upstream `mpv-android` target, which also builds the demo app).
echo "==> Building (slow — tens of minutes)"
BUILD_ARCHS="${ARCHS:-arm64 x86_64}"
for a in $BUILD_ARCHS; do ./build.sh --arch "$a" mpv; done

# Restrict the :libmpv module's CMake to exactly the ABIs we built. Without this,
# AGP builds libplayer.so for all 4 default ABIs and fails on the ones we skipped
# (their libmpv.so doesn't exist). Map upstream arch names -> Android ABI names.
declare -A ABI_MAP=([arm64]=arm64-v8a [x86_64]=x86_64 [armv7l]=armeabi-v7a [x86]=x86)
abi_csv=""
for a in $BUILD_ARCHS; do abi_csv="$abi_csv\"${ABI_MAP[$a]}\", "; done
abi_csv="${abi_csv%, }"
GRADLE_KTS="$SRC_DIR/libmpv/build.gradle.kts"
if ! grep -q 'abiFilters' "$GRADLE_KTS"; then
  sed -i.bak "s/        minSdk = 26/        minSdk = 26\n        ndk { abiFilters += listOf($abi_csv) }/" "$GRADLE_KTS"
fi
grep -q 'abiFilters' "$GRADLE_KTS" || { echo "ERROR: failed to inject abiFilters into $GRADLE_KTS" >&2; exit 1; }
echo "==> :libmpv ABIs restricted to: $abi_csv"

# --- Verify LGPL from BUILD OUTPUT (fail-closed) BEFORE assembling ------------
"$SCRIPT_DIR/verify-lgpl.sh" "$SRC_DIR" "$REPO_ROOT/verification/lgpl"

# --- Assemble only the LGPL AAR -----------------------------------------------
echo "==> Assembling :libmpv AAR"
( cd "$SRC_DIR" && ./gradlew :libmpv:assembleRelease )

# --- Copy out the AAR ---------------------------------------------------------
mkdir -p "$OUT_DIR"
VERSION="$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo dev)"
AAR_SRC="$(find "$SRC_DIR" -name '*.aar' -path '*release*' | head -1)"
[[ -n "$AAR_SRC" ]] || { echo "ERROR: no release .aar produced." >&2; exit 1; }
AAR_DST="$OUT_DIR/expo-mpv-player-libmpv-lgpl-$VERSION.aar"
cp "$AAR_SRC" "$AAR_DST"
echo "==> Done: $AAR_DST"
echo "    Then set in android/build.gradle: implementation files('libs/$(basename "$AAR_DST")')"
