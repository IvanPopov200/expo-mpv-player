# iOS integration & the MPVKit (LGPL) SPM decision

This records the M1 spike decision for how the iOS engine is linked (plan §7.1,
§13.2).

## Engine: MPVKit, the `MPVKit` (LGPL) product

- Dependency: [`MPVKit`](https://github.com/mpvkit/MPVKit) via Swift Package
  Manager. Pin a released tag at build time (research saw `0.41.0`, bundling
  mpv 0.41.0 + FFmpeg n8.1.1).
- Swift imports the underlying C module: `import Libmpv` (not `import MPVKit`).
- **Use the `MPVKit` product (LGPL v3), never `MPVKit-GPL`.** The FFmpeg inside
  `MPVKit` is built without `--enable-gpl`. CI's license check rejects any
  `MPVKit-GPL` reference.

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

## How the SPM package reaches the build

MPVKit is **SPM-only** (no CocoaPods/`-av` fork — that fork is GPL). Expo modules
are linked via CocoaPods, so the SPM package must be added to the **consumer
app's Xcode project** during `expo prebuild`.

**Chosen approach (validated by a real simulator build):** the config plugin
injects a `post_install` hook into the Expo Podfile (`plugin/src/index.ts`) that:

1. registers the `MPVKit` Swift Package on the **Pods** project and links the
   `MPVKit` product to the module's pod target (`ExpoMpvPlayer`) so
   `import Libmpv` compiles;
2. registers the package on the **app** project so Xcode resolves the package
   graph for the workspace; and
3. **force-links MPVKit's framework closure** on the app target via
   `OTHER_LDFLAGS` (`-framework Libmpv -framework Libass …`). This is required
   because SPM's product autolinking does **not** propagate MPVKit's binary
   xcframeworks through a CocoaPods pod — empirically, only `Libmpv` links and
   the rest (libass, FFmpeg, …) are reported as undefined symbols.

The framework list is pinned to MPVKit 0.41.0 in `MPVKIT_FRAMEWORKS`; update it
when bumping the MPVKit version.

**Fallback approach:** vendor MPVKit's prebuilt **LGPL** xcframeworks and
reference them from `ios/ExpoMpvPlayer.podspec` via `vendored_frameworks` (still
the LGPL binaries, never the GPL ones).

## Required consumer setting: DYNAMIC frameworks

The app must build iOS with **dynamic** frameworks:

```json
["expo-build-properties", { "ios": { "useFrameworks": "dynamic" } }]
```

> **Why dynamic, not static** (corrects an earlier assumption): MPVKit ships
> binary xcframeworks. Under `static` linkage the pod and the app each embed
> them, so the build fails with **duplicate MoltenVK/FFmpeg symbols**. Dynamic
> linkage links each framework once. Verified empirically against MPVKit 0.41.0
> on an iOS Simulator build. The config plugin warns if dynamic is not set.

## Validation status (updated)

Verified on this machine (Xcode 26.5, iOS Simulator):

- ✅ MPVKit **LGPL 0.41.0** SPM package resolves.
- ✅ The config plugin's `post_install` hook generates a correct Pods/app
  project graph on a real `expo prebuild`.
- ✅ The iOS Swift engine **compiles** against the real `Libmpv` C module
  (this caught and fixed a real `mpv_command` C-interop bug).
- ✅ The example app **builds and links** for the iOS Simulator end-to-end via
  the config plugin (`BUILD SUCCEEDED`), producing `expompvplayerexample.app`.
- ✅ The app **launches** on the simulator without a native crash (the native
  module loads).
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

The hardware-decode smoke test (10-bit HEVC MKV, `hwdec=videotoolbox`) still
requires a **physical device** — simulators cannot use VideoToolbox hwdec (G5).
