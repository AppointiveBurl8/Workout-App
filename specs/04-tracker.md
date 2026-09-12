# Tracker

Runs a workout (a saved template, or an on-the-fly Builder list) against one of
three timer modes. `src/pages/StartWorkout.jsx` lets the user confirm/tweak the
session's config before it starts; `src/pages/Tracker.jsx` renders the running
session.

## Session state

Active-session state (which mode, current exercise index, current phase, elapsed/
remaining time, paused/started flags, round count, the confirmed config for this
session) lives in `src/lib/activeSessionStore.jsx` - a React context mounted in
`App.jsx` above the router, not inside the Tracker route. That's what lets it
survive navigating to Library/Builder/Log and back: the provider component never
unmounts on a tab switch, only the page underneath it does.

The state is also mirrored to IndexedDB (`db.settings`, key `activeSession`) every
few seconds while a session is active, and hydrated back on app start, so a hard
reload or the container restarting doesn't lose an in-progress workout either. A
session that has ended (or was never started) doesn't get a stored copy.

The stored copy carries a `shape` version (`SESSION_SHAPE`). A mirrored session
from a build whose state was shaped differently is dropped on hydrate rather than
half-restored - a workout in progress across a deploy is worth less than a
Tracker that renders.

The phase-machine logic itself (which phase comes next, when a round/exercise
completes) is pure and framework-free, in `src/lib/sessionEngine.js`, driven by the
store's reducer rather than a per-component `useReducer` - which is what lets it
survive the underlying Tracker page unmounting and remounting.

## Timer modes

### Open Work

A whole-session timer with no per-movement stepping: a running elapsed clock
against a hard session-target stop, with manual "End Set / Start Rest" and a
reference list of movements grouped by `sideMode` (`bilateral`/`blocked`/
`alternating`). No Next/Previous - there's nothing to step through.

Open Work is also the only mode with a Sets × Reps plan
(`openWorkConfig.setsReps` - see `specs/01-data-model.md`): a single, workout-wide
choice of Straight/Top-Back-off/Ramp/Pyramid/Reverse Pyramid/Custom, configured on
the Edit Template page and the Start Workout screen. Interval and Pails/Rails
don't get this section at all - their rounds/work/rest structure already plays
the role a sets/reps scheme would, so showing one there would be redundant. It's
never shown per-exercise.

The plan also tracks live during the running session: "Set _n_ of _total_ /
Target: _x_ reps" is shown under the timer, derived from `state.setsCompleted`
against `getRepsSequence(openWorkConfig.setsReps)` - no separate state to keep in
sync. It advances the moment "End Set / Start Rest" is tapped, since that's the
same `setsCompleted` count the existing "Sets" chip already reads (so manually
adjusting that chip also moves the current-set display). Once `setsCompleted`
exceeds the plan's total, the display holds on the last set's target rather than
indexing out of range.

### Interval

Work then Rest, once per turn at an exercise. `rounds` is a session-level circuit
count, not something the phase machine repeats - see "Rounds are circuits" below.

Because an Interval exercise always ends on its configured Rest, that Rest *is*
the gap between movements: moving to the next exercise doesn't also show the
between-exercise countdown, which would just be resting twice over. A side change
still gets one - that's a physical reposition, not a rest.

When `intervalConfig.sideMode` is `'unilateral'`, the side is a session-level
pass, not a phase inside the exercise - see "Unilateral sides" below.
`'bilateral'` has no side at all.

During the Rest phase the timer also names what the rest is for: the next
movement, an upcoming side change, the start of the next round, or the fact that
the workout ends after this - naming both when a round boundary changes the side
as well ("Next: Hip Opener, left side, round 2 of 2"). Derived from the phase machine and
the session position, so there's nothing extra to keep in sync. Only Interval has
it - Pails/Rails has no rest phase, and Open Work has no exercise sequence to
look ahead in.

### Pails/Rails

One turn at an exercise: Stretch Hold -> Ramp -> PAILs Hold -> Switch (direction
cue) -> RAILs Hold. The "Switch" here is the PAILs-to-RAILs contraction direction
change, not a side change. Ending on a hold with nothing after it, Pails/Rails
does get the between-exercise countdown on every handover. Pails/Rails movements are always single-sided (`sideMode:
'unilateral'`, constant - see `specs/01-data-model.md`); the side is handled at
session level, below.

### Rounds are circuits, a side at a time

A session is a circuit, nested **round -> side -> exercise**. A round is one pass
through every exercise on each side, so an exercise's phase machine runs exactly
one turn's worth of work and then hands back:

```
Round 1:  left (a b c) -> Switch Sides -> right (a b c)
Round 2:  left (a b c) -> Switch Sides -> right (a b c)
```

Bilateral workouts are the same thing without the side layer: round 1 is a b c,
round 2 is a b c. Either way you finish the whole list on one side before
changing side - the side never changes between exercises - and a round ends by
coming back to the left for the next one.

