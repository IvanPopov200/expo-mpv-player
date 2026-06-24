# Contributing to expo-mpv-player

Thanks for your interest. This document distills the working agreements every
change in this repository must follow.

## Licensing boundary (read this first)

The entire point of this module is a **clean LGPL boundary** so a closed-source
app can legally link a copyleft media engine. Both platforms must ship **LGPL**
builds of mpv/FFmpeg — never GPL.

- **iOS:** use the MPVKit **`MPVKit`** product (LGPL). Do **not** use
  `MPVKit-GPL` or the `mpv-ios/MPVKit` `-av` fork (both GPL).
- **Android:** build the AAR from `android/libmpv-build/` with FFmpeg configured
  **without** `--enable-gpl` (`--enable-version3`) and mpv `--enable-lgpl`. Do
  **not** link the prebuilt `dev.jdtech.mpv:libmpv` Maven artifact (GPL).
- Do not rename or obfuscate the mpv/FFmpeg binaries.

CI enforces this with a license check; PRs that reintroduce a GPL path are
blocked.

## Branching

- `main` is always releasable and protected. **Never commit directly to `main`.**
- One branch per unit of work: `<type>/<short-kebab-summary>`, where `<type>` is
  one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`,
  `perf`. e.g. `feat/ios-metal-renderer`, `build/android-lgpl-aar`.
- Rebase your branch on the latest `main` before opening/refreshing its PR.

## Commits — Conventional Commits

- Format: `<type>(<optional-scope>): <imperative summary>`.
- Scopes in use: `ios`, `android`, `js`, `plugin`, `example`, `ci`, `build`,
  `docs`, `release`.
- Body explains *why* when not obvious; footer carries `BREAKING CHANGE:` notes.
- Keep commits focused; several small commits per branch is fine (they squash).

## Attribution policy — STRICT

- **No `Co-Authored-By:` trailers** and **no tool/agent signatures** of any kind
  in commit messages, PR titles, or PR bodies.
- Do not add bot/agent identities to `package.json`, `AUTHORS`, `NOTICE`, code
  comments, or anywhere else.
- Commit author/committer is the human's configured git identity only.

## Pull requests

- PR title = the intended squash subject (a valid Conventional Commit).
- PR body sections: **What**, **Why**, **How tested** (commands + device/sim),
  **Follow-ups**.
- PRs land via **Squash and Merge** only. The squash subject = the PR title; the
  squash body is a clean summary (delete the auto "* commit" list and any
  attribution trailer the platform appends). Net effect: one tidy Conventional
  Commit per PR on `main`.

## Definition of done

A change is done only when:

- Code builds on both platforms it touches.
- The example app exercises it.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:plugin` are
  green.
- Docs reflect it.
- The PR follows the rules above.

## Local checks

```sh
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src
npm run lint -- plugin # eslint plugin/src   (or: npx expo-module lint plugin)
npm test               # jest — TS layer
npm run test:plugin    # jest — config plugin
npm run build          # expo-module build (compiles src -> build/)
npm run build:plugin   # tsc --build plugin
```

## Versioning

- SemVer. Stay in `0.y.z` while the API is settling. Promote to `1.0.0` only
  when the public API is declared stable.
- Prereleases use `-rc.N` and publish under the npm `next` dist-tag; stable
  publishes under `latest`. git tags mirror the version with a `v` prefix and are
  annotated.
