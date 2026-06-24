# G5 — Android hardware decode ✅ (physical device)

Verified on a **physical Retroid Pocket 6** — Snapdragon 8 Gen 2 (`QCS8550` /
`kalama`), Android 13 (API 33), arm64-v8a — connected over USB (`adb`). The
example app (stock r27 LGPL AAR) loaded 1080p test clips served over HTTP by the
fixture server; `MPVRenderer` sets `hwdec=mediacodec-copy` on real devices.

## H.264 ✅ → Qualcomm `c2.qti.avc.decoder`

```
[vd:v] Trying hardware decoding via h264_mediacodec-mediacodec-copy.
[vd:v] Using underlying hw-decoder 'h264_mediacodec'
[ffmpeg/video:v] h264_mediacodec: MediaCodec started successfully: codec = c2.qti.avc.decoder
[vd:info] Using hardware decoding (mediacodec-copy).
```

`getTechnicalInfo()` (the module's public API):
`{"videoCodec":"H.264 / AVC …","hwdec":"mediacodec-copy","droppedFrames":0,"fps":30,"videoWidth":1920,"videoHeight":1080}`

Screenshot: `g5-h264-playback.png`.

## HEVC / H.265 ✅ → Qualcomm `c2.qti.hevc.decoder`

```
[ffmpeg/video:v] hevc_mediacodec: Output MediaFormat changed to {… width=1920, height=1080 …}
[vd:info] Using hardware decoding (mediacodec-copy).
QC2Comp: [hevcD_21] Stats: … Stream: 30.00fps 5.0Mbps
```

`getTechnicalInfo()`:
`{"videoCodec":"H.265 / HEVC …","hwdec":"mediacodec-copy","droppedFrames":0,"fps":30,"videoWidth":1920,"videoHeight":1080}`

Screenshot: `g5-hevc-playback.png`.

## Result

Both codecs decode on the Qualcomm hardware (`c2.qti.*.decoder`) via mpv's
MediaCodec path, the module reports `hwdec: mediacodec-copy`, and **0 dropped
frames**. **Android G5 PASSED.**

Artifacts: `g5-hwdec-logcat.txt`, `g5-h264-playback.png`, `g5-hevc-playback.png`.

(iOS G5 — VideoToolbox on a physical iPhone/iPad — is still open; see
`../G5-HANDOFF.md`.)
