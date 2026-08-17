# Renata — Product Requirements Document

## 1. Product
Renata is a native-feeling iOS/iPadOS Jellyfin client derived from Streamyfin.

The goal is not to rebuild Jellyfin or Streamyfin from scratch. Renata should preserve proven Streamyfin infrastructure while replacing and simplifying the product experience around:
- a polished, premium media-browsing UI;
- reliable Jellyfin authentication and library access;
- exceptionally broad Direct Play compatibility;
- excellent MKV, HEVC/x265 and subtitle playback;
- predictable MPV/VLC/native-player behavior.

## 2. Foundation
Base project: Streamyfin.
Primary app stack: Expo + React Native + TypeScript.
Native development builds are expected; Expo Go is not a target because native playback modules are required.

Preserve upstream architecture where practical. Do not copy functionality into a blank Expo app merely to make the code look simpler.

## 3. Platforms
### MVP
- iPhone
- iPad

### Later
- Android may remain possible where inherited architecture permits it.
- TV platforms are not an MVP requirement.

## 4. Core user journey
1. Launch Renata.
2. Add/connect to a Jellyfin server.
3. Authenticate.
4. Browse home/library/search.
5. Open movie, series, season or episode details.
6. Start/resume playback.
7. Select audio/subtitle tracks.
8. Playback progress is reported correctly to Jellyfin.
9. Continue Watching and watched state remain synchronized.

## 5. Playback philosophy
Priority:
1. Direct Play the original media when the selected player can actually handle it.
2. Direct Stream/remux when required.
3. Transcode only when required by an unsupported codec, stream, subtitle mode, bandwidth constraint, or other genuine incompatibility.

A container alone must not be treated as proof that video transcoding is required.

Example target:
MKV + HEVC Main10 + compatible audio + ASS
→ if MPV can handle the streams, prefer original-file Direct Play.

Playback decisions must remain compatible with Jellyfin's PlaybackInfo/device-profile negotiation and server reporting.

## 6. Player architecture
Renata should preserve Streamyfin's existing player infrastructure first.

**Actual current architecture** (confirmed by Phase 0 code audit — this replaces an earlier, incorrect assumption in this PRD that MPV/VLC/Native were three independent decode engines):
- iOS/iPad playback is MPV/MPVKit-based. `modules/mpv-player` wraps libmpv via the MPVKit CocoaPod.
- The `VideoPlayer` setting has three values: `MPV`, `ExoPlayer`, `Native`.
- **"Native" is not a separate AVPlayer/AVFoundation decode path.** It is the same libmpv engine as "MPV" (`MPVPlayerEngine`) — the only difference is which controls/chrome layer is presented on top (a SwiftUI native-glass layer vs. the classic RN-embedded view). Both share one decoder.
- ExoPlayer is a real, separate engine, but it only exists for Android TV.
- **VLC/VLCKit is not integrated anywhere in this codebase today.**

User-facing engines for Renata MVP (iPhone/iPad):
- MPV (classic controls layer) — existing, preserve as-is.
- Native (MPV engine, native controls layer) — existing, preserve as-is.
There is no third or fourth iOS engine available to expose in MVP.

MVP behavior:
- Preserve the existing MPV/MPVKit infrastructure; do not rewrite it.
- Manual selection between the MPV-classic and Native controls layers should work reliably. On iOS this is a controls-layer choice, not a decoder choice.
- "Auto" for MVP means: use whichever of the two existing MPV-backed presentations is already the platform default (Native on iPhone/iPad), with no invented fallback logic.

VLC:
- Treated as a possible future investigation, not an existing or required MVP engine.
- Do not implement VLC/VLCKit integration during MVP work.
- Do not introduce AVPlayer as a second, competing decode engine alongside MPV.

Never silently switch engines mid-playback unless that behavior is deliberately designed and tested.

## 7. Target media compatibility
High-priority containers:
- MKV
- MP4
- MOV
- WebM where supported

High-priority video:
- H.264/AVC
- HEVC/H.265
- HEVC Main10 / 10-bit
- AV1 where the player/device supports it

