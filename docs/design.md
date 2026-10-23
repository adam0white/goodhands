# Good Hands: design

**What done means.** For this first increment: a public, playable build at https://goodhands.adamwhite.work with a playtest export that replays, HF-character playtester runs and source-unread LLM playtester runs recorded verbatim in `docs/playtests/`, polish rounds from them (up to four, or until a fresh persona says they would return tomorrow), and an entry on https://human.adamwhite.work/games/ and the lab dashboard. Adam (owner) accepts it by playing it. Later work goes in the Deferred list below, each item with a date.

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

No bars, no percentages, no stars. Each candidate has a card in Nermin's handwriting: for each quality the game cares about (**patient, honest, reliable, warm, hardworking, discreet**), a short note and where it came from: "patient — *she says so*", "patient — *Mrs Ak says yes, and I believe her*", "patient — *I saw her with the twins*". The source word (says / heard / seen) is the confidence. Contradicting evidence shows as a crossing-out. Skills read as experience in words ("has cooked for a big family", "has never driven in the city"). Money is counted, because Nermin counts it: lira, the rent, the fee.

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
4. **Place** a candidate with a family. Before confirming, a short sheet shows what Nermin will vouch for and on what evidence (DL-14): she chooses which qualities to vouch for in her own words ("She is patient with children. I have seen it."). Vouching for something only *said* is allowed; the family remembers what she vouched for. Half the fee is paid on placement; the rest at the end of the trial week if the family keeps her.
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

- **2026-10-21:** Assess repeated withdrawal/replacement in a fresh source-unread playtest. HF round 2 produced 83–141 placement records for completionists and two 60-minute caps; it does not establish human return intent.
- **2026-10-27:** Retest round 4 with a fresh source-unread player, including phone-size callback reasons and named household controls; Adam's play acceptance remains outstanding.
- **2026-10-27:** Review the remaining round-3 observations: gendered candidate-card copy for Cem, breakfast wording after an afternoon placement, and trait/source shorthand that needs the full card to explain Nermin's judgment. Preserve the quoted evidence and the worker/family disagreement.

## Build measurement

**Latest (round 4, `bba1a43`):** `npm run check` passes 109 tests, including the built 360×690 browser acceptance and full and compacted replays. Round 3's policy months (simulation `5217b6d`) took 2.22–8.86 seconds each while other local checks ran; HF cohorts r2 to r5 are in `playtests/`. The paragraph below is the first build's measurement.

Measured on this Apple Silicon Mac on 20 October 2026 with Node 26.12.0 and HF 2.9.0, simulation commit `38d17ce`: five seeds × three policies completed all 15 headless months in 0.43–1.09 seconds each (`npm run measure -- 5`). Careful retained more workers than reckless in four of five seeds and earned more family trust in three; cunning earned the most cash in three. `npm run check` passed 38 tests, including two-seed ten-day replay, replacement fees, delayed evidence and ordinary word-of-mouth consequences; independent full-month replays also matched. The nine HF-character sessions are recorded in [round 1](playtests/2026-10-20-hf-r1.md): all three completionists finished the month; five other sessions ended for agendas and one quit. The adapter reported 22 withdrawn-control warnings for UI inspection. These model runs do not establish human enjoyment or acceptance.

## Owner fixes: phase 1 (2026-10-20)

The owner run's three Cem–Demir trials were wage refusals: Cem asked ₺9,000 and the Demirs offered ₺8,500. The old send sheet closed without showing that limit beforehand. Known wage refusals now remain beside the disabled send action (DL-4, DL-13, DL-14); an unknown refusal is spoken in a scene and recorded. The accepted Sevda–Kaya trial was pending Wednesday noon, after the export ended at 09:32. Trial status now names the family and full due date. Noon delivers the report; it does not require another trial input.

A called reference is unavailable with an adjacent explanation. These former-employer accounts concern fixed past work; nothing in this increment gives that speaker a new observation, so a second call adds no new account. Ending the first call warns the player to ask remaining questions before hanging up. New requests can still be investigated through interviews and trials. The simulation rejects repeated calls, so they cannot duplicate book entries. Open requests alone occupy Families; filled work is in Placed, and Lost is collapsed with one reason (DL-5).

Simulation 1 and its authored modules are frozen in `src/sim/v1/`. Unmarked old exports use it, including full-state comparisons. New games use simulation 2 and include that version in full and compact exports. The envelope remains version 1; the simulation number selects behavior. Do not modify a frozen simulation to change new play.

## Clock and help presentation (2026-10-21)

The live UI offers Slow, Walk, Trot and Gallop clock speeds. Conversations, calls, day cards and urgent waiting hold the clock. Game menu and notebook dialogs also hold time. One guarded Until next event action uses the existing wait operation, which stops for intervening arrivals and decisions. Historical saved speed values and speed inputs retain their original simulation and replay behavior. No simulation version changes. Setting words uses one native information popover. The agency tally is always derived from recorded outcomes and appears only behind See tally at month end; there is no advance preference. Adam accepts feel by playing.
