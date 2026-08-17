# Renata — Implementation Roadmap

## Phase 0 — Baseline
Goal: prove the upstream fork works before customization.
Exit: untouched app builds; user can log in; representative video plays.

## Phase 1 — Safe rebrand
Goal: user-facing Renata identity.
Change app display name, safe identifiers/config, icons/splash later if assets are not ready.
Do not mass-rename internal symbols.
Exit: Renata launches with existing functionality intact.

## Phase 2 — Feature inventory
Create a keep/hide/later matrix for inherited features.
Prefer hiding/de-emphasizing before deleting.
Exit: agreed product surface without infrastructure damage.

## Phase 3 — Design foundation
Establish tokens/components only after inspecting current styling.
Build a representative Home shell first.
Exit: approved visual direction.

## Phase 4 — Home
Continue Watching, Next Up, Recently Added, libraries.
Exit: correct navigation/data and responsive iPhone/iPad layout.

## Phase 5 — Library + Search
Filtering/sorting only where useful.
Exit: fast browse/search with loading/empty/error states.

## Phase 6 — Details
Movie, series, season, episode.
Exit: play/resume and navigation are correct.

## Phase 7 — Player UX
Redesign controls without rewriting engine internals.
Exit: reliable controls, tracks, rotation, progress reporting.

## Phase 8 — Engine selection
Expose the existing MPV(classic controls)/Native(MPV engine, native controls layer) choice using existing capabilities — these are the only two iOS engines that exist (see RENATA_PRD.md §6; "Native" is not a separate decoder from MPV, and VLC is not integrated). Start with manual switching.
Exit: selected controls layer persists and plays correctly. Do not build a VLC or AVPlayer option in this phase.

## Phase 9 — Direct Play optimization
Use real sample files and Jellyfin logs.
Build a compatibility test matrix.
Change profiles only when evidence shows negotiation is unnecessarily conservative.
Exit: target MKV/HEVC cases Direct Play where supported, without breaking fallback.

## Phase 10 — Subtitle/audio polish
ASS/SRT/PGS and common audio combinations.
Exit: track selection and rendering behavior tested.

## Phase 11 — Downloads/offline
Preserve upstream foundation; redesign UX.
Exit: download, offline discovery, playback and cleanup are reliable.

## Phase 12 — Release hardening
Performance, accessibility, crash/error handling, license audit, App Store readiness.
