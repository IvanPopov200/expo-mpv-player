# expo-mpv-player

A **play-anything** video player for **Expo** and **React Native**, powered by
[**libmpv**](https://github.com/mpv-player/mpv). It direct-plays the codecs and
containers that the platform players (`AVPlayer`, `ExoPlayer`) reject — MKV, 10‑bit
HEVC, VC‑1, DTS / DTS‑HD / TrueHD, E‑AC3, PGS/ASS subtitles — so your media server
doesn't have to transcode.

> **Status:** pre‑1.0, under active development. The public API (the `source` prop,
> events, and ref methods) is stabilizing but may still change before `1.0.0`.
> Release candidates are tagged in git (`v0.1.0-rc.N`); npm prereleases publish
> under the `next` dist‑tag and the first `latest` publish follows a verified
> native build (see [Building the native engines](#building-the-native-engines)).

---

## Why

Platform-native players are limited to a narrow, OS-defined set of codecs. Point one at
a typical home-media file — say a 10‑bit HEVC MKV with TrueHD audio and image-based
subtitles — and it fails on container, audio, *and* subtitle support, forcing your
server into a slow, lossy, CPU/GPU-hungry transcode. `libmpv` bundles its own
decoders (FFmpeg + libass) and decodes on the **client**, so the file streams as-is.
This is the same engine strategy used by Swiftfin, Findroid, and other serious
self-hosted-media clients — packaged here as a clean, New-Architecture-native Expo
module.

## Features

- 🎞️ **Broad codec/container support** via libmpv (MKV, HEVC 10‑bit, VC‑1, DTS‑HD,
  TrueHD, E‑AC3, AV1, FLAC, PGS/ASS subtitles, …).
- ⚡ **Hardware decoding** (VideoToolbox on iOS, MediaCodec on Android).
- 🎚️ **Audio & subtitle track selection**, external subtitle files, resume position.
- 🌐 **Remote streams with custom HTTP headers** (e.g. an `Authorization` header) — the
  module is backend-agnostic; it takes a URL + headers and plays.
- 🧩 **Expo config plugin** — works under `expo prebuild` with no hand-written native
  code in your app.
- 🆕 **New Architecture** (Fabric) native; built on the Expo Modules API.

## Platform support

| Platform | Supported | Notes |
|---|---|---|
| iOS | ✅ | iOS 14+. Renders via Metal/MoltenVK. Links statically (no `useFrameworks` needed). |
| tvOS | ⚠️ experimental | iOS 14+ codebase; HDR passthrough is rough. |
| Android | ✅ | **minSdk 26** (Android 8.0). Below 26, fall back to another player. |
| Web | ❌ | Exports inert stubs so your app still bundles; renders an unsupported notice. |

> **Not available in Expo Go.** This module ships native code, so you need a
> [development build](https://docs.expo.dev/develop/development-builds/introduction/).

## Installation

```sh
npm install expo-mpv-player
# prereleases:
npm install expo-mpv-player@next
```

Add the config plugin to your `app.json` / `app.config.js`:

```json
{
  "expo": {
    "plugins": ["expo-mpv-player"]
  }
}
```

No `useFrameworks` setting is needed — keep your app on its **default (static)**
linkage. The iOS engine is the LGPL MPVKit prebuilt xcframeworks, vendored by this
module's pod, so they link into your app once without conflicting with other native
modules. (The old dynamic-frameworks requirement broke React-core linking for other
RN native modules; it is gone.) Then regenerate native projects and build a dev
client:

```sh
npx expo prebuild --clean
npx expo run:ios      # or: npx expo run:android
```

> **iOS prerequisite:** the LGPL MPVKit xcframeworks (~1 GB) are fetched into the
> module's `ios/Frameworks/` on `pod install` (or run
> `node_modules/expo-mpv-player/scripts/fetch-mpvkit-xcframeworks.sh`). They are not
> committed to git.

### Config plugin options

```json
["expo-mpv-player", {
  "androidAbiFilters": ["arm64-v8a", "x86_64"],
  "enableCleartextTraffic": false,
  "defaultVoDriver": "gpu-next"
}]
```

| Option | Default | Description |
|---|---|---|
| `androidAbiFilters` | `["arm64-v8a", "x86_64"]` | Native ABIs to bundle. Fewer = smaller app. |
| `enableCleartextTraffic` | `false` | Allow plain HTTP (e.g. a LAN server). Opt in deliberately. |
| `defaultVoDriver` | `"gpu-next"` | Android video output driver (`gpu-next` or `gpu`). |

## Building the native engines

This package ships **LGPL** builds of mpv/FFmpeg on both platforms (the clean
license boundary is the whole point — see [Licensing](#licensing)).

- **iOS** vendors the LGPL `MPVKit` prebuilt xcframeworks from this module's pod
  (static linkage; no `useFrameworks` requirement). Details in
  [`docs/ios-integration.md`](./docs/ios-integration.md).
- **Android** links a custom **LGPL** `libmpv` AAR you build from the public
  scripts in [`android/libmpv-build/`](./android/libmpv-build/) (FFmpeg without
  `--enable-gpl`; mpv `--enable-lgpl`). The prebuilt GPL Maven artifact is never
  used. The AAR is a native binary produced by
  [`android-aar.yml`](./.github/workflows/android-aar.yml) (or the script
  locally) on a machine with the Android NDK — it is not committed to git.

CI runs lint/typecheck/tests and a license check that rejects any GPL engine
path on every PR; the heavier example-app native builds run on demand via
[`native-build.yml`](./.github/workflows/native-build.yml).

## Quick start

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import { MpvPlayerView, type MpvPlayerViewRef } from 'expo-mpv-player';

export default function Player() {
  const ref = useRef<MpvPlayerViewRef>(null);

  return (
    <View style={{ flex: 1 }}>
      <MpvPlayerView
        ref={ref}
        style={{ flex: 1 }}
        source={{
          url: 'https://media.example.com/video/stream',
          headers: { Authorization: 'MediaBrowser Token="…"' },
          startPosition: 0,
          autoplay: true,
        }}
        onLoad={(e) => console.log('loaded', e.nativeEvent.url)}
        onProgress={(e) =>
          console.log(e.nativeEvent.position, '/', e.nativeEvent.duration)
        }
        onPlaybackStateChange={(e) => console.log(e.nativeEvent)}
        onError={(e) => console.warn(e.nativeEvent.error)}
        onTracksReady={async () => {
          const subs = await ref.current?.getSubtitleTracks();
          console.log('subtitle tracks', subs);
        }}
      />

      <Button title="Play" onPress={() => ref.current?.play()} />
      <Button title="Pause" onPress={() => ref.current?.pause()} />
      <Button title="+30s" onPress={() => ref.current?.seekBy(30)} />
    </View>
  );
}
```

## API

### `<MpvPlayerView>` props

| Prop | Type | Description |
|---|---|---|
| `source` | `VideoSource` | URL + load options (see below). |
| `style` | `StyleProp<ViewStyle>` | Standard view style. |
| `onLoad` | `(e) => void` | File loaded. `{ url }`. |
| `onProgress` | `(e) => void` | ~1×/sec. `{ position, duration, progress, cacheSeconds }`. |
| `onPlaybackStateChange` | `(e) => void` | Partial state: `{ isPaused?, isPlaying?, isLoading?, isReadyToSeek? }`. |
| `onTracksReady` | `(e) => void` | Tracks are enumerable; query them via the ref. |
| `onError` | `(e) => void` | `{ error }`. |
| `onPictureInPictureChange` | `(e) => void` | Reserved — PiP is not implemented yet. |

### `VideoSource`

```ts
interface VideoSource {
  url: string;
  headers?: Record<string, string>;
  externalSubtitles?: string[];
  startPosition?: number;       // seconds
  autoplay?: boolean;           // default true
  initialAudioId?: number;
  initialSubtitleId?: number;
  cacheConfig?: {
    enabled?: 'auto' | 'yes' | 'no';
    cacheSeconds?: number;
    maxBytes?: number;
    maxBackBytes?: number;
  };
  voDriver?: 'gpu-next' | 'gpu'; // Android only
  /** Allow self-signed/unverified TLS for this source. Default false (certs are
   *  validated). Enable only for a trusted LAN server with a self-signed cert. */
  allowSelfSignedTls?: boolean;
}
```

### Imperative methods (via `ref`)

All return a `Promise`.

- **Transport:** `play()`, `pause()`, `seekTo(seconds)`, `seekBy(seconds)`,
  `setSpeed(rate)`, `getSpeed()`, `isPaused()`, `getCurrentPosition()`, `getDuration()`
- **Audio:** `getAudioTracks()`, `setAudioTrack(id)`, `getCurrentAudioTrack()`
- **Subtitles:** `getSubtitleTracks()`, `setSubtitleTrack(id)`, `disableSubtitles()`,
  `getCurrentSubtitleTrack()`, `addSubtitleFile(url, select?)`
- **Subtitle styling & A/V sync:** `setSubtitleScale(scale)`,
  `setSubtitlePosition(position)`, `setSubtitleDelay(seconds)`, `setAudioDelay(seconds)`
- **Video:** `setZoomedToFill(zoom)`, `isZoomedToFill()`
- **Diagnostics:** `getTechnicalInfo()` → `{ videoWidth, videoHeight, videoCodec,
  audioCodec, fps, videoBitrate, audioBitrate, cacheSeconds, droppedFrames, voDriver,
  hwdec }`

Full type definitions ship with the package.

## Known limitations

- **Picture‑in‑Picture is not implemented yet** (the LGPL rendering path doesn't feed
  AVKit/Android PiP cleanly). Planned post‑1.0.
- **Android requires API 26+.** The native libraries don't support older devices.
- **Binary size:** the native engine adds roughly **10–14 MB per ABI**. Trim with
  `androidAbiFilters` and ship an Android App Bundle so Play delivers per-device ABIs.
- **No web playback** (stubs only).

## Licensing

The wrapper code in this repository is **MIT** (see [`LICENSE`](./LICENSE)).

This package **bundles mpv and FFmpeg under the LGPL** (v3 via MPVKit on iOS; an
LGPL FFmpeg build on Android). See [`NOTICE`](./NOTICE) for attributions, versions, and
the written offer of source for those components.

If you ship this in a **closed-source** app, the LGPL applies to the bundled mpv/FFmpeg
libraries. Reproduce the attribution notice (e.g. an in-app licenses screen) and don't
obfuscate the libraries; your own application code stays proprietary. Note the linkage:

- **Android** links libmpv as a **shared** library (`.so`) — replaceable as-is, the
  simplest LGPL path.
- **iOS** links the MPVKit LGPL xcframeworks **statically**. LGPL §6 then asks you to
  let a user **relink** your app against a modified libmpv. In practice: keep using the
  unmodified, published MPVKit LGPL binaries (provided here in their relinkable
  xcframework form) and, on request, provide your app's object files / a relinkable
  build. (This is the standard obligation for MPVKit's static LGPL distribution; it is
  the app distributor's to honor.)

> ⚠️ **Not legal advice.** Codec **patent** licensing (e.g. HEVC, AAC) is a separate
> concern from the open-source license. If you distribute a commercial app, get a legal
> review.

## Acknowledgements

Built on [mpv](https://github.com/mpv-player/mpv) and
[FFmpeg](https://ffmpeg.org/). iOS binaries via
[MPVKit](https://github.com/mpvkit/MPVKit); Android libmpv tooling derived from
[libmpv-android](https://github.com/jarnedemeulemeester/libmpv-android). Architecture
informed by [Streamyfin](https://github.com/streamyfin/streamyfin),
[Swiftfin](https://github.com/jellyfin/Swiftfin), and
[Findroid](https://github.com/jarnedemeulemeester/findroid).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). In short: branch per change, Conventional
Commits, squash-and-merge, SemVer with `-rc.N` prereleases.

## License

[MIT](./LICENSE) (wrapper) · bundled mpv/FFmpeg under LGPL — see [`NOTICE`](./NOTICE).
