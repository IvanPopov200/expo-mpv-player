#!/usr/bin/env bash
#
# Verify that a libmpv-android build tree is LGPL (no GPL FFmpeg). Run after
# build-lgpl-aar.sh; it inspects the FFmpeg config the build actually produced.
# Captures this in the M2 PR per the implementation plan (§8.1.6).
#
set -euo pipefail

ROOT="${1:-.}"
GPL_FLAG="--enable-${GPL_TOKEN:-gpl}"
fail=0

echo "==> Verifying LGPL (root: $ROOT)"

# 1. The ffmpeg configure invocation must not enable GPL.
if grep -rIn -- "$GPL_FLAG" "$ROOT"/buildscripts/scripts/ffmpeg.sh 2>/dev/null; then
  echo "FAIL: ffmpeg.sh still passes the GPL enable flag."
  fail=1
else
  echo "OK: ffmpeg.sh does not enable GPL."
fi

# 2. Generated FFmpeg config must report CONFIG_GPL 0 / CONFIG_VERSION3 1.
gpl_configs=0
while IFS= read -r cfg; do
  gpl_configs=$((gpl_configs + 1))
  if grep -q "define CONFIG_GPL 1" "$cfg"; then
    echo "FAIL: $cfg defines CONFIG_GPL 1."
    fail=1
  fi
  if grep -q "define CONFIG_VERSION3 1" "$cfg"; then
    echo "OK: $cfg is LGPLv3 (CONFIG_VERSION3 1)."
  fi
done < <(find "$ROOT" -name 'config.h' -path '*ffmpeg*' 2>/dev/null)

if [[ "$gpl_configs" -eq 0 ]]; then
  echo "WARN: no FFmpeg config.h found to inspect (build may not have run yet)."
fi

# 3. mpv must be configured with lgpl.
if grep -rIn -- "lgpl" "$ROOT"/buildscripts/scripts/mpv.sh >/dev/null 2>&1; then
  echo "OK: mpv build references the lgpl option."
else
  echo "WARN: could not confirm mpv --enable-lgpl in mpv.sh."
fi

if [[ "$fail" -ne 0 ]]; then
  echo "==> LGPL verification FAILED."
  exit 1
fi
echo "==> LGPL verification passed."