High-priority audio:
- AAC
- AC3
- EAC3
- FLAC
- Opus
- DTS where the selected player/device permits it

High-priority subtitles:
- ASS/SSA
- SRT
- WebVTT
- embedded subtitles
- external subtitles
- PGS where supported

Do not claim support merely because a codec appears in this PRD. Capability must be based on the actual selected player/device and tested behavior.

## 8. Playback UX
Required:
- play/pause
- seek
- ±10 second controls
- scrubber/progress
- audio track selection
- subtitle selection/off
- playback speed if supported cleanly
- portrait/landscape transition
- resume position
- watched/progress reporting
- loading/error states
- gesture behavior that does not conflict with iOS system gestures

Desired:
- Picture in Picture
- subtitle appearance controls
- chapter navigation
- intro/credit skipping when Jellyfin data/integration supports it
- clear technical playback information/debug panel
- player-controls-layer selector in Settings (MPV classic vs. Native — see §6; not a VLC/AVPlayer selector)

## 9. Browsing UX
MVP screens:
- server/login
- home
- libraries
- library listing
- movie details
- series details
- season/episode browsing
- search
- settings
- player

Home should support useful Jellyfin rows such as:
- Continue Watching
- Next Up
- Recently Added
- relevant libraries/collections

UI should be designed as Renata, not as a cosmetic recolor of Streamyfin.

## 10. Visual direction
- modern
- premium
- cinematic
- native-feeling on iOS
- content-first
- restrained animation
- excellent dark mode
- readable typography
- large poster/backdrop imagery without making navigation cumbersome

Exact visual design will be iterated screen-by-screen. Do not invent a huge design system before a representative Home + Details flow is approved.

## 11. Downloads/offline
Preserve working Streamyfin download/offline infrastructure unless there is a concrete reason to change it.
A redesigned downloads experience may come after core online playback is stable.

## 12. Jellyfin integration that must remain correct
- server connection
- authentication/session handling
- Jellyfin SDK/API
- libraries and items
- images/metadata
- PlaybackInfo negotiation
- playback start/progress/stop reporting
- watched state
- resume state
- WebSocket/session behavior where used
- user-specific state

## 13. Non-goals for initial development
Do not initially:
- rewrite the Jellyfin SDK layer;
- replace all providers/state management;
- rewrite MPVKit/VLCKit bridges;
- create a new media player from scratch;
- optimize every platform;
- perform a repository-wide visual rewrite in one change;
- remove working features simply because they are not yet exposed in the Renata UI.

## 14. Engineering requirements
- TypeScript should remain strict/healthy.
- Prefer existing project conventions.
- Avoid unnecessary dependencies.
- Keep native changes isolated and justified.
- No secrets or server credentials committed.
- Maintain useful upstream attribution/license notices.
- Keep changes reviewable and phase-based.
- Run relevant lint/typecheck/tests/build validation after meaningful changes.
- Fix errors rather than suppressing them without justification.

## 15. Licensing
Streamyfin is an open-source upstream dependency/project. Before public distribution, verify the current upstream license and all bundled dependency licenses. Preserve notices and comply with source/distribution obligations. Do not remove attribution or license files casually.

## 16. Development phases
Phase 0 — Repository audit and untouched baseline build
Phase 1 — Renata branch + safe rebranding
Phase 2 — Product cleanup without player rewrites
Phase 3 — Renata design foundations
Phase 4 — Home
Phase 5 — Library/search
Phase 6 — movie/series/episode details
Phase 7 — player UI
Phase 8 — playback-engine settings
Phase 9 — Direct Play/profile investigation and optimization
Phase 10 — audio/subtitle polish
Phase 11 — downloads/offline
Phase 12 — performance, accessibility, regression testing, release preparation

## 17. Definition of MVP success
Renata can connect to a normal Jellyfin server and reliably:
- authenticate;
- browse a user's media;
- search;
- display movie/series metadata;
- resume/play media;
- play representative MKV + HEVC files through the intended engine when technically supported;
- use audio/subtitle tracks;
- report playback progress;
- maintain watched/continue-watching state;
- run as a real iOS development build on an iPhone.

The MVP is successful because it is reliable, not because every planned feature exists.
