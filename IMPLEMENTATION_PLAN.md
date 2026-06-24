# `expo-mpv-player` — Implementation Plan & Build Guide

> **Audience:** an autonomous coding agent (or engineer) building this module from
> scratch in a **new, standalone, public GitHub repository**. This document is
> self-contained: read it top to bottom before writing code. It encodes *what* to
> build, *how* to build it, the *exact* dependency coordinates and API surfaces,
> the *licensing* constraints that drive the architecture, and the *git/release
> workflow* you must follow.
>
> **This spec lives outside the consuming app on purpose.** The module is its own
> open-source project. The app that prompted it (a paid, closed-source Expo app,
> referred to here as "the consumer app") will depend on it like any other npm
> package. Nothing in this repo may reference the consumer app's private code.

---

## 0. One-paragraph summary

Build **`expo-mpv-player`**: a New-Architecture-native **Expo module** that wraps
**libmpv** to give React Native / Expo apps a "play-anything" video player —
direct-playing the codecs/containers (HEVC 10-bit, MKV, VC-1, DTS/DTS-HD/TrueHD,
E-AC3, PGS/ASS subs) that `AVPlayer`/`ExoPlayer` reject. It exposes a single React
component (`<MpvPlayerView>`) driven by one `source` prop plus imperative
ref methods, on iOS (MPVKit, **LGPL** product) and Android (a **custom LGPL libmpv
AAR** you build). It ships a config plugin so it works under `expo prebuild` with no
hand-written native code in the consumer app. The proven reference architecture is
Streamyfin's in-repo `modules/mpv-player`; this project re-implements that as a
clean, standalone, **LGPL-only** package.

---

## 1. The constraint that drives everything: LGPL on BOTH platforms

The entire value of a separate module is to create a **clean license boundary** so a
closed-source consumer app can link a copyleft media engine legally. Copyleft
attaches to the **linked binary that ships in the app**, *not* to which git repo the
source lives in — so a separate repo does **not** launder GPL. The module must
therefore ship **LGPL** builds of mpv/FFmpeg on both platforms. This is non-negotiable
and shapes the architecture.

