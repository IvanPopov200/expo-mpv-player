# G6 (auth headers) — PASS (iOS)

mpv requested the fixture `/ok` route carrying the EXACT comma-bearing
`Authorization` header, and the fixture served the video (206). A naive
comma-join would have split the value into bogus headers and the fixture would
have returned 401.

Fixture `/log` (see `g6-headers.json`):

```json
{
  "method": "GET",
  "url": "/ok",
  "authorization": "MediaBrowser Client=\"ExpoMpvPlayer\", Token=\"fixture-token-123\"",
  "status": 206
}
```

The fix (P1-D): set `http-header-fields` via `change-list … append` (one list
item per header, comma-safe) before `loadfile`, instead of comma-joining; and
apply post-init options via the property API. Verified on the iOS Simulator.