So neither the round nor the side belongs to a movement's phase machine; both
live on the session. `initIntervalStepState`/`initPailsRailsStepState` carry
neither, and there's no `side_switch` phase. `sessionEngine.js` owns the
sequencing as two pure mirrored functions - `advanceSessionPosition` and
`retreatSessionPosition` - over `{ currentIndex, round, side }`:

- Not on the last exercise -> next exercise, same round, same side.
- Last exercise, on the left -> first exercise, same round, right side.
- Last exercise (on the right, or bilateral), rounds remaining -> first exercise,
  next round, back to the left.
- Otherwise -> the session is done.

`needsTransitionCountdown` decides whether a handover gets its own countdown
screen (see Interval, above). When it does, `pendingPosition` records where that
countdown is heading, so letting it run out, skipping it, and Next all land in
the same place. A side change reads "Switch Sides"; anything else reads "Up Next".
A unilateral session therefore gets `rounds × 2 - 1` of those side-change
screens - one between the two halves of each round, and one at each round
boundary coming back to the left.

Because both functions are pure and exported, the Rest phase's next-up line and
the Prev/Next disabled states read the same sequencing the reducer does rather
than re-deriving it.

Completing a circuit plays the round-complete cue from `SteppedSession` rather
than from the step components: a round now ends by moving to a different
exercise, which remounts the step component and loses the before/after it would
have compared.

Total duration is unaffected by any of this - the same work in a different
order - so the `rounds × exerciseCount` and the ×2 in both estimate formulas
still hold.

### Lead-in countdown (Interval, Pails/Rails)

Tapping Start on a stretching or mobility workout opens a 10-second
get-into-position countdown (`LEAD_IN_SECONDS`) before the first phase begins:
both modes start in a held position, and you can't be in it at the same moment
you tap the button. The screen names the movement you're getting into, and
offers Pause (a hold can need longer than ten seconds to settle into) and "Skip,
I'm ready".

It's the same `CountdownScreen` component as the between-exercise "Up Next" wait
and ticks the same audio cue over its last three seconds, but it's separate
state (`leadIn`/`leadInRemaining`) rather than a flag on `transitioning` - the
transition countdown advances `currentIndex` when it completes and this one must
not. The lead-in leaves `stepState` untouched, so the first phase starts at its
full configured duration, and doesn't advance `sessionElapsedSeconds`, so the
ten seconds aren't logged as workout time.

Open Work doesn't get one. It's self-paced against a session clock with no held
position to arrange, and its own "End Set / Start Rest" control already sets the
pace.

### Shared transport (Interval, Pails/Rails)

Previous / Pause-Resume / Skip / Next, operating on the exercise sequence:

- **Next** moves exactly one exercise forward; **Previous** exactly one back.
  Neither wraps - Previous is a no-op on the first exercise, Next a no-op on the
  last.
- Stepping to a new exercise always resets that exercise's phase machine to its
  configured starting value (first phase, round 1, full duration) - it never
  inherits elapsed time or round progress from the exercise being left.
- **Skip** advances the *current* phase within the current exercise immediately
  (as if its timer had hit zero), without changing which exercise is active.
- Between exercises (when a step completes on its own, not via Next), an "Up Next"
  countdown screen shows before the next exercise starts; "Skip wait, start now"
  jumps straight in. On a unilateral workout the handover from the last exercise
  of the left pass to the first of the right pass is the same screen, headed
  "Switch Sides".
- Next and Previous step along the full session sequence - the exercise list, once
  per side, once per round. So Next off the last exercise of the left pass lands on
  the first exercise of the right pass, and off the end of the right pass onto the
  next round's left pass; Previous comes back the same way. They still stop at the
  two real ends of the session.

### Total duration estimate

Shown on the Start Workout screen (which doubles as the pre-start workout preview -
this is the one screen shown "before starting" a workout), recalculated live as
chips change:

- **Interval**: `(work + rest) × rounds × exercise count`, ×2 when `sideMode` is
  `'unilateral'`.
- **Pails/Rails**: `(stretchHold + ramp + pailsHold + railsHold) × rounds ×
  exercise count × 2` (always ×2 - Pails/Rails is always unilateral).
- **Open Work** has its own fixed `sessionTargetSeconds` instead of a computed
  total, so no estimate is shown for it.

Durations everywhere in the Tracker (chip steppers, the running timer, this total)
are formatted `m:ss` via `formatMMSS`.

### Start gate

Confirming config on the Start Workout screen lands in the Tracker in a paused
"ready" state - workout name, exercise name, and the first phase's full configured
duration all visible, 0 elapsed - rather than immediately ticking. An explicit tap
on a Start control (shown in place of the Pause/Resume row until then) is required
before the first timer counts down. This applies to all three modes.

## Known Issues / Changelog

