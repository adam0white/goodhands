# Good Hands — adversarial fun review

20 October 2026 · Codex · seed 1 · commit `01dc3c8c65bde6d25980b51e2f6f710aa6c4bc17` · Node v26.12.0

## Verdict

**Not consistently fun yet. The premise interests me more than the play sustains me.** I enjoyed distrusting a reference, backing Sevda anyway, and accepting Gül’s envelope. I did not enjoy processing the next nearly identical report. I would probably leave during Monday’s empty afternoon. If I stayed for Tuesday’s payoff, the failed attempt to hear Sevda’s side would be my second exit.

The strongest hook is: **I vouched for this person. Was I right about her, and will she think I did right by her?** The game keeps translating that question into six qualities and a report to acknowledge. It needs one relationship that changes through my decisions before it needs more candidates or a larger month.

## What I actually did

Read `docs/design.md` and the lab lessons first, as requested. Played interactively with `node scripts/drive.ts`, starting with its no-argument command list. Completed Monday 2 November through Friday 6 November, then stopped at Saturday 7 November, 02:00 after an extra wait. Quit the driver normally. No process was killed. No browser play or visual usability test was performed.

The design reveals the default cast’s hidden profiles. This was therefore **not a blind scouting test**. Apart from the driver and the public `Input` contract, I deferred my own simulation-code reading until after the first two complete days. Two independent read-only reviewers checked social-system implementation and lab-lesson risks. Their findings were checked against source; they did not play this run. This is one model reviewer’s experience, not owner acceptance or human enjoyment evidence (L16).

| When            | Choice and reason                                                                                                                                                                                                             | What came back                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mon 08:30–09:19 | Asked Sevda about patience, warmth and reliability. Promised the Arslans an answer today. Called Mrs Uslu.                                                                                                                    | Sevda sounded patient but unsure elsewhere. Mrs Uslu praised sitting beside someone until he calmed down, then delivered five negative accounts, including a wage dispute. |
| Mon 09:22–10:28 | Compared Pınar and Gül. Coached Pınar after seeing the option. Called Pınar’s reference.                                                                                                                                      | Pınar admitted needing flexibility. Her reference praised most other qualities. Gül gave the same first patience answer as Sevda, with a chatty prefix.                    |
| Mon 10:28       | Placed Sevda with the Arslans; vouched only for patience. Chose her for the household’s stated need despite the reference’s hostility.                                                                                        | At 10:43 cash rose from ₺3,000 to ₺7,500. First rent was already covered.                                                                                                  |
| Mon 10:43–19:00 | Phoned the placement, waited, then called Gül’s reference once reachable. Kept both other candidates on the books rather than placing them without a request.                                                                 | “It is too early to say.” Gül and Pınar left the bench but remained available on the books. Large stretches had no new relationship decision.                              |
| Tue noon        | Answered the first complaint. Spoke for Sevda. Asked the worker to drop by to hear her account.                                                                                                                               | The family supposedly agreed to an earlier finish. The drop-by returned **the Arslans speaking the same complaint**, not Sevda.                                            |
| Tue afternoon   | Interviewed Fatma for future work. Visited Sevda’s household to check the patience I had vouched for.                                                                                                                         | The visit reported gentle answers to repeated questions and added a `seen` patience note. This was the best scouting payoff.                                               |
| Tue 15:30       | Took Gül’s unprompted ₺1,200 envelope.                                                                                                                                                                                        | Cash rose to ₺8,700. She expected a suitable house. This created an obligation with an identifiable person.                                                                |
| Wed             | Accepted the Kayas’ carer request, listened to another Arslan report, interviewed driver Cem for future work.                                                                                                                 | No free carer yet. Another familiar family report. Cem was described as picking up “her” bag.                                                                              |
| Thu             | Spoke for Sevda again. Interviewed Ayla and sent her for a trial with the Kayas. Accepted the Demirs’ request. Refunded Gül when she demanded her money back. Placed Pınar with the Demirs, vouching for discretion and work. | The trial extended the Kayas’ deadline to Friday evening. Gül’s return was a real consequence of my action. Pınar brought ₺4,250.                                          |
| Fri             | Accepted the Aks’ request. Interviewed Emine. Heard Ayla’s successful trial result and placed her with the Kayas, vouching for patience. Waited through city talk and rent.                                                   | Three placements. Rent paid automatically. ₺11,250 left. “Workers met for tea in Kültürpark.” The day card still pointed to Sevda’s supposedly upcoming morning.           |