| Platform | Engine source | LGPL path (REQUIRED) | GPL path (DO NOT SHIP) |
|---|---|---|---|
| **iOS / tvOS** | [MPVKit](https://github.com/mpvkit/MPVKit) (SPM) | **`MPVKit` product** — LGPL v3.0; FFmpeg built without `--enable-gpl`. Import as `import Libmpv`. | `MPVKit-GPL` product (GPL v3.0). Also avoid the `mpv-ios/MPVKit` `-av` fork Streamyfin uses — it's GPL-3.0. |
| **Android** | [libmpv-android](https://github.com/jarnedemeulemeester/libmpv-android) | **Build your own AAR** from the public buildscripts with FFmpeg configured **without** `--enable-gpl` (use `--enable-version3` LGPL) and mpv `--enable-lgpl`. | The prebuilt Maven artifact `dev.jdtech.mpv:libmpv:*` is **GPL** (its `ffmpeg.sh` uses `--enable-{gpl,version3}`). The MIT POM covers only the JNI wrapper. **Never link it into the closed-source consumer app.** |

**Implication for the plan:** the iOS engine is a ready-made LGPL dependency; the
**Android LGPL build is the single hardest, highest-risk task in this project** and is
on the critical path. Treat it as a dedicated milestone (M2) with its own spike.

**Two consequences to accept up front:**

- **iOS rendering uses the LGPL Metal/MoltenVK path, not Streamyfin's
  `vo=avfoundation`.** Streamyfin gets easy AVKit Picture-in-Picture because it renders
  into an `AVSampleBufferDisplayLayer` via a GPL fork. The LGPL `MPVKit` product renders
  through `vo=gpu-next` + `gpu-api=vulkan` + `gpu-context=moltenvk` into a `CAMetalLayer`.
  That means **iOS PiP is hard and is out of scope for v1** (revisit later; do not block
  on it).
- **Android `minSdk = 26`** (Android 8.0) is a hard floor from the native `.so`s. The
  consumer app must fall back to another player below API 26 (it won't be many users).

---

## 2. Non-negotiable working agreements (read before committing anything)

These apply to **every** commit, branch, and PR in this repo.

### 2.1 Authorship / attribution — STRICT

- **The agent MUST NOT attribute itself in any form.** Specifically:
  - **No `Co-Authored-By:` trailers** of any kind (no "Claude", no bot identities).
  - **No "Generated with …", "🤖", "Co-authored-by Claude", or any tool/agent
    signature** in commit messages, PR titles, or PR bodies.
  - **Do not add the agent** to `package.json` `author`/`contributors`, `AUTHORS`,
    `CONTRIBUTORS`, `NOTICE`, code comments, or anywhere else.
  - Commit author/committer must be the **human's configured git identity** only. Do
    not set `user.name`/`user.email` to an agent identity, and do not pass
    `--author`.
- Commit messages describe the change, nothing else. PR bodies describe the change,
  test plan, and any follow-ups — and stop there.
- If a tool or template tries to inject an attribution trailer automatically, **strip
  it** before the commit lands.

### 2.2 Branching

- `main` is always releasable and protected. **Never commit directly to `main`.**
- One branch per unit of work, named `<type>/<short-kebab-summary>`, where `<type>`
  is one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`,
  `perf`. Examples: `feat/ios-metal-renderer`, `build/android-lgpl-aar`,
  `docs/readme-quickstart`.
- Rebase a branch on the latest `main` before opening/refreshing its PR. Resolve
  conflicts on the branch, never with merge commits into the branch.

### 2.3 Commits (Conventional Commits)

- Format: `<type>(<optional-scope>): <imperative summary>`; body explains *why* when
  not obvious; footer for `BREAKING CHANGE:` notes.
  - `feat(ios): render via CAMetalLayer using vo=gpu-next`
  - `fix(android): keep VO alive across surface detach`
  - `build(android): add LGPL libmpv AAR build script`
- Scopes in use: `ios`, `android`, `js`, `plugin`, `example`, `ci`, `build`, `docs`,
  `release`.
- Keep commits focused. It's fine to have several small commits on a branch — they
  get squashed (see 2.4).

### 2.4 Merge strategy — squash and merge ONLY

- All PRs land via **Squash and Merge**. Disable merge-commit and rebase-merge in repo
  settings so squash is the only option.
- The **squash commit subject = the PR title** and must itself be a valid Conventional
  Commit (the changelog/version tooling reads merged commit subjects on `main`).
- The squash commit body should be a clean summary — **delete** any auto-generated
  "* commit 1 / * commit 2" list and **delete any attribution trailer** the platform
  appends.
- Net effect: **one tidy Conventional Commit per PR on `main`.**

### 2.5 Versioning — SemVer with `rc` prereleases

- **SemVer.** While the public API is still settling, stay in **`0.y.z`** (a `0.x` bump
  signals "pre-1.0, API may move"). Promote to `1.0.0` only when the API in §5 is
  declared stable.
- **Prereleases use the `-rc.N` identifier**, incrementing per release candidate:
  `0.1.0-rc.1` → `0.1.0-rc.2` → … → `0.1.0`. Use `-rc` for "feature-complete,
  stabilizing" builds. (You may use `-alpha.N` / `-beta.N` earlier in a cycle if
  useful, but `-rc.N` is the required identifier for release candidates.)
- **npm dist-tags:** publish prereleases under the **`next`** tag
  (`npm publish --tag next`); publish stable under the default **`latest`** tag. Never
  let a prerelease take `latest`.
- **git tags** mirror the version, prefixed with `v`: `v0.1.0-rc.1`, `v0.1.0`.
  Annotated tags only.
- **Bumping:** `npm version <new-version> --no-git-tag-version` to set `package.json`,
  then a `release:` commit, then tag. (A `release-please`/`changesets` setup may
  automate this later — see M5 — but it must respect the no-attribution rule.)

### 2.6 Pull requests

- PR title = the intended squash subject (Conventional Commit).
- PR body sections: **What**, **Why**, **How tested** (commands + device/sim used),
  **Follow-ups** (if any). No attribution, no agent signature.
- A PR is mergeable only when CI is green (§11) and it targets a single milestone's
  scope. Small, reviewable PRs over big ones.

### 2.7 Definition of "done" for a change

A change is done only when: code builds on both platforms it touches, the example app
exercises it, tests/typecheck/lint are green, docs reflect it, and the PR follows the
rules above.

---

## 3. Project identity & top-level decisions (defaults — change only with reason)

| Decision | Value | Rationale |
|---|---|---|
| npm package name | **`expo-mpv-player`** | Descriptive; verify availability on npm before first publish. Fallback: scope it (`@<org>/expo-mpv-player`). |
| Module native name | **`MpvPlayer`** | Matches the proven Streamyfin module name; used by `requireNativeView("MpvPlayer")`. |
| Wrapper license | **MIT** (the TS + Swift/Kotlin glue you write) | Permissive wrapper; the LGPL obligations attach to the bundled mpv/FFmpeg binaries, documented in `NOTICE` (§10). |
| Repo visibility | **Public** | Open-source; eases LGPL source-availability and invites co-maintainers. |
| Package manager | **npm** | Matches the consumer app; `create-expo-module` supports it. |
| Min OS | iOS/tvOS **14**, Android **26** | MPVKit `Package.swift` floor; libmpv `.so` minSdk floor. |
| New Architecture | **Required / always-on** | Target recent Expo SDK (New Arch is non-optional there); Expo Modules API is Fabric-native. |
| v1 scope | browse-agnostic playback: load, play/pause, seek, speed, audio+subtitle track selection, external subs, progress/error events | PiP, now-playing/lock-screen, casting, offline are **later** milestones. |

---

## 4. Architecture overview

An **Expo Module** (Expo Modules API) with three surfaces that mirror each other:

```
JS/TS  ──requireNativeView("MpvPlayer")──►  Native View (ExpoView subclass)
  <MpvPlayerView source=… onProgress=… ref=…>        │
        ▲ imperative ref methods (AsyncFunction)      ▼
        └──────────────────────────────────►  Renderer (raw libmpv C/JNI)
                                                       │
                                       iOS: MPVKit (LGPL) + CAMetalLayer
                                       Android: custom LGPL libmpv AAR + Surface
```

Key architectural rules (lifted from the proven Streamyfin design, adapted to LGPL):

- **One `source` prop carries all load options** (URL, headers, external subtitles,
  start position, autoplay, initial track ids, cache config). Do **not** create a prop
  per option — it makes atomic reloads hard.
- **Six view events**: `onLoad`, `onPlaybackStateChange`, `onProgress`, `onError`,
  `onTracksReady`, `onPictureInPictureChange` (last one is a no-op until PiP lands).
- **Imperative control via a ref** (`useImperativeHandle` → view-scoped
  `AsyncFunction`s): play/pause/seek/speed/track selection/etc.
- **Throttle `time-pos` to ~1 update/sec** (bypass while actively seeking). This is
  explicitly a ~50% CPU/battery win; do it in the renderer, not JS.
- **Renderer talks to libmpv via the raw C API (iOS) / `MPVLib` JNI (Android)** —
  `create → set options → initialize → observe properties → command/property writes →
  drain events`. Same lifecycle both sides; only the VO + surface differ.
- **Pass HTTP auth via mpv's `http-header-fields` option** (or accept a token already
  in the URL query). The module is server-agnostic — it takes a URL + headers and
  plays; it knows nothing about Jellyfin or any other backend.

---

## 5. The public API contract (stable surface — design carefully)

This is the contract consumers code against; treat changes to it as SemVer-significant.
Define these in `src/MpvPlayer.types.ts`.

### 5.1 Component

```ts
// Default + named export from the package root.
const MpvPlayerView: React.ForwardRefExoticComponent<
  MpvPlayerViewProps & React.RefAttributes<MpvPlayerViewRef>
>;
```

### 5.2 Props

```ts
export interface MpvPlayerViewProps {
  source?: VideoSource;
  style?: StyleProp<ViewStyle>;
  /** Each callback receives { nativeEvent: Payload }. */
  onLoad?: (e: { nativeEvent: OnLoadPayload }) => void;
  onPlaybackStateChange?: (e: { nativeEvent: OnPlaybackStatePayload }) => void;
  onProgress?: (e: { nativeEvent: OnProgressPayload }) => void;
  onError?: (e: { nativeEvent: OnErrorPayload }) => void;
  onTracksReady?: (e: { nativeEvent: OnTracksReadyPayload }) => void;
  onPictureInPictureChange?: (e: { nativeEvent: OnPiPPayload }) => void; // reserved
}

export interface VideoSource {
  url: string;
  /** HTTP headers, e.g. { Authorization: 'MediaBrowser Token="…"' }. */
  headers?: Record<string, string>;
  /** Sidecar subtitle file URLs to add after load. */
  externalSubtitles?: string[];
  /** Resume position in seconds. */
  startPosition?: number;
  /** Begin playback immediately on load. Default true. */
  autoplay?: boolean;
  /** Pre-select track ids once the file is loaded. */
  initialAudioId?: number;
  initialSubtitleId?: number;
  cacheConfig?: {
    enabled?: 'auto' | 'yes' | 'no';
    cacheSeconds?: number;
    maxBytes?: number;     // demuxer-max-bytes
    maxBackBytes?: number; // demuxer-max-back-bytes
  };
  /** Android-only video output driver. Default 'gpu-next'. */
  voDriver?: 'gpu-next' | 'gpu';
}
```

### 5.3 Event payloads

```ts
export interface OnProgressPayload {
  position: number;     // seconds
  duration: number;     // seconds
  progress: number;     // 0..1
  cacheSeconds: number; // demuxer-cache-duration
}
/** Partial — each native transition fills the subset it knows. */
export interface OnPlaybackStatePayload {
  isPaused?: boolean;
  isPlaying?: boolean;
  isLoading?: boolean;
  isReadyToSeek?: boolean;
}
export interface OnLoadPayload { url: string; }
export interface OnErrorPayload { error: string; }
export interface OnTracksReadyPayload {} // signal only; query tracks via ref
export interface OnPiPPayload { isActive: boolean; }
```

### 5.4 Imperative ref methods (all return `Promise`)

```ts
export interface MpvPlayerViewRef {
  // transport
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  seekBy(seconds: number): Promise<void>;
  setSpeed(rate: number): Promise<void>;
  getSpeed(): Promise<number>;
  isPaused(): Promise<boolean>;
  getCurrentPosition(): Promise<number>;
  getDuration(): Promise<number>;
  // audio tracks
  getAudioTracks(): Promise<AudioTrack[]>;
  setAudioTrack(id: number): Promise<void>;
  getCurrentAudioTrack(): Promise<number | null>;
  // subtitle tracks
  getSubtitleTracks(): Promise<SubtitleTrack[]>;
  setSubtitleTrack(id: number): Promise<void>;
  disableSubtitles(): Promise<void>;
  getCurrentSubtitleTrack(): Promise<number | null>;
  addSubtitleFile(url: string, select?: boolean): Promise<void>;
  // video scaling
  setZoomedToFill(zoom: boolean): Promise<void>;
  isZoomedToFill(): Promise<boolean>;
  // diagnostics
  getTechnicalInfo(): Promise<TechnicalInfo>;
  // reserved for a later milestone (implement as no-ops returning false until then):
  startPictureInPicture(): Promise<void>;
  stopPictureInPicture(): Promise<void>;
  isPictureInPictureSupported(): Promise<boolean>;
  isPictureInPictureActive(): Promise<boolean>;
}

export interface AudioTrack {
  id: number; title?: string; lang?: string; codec?: string;
  channels?: number; selected?: boolean;
}
export interface SubtitleTrack {
  id: number; title?: string; lang?: string; selected?: boolean;
}
export interface TechnicalInfo {
  videoWidth?: number; videoHeight?: number;
  videoCodec?: string; audioCodec?: string;
  fps?: number; videoBitrate?: number; audioBitrate?: number;
  cacheSeconds?: number; droppedFrames?: number;
  voDriver?: string; hwdec?: string;
}
```

> Subtitle **styling** setters (position/scale/margins/alignment/font-size/border) are
> a nice-to-have; add them in M3 only if time allows, with names mirroring the
> reference (`setSubtitlePosition`, `setSubtitleScale`, `setSubtitleAssOverride`, …).

---

## 6. Repository layout

```
expo-mpv-player/
├── README.md                      # quickstart, API, install, LGPL notice
├── LICENSE                        # MIT (wrapper)
├── NOTICE                         # LGPL attributions + source-offer (see §10)
├── CONTRIBUTING.md                # distilled §2 working agreements
├── CHANGELOG.md                   # generated from Conventional Commits
├── package.json
├── tsconfig.json
├── expo-module.config.json        # { platforms, apple.modules, android.modules }
├── index.ts                       # re-export src/
├── src/
│   ├── index.ts
│   ├── MpvPlayer.types.ts         # §5 contract
│   ├── MpvPlayerModule.ts         # requireNativeModule('MpvPlayer')
│   ├── MpvPlayerModule.web.ts     # inert stub
│   ├── MpvPlayerView.tsx          # forwardRef + useImperativeHandle → native view
│   └── MpvPlayerView.web.tsx      # inert stub (renders a "not supported on web" view)
├── ios/
│   ├── ExpoMpvPlayer.podspec      # name, ExpoModulesCore dep; MPVKit via SPM (see §7)
│   ├── MpvPlayerModule.swift      # Module definition (Name/View/Props/Events/AsyncFn)
│   ├── MpvPlayerView.swift        # ExpoView; owns CAMetalLayer + audio session
│   ├── MPVMetalLayer.swift        # CAMetalLayer subclass (from MPVKit Demo, adapted)
│   ├── MPVRenderer.swift          # raw libmpv lifecycle (import Libmpv)
│   └── Logger.swift
├── android/
│   ├── build.gradle               # ExpoModulesCorePlugin; libmpv AAR dep; ABI filters
│   ├── libs/                      # the LGPL libmpv .aar you build in M2 (or via Maven)
│   └── src/main/
│       ├── AndroidManifest.xml    # INTERNET + PiP <uses-feature required=false>
│       ├── assets/subfont.ttf     # REQUIRED for SRT subtitle font rendering
│       └── java/expo/modules/mpvplayer/
│           ├── MpvPlayerModule.kt
│           ├── MpvPlayerView.kt    # ExpoView + SurfaceView/TextureView
│           ├── MpvLib.kt           # thin observer-multiplexer over libmpv MPVLib
│           └── MPVRenderer.kt
├── plugin/
│   ├── src/index.ts               # config plugin (TS source)
│   └── tsconfig.json
├── app.plugin.js                  # compiled plugin entry (or re-export of build/plugin)
├── build/                         # compiled JS (gitignored; produced by expo-module build)
└── example/                       # Expo example app (dev build target; see §9)
    ├── App.tsx                    # player against a configurable test URL+headers
    ├── app.json                   # registers the plugin
    └── …
```

Scaffold with `npx create-expo-module@latest expo-mpv-player` (choose the
"local + publishable" layout; it generates the `expo-module.config.json`, `plugin/`,
`example/`, and the build tooling). Then reshape to the tree above.

---

## 7. iOS implementation spec (LGPL path)

### 7.1 Dependency

- **MPVKit via Swift Package Manager**, product **`MPVKit`** (LGPL — NOT `MPVKit-GPL`).
  - SPM URL: `https://github.com/mpvkit/MPVKit.git`, pin a released tag (research saw
    `0.41.0`, 2025‑12‑24, bundling mpv 0.41.0 + FFmpeg n8.1.1 — use the latest stable
    tag at build time).
  - In Swift you `import Libmpv` (the underlying C module), not `import MPVKit`.
- **Why not CocoaPods / the `mpv-ios` fork:** MPVKit is SPM-only, and the
  `mpv-ios/MPVKit` `-av` fork (Streamyfin's choice) is **GPL**. Use canonical MPVKit's
  LGPL product.
- **Expo + SPM:** SPM support in Expo modules / prebuild is the wrinkle. Two viable
  approaches — pick one in the M1 spike and document it:
  1. Declare the SPM dependency in the consumer app via the **config plugin** (§8),
     adding the package to the Xcode project on prebuild (Expo supports SPM packages in
     modules through `expo-module.config.json`'s `apple.dependencies`/the
     `withXcodeProject`-style plugin, depending on SDK version — verify against the
     target SDK).
  2. If SPM-through-prebuild proves unreliable on the target SDK, fall back to vendoring
     MPVKit's prebuilt **xcframeworks** and referencing them from the podspec
     (`vendored_frameworks`), still selecting the LGPL binaries.
- **Static frameworks:** the consumer app must build iOS with static frameworks
  (`expo-build-properties` → `ios.useFrameworks: "static"`); the config plugin should
  document/require this.

### 7.2 `expo-module.config.json`

```json
{
  "platforms": ["apple", "android", "web"],
  "apple":   { "modules": ["MpvPlayerModule"] },
  "android": { "modules": ["expo.modules.mpvplayer.MpvPlayerModule"] }
}
```

### 7.3 Module definition (`MpvPlayerModule.swift`)

`public class MpvPlayerModule: Module` returning a `ModuleDefinition` with:

- `Name("MpvPlayer")`.
- `View(MpvPlayerView.self) { … }` containing:
  - `Prop("source") { (view, dict) in view.setSource(parse(dict)) }` — parse the
    `VideoSource` dict into a Swift `LoadConfig`.
  - One **view-scoped `AsyncFunction`** per ref method in §5.4, each forwarding to the
    view (e.g. `AsyncFunction("seekTo") { (view: MpvPlayerView, s: Double) in view.seek(to: s) }`).
  - `Events("onLoad", "onPlaybackStateChange", "onProgress", "onError", "onTracksReady", "onPictureInPictureChange")`.

### 7.4 View (`MpvPlayerView.swift`)

- `class MpvPlayerView: ExpoView`.
- Owns a `CAMetalLayer` (the `MPVMetalLayer` subclass) inside the view's layer;
  `contentsScale = UIScreen.main.nativeScale`, `framebufferOnly = true`. Manage
  aspect/zoom by adjusting layer frame / drawable size.
- Declares `let onProgress = EventDispatcher()` … one per event.
- Creates an `MPVRenderer(layer:)`, sets itself as delegate, dispatches renderer
  callbacks to JS **on the main thread**.
- Manages the `AVAudioSession` (`.playback`, `.moviePlayback`) on play; restores on
  deinit; handles interruption notifications.

### 7.5 Renderer (`MPVRenderer.swift`) — the load-bearing file

`import Libmpv`. Holds `var mpv: OpaquePointer?`. Lifecycle (canonical LGPL Metal
path, adapted from the MPVKit `Demo`):

```swift
mpv = mpv_create()
// attach the CAMetalLayer as the window-id BEFORE init:
var layerPtr = Int64(Int(bitPattern: Unmanaged.passUnretained(metalLayer).toOpaque()))
mpv_set_option(mpv, "wid", MPV_FORMAT_INT64, &layerPtr)
mpv_set_option_string(mpv, "vo", "gpu-next")
mpv_set_option_string(mpv, "gpu-api", "vulkan")
mpv_set_option_string(mpv, "gpu-context", "moltenvk")
mpv_set_option_string(mpv, "hwdec", "videotoolbox")     // "no" on simulator
mpv_set_option_string(mpv, "hwdec-codecs", "all")
mpv_set_option_string(mpv, "tls-verify", "no")          // LAN/self-signed servers
mpv_request_log_messages(mpv, "warn")
mpv_initialize(mpv)
observeProperties()          // duration, time-pos, pause, track-list/count,
                             // paused-for-cache, demuxer-cache-duration
mpv_set_wakeup_callback(mpv, wakeupCB, ctx)   // drain mpv_wait_event on a bg queue
```

- **Load with headers:** set `http-header-fields` (list; entries `"Header: value"`)
  before `loadfile`, then `command(["loadfile", url, "replace"])`. After
  `MPV_EVENT_FILE_LOADED`, add any external subtitles (`sub-add`), re-apply
  `aid`/`sid` from `initialAudioId`/`initialSubtitleId`.
- **Control:** `pause` via `mpv_set_property(mpv,"pause",MPV_FORMAT_FLAG,&flag)`;
  `seek` via `command(["seek", "\(s)", "absolute"])`; `speed` via property.
- **Events:** map `MPV_EVENT_FILE_LOADED` → `onLoad`/prime tracks;
  `MPV_EVENT_PROPERTY_CHANGE` → read via `mpv_get_property` → `onProgress` /
  `onPlaybackStateChange`; `MPV_EVENT_PLAYBACK_RESTART` → ready-to-seek;
  `MPV_EVENT_SHUTDOWN` → `mpv_terminate_destroy`.
- **Throttle** `time-pos`-driven `onProgress` to ~1/sec (bypass while seeking).
- **Tracks:** enumerate `track-list/<i>/{type,id,title,lang,codec,audio-channels,selected}`.
- **HDR detection** (optional v1): read `video-params/primaries` + `…/gamma`.
- **Known Metal caveats** (document in README): clamp `CAMetalLayer.drawableSize` away
  from 1×1 to avoid a MoltenVK flicker bug; HDR Metal API validation may need disabling
  in the example app's scheme. mpv's Metal/MoltenVK path is a patch, not upstreamed —
  expect to test carefully.

### 7.6 iOS PiP — out of scope for v1

The LGPL Metal path can't trivially feed AVKit PiP (which wants an
`AVSampleBufferDisplayLayer`). Implement the four PiP ref methods as no-ops returning
`false`/resolving immediately, fire no `onPictureInPictureChange`, and document the
limitation. Revisit post‑1.0 (options: a sample-buffer bridge, or a documented GPL
build flavor users opt into — but **do not** make GPL the default).

---

## 8. Android implementation spec (LGPL path — the hard milestone)

### 8.1 The LGPL AAR (critical path — do this first in M2)

The published `dev.jdtech.mpv:libmpv:{0.5.1,1.0.0}` artifacts are **GPL**. You must
produce an **LGPL** AAR:

1. Fork/clone the build scripts from
   [`jarnedemeulemeester/libmpv-android`](https://github.com/jarnedemeulemeester/libmpv-android)
   (these are the maintained mpv-android-derived buildscripts that produce the AAR).
2. Edit the FFmpeg configure step (`buildscripts/scripts/ffmpeg.sh`) to **remove
   `--enable-gpl`** and use **`--enable-version3`** (LGPLv3) only; drop any GPL-only
   components (e.g. `libsmbclient`, GPL-only filters). Configure **mpv with
   `--enable-lgpl`**.
3. Build for ABIs `arm64-v8a` (+ `x86_64` for emulators); NDK `29.x`, CMake `4.x`,
   `ANDROID_STL=c++_shared` (ship `libc++_shared.so`).
4. Output a versioned `expo-mpv-player-libmpv-lgpl-<ver>.aar`. Either:
   - vendor it in `android/libs/` and consume via `implementation files(...)` /
     `flatDir`, **or**
   - publish **your own** LGPL AAR to a Maven repo you control and depend on that.
5. **Keep the build scripts public in this repo** (e.g. `android/libmpv-build/`) — this
   is both good practice and material to the LGPL source-availability obligation.
6. **Verify the LGPL claim**: after building, confirm the produced FFmpeg reports LGPL
   (`ffmpeg -L` / build logs show no `--enable-gpl`). Capture this in the M2 PR.

> **Spike first.** Before committing to the full module on Android, do a throwaway
> spike that builds the LGPL AAR and plays one file in a bare app. The AAR build is the
> biggest unknown in the whole project. If it proves intractable in the timebox,
> **stop and escalate to the human** (options then include: ship iOS-only v1; or have
> the human decide on a GPL Android variant as an explicit, documented exception).

### 8.2 `build.gradle`

```gradle
apply plugin: 'com.android.library'
// applies ExpoModulesCorePlugin.gradle (useCoreDependencies / useExpoPublishing)
android {
  namespace "expo.modules.mpvplayer"
  defaultConfig {
    minSdk 26
    ndk { abiFilters 'arm64-v8a', 'x86_64' }   // trim payload; add others only if needed
  }
  sourceSets { main { jniLibs.srcDirs = ['libs'] } }
}
dependencies {
  implementation files('libs/expo-mpv-player-libmpv-lgpl-<ver>.aar')  // your LGPL build
}
```

### 8.3 libmpv JNI surface — target the **1.0.0 instance API**

The JNI API changed between 0.5.1 (global static singleton) and 1.0.0 (instance via
`create()`). **Build against the 1.0.0 instance API** (your LGPL AAR should track that
source). Wrap it in `MpvLib.kt` (a thin observer-multiplexer). Surface:

```kotlin
val mpv = MPVLib.create(context) ?: error("MPVLib.create returned null")
mpv.setOptionString("config", "yes")
mpv.setOptionString("config-dir", configDir.path)   // REQUIRED: copy assets/subfont.ttf here
mpv.setOptionString("vo", voDriver /* "gpu-next" */)
mpv.setOptionString("gpu-context", "android")
mpv.setOptionString("opengl-es", "yes")
mpv.setOptionString("hwdec", "mediacodec-copy")      // "no" on emulator
mpv.setOptionString("hwdec-codecs", "h264,hevc,mpeg4,mpeg2video,vp8,vp9,av1")
mpv.setOptionString("tls-verify", "no")
mpv.setOptionString("cache", "yes")
mpv.setOptionString("demuxer-max-bytes", "64MiB")
mpv.setOptionString("force-window", "no")            // -> "yes" once a surface attaches
mpv.setOptionString("keep-open", "always")
mpv.setOptionString("ytdl", "no")
mpv.init()
mpv.addObserver(this)                                // EventObserver
mpv.observeProperty("time-pos", MpvFormat.MPV_FORMAT_DOUBLE)
mpv.observeProperty("duration", MpvFormat.MPV_FORMAT_DOUBLE)
mpv.observeProperty("pause", MpvFormat.MPV_FORMAT_FLAG)
mpv.observeProperty("track-list/count", MpvFormat.MPV_FORMAT_INT64)
mpv.observeProperty("paused-for-cache", MpvFormat.MPV_FORMAT_FLAG)
mpv.observeProperty("demuxer-cache-duration", MpvFormat.MPV_FORMAT_DOUBLE)
// load + control:
mpv.setOptionString("http-header-fields", "Authorization: …")  // before load
mpv.command(arrayOf("loadfile", url, "replace"))
mpv.command(arrayOf("seek", "$seconds", "absolute"))
mpv.setPropertyBoolean("pause", false)  // play
```

`EventObserver` gives typed `eventProperty(name, value)` callbacks (Long/Double/
Boolean/String) and `event(eventId)` for `MPV_EVENT_FILE_LOADED` (8), `SEEK` (20),
`PLAYBACK_RESTART` (21), `END_FILE` (7), `SHUTDOWN` (1). Post all to the main `Handler`.
Apply the same ~1/sec `time-pos` throttle.

### 8.4 Surface wiring

- Use a **`SurfaceView`** (preferred for video; `TextureView` is an option if PiP
  needs it later). Forward `SurfaceHolder.Callback`:
  - `surfaceCreated` → `mpv.attachSurface(holder.surface)`; set `force-window=yes`.
  - `surfaceChanged` → `mpv.setPropertyString("android-surface-size", "${w}x$h")`.
  - `surfaceDestroyed` → `mpv.detachSurface()` but **keep VO alive** (do not set
    `vo=null`) so future re-attach doesn't black-screen.
- Zoom-to-fill uses `panscan` (0.0 fit ↔ 1.0 fill).

### 8.5 Manifest, assets, size

- `AndroidManifest.xml`: `<uses-permission android:name="android.permission.INTERNET"/>`
  and `<uses-feature android:name="android.software.picture_in_picture"
  android:required="false"/>`.
- **Ship `assets/subfont.ttf`** and copy it into `config-dir` at init, or SRT subtitle
  fonts won't render.
- **Size:** the all-ABI GPL reference AAR is ~45 MB; per-ABI ~10–14 MB. Filtering to
  `arm64-v8a` (+ `x86_64`) and shipping an Android App Bundle keeps per-device install
  reasonable. Document the size cost in the README.

---

## 9. The config plugin (`plugin/src/index.ts` → `app.plugin.js`)

So the consumer app needs **zero hand-written native code** under `expo prebuild`. The
plugin must:

- **iOS:** ensure the MPVKit **LGPL** SPM package (or vendored LGPL xcframeworks) is
  added to the prebuilt Xcode project; ensure static frameworks are used (or assert and
  emit a clear error/warning if the consumer hasn't set
  `expo-build-properties` → `ios.useFrameworks: "static"`).
- **Android:** ensure `mavenCentral()` (or your custom Maven) is present; that the LGPL
  AAR is resolvable; merge the `INTERNET` permission and PiP `<uses-feature>`; allow
  cleartext if needed for LAN HTTP (`usesCleartextTraffic` — but make this opt-in via a
  plugin param, don't force it).
- **Accept plugin params** for: ABI filters, `voDriver` default, whether to enable
  cleartext, and (future) a `playerVariant` flag — defaulting to LGPL.
- The plugin is **TypeScript compiled to `build/`**; `app.plugin.js` points at it. Add a
  unit test that runs the plugin against a fixture `app.json` and asserts the mods.

---

## 10. Licensing deliverables (must ship with v1)

- **`LICENSE`** — MIT for the wrapper code you wrote.
- **`NOTICE`** — states that the package bundles **mpv** and **FFmpeg** under **LGPL**
  (v3 on iOS via MPVKit; v3 on Android via your custom build), names the versions, and
  provides the **written offer of source** for those LGPL components (link to MPVKit
  releases for iOS; link to your public Android build scripts + AAR source for Android).
  Confirm the iOS build links the **`MPVKit`** (LGPL) product, not `MPVKit-GPL`.
- **README "Licensing" section** — plain-English summary for consumers: the wrapper is
  MIT, the engine is LGPL, dynamic-link is the intended form, and a consuming
  closed-source app must (a) keep the LGPL libs replaceable/relinkable, (b) reproduce
  the attribution/notice (e.g. an in-app licenses screen), and (c) not obfuscate the
  libs. Add the standard "not legal advice" disclaimer and a note that **codec patent
  licensing (HEVC/AAC) is a separate concern** from the OSS license.
- **Do not** rename/obfuscate the mpv/FFmpeg binaries.

---

## 11. Testing, CI & verification

- **Example app (`example/`)** is the primary manual harness: a screen with a
  configurable stream URL + optional `Authorization` header, the `<MpvPlayerView>`, and
  buttons for play/pause/seek/track-select + a panel showing `getTechnicalInfo()`. This
  is how you prove direct play.
- **Smoke test (the whole reason this exists):** play a **10-bit HEVC MKV with
  TrueHD/DTS-HD audio and PGS subtitles** on a real device/sim and confirm
  `getTechnicalInfo()` shows `hwdec` active and the expected codecs — i.e. it
  *direct-plays* with no transcode. Record this in the relevant PR.
- **Unit tests (Jest):** the TS layer — `source` → native-prop mapping, ref-method
  plumbing (mock the native module), event payload typing, and the **config-plugin**
  transform against a fixture `app.json`. These run without devices/native.
- **`tsc --noEmit`**, **ESLint**, **Prettier** all green.
- **CI (GitHub Actions):**
  - `lint-and-typecheck` + `jest` on every PR.
  - `build-ios` (xcodebuild the example for a simulator) and `build-android`
    (`./gradlew :expo-mpv-player:assembleRelease` / build the example) on every PR.
  - A **license check** step asserting no `MPVKit-GPL` reference and no `--enable-gpl`
    in the Android build config.
  - The Android AAR build can be a **separate, manually-triggered/scheduled workflow**
    (it's heavy) producing a release artifact; PR CI consumes the prebuilt LGPL AAR.
  - **CI must not inject attribution** into any commit it makes (e.g. a release bot
    commit) — configure tooling accordingly.

---

## 12. Milestones (each = one or more branches → squash-merged PRs → a tagged prerelease)

Ship incrementally. Cut a prerelease (`0.x.y-rc.N`, `npm publish --tag next`) at the end
of M1, M2, M3; cut the first stable (`0.1.0` or `1.0.0` if API is frozen) after M5.

- **M0 — Scaffold & contracts.** `create-expo-module`; reshape to §6; write
  `MpvPlayer.types.ts` (§5) and the TS view/module wrappers with the native calls
  stubbed; example app renders an empty view; CI + lint/typecheck/jest green; README
  skeleton; LICENSE/NOTICE drafts. Branch: `feat/scaffold`. _No engine yet._
- **M1 — iOS playback (LGPL).** MPVKit `MPVKit` product wired (resolve the SPM-vs-prebuilt
  question), `MPVMetalLayer` + `MPVRenderer`, load/play/pause/seek/speed, `onLoad`/
  `onProgress`/`onPlaybackStateChange`/`onError`, header passing, throttle. Smoke-play a
  hard file on a simulator/device. Prerelease `0.1.0-rc.1`.
- **M2 — Android playback (LGPL AAR).** **Spike the LGPL AAR build first** (§8.1), then
  `MpvLib`/`MPVRenderer`/`SurfaceView` wiring, same transport + events, `subfont.ttf`,
  ABI filters. Smoke-play the hard file on a device/emulator. Prerelease `0.1.0-rc.2`.
- **M3 — Tracks, subtitles, diagnostics.** Audio/subtitle enumeration + selection,
  external subs, `getTechnicalInfo`, zoom-to-fill, `onTracksReady`. (Subtitle styling if
  time allows.) Prerelease `0.1.0-rc.3`.
- **M4 — Config plugin hardening + example polish.** Plugin params, both-platform
  prebuild from a clean checkout, plugin unit tests, cleartext opt-in, docs for
  consumers (incl. the static-frameworks requirement). Prerelease `0.1.0-rc.4`.
- **M5 — Docs, licensing, release.** Finalize README/NOTICE/CONTRIBUTING/CHANGELOG,
  license-check CI, verify LGPL on both platforms, publish stable to `latest`. Tag
  `v0.1.0` (or `v1.0.0` if freezing the API).
- **Deferred (post-1.0):** iOS PiP, now-playing/lock-screen, Android PiP polish,
  Chromecast/AirPlay, offline/download, tvOS, subtitle styling depth, HDR tuning.

---

## 13. Risks & open questions (resolve early; escalate if blocked)

1. **Android LGPL AAR build (highest risk).** If you can't produce a working LGPL build
   in the M2 timebox, **stop and escalate** — don't silently ship the GPL artifact in a
   package meant for closed-source consumers.
2. **MPVKit SPM under Expo prebuild.** Confirm the cleanest way to add the SPM package
   to the prebuilt project on the target SDK; fall back to vendored LGPL xcframeworks if
   needed. Decide in the M1 spike and document.
3. **iOS Metal/MoltenVK rough edges.** mpv's Metal path is a non-upstreamed patch; budget
   time for the drawable-size and HDR-validation gotchas. Test on real hardware.
4. **iOS PiP gap.** Accepted for v1 (LGPL constraint). Make the limitation explicit in
   docs so consumers don't expect it.
5. **Binary size.** Tens of MB per platform; document it. ABI filtering + App Bundle on
   Android.
6. **LGPL relink-on-locked-store nuance & codec patents.** Document, disclaim, and flag
   for the human's legal review before any commercial consumer release — out of scope to
   *solve* here, in scope to *surface*.

---

## 14. Quick reference — exact coordinates & lifecycles

**iOS (LGPL):** MPVKit SPM `https://github.com/mpvkit/MPVKit.git`, product **`MPVKit`**
(LGPL v3), `import Libmpv`. VO: `gpu-next` + `gpu-api=vulkan` + `gpu-context=moltenvk`
into a `CAMetalLayer` via `wid`. `hwdec=videotoolbox`. Headers via `http-header-fields`.

**Android (LGPL):** build your own AAR from
`jarnedemeulemeester/libmpv-android` buildscripts with FFmpeg **without `--enable-gpl`**
(`--enable-version3`) + mpv `--enable-lgpl`. 1.0.0 **instance** JNI API
(`MPVLib.create(context)`). VO `gpu-next`, `gpu-context=android`, `opengl-es=yes`,
`hwdec=mediacodec-copy`. `SurfaceView` + `attachSurface`. Copy `subfont.ttf` to
`config-dir`. `minSdk 26`. Headers via `http-header-fields`.

**Lifecycle (both):** `create → set options → initialize → observe properties →
loadfile (with headers) → drain events / property-changes → property writes & commands
for control → terminate/destroy`. Throttle `time-pos` to ~1/sec.

**DO NOT:** use `MPVKit-GPL`, the `mpv-ios/MPVKit` `-av` fork, or the prebuilt
`dev.jdtech.mpv:libmpv` Maven artifact in the shippable module — all GPL.

**Reference implementation to study (architecture only — it is GPL):**
`streamyfin/streamyfin` → `modules/mpv-player/` (default branch `develop`).

---

## 15. Reference sources

- MPVKit (LGPL/GPL products, `Package.swift`, Demo Metal VC): https://github.com/mpvkit/MPVKit
- libmpv-android buildscripts & `MPVLib` 1.0.0 API: https://github.com/jarnedemeulemeester/libmpv-android
- Findroid (`MPVPlayer.kt`, 1.0.0 consumer): https://github.com/jarnedemeulemeester/findroid
- Streamyfin module (architecture reference, MPL-2.0 app / GPL engine): https://github.com/streamyfin/streamyfin
- Expo Modules API: https://docs.expo.dev/modules/overview/
- FFmpeg legal / LGPL vs GPL: https://www.ffmpeg.org/legal.html
- libVLC/VLC LGPL relicensing history (context for the LGPL-on-store debate): https://www.videolan.org/press/lgpl-libvlc.html
