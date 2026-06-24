# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries are
derived from Conventional Commit subjects merged to `main`.

## [Unreleased]

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
  `verify-lgpl.sh`) that patch FFmpeg to drop the GPL flag (`--enable-version3`)
  and mpv to `--enable-lgpl`, then verify the result — both a build recipe and
  the LGPL source-availability deliverable.
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