I did not reach a seven-day verdict, a confidence, poaching, or the month review. Claims about those below are source findings, not witnessed outcomes. I did not run build/test commands; this review changed no implementation.

## Where a first-time player quits

**First likely exit: Monday after the placement and the first check-in.** I had done the interesting thing by 10:43. My next action bought “too early.” The task then suggested checking in or meeting someone on the bench. There was no clear approaching event to anticipate. More interviews meant more records for jobs that did not exist yet. L7 applies even though gallop shortens elapsed time: a faster clock cannot supply a reason to care.

The bench warning initially looked like pressure. Interviewing everyone once turned their departure into “her number is on your books.” That is useful forgiveness, but in my run it softened the opening’s apparent tradeoff. The rent also stopped feeling urgent before Monday lunch. Week one did not bite for this attentive policy. I did not test inattentive play, so I cannot claim the economy has no failure pressure (L15).

**Second likely exit: Tuesday after asking Sevda to drop by.** I had a specific question: did the grandmother demand too much, or did Sevda leave the work unfinished? The response gave me the family’s words again. That told me the apparent access to different people was false. It is worse than ordinary repetition because I deliberately chose a different source.

**Later exit: the repeated daily call.** “Grandmother Saadet corrects every little thing” recurs before interchangeable good/bad act sentences. By Friday I was learning the template faster than the household. Calls added administration without enough new choices.

## What is a form instead of a relationship?

**The interview is a trait questionnaire.** Every role has six slots. The first answer reveals wage, commute and experience together. The same questions remain available, and the implementation permits six asks per question rather than the design’s three or four questions per interview (`src/sim/index.ts:212–230, 568–583`). There is no follow-up about what this particular person just said. I could ask about patience again; I could not ask Sevda what happened over the wages Mrs Uslu mentioned.

**The reference is a completed assessment sheet read aloud.** One call loops over all six qualities and updates the card before I can respond. Its only response is thanks (`index.ts:700–725`). The wage dispute is the start of a relationship story. The game immediately turns it into another negative quality and moves on.

**The check-in is a report receipt.** Phone, visit and worker drop-by all open a scene with the family as speaker. A visit additionally creates an observed moment; the drop-by does not create a worker conversation (`index.ts:830–843`). I reproduced this distinction’s failure in play.

**The browser may hide the interesting part still further.** Source inspection shows it displays the most recent speech and folds previous lines into “Earlier words” (`src/ui/app.ts:343–376`). On the first interview answer, wage/commute/experience is the last speech; on a reference, the sixth trait is last. The terminal showed the full exchange. This is a code-supported concern, not an observed browser result.

The people have promising introductions: Sevda’s mended cuff, Ayla lowering the radio, Emine’s jam. Those details did not become something I could respond to. Hearsay’s failure is present: **conversations become a form before they become relationships.**

## Is the scouting gap felt?

**Partly. It is more than a label, but less than the central game promised.**

I felt it when Mrs Uslu’s apparent hostility made me distrust her assessment, and when visiting later supported the patience I had backed. `says`, `heard`, `seen` and crossed-out notes made that change legible. Keep that.

But I could not investigate the disagreement in conversation. Much of the uncertainty became a choice about which assessment to accept. The simulation also compromises the intended learning:

