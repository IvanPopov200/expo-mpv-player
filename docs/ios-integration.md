# iOS integration: vendored LGPL MPVKit xcframeworks

How the iOS engine is linked. **This supersedes the earlier "SPM package +
dynamic frameworks" approach**, which required app-wide dynamic frameworks and
broke React-core linking for other RN native modules in real apps. The engine is
now vendored as static xcframeworks by this module's pod; the consumer app stays
on its default (static) linkage.

## Engine: MPVKit, the `MPVKit` (LGPL) product

- The prebuilt [`MPVKit`](https://github.com/mpvkit/MPVKit) LGPL xcframeworks,
  pinned to `0.41.0` (bundling mpv 0.41.0 + FFmpeg n8.1.1).
- Swift imports the underlying C module: `import Libmpv` (not `import MPVKit`).
- **Use the `MPVKit` product (LGPL v3), never the GPL one.** The FFmpeg inside
  is built without `--enable-gpl`. CI's license check rejects the GPL product.

## Rendering path (LGPL Metal, not avfoundation)

The LGPL product renders through `vo=gpu-next` + `gpu-api=vulkan` +
`gpu-context=moltenvk` into a `CAMetalLayer` (`MPVMetalLayer`), attached to mpv
via the `wid` option before `mpv_initialize`. This is the path implemented in
`ios/MPVRenderer.swift`.

Consequences:

- **iOS Picture-in-Picture is out of scope for v1.** AVKit PiP wants an
  `AVSampleBufferDisplayLayer`, which the LGPL Metal path does not feed. The four
  PiP ref methods are no-ops returning `false`.
- Watch for two MoltenVK gotchas (handled / documented in code): clamp
  `CAMetalLayer.drawableSize` away from 1×1 (`MPVMetalLayer` does this), and HDR
  Metal API validation may need disabling in the consuming app's scheme.

## How the engine reaches the build: vendored LGPL xcframeworks

The libmpv engine ships as MPVKit's prebuilt **LGPL** xcframeworks, **vendored by
this module's own pod** — not added to the consumer's Xcode project as an SPM
package. `ios/ExpoMpvPlayer.podspec` declares:

```ruby
s.vendored_frameworks = 'Frameworks/*.xcframework'
```

plus the system frameworks/libraries the static MPVKit closure needs at link time
(`AVFoundation`, `CoreMedia`, `Metal`, `VideoToolbox`, …; `bz2`, `iconv`, `z`,
`c++`, …), mirroring MPVKit's SPM `linkerSettings`.

The binaries are MPVKit's **static** xcframeworks. Under the consumer app's
**default (static) pod linkage** they link into the app exactly **once**, via this
pod — no duplicate-symbol double-embed. `import Libmpv` resolves from the vendored
`Libmpv.xcframework`'s module map.

The xcframeworks are large (~1 GB) and **not committed to git**. Fetch them into
`ios/Frameworks/` before building:

```bash
scripts/fetch-mpvkit-xcframeworks.sh   # pinned LGPL release, checksum-verified
```

The podspec's `prepare_command` runs this automatically during `pod install` when
`ios/Frameworks/` is empty. The full LGPL closure (28 frameworks) is the `MPVKit`
(non-GPL) product's transitive binary targets; the script is **LGPL-only** and
fails closed on any `-GPL` artifact. Bump the pinned MPVKit version and the
script's list together, then re-verify LGPL provenance.

## Consumer setup: nothing special — keep STATIC frameworks

The module imposes **no** `useFrameworks` requirement. Do **not** set
`useFrameworks: "dynamic"`.

> **Why static, not dynamic** (this supersedes the earlier dynamic-frameworks
> approach): the previous design force-linked the MPVKit closure on the app target
> and required app-wide **dynamic** frameworks. That breaks real apps — under
> dynamic frameworks every pod becomes its own framework that must explicitly link
> React, and third-party RN native modules (e.g. `react-native-purchases`) don't,
> so they fail at link time with `Undefined symbols: _OBJC_CLASS_$_RCTEventEmitter
> … _RCTRegisterModule`. Vendoring the **static** xcframeworks lets the app stay on
> its default static linkage: MPVKit links once through this pod, and every other
> native module links normally. Verified against MPVKit 0.41.0.

## Validation status (updated)

Verified on this machine (Xcode 26.5, iOS Simulator):

- ✅ The example app **builds and links on STATIC frameworks** with the vendored
  LGPL xcframeworks — **no duplicate MoltenVK/FFmpeg symbols**, `import Libmpv`
  resolves, and `_mpv_create` is linked into the app (`verification/ios/g-static-link.txt`).
- ✅ The iOS Swift engine **compiles** against the real `Libmpv` C module
  (this caught and fixed a real `mpv_command` C-interop bug).
- ✅ A **community RN native module** (`react-native-safe-area-context`) builds in
  the same example under static linkage — the configuration that the old
  dynamic-frameworks requirement broke (`verification/ios/g-realapp-link.txt`).
- ✅ **`<MpvPlayerView>` renders decoded video frames** on the simulator (G4) —
  see `verification/ios/g4-render.png`. The same run shows `onProgress`,
  `onPlaybackStateChange`, and audio-track enumeration working.

> **The earlier "Fabric view-config" diagnosis was wrong.** `getViewConfig`
> returns a valid config; the New-Arch view path is fine. The real blocker was a
> **React version mismatch**: react-native 0.85.3 bundles `react-native-renderer`
> built against **exactly react 19.2.3** and rejects any other (even within the
> `^19.2.3` peer range). The app had react 19.2.7 → "Incompatible React versions"
> → "Cannot read property 'default' of undefined". **Fix: pin react `19.2.3`.**
> Consumers must likewise match react to whatever their react-native bundles.

Hardware decode (G5) is **verified on a physical iPhone 14 Pro** (A16): H.264 and
HEVC both report `hwdec-current=videotoolbox` with 0 dropped frames
(`verification/ios/g5-hwdec.txt`). Simulators cannot use VideoToolbox hwdec, so a
real device is required to reproduce.
