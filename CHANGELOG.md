# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries are
derived from Conventional Commit subjects merged to `main`.

## [Unreleased]

Remediation round driven by a code review, under an Evidence-Gated Claims rule
(a runtime behavior is only called "verified" when its gate artifact lives in
`verification/`). See `verification/STATUS.md` for the live gate matrix.

### Fixed

- **Android LGPL build (critical):** the build script did not actually strip GPL
  — its `sed` targeted `--enable-gpl`, but upstream uses the brace form
  `--enable-{gpl,version3}`, and it set a nonexistent mpv `-Dlgpl`. Rewritten
  against the real upstream (pinned `v1.0.0`): strip `gpl` from the brace, add
  `-Dgpl=false` to mpv's meson, fail-closed verifier. **G1 PROVEN** from a real
  CI build: FFmpeg `CONFIG_GPL 0` + mpv `gpl=false`
  (`verification/lgpl/verify-output.txt`).
- **iOS render (P0-C):** the view did not render — react-native 0.85.3's bundled
  `react-native-renderer` requires exactly react 19.2.3 (the app had 19.2.7).
  Pinned react 19.2.3. **G4 verified** (`verification/ios/g4-render.png`).
- **`mpv_command` C-interop bug** (iOS) — caught by compiling against real libmpv.
- **Auth headers (P1-D):** set `http-header-fields` via `change-list … append`
  (comma-safe) instead of comma-joining; property API for post-init options.
  **G6 verified** on iOS.
- **`onError` (P1-E):** iOS now fires `onError` on `MPV_END_FILE_REASON_ERROR`.
  **G7 verified** on iOS. (Android: wrapper lacks the END_FILE reason — documented.)
- **iOS teardown races (P1-F):** serialized, idempotent `invalidate()`.
  **G3 stress verified** (20 mount/unmount cycles, no crash).
- **Android compile + `compileSdk`/`minSdk` (G2):** the module declared no
  `compileSdk` (newer AGP hard-fails); now uses Expo's
  `useDefaultAndroidSdkVersions()`. The config plugin raises consumer
  `android.minSdkVersion` to ≥ 26 (libmpv requires API 26). The example assembles
  with the LGPL AAR linked — libmpv/FFmpeg `.so`s + module classes verified in the
  APK (`verification/android/g2-compile.md`).
- **Android runtime libc++/NDK skew (critical):** the AAR was built with NDK r29
  (clang 21), so `libmpv.so` referenced libc++ symbols absent from the NDK r27
  (clang 18) `libc++_shared.so` a React Native app bundles → runtime
  `UnsatisfiedLinkError`, view never loads. The AAR build now pins the NDK to RN's
  r27 (`android/libmpv-build/build-lgpl-aar.sh`); the rebuilt stock AAR `dlopen`s
  clean. **Android G3/G4/G6/G7 verified** on an emulator against the unpatched app
  (`verification/android/g3-g4-g6-g7-runtime.md`).
- **Android `onError` (P1-E):** the JNI wrapper's `EventObserver.event(int)`
  carries no end-file reason, so `MPVRenderer` now infers a load failure from
  event ordering (`START_FILE` → `END_FILE` before `FILE_LOADED`, with a
  `pendingReplace` guard against reload false-positives) and fires `onError`.
  **G7 verified** on Android (generic message; iOS still surfaces mpv's exact
  reason string).
- **Security:** `tls-verify` is no longer forced off; certificates are validated
  by default, opt out per source via `VideoSource.allowSelfSignedTls`.
- Removed a dead `track-list/count` property observer.

### Added

- `verification/` evidence harness: gate ladder, a deterministic fixture server
  (comma-bearing auth + error routes), example capture helpers, committed
  artifacts.

### Status (honest)

- **iOS:** builds, links, renders, headers, onError, teardown — verified on the
  simulator. G5 (hardware decode) needs a physical device.
- **Android:** **G1–G4, G6, G7 proven.** LGPL provenance (G1); the example
  assembles & links the AAR (G2); on a stock r27 AAR (no libc++ swap), `gpu-next`
  **renders** `sample.mp4` (G4), the exact comma-bearing auth header reaches the
  server (G6), and a 401 fires **`onError`** (G7). Verified on an arm64
  Android-36 emulator. **G5 (hardware decode) needs a physical device** — the only
  open gate on either platform. See `verification/STATUS.md`.

## [0.1.0] — First release

The complete, source-finished v1 surface across all milestones (M0–M5): a
New-Architecture Expo module wrapping libmpv for "play-anything" video, with a
stable public API, LGPL-only engines on both platforms, a config plugin, an
example harness, CI, and licensing deliverables.

### Added (M5: docs, licensing, release)

- README: documented the subtitle-styling/sync methods and a "Building the
  native engines" section linking the iOS SPM and Android LGPL-AAR build paths.
- Finalized licensing/docs and cut the first `v0.1.0` tag.

### Verification

- Every PR runs lint, typecheck, Jest (TS layer + config plugin), and a license
  check that rejects any GPL engine path (`MPVKit-GPL`, `--enable-gpl`, or the
  GPL Maven artifact).
- Native binary builds (iOS MPVKit-LGPL link; Android LGPL AAR via
  `android/libmpv-build/`) are produced on a real toolchain via the
  `android-aar.yml` and `native-build.yml` workflows. `npm publish` to the
  `latest` dist-tag follows a verified native build.

## [0.1.0-rc.4] — M4: config plugin hardening

### Added

