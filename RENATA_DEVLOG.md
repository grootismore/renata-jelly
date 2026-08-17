# Renata — Development Log

## Phase 0 — Repository Audit & Baseline (2026-08-17)

### Baseline commit
- Repo: `grootismore/renata-jelly` (fork of `streamyfin/streamyfin`)
- Branch: `claude/renata-baseline-phase-0-e2kfu8`, created from `develop`
- Baseline commit: `137a8b8` — "feat(storage): add data migrations and re-show the intro sheet (#1982)"
- `claude/renata-baseline-phase-0-e2kfu8` and `origin/develop` point at the identical commit; no code changes existed on this branch before Phase 0. The PR-numbered merge commits (#1976–#1982) indicate this fork tracks upstream `develop` closely with no local divergence.
- History available locally is a shallow clone (50 commits, back to 2026-08-09), so the exact original fork point from `streamyfin/streamyfin` cannot be determined from local git alone. README/package metadata confirm upstream is `streamyfin/streamyfin`, app id `com.fredrikburmester.streamyfin`.

### Actions taken this phase
- Copied the six Renata starter-pack docs into the repo root (`README_START_HERE.md`, `RENATA_PRD.md`, `RENATA_CLAUDE_RULES.md`, `RENATA_ROADMAP.md`, `RENATA_PLAYBACK_TEST_MATRIX.md`, `PROMPT_01_BASELINE.md`).
- Initialized the `utils/jellyseerr` git submodule (was uninitialized; required for a clean typecheck).
- Ran `bun install`, `bun run typecheck`, `bun run check` (biome), `bun run i18n:check`, `bun run doctor`, `bun test`. No application code was modified.
- Existing upstream `CLAUDE.md` was left untouched, per instructions.

### Architecture findings
See report delivered to the user for the full write-up. Summary:
- **Auth/SDK**: `providers/JellyfinProvider.tsx` owns `@jellyfin/sdk` init, login (password/saved-credential/Quick Connect), MMKV-persisted session, Jotai `apiAtom`/`userAtom`.
- **Navigation**: Expo Router, `(auth)` protected group, tab route groups `(home)/(libraries)/(search)/(favorites)/(watchlists)`, single player route `app/(auth)/player/direct-player.tsx` for all engines, TV screens split by filename (`*.tv.tsx`) not `.tv.tsx` Metro resolution.
- **State**: React Query (MMKV-persisted) + Jotai atoms under `utils/atoms/`.
- **PlaybackInfo/negotiation**: `utils/jellyfin/media/getStreamUrl.ts` calls `getPlaybackInfo`; device profiles built in `utils/profiles/native.ts` (playback) and `utils/profiles/download.ts`, keyed off `getActivePlayerType()`.
- **Progress reporting**: no single owner — `hooks/usePlaybackManager.ts` is the shared progress/played-state facade, but start/stop calls are separately implemented in `direct-player.tsx`, `NativePlayerProvider.tsx`, and `MusicPlayerProvider.tsx`.
- **MPV**: `modules/mpv-player` (Swift + Kotlin), backed by the `MPVKit` CocoaPod per `ios/MpvPlayer.podspec`.
- **Downloads**: `modules/background-downloader` + `providers/DownloadProvider.tsx`; offline playback reuses the same `direct-player.tsx` route and engine selection with a local file URL.

### Critical PRD discrepancy
The PRD (§6) assumes four distinct engines: Auto/MPV/VLC/Native. The actual codebase has:
- `VideoPlayer` enum = `MPV | ExoPlayer | Native` (`utils/atoms/settings.ts`).
- **No VLC integration exists anywhere in the repo** (no `modules/vlc-player`, no VLCKit references outside the Renata docs themselves).
- **"Native" is not a separate decode path.** It is the same libmpv engine (`modules/mpv-player/ios/PlayerEngine.swift`, `MPVPlayerEngine`) rendering through a different SwiftUI controls/chrome layer (`NativePlayer/NativePlayerViewController.swift`) vs. the classic RN-embedded view (`MpvPlayerView.swift`). Comments in `VideoPlayerSelector.tsx` confirm this explicitly: "both players run the same MPV engine, the choice is only which controls layer renders."
- `ExoPlayer` exists (Android TV only) and is not mentioned in the PRD at all.

### Validation results (this container — Linux, no Xcode/macOS)
| Check | Result |
|---|---|
| `bun install` | Partial failure: `react-native-track-player` is a `github:` tarball dependency fetched via `api.github.com`, blocked (403) by this container's network proxy. 625 packages installed before the failure; sufficient for typecheck/lint. Likely to succeed unrestricted on a normal machine/CI. |
| `bun run typecheck` | ✅ Pass (only after initializing the `jellyseerr` submodule — otherwise 101 errors from missing submodule types) |
| `bun run check` (biome) | ✅ Pass, 728 files, no issues |
| `bun run i18n:check` | ✅ Pass, no missing/unused keys |
| `bun run doctor` (expo-doctor) | ⚠️ 18/20 pass; 2 failures are network calls to Expo's config-schema and React Native Directory endpoints, blocked by the container proxy — not project issues |
| `bun test` | ⚠️ 204 pass / 5 fail. Pre-existing failures, unrelated to Phase 0 changes, in `utils/seriesTrackMemory.test.ts` and `utils/jellyfin/getDefaultPlaySettings.test.ts` (series subtitle/audio track-memory precedence tests). No GitHub Actions workflow currently runs `bun test`, so these are not CI-gated and predate this fork's Renata work. |
| `expo prebuild` / iOS build | Not attempted — requires macOS/Xcode, unavailable in this container. |

### Blockers
1. No macOS/Xcode/CocoaPods available in this remote container → cannot run `bun run prebuild`, `bun run ios`, or produce a physical-device build here. Requires a Mac (or EAS cloud build).
2. Container network proxy blocks `api.github.com` tarball fetches and two `expo-doctor` network checks. Not expected to reproduce on a normal dev machine.
3. 5 pre-existing failing unit tests on baseline (see table above) — not caused by Phase 0, but should be triaged before relying on that test suite as a regression gate.

### Changed files this phase
- Added (untracked → to be committed): `README_START_HERE.md`, `RENATA_PRD.md`, `RENATA_CLAUDE_RULES.md`, `RENATA_ROADMAP.md`, `RENATA_PLAYBACK_TEST_MATRIX.md`, `PROMPT_01_BASELINE.md`, `RENATA_DEVLOG.md` (this file).
- No application/source files modified. `CLAUDE.md` untouched.
- `utils/jellyseerr` submodule initialized locally (not a tracked change — submodule pointer was already committed at `fc6a9e9`, it just wasn't checked out).

### Next recommended step (superseded — see Phase 0.5 below)
~~On a Mac with Xcode installed: `bun i && bun run submodule-reload && bun run prebuild && bun run ios`~~ — the user has no Mac/Xcode. The dev workflow is EAS-cloud-build-only; see Phase 0.5 for the corrected next step.

---

## Phase 0.5 — EAS Readiness & Documentation Correction (2026-08-17)

### Purpose
The user has no Mac/Xcode. Their workflow is: Claude Code → GitHub → EAS cloud build → physical iPhone. This phase (1) corrects the Renata docs' player-architecture assumptions using the Phase 0 findings, and (2) audits whether EAS Build can actually produce an installable iOS build for this fork without local Xcode.

### Documentation corrected
Per the Phase 0 finding (no VLC integration exists; "Native" is the MPV engine with a different controls layer, not a separate decoder), updated:
- `RENATA_PRD.md` §6 (Player architecture) — rewritten to state the actual three-value `VideoPlayer` enum (MPV/ExoPlayer/Native), that Native shares the MPV engine, that ExoPlayer is Android-TV-only, and that VLC is future-investigation scope only, not an MVP engine. §9's "player-engine selector" bullet reworded to "player-controls-layer selector."
- `RENATA_CLAUDE_RULES.md` — Protected areas list: merged "MPV native integration / MPVKit bridge" and "native Swift/Apple player integration" into one entry (they're the same protected surface, `modules/mpv-player`), removed VLC as a protected-but-existing system, added a note that VLC would be new-system creation, not modification, if ever attempted.
- `RENATA_ROADMAP.md` — Phase 8 reworded from "Expose Auto/MPV/VLC/Native" to exposing the real MPV/Native controls-layer choice only.
- `RENATA_PLAYBACK_TEST_MATRIX.md` — added an engine legend; marked the VLC row (T08) as out-of-scope/not testable; added T09 (MKV+HEVC Main10+AAC+ASS via Native) as the Native-engine counterpart to the flagship MPV test case T01, preserving the PRD §5 example target under both controls layers.
- `RENATA_DEVLOG.md` — this entry.

No player/native/source code was touched — this was a documentation-only correction, as instructed.

### EAS readiness findings (from repository inspection, not guessed)

**Project ownership — the single biggest blocker.** `app.json` currently has:
```json
"owner": "streamyfin",
"extra": { "eas": { "projectId": "e79219d1-797f-4fbe-9fa1-cfd360690a68" } },
"updates": { "url": "https://u.expo.dev/e79219d1-797f-4fbe-9fa1-cfd360690a68" }
```
This wires the fork to the **upstream Streamyfin team's own EAS project**. The user almost certainly does not have access to that project. `eas build` will fail (or, worse, attempt to act against someone else's project) until this is repointed to a project the user owns. **Not changed in this phase** — it wasn't asked for, and doing it requires the user's own authenticated `eas` CLI session (`eas init` / `eas build:configure`), which can't be done blind on their behalf. Flagged as the first concrete step for the user, ahead of Phase 1 branding.

**CNG, not committed native projects.** `ios/` and `android/` are gitignored and absent; every EAS build profile's custom config runs `expo prebuild --platform ios --no-install` fresh, then `pod install`. Nothing has to be regenerated or reconciled locally — this is exactly the model EAS Build expects.

**MPVKit is fetched via a config plugin, not vendored.** `plugins/withGitPod.ts` (invoked from `app.json` with `podspecUrl: https://raw.githubusercontent.com/streamyfin/MPVKit/0.41.0-av2/MPVKit.podspec`) injects `pod 'MPVKit', :podspec => '<url>'` into the generated Podfile during prebuild. `pod install` then resolves it like any other podspec-sourced pod — this requires outbound network access from the EAS build worker to `raw.githubusercontent.com`, which EAS's standard build environment has (unlike this local sandbox's restricted proxy).

**Strong first-party evidence EAS already builds this successfully today.** `plugins/with-runtime-framework-headers.ts` is a Podfile `post_install` patch specifically targeting Xcode 26 / iOS 26 SwiftUI-framework-split linker errors (`cannot link directly with 'SwiftUICore'`) affecting the SwiftUI-based pods (ExpoUI, GlassEffectView, GlassPoster) used by the Native player's controls layer, with `EXPO_TV` guards to keep tvOS unaffected. A patch this specific only gets written by someone who hit the real linker error on a real build — meaning upstream Streamyfin has already gotten MPVKit + the SwiftUI Native controls layer compiling through this exact prebuild/pod-install pipeline (used by both local `expo run:ios` and EAS's custom build ymls). This is the strongest available evidence that the MPVKit build itself is not the risk.

