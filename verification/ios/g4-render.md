# G4 (iOS render) — PASS

`<MpvPlayerView>` renders decoded video frames on the iOS Simulator
(iPhone 17 Pro, iOS 26). See `g4-render.png`: the player shows live video
(software decode — simulators can't use VideoToolbox; that's G5/device).

The same screen confirms the rest of the JS↔native bridge working:
- **onProgress**: status reads `19.5s / 634.6s · cache 137.2s`.
- **onPlaybackStateChange**: `state: {"isLoading":false,"isReadyToSeek":true}`.
- **track enumeration**: 5 audio tracks listed (#1–#5, #5 selected).

## Root cause that had blocked render (P0-C)

NOT a Fabric/New-Architecture view-config bug (getViewConfig returns a valid
config) and NOT native code. It was a **React version mismatch**: react-native
0.85.3 bundles `react-native-renderer` built against **exactly react 19.2.3** and
hard-checks it at runtime; the app had react 19.2.7 (allowed by the `^19.2.3`
peer range but rejected by the renderer's exact-match check), so the renderer
failed with "Incompatible React versions" → "Cannot read property 'default' of
undefined". Fix: pin react to 19.2.3.

Stream: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` (H.264, software-
decodable — fine for G4 on a simulator).
