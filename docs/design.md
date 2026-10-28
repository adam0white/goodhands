## Current HF4 source status — 2026-10-28

Current source adopts published HF4.7.0/client0.5.3/kit0.5.21. It is not deployed; HANDOFF.md retains the verified live HF3 receipt. The earlier HF4.5.1/G4 audit below is historical. The source uses HF's public condition readings, self reports, decisions, inputs, inspection and restore. No game feature flag selects a different actor engine.

Agreed job start/end and role demands produce actual work receipts and psychological/skill consequences. Care waits for a busy activity's natural end and admits new inputs after a closed timestamp. The10:00 household report uses today's actual admitted work, or an unreported completed late shift from the previous workday. It records the actual workday exactly once and invents no prior history.

Current SDK portable claims preserve complete source provenance and use the public ownership operation. One fork-aware host metadata check validates owned heads back to their accepted initial claim, including ordinary branch identity and explicit forks. Checksum-valid changes to source evidence, parent, branch or ownership refuse. Historical HF3 passport controls and raw hashes use the explicit legacy runtime and SDK.

The actual public-input month reached ended/review clock40020; its complete JSON is71920350bytes and compact working wire258101bytes. The sole corrected cold Resume/source-custody browser phase passed:4483s cold reconstruction,4502s total. The original complete source matches every JSON value and byte; actual Resume, both viewports, compact working JSON and complete immutable source readback pass. Compact default download has identical JSON values with different property order/hash. Exact full-suite CI, final hosted review and technical delivery remain pending. This evidence establishes no real shared-shelf journey or Adam's play acceptance; readiness remains2026-11-03.

## Current replayable working saves — 2026-10-28

Ordinary browser saves, pagehide saves, default run downloads and file-session working copies use the existing compact run format: complete game inputs, pinned chapter, continuity, clock, seed and full-state fingerprint. One helper constructs this wire, and the existing importer reconstructs the state through replay. The file-session reader preserves the original bytes and unknown top-level fields. It still distinguishes a compact supplied history from a supplied full state.

The existing file limits bound serialized input and working files. They do not certify a bound on reconstructed simulation memory. No product byte limit was raised. Complete playtest/feedback exports and the explicit complete-source download retain the full HF archive and every accepted input. Before shelf publication, the complete source is committed under an immutable content-addressed IndexedDB key and read back exactly. A coalesced ordinary save is not a source-custody receipt. The compact resumable `run` key remains separate.

This choice follows actual day-five measurements: the complete source was16,205,582 bytes, while the existing compact wire was43,031 bytes. Runtime and completed-month replay remain measured separately; compact storage does not make replay free.

## Current HF4 host receipts — 2026-10-28

The current host schema is `goodhands-hf4/2`. The current source keeps its complete booking and completion index. One host receipt reducer updates that index in live play and reconstructs it during cold restore from complete public HF offers, requests and action resolutions. Restore rejects an inconsistent saved index. It does not interpret clipped event journals as complete history.

The duplicate `world.hostState` payload now contains only the host schema and revision. Game actions do not read that duplicate cache. Every accepted input and actual completed, failed or interrupted outcome remains in HF history. A measured negotiated-placement checkpoint before this change was 28,475,328 bytes; repeated copies of the host ledger used 21,883,757 bytes. The earlier artifact remains in scratch as evidence. Published source pins and the actual forward-calendar month control are recorded in HANDOFF.md. The cold Resume/custody phase passed on the pre-review candidate; the later placement interruption and guest-duty fixes were not replayed through that month. The current claimed-person browser cases passed after host recovery; full-suite CI remains required.

## Current HF4 numerical resolution — 2026-10-28

The current chapter uses HF's public daily fidelity, anchored at the start of the declared November calendar, for every Run step. Good Hands keeps every actor, timestamped input, accepted action, actual host receipt and replay input. HF retains its ordinary owners and physical and semantic boundaries. This is an HF numerical-resolution choice. The game does not implement a second body or need model. Frozen simulation editions keep their original rules and hashes.

The measured fine path was too slow for this month with 84 actors: the actual placement reached the next day's 10:00 checkpoint in roughly 210 seconds, and a separate overnight account remained inside one public Run step after several minutes. These are local candidate measurements, not deployed results. Fine and daily paths need not produce identical floating-point states; each exported current path must replay exactly. The published source uses this daily route. The actual forward-calendar and single cold Resume/custody controls completed. Exact full-suite CI and delivery remain pending. These timings make no responsiveness or fine-path parity claim.

# Good Hands: design

