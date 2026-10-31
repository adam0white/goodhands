# Changelog

## Unreleased

- Make the task deadline readable on narrow screens. Clarify evidence, fees, trial obligations and the next available action. Vary existing interview and family wording.
- Each fee ledger now records whether the rest of the fee actually reached the cash box (`received`), and each stored account records the weight, trust and whether it visibly changed the estimate. A missing `received` is never filled in from the older allocation flag. The ledger also records `keptReported` when a kept trial verdict call is answered. It marks that the family's fee is finished and no new fee arises, whether or not any money moved; it is not a cash receipt. Neither field is ever inferred from the allocation flag, a placement's status, timing or the fee formula. A replacement placed while an earlier ended trial's verdict call is still waiting shows both possibilities from each placement's own public terms, including when the new placement has no agency fee (it then says no new fee is due and keeps the earlier amount).
- These wording and record changes can change current-run fingerprints. A strict comparison decides each file, so an untouched early prefix may still match. Older current journals and exports can be refused with the existing start-fresh message. Keep the original file and start a new month. Loading a refused file does not convert it to the new wording.
- Historical simulation code and its pinned fingerprints stay unchanged. Rent, deposits, negotiation limits, trust updates and trial rules stay unchanged.
- The City view now uses the existing card-reading slowdown when someone is waiting. A kept number's card shows the callback time the worker asked for. Each former employer, each worker's reply to a disputed reference and each family's need use one of two equivalent wordings of the same claim. Hülya's invitation no longer mentions a baking job that nobody has offered. The Open the office button says it is opening at once, and works again if the start fails.

Source review, exact-commit CI, deployment and live verification remain required.