- Config plugin now applies real native mods:
  - **iOS:** injects the MPVKit (LGPL `MPVKit`) Swift Package into the app's
    Xcode project (idempotent, best-effort with a manual-add warning on failure)
    and warns when `expo-build-properties` static frameworks are missing.
  - **Android:** ensures the `INTERNET` permission and the PiP `<uses-feature>`,
    sets `usesCleartextTraffic` when `enableCleartextTraffic` is on, writes the
    `androidAbiFilters` to `reactNativeArchitectures`, and records
    `defaultVoDriver` as application meta-data.
- The Android view reads the `DEFAULT_VO_DRIVER` meta-data as the fallback VO
  driver when a source omits `voDriver`.
- Plugin unit tests (13) covering the pure manifest/gradle helpers, the
  static-frameworks assertion, and the SPM-injection object graph.
- `.github/workflows/native-build.yml`: on-demand example builds — iOS (resolves
  MPVKit SPM, simulator build) and Android (consumes the prebuilt LGPL AAR).

## [0.1.0-rc.3] — M3: tracks, subtitles, diagnostics

### Added

- Subtitle styling & A/V sync ref methods on both platforms: `setSubtitleScale`
  (`sub-scale`), `setSubtitlePosition` (`sub-pos`), `setSubtitleDelay`
  (`sub-delay`), `setAudioDelay` (`audio-delay`).
- Example harness now exercises the M3 surface: lists and selects audio and
  subtitle tracks (with "Off"), subtitle-scale +/- and zoom-to-fill controls,
  and refreshes tracks + diagnostics on `onTracksReady`.

### Notes

- Track enumeration/selection, external subtitles, `getTechnicalInfo`, and
  zoom-to-fill shipped with M1/M2 behind the frozen contract; this milestone
  rounds out the optional subtitle-styling surface and the manual test harness.

## [0.1.0-rc.2] — M2: Android playback (LGPL AAR)

### Added

- Android playback via libmpv's **instance** JNI API (`MPVLib.create`, 1.0.0):
  - `MpvLib` — thin wrapper/observer-multiplexer over the JNI surface.
  - `MPVRenderer` — VO for the LGPL Android GL path (`vo=gpu-next`,
    `gpu-context=android`, `opengl-es=yes`, `hwdec=mediacodec-copy`), loads with
    `http-header-fields`, copies `subfont.ttf` into the config dir, observes
    properties, throttles `time-pos` to ~1/sec, enumerates tracks, exposes
    diagnostics; all callbacks posted to the main `Handler`.
  - `MpvPlayerView` — `SurfaceView` wiring (`attachSurface` on create,
    `android-surface-size` on change, `detachSurface` keeping the VO alive on
    destroy); forwards renderer callbacks to the six view events.
  - `MpvPlayerModule` — full view-scoped AsyncFunction surface + `OnViewDestroys`
    cleanup. PiP methods are no-ops (v1).
- `android/libmpv-build/`: public LGPL AAR build scripts (`build-lgpl-aar.sh`,
  `verify-lgpl.sh`) — both a build recipe and the LGPL source-availability
  deliverable. (The initial versions had bugs that left GPL enabled; corrected
  and proven in [Unreleased].)
- `.github/workflows/android-aar.yml`: on-demand/scheduled heavy build that
  produces and LGPL-verifies the AAR and uploads it as an artifact.
- `android/src/main/assets/README.md`: documents the required `subfont.ttf`.

### Notes

- The AAR is a native binary built on an Android-toolchain machine/CI (NDK r29.x)
  — never committed to git, never the GPL prebuilt artifact. `minSdk 26`.
- Android requires the LGPL AAR in `android/libs/` to compile; the Kotlin sources
  are complete and target that AAR's API.

## [0.1.0-rc.1] — M1: iOS playback (LGPL)

### Added

- iOS playback via libmpv (MPVKit's LGPL `Libmpv` module), rendering through the
  LGPL Metal path (`vo=gpu-next` + `gpu-api=vulkan` + `gpu-context=moltenvk`)
  into a `CAMetalLayer`:
  - `MPVRenderer` — raw libmpv lifecycle (create → options → initialize →
    observe → loadfile-with-headers → drain events → control), with `time-pos`
    progress throttled to ~1/sec (bypassed while seeking).
  - `MPVMetalLayer` — `CAMetalLayer` subclass with the MoltenVK drawable-size
    clamp.
  - `MpvPlayerView` — owns the layer, `AVAudioSession`, and marshals renderer
    callbacks to the main thread; `onLoad` / `onProgress` /
    `onPlaybackStateChange` / `onError` / `onTracksReady` wired.
  - Full imperative AsyncFunction surface (transport, tracks, subtitles, zoom,
    diagnostics) forwarding to the view; HTTP auth via `http-header-fields`.
- `docs/ios-integration.md` recording the MPVKit-LGPL SPM decision and the
  static-frameworks requirement.

### Notes

- iOS Picture-in-Picture remains out of scope for v1 (LGPL Metal path); the four
  PiP methods are no-ops.
- The MPVKit SPM-to-prebuild wiring is implemented and tested with the config
  plugin in M4; a full simulator/device smoke test runs in CI's `build-ios` job
  added alongside it.

## [0.1.0-rc.0] — M0: scaffold & contracts

### Added

- Module scaffold: `MpvPlayerView` component and the full public TypeScript API
  contract (`source` prop, six view events, imperative ref methods, track and
  diagnostics types).
- Web stubs so apps that import the package still bundle on web.
- Config-plugin scaffold (`expo-mpv-player`) with a run-once wrapper.
- Example app target rendering the player view.
- Licensing deliverables: MIT `LICENSE` for the wrapper, `NOTICE` documenting
  the bundled LGPL mpv/FFmpeg components and the written offer of source.
- CI: lint, typecheck, and Jest (TS layer + config plugin); a license check that
  rejects any GPL engine path.
- Jest and ESLint configuration via `expo-module-scripts`.
