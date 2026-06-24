# Gate status (single source of truth)

Update this table **only** when the artifact exists in this directory. Legend:
✅ artifact committed · ⏳ implemented, not yet verified · ⛔ blocked · n/a.

| Gate | iOS | Android | Notes |
|---|---|---|---|
| G0 static | ✅ | ✅ | CI green on every PR |
| G1 LGPL provenance | n/a | ⏳ | iOS uses MPVKit LGPL (record versions in NOTICE); Android needs a built AAR's `config.h` |
| G2 compile+link | ✅ | ⏳ | iOS sim build succeeded (PR #7); Android blocked on the AAR |
| G3 launch | ✅ | ⏳ | iOS app launched without native crash; screenshot in `ios/` |
| G4 render | ⛔ | ⏳ | iOS: New-Arch view-config blocker; Android: needs G2 |
| G5 hwdec (device) | ⏳ | ⏳ | physical device required |
| G6 headers | ⏳ | ⏳ | needs render + fixture; header bug fix pending |
| G7 onError | ⏳ | ⏳ | needs render + fixture; onError wiring pending |

This reflects reality as of the verification-harness PR. No runtime gate above
G3 has an artifact yet — do not claim otherwise.
