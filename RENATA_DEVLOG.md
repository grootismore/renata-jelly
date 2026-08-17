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

### Next recommended step
On a Mac with Xcode installed: `bun i && bun run submodule-reload && bun run prebuild && bun run ios` to get the untouched baseline running on a physical iPhone/simulator, then walk `RENATA_PLAYBACK_TEST_MATRIX.md` against a real Jellyfin server. Do not begin Phase 1 (rebrand) until that baseline is confirmed working end-to-end.
