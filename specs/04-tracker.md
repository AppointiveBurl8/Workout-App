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

Work/rest phases, repeated for `rounds`, run once per exercise in the workout's
`exerciseIds` list, in order.

When `intervalConfig.sideMode` is `'unilateral'`, each round runs the work/rest
pair once for the Left side, a brief "Switch" cue, then the work/rest pair again
for the Right side, before advancing to the next round. `'bilateral'` runs the
pair once per round with no side split.

### Pails/Rails

Per round: Stretch Hold -> Ramp -> PAILs Hold -> Switch (direction cue) -> RAILs
Hold. Pails/Rails movements are always single-sided (`sideMode: 'unilateral'`,
constant - see `specs/01-data-model.md`), so every round additionally runs that
whole sequence once for the Left side, a side "Switch" cue, then again for the
Right side, before advancing to the next round.

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
  jumps straight in.

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
