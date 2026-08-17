# Renata — Playback Test Matrix

Use real files from the user's library. Record Jellyfin server decision and actual selected player.

**Engine legend** (corrected per Phase 0 code audit — see RENATA_PRD.md §6): the only two iOS engines that currently exist are **MPV** (classic RN-embedded controls) and **Native** (same libmpv engine as MPV, native SwiftUI controls layer — not a separate decoder). ExoPlayer exists only on Android TV. **VLC is not integrated in this codebase** and cannot be tested; the VLC row below is kept for traceability but is out of MVP scope.

| ID | Container | Video | Audio | Subs | Engine | Expected | Actual | Server reason/notes |
|---|---|---|---|---|---|---|---|---|
| T01 | MKV | HEVC Main10 | AAC | ASS | MPV | Direct Play if supported | | |
| T02 | MKV | HEVC | EAC3 | SRT | MPV | Direct Play if supported | | |
| T03 | MKV | H.264 | AAC | None | MPV | Direct Play | | |
| T04 | MP4 | H.264 | AAC | None | Native | Direct Play | | |
| T05 | MKV | HEVC Main10 | AAC | PGS | MPV | Determine actual support | | |
| T06 | MKV | HEVC | DTS | ASS | MPV | Determine actual support/device output | | |
| T07 | MKV | AV1 | Opus | SRT | MPV | Device/player dependent | | |
| T08 | MKV | HEVC | AAC | ASS | VLC (not integrated) | Out of scope for MVP — future investigation only, not testable today | N/A | No VLC engine exists in this codebase |
| T09 | MKV | HEVC Main10 | AAC | ASS | Native | Direct Play if supported (same libmpv engine as T01, native controls layer) | | |

For every failure capture:
- device/iOS version
- Jellyfin server version
- Renata commit
- selected engine
- PlaybackInfo/transcode reason
- whether video/audio/subtitle was copied, remuxed or transcoded
- relevant client/server log excerpt