**What done means.** For this first increment: a public, playable build at https://goodhands.adamwhite.work with a playtest export that replays, HF-character playtester runs and source-unread LLM playtester runs recorded verbatim in `docs/playtests/`, polish rounds from them (up to four, or until a fresh persona says they would return tomorrow), and an entry on https://human.adamwhite.work/games/ and the lab dashboard. Adam (owner) accepts it by playing it. Later work goes in the Deferred list below, each item with a date.

## HF 4 port blocked by G4 — 2026-10-28

Historical4.5.1 audit, superseded by the HF4.7 source status above. Its dependency and version statements describe that earlier audit.

What remains: HF must expose reserve-filtered outward condition signs and spoken condition reports through its public run API. Then port the actor bridge, update the lab client, and prove the complete current playtest export on the new exact pin. This is the existing **G4 — Knowledge-bounded readings and forecast output** row, specifically the Good Hands condition-reading need in [hf4-game-needs.md](https://github.com/adam0white/human-framework/blob/v4.5.1/docs/hf4-game-needs.md#good-hands). Review this dependency on **2026-11-17**. Retain the released HF3.0.0 game while blocked; this audit does not deliver an HF4 game or change its save contract.

The npm target checked on 2026-10-28 is **4.5.1**. The managed worktree starts at `2236bf1`, after the public menu PR; the shared checkout's HF2.21.0 pin was stale. The released HF4-compatible shelf artifacts are client0.5.2 and kit0.5.19. They are not adopted independently of the blocked actor port.

| Current use                                                                                                                              | Published HF4.5.1 evidence                                                                                                                                                                                                                                                  | Disposition                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/sim/voices.ts`, `notice`: HF `outwardSigns` chooses fatigue, fear, pain and mood observations during an interview.                  | `inspect` of another person returns `summary.signs: {kind: 'unobserved'}` and an unobserved body. Host body inspection exposes state/readout, without the reserve-filtered signs. `outwardSigns` is not a public export or inspection selection.                            | G4 blocks this part of the interview. Do not substitute hidden body state or copy reserve calculations into the game.                                                                            |
| `src/sim/voices.ts`, `answer`: HF `selfReport` contributes fatigue, pain and fear to the speaker's claim.                                | Self body inspection exposes perceived fatigue/pain, not the spoken reserve-filtered report; self summary has mood, not that report's fear projection. `selfReport` is not a public export or inspection selection. The implementation remains internal to `impression.js`. | G4 must supply the projection. Do not invent a host coefficient.                                                                                                                                 |
| `src/sim/index.ts`, `synthesize`, and `src/sim/references.ts`, `referenceReply`: observer estimates support notes and reference replies. | Other-person summary exposes raw impression cues. A present cue's mean can represent the estimate value; missing-cue priors and computed confidence still need a supported disposition. `person.reported` and `act.witnessed` inputs exist.                                 | Do not claim the whole evidence faculty is missing. Input weighting, custom witnessed-act mappings and no-evidence behavior remain bridge proof work after the condition-reading blocker clears. |

The isolated published-package control uses exact4.5.1 (build `3cc286c9c3bd6b8ef75d227b726147d8ed4e3f829b7f26698a3cc308e9f547ae`). The recipe's work/rest protocol control passes pending-boundary restore, active-work continuation, read-only inspection/preview, distinct body outcomes and exact archive replay. A separate condition-reading probe confirms the unavailable readings on a tired, hurting authored worker. An admitted synthetic `person.glimpsed` input stores the supplied cues but still returns unobserved signs; it does not compute the target’s reserve-filtered signs for the host. These are public-contract controls, not a Good Hands export or deployed journey. Scripts, lockfile and results live beside the worker report at `~/code/.lab-scratch/codex/goodhands-hf4-proof/`.

Design decision: old saves may be refused with a start-fresh message when the port lands. Preserve interview observations and attributed references rather than remove them to fit the new API. Do not copy HF kernels into this host or edit HF in this task.

Public gameplay audit: PR#6 already exposes title navigation, imports, downloads and file continuation in ordinary menus, with one collapsed Debug beside Lab privacy and cast controls on the central shelf. New months prepare the shared cast automatically. Automatic departure from an unpaused source and an actual receiver acknowledgment remain the existing source-transfer contract work in [HANDOFF.md](../HANDOFF.md); the menu and this audit do not prove that outcome. File sessions stay local. No additional query-gated gameplay control was found.

## Current source authority — 2026-10-27

[HANDOFF.md](../HANDOFF.md) records the delivered source chain through `0d560b1`, exact CI, clean app manifest and proof limits. Edition6 is pinned to HF3.0.0/engine2.23.0, client0.4.15 and kit0.5.17; editions1–4 remain frozen on HF2.9.0. Public gameplay controls and automatic same-person carryover supersede historical `?lab=1` descriptions. Cast controls live on the central shelf; small diagnostics live in collapsed Debug beside Lab privacy. The dated design increments below retain their original context.

## One cast (2026-10-23)

New months use edition6 with exact HF2.21.0, client0.4.7 and kit0.5.8. Fresh people persist the HF plain-English narration option. The seven released canonical profiles replace unrelated namesakes; docs/cast-census.md records every old slot. Editions1–4 retain their frozen HF2.9.0 runtime. Edition5 saves refuse with an explicit fresh-start choice.

A fresh continuity chapter preflights and atomically claims all seven expected heads, including absent heads. Unsupported, closed or old heads refuse the whole chapter. Explicit fresh local play remains available. Loaded runs replay their pinned initial people and life results without consulting newer shelf heads. Away-life changes actual arrival availability and adds one-sided public notes; it never grants qualifications, consent or mutual trust.

Current exports retain initial actors, source inputs, claims and owned receipts. Imported files retain file provenance after reload and stay local unless recording linkage is explicitly permitted. Mixed histories require current permission for the full group. Source checkpoints require a natural action boundary and refuse active work; owned death closes its branch. Independent adapter tests, deployed agent journeys and owner play remain separate evidence.

## Approved UI rebuild (2026-10-22)

The owner approved the UI sweep: "All good decisions, proceed." The approved layout and its addenda are the current UI authority. Delivery means the complete rebuilt UI on the public site, replay and legacy-save compatibility retained, one independent Codex review with concrete findings fixed, green CI on the deployed commit, and all acceptance items checked in a browser at 360×690 and 1280×800. Adam accepts the result by playing it.

The top bar holds the date, one information control and the menu. The rent bar sits above the office or city scene. The Bench, Families and Placed sheet holds the current context; inspections and decisions replace that sheet. Candidate notes and conversation transcripts are visible there. Candidate verbs and conversation endings stay at its foot. The ringing phone stays on the scene across tabs and inspections. The title holds resume, restart confirmation and playtest import; the menu holds notes, page chips, pacing, feedback and recording controls. Send word includes a remembered optional name and keeps export available.

Pacing is presentation only. Automatic is the default: held for conversations, calls and the day card; slow for departures and reading with a waiting bench; steady with people waiting; fast with an empty bench. Menu choices Automatic / Slow / Steady / Fast never emit simulation speed inputs. Skip ⏩ names the next event on its second line. Historical speed inputs and earlier placement rules remain replayable. This section supersedes the older interface and pacing descriptions below; simulation rules are unchanged.

## Open-fix sweep (2026-10-23)

Delivery means the open Good Hands ledger routes are checked against the live rebuild, clear remaining fixes and F-340 backstories are deployed with focused tests and exact legacy continuation, one independent Codex review is addressed, CI is green, and live browser checks pass at 360×690 and 1280×800. The route reconciliation and delivery report live in `~/code/.lab-scratch/sweep/`; a separate consolidator updates the shared ledger. Adam accepts the result by playing it.

New months use simulation 4. Simulation 3 is frozen alongside 1 and 2; continuing or importing an earlier month keeps all its prior rules and authored text. Edition 4 deepens existing candidate and household accounts through the existing conversations and outcomes. Those accounts remain attributed claims; they do not certify a person's character. Faith remains background. The explicit deposit route changes the upfront fee to one week's agreed wage (monthly wage divided by four), capped at the total fee. The remaining fee follows the kept trial; replacement does not charge a second deposit. Difficulty, household pressures, HF traits and the existing choices stay intact.

## The idea

Izmir, November. You are **Nermin**, who runs **Good Hands**, a one-room placement agency above a pharmacy in Alsancak. Families phone you when they need a nanny, a cook, a carer for an old father or a driver. Women and men climb your stairs and sit on the bench outside your door, hoping you will place them.

Nobody is quite who they say at interview. The polished talker may not last a week; the quiet one who barely answered may be the best carer in the city. Former employers have their own reasons for what they say. You find out who someone is the way anyone does: by what they say, what others say of them, and what you see them do. Then you vouch for them to a family, and your word goes with them through the door.

Every candidate and every household member is a full HF `Person` (exact pin `@adam0white/human-framework` 2.9.0). Their true character is HF traits (HEXACO: honesty, emotionality, extraversion, agreeableness, conscientiousness, openness), skills and needs. What Nermin knows is her own HF impressions of them (`estimate`, `impressionConfidence`), built only from three kinds of evidence:

- **Says**: their interview answers, generated from `selfReport` and their honesty. A low-honesty candidate tells you what you want to hear; a reserved one undersells herself.
- **Heard**: what references and other people tell you (`hear`, weighted by Nermin's trust in that speaker). A stingy former employer runs down a good worker who asked for her wages.
- **Seen**: what Nermin or a family sees them do (`observeAct`) at a trial morning, on a visit, or in a placement.

The gap between those three and the truth is the game. It is football-management scouting, with people.

## Show, don't count

No bars, no percentages, no stars. Each candidate has a card in Nermin's handwriting: for each quality the game cares about (**patient, honest, reliable, warm, hardworking, discreet**), a short note and where it came from: "patient — _she says so_", "patient — _Mrs Ak says yes, and I believe her_", "patient — _I saw her with the twins_". The source word (says / heard / seen) is the confidence. Contradicting evidence shows as a crossing-out. Skills read as experience in words ("has cooked for a big family", "has never driven in the city"). Money is counted, because Nermin counts it: lira, the rent, the fee.

Truth is revealed only at the end of the month, in the review: each person's true character beside Nermin's notes, and each placement's true story.

## The month

Monday 2 November to Sunday 29 November 2026. The office is open 08:30 to 19:00, Monday to Saturday. Evenings and Sundays pass quickly, but the city keeps living: placed workers are at work, families talk. The clock is continuous with four speeds (slow, walk, trot, gallop). Nothing pauses. The clock drops to slow when something waits for a response (a phone call, a candidate about to give up on the bench, a scene), and the chosen speed returns when it resolves (DL-15).

## The office (the main screen)

A drawn front room: Nermin's desk, the telephone, the window onto the street, and the bench outside the door where candidates wait. Below it, the **Now** line: the one thing that needs a response, with the accent (L20). Below that, three tabs: **Bench** (candidates waiting and those on your books), **Families** (requests and their deadlines), **Placed** (people you have placed and how it seems to be going). A second view, **The city**, is a Canvas map of Izmir's neighbourhoods (Alsancak, Karşıyaka, Bornova, Göztepe, Buca) with each family's house and your placed people as small figures; threads of talk appear on Fridays and Saturdays (see Word of mouth).

## Player verbs (each gets a visible answer, L4)

Every verb costs Nermin's time on the game clock (an interview takes about 30 minutes, a reference call about 15, a visit an hour plus the ferry or the road). Time is the limit, not a daily quota (DL-4).

1. **Interview** a candidate on the bench. A scene: Nermin picks questions one at a time from about six (last family; why you left; a child who will not stop crying at 3 a.m.; an old man who throws his plate; what wage you need; can you start tomorrow). Each answer is in the candidate's words, plus one thing Nermin notices (outward signs: rough hands, a glance at the phone, tired eyes). Three or four questions fit before the candidate expects an answer. The card updates as she listens.
2. **Call a reference**. A scene on the telephone: the former employer speaks in their own voice and bias. Some cannot be reached until later in the day. Some want to talk about something else.
3. **Send for a trial morning** with a family. The family's words come back at noon or by evening, from what they saw (`observeAct`). Costs the candidate a morning and the family's patience.
4. **Place** a candidate with a family. Before confirming, a short sheet shows what Nermin will vouch for and on what evidence (DL-14): she chooses which qualities to vouch for in her own words ("She is patient with children. I have seen it."). Vouching for something only _said_ is allowed; the family remembers what she vouched for. Half the fee is paid on placement; the rest at the end of the trial week if the family keeps her.
5. **Check in** with a placement: phone the family, or visit, or have the worker drop by after work. Each is a scene in their words.
6. **Answer the phone**. Families call with requests, complaints and good news; workers call when something is wrong. Each call is a scene with two to four responses.
7. **Withdraw** a placed worker (bring her back to the bench) or **replace** her.

## Consequences the host owns (each with a verb, L19)

- **The trial week.** At the end of seven days the family keeps or returns the worker, in their words, with the reason as they see it. The second half of the fee follows.
- **Inside the house.** Each day of a placement the host runs a few seeded household moments that test the worker's true traits against the household's pressures (a demanding grandmother tests patience, cash left on a table tests honesty, a late night tests reliability, a child tests warmth, gossip at the door tests discretion). HF records them as the family's `observeAct` impressions of the worker and as the worker's affect (fatigue, frustration, ties). Moments come back to Nermin only through someone's words (a call, a check-in, a confidence), on the game clock, often a day later.
- **Quitting and dismissal.** A worker who is treated badly or underpaid may leave (HF needs and affect decide), and tells Nermin why if she trusts her. A family may dismiss a worker; Nermin can withdraw, replace or speak for her.
- **Your word.** Each family's trust in Nermin as a source (`memory.sourceTrust` for Nermin's id) rises when what she vouched for proves true and falls when it proves false. Workers trust Nermin too: whether she found them a decent house, whether she spoke for them.
- **Money.** The rent (₺5,000) is due every Friday at 17:00. Short rent is a scene with the landlord (Mr Hüsnü downstairs at the pharmacy): pay part, promise, or sell something; two missed rents and the month ends early. Week one bites (L15): opening cash covers one week only if Nermin places someone by Thursday.

## Word of mouth (the ant farm)

The city talks. On Friday afternoon placed workers and candidates meet in Kültürpark; on Saturday families meet at tea, a wedding or a school gate. The host runs HF `converse` between pairs: workers tell each other which houses are hard and whether Nermin can be trusted; families tell each other which agency found them a treasure and which sent them a thief. On the city map the talk shows as threads between figures, as it happens, and its effects arrive later:

- New families phone because a friend recommended you ("Mrs Kaya said you found her a treasure"), or a request goes elsewhere.
- Good candidates come to your bench because a worker you placed well sent them, or avoid a house they have heard about ("Not the Erdems. Everyone knows about the Erdems.").

The player sees the threads and hears what reaches Nermin. The full route of each piece of talk is in the end review and the replay, not on screen (as in Hearsay).

## Naughty edges (L11), implied, not offered as a mode

Nothing tells the player to do any of this. The verbs allow it, and each enters the calculations; none wins outright.

- **Coach** a candidate during the interview ("Tell them you love children."): she says it to the family. They remember, and remember when it proves untrue.
- **Vouch for what you have not seen.** Fast, and usually fine; until it is not.
- **The confidences.** Placed workers trust Nermin and tell her what goes on inside the houses: who comes home at three, whose son is in trouble, who cannot pay. Families sometimes ask, "What do you hear about the Demirs?" Telling earns that family's favour and a fee; if it is traced back, the worker loses her place and the workers stop confiding. Nermin slowly becomes the person who knows everyone's business. The game never names it.
- **Poaching.** A rich family asks Nermin to bring them someone else's nanny, for a finder's fee.
- **The envelope.** A candidate offers money to be sent to the best house.
- **The house you dislike.** Nothing stops Nermin placing a light-fingered worker with the family that refused her fee.

## Faith stays quiet

A candidate asks to step out at midday ("I'll be back shortly"); a carer's family asks whether she can sit with their father at Friday prayer time; a cook will not cook pork, and no household here asks her to. That is all.

## The first ten minutes (L7, L15, L20)

- **First screen** (≤ 40 words, lab kit `introCard`): "You run Good Hands, a small placement agency. The Arslans need a nanny by Tuesday 08:00. Three women are waiting on your bench. Rent is due Friday." One button: Open the office.
- **08:30 Monday 2 November.** The Now line, with the accent: "The Arslans need a nanny by Tuesday 08:00. Three are waiting on your bench." The three are tappable on the bench drawing and in the Bench tab:
  - **Gül**: warm, chatty, experienced, says all the right things. Truth varies by seed, but in the default seed she is not honest; her reference is cagey.
  - **Sevda**: quiet, undersells herself, answers in a few words. In the default seed she is patient and excellent with children.
  - **Pınar**: polished and quick, has worked for "important families". In the default seed she is unreliable.
- **Within 30 s**: the first choice (tap a candidate → interview). **Within 3 minutes**: the first answer that the card records, and the phone rings (a reference calls back, or the Arslans ask how it is going).
- **Within 10 minutes**: one candidate's words contradicted by a reference; one candidate who gives up on the bench because Nermin kept her waiting (shown by posture first: checking the time, standing, picking up her bag); the first placement and its half fee; the day card naming tomorrow's open decision ("Tomorrow 08:00: Sevda's first morning at the Arslans.").
- **Day 2 noon**: the Arslans' first word. **Day 3**: a second family (Mrs Kaya's father needs a carer; he throws his plate). **Day 4**: a placed worker confides something about the house. **Friday**: the rent, and the first Kültürpark talk on the map.

Each seed shuffles who is secretly what among the authored candidates, within each candidate's presentation (a chatty candidate stays chatty), so each month is a different crowd.

## The end of the month

Sunday 29 November: the month review. For each person Nermin met: her notes beside the truth. For each placement: what happened inside the house, day by day, as the host recorded it. The city map with every thread of talk and where it went. Cash, the families who trust her, the workers who trust her. One open question for a next month (L14). A new month is a new seed.

## Determinism, saves and export

One seed; all randomness from a seeded RNG held in state or from hashes of (seed, event). Inputs are logged at the minute they apply. Save in IndexedDB; Continue on the title screen only when a valid save exists, with one line saying where it left off (DL-27). The **Game menu** holds Download this run (seed, input log, state JSON, fingerprint), Import a run, Send this run to the notebook (lab client 0.1.2 with `compact`: seed, inputs, minute, fingerprint) and the All games link (DL-26). `replay(seed, inputs, minute)` reproduces the fingerprint (tested), and a test replays the compacted run (DL-28).

## Phones

The 360×690 CSS px fixture. The Now line, the current scene's choices and the bench stay visible without scrolling (DL-22). Targets at least 44×44 px. One sheet at a time (DL-24). English for every action-critical label and date (DL-20, DL-21); Turkish names, places and the odd word (Hanım, Bey, abla) are flavour, glossed with lab kit `term` where play needs them.

## Lab events

Screens: `title`, `office`, `city`, `scene`, `review`, `menu`. Milestones: `run started`, `first interview`, `first placement`, `first trial verdict`, `first confidence`, `week 1 done`, `week 2 done`, `week 3 done`, `month ended`. These exact strings are also in the HF site's `apps/site/src/lab/games.ts`.

**Round 1 polish (sim).** Interviews remember each question and make wage, experience and personal needs separate conversations; a callback reopens the remaining questions. References give quoted claims one answer at a time, with a visible choice to distrust a speaker; Nermin’s card follows her trust-weighted HF estimate. Every placement opens a two-sides disagreement in its first two days. An intervention records an arrangement and a dated household test of the worker’s actual need, including money, care handover and time off; broken promises move worker trust and preventable quits have a warning. Worker calls, visits, contextual coaching, named waits, moving city figures, commute conversations and traced confidence exposure share the deterministic replay. Day cards and the month question name this run’s live relationships. Policy acceptance now compares retention and worker trust across five seeds; speaking for a worker can cost family trust. HF round 2 is recorded separately and does not establish human enjoyment.

**Rounds 1-4 (2026-10-20).** Round 1, from the fun review, made a placement open a disagreement between worker and family, gave references and interviews specific follow-ups, tested negotiated arrangements on later days, and made waits and day cards name pending relationships. Round 2, from Marta and Kerem, let calls hold and resume interviews and references, gave the bench warning a number-taking response, made vouch choices tappable, and gave both Arslan twins names in the household. Round 3, from Aylin and Josh, made queued calls recognise placements and replacements, gave payments and refusals spoken answers, kept the phone reachable in City, exposed all remaining interview questions and explicit bench/home endings, and supplied quiet office news between decisions. Round 4, from Farah and Lukas, tells the player how much longer a candidate will sit, keeps unanswered questions visible with their callback reason, makes a departure task offer only possible actions, names the target on family and placement controls, lets quiet news yield to a ringing phone, introduces references through a known candidate, and opens the office without showing the title again. Both round-3 personas would return tomorrow, for Sevda's bus and Gül's fair placement; round 4 preserves those threads. The HF cohorts are model evidence; these changes still await a fresh source-unread retest and Adam's play acceptance.

## Owner fixes: phase 2 (2026-10-20)

Delivery means both repair phases are checked, committed, pushed and live, with matching release stamps, passing CI and the report in the owner's scratch intake. Adam accepts the play by playing it; automated and model checks do not establish that acceptance.

New months use simulation 3. Simulations 1 and 2 retain their shipped rules and replay fingerprints, including unversioned notebook exports. Continuing an earlier month keeps its earlier rules; starting a new month enables the new verbs. HF stays pinned to 2.9.0.

**Office time (DL-4, DL-5, DL-13).** A number on the books is a contact, not a person sitting in the office. Interviewing requires the candidate on the bench. Calling a saved contact takes a few office minutes and schedules their journey or next opening appointment. The card and waiting line name who is coming and when. Interview answers advance the clock, so a few questions take about half an hour. Waiting candidates warn before leaving; a saved number lets Nermin call them back, and candidates who leave without a number may return on another day.

**Placement negotiation (DL-14, DL-17).** Proposing a placement opens a conversation before any placement or fee. Nermin can change monthly wage, start and finish times, weekly day off, trial length in working days and agency fee. The worker and the family each answer the same offer in words, using their HF traits, needs and trust. Either may refuse or counter. Both must accept before Nermin confirms. Agreed terms stay on the placement and affect work, rest, the trial deadline and fees. The agreed day off does not count toward the trial. Hidden traits stay hidden; money and agreed times are explicit because the characters know them.

**Household calls (DL-13, DL-17).** Nermin can phone a known adult in a household during office hours, including before she has placed anyone there. She can ask how things are going, hear a complaint, smooth a disagreement or ask about the worker. The selected adult speaks from their own impression, mood, needs and trust. A call takes office time. Existing placement visits remain available; a new household visit verb is deliberately omitted because the phone supplies the missing conversation without duplicating the existing visit.

**Phone stage (DL-15, DL-22, DL-24).** Lab kit 0.2.0 supplies the viewport stage. The state strip shows the day, clock and speed, cash and rent, and who is waiting. The office remains above a single sheet; desktop docks the sheet beside it. Secondary questions and long notes have labelled disclosures. Inspection and conversation keep time moving slowly; the game menu and notebook send dialog may stop it.

## Deferred

- **2026-10-27 — source checkpoint/end offer (upstream review 2026-10-30):** This batch exposes edition6's existing recorded pause and native checkpoint publication at the ordinary menu and month end. Full native state, Persons, RNG, agenda, source clocks and pinned provenance stay in the complete run; bounded projections never replace it. Keep the full download before replacing the browser month. Aylin's `goodhands-agency/1` / `goodhands-agency-calendar/1` passport has a finite Murmur receiver for engine2.23.0, cooking and supported calendar meanings. The offer checks the actual shelf head with public get before showing the route; the receiving game must still admit and claim its actual head. Public attempts retain publication/refusal reports at their replay-checked source prefix, with a32-report cap and no trimming. Publication is not an owned departure, receiver acceptance, delivery acknowledgment or ingestion. Installed public client0.4.15 `PersonaAction`/`PersonaRequest` exposes put/prepare/claim helpers, but no source release/departure acknowledgment or receipt binding a receiving admission/claim to the exact original source run. That producer-consumer acknowledgment and retained source ownership protocol is upstream work, not implemented privately here. Unknown receiver admission and live ownership remain open. Pass recognizes current engine2.23.0 only for the Zeynep agency route, with a daytime boundary and its original-return guards; Hülya's named adapter does not admit this current engine. Voice's Selin route requires an actually completed continuing guest and original spring-calendar binding; fresh local Selin is not that return. Nermin/Hatice/Derya have same-host agency maps, not proved foreign receivers. No other destination is offered. File mode stays memory-only and nonpublishing, retaining the whole selected original file and existing caps/cancellation. Owner/player feel and readiness remain due2026-11-03; synthetic controls are not a human source journey.

- **Owner/player input, 2026-11-03:** Assess repeated withdrawal/replacement in a fresh source-unread playtest. HF round 2 produced 83–141 placement records for completionists and two 60-minute caps; it does not establish human return intent.
- **Owner/player input, 2026-11-03:** Retest round 4 with a fresh source-unread player, including phone-size callback reasons and named household controls; Adam's play acceptance remains outstanding.
- **Delivered source, GDI106–108 (`ce49e6d`):** Cem is retired; current cards use neutral applicant wording. The old breakfast anecdote is absent. The display names the actual placement agreement date/time, who spoke or observed, and Nermin’s uncertain reading. It does not invent a meal or witnessed work. Raw identity/history and worker/family disagreement remain unchanged. Exact successful CI and current ancestry are recorded with this reconciliation; Adam’s reading acceptance remains2026-11-03.
- **Delivered finite receiver, GDI703 (`ce49e6d`):** Only the actual Murmur154caef CLI Aylin v2 checkpoint and its eight selected episodes are admitted by this history route on HF3.0. All192 omitted episodes and full raw source remain in the original archive; receiving full/compact runs pin the source passport, selection/map and raw digest. Complete inherited initial-claim comparison was corrected before delivery. Nonempty beliefs/duties/debt and unsupported sources remain unproved/refused. Live ownership, CAS, receipt/ACK and a human source journey are distinct and unproved. Source-owner contract review remains2026-10-30; Danyal’s Coast bridge stays excluded.
- **Delivered host controls (`ce49e6d`, `f101cc7`, `7877731`, `e76e4ee`):** Card reading uses existing inspection slowdown even with Fast selected; the menu pauses. Released stage observation, public pacing/page choices, next-event Skip and Menu sizing are delivered. The later file unit fixed Automatic wrapping. Keep shared stage/quiet Feedback artifacts and exact pins. Earlier title/menu checks and synthetic controls are bounded engineering evidence, not whole-layout or player acceptance. Adam’s feel/readiness remains2026-11-03.


## Build measurement

**Latest (round 4, `bba1a43`):** `npm run check` passes 109 tests, including the built 360×690 browser acceptance and full and compacted replays. Round 3's policy months (simulation `5217b6d`) took 2.22–8.86 seconds each while other local checks ran; HF cohorts r2 to r5 are in `playtests/`. The paragraph below is the first build's measurement.

Measured on this Apple Silicon Mac on 20 October 2026 with Node 26.12.0 and HF 2.9.0, simulation commit `38d17ce`: five seeds × three policies completed all 15 headless months in 0.43–1.09 seconds each (`npm run measure -- 5`). Careful retained more workers than reckless in four of five seeds and earned more family trust in three; cunning earned the most cash in three. `npm run check` passed 38 tests, including two-seed ten-day replay, replacement fees, delayed evidence and ordinary word-of-mouth consequences; independent full-month replays also matched. The nine HF-character sessions are recorded in [round 1](playtests/2026-10-20-hf-r1.md): all three completionists finished the month; five other sessions ended for agendas and one quit. The adapter reported 22 withdrawn-control warnings for UI inspection. These model runs do not establish human enjoyment or acceptance.

## Owner fixes: phase 1 (2026-10-20)

The owner run's three Cem–Demir trials were wage refusals: Cem asked ₺9,000 and the Demirs offered ₺8,500. The old send sheet closed without showing that limit beforehand. Known wage refusals now remain beside the disabled send action (DL-4, DL-13, DL-14); an unknown refusal is spoken in a scene and recorded. The accepted Sevda–Kaya trial was pending Wednesday noon, after the export ended at 09:32. Trial status now names the family and full due date. Noon delivers the report; it does not require another trial input.

A called reference is unavailable with an adjacent explanation. These former-employer accounts concern fixed past work; nothing in this increment gives that speaker a new observation, so a second call adds no new account. Ending the first call warns the player to ask remaining questions before hanging up. New requests can still be investigated through interviews and trials. The simulation rejects repeated calls, so they cannot duplicate book entries. Open requests alone occupy Families; filled work is in Placed, and Lost is collapsed with one reason (DL-5).

Simulation 1 and its authored modules are frozen in `src/sim/v1/`. Unmarked old exports use it, including full-state comparisons. New games use simulation 2 and include that version in full and compact exports. The envelope remains version 1; the simulation number selects behavior. Do not modify a frozen simulation to change new play.

## Clock and help presentation (2026-10-21)

The live UI offers Slow, Walk, Trot and Gallop clock speeds. Conversations, calls, day cards and urgent waiting hold the clock. Game menu and notebook dialogs also hold time. One guarded Until next event action uses the existing wait operation, which stops for intervening arrivals and decisions. Historical saved speed values and speed inputs retain their original simulation and replay behavior. No simulation version changes. Setting words uses one native information popover. The agency tally is always derived from recorded outcomes and appears only behind See tally at month end; there is no advance preference. Adam accepts feel by playing.

## One cast calendar and replay transport (2026-10-23)

Edition6 retains two dedicated guests after the ordinary loop. Zeynep retains only the supported cold-food skill and recurring home promise. Her actual HF trial outcome can differ by carried skill; it does not become general cooking knowledge. Selin's after-work phone call conveys Nermin's actual answer about the limits of the agency enquiry. It grants no placement, medical knowledge or father consent. Halil remains distinct from Taş's porter.

Current revision2 Selin admissions use the HF2.21.0 wrapper and a pinned Voice spring calendar. Existing HF agenda APIs own retiming, exemptions, make-ups, decisions and completion. Good Hands supplies declared fictional clock dates and supported action/reference mappings. Unpaid duties remain unpaid; actual paid records retain their kept receipts until return. No faith score or travel gate exists. This marker changes only the new admitted path; historical editions1–4 retain their frozen behavior.

The replay owns its initial admitted Person, source envelope, accepted head and bounded oneCast rows. It validates a load before restoring that head. Return wire metadata is recomputed from the pinned replay, including original source binding and the declared calendar clock. Explicit forks preserve their accepted ancestry in bounded replay metadata. Browser recording permission is separate from continuity consent. Pin selection, opaque epoch acknowledgement, synchronous bootstrap denial and generation guards keep historical uploads tied to the chosen run and identity. Source worlds stay local; the shelf holds only approved projection data and bounded provenance.
