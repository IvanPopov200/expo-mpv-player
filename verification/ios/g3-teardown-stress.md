# G3-stress (teardown safety) — PASS (iOS)

Mounting → playing → unmounting `<MpvPlayerView>` 20 times in a row (40 source
toggles, ~0.7s apart) on the iOS Simulator: the app process stayed alive the
whole time and produced **no native crash** and no crash report.

- App console: 40× `[MPV-EVIDENCE] stress toggle N`, then `stress done (20
  mount/unmount cycles)`.
- `launchctl list` showed the app PID still running afterward.

Fix (P1-F): all mpv teardown goes through `invalidate()` → `destroyMpv()`,
serialized on the event queue (so it can't race with `drainEvents()`) and
idempotent via a `destroyed` flag (so `MPV_EVENT_SHUTDOWN` and the view's
explicit teardown can't double-`mpv_terminate_destroy`). The view calls
`renderer.invalidate()` from `deinit`.