- `addNote` calls trust-weighted `hear` and `estimate`, but does not use the returned estimate for the displayed judgment. Its yes/maybe/no comes from the incoming claim. Crossing-out follows source rank, not learned speaker credibility (`index.ts:179–209`). Distrusting a reference does not visibly protect the card as the design suggests.
- Household reports map each stored act’s actual success directly to a positive or negative claim. The family speaker’s honesty or interests do not distort it (`index.ts:1178–1200`). After placement, testimony is much closer to a truthful results feed than the opening promises.
- Visits create another household test and then report it as seen (`index.ts:831–834`). This produces useful evidence, but no scene in which I watch the act or choose what to inspect.

The gap works best at the level of **a specific contradiction with someone to question**. It works poorly as a growing stack of categorical notes. Do not add more hidden traits. Make existing disagreement actionable.

## Word of mouth: ant farm or log?

**A log in my headless experience. Source shows fixed figure positions and accumulating connections. The simulation underneath is real.**

Friday gave me one sentence about workers meeting. The driver does not expose city figures or threads, so it cannot establish the browser’s felt effect. Source inspection does establish the current limits:

- Friday and Saturday execute batches of paired HF `converse` calls. Claims have recorded routes and can change later arrivals and refusals (`index.ts:1431–1511, 232–275`). This is not merely decorative random text.
- Every visible candidate and worker occupies a small central grid, regardless of workplace. Every worker/candidate has mood `easy` (`index.ts:992–1000`).
- The map draws accumulated dashed connections between current coordinates. It has no travel or stepwise transfer of a message. The city text lists who spoke to whom (`src/ui/map.ts:89–121`; `app.ts:392–398`).

The owner’s pleasure is watching many agents continue something he started. Here I start a placement, but its movement through the city is mostly withheld until a later result. Hiding a rumour’s exact content can preserve uncertainty. Hiding nearly all visible activity removes the pleasure. Show people leaving houses, meeting and separating; let the first resulting arrival refer to a person I recognise. Do not reveal hidden truth to accomplish this.

## Is the naughty edge discoverable and slightly rewarding?

**Yes. The envelope is the strongest complete sequence I encountered.** It arrived naturally, paid immediately, and Gül returned because I had accepted it. Refunding her was my choice. That satisfies much of L11 and L13. Preserve the lack of a moral score or religious lecture. Faith never intruded in this run; there is no reason to make it more prominent.

Coaching was easy to discover after one answer, but “Coach her” advertises a special action. The line about saying she loves children is especially generic for cooks, carers and drivers. It writes a warmth promise attributed to Nermin; I did not witness a placement advantage caused by it. Code shows normal placement does not require persuasion or use coaching to unlock acceptance (`index.ts:728–802`). The main difference is an additional promise that can later affect trust. That gives coaching liability more clearly than a tempting immediate benefit.

Other edges exist in source: selling a confidence earns ₺1,800 and favour; poaching can earn ₺6,000 (`index.ts:1617–1705`). I did not play either. Confidence exposure is a seeded 70% roll scheduled one day later, followed by broad trust loss, rather than discovery through the simulated conversation route (`index.ts:1635–1636, 1713–1733`). That is a consequential gamble, but it cannot deliver the full pleasure of seeing a secret escape through particular people.

## The one change most likely to bring me back tomorrow

**Make the first placement open a playable disagreement between the worker and the household on day two.**

Before placement, let Sevda state one need in her own words. After the first morning, let her and the family describe the same incident differently. Give me a concrete act: negotiate the finish time, make a promise, arrange a visit, or withdraw her. End the day on the scheduled response to what I actually chose.

For example, as a proposed scene rather than a claim about the build: Sevda says she must catch the 18:10 bus. Saadet says the kitchen is unfinished. I promise to speak to Mrs Arslan. Tomorrow’s question is whether Mrs Arslan honours the arrangement, and whether Sevda trusts my promise. That is a reason to reopen the game. “Tomorrow: interview someone” is work waiting for me.

## Top eight changes, ranked

