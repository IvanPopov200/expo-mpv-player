# G7 (error path → onError) — PASS (iOS)

Loading the fixture `/unauth` route (always HTTP 401) makes mpv fail the load,
and the module fires `onError` (previously END_FILE was treated only as "stopped"
so onError never fired).

- Fixture `/log`: `GET /unauth -> 401`.
- App console: `[MPV-EVIDENCE] onError {"error":"loading failed","target":136}`.

Fix (P1-E, iOS): decode `mpv_event_end_file`; when `reason ==
MPV_END_FILE_REASON_ERROR`, dispatch `onError(mpv_error_string(error))`. A clean
EOF/stop (non-ERROR reason) does not fire onError. Verified on the iOS Simulator.

(Android: the libmpv-android 1.0.0 EventObserver doesn't expose the END_FILE
reason — documented in MPVRenderer.kt; needs a wrapper hook + emulator to verify.)
