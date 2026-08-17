# Renata — Claude Code Project Rules

Read RENATA_PRD.md before making product or architecture decisions.

## Prime directive
Renata is derived from Streamyfin. Preserve proven infrastructure. Modify the smallest reasonable surface for each task.

Do not rebuild working Streamyfin systems merely because a rewrite looks cleaner.

## Before editing
For every non-trivial task:
1. Inspect the relevant existing implementation.
2. State the files/subsystems likely to be affected.
3. Identify any playback/auth/API risk.
4. Make a focused plan.
5. Then implement.

If repository reality conflicts with the PRD, report the conflict rather than pretending an API/module exists.

## Protected areas
Treat these as protected unless the task explicitly requires changes:
- Jellyfin authentication
- Jellyfin SDK/API integration
- PlaybackInfo negotiation
- playback start/progress/stop reporting
- MPV native integration / MPVKit bridge
- VLC native integration / VLCKit bridge
- native Swift/Apple player integration
- downloads/offline infrastructure
- WebSocket/session infrastructure
- media state/providers

UI work must not casually rewrite these systems.

## Native playback rule
Before changing native playback code:
1. explain why configuration/TypeScript/profile-level changes are insufficient;
2. identify exact native files;
3. identify likely regressions;
4. prefer the smallest change;
5. validate playback afterward.

Do not introduce a second parallel player architecture if Streamyfin already provides the needed abstraction.

## Direct Play rule
Renata aims to maximize Direct Play, but correctness comes first.

Never force Direct Play by lying to Jellyfin about capabilities that the selected engine cannot actually handle.

When diagnosing unnecessary remux/transcode:
- inspect PlaybackInfo request/device profile;
- inspect selected player capabilities;
- inspect container/video/audio/subtitle streams;
- inspect server playback/transcode reason;
- distinguish Direct Play, remux/direct stream, audio transcode, subtitle burn-in and video transcode.

Do not assume MKV itself is the problem.

## UI rule
Renata's UI can diverge significantly from Streamyfin.
Change it screen-by-screen.
Preserve data and playback contracts beneath the UI whenever possible.

Do not perform an app-wide redesign in one commit.

## Dependency rule
Prefer existing dependencies and project patterns.
Before adding a dependency, explain why the existing stack cannot reasonably do the job.
Avoid replacing foundational libraries without explicit instruction.

## Git discipline
Work on a Renata feature branch.
Before a phase, ensure the working tree state is understood.
After a phase:
- run appropriate checks;
- summarize changed files;
- summarize known issues;
- recommend a commit checkpoint.
Do not make destructive git operations without explicit permission.
Do not erase unrelated user changes.

## Validation
Use the package manager and scripts actually defined by the repository.
Do not guess commands when package.json/workspace configuration can be inspected.

At minimum, use applicable:
- formatting/lint
- TypeScript/typecheck
- tests
- Expo/native prebuild/build validation

A successful compile does not prove playback works. Clearly identify tests requiring a physical iPhone/Jellyfin server.

## Security
Never commit:
- Jellyfin passwords
- API keys/tokens
- private server URLs if the user wants them private
- signing secrets/certificates

## Scope control
If a prompt asks for one phase, do that phase only.
Do not opportunistically refactor unrelated code.
Leave TODOs with explanation rather than implementing speculative architecture.

## Documentation
Keep RENATA_PRD.md aligned when a deliberate product decision changes.
Maintain a short RENATA_DEVLOG.md with:
- phase
- major decisions
- validation performed
- unresolved issues
- next recommended step

## Naming
User-facing product name: Renata.
Do not mass-rename upstream source symbols/packages until there is a functional reason. User-facing rebranding and technical namespace migration are separate tasks.

## Upstream
Keep the upstream Streamyfin remote/reference available if possible so useful fixes can be studied or merged later.
Do not remove upstream license/notice material.
