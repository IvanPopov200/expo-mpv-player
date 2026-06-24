# G5 — hardware decode (the one gate that needs physical devices)

Every other gate (G0–G4, G6, G7) is verified on both platforms (see
`STATUS.md`). **G5 — hardware video decode — cannot be verified in this
environment**: the iOS Simulator and the Android emulator both fall back to
software decode, so confirming the hwdec path requires real hardware.

What "verified" means here: load a real H.264/HEVC stream, then read
`getTechnicalInfo()` and confirm `hwdec` reports a hardware decoder (not `no` /
software), with smooth playback and low dropped frames.

## iOS (physical iPhone/iPad)

1. `cd example && npx expo run:ios --device` (select your connected device).
2. In the app, Load the default stream (or any H.264/HEVC URL).
3. Tap **Copy tech info** and confirm `hwdec` is `videotoolbox` (or
   `videotoolbox-copy`), `videoCodec` is H.264/HEVC, and `droppedFrames` stays
   low during playback.
4. Capture: a screenshot of playback + the copied tech-info JSON →
   `verification/ios/g5-hwdec.{png,json}`, then flip iOS G5 to ✅ in `STATUS.md`.

## Android (physical device, arm64)

1. Ensure the LGPL AAR is in `android/libs/` (build via the `android-aar.yml`
   workflow or `android/libmpv-build/build-lgpl-aar.sh`).
2. `cd example && npx expo run:android --device`.
3. Load an H.264/HEVC URL, then **Copy tech info**; confirm `hwdec` is
   `mediacodec` or `mediacodec-copy` and `droppedFrames` stays low.
   - Cross-check with logcat: `adb logcat | grep -i "mediacodec\|hwdec"` should
     show a MediaCodec decoder being created.
4. Capture: screenshot + tech-info JSON → `verification/android/g5-hwdec.{png,json}`,
   then flip Android G5 to ✅ in `STATUS.md`.

## Notes

- HEVC/H.264 are the realistic hwdec codecs on mobile. AV1 hwdec is device-
  dependent; software dav1d is the fallback and is fine to leave unverified.
- If hwdec reports software on a capable device, check `voDriver` (`gpu-next`
  vs `gpu`) and that the source codec is actually hardware-supported on that SoC.