- **Changed** - a round is now one pass through every exercise on each side, in
  the order left (a b c), right (a b c), next round - see "Rounds are circuits, a
  side at a time" above. Reached in two steps: rounds first stopped being repeats
  of a single exercise before moving on (a a a, b b b, c c c), and the nesting was
  then corrected from side-outside-round to round-outside-side. Both the round and
  the side live on the session now rather than in the phase machines, which run one
  turn and hand back; that retired the 3-second `SIDE_SWITCH_SECONDS` cue, since a
  side change lands on the ordinary between-exercise countdown headed "Switch
  Sides", and made `stepState.side`/`stepState.round` props fed from the session.
  Total duration is unaffected throughout - the same work reordered. *Consequence
  worth knowing: an Interval handover no longer stacks the 10-second countdown on
  top of the configured Rest, since with circuits that would mean resting twice
  between every movement. A side change still gets one, and Pails/Rails gets one
  throughout - it ends on a hold. Flag it if the countdown is wanted on Interval
  handovers too.*
- **Added** - the Interval rest timer names what's next: the next round, the next
  movement, an upcoming side change, or the end of the workout.
- **Added** - a 10-second get-into-position countdown when Start is tapped on an
  Interval or Pails/Rails workout - see "Lead-in countdown" above. *Note: there
  are two taps between the Library and a running timer - "Begin" on the Start
  Workout config screen, then "Start" on the Tracker's ready screen. The
  countdown hangs off the second one, the tap that actually starts the clock,
  which keeps the deliberate start gate intact. Flag it if "Begin" should instead
  go straight into the countdown and drop the ready screen.*
- **Changed** - Reps moved off `Exercise.repsLabel` (free text, per-exercise) onto
  a structured `SetsRepsScheme` - first tried per-exercise-slot
  (`WorkoutTemplate.setsReps[]`), then corrected after usability feedback to a
  single, workout-wide plan at `openWorkConfig.setsReps` (db v6), exclusive to
  Open Work - see `specs/01-data-model.md`. Configured on the Edit Template page
  and the Start Workout screen; never shown per-exercise; doesn't apply to
  Interval or Pails/Rails (which already have rounds/work/rest for that role).
- **Added** - The plan also tracks live on the running Open Work session: "Set
  _n_ of _total_ / Target: _x_ reps" under the timer, advancing off the same
  `setsCompleted` count "End Set / Start Rest" already increments - see "Open
  Work" above.
- **Fixed** - Active session state no longer resets on leaving the Tracker tab.
  Lifted into an app-level store (`activeSessionStore.jsx`) mounted above the
  router, mirrored to IndexedDB every few seconds.
- **Fixed** - Next/Previous step-reset rule made explicit and shared by both
  Interval and Pails/Rails via `sessionEngine.js`'s `NEXT`/`PREV` handling: one
  exercise at a time, always resets to the new exercise's configured start, no
  wrap-around at either end. *Assumption: no wrap-around desired (Next on the last
  exercise does not complete the workout) - flag it if wrap-to-complete is
  actually wanted.* Note: targeted reproduction of the previously reported
  "skipped/duplicated step" symptom did not reproduce it against the prior
  remount-based implementation either; the explicit reducer-driven version in this
  patch is a hardening of the contract, not a fix for an observed regression.
  Open Work has no per-movement stepping (unchanged, static reference list), so
  this item doesn't apply there.
- **Fixed** - Pails/Rails now has the same Previous / Pause-Resume / Skip / Next
  transport row as Interval, operating on its ramp -> PAILS hold -> switch cue ->
  RAILS hold sequence via the shared step-reset rule above. Interval also gained
  the same Skip control (advance the current phase without leaving the exercise) -
  it existed for neither mode before this patch, despite the "same row as Interval"
  framing.
- **Fixed** - Interval gained `sideMode` (`bilateral`/`unilateral`), confirmable on
  the Start Workout screen. Pails/Rails' side handling moved from a per-workout
  `bilateral`/`left_right` choice to a constant `sideMode: 'unilateral'` - seen
  in the data model as `pailsRailsConfig.sideMode` (see
  `specs/01-data-model.md`). *Assumption: Pails/Rails is always unilateral - flag
  it if any current Pails/Rails exercise is actually meant to run bilateral.*
  *Design decision (not explicitly specified): a "unilateral" round for both modes
  runs the full phase sequence once per side within the round (Left, a brief
  Switch cue, Right), then advances the round counter - rather than alternating
  which side an entire round is. This is what makes the Pails/Rails total-duration
  formula's unconditional ×2 (independent of `rounds`) come out consistent, and
  matches Interval's fix text ("insert a side step... within each round").
- **Fixed** - Total workout duration now shown on the Start Workout screen (which
  doubles as the "preview before starting" screen - there's no separate preview
  step tapping a Library card goes through), recalculated live on every chip
  change, for both Interval and Pails/Rails.
- **Already correct, verified** - Interval's chip steppers and running timer were
  already using the shared `formatMMSS` mm:ss formatter (unlike the raw-seconds
  `<input type=number>` fields on the Start Workout / template editor config
  screen, which remain raw seconds for all three modes - out of scope here, since
  the fix text specifically called out chip steppers and the running timer). The
  new total-duration display (previous item) is also formatted mm:ss.
- **Fixed** - Confirming Start Workout no longer auto-starts the timer; see "Start
  gate" above. Applies to all three modes.
