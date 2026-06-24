#!/usr/bin/env bash
#
# Verify — from BUILD OUTPUT, fail-closed — that a libmpv-android build tree is
# LGPL (no GPL FFmpeg, mpv gpl=false). Run after build-lgpl-aar.sh.
#
# This does NOT grep build-script source (which can pass falsely). It inspects:
#   - FFmpeg's generated config.h  -> require CONFIG_GPL 0 (and not NONFREE)
#   - mpv's meson intro-buildoptions.json -> require gpl=false
# A missing artifact is a FAILURE (a build that didn't complete must not pass).
#
# Usage: verify-lgpl.sh <libmpv-android-tree> [<out-dir-for-snippets>]
#
set -euo pipefail

ROOT="${1:-.}"
OUT="${2:-}"
fail=0
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

echo "==> LGPL verification (build-output authoritative, fail-closed)"
echo "    tree: $ROOT"

# --- 1. FFmpeg config.h: CONFIG_GPL 0 -----------------------------------------
find "$ROOT" -path '*ffmpeg*' -name config.h 2>/dev/null > "$tmp" || true
if [ ! -s "$tmp" ]; then
  echo "FAIL: no FFmpeg config.h found — the FFmpeg build did not complete (fail-closed)."
  exit 1
fi
while IFS= read -r cfg; do
  echo "--- FFmpeg config: $cfg"
  if grep -q '^#define CONFIG_GPL 1' "$cfg"; then
    echo "FAIL: CONFIG_GPL 1 (GPL build)"; fail=1
  elif grep -q '^#define CONFIG_GPL 0' "$cfg"; then
    echo "OK: CONFIG_GPL 0"
  else
    echo "FAIL: CONFIG_GPL not defined in $cfg"; fail=1
  fi
  if grep -q '^#define CONFIG_NONFREE 1' "$cfg"; then
    echo "FAIL: CONFIG_NONFREE 1"; fail=1
  else
    echo "OK: not nonfree"
  fi
  if grep -q '^#define CONFIG_VERSION3 1' "$cfg"; then
    echo "OK: CONFIG_VERSION3 1 (LGPL v3)"
  else
    echo "WARN: CONFIG_VERSION3 not 1"
  fi
  if [ -n "$OUT" ]; then
    mkdir -p "$OUT"
    grep -E '^#define CONFIG_(GPL|NONFREE|VERSION3) ' "$cfg" > "$OUT/ffmpeg-config-$(basename "$(dirname "$cfg")").txt" || true
  fi
done < "$tmp"

# --- 2. mpv meson resolved option gpl=false -----------------------------------
find "$ROOT" -path '*mpv*' -name intro-buildoptions.json 2>/dev/null > "$tmp" || true
if [ ! -s "$tmp" ]; then
  echo "FAIL: no mpv meson intro-buildoptions.json — the mpv build did not complete (fail-closed)."
  exit 1
fi
while IFS= read -r opt; do
  val="$(python3 -c "import json,sys
d=json.load(open('$opt'))
print(next((o['value'] for o in d if o.get('name')=='gpl'), 'MISSING'))" 2>/dev/null || echo PARSE_ERR)"
  echo "--- mpv gpl option ($opt): $val"
  case "$val" in
    False|false) echo "OK: mpv gpl=false" ;;
    *) echo "FAIL: mpv gpl is not false (got: $val)"; fail=1 ;;
  esac
  if [ -n "$OUT" ]; then
    mkdir -p "$OUT"
    echo "mpv gpl=$val ($opt)" >> "$OUT/mpv-gpl-option.txt"
  fi
done < "$tmp"

if [ "$fail" -ne 0 ]; then
  echo "==> LGPL verification FAILED"
  exit 1
fi
echo "==> LGPL verification PASSED"
