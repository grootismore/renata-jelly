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
4. Do not begin Phase 1 (rebrand) until that first EAS build installs and runs on-device. — **superseded: user approved proceeding directly to Phase 1 without waiting for a first EAS build; see below.**

---

## Phase 1 — Renata Identity & EAS Ownership Prep (2026-08-17)

### Purpose
Change the project's application identity from Streamyfin to Renata (display name, slug, scheme, bundle/package identifiers, user-facing brand strings) and strip upstream Streamyfin's private Expo/Apple account configuration from active config, without touching Jellyfin auth/API, PlaybackInfo negotiation, MPV/MPVKit, playback progress reporting, or any UI layout/design. No EAS build was attempted (none is possible from this container, and Apple credentials aren't configured yet regardless).

### Method
Every occurrence of `streamyfin`/`Streamyfin`/`fredrikburmester`/`MWD5K362T8`/`e79219d1-...` in the repo was found and individually classified before any edit:
- **A — user-facing branding, changed now**: display text a Renata user actually sees.
- **B — application identity, changed now**: config-level identifiers (bundle ID, slug, scheme, client-identification strings sent to servers).
- **C — internal source symbol, left unchanged**: comments, npm package name, MMKV storage keys, on-device cache directory names, pairing-protocol message-type strings, dev-tooling/CI scripts. No functional reason to touch these; renaming several of them (e.g. the 3-file QR-pairing protocol constant) would have introduced real breakage risk for zero user-visible benefit.
- **D — upstream attribution/reference, must remain**: links to real, distinct projects (the actual `streamyfin/jellyfin-plugin-streamyfin` server plugin, `fredrikburmester/streamystats`, `fredrikburmester/marlin-search`), and the real external Jellyfin admin plugin's REST routes/type/GUID.
- **E — infrastructure identifier requiring the user's own authenticated account, not invented**: EAS project/owner, Apple Team ID, Sentry org, Firebase/`google-services.json`.

### A — Changed to Renata now
- `app.json`: `name` → "Renata", `slug` → "renata", `scheme` → "renata", `ios.bundleIdentifier` → `com.grootismore.renata`, `android.package` → `com.grootismore.renata`, `NSLocationWhenInUseUsageDescription` text.
- `app.config.ts`: camera-permission description text.
- `translations/en.json`: 6 string values (`welcome_to_streamyfin`, `features_description`, `crash_reports_title`, `crash_reports_description`, `crash_reports_hint`, `scan_with_phone`) — **key names left unchanged** (they're i18n identifiers, not display text); only the English display values changed. Other locale files (`translations/*.json` besides `en.json`) are Crowdin-generated per upstream `CLAUDE.md` and were intentionally left untouched — they'll pick up "Renata" on the next Crowdin sync.
- `components/login/Login.tsx`, `components/login/TVServerSelectionScreen.tsx`: the literal on-screen "Streamyfin" wordmark → "Renata".
- `providers/JellyfinProvider.tsx`: `clientInfo.name` (×2) and the `MediaBrowser Client="..."` auth header value → "Renata" — this is the client name every Jellyfin server this app talks to will show in its admin Sessions/Devices view. Judged as branding, not "authentication behavior" (the auth flow/logic is untouched, only a self-identifying label).
- `hooks/useWikidataAwards.ts`: Wikidata API User-Agent → `Renata (https://github.com/grootismore/renata-jelly)`.
- `utils/opensubtitles/api.ts`: default OpenSubtitles User-Agent → `Renata v1.0`.
- `utils/tvDiscovery/payload.ts`: Apple TV Top Shelf deep-link routes `streamyfin://topshelf/...` → `renata://topshelf/...`, kept consistent with the new `scheme`.
- `providers/WebSocketProvider.tsx`: removed (not replaced) `AppStoreUrl`/`IconUrl` from the Jellyfin session-capabilities payload — they pointed at Streamyfin's real App Store listing and client badge image, which are simply wrong for Renata. Both fields are optional in the Jellyfin SDK's `ClientCapabilitiesDto`; nothing else in that call changed.
- `app/_layout.tsx`: the hardcoded push-notification `projectId: "e79219d1-..."` literal was replaced with `Constants.expoConfig?.extra?.eas?.projectId`, guarded against being unset (logs and skips registration instead of calling the API with an undefined/wrong project). This makes push token registration automatically correct once the user links their own EAS project — no second manual edit needed later.
- `biome.json`, `scripts/typecheck.ts`: cosmetic dev-tooling strings (`!Streamyfin.app` lint-ignore path, the typecheck banner text).

### B — Application identity / EAS ownership fields removed from `app.json`
Verified via `expo config --json` (the actual merged config EAS reads) after the edit:
| Field | Before | After |
|---|---|---|
| `name` | Streamyfin | Renata |
| `slug` | streamyfin | renata |
| `scheme` | streamyfin | renata |
| `ios.bundleIdentifier` | com.fredrikburmester.streamyfin | com.grootismore.renata |
| `android.package` | com.fredrikburmester.streamyfin | com.grootismore.renata |
| `ios.appleTeamId` | MWD5K362T8 (Streamyfin's real Apple Team ID) | *(removed — resolved by the user's own EAS credentials, none configured yet)* |
| `owner` | streamyfin | *(removed — not set to `grootismore` because that's a GitHub identity, not a verified Expo account username; setting it would have been a guess)* |
| `extra.eas.projectId` | e79219d1-797f-4fbe-9fa1-cfd360690a68 (Streamyfin's real EAS project) | *(removed — no UUID invented; `eas init` will populate this)* |
| `updates.url` | https://u.expo.dev/e79219d1-... | *(removed with the rest of the `updates` block — `expo-updates` isn't even an installed dependency, so this was inert either way)* |

Confirmed no residual Streamyfin identifiers in the resolved config: `expo config --json` shows `owner: null`, `extra.eas` has no `projectId` key, `updates: null`. Also confirmed (same command) that `plugins/withDownloadLiveActivity.ts`'s app-extension bundle ID/app-group derivation — which reads `config.ios.bundleIdentifier` programmatically rather than hardcoding it — automatically picked up the new identifier with no plugin edit needed: it now resolves to `com.grootismore.renata.downloadactivity` / `group.com.grootismore.renata.downloads`. Same mechanism applies to `withTVOSTopShelf.ts`.

### C — Intentionally left unchanged (internal symbols, no functional reason to touch)
- `package.json` `"name": "streamyfin"` — npm package identifier, not user-facing, doesn't drive the native app name (app.json does).
- Code comments referencing "Streamyfin" informally across ~10 files (`utils/jellyfin/checkServer.ts`, `userConfiguration.ts`, `utils/atoms/shuffleQueue.ts`, `settingsOverrides.ts`, `hooks/useMediaPreferences.ts`, `scripts/check-i18n-keys.ts`, TV settings components' JSDoc, etc.).
- QR-pairing protocol constants: `"streamyfin-pair"` (`components/login/TVQRCodeDisplay.tsx`, `components/companion/CompanionLoginScreen.tsx`) and `"streamyfin-pair-response"` (`utils/pairingService.ts`). Purely internal message-type strings between two instances of this app, never seen by a server or user. Renaming is possible later but must touch all matched files atomically — deferred to avoid breaking TV↔phone pairing for zero visible benefit.
- On-device cache directory names: `streamyfin-audio-cache`, `streamyfin-audio` (`providers/AudioStorage/index.ts`), `streamyfin-subtitles` (`hooks/useRemoteSubtitles.ts`, `app/(auth)/(tabs)/(home)/settings.tv.tsx`, `utils/atoms/downloadedSubtitles.ts`). Not user-visible; renaming has no functional benefit and isn't a migration concern since the new bundle identifier already gives Renata a fresh app-sandbox on-device.
- MMKV settings keys `STREAMYFIN_PLUGIN_SETTINGS`, `STREAMYFIN_PLUGIN_APPLIED_DEFAULTS` — see D below, these are tied to the real external plugin, not renamed for that reason as much as this one.
- Dev/CI-only scripts (`scripts/detect-duplicate-issue.ts`'s `streamyfin/streamyfin` GitHub-repo fallback, `.github/renovate.json` description, `.vscode/extensions.json` comments) — not shipped in the app, out of scope for application identity.
- `assets/images/icon-ios-liquid-glass.icon/icon.json` SVG layer filenames (`streamyfin_logo_layer1.svg` etc.) and every icon/splash image asset — this **is** the actual Streamyfin logo artwork. Per instruction, no icon/splash work this phase; the app currently still builds and runs with Streamyfin's visual identity. Needs real Renata icon/splash assets before this is cosmetically finished — flagged for a dedicated design phase, not invented here.
- `targets/StreamyfinDownloadActivity/`, `targets/StreamyfinTopShelf/` — Xcode extension target folder names, `EXTENSION_TARGET_NAME`/`TARGET_SOURCE_DIR` constants in `plugins/withTVOSTopShelf.ts` / `withDownloadLiveActivity.ts`, and their Info.plist `CFBundleDisplayName` ("Streamyfin Top Shelf", "Streamyfin Downloads") — left as one unrenamed unit (renaming the display string alone without the folder/target name would be an inconsistent partial rename, and folder/target renames are technical-namespace migration, explicitly out of scope). These are TV Top Shelf and download Live Activity extensions — low visibility, non-core to the MVP iPhone/iPad flow.

### D — Upstream attribution / real external references — untouched, correctly so
- `components/IntroSheet.tsx`: link to `github.com/streamyfin/jellyfin-plugin-streamyfin` — the real, distinct **server-side** Jellyfin plugin this app can integrate with. Not part of Renata's own identity.
- `app/(auth)/(tabs)/(home)/settings/plugins/*/page.tsx`: links to `fredrikburmester/streamystats` and `fredrikburmester/marlin-search` — real third-party projects this app has settings pages for.
- `providers/JellyfinProvider.tsx`, `augmentations/api.ts`, `utils/atoms/settings.ts`: the `/Streamyfin/config` and `/Streamyfin/device` **REST API paths**, the `StreamyfinPluginConfig` type, `getStreamyfinPluginConfig`/`refreshStreamyfinPluginSettings` function names, and the literal plugin GUID `1e9e5d386e6746158719e98a5c34f004` in `utils/atoms/settings.ts`. These all identify the **real external "Streamyfin" Jellyfin server plugin** that admins can install — a fixed name belonging to that separate piece of software, not to this app. Renaming any of this would silently break the centralized-settings/push-device-registration feature against every real Jellyfin server running that plugin. Explicitly protected under instruction #5 ("Jellyfin API behavior").
- `README.md`, `LICENSE.txt`, `CLAUDE.md`, `SECURITY.md` — untouched, per PRD §15 and explicit instruction.

### E — Infrastructure identifiers requiring the user's own authenticated account — found, not invented
- **EAS project/owner** — handled above (removed, not guessed).
- **Apple Team ID** — handled above (removed, not guessed).
- **Sentry** (`app.json`'s plugin `organization: "streamyfin"`, and, newly found this phase, `utils/sentry.ts`'s hardcoded fallback DSN `https://...@o4509610343596032.ingest.de.sentry.io/...` for org "streamyfin", project "react-native"). **Left unchanged, flagged as an open item**: the DSN is only a fallback — the code already supports `EXPO_PUBLIC_SENTRY_DSN` as an override (comment: "e.g. to point a fork at its own org"), so no code change was needed to make this fixable. But crash reporting is **on by default** (opt-out, not opt-in) per `utils/sentry.ts`'s own doc-comment, meaning right now, without further action, any Renata build would send real crash reports to Streamyfin's actual Sentry project by default. Not fixed here because it requires the user's own Sentry account/DSN, which can't be invented. See the final report for the recommended options.
- **`google-services.json` / Firebase** — left completely untouched, including `android.package` intentionally now *mismatching* it (`com.grootismore.renata` vs. the file's `com.fredrikburmester.streamyfin`). This is inert today (Android isn't being built), and required per the explicit "update iOS and Android consistently" instruction, but Android push (FCM) will not work until the user replaces this file with their own Renata Firebase project's config. Flagged, not fixed — requires the user's own Firebase console access.
- **`eas.json`'s `submit` section** (`appleTeamId: "MWD5K362T8"`, `ascAppId: "6593660679"` — Streamyfin's real App Store Connect app) — left untouched. Irrelevant until the user actually runs `eas submit`, which is far past the current "first dev build" milestone; flagged for whenever App Store submission becomes relevant.

### Validation performed this phase
- `expo config --json` (the actual EAS-facing resolved config) inspected directly — confirmed `name`/`slug`/`scheme`/`ios.bundleIdentifier`/`android.package` all read "Renata"/`com.grootismore.renata`, and `owner`/`extra.eas.projectId`/`ios.appleTeamId`/`updates` are all absent (no Streamyfin values leaking through app.config.ts's merge logic).
- `bun run typecheck` — ✅ pass.
- `bun run check` (biome) — ✅ pass, 728 files.
- `bun run i18n:check` — ✅ pass, no missing/unused keys (confirms the `en.json` value edits didn't touch key names).
- `bun run doctor` (expo-doctor) — 18/20, same 2 network-blocked checks as Phase 0/0.5 (not a regression, this container's proxy blocks those specific network calls).
- `bun test` — 204 pass / 5 fail, **identical count and identical failing tests** to the Phase 0 baseline (`utils/seriesTrackMemory.test.ts`, `utils/jellyfin/getDefaultPlaySettings.test.ts`) — confirmed not a Renata regression.
- No `eas build`, `expo prebuild`, or credential/signing action was attempted, per instruction.

### Changed files this phase
Edited: `app.json`, `app.config.ts`, `app/_layout.tsx`, `translations/en.json`, `components/login/Login.tsx`, `components/login/TVServerSelectionScreen.tsx`, `providers/JellyfinProvider.tsx`, `providers/WebSocketProvider.tsx`, `hooks/useWikidataAwards.ts`, `utils/opensubtitles/api.ts`, `utils/tvDiscovery/payload.ts`, `biome.json`, `scripts/typecheck.ts`, plus this file.
Not touched: `eas.json` (Phase 0.5 already added the bun-forcing `development` profile config — nothing further needed this phase), any player/native/Jellyfin-behavior code, icons/splash assets, or other translation locale files.

### Blockers / open items
1. **EAS project linking** — the user must run `eas login` + `eas init` (or equivalent) under their own account; see final report section D.
2. **Apple Developer Program enrollment** — not yet done (expected, user said so). See final report sections E/F.
3. **Sentry DSN** — crash reporting currently defaults to Streamyfin's real Sentry org. User should either set `EXPO_PUBLIC_SENTRY_DSN` to their own once they have a Sentry account, or explicitly turn off crash reporting in Settings until then.
4. **`google-services.json`** — must be replaced with the user's own Firebase project's file before ever building/shipping Android (not relevant to the iOS dev-build path).
5. **Icons/splash** — still Streamyfin's actual artwork; deferred to a dedicated design phase per the PRD.
6. Carried over from Phase 0: 5 pre-existing failing unit tests (unrelated, unaffected by this phase).

### Next recommended step (superseded — see Phase 1.5 below)
~~1. User: `eas login`, then `eas init`...~~ — the user already has an existing Renata EAS project; Phase 1.5 links to it directly instead of creating a new one.

---

## Phase 1.5 — EAS Linking, Sentry Privacy Cleanup, Build Readiness (2026-08-17)

### Purpose
The user created an EAS project for Renata themselves (`7b985b94-1f28-4fa9-aec1-07876db9d277`) and connected an Expo MCP integration to this session. This phase: (1) verifies and links this repo to that existing project rather than creating a new one, (2) closes a real privacy gap found in Phase 1 — Streamyfin's real Sentry DSN was still the active runtime fallback, and (3) re-audits the EAS dev-build pipeline for physical-iPhone readiness, including a genuine gap found this phase (git submodule initialization on EAS's build workers). No build was triggered, no credentials touched, no player/UI code changed.

### 1. EAS project verification
No tool in the connected Expo MCP server returns project metadata (name/owner/slug) directly — the available surface is builds, workflows, app/play store reviews, submissions, and docs search. Verification method used: `mcp__Expo__build_list` and `mcp__Expo__workflow_list` called with `appId: 7b985b94-1f28-4fa9-aec1-07876db9d277` — both returned empty arrays (`[]`), not an authorization/not-found error. An invalid or inaccessible project ID would error here, so this confirms the project **exists and is accessible to the Expo account this MCP session is authenticated as**; the empty results just mean no builds or workflows have run against it yet, consistent with a freshly created project. This is not a full identity confirmation (I can't independently confirm its display name is literally "Renata" or read back its owner slug) — see the final report for the exact command that closes that last gap.

### 2. Repository linked to the existing project
`app.json`'s `extra.eas.projectId` set to `7b985b94-1f28-4fa9-aec1-07876db9d277`. `owner` was deliberately **left unset** rather than guessed — it's optional in Expo's config schema (EAS resolves the project from `projectId` alone in the normal case), and I have no verified value for it. No source code was touched by this change.

### 3. Sentry privacy cleanup
Inspected `utils/sentry.ts` before changing anything. Found: `SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "<Streamyfin's real DSN>"` — an unconfigured build silently sent real crash reports to Streamyfin's own Sentry project (org "streamyfin", project "react-native"), since crash reporting defaults to **on** (`hasSentryConsent()`'s own doc-comment: "Reporting is on by default"). The fix is exactly one line: `const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;` (no fallback). This is the smallest possible change because `initializeSentry()` already had `if (initialized || !SENTRY_DSN) return;` as its first line — the whole rest of the module (consent handling, scrubbing, `Sentry.wrap`, `Sentry.captureException`) was already written to degrade to a safe no-op when the SDK never initializes; `app/_layout.tsx` even has a pre-existing comment confirming this ("Sentry.wrap is inert while the SDK is not initialized"). No new guard logic was needed — just removing the fallback value that defeated the existing one. `bun run typecheck` and `bun test utils/sentry.test.ts` (16/16 pass) confirm nothing broke; `SENTRY_DSN`'s type narrows from `string` to `string | undefined`, and TypeScript's control-flow analysis already handles that at the one call site.

Renata now sends **nothing** to Sentry until `EXPO_PUBLIC_SENTRY_DSN` is explicitly set (e.g. as an EAS environment variable, once the user has their own Sentry project). Not changed, and separately flagged (already inert, requires the user's own account): `app.json`'s Sentry Expo plugin config (`organization: "streamyfin", project: "react-native"`) only controls build-time source-map upload, which is already gated behind a `SENTRY_AUTH_TOKEN` secret the user doesn't have — this can't send anything anywhere without that token.

**Other telemetry search**: no analytics/crash SDKs beyond `@sentry/react-native` in `package.json` (checked for PostHog, Amplitude, Mixpanel, Segment, Bugsnag, Crashlytics, Datadog, LogRocket — none present). Scanned all hardcoded `https://` URLs in source for other Streamyfin/Fredrik-owned hosts: found only legitimate third-party services unrelated to Streamyfin (`freeipapi.com` — a free IP-geolocation lookup used by the admin Sessions screen; `image.tmdb.org`, `www.youtube.com` — Jellyseerr metadata) and one doc-comment example hostname (`media.uruk.dev`, not a real call target). No other active Streamyfin-owned telemetry endpoint found.

### 4. EAS development-profile reinspection
Reread `eas.json`, `.eas/build/ios-development.yml`, `app.json`, `app.config.ts` fresh. Confirmed against the user's checklist:
| Item | Status |
|---|---|
| Development client enabled | ✅ `eas.json` `development.developmentClient: true` |
| Distribution mode | ✅ `internal` — installs via direct link, no App Store/TestFlight needed |
| Bun used correctly | ✅ `bun: "1.3.14"` pinned, `bun install --frozen-lockfile` + `bun x expo prebuild` in `ios-development.yml` |
| Submodules initialized | ⚠️ **Gap found and fixed** — see below |
| Expo prebuild occurs | ✅ `bun x expo prebuild --platform ios --no-install` |
| CocoaPods/native modules installed | ✅ explicit `pod install` step |
| MPVKit included | ✅ `plugins/withGitPod.ts` + `podspecUrl` for MPVKit still present in `app.json`, untouched |
| Xcode 26/SwiftUI Podfile workaround | ✅ `plugins/with-runtime-framework-headers.ts` still present in `app.json`, untouched |
| No local Mac/Xcode dependency | ✅ prebuild + pod install + Xcode build all run on EAS's macOS build workers, not the user's machine |

**Gap found**: none of the `.eas/build/*.yml` files (including the pre-existing, presumably-working `ios-production.yml`) initialize the `utils/jellyseerr` git submodule. Per Expo's own docs (`docs.expo.dev/build-reference/git-submodules`): `eas/checkout` only uploads submodule content as-is when a build is triggered from a local working directory that already has the submodule checked out; a build triggered by EAS's GitHub integration (a fresh clone on EAS's side, not the user's machine) will **not** have it. An empty `utils/jellyseerr/` breaks the Metro bundle, since `hooks/useJellyseerr.ts` and `utils/_jellyseerr/useJellyseerrCanRequest.ts` import from it directly (this is exactly the failure Phase 0 hit locally before the submodule was manually initialized). Fixed by adding a `git submodule update --init --recursive` step to `.eas/build/ios-development.yml`, right after `eas/checkout` — pinned (no `--remote`) for build reproducibility, unlike the local-dev-only `bun run submodule-reload` script, which deliberately tracks the submodule's latest branch commit. Safe/idempotent if the submodule is already present. **Not applied to `ios-production.yml` or the Android configs** — out of scope for "reinspect the development profile," but very likely has the identical gap; flagged as a fast-follow once the development build is confirmed working, not fixed silently now.

### 5. Apple credentials
No credential-status tool exists in the connected Expo MCP server (confirmed via search of the available toolset — builds, workflows, store reviews/submissions, docs only). `mcp__Expo__build_list` returning zero builds for this project is suggestive (credentials are typically created lazily on first build or explicitly via `eas credentials`) but not conclusive. Nothing was created, modified, or fabricated. See the final report for exactly what EAS will ask for at first-build time and the command to check current status yourself.

### Validation performed this phase
- `expo config --json` re-verified: `extra.eas.projectId` = `7b985b94-1f28-4fa9-aec1-07876db9d277` (exact match), `owner: null`, `ios.appleTeamId: null`, `updates: null`.
- Full-repo grep for the old EAS project UUID (`e79219d1-...`) and the old Apple Team ID (`MWD5K362T8`) — zero matches outside `eas.json`'s `submit` section (App Store Connect submission config, not read by `eas build`, already flagged in Phase 1, deliberately not touched — no correct replacement exists yet and it doesn't affect the build we're preparing).
- Resolved config re-scanned for any remaining "streamyfin" string — 4 matches, all previously classified and legitimate: the Sentry plugin org (×2, inert, see above), the real MPVKit podspec URL (must not change — explicit instruction), and the still-unrenamed `StreamyfinDownloadActivity` extension target name (Phase 1's category C, deliberately deferred).
- `bun run typecheck` ✅, `bun run check` (biome) ✅ 728 files, `bun run i18n:check` ✅, `bun run doctor` 18/20 (same 2 network-blocked checks as every prior phase, not a regression).
- `bun test` — 204 pass / 5 fail, identical to every prior phase's baseline; `utils/sentry.test.ts` specifically 16/16 pass.
- `.eas/build/ios-development.yml` re-validated as well-formed YAML (11 steps, submodule-init step correctly inserted between checkout and install).
- No `eas build`, `eas init`, `eas credentials`, or any authenticated EAS/Apple command was run — this container has no `eas` CLI installed and no login session; all authenticated verification came through the connected Expo MCP tools only.

### Changed files this phase
Edited: `app.json` (added `extra.eas.projectId`), `utils/sentry.ts` (dropped the hardcoded DSN fallback), `.eas/build/ios-development.yml` (added submodule-init step), `RENATA_DEVLOG.md`.
Not touched: `eas.json`, `app.config.ts`, `ios-production.yml`/other `.eas/build/*.yml`, any player/native/Jellyfin-behavior code, credentials, UI.

### Blockers / open items
1. Full project-identity confirmation (display name/owner slug) needs an authenticated `eas init --id 7b985b94-1f28-4fa9-aec1-07876db9d277` or `eas whoami` run by the user — the MCP toolset can't read this back.
2. Apple Developer Program enrollment — still not done (expected). First build will prompt for it.
3. `ios-production.yml`'s (and the Android configs') missing submodule-init step — same fix as item 4 above, deferred until the development build is proven.
4. Carried over: Sentry DSN now empty by default (item 3 above is resolved, not open — listed here only as a reminder that crash reporting is now silently off until the user opts back in with their own DSN).
5. Carried over from Phase 0: 5 pre-existing failing unit tests (unrelated, unaffected).

### Next recommended step (superseded — see Phase 1.6 below)
~~1. User: run `eas init --id ...`~~ — still accurate and still the next step for the EAS/physical-device path; Phase 1.6 runs in parallel to prove the native project itself compiles, independent of EAS/Apple credentials, since the user's friend's Mac / Apple Developer enrollment aren't available yet.

---

## Phase 1.6 — GitHub Actions iOS Build Validation (2026-08-18)

### Purpose
The user has no paid Apple Developer account yet (a friend's Mac + free Personal Team signing is available later). Before waiting on that, prove — independent of Apple credentials entirely — that Renata's generated iOS native project (Expo prebuild + CocoaPods + MPVKit + the native Swift controls layer) actually compiles on a real, clean macOS/Xcode toolchain. This is unsigned compilation validation only; no installable IPA, no signing, no Apple secrets.

### Infrastructure inspected first
`build-apps.yml` already contains a proven, working `build-ios-phone-unsigned` job (part of upstream Streamyfin's own CI) that does exactly this: `macos-26` + Xcode 26.6 (pinned via `maxim-lobanov/setup-xcode`), Bun 1.3.14, `actions/checkout` with `submodules: recursive`, `bun install --frozen-lockfile && bun run submodule-reload`, `bun run prebuild`, then `bun run ios:unsigned-build` (→ `scripts/ios/build-ios.ts --production`, which defaults to `skipCredentials: true`). Reused this exact path rather than inventing a parallel one, per instruction. Also read `scripts/ios/build-ios.ts` in full to determine the *actual* xcodebuild invocation it constructs (device/generic archive, not simulator — the production non-simulator path runs `xcodebuild ... archive` with no `-destination`, which targets Any-iOS-Device and compiles the real arm64 device slice, then hand-packages an unsigned `.ipa` from the archive since `-exportArchive` requires signing).

### Workflow created
New file: `.github/workflows/renata-ios-build-validation.yml`, name **"Renata iOS Build Validation"**. Single job, same runner/Xcode/Bun pins as the proven upstream job. Adds on top of the proven path (not instead of it):
- An explicit post-checkout check that `utils/jellyseerr` actually has files (Phase 0's empty-submodule failure mode), before spending any more of the macOS job's time.
- A post-prebuild diagnostic step verifying `ios/` exists, a `.xcworkspace` was generated, `ios/Pods` exists, and `MPVKit` is both in the Podfile and resolved into `ios/Pods` — separates "prebuild/CocoaPods/MPVKit failed" from "Xcode compile failed" for anyone reading a future failed run.
- Full build output both streamed live and tee'd to a log file; the log and the `.xcarchive` (not DerivedData) are uploaded as artifacts only `if: failure()`.
- Triggers: `workflow_dispatch` always; `push` scoped to `claude/renata-baseline-phase-0-e2kfu8` only, with `paths-ignore: ['**.md']` so documentation-only commits don't spend macOS runner minutes.
- No `EXPO_TOKEN`/EAS/Apple secrets referenced anywhere in the file.

### Run 1 — result: ✅ success on the first attempt, no fixes needed
Triggered automatically by the push that added the workflow. Run [32094132221](https://github.com/grootismore/renata-jelly/actions/runs/32094132221), job `🍎 Compile Renata (iOS, unsigned)` (id `95582040747`), runner `macos-26-arm64` (macOS 26.5.2), Xcode 26.6.

| Step | Duration | Result |
|---|---|---|
| Checkout (recursive submodules) | 10s | ✅ |
| Verify submodules populated | <1s | ✅ (`utils/jellyseerr` non-empty) |
| Setup Bun 1.3.14 / Setup Xcode 26.6 | 1s each | ✅ |
| `bun install --frozen-lockfile && bun run submodule-reload` | 13s | ✅ |
| `bun run prebuild` (Expo prebuild + CocoaPods + MPVKit) | 2m7s | ✅ |
| Verify prebuild output | <1s | ✅ — `ios/Renata.xcworkspace` found, `ios/Pods` present, MPVKit in Podfile and resolved at `ios/Pods/MPVKit` |
| `bun run ios:unsigned-build` (xcodebuild archive) | 18m44s | ✅ |
| Total job wall time | **22m3s** | ✅ |

Exact xcodebuild invocation, pulled from the raw job log: `xcodebuild -workspace ios/Renata.xcworkspace -scheme Renata -configuration Release -archivePath build/Renata.xcarchive archive CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO`. Log also confirms `Bundle ID: com.grootismore.renata` (Phase 1/1.5's identity work correctly flowed through prebuild into the generated Xcode project) and `Installing MPVKit (0.41.0-av2)` / `Installing MpvPlayer (1.0.0)` during the CocoaPods resolution phase. Result: `Archive created` → `Unsigned IPA created!` (`build/Renata.ipa`, not uploaded — this workflow doesn't publish artifacts on success by design, only on failure).

No `##[error]` annotations anywhere in the log; the handful of literal "error:"/"warning:" string matches found while grepping the log are the diagnostic step's own shell script *source* being echoed by Actions, not triggered conditions.

**On MPVKit/native Swift proof, precisely**: the build script runs `xcodebuild` in non-verbose mode by default (pipes stdout, only replays it on failure), so this run's log has no per-file `Compiling PlayerEngine.swift`-style trace. The proof is indirect but strong and unambiguous: MPVKit + MpvPlayer are pod dependencies linked directly into the app target (not a separable framework), `xcodebuild archive` exited 0, and an archive/IPA were successfully produced — none of that is possible if those native modules failed to compile or link (the script's own failure path specifically watches for and would have surfaced "Undefined symbols for architecture arm64", which never appeared). A `--verbose` re-run would show the granular trace if ever needed, but wasn't necessary here since the job already succeeded end-to-end.

### Validation performed this phase
- YAML re-validated as well-formed (Python `yaml.safe_load` plus a custom loader confirming the `on:`/`push`/`paths-ignore` block parsed as intended).
- `bun run check` (biome) re-run after adding the workflow file: ✅, 728 files, no issues (workflow YAML isn't in biome's lint scope, included only as a sanity check that nothing else broke).
- The real validation was the GitHub Actions run itself, monitored end-to-end via the GitHub MCP tools (`actions_get`/`actions_list`/`get_job_logs`) — not inferred from YAML correctness alone.

### Changed files this phase
Added: `.github/workflows/renata-ios-build-validation.yml`. Edited: `RENATA_DEVLOG.md`. Nothing else — no application, player, native, or UI code touched; no fix was needed since the first run succeeded.

### Remaining limitations (what this run does NOT prove)
- **Unsigned only.** No code signing, provisioning, or device install was attempted or is possible without an Apple Developer account — this proves compilation, not installability.
- **Compiles ≠ correct playback.** MPVKit/native Swift linking into an archive says nothing about runtime behavior (Direct Play negotiation, MPV/Native controls switching, subtitle rendering, etc.) — none of that can be exercised without running the app on a device or simulator.
- **CI runner ≠ the user's friend's Mac.** Same Xcode 26.6, but real local machines can differ (disk space, other locally-installed Xcode versions, CocoaPods cache state, Command Line Tools selection). A green Actions run is strong evidence, not a guarantee, that `bun run ios` will work unchanged there.
- **`--production` build config, not the `development` dev-client profile** used for the eventual EAS/physical-device path — validates the same native compile inputs (same prebuild, same Podfile, same MPVKit), but is a different `xcodebuild` action (`archive` vs. a dev-client `build`) and doesn't exercise `expo-dev-client`/Metro-connected behavior.
- Android, tvOS, and the `ios-production.yml`/other `.eas/build/*.yml` configs' identical missing-submodule-init gap (flagged in Phase 1.5) were out of scope and untouched.

### Next recommended step (superseded — see Phase 2 below)
~~1-4~~ — the user confirmed Renata installed/built through the established workflow, launched, connected to Jellyfin, and operated successfully in baseline testing. The working baseline is GOOD; Phase 2 begins product cleanup around it.

---

## Phase 2 — Renata Product Foundation (2026-08-19)

### Purpose
Turn the functioning fork into the actual Renata product without touching playback/Jellyfin architecture: establish a protected known-good baseline to roll back to, inventory the inherited product surface (KEEP/HIDE/LATER/REMOVE), confirm branding cleanup is complete, document icon/splash asset locations, introduce a minimal design-token/component foundation, and produce an architectural map of Home for the future Phase 3/4 redesign. This is explicitly NOT the Home redesign itself.

### 1. Renata Working Baseline
**Commit `a4c43c14d614d01b27835a0eda2eb6055fd98450`** ("ci(renata): upload the unsigned IPA as a build artifact on success") is the Renata Working Baseline — the exact commit to return to if later UI work causes regressions. Chosen because it's the most recent commit with a **confirmed-green GitHub Actions run** (`32127304763`) that both compiled the full iOS native project (MPVKit, prebuild, CocoaPods) unsigned *and* successfully uploaded the resulting `Renata-iOS-unsigned` IPA artifact — the strongest validation signal available in this environment, on top of the user's own confirmation that a real device build installed, launched, and connected to Jellyfin successfully. No git history was rewritten; this is a marker, not a tag/branch operation.

### 2. Product surface inventory (KEEP / HIDE FOR NOW / LATER / REMOVE)
Full screen/feature inventory gathered by exploring `app/`, `components/`, and the settings tree before classifying anything (see method note below). Classification weighed against `RENATA_PRD.md` §9's explicit MVP screen list (server/login, home, libraries, library listing, movie/series/season/episode details, search, settings, player) and §13's non-goals ("do not remove working features simply because they are not yet exposed").

**KEEP — core Renata functionality:**
- Login/server management, Quick Connect (`login.tsx`, `components/settings/QuickConnect.tsx`)
- Home (`(home)/index.tsx`) — Continue Watching, Next Up, per-library Recently Added rows
- Libraries tab, library listing, collections (`(libraries)`, `collections/[collectionId]`)
- Search (`(search)`)
- Favorites (`(favorites)`)
- Movie/series/season/episode details, cast/person pages (`items/page`, `series/[id]`, `persons/[personId]`)
- Playback (`player/direct-player`) — protected, untouched this phase
- Downloads screen + management (`(home)/downloads`, `components/downloads/*`) — PRD §11 explicitly preserves this
- Core settings: playback-controls, audio-subtitles, appearance, hide-libraries, network (basic remote URL), logs (valuable for the user's own testing right now)
- Subtitle/audio track selection UI
- Chromecast (`components/Chromecast.tsx`, woven into player controls, not a separate screen) — a mainstream iOS-user expectation, already working, low cost to leave visible
- Intro/onboarding sheet — functionally useful mechanism; its *copy* already says "Renata" (Phase 1) but will want a fuller content pass later, not a KEEP/HIDE decision

**HIDE FOR NOW — real, working infrastructure not in initial Renata scope (entry points hidden, nothing deleted):**
- Watchlists tab (Streamystats-backed) — already self-hides unless `streamyStatsServerUrl` is set
- Custom Links tab — already self-hides unless `showCustomMenuLinks` is set
- Jellyseerr integration (request modals, discover rows, auto-login, `jellyseerr/*` routes) — legitimate, config-gated, but not in the PRD MVP list and "deeply woven in" per the audit, so hide exposure rather than extract
- Streamystats Home rows/recommendations — already config-gated
- Marlin Search plugin settings, KefinTweaks plugin settings — niche opt-in integrations
- Live TV (Programs/Guide/Channels/Recordings) — substantial working feature, absent from PRD's core user journey
- Companion/QR phone-as-TV-remote pairing — moot without a Renata TV product; already conditionally hidden on iOS (`Platform.OS !== "ios"` gates the entry point)
- Active Sessions viewer (admin-style) — power-user feature, not in the MVP journey
- Wifi-SSID local-network server switching — advanced/edge-case settings surface
- Custom HTTP headers settings — advanced/niche (reverse-proxy auth)

**LATER — potential Renata feature, not MVP:**
- Music library/player (dedicated browsing + global `MiniPlayerBar`) — PRD's pitch is specifically video (MKV/HEVC); substantial enough to be a deliberate future feature announcement rather than a quiet toggle
- "Now Playing" full-screen overlay (`app/(auth)/now-playing.tsx`) — supplementary to the player itself, natural to fold into Phase 7 player-UX work or design fresh then

**REMOVE — none identified this phase.** Nothing found meets "genuinely inappropriate and safely removable" — everything inherited is either core, or working infrastructure better served by hiding than deleting, consistent with the explicit instruction to prefer hiding.

**Not a product decision — inapplicable on this platform:** all `.tv.tsx`/`Platform.isTV`-gated code (TV nav bar, TV modals, tvOS Top Shelf, Android TV recommendations channel, etc.). Renata's MVP is iPhone/iPad only, so these paths simply never render on an iOS phone/tablet build — no hiding action needed, and most of this is inline conditionals within otherwise-shared files rather than cleanly deletable, so it wasn't touched.

**Method note:** this inventory was gathered via read-only exploration (screen-by-screen, file-by-file) before any classification was made, per the explicit instruction to present the inventory before substantial removals — and, per that same instruction, **no removals were made this phase**; HIDE/LATER are recommendations for future phases to act on, not code changes executed now.

### 3. Streamyfin plugin scope
Confirmed by reading `refreshStreamyfinPluginSettings` (`utils/atoms/settings.ts:683`): the call to `getStreamyfinPluginConfig()` has an explicit rejection handler — `(_err) => undefined` — so a normal Jellyfin server *without* that plugin installed simply gets `undefined` back and the app continues normally. **The plugin is entirely optional/additive** (settings sync, push-device registration) and required for nothing in Renata's core MVP journey. Its API paths, GUID, and types are untouched, as instructed — they identify a real external plugin, not our own branding.

### 4. Branding cleanup — re-audit
Re-swept `app/(auth)/(tabs)/(home)/settings*`, every file under `settings/`, `components/settings/`, `components/IntroSheet.tsx`, and `translations/en.json` for "Streamyfin" — zero new user-facing occurrences beyond what Phase 1 already found and fixed (the `refreshStreamyfinPluginSettings`/`/Streamyfin/config` family, which correctly remains — see §3). No blind global replacement was needed or performed; Phase 1's targeted sweep was already complete.

### 5. Icons and splash
No artwork created this phase, as instructed. Current state, all still Streamyfin's real artwork, for eventual replacement:
- `assets/images/icon.png`, `icon-ios-plain.png`, `icon-android-plain.png`, `icon-android-themed.png` — referenced from `app.json`'s top-level `icon`/`android.adaptiveIcon`/splash config.
- `assets/images/icon-ios-liquid-glass.icon/` — the iOS 26 Liquid Glass icon bundle; `icon.json` inside it references `streamyfin_logo_layer1-4.svg`.
- `assets/images/icon-tvos*.png` — tvOS icon set (out of MVP scope, not urgent).
- `assets/images/notification.png` — notification icon (`expo-notifications` plugin config).
- Splash: `expo-splash-screen` plugin config in `app.json` reuses `icon-ios-plain.png`.

All of these paths are already correctly wired through `app.json`/config plugins — nothing structural needs to change for real Renata assets to drop in; it's a pure asset-swap once art exists. No code changes made here.

### 6. Design foundation
Inspected the existing system first (NativeWind/Tailwind via `tailwind.config.js`, `constants/Colors.ts`, `constants/Values.ts`) and the component layer before adding anything, to avoid duplicating what's already there and working:
- **Already adequate, reused as-is (nothing changed):** `components/posters/Poster.tsx` (poster card), `components/common/ServerImage.tsx`/`ItemImage.tsx` (image handling, header-aware `expo-image` wrapper), `components/common/GlassSurface.tsx` (translucent elevated surface, iOS 26 Liquid Glass with BlurView fallback), `components/common/HorizontalScroll.tsx` (media rows, FlashList-backed, has its own loading/empty states), `components/common/SectionHeader.tsx` (section headings), `components/Button.tsx` (buttons — solid/border variants, haptics, TV-aware), `components/common/ProgressBar.tsx`, `components/Loader.tsx` (spinner).
- **Gaps found and filled — new, additive, currently unused by any screen:**
  - `constants/theme.ts` — small token layer: `Radius` (sm/md/lg/full, named after the rounded-md/-lg/-xl/-full classes already in ad hoc use with no shared convention), `Surface` (page/elevated/border colors), `TextColor` (primary/secondary/tertiary/onAccent hierarchy, filling the gap beyond `Colors.text`), `Spacing` (names the 4px-step values already used via Tailwind, not a new scale). Explicitly does not replace `Colors.ts` or Tailwind's spacing scale — both already work and stay canonical.
  - `components/common/Surface.tsx` — solid elevated card (the non-blur counterpart to `GlassSurface`), which didn't exist as a generic.
  - `components/common/Skeleton.tsx` — generic pulsing placeholder block (reanimated-based). Several screens currently hand-roll their own static gray boxes for this (`HorizontalScroll`'s inline placeholder, `components/search/LoadingSkeleton.tsx`, `components/jellyseerr/GridSkeleton.tsx`); this is a shared primitive for new/redesigned screens to converge on. Existing implementations intentionally left untouched.
  - `components/common/EmptyState.tsx` / `components/common/ErrorState.tsx` — generic empty/error placeholders (icon + title + message, `ErrorState` adds an optional retry button reusing `components/Button.tsx`). Several screens currently hand-roll ad hoc "no items"/error text; same reasoning as `Skeleton`.
- **Deliberately not done:** no new color palette (the brand purple, `Colors.primary`, is a visual-identity decision reserved for the approved Home redesign per PRD §10 — "do not invent a huge design system before a representative Home + Details flow is approved"), no migration of existing screens onto the new primitives (that's UI work, explicitly out of scope this phase), no component library added.

### 7. Performance review
Checked `package.json` for the kind of bloat the instructions warn against: no Lottie, no Framer Motion/GSAP/Moti/Skia. Animation capability already present and sufficient: `react-native-reanimated` 4.5.3, `react-native-gesture-handler`, `react-native-reanimated-carousel`, `expo-blur`, `expo-glass-effect`. `Skeleton.tsx` above uses `react-native-reanimated` (already a dependency) rather than adding anything. No dependency changes made or needed.

### 8. Navigation
Not rewritten, as instructed. Structure (from the inventory): Expo Router with a mobile tab bar (Home, Search, Favorites, Watchlists, Libraries, Custom Links, Settings — several conditionally hidden already per §2), a shared multi-tab route group `(home,libraries,search,favorites,watchlists)` for screens reachable from several tabs (item details, collections, person pages, Jellyseerr, Live TV, music), and TV-only modal routes kept separate at the `(auth)` root. This is a mature, sensibly-grouped structure — **no genuine blockers found** for the future Renata UI. It can be preserved as-is; HIDE decisions in §2 are tab-visibility/config changes for a future phase, not navigation-architecture changes.

### 9. Home architecture map (for Phase 3/4, not acted on this phase)
- **Components**: `components/home/Home.tsx` (`HomeMobile`) renders a `ScrollView`+`RefreshControl` over a config-driven list of sections, each an `InfiniteScrollingCollectionList` (the one generic reusable row component — type-casing happens at the *card* level, not the row level), with `StreamystatsRecommendations`/`StreamystatsPromotedWatchlists` interleaved after Recently Added rows.
- **Data sources**: React Query + Jellyfin SDK throughout — `getResumeItems` (Continue Watching), `getNextUp` (Next Up, or client-merged with Continue Watching when `settings.mergeNextUpAndContinueWatching`), `getItems` per-library sorted by `DateCreated`/`DateLastContentAdded` (Recently Added), `getSuggestions` (Suggested Movies, only when Streamystats recs are off), plus a fully config-driven `settings.home.sections` path supporting arbitrary Jellyfin endpoints.
- **Cards**: `ContinueWatchingPoster` (16:9, Continue Watching/Next Up/all horizontal rows) vs. `MoviePoster`/`SeriesPoster` (10:15, vertical library rows) — `SeriesPoster` resolves an Episode's *parent series* image so episodes still show as their show. `WatchedIndicator` and `ItemCardText` are shared overlay/caption components across all card types.
- **Navigation**: all taps go through `components/common/TouchableItemRouter.tsx` → `useAppRouter` (confirmed the project convention is followed), with per-`item.Type` route resolution (Series/Person/BoxSet/CollectionFolder/music/LiveTV/default-to-item-page).
- **Images**: universally `@/components/common/ServerImage` (confirmed convention followed), `cachePolicy="memory-disk"`, blurhash placeholders on Movie/Series posters (not on `ContinueWatchingPoster`).
- **Loading**: full-screen gate on the top-level `userViews` query before anything renders; each row manages its own `useInfiniteQuery` loading/empty/pagination state independently; a priority system (`priority: 1|2`) delays Recently Added/Suggested/Streamystats rows until Continue Watching/Next Up report loaded, tracked via a `loadedSections` set.

Full detail (line numbers, exact query shapes) is in the research transcript this phase's work was based on; this summary is the durable reference. **Home was not redesigned or modified.**

### Validation performed this phase
- `bun run typecheck` ✅ pass.
- `bun run check` (biome) — found one formatting issue in the new `ErrorState.tsx`, fixed via `bun run format` (project's own formatter), then ✅ pass, 733 files.
- `bun run i18n:check` ✅ — no missing/unused keys (the new components take title/message as props rather than owning new translation keys, matching `HorizontalScroll`'s existing `noItemsText?: string` precedent).
- `bun test` — 204 pass / 5 fail, identical to every prior phase's baseline.
- `git diff --stat` against every protected path (`modules/mpv-player`, `providers/JellyfinProvider.tsx`, `providers/WebSocketProvider.tsx`, `providers/DownloadProvider.tsx`, `utils/profiles/`, `utils/jellyfin/`, `hooks/usePlaybackManager.ts`, `app/(auth)/player/`) — empty, confirming zero changes to authentication, playback, MPV native files, PlaybackInfo/device profiles, or downloads.
- Only 5 new files exist (`git status --short`), none modified, none yet imported/used by any screen — zero risk to navigation resolution or the native build.
- GitHub Actions "Renata iOS Build Validation" — [see result below].

### Changed files this phase
Added: `constants/theme.ts`, `components/common/Surface.tsx`, `components/common/Skeleton.tsx`, `components/common/EmptyState.tsx`, `components/common/ErrorState.tsx`, this `RENATA_DEVLOG.md` entry.
Not touched: everything else — no application source file was modified, only new additive files created. No player/native/Jellyfin/navigation/downloads code, no existing screens, no icons/splash assets, no dependencies.

### Next recommended phase
**Phase 3 — Renata Home redesign**, scoped narrowly per the architecture map above: replace Home's *visual* presentation (using the new `Surface`/`Skeleton`/`EmptyState`/`ErrorState`/`theme.ts` primitives where they genuinely fit, extending `theme.ts` only as real needs surface) while preserving every query, data source, and navigation callback documented in §9 exactly as-is. Do not touch `InfiniteScrollingCollectionList`'s data-fetching logic, `TouchableItemRouter`'s routing table, or any protected system. Build a representative Home shell first per the roadmap, get it approved, before extending the same treatment to Library/Search/Details.

---

## Phase 3 — Renata Home Redesign

Working Baseline confirmed at the start of this phase: `a4c43c14d614d01b27835a0eda2eb6055fd98450` (untouched — no tag/commit rewritten). Scope: **iPhone/iPad Home only**, presentation layer only, per the approved mockup used as a *design reference, not a routing/pixel spec*.

### 1. What changed, at a glance
- New cinematic **hero banner** at the top of Home, sourced from data Home already fetches (no new query).
- **Continue Watching** now renders larger, responsive landscape cards instead of the classic `w-44` row.
- **Next Up** switched from landscape to compact portrait poster cards ("Series Name / SxEy" caption).
- **Recently Added** and every other existing section: untouched visually and functionally (still `MoviePoster`/`SeriesPoster`, still classic sizing) — no Jellyfin sections were removed, and none were promoted beyond what Phase 2's inventory called out.
- Home header now shows a typographic **"RENATA"** wordmark instead of the translated "Home" title; the Cast/Sessions/Settings header-right controls and the Downloads header-left button are unchanged.
- Bottom tab bar: **not touched** — still Expo Router's existing tab set (Home/Search/Favorites/Watchlists/Libraries/Custom Links/Settings, several conditionally hidden per Phase 2 §2), no "More" tab invented.

### 2. Hero selection logic (§B)
`Home.tsx` tracks three small pieces of state — `heroContinueWatching`, `heroNextUp`, `heroRecentlyAdded` — each populated via a new optional `onItemsLoaded` callback on `InfiniteScrollingCollectionList` (additive prop, fires whenever that row's flattened item list changes; every other caller of the component omits it and is unaffected). These are wired to exactly the rows that were already priority-1/2 fetches:
- Continue Watching (or the merged "Continue & Next Up" row, when `settings.mergeNextUpAndContinueWatching` is on) → `heroContinueWatching`.
- Next Up → `heroNextUp`.
- The *first* per-library Recently Added row → `heroRecentlyAdded` (only the first; scrolling to the second library's row doesn't retarget the hero).

`heroItem = heroContinueWatching[0] ?? heroNextUp[0] ?? heroRecentlyAdded[0] ?? null` — exactly the priority order requested (resumable → Next Up → suitable recently-added → no hero), implemented as a plain `useMemo`, zero extra network calls. While Continue Watching/Next Up haven't reported yet (`!allHighPriorityLoaded`, reusing the existing priority-tracking machinery), a `Skeleton` block reserves the exact hero height (`getHeroHeight(windowWidth)`, exported from `HeroBanner.tsx`) so nothing jumps when it resolves. If a fully custom `settings.home.sections` config is active, Continue Watching/Next Up/Recently Added as named rows don't necessarily exist, so no hero candidates are ever populated and the hero area renders nothing — a deliberate "no hero if nothing appropriate" outcome rather than a fabricated one.

**`HeroBanner.tsx`** (new): backdrop via the item's own `getBackdropUrl` (existing util, unmodified) with a flat `#1c1e1f` fallback when no backdrop exists (no stretched poster); a bottom-anchored dark gradient (`expo-linear-gradient`, already a dependency) for text legibility; the item's Logo image (`getLogoImageUrlById`, existing util) when available, falling back to a typographic title; year/runtime/episode metadata built only from fields that exist on the item (no fabricated "time left"); a 2-line overview when present; a primary action and a Favorite toggle. Tapping the banner body (outside the buttons) routes through the existing `TouchableItemRouter`, identical to every other card in the app.

### 3. Continue Watching implementation (§C)
New `ContinueWatchingCardLarge.tsx`, passed into `InfiniteScrollingCollectionList` via its new `renderItem` prop (also new/additive this phase) — the query, pagination, infinite-scroll, and `TouchableItemRouter` navigation wrapper are all the **existing, untouched** component; only the per-item visual is swapped. Card width is `min(windowWidth * 0.62, 280)` — responsive (not a fixed phone width), landscape (16:9), giving roughly 1.5–1.7 cards visible on typical iPhone widths (an iPad's wider screen simply shows more of the next card, capped at 280pt so it doesn't become oversized). Reuses the existing `ProgressBar` and `WatchedIndicator` overlay components as-is, and a new `getContinueWatchingImageUrl` util extracted byte-for-byte from `ContinueWatchingPoster.tsx`'s prior inline logic (verified equivalent before extracting — `ContinueWatchingPoster.tsx` itself now calls the same util, so its 8 other existing callers — `SeasonEpisodesCarousel`, `SeasonPicker`, `NextUp` (series), `EpisodeList`, search, etc. — see byte-identical behavior). A matching `ContinueWatchingRowSkeleton` (passed via the also-new `renderSkeleton` prop) mirrors the card's real dimensions so the loading→loaded transition doesn't jump in size, unlike the component's default 3-item `w-44` skeleton.

Episode-vs-Movie/Series caption text mirrors what's already computed elsewhere in the codebase (`ItemCardText.tsx`'s own Episode branch): series name + "S{n} E{n}" + episode name for Episodes, name + year for everything else — no new "minutes left" calculation was introduced, since accurate remaining-time data isn't reliably available from the fields already on these items.

### 4. Next Up implementation (§D)
No new component. The existing Next Up section definition in `Home.tsx` had its `orientation` field flipped from `"horizontal"` to `"vertical"` — a one-line, zero-new-risk change, because `InfiniteScrollingCollectionList`'s existing type/orientation switch already renders `SeriesPoster` (portrait, 10:15) for vertical Episodes, and `SeriesPoster` already resolves an Episode's *parent series* artwork so it doesn't show a blank/wrong image. The existing `ItemCardText` caption (used unconditionally by the default render path) already prints "Series Name" + "S{n}:E{n} - {Series Name}" for Episodes, matching the "Series Name / SxEy" requirement with no new caption code. Pagination/query/navigation: untouched.

### 5. Recently Added implementation (§E)
Deliberately **not restyled** this phase beyond what Next Up's orientation change happens to share (it already used `MoviePoster`/`SeriesPoster`, i.e. clean portrait cards with restrained `ItemCardText` captions underneath — the mockup's "artwork should dominate, avoid excessive badges" description was already true of the existing card). No changes were made to its query, pagination, or navigation. The first Recently Added row additionally feeds the hero fallback chain (§2) via the same additive `onItemsLoaded` mechanism as Continue Watching/Next Up.

### 6. Header / tab-bar changes (§F)
`app/(auth)/(tabs)/(home)/_layout.tsx`: the `index` screen's `headerTitle` changed from `t("tabs.home")` (string) to `() => <RenataWordmark />`. New `RenataWordmark.tsx` is pure typography (`TextColor.primary`, 700 weight, `letterSpacing: 4`) — no raster/SVG logo asset was manufactured, per instruction. `headerRight` (Chromecast/Sessions/Settings) and `headerLeft` (Downloads, wired in `Home.tsx`) are unchanged; `headerTransparent`/`headerBlurEffect`/`headerShadowVisible` are unchanged. Bottom tab bar: no file under `app/(auth)/(tabs)/_layout.tsx` was touched this phase — Expo Router's existing tab set and destinations are exactly as they were.

### 7. New/modified design primitives (§G)
New: `components/home/HeroBanner.tsx` (+ exported `getHeroHeight`), `components/home/ContinueWatchingCardLarge.tsx`, `components/home/RenataWordmark.tsx`, `utils/jellyfin/image/getContinueWatchingImageUrl.ts`. Modified (additive-only): `InfiniteScrollingCollectionList.tsx` gained three optional props (`onItemsLoaded`, `renderItem`, `renderSkeleton`) — verified every other caller (`Favorites.tsx`, `TVLiveTVPage.tsx`) omits all three, so their output is byte-identical to before; `ContinueWatchingPoster.tsx` was refactored (not behaviorally changed) to call the new extracted image-URL util instead of its prior inline logic. No changes to `MoviePoster.tsx`/`SeriesPoster.tsx` (both are shared far beyond Home — Search, Person pages, `SimilarItems`, `MediaListSection`). `Radius`/`TextColor`/`Surface` tokens from Phase 2's `theme.ts` and the `Skeleton` primitive are now in real use for the first time (hero skeleton, Continue Watching card skeleton/border/background).

### 8. Accent color (§instruction 10)
No global user-configurable accent-color setting exists in `utils/atoms/settings.ts` (confirmed by grep, unchanged since Phase 2's finding) — the only dynamic per-item color, `itemThemeColorAtom`, is player-context-specific. Per the fallback instruction, this limitation is documented rather than a new color architecture being introduced: Home's new components reuse `Colors.primary` (the existing static purple, already the de facto single accent-color source of truth used elsewhere, e.g. `SectionHeader.tsx`) only indirectly — the hero's primary Play pill is white-on-dark (matching the mockup and maximizing contrast over arbitrary backdrop art) with the Favorite toggle a translucent white overlay; neither hard-codes a *new* purple value, and if/when a real configurable accent lands, these are the two touch points to wire it through.

### 9. Loading (§instruction 11 / H)
Every row keeps its existing priority-gated loading (`priority: 1 | 2`, `loadedSections`/`allHighPriorityLoaded`) exactly as before — untouched. The hero reuses that same `allHighPriorityLoaded` signal to decide between a reserved-height `Skeleton` and its resolved state, rather than introducing new loading-state plumbing. Continue Watching's custom skeleton (`ContinueWatchingRowSkeleton`) matches the real card's aspect ratio and responsive width so no section pops to a different size once data arrives. No section's render is now blocked on any other section — Home still renders incrementally exactly as it did before this phase.

### 10. Performance considerations (§H)
No new dependency was added (`expo-linear-gradient` and `react-native-reanimated`, used by `HeroBanner`/`Skeleton` respectively, were both already project dependencies). No new image library — hero/Continue Watching images go through the existing `@/components/common/ServerImage` wrapper, matching the project's header-aware proxy-auth convention. Hero requests a capped `width: 800` backdrop rather than the item's full-resolution art. No autoplay, no trailers, no second media API. `InfiniteScrollingCollectionList`'s virtualization/pagination/scroll-to-load-more behavior is completely untouched — the new props only swap *what* renders per item, not *how* the list fetches or scrolls.

### 11. Data/navigation preservation confirmation (§I)
- `InfiniteScrollingCollectionList`'s `useInfiniteQuery` config (`queryKey`, `queryFn`, `getNextPageParam`, `staleTime`, `enabled`) — byte-identical, no lines changed inside it.
- `TouchableItemRouter`'s routing table (`itemRouter`) — not touched; both `HeroBanner` and `ContinueWatchingCardLarge` route through the existing component.
- All Jellyfin endpoints/queryKeys in `Home.tsx` (`getResumeItems`, `getNextUp`, `getItems` per-library, `getSuggestions`, the custom-sections path) — unchanged, same query keys, same staleTime, same refetch/refresh behavior (`refetch()` in `Home.tsx` is untouched).
- Item IDs, watched/progress state (`item.UserData`), and server image loading conventions — unchanged; new cards read the same `UserData`/`ImageTags`/`BackdropImageTags` fields existing cards already read.

### 12. Playback/Jellyfin infrastructure confirmation (§J)
`git status --short` shows zero changes under `modules/mpv-player`, `providers/JellyfinProvider.tsx`, `providers/WebSocketProvider.tsx`, `providers/DownloadProvider.tsx`, `utils/profiles/`, `utils/jellyfin/media/`, `hooks/usePlaybackManager.ts`, or `app/(auth)/player/`. `HeroBanner`'s primary action calls `usePlayMedia()` directly — the same protected entry point every play button in the app uses — with a minimal `PlayRequest` (`itemId`, `offline` from the existing `useOfflineMode()`, `playbackPositionTicks` from existing `item.UserData`). This intentionally **skips** `PlayButton.tsx`'s Chromecast device-picker, downloaded-file online/offline dialog, and resume-vs-restart confirmation — those are UX layered on top of `usePlayMedia`, not the protected entry point itself, and a home-hero "quick continue" resuming immediately is consistent with how this kind of control behaves in comparable apps. Flagged here explicitly as a simplification, per §N below, for review.

### 13. i18n
Three new keys were added to `translations/en.json` under the existing `item_card` namespace (matching its established convention for item-level action strings): `item_card.play`, `item_card.add_to_favorites`, `item_card.remove_from_favorites` — used for the hero's Play/Continue and Favorite button accessibility labels and visible text. `bun run i18n:check` confirms no missing and no unused keys.

### Validation performed this phase
- `bun run typecheck` ✅ pass.
- `bun run check` (biome) — formatting/import-order issues in the touched files, fixed via `bun run format` + `bun run lint` (project's own tooling, no manual formatting), then ✅ pass, 737 files.
- `bun run i18n:check` ✅ — no missing keys, no unused keys.
- `bun run test:unit` — 204 pass / 5 fail, identical to the Phase 2 baseline; the 5 failures are pre-existing and unrelated (`utils/seriesTrackMemory.test.ts`, `utils/jellyfin/getDefaultPlaySettings.test.ts` — subtitle/audio track-memory logic, nowhere near Home).
- `bun run doctor` — 18/20 checks pass; the 2 failures (`Check Expo config schema`, `Validate packages against React Native Directory`) are both outbound-network calls to Expo's/RN Directory's servers that this sandboxed environment's proxy doesn't allow through, an environment limitation unrelated to this phase's code (same class of limitation documented in earlier phases).
- `git diff --stat`/`git status --short` against every protected path — empty; only Home-scoped files changed (§7) plus `translations/en.json`.
- GitHub Actions "Renata iOS Build Validation" — ✅ **success**. Triggered automatically on push of commit `b8f6e9a` (run [32259952371](https://github.com/grootismore/renata-jelly/actions/runs/32259952371)), completed in ~19 minutes with `conclusion: success` — native iOS compilation remains green with this phase's changes.
- **No screenshots/previews were possible.** This environment has no iOS simulator or device — this is a headless container with no Xcode UI available, consistent with every prior phase's documented limitation. This is reported honestly rather than claimed.

### Known visual/behavioral differences from the mockup, and why (§N)
- The mockup shows a paginated hero carousel (dots). Implemented instead: a **single-item hero**, chosen by the priority chain in §2 — this was explicitly permitted ("not mandatory if a single-item hero is architecturally cleaner") and avoids introducing carousel/paging state, an extra gesture surface, and additional performance cost for a first Home pass.
- The mockup's "+ My List" pill is implemented as the **existing Favorites** toggle (heart icon, `useFavorite()`), not a new "My List" concept — per explicit instruction.
- The mockup's bottom tab bar (Home/Library/Search/More) is **not** what Renata's tab bar shows — the app's real, existing tab set (Home/Search/Favorites/Watchlists/Libraries/Custom Links/Settings, several conditionally hidden) was preserved unchanged; no "More" tab was invented.
- The hero's primary action skips `PlayButton.tsx`'s Chromecast-picker/downloaded-file/resume-confirmation dialogs (§12) — an intentional simplification of a *secondary* UX layer, not of the protected playback path itself. **Superseded in Phase 3.1 below** — the hero now shares that exact decision flow via `usePlaybackEntry`.
- No pagination dots, no hero auto-advance/carousel timer — consistent with "do not autoplay anything" and avoiding unnecessary animation.

---

## Phase 3.1 — Renata Home Real-Device Polish

Triggered by real-iPhone review of Phase 3's build: the hero read as too similar in visual weight to an ordinary content row, the header felt like a separate zone stacked above the hero rather than integrated with it, and the hero's Play action bypassed the app's established playback-entry UX. Scope stayed **Home only** — no other screen touched, no data architecture changed, `InfiniteScrollingCollectionList` and `TouchableItemRouter` untouched again this phase.

### A. Hero visual changes
- **Full-bleed layout.** The hero's wrapping `<View className='px-4'>` from Phase 3 is gone — the hero now spans the true screen width, edge to edge, with square corners (no `Radius` value) instead of a rounded, inset card. Every row below it still uses its own `px-4` gutter and rounded card corners, so the hero now reads as a distinct, bespoke element rather than "a bigger version of the same card," which was the concrete real-device finding.
- **Height driven by window height, not width.** `getHeroHeight` in `HeroBanner.tsx` changed from `min(windowWidth * 1.05, 520)` to `round(clamp(windowHeight * 0.46, 300, 460))`. Sizing off *height* (clamped to a 300–460pt band) keeps the hero a controlled, predictable fraction of the visible screen on every iPhone size, addressing "consuming almost the entire first screen" without shrinking it into insignificance on smaller phones. `Home.tsx`'s loading skeleton reserves the exact same height (via the same exported helper) so nothing jumps when the hero resolves.
- **Backdrop prominence.** Requested image width now scales with the device (`min(round(windowWidth * 2), 1200)`, up from a flat `800`) and quality bumped from 80 to 85 — sharper art on Retina screens, still bounded so payload size stays sane.
- **Gradient/readability.** Two gradients instead of one: the existing bottom scrim (now `0 → 0.6 → 0.95` opacity, slightly stronger than Phase 3's `0 → 0.55 → 0.92`) for title/metadata legibility, plus a new top scrim (`0.65 → 0` fading over `headerOverlayHeight + 56`pt) that keeps the header wordmark and icons legible over arbitrary backdrop art and visually welds the header to the hero instead of leaving a flat, ungraded gap above it.
- **Title/logo, metadata, actions.** Logo/title block grows slightly (logo height 60→64, fallback title 28→30pt) and the metadata row gets `fontWeight: "600"` for more presence against the stronger gradient; text inset tightened from 20pt to 16pt to line up with the rows' own `px-4` (16pt) left edge below it, so the hero's text block and the first row's poster/text share a left-edge rhythm despite the hero itself being full-bleed. Play/Favorite pills grew marginally (44→46pt min height, 18→19pt icons) for a slightly firmer focal presence; still no new colors, still white-on-dark for the primary action and translucent-white for Favorite.
- **Spacing to the first section.** The hero's wrapper now carries an explicit `marginBottom: Spacing.lg - Spacing.md` (8pt) on top of the existing `space-y-4` (16pt) applied to the next section, giving the hero→first-row transition 24pt instead of the uniform 16pt every other row-to-row gap uses — a deliberate signal that the hero is a distinct zone, not just the first item in the stack.

### B. Header changes
- **`RenataWordmark.tsx`**: sized down (17→15pt, weight 700→600, letter-spacing 4→3) — with the backdrop now visible behind it (see below), a smaller, lighter mark reads as an integrated label rather than a headline competing with the artwork.
- **Header/hero integration.** `Home.tsx` computes `heroHeaderOverlayHeight = insets.top + 44` on iOS (0 elsewhere — Android's header isn't transparent, so it's unaffected). The hero (and its loading skeleton) render with `marginTop: -heroHeaderOverlayHeight` and a matching height increase, so the backdrop image bleeds up behind the *existing* transparent header (`headerTransparent: Platform.OS === "ios"`, already set since Phase 2/3, unchanged) instead of stopping at a flat gap below it — while the space the hero consumes in the scroll flow stays exactly its designed height (the negative margin and the height increase cancel out). This is a layout-only change local to `Home.tsx`/`HeroBanner.tsx`; the `_layout.tsx` Stack.Screen configuration, header buttons, and routing are untouched.
- **Existing controls preserved exactly.** Downloads (header-left, wired in `Home.tsx`), Cast/Sessions/Settings (header-right, `_layout.tsx`) — same components, same conditions (admin-only Sessions button), same behavior. `HeaderButton.tsx`/`HeaderIcon.tsx` (shared across every screen's header) were not touched, so no other screen is affected.
- Safe areas: `insets.top` (from the existing `useSafeAreaInsets()` call already in `Home.tsx`) is exactly what accounts for the notch/Dynamic Island in the overlay-height calculation — no hardcoded device-specific values.

### C. Hero playback-entry behavior, before/after
- **Before (Phase 3):** the hero's Play button built a minimal `PlayRequest` and called `usePlayMedia()` directly — bypassing PlayButton.tsx's resume-vs-restart prompt, downloaded-file online/offline choice, and Chromecast device picker entirely.
- **Investigation:** read `PlayButton.tsx` in full. Its `onPress` → `startPlayback` → `handleNormalPlayFlow` chain is a UI-level *decision* flow (resume dialog gated by `settings.showResumeDialog`, a downloaded-file dialog when the item has a local copy, a Chromecast/Device action sheet when a cast session exists) that always terminates in the same call every play control in the app uses: `usePlayMedia(playRequest, { item })`. None of that decision logic touches MPV, MPVKit, PlaybackInfo negotiation, device profiles, or progress reporting — it only decides *which* `PlayRequest` to build and *when* to hand it to `usePlayMedia`.
- **Extraction:** that entire decision flow was moved, unchanged in behavior, into a new `hooks/usePlaybackEntry.tsx` (`usePlaybackEntry(item, trackOptions?)`, returning `{ play }`). `PlayButton.tsx` was refactored to call this hook instead of owning the logic itself — verified by diff that only the animated slide-button UI and the hook wiring remain in `PlayButton.tsx`; the resume/download/Chromecast code is textually identical, just relocated. `PlayButton.tsx` is used by exactly one screen (`ItemContent.tsx`, the item details page — confirmed by grep before touching it), so the blast radius of this refactor is well understood.
- **After (Phase 3.1):** `HeroBanner.tsx` calls `const { play } = usePlaybackEntry(item)` (no `trackOptions` — the hero has no audio/subtitle-track selection UI, same as Phase 3, so those fields stay `undefined` and `usePlayMedia` auto-selects exactly as before) and wires `onPress={play}` directly. Playing an item from the hero now shows the same resume-vs-restart prompt, the same downloaded-file choice, and the same Chromecast picker that playing it from the item details page does — no more special-cased "quick continue" behavior.
- **Not touched:** `usePlayMedia`, `utils/nativePlayer/playRequest`, `utils/jellyfin/media/getStreamUrl`, the Chromecast device-profile files (`utils/profiles/chromecast*`), and every other file the decision flow reads from — all imported into the new hook exactly as `PlayButton.tsx` already imported them, not modified.

### D. Lower-Home changes
None beyond the spacing already covered in §A (the extra margin between hero and the first section). Continue Watching cards, Next Up, Recently Added, Suggested Movies, Streamystats rows, and the bottom tab bar are byte-for-byte what Phase 3 shipped — confirmed via `git diff --stat`, which shows only `PlayButton.tsx`, `HeroBanner.tsx`, `Home.tsx`, `RenataWordmark.tsx`, and the new `usePlaybackEntry.tsx`.

### E. Protected paths confirmation
`git status --short` shows changes only in `components/PlayButton.tsx`, `components/home/HeroBanner.tsx`, `components/home/Home.tsx`, `components/home/RenataWordmark.tsx`, and new `hooks/usePlaybackEntry.tsx`. Zero changes under `modules/mpv-player`, `providers/JellyfinProvider.tsx`, `providers/WebSocketProvider.tsx`, `providers/DownloadProvider.tsx`, `utils/profiles/` (imported, not modified), `utils/jellyfin/media/` (imported, not modified), `hooks/usePlaybackManager.ts`, or `app/(auth)/player/`. `PlayButton.tsx` itself is UI-level (a details-page button component), not one of the protected paths, and the instruction explicitly scoped this phase's playback work to "using the established UI-level playback entry behavior" — which is exactly what changed.

### F. Validation results
- `bun run typecheck` ✅ pass (run twice: once immediately after the `usePlaybackEntry` extraction, once after all visual changes).
- `bun run check` (biome) — formatting-only diffs in the touched files, fixed via `bun run format` + `bun run lint`, then ✅ pass, 738 files.
- `bun run i18n:check` ✅ — no missing keys, no unused keys (no new `t()` calls were introduced this phase).
- `bun run test:unit` — 204 pass / 5 fail, identical to the Phase 3 baseline; the 5 failures remain the same pre-existing, unrelated subtitle/audio track-memory tests.
- `git status --short` — only the 5 files listed in §E; no protected path touched.

### G. GitHub Actions result
Renata iOS Build Validation — ✅ **success**. Triggered automatically on push of commit `56fad12` (run [32274687581](https://github.com/grootismore/renata-jelly/actions/runs/32274687581)), completed in ~20 minutes with `conclusion: success` — native iOS compilation remains green with this phase's changes.

### H. Changed files
- Modified: `components/PlayButton.tsx` (refactored to delegate to `usePlaybackEntry`, no behavior change), `components/home/HeroBanner.tsx` (visual polish + playback-entry swap), `components/home/Home.tsx` (full-bleed hero layout, height-based sizing, header-overlay wiring, extra spacing), `components/home/RenataWordmark.tsx` (lighter typography).
- Added: `hooks/usePlaybackEntry.tsx` (extracted playback-entry decision flow, shared by `PlayButton.tsx` and `HeroBanner.tsx`).
- Not touched: everything else, including every protected path listed in §E and every non-Home screen.
