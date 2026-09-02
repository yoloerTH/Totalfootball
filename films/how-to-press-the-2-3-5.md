# How To Press The 2-3-5

**Studio id `ivdksy9k98nol`** on the films account · 53 phases · hold 0 / move
1500 · full-vertical · night · channels grid · follow · trionda.
Source: `scripts/build-press-235.mjs` → `content/systems/how-to-press-the-2-3-5.json`.

The sequel to *The 2-3-5 Build-Up*, from the other side of the ball. Same board,
same two teams, the question the last film leaves a coach holding: **so how do
you stop it?**

## The spine

A 2-3-5 gives the builder three men on the ball (both centre-backs and the
keeper), three in the middle and five pinned high. A 4-4-2 pressing it is two
against three at the top **or** four against five at the back, and there is no
arrangement of ten outfielders that is even at both ends. So the film does not
look for one.

> You cannot be even everywhere. You choose where to be short, and you make
> that place useless to them.

The answer it teaches is the **screen**, not the chase: a front two stood eight
metres apart who never run at a centre-back, and who exist to delete exactly two
passes — centre-back to centre-back, and centre-back to the pivot. Everything
the 2-3-5 does to turn goes through one of those two. Kill them and the only
ball left is the one we have rehearsed.

## The chapters

| | Phases | What it does |
|---|---|---|
| The Shape You Have To Press | 2–9 | Their three layers, then the two arithmetic problems: 2 v 3 and 4 v 5. |
| Why Chasing Fails | 10–20 | The obvious press, run honestly, conceding in six passes. Nobody in it is wrong on his own. |
| Stand Still And Screen | 21–26 | The front two come together. Two passes deleted, one door left open. |
| The Door You Left Open | 27–36 | The trap springs on the pass we allowed. Ball won 31m from goal, three passes to a goal. |
| If They Do Not Take It | 37–46 | Three branches: they go back (we go with them), the pivot drops (we get the spare man), they break the line (drop, do not step). |
| Rest Defence | 47–49 | The half nobody films: 4 v 5 behind the press, the far winger's tuck making it 5 v 5, the keeper 44m up. |
| What It Costs | 50–53 | The switch you cannot cover, and a screen that never rests. |

## Why there is a generator and a check for a studio film

`films/README.md` §9 says not to hand-write film documents, and that is right —
but a film is not arbitrary JSON. It is one shape and fifty deltas on it, and
that is writable as long as the deltas are the source. `build-press-235.mjs`
holds the shape once and each act says only what moved, so nothing is repeated
and nothing can drift.

`scripts/check-film.mjs` is generic over any system document. It collects every
fault and prints the corrected value with each one:

- roster blinking (a token that leaves and returns fades out and pops in),
- separation, with a 4.5m floor and **a cue as the declaration of a duel** —
  which is also why cues in the generator stick until they are cleared,
- bands and arrows drawn through somebody who is not on the phase,
- dead phases (identical to the one before: holds twice, moves zero),
- ball jumps big enough to be a kick the length of the pitch,
- and **every number on screen**, recomputed from that phase's own tokens.

That last one is the point. In the studio your eyes check the spacing; nothing
checks that "24 M AWAY" was still true after you dragged somebody two phases
earlier. Twelve numbers go on the grass in this film and all twelve are computed
from the positions and re-derived by the checker. A number on screen with no
claim behind it is itself a fault.

```
node scripts/build-press-235.mjs
node scripts/check-film.mjs content/systems/how-to-press-the-2-3-5.json --why
```

## Open, for the studio pass

- The screen is drawn as a band through nine, ten and their six (`bd-screen`,
  `kind: zone`). If it reads badly on the phone shape, delete it — the pose
  carries the idea without it.
- No per-phase `shot` anywhere. The automatic follow camera has every phase;
  drag a frame on any that lose a man off the top of the vertical crop.
- Phases 17–19 (the concession) and 33–35 (the counter) are the two runs with
  real ball travel. They are the likeliest to want a slower `move`.
- 53 × 1500ms is about 80 seconds before any per-phase hold.