| Rank  | Change                                                                                            | Why it earns its place / evidence of success                                                                                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Build the day-two worker/family disagreement above, including a distinct worker conversation.** | Converts a placement into a relationship. A fresh player should name a person and an unresolved decision when asked why they would return. L13, L14, L19.                                                                                                                                                                                                                        |
| **2** | **Let me pursue a contradiction, and make source credibility affect Nermin’s synthesis.**         | Ask Mrs Uslu about wages; ask Sevda about that accusation; choose a relevant visit. Keep each source’s actual claim alongside Nermin’s changing read. Success means a player can explain why they trust one speaker rather than merely preferring `seen` to `heard`.                                                                                                             |
| **3** | **Show the first visible chain of autonomous social consequences before Friday.**                 | A worker leaves the house after work, talks to someone, and a recognisable candidate or request arrives because of it. Give figures meaningful locations and animate transfers over time. Later multiply those chains. Success is a player watching activity they caused without needing to read a route audit.                                                                  |
| **4** | **Replace repeated trait polling with short conversations that remember the previous answer.**    | Stop offering answered questions as fresh actions. Give each opening candidate one personal follow-up, boundary or refusal. Put the consequential answer in the browser’s visible exchange. Success is remembering what Sevda wants, not how many qualities were checked.                                                                                                        |
| **5** | **Make quiet time a named wait for the next meaningful event.**                                   | Offer “Wait for the Arslans’ first-morning call,” stop at new decisions, and avoid suggesting a check-in when there can be no new answer. Preserve ordinary free play between events. Success is no purposeless Monday afternoon and no need to spam check-ins. L7, L20.                                                                                                         |
| **6** | **Make intervention alter an ongoing arrangement and show the response from both sides.**         | “Earlier finish” currently adds autonomy and worker trust but stores no new hours; repeated support has no explicit negotiated cost (`index.ts:608–615`). Let families agree, refuse or ask for something, and let tomorrow test the deal. Also turn “Offer to find a replacement” into an actual next action; its current generic response just closes the scene. L4, L13, L19. |
| **7** | **Give coaching a contextual short-term advantage, and make secrets travel through people.**      | Keep the envelope. Replace the universal coaching line with a tempting reply to a concrete concern, with a visible acceptance benefit and a later remembered promise. Let betrayal spread along the existing social routes instead of using only a delayed exposure roll. Success means a player chooses the edge because it helps now, then recognises the consequence. L11.    |
| **8** | **Make the day card tell the truth about my unresolved choices.**                                 | Mine repeated Sevda’s upcoming morning on Tuesday, Wednesday, Thursday and Friday. The code selects the first trial-week placement, not an actual upcoming first morning (`index.ts:395–405`). Prefer the pending trial result, envelope promise, arranged conversation or next negotiation. Success is one accurate, specific question that the next session answers. L3, L14.  |

Do not increase rent merely to force engagement. My first fee removed financial tension early, but repeated forms under tighter deadlines would still be repeated forms. First make the relationship worth managing; then check attentive and inattentive week-one outcomes.

## Implementation cautions from the independent checks

These are source findings, not separately reproduced bugs in this run:

- Support selects the first historical placement matching the scene’s family or candidate. After a replacement, it can act on the previous worker (`index.ts:609`). Bind the response to the actual placement before making more story depend on it.
- Dismissal/quitting changes status before the response scene appears. “Support the worker” cannot prevent the event already decided (`index.ts:1156–1175`). Some consequences should remain final; preventable problems need a prior call with an intervention.
- The month-end question is a constant abstract sentence (`index.ts:382`). I did not reach it. Close this run’s relationship threads, then pose a specific question about another approach the player wants to try. The next month resets the seed and cast profiles; a continuing unresolved relationship would require actual continuity.

The design already knows the right promise. The missing piece is not more psychological machinery. It is letting me talk to the person whose life I changed, make a specific promise, and be present when it matters.
