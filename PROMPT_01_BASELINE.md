# Claude Code Prompt 01 — Audit and Baseline

You are working on Renata, an iOS/iPadOS Jellyfin client derived from Streamyfin.

FIRST read:
- the repository's existing CLAUDE.md in full;
- RENATA_PRD.md;
- RENATA_CLAUDE_RULES.md;
- RENATA_ROADMAP.md.

Do not make product changes yet.

Your task is Phase 0 only: inspect the repository and prepare/verify an untouched baseline.

1. Inspect git status, current branch/remotes, repository structure, package/workspace configuration, Expo configuration, native modules, and build scripts.
2. Identify the exact Streamyfin version/branch/commit this fork is based on if determinable.
3. Map the current architecture relevant to:
   - Jellyfin authentication/SDK;
   - navigation;
   - data fetching/state;
   - PlaybackInfo/playback negotiation;
   - playback progress reporting;
   - MPV;
   - VLC;
   - native/Swift player;
   - downloads/offline.
4. Verify the real player implementations from the code. Do not assume the PRD's desired architecture is already implemented.
5. Determine the correct package manager and exact commands for install, submodules, prebuild and iOS development build from repository files.
6. Check whether the project can be validated in the current environment. Run only safe non-destructive checks that are possible.
7. Do NOT rename Streamyfin, redesign UI, change playback profiles, update dependencies, or refactor code in this phase.
8. Create or update RENATA_DEVLOG.md with:
   - baseline commit;
   - architecture findings;
   - commands discovered;
   - validation results;
   - blockers;
   - exact next step for getting the untouched app running on a physical iPhone.
9. If the repository already contains user modifications, preserve them and clearly report them.

At the end, give me:
A. concise architecture summary;
B. exact commands I should run;
C. anything I must install/configure;
D. whether a Mac/Xcode/EAS build is required for the next step;
E. any discrepancies between our PRD assumptions and the actual Streamyfin code;
F. changed files, if any.

STOP after Phase 0. Do not begin rebranding until I explicitly approve Prompt 02.
