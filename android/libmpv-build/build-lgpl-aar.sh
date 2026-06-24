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
echo "==> Building (slow — tens of minutes)"
if [[ -z "$ARCHS" ]]; then
  ./build.sh                       # all archs + assemble the AAR (mpv-android)
else
  for a in $ARCHS; do ./build.sh --arch "$a" mpv; done
  ./build.sh -n mpv-android        # assemble using the built jniLibs
fi

# --- Verify LGPL from BUILD OUTPUT (fail-closed) ------------------------------
"$SCRIPT_DIR/verify-lgpl.sh" "$SRC_DIR"

# --- Copy out the AAR ---------------------------------------------------------
mkdir -p "$OUT_DIR"
VERSION="$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo dev)"
AAR_SRC="$(find "$SRC_DIR" -name '*.aar' -path '*release*' | head -1)"
[[ -n "$AAR_SRC" ]] || { echo "ERROR: no release .aar produced." >&2; exit 1; }
AAR_DST="$OUT_DIR/expo-mpv-player-libmpv-lgpl-$VERSION.aar"
cp "$AAR_SRC" "$AAR_DST"
echo "==> Done: $AAR_DST"
echo "    Then set in android/build.gradle: implementation files('libs/$(basename "$AAR_DST")')"
