#!/usr/bin/env bash
#
# Fetch the **LGPL** MPVKit prebuilt xcframeworks into ios/Frameworks/.
#
# These are the libmpv + FFmpeg + render binaries the iOS engine links. They are
# large (~1 GB) and NOT committed to git; the podspec vendors whatever lands in
# ios/Frameworks/ (and runs this script automatically when that dir is empty).
#
# LGPL ONLY — this pins the binary targets of the non-GPL "MPVKit" product from
# the MPVKit 0.41.0 release. Never the GPL ("-GPL" suffixed) artifacts.
# Bump MPVKIT_VERSION + regenerate this list (from MPVKit's Package.swift) together,
# and re-verify LGPL provenance.
#
set -euo pipefail

MPVKIT_VERSION="0.41.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST="$SCRIPT_DIR/../ios/Frameworks"
mkdir -p "$DST"

# name|url|sha256 — the LGPL closure of the MPVKit (non-GPL) product.
FRAMEWORKS=(
  "Libmpv|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libmpv.xcframework.zip|9ff5077d675a1e12bec98db167a49f46eb57dba567f40558b7758d4f12fb3ae7"
  "Libavcodec|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libavcodec.xcframework.zip|6ccb6b5cf8fc05665f2ee4958f640b328755414946e9541adda40c536568ec43"
  "Libavdevice|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libavdevice.xcframework.zip|f571fbdef20e8d94ce6c8692eeee1fdff627e691cfcd2de5f9f294655c8cc405"
  "Libavfilter|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libavfilter.xcframework.zip|965d1271c37181b1fe23d34d0c7c1cb7626a080d5925d3bdb1d1f84afd7b3d7d"
  "Libavformat|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libavformat.xcframework.zip|7ff0af2e5ee5a1f5d278caedb96a395c7c29f563f09cdf977b6670bc9724cb7d"
  "Libavutil|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libavutil.xcframework.zip|7a8716f9ac793e2da895b9f87c37b56a9a2065f2c1f31b60f3d3589bea6c50a1"
  "Libswresample|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libswresample.xcframework.zip|7beb6e337b69882771c58281d42a449d8810e836e7ce07c6f91827267ab4fabd"
  "Libswscale|https://github.com/mpvkit/MPVKit/releases/download/0.41.0/Libswscale.xcframework.zip|e9d660dc6eb27d20a25aa5659a966f07cf1a97ed9049ec19e8a06b3f2aec6b41"
  "Libass|https://github.com/mpvkit/libass-build/releases/download/0.17.4/Libass.xcframework.zip|1e41f5a69c74f6c6407aab84a65ccd0b34e73fa44465f488f99bf22bd61b070d"
  "Libdav1d|https://github.com/mpvkit/libdav1d-build/releases/download/1.5.2-xcode/Libdav1d.xcframework.zip|8a8b78e23e28ecc213232805f3c1936141fc9befe113e87234f4f897f430a532"
  "Libplacebo|https://github.com/mpvkit/libplacebo-build/releases/download/7.351.0-2512/Libplacebo.xcframework.zip|3b2bd57b82549566963effadf0891a141448d9f89c7d48fca0b8f823b854bac6"
  "Libshaderc_combined|https://github.com/mpvkit/libshaderc-build/releases/download/2025.5.0/Libshaderc_combined.xcframework.zip|758047b615708575b580eb960a2d083f760a29dc462d6eaa360416c946ce433b"
  "MoltenVK|https://github.com/mpvkit/moltenvk-build/releases/download/1.4.1/MoltenVK.xcframework.zip|9bd1ca1e4563bacd25d6e55d37b10341d50b2601bc2684bc332188e79daa2b79"
  "Libcrypto|https://github.com/mpvkit/openssl-build/releases/download/3.3.5/Libcrypto.xcframework.zip|593283be2a90f7fd66f6e6ed331b2f099cf403e0926fe3b4ac09a7062b793965"
  "Libssl|https://github.com/mpvkit/openssl-build/releases/download/3.3.5/Libssl.xcframework.zip|ff5ffd43d015d7285fd37e4a3145b25cbd8d2842740bd629a711c299a20e226a"
  "gmp|https://github.com/mpvkit/gnutls-build/releases/download/3.8.11/gmp.xcframework.zip|ad33c7a08f4cdcb9924c8f0e6d9a054dad33d7794b97667bf8b6fb2b236ae585"
  "gnutls|https://github.com/mpvkit/gnutls-build/releases/download/3.8.11/gnutls.xcframework.zip|3dbec5809339189bf9679e218c6cff387ebf8fb72745927835afc2678f5c9f4d"
  "hogweed|https://github.com/mpvkit/gnutls-build/releases/download/3.8.11/hogweed.xcframework.zip|25727c9fa67287fa0a4f4722f88bb8be669b23cd7e837e2d00870eb8a25d3f27"
  "nettle|https://github.com/mpvkit/gnutls-build/releases/download/3.8.11/nettle.xcframework.zip|0fdf3ebf8bd7b8bc8eee837cf27261cb4c52ae520b6576a2f468656aa1691e02"
  "Libfreetype|https://github.com/mpvkit/libass-build/releases/download/0.17.4/Libfreetype.xcframework.zip|f2840aba1ce35e51c0595557eee82c908dac8e32108ecc0661301c06061e051c"
  "Libfribidi|https://github.com/mpvkit/libass-build/releases/download/0.17.4/Libfribidi.xcframework.zip|4a55513792ef7a17893875f74cc84c56f3657e8768c07a7a96f563a11dc4b743"
  "Libharfbuzz|https://github.com/mpvkit/libass-build/releases/download/0.17.4/Libharfbuzz.xcframework.zip|91558d8497d9d97bc11eeef8b744d104315893bfee8f17483d8002e14565f84b"
  "Libbluray|https://github.com/mpvkit/libbluray-build/releases/download/1.4.0/Libbluray.xcframework.zip|bc037d34e2b0b5ab7f202fb371f5fb298136cc66fdf406c2172185d06f53f18d"
  "Libdovi|https://github.com/mpvkit/libdovi-build/releases/download/3.3.2/Libdovi.xcframework.zip|e693e239808350868e79c5448ef9f02e2716bc822dd8632a41a368a1eae5ca7d"
  "Libuavs3d|https://github.com/mpvkit/libuavs3d-build/releases/download/1.2.1-xcode/Libuavs3d.xcframework.zip|1e69250279be9334cd2f6849abdc884c8e4bb29212467b6f071fdc1ac2010b6b"
  "Libuchardet|https://github.com/mpvkit/libuchardet-build/releases/download/0.0.8-xcode/Libuchardet.xcframework.zip|503202caa0dafb6996b2443f53408a713b49f6c2d4a26d7856fd6143513a50d7"
  "Libunibreak|https://github.com/mpvkit/libass-build/releases/download/0.17.4/Libunibreak.xcframework.zip|001087c0e927ae00f604422b539898b81eb77230ea7700597b70393cd51e946c"
  "lcms2|https://github.com/mpvkit/lcms2-build/releases/download/2.17.0/lcms2.xcframework.zip|dc0dce0606f6ab6841a8ec5a6bd4448e2f3ef00661a050460f806c9393dc6982"
)

