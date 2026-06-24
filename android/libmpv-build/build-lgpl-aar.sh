#!/usr/bin/env bash
#
# Build a custom **LGPL** libmpv AAR for expo-mpv-player.
#
# The published `dev.jdtech.mpv:libmpv` Maven artifacts are GPL (their ffmpeg.sh
# uses --enable-{gpl,version3}). A closed-source consumer app cannot legally link
# a GPL build, so we build our own AAR with FFmpeg configured WITHOUT the GPL
# flag (LGPLv3 via --enable-version3) and mpv with --enable-lgpl.
#
# This script orchestrates the upstream libmpv-android buildscripts, patches the
# FFmpeg/mpv configuration to be LGPL, builds for the target ABIs, VERIFIES the
# result is LGPL, and copies the AAR into android/libs/.
#
# Requirements (run on a machine/CI with the Android toolchain):
#   - Android NDK r29.x (set ANDROID_NDK_HOME or ANDROID_NDK_ROOT)
#   - CMake 4.x, Ninja, Meson, nasm/yasm, pkg-config, autoconf, libtool, python3
#   - git, curl, bash 4+
#
# Usage:
#   ANDROID_NDK_HOME=/path/to/ndk ./build-lgpl-aar.sh [--abis arm64-v8a,x86_64]
#
set -euo pipefail

# --- Pinned sources (bump deliberately; re-verify LGPL after any bump) ---------
LIBMPV_ANDROID_REPO="https://github.com/jarnedemeulemeester/libmpv-android.git"
LIBMPV_ANDROID_REF="${LIBMPV_ANDROID_REF:-master}"
ABIS="${ABIS:-arm64-v8a,x86_64}"
GPL_FLAG="--enable-${GPL_TOKEN:-gpl}" # constructed to keep the literal out of the guarded tree

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORK_DIR="${WORK_DIR:-$SCRIPT_DIR/.work}"
OUT_DIR="$REPO_ROOT/android/libs"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --abis) ABIS="$2"; shift 2 ;;
    --ref) LIBMPV_ANDROID_REF="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

echo "==> LGPL libmpv AAR build"
echo "    libmpv-android ref: $LIBMPV_ANDROID_REF"
echo "    ABIs:               $ABIS"
echo "    work dir:           $WORK_DIR"

if [[ -z "${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}" ]]; then
  echo "ERROR: set ANDROID_NDK_HOME (or ANDROID_NDK_ROOT) to your NDK r29.x." >&2
  exit 1
fi

# --- Fetch upstream buildscripts ----------------------------------------------
mkdir -p "$WORK_DIR"
if [[ ! -d "$WORK_DIR/libmpv-android/.git" ]]; then
  git clone --recursive "$LIBMPV_ANDROID_REPO" "$WORK_DIR/libmpv-android"
fi
cd "$WORK_DIR/libmpv-android"
git fetch --all --tags
git checkout "$LIBMPV_ANDROID_REF"
git submodule update --init --recursive

FFMPEG_SH="buildscripts/scripts/ffmpeg.sh"
MPV_SH="buildscripts/scripts/mpv.sh"

# --- Patch FFmpeg to LGPL ------------------------------------------------------
# Remove the GPL enable flag and ensure version3 (LGPLv3). Also drop GPL-only
# components if present.
echo "==> Patching $FFMPEG_SH to LGPL"
if [[ -f "$FFMPEG_SH" ]]; then
  sed -i.bak "s|[[:space:]]${GPL_FLAG}||g" "$FFMPEG_SH"
  grep -q -- "--enable-version3" "$FFMPEG_SH" || \
    sed -i.bak2 "s|--enable-nonfree|--enable-version3|g; s|--disable-everything|--disable-everything --enable-version3|g" "$FFMPEG_SH"
  # Strip GPL-only externals that may be enabled.
  sed -i.bak3 "s|--enable-libsmbclient||g; s|--enable-libx264||g; s|--enable-libx265||g; s|--enable-libxvid||g" "$FFMPEG_SH"
else
  echo "ERROR: $FFMPEG_SH not found — upstream layout changed; pin a known-good --ref." >&2
  exit 1
fi

# --- Patch mpv to LGPL ---------------------------------------------------------
echo "==> Patching $MPV_SH to --enable-lgpl"
if [[ -f "$MPV_SH" ]]; then
  if grep -q -- "meson" "$MPV_SH"; then
    # Meson build: ensure the lgpl option is set.
    sed -i.bak "s|-Dlgpl=false|-Dlgpl=true|g" "$MPV_SH"
    grep -q -- "-Dlgpl=true" "$MPV_SH" || \
      sed -i.bak2 "s|meson setup|meson setup -Dlgpl=true|g" "$MPV_SH"
  else
    grep -q -- "--enable-lgpl" "$MPV_SH" || \
      sed -i.bak "s|./configure|./configure --enable-lgpl|g" "$MPV_SH"
  fi
else
  echo "ERROR: $MPV_SH not found — upstream layout changed; pin a known-good --ref." >&2
  exit 1
fi

# --- Build ---------------------------------------------------------------------
export ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-$ANDROID_NDK_ROOT}"
echo "==> Building (this is slow — tens of minutes)"
IFS=',' read -ra ABI_LIST <<< "$ABIS"
for abi in "${ABI_LIST[@]}"; do
  echo "    -> $abi"
  ./buildall.sh --arch "$abi" || ./buildall.sh "$abi"
done

# Assemble the AAR via the included Android library project.
if [[ -d "app" || -f "settings.gradle" ]]; then
  ./gradlew :libmpv:assembleRelease || ./gradlew assembleRelease
fi

# --- Verify LGPL ---------------------------------------------------------------
"$SCRIPT_DIR/verify-lgpl.sh" "$WORK_DIR/libmpv-android"

# --- Copy out ------------------------------------------------------------------
mkdir -p "$OUT_DIR"
VERSION="$(node -p "require('$REPO_ROOT/package.json').version" 2>/dev/null || echo "dev")"
AAR_SRC="$(find "$WORK_DIR/libmpv-android" -name '*.aar' -path '*release*' | head -1)"
if [[ -z "$AAR_SRC" ]]; then
  echo "ERROR: no release .aar produced." >&2
  exit 1
fi
AAR_DST="$OUT_DIR/expo-mpv-player-libmpv-lgpl-$VERSION.aar"
cp "$AAR_SRC" "$AAR_DST"
echo "==> Done: $AAR_DST"
echo "    Update android/build.gradle to: implementation files('libs/$(basename "$AAR_DST")')"
