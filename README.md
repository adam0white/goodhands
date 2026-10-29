# Good Hands

[Play Good Hands](https://goodhands.adamwhite.work). You are Nermin, running a placement agency in Izmir during November 2026. Find workers for households, keep the agency open, and see whether your placements last. Families pay agency fees. Rent is due every Friday.

Source status on2026-10-28: this checkout uses HF4.7.0 and is awaiting technical delivery. The public site retains the last verified HF3 build. [HANDOFF.md](HANDOFF.md) records the remaining checks and live receipt.

## How to play

Open the office or continue a saved month. Select an applicant on the Bench to interview them. Take their number if you want to call them back. Compare their answers with former employers’ accounts and what you see during trials. Cards distinguish “says”, “heard” and “seen”; a crossed-out note marks Nermin’s doubt.

Use Families to inspect requests and deadlines. Propose a worker, discuss the wage, working hours, weekly day off, trial length and agency fee, and choose which qualities to promise. Both sides must accept before you confirm a placement. Use Placed to follow work, calls, disagreements and arrangements. The day’s notes remain at the desk. The information button explains the current situation. The month review shows placement outcomes and Nermin’s notes beside the underlying character information.

Ordinary play handles pacing and continuing people automatically. The menu offers Resume, Feedback, Full screen, All games, Recording and New game with confirmation. Feedback can send a note without sharing a run and offers “Keep a copy of this run”. It has verdict buttons “I’d keep playing”, “Not sure” and “I’d stop here”, plus separate “I’m stopping” and “I’m confused” choices. Selecting a choice sends nothing and leaves your note unchanged. Select the same choice again to clear it, or select the other choice to change it. Only Submit sends the selected label, the verdict code (`keep`, `mixed` or `quit`) and your trimmed note, separated by blank lines. The name is optional. A failed send keeps your note for another Submit. The month review also offers “Download this run”. Import, downloads, file continuation, page and pacing choices, and People between games are ordinary menu controls. Debug is one collapsed disclosure for build and storage diagnostics. Gameplay needs no feature flag.

## Saves, recording and replay

The game saves a replayable compact working file locally in IndexedDB. It retains every game input, the pinned starting chapter and continuity, the clock, and the complete-state fingerprint. Resume reconstructs the state through the same public replay route as file import. Default downloads and file-session working copies use that compact format. Continuing a loaded month keeps its original people and history. Storage can fail or be cleared; keep a downloaded copy.

The menu also offers Download complete source archive. Complete source and playtest exports retain the full HF archive and every accepted input. Publication first commits the complete source under a separate immutable IndexedDB archive key and verifies its readback. The ordinary resumable save remains separate. A compact supplied file is identified as compact; it does not claim to supply a full state. File sessions preserve original bytes and unknown fields. The existing 20 MiB file and working-wire limits, 40 MiB combined limit, and 30-million-character import limit remain serialized-wire bounds, not a bound on reconstructed memory. A separate menu action verifies and imports complete JSON source archives up to 100 MiB. Verification runs replay and full-state comparison in a worker and can be canceled before replacing the saved month. This serialized limit does not bound reconstructed memory or verification time; keep the compact working copy for normal continuation.

The first-visit notice covers recording and linking play across games on this device. One Recording switch controls both. DNT/GPC sets the initial default off; turning Recording on opts in. With Recording off, Feedback offers one unticked sharing checkbox; otherwise it sends the note and optional name alone. Character analysis has a separate opt-in.

Current full and compact exports replay from their pinned inputs and starting state. Frozen editions 1–4 retain their original runtime and text. Edition 5 and incompatible older edition-6 exports may refuse with a start-new-game message. File-origin histories retain their provenance and require an explicit branch before native publication.

Historical HF3 receiving controls include actual Murmur Aylin from signed source `92cdebd` on engine 2.23.0. The generic Voice `cast-1`/`site-cast/1` Selin receiver also admits engine 2.23.0 at supported after-work boundaries. Its actual source checkpoint at minute 2525 (18:05) passes; the earlier 03:59 checkpoint still refuses. Full and compact receiving replays and two retained agency claim/reentry cycles pass source controls. Those controls use the frozen HF3 runtime and its explicit legacy SDK. Current HF4 chapters require supported version-2 portable people; unsupported older passports can refuse with a start-fresh message. The dedicated historical `voice-4` guard is unchanged. A fresh agency Selin export is not a continued Voice return. Export fixtures, complete raw-state/RNG comparisons and replay checks do not establish a human journey or shared-shelf ownership receipt.

## What Human Framework supplies

[Human Framework](https://github.com/adam0white/human-framework) supplies the people, traits, skills, needs, trust, impressions, observation and social updates. Good Hands uses those APIs to form Nermin’s estimates and to resolve worker and household responses. The game owns the agency calendar, jobs, fees, dialogue, placement rules and mappings from HF traits and skills to qualities such as patience or reliability. Those mappings are game interpretations, not clinical assessments.

Current source is app `0.1.0`, simulation edition 6, on published HF `4.8.1`, immutable client `0.5.7` and kit `0.5.24`. It uses one public HF Run route with daily numerical fidelity. HF owns actor decisions and changes; Good Hands supplies offers, agreed job demands, calendar inputs and actual host receipts. Work starts and ends at the agreed times. The 10:00 household account uses actual work, including an unreported completed late shift the following morning.

Frozen editions retain HF `2.9.0`; the historical HF3 source and raw hashes retain explicit HF `3.0.0` and client `0.4.15` aliases. The HF4.8.1 migration was delivered at `dccf97d`; current follow-through source and its delivery gates are recorded separately in HANDOFF.md. The historical HF4.7 full-month continuation is expensive: cold reconstruction of the actual completed month took4483seconds locally. Actual Resume, compact working JSON and complete-source readback passed in that same browser phase on the pre-review source. Later placement interruption and guest-duty fixes were not replayed through that month. No fine-fidelity or responsiveness parity is claimed. The ordinary Feedback form exposes the shared “I’m stopping” and “I’m confused” choices.

## Development and delivery

Use the shared exact Node 26.12.0 and pnpm 12.14.0 with `/opt/homebrew/bin` first on PATH. HF requires TypeScript 7 or later; this host pins 7.0.2.

```fish
pnpm install --frozen-lockfile
pnpm run dev
pnpm run check:lane # lint and typecheck; CI runs the full suite
pnpm run build
```

The exact manager pin and shared Node version are recorded in package.json and .node-version. pnpm-workspace.yaml owns strict engine and peer checks, no hoisting, hardlinks, the 1440-minute release-age policy with only owned @adam0white/* exempted, native build approvals and overrides. Run a frozen install after branch updates. pnpm run/exec rejects stale dependencies; npm run scripts remain supported but bypass that pnpm guard.

Existing npm worktrees must preserve dirty source, remove only their own root and workspace node_modules, run pnpm install --frozen-lockfile, then delete dist, .types and *.tsbuildinfo before rebuilding. Create managed worktrees with `npm run wt -- add <repo-dir> <name>` from the Human Framework repository.

Run the normal lane before every signed commit. Fetch and rebase before pushing; require green CI on the exact commit. Application changes use the normal clean managed deployment and live verification procedure in [HANDOFF.md](HANDOFF.md). Documentation-only changes need no application deployment.

[HANDOFF.md](HANDOFF.md) records current delivery limits and owner acceptance. [docs/design.md](docs/design.md) retains design and historical plans; its older version and control descriptions are not the current release manifest. Adam accepts readiness by playing. Lab-panel rounds on HF3 builds belong to the playtest director; friends’ playtests and Show HN remain paused.