# Fail-closed: no GPL artifact may appear in the list.
for entry in "${FRAMEWORKS[@]}"; do
  url="${entry#*|}"; url="${url%|*}"
  case "$url" in
    *-GPL.xcframework.zip) echo "ERROR: GPL artifact in list: $url" >&2; exit 1 ;;
  esac
done

sha256() { shasum -a 256 "$1" | awk '{print $1}'; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "==> Fetching ${#FRAMEWORKS[@]} LGPL MPVKit xcframeworks (MPVKit $MPVKIT_VERSION) -> ios/Frameworks/"
for entry in "${FRAMEWORKS[@]}"; do
  name="${entry%%|*}"; rest="${entry#*|}"
  url="${rest%|*}"; want="${rest##*|}"
  if [[ -d "$DST/$name.xcframework" ]]; then echo "  = $name (present)"; continue; fi
  echo "  + $name"
  zip="$tmp/$name.zip"
  curl -fsSL "$url" -o "$zip"
  got="$(sha256 "$zip")"
  if [[ "$got" != "$want" ]]; then
    echo "ERROR: checksum mismatch for $name" >&2
    echo "  want $want" >&2; echo "  got  $got" >&2; exit 1
  fi
  unzip -q -o "$zip" -d "$tmp/$name"
  fw="$(find "$tmp/$name" -maxdepth 2 -name '*.xcframework' | head -1)"
  [[ -n "$fw" ]] || { echo "ERROR: no xcframework in $name.zip" >&2; exit 1; }
  rm -rf "$DST/$name.xcframework"
  cp -R "$fw" "$DST/"
done

echo "==> Done. $(ls "$DST" | grep -c xcframework) xcframeworks in ios/Frameworks/"
