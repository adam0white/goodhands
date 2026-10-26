# Good Hands

[Play Good Hands](https://goodhands.adamwhite.work). You are Nermin, running a placement agency in Izmir during November 2026. Find workers for households, keep the agency open, and see whether your placements last. Families pay agency fees. Rent is due every Friday.

## How to play

Open the office or continue a saved month. Select an applicant on the Bench to interview them. Take their number if you want to call them back. Compare their answers with former employers’ accounts and what you see during trials. Cards distinguish “says”, “heard” and “seen”; a crossed-out note marks Nermin’s doubt.

Use Families to inspect requests and deadlines. Propose a worker, discuss the wage, working hours, weekly day off, trial length and agency fee, and choose which qualities to promise. Both sides must accept before you confirm a placement. Use Placed to follow work, calls, disagreements and arrangements. The day’s notes remain at the desk. The information button explains the current situation. The month review shows placement outcomes and Nermin’s notes beside the underlying character information.

Ordinary play handles pacing and continuing people automatically. The menu offers Resume, Feedback, Full screen, All games, Recording and New game with confirmation. Feedback can send a note without sharing a run and offers “Keep a copy of this run”. It has verdict buttons “I’d keep playing”, “Not sure” and “I’d stop here”, plus separate “I’m stopping” and “I’m confused” choices. Selecting a choice sends nothing and leaves your note unchanged. Select the same choice again to clear it, or select the other choice to change it. Only Submit sends the selected label, the verdict code (`keep`, `mixed` or `quit`) and your trimmed note, separated by blank lines. The name is optional. A failed send keeps your note for another Submit. The month review also offers “Download this run”. Diagnostic import, export, pacing and people controls require exactly `?lab=1`.

## Saves, recording and replay

The game saves the month and replay history locally in IndexedDB. Storage can fail or be cleared; keep a downloaded copy. Continuing a loaded month keeps its original people and history instead of fetching newer versions of them.

The first-visit notice covers recording and linking play across games on this device. One Recording switch controls both. DNT/GPC sets the initial default off; turning Recording on opts in. With Recording off, Feedback offers one unticked sharing checkbox; otherwise it sends the note and optional name alone. Character analysis has a separate opt-in.

Current full and compact exports replay from their pinned inputs and starting state. Frozen editions 1–4 retain their original runtime and text. Edition 5 and incompatible older edition-6 exports may refuse with a start-new-game message. File-origin histories retain their provenance and require an explicit branch before native publication.

Current finite receiving routes include actual Murmur Aylin from signed source `92cdebd` on engine 2.23.0. The generic Voice `cast-1`/`site-cast/1` Selin receiver also admits engine 2.23.0 at supported after-work boundaries. Its actual source checkpoint at minute 2525 (18:05) passes; the earlier 03:59 checkpoint still refuses. Full and compact receiving replays and two retained agency claim/reentry cycles pass source controls. The dedicated historical `voice-4` guard is unchanged. A fresh agency Selin export is not a continued Voice return. Export fixtures, complete raw-state/RNG comparisons and replay checks do not establish a human journey or shared-shelf ownership receipt.

## What Human Framework supplies

[Human Framework](https://github.com/adam0white/human-framework) supplies the people, traits, skills, needs, trust, impressions, observation and social updates. Good Hands uses those APIs to form Nermin’s estimates and to resolve worker and household responses. The game owns the agency calendar, jobs, fees, dialogue, placement rules and mappings from HF traits and skills to qualities such as patience or reliability. Those mappings are game interpretations, not clinical assessments.

The current game is app `0.1.0`, simulation edition 6, using exact HF package `3.0.0` with engine `2.23.0`. Frozen editions use the separate HF `2.9.0` alias. The adopted immutable lab artifacts are client `0.4.11` and kit `0.5.12`. The ordinary Feedback form exposes the shared “I’m stopping” and “I’m confused” choices.

## Development and delivery

Use Node ≥24 with `/opt/homebrew/bin` first on PATH. HF requires TypeScript 7 or later; this host pins 7.0.2.

```fish
npm ci
npm run dev
npm run check:lane # normal shared lock; lint, typecheck and full tests here
npm run build
```

Run the normal lane before every signed commit. Fetch and rebase before pushing; require green CI on the exact commit. Application changes use the normal clean managed deployment and live verification procedure in [HANDOFF.md](HANDOFF.md). Documentation-only changes need no application deployment.

[HANDOFF.md](HANDOFF.md) records current delivery limits and owner acceptance. [docs/design.md](docs/design.md) retains design and historical plans; its older version and control descriptions are not the current release manifest. Adam accepts readiness by playing. Lab-panel rounds on HF3 builds belong to the playtest director; friends’ playtests and Show HN remain paused.