**Bun package-manager detection gap between production and development profiles.** All four production-tier profiles (`production`, `production-apk`, `production-apk-tv`, `production_tv`) override EAS's default managed install/prebuild steps with a custom `.eas/build/*.yml` that forces `bun install --frozen-lockfile` + `bun x expo prebuild`. Their own comments explain why: EAS's default `eas/install_node_modules`/`eas/prebuild` steps auto-detect the package manager from lockfiles and don't reliably pick up this project's `bun.lock`, falling back to yarn and breaking install. The `development` profile — the one the user's workflow depends on — **had no such override**, and would have hit the same default-managed path. Added `.eas/build/ios-development.yml` (steps identical to `ios-production.yml`, `${ eas.job.secrets.buildCredentials }` templating unchanged) and wired it into `eas.json`'s `development` profile (`"bun": "1.3.14"`, `"ios": {"config": "ios-development.yml"}`), matching the pattern already proven for production. **This fix is inferred by direct analogy to the repo's own proven pattern, not independently verified** — no EAS build was run in this phase (none was attempted, per instructions) — the user's first `eas build --profile development --platform ios` is the real test.

**No secrets required to be committed for a basic dev-client build.** `.env.development`/`.env.production` contain only a debug-flag env var. `SENTRY_AUTH_TOKEN` and `GOOGLE_SERVICES_JSON` are both already optional/self-disabling in `app.config.ts` when absent. Apple signing (`appleTeamId: "MWD5K362T8"` in `app.json` — Streamyfin's own team ID) will need to become the user's own Apple Team ID once they configure credentials; not changed in this phase, since that's signing/branding territory reserved for later.

### Validation performed this phase
- `eas.json` — validated as well-formed JSON (`python3 -m json.tool`).
- `.eas/build/ios-development.yml` — validated as well-formed YAML; step list diffed against `ios-production.yml` and confirmed structurally identical (only a step label differs, "iOS" vs "iOS/tvOS").
- `bun run check` (biome) — re-run after all edits: ✅ pass, 728 files, no issues.
- No TypeScript/application code changed, so `typecheck` was not re-run (no TS/JS files touched this phase).
- Did not attempt `eas build`, `expo prebuild`, or any actual iOS compilation — explicitly out of scope for this phase, and this container has no `eas` CLI/Apple credentials/network path to do so anyway.

### Blockers / open items
1. **EAS project ownership** (`owner: "streamyfin"`, upstream `projectId`) must be repointed to the user's own Expo account before any `eas build` will work correctly for them. Requires the user's own `eas login` + `eas init` (or manual `projectId`/`owner` edit) — cannot be done on their behalf without their credentials.
2. Apple Developer Program enrollment + EAS-managed (or local) iOS credentials are not yet configured (expected — user said so explicitly).
3. The new `ios-development.yml` bun-forcing config is unverified against a real EAS build; treat the user's first development-profile build as the validation step, and be ready to iterate on this file if that build fails at the install/prebuild stage specifically.
4. Carried over from Phase 0: 5 pre-existing failing unit tests, and `react-native-track-player`'s `github:` tarball dependency couldn't be fetched in this sandboxed container (expected to work in EAS's build environment / on a normal machine).

### Changed files this phase
- Edited: `RENATA_PRD.md`, `RENATA_CLAUDE_RULES.md`, `RENATA_ROADMAP.md`, `RENATA_PLAYBACK_TEST_MATRIX.md`, `RENATA_DEVLOG.md` (docs only).
- Edited: `eas.json` (added `"bun"` and `"ios": {"config": "ios-development.yml"}` to the `development` profile only — no other profile touched).
- Added: `.eas/build/ios-development.yml`.
- Not touched: `app.json`, `app.config.ts`, any native/source/player code, bundle identifiers, icons, credentials.

### Next recommended step
1. User: `eas login` with their own Expo account, then either `eas init` (creates a new EAS project under their account and updates `app.json`'s `extra.eas.projectId`/`owner`) or hand that output to Claude Code to apply. This must happen before step 2.
2. User or Claude Code (once above is done): `eas build --profile development --platform ios` — first real validation of the MPVKit/prebuild/pod-install pipeline through EAS, and of the new `ios-development.yml`.
3. Install the resulting `.ipa`/dev-client build on the physical iPhone via the link EAS provides (internal distribution — no App Store/TestFlight needed for this profile), pair it with `expo start` for JS iteration, connect to a real Jellyfin server, and walk `RENATA_PLAYBACK_TEST_MATRIX.md`.
4. Do not begin Phase 1 (rebrand) until that first EAS build installs and runs on-device.
