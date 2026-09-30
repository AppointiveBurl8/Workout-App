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

What drives that reducer is a single wall-clock ticker in the same provider -
there is no other timer anywhere in the app that advances session state. See
"Wall-clock timing" below.

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

### Rounds are circuits, a pass at a time

A session is a circuit, nested **round -> pass -> exercise**. A round is one pass
through the exercise list per side, so an exercise's phase machine runs exactly
one turn's worth of work and then hands back:

```
Round 1:  left (a b c) -> Switch Sides -> right (a b c)
Round 2:  left (a b c) -> Switch Sides -> right (a b c)
```

Bilateral workouts are the same thing with one unlabelled pass: round 1 is a b c,
round 2 is a b c. Either way you finish the whole list on one side before
changing side - the side never changes between exercises - and a round ends by
coming back to the left for the next one.

#### Symmetrical exercises run once

Not every movement has a left and a right. A forward fold run "Left, then Right"
is just the same fold twice. `Exercise.sided` marks the ones that do have sides
(default `true`), and a **symmetrical exercise runs once per round, in the left
pass, at its list position**. The right pass skips it. With `b` unsided:

```
Round 1:  left (a b c) -> Switch Sides -> right (a c)
```

It shows **no side label** at any point - not "Left side" during the left pass,
not in the "Up Next" screen, not in the Interval rest timer's next-up line.
Saying "left" about a movement with no left is worse than saying nothing.

If **nothing** in the workout is sided there is a single unlabelled pass and no
side labels anywhere - the same as a bilateral session. A bilateral Interval
workout ignores the flag entirely; everything runs once either way.

`buildPasses(exercises, sideMode)` in `sessionEngine.js` is the single source of
truth for this, and everything else derives from it:

```js
[{ side: 'left', indices: [0, 1, 2] }, { side: 'right', indices: [0, 2] }]
```

#### The position model

Neither the round nor the side belongs to a movement's phase machine - there are
no per-movement machines left. `buildStepSequence` walks round -> pass ->
exercise -> phase once, up front, and stamps each step with the round, pass,
exercise index and side it belongs to. Stepping is then just `index + 1` and
`index - 1`.

Each pass names the exercise **indices** it runs, so the right pass is simply a
shorter list, and nothing in the stepping logic has to know `sided` exists.

The exercise list, with its `sided` flags, is **snapshotted onto the session when
it starts** rather than looked up live. Editing an exercise mid-session would
otherwise reshape the circuit underneath a running workout. Names still resolve
live, so a rename shows up immediately; only the flags are frozen.

`needsTransitionCountdown` decides whether a handover gets its own countdown
step, keyed on crossing a **pass** boundary rather than comparing side labels -
which is the same thing, and still right when the exercise on one side of the
boundary has no label to compare. A countdown step carries the position of the
exercise it leads into, so the screen can name what's coming without looking
ahead. A pass change reads "Switch Sides"; anything else reads "Up Next".

Because the step list is pure and built the same way in the reducer and in the
view, the Rest phase's next-up line reads the same sequence the reducer walks
rather than re-deriving it.

Completing a circuit plays the round-complete cue from `SteppedSession` rather
than from the step components: a round now ends by moving to a different
exercise, which remounts the step component and loses the before/after it would
have compared.

Total duration is **not** independent of the flags any more, and the estimate
formulas changed accordingly - see "Total duration estimate" below.

### Lead-in countdown (Interval, Pails/Rails)

Tapping Start on a stretching or mobility workout opens a 10-second
get-into-position countdown (`LEAD_IN_SECONDS`) before the first phase begins:
both modes start in a held position, and you can't be in it at the same moment
you tap the button. The screen names the movement you're getting into, and
carries the same Previous / Pause / Next row as everything else - Pause because
a hold can need longer than ten seconds to settle into, Next because "I'm ready"
is just the next step.

It's the same `CountdownScreen` component as the between-exercise "Up Next" wait
and ticks the same audio cue over its last three seconds, but it is **not a step**:
it's separate state (`leadIn`/`leadInRemaining`) sitting in front of step 0. Step
0 is already at its full configured duration waiting, and the lead-in doesn't
advance `sessionElapsedSeconds`, so the ten seconds aren't logged as workout
time. Previous during the lead-in restarts it - there is nothing behind it.

Open Work doesn't get one. It's self-paced against a session clock with no held
position to arrange, and its own "End Set / Start Rest" control already sets the
pace.

### Steps

**A step is the smallest timed unit of a session.** Everything on screen - the
round, the side, the exercise, the phase, its colour and the timer - is derived
from the step at the current index. There is no separate phase machine and no
separate position; there is one list and one index into it.

| Mode | A step is |
|---|---|
| **Open Work** | one work block, or one rest |
| **Interval** | one work interval, one rest, or one "Up Next" countdown |
| **Pails/Rails** | one phase - stretch hold, ramp, PAILs, switch, RAILs - per exercise, per side, per round, plus the countdown before each handover |

`buildStepSequence(exercises, timerMode, config)` builds the whole list up front
for the two stepped modes. It holds structure only - round, pass, exercise,
side, phase - and durations are read from the live config at display time, so
retuning a chip mid-session doesn't invalidate it. Only `rounds` changes its
length, and because the list is round-major, adding rounds only appends.

Open Work has **no step list**: a work block counts up with no set length and the
session runs to `sessionTargetSeconds`, so how many steps it contains isn't known
in advance. Its two phases are its steps.

### Transport: Previous / Pause-Resume / Next

Three controls, the same in all three modes, on the running screen and on both
countdown screens. **There is no Skip.** It used to sit alongside these and
overlapped with them; everything it did, Next does.

**Next** ends the current step and starts the next one, wherever that lands - the
next phase, the next exercise, the next side, the next round:

- On the **final step**, it completes the workout and hands off to the log, by the
  same path a timer finishing that step takes. (This resolves an assumption left
  open when stepping was exercise-level: Next at the end used to be a no-op.)
- It is **never disabled**. There is always a next thing, including the end.
- In Open Work, Next during a set ends it, counts it and starts the rest - the
  same as "End Set / Start Rest"; during a rest it cuts the rest short and starts
  the next set. Open Work has no final step, so Next never ends the session; the
  `sessionTargetSeconds` hard stop still does.

**Previous** is not a plain mirror of Next, because the common case for tapping it
is "that one again", not "the one before":

- More than **3 seconds** into the step (`PREV_RESTART_THRESHOLD_MS`), it
  **restarts the current step** - back to its full duration, same step.
- **3 seconds or less**, it goes **back one step** and starts it from full.
- On the **first step** it always restarts, because there is nothing behind it. It
  is never a no-op and never disabled.
- In Open Work, Previous during a set restarts the set clock (a count-up block has
  no earlier step that would mean anything). During a rest it restarts the rest,
  or - within the first 3 seconds - drops back into the set and **un-counts** it,
  which is the "tapped End Set by mistake" case.

**One function moves the index.** `goToStep()` in `activeSessionStore.jsx` is
where Next, Previous and a timer running out all land, so the round, side, phase
and exercise can't be computed three different ways. Running off the end of the
list is what completes the workout, which is why manual and natural endings take
the identical path.

**The display updates on the tap, not on the next tick.** A step change sets
`stepElapsedSeconds` to 0, and the remaining time is `duration - elapsed`, so the
new step's full duration is on screen immediately. (Sub-second precision is not
reset: tapping part-way through a second means the first tick of the new step
arrives a fraction early. Not worth threading a timestamp through the reducer
for.)

**Countdowns between exercises** still appear where they did - an "Up Next" before
a Pails/Rails handover, a "Switch Sides" on any pass change - but they are now
ordinary steps in the list rather than an overlay, which is what lets Next and
Previous move through them like anything else. **Not on a same-side Interval
handover**, though: an Interval exercise always ends on its configured Rest and
that Rest *is* the gap, so a countdown after it would mean resting twice over.
`needsTransitionCountdown()` in `sessionEngine.js` is the single place that
decides, and `buildStepSequence` is its only caller.

A countdown step doesn't bill workout time (`stepCountsAsWorkoutTime`), the same
as the lead-in - so the logged duration counts only phases actually worked, and
skipping a step with Next doesn't log time you didn't spend.

### Total duration estimate

Shown on the Start Workout screen (which doubles as the pre-start workout preview -
this is the one screen shown "before starting" a workout), recalculated live as
chips change:

Both stepped modes are `per-step duration × total steps`, where the step count
comes from `buildPasses` rather than a multiplier - so a symmetrical exercise is
counted once, not twice:

```js
totalSessionSteps(passes, rounds)  // = rounds × Σ pass.indices.length
```

- **Interval**: `(work + rest) × steps`.
- **Pails/Rails**: `(stretchHold + ramp + pailsHold + railsHold) × steps`.
- **Open Work** has its own fixed `sessionTargetSeconds` instead of a computed
  total, so no estimate is shown for it.

A unilateral workout with no symmetrical exercises still comes out at exactly
twice the bilateral figure, as it did before. One with some shows a line under
the estimate - "N symmetrical exercise(s) run once per round" - because
otherwise the number looks wrong against the exercise count. There is a test
asserting the estimate equals the steps a full session actually generates, for
every combination; the two disagreeing is the failure mode that matters.

Durations everywhere in the Tracker (chip steppers, the running timer, this total)
are formatted `m:ss` via `formatMMSS`.

### Start gate

Confirming config on the Start Workout screen lands in the Tracker in a paused
"ready" state - workout name, exercise name, and the first phase's full configured
duration all visible, 0 elapsed - rather than immediately ticking. An explicit tap
on a Start control (shown in place of the Pause/Resume row until then) is required
before the first timer counts down. This applies to all three modes.

## Reordering a workout's exercises

The exercise list in the Template Editor and the Builder is the same component,
`ReorderableExerciseList`, dragged by the handle on each row. It replaced a pair
of up/down buttons that moved one position per tap - six taps to bring the last
movement of a seven-exercise workout to the front.

Built on pointer events rather than a drag-and-drop library: HTML5 drag-and-drop
doesn't fire on touch at all, and the bundle is already heavy enough (see
`specs/05-cloud-sync.md`). The handle takes pointer capture for the duration, so
a finger that wanders off the row still steers it, and carries
`touch-action: none` so the browser doesn't scroll the page instead.

The index arithmetic is pure, in `src/lib/reorder.js`, so it can be reasoned
about without a pointer: `targetIndexForCenter` answers where a row would land,
`projectedIndex` where every row ends up if dropped now, and `shiftForIndex`
turns that into the slide that opens the gap. All three measure against the row
positions captured when the drag began, so the answer doesn't chase the rows as
they move out of the way. The position numbers show the projected order during a
drag, not the stale one.

The handle is also a real button: focused, Up/Down arrows move the row, focus
follows it, and the move is announced in a live region - which is what the
up/down buttons were quietly providing before.

## Audio cues

Cues are Web Audio oscillators from `src/lib/audioCues.js` - no audio files. Phones
only let a page make sound if a real tap started it, and a workout's cues all fire
from a timer long afterwards, so the context has to be opened inside a gesture and
kept alive:

- `unlockAudio()` runs from every tap that can lead to a running timer: Begin on
  Start Workout, a Library card, the Builder's start, the Tracker's own Start
  control (the only gesture on a direct `/tracker?templateId=` load or a mid-session
  refresh), and unmuting. It creates or resumes the context *and* starts one silent
  sample - iOS wants a sound actually begun inside the gesture, not just a resume.
- `playTone()` waits for `resume()` to settle before scheduling. Scheduling against
  a context that hasn't finished resuming drops the tone silently.
- A `visibilitychange` listener resumes the context on return, since backgrounding
  the app or the screen locking mid-workout suspends it and nothing else would.

What none of that can reach is sound blocked below the browser. On an iPhone the
ring/silent switch mutes Web Audio even at full volume. The **Sound check** in the
Log tab exists to tell those apart in one tap: it unmutes, unlocks, plays the
round-complete cue, and reports the context's state. "running" with nothing
audible means the block is outside the app.

## Screen wake lock

A session holds a screen wake lock (`src/lib/useWakeLock.js`) for as long as it
exists - from the moment it's created on the Tracker until it completes or is
cleared. Paused counts. So do the lead-in and "Up Next" countdown screens: those
are part of a running workout, and a phone that sleeps during the ten seconds
you're getting into position is exactly as useless as one that sleeps mid-hold.

The lock is held by `ActiveSessionProvider`, not by the Tracker page, for the
same reason the session state is: the page unmounts on a tab switch, and
checking the Log mid-workout shouldn't let the screen go dark. Releasing is tied
to the session ending, not to the Tracker unmounting.

Two things re-acquire it, because one request is not enough:

- The OS drops the lock whenever the page is hidden and never takes it back, so a
  `visibilitychange` listener re-requests on return.
- Some states reject a request made without a recent user gesture. A
  `pointerdown` listener retries on the next tap rather than leaving the screen
  to sleep for the rest of the session.

The Tracker header shows a small "Screen on" dot while a lock is actually held.
It renders nothing when the request was denied and nothing where the API is
unsupported - the point of it is to tell a working lock from a silently failed
one on a device you can't inspect.

**What it does not do:** a wake lock prevents the *automatic* sleep timer only.
Pressing the side button still locks the phone, and JS is suspended while it's
locked - see "Wall-clock timing" for what happens to the session's elapsed time
across that.

## Wall-clock timing

Session time is measured against the wall clock, not counted in callbacks.
`src/lib/useWallClockTicker.js` polls four times a second, works out how many
whole seconds have passed since it last reported (`Date.now()`), and reports
that count. It also flushes immediately on `visibilitychange`, which is the one
moment the debt is certain to be large.

Counting callbacks under-counts, badly. A hidden tab has its timers throttled to
roughly once a minute, and a locked phone stops running JS altogether - so a
workout left alone for two minutes would come back two minutes behind, silently.
Measuring elapsed time instead means the missed seconds are still there to be
claimed on the way back.

The reducer takes the debt as `TICK_N` and **replays it one second at a time
through the ordinary `TICK` path**, rather than adding it to a counter:

```js
case 'TICK_N': {
  const n = Math.min(action.n, MAX_CATCHUP_SECONDS)
  let next = state
  for (let i = 0; i < n; i++) {
    if (!isTicking(next)) break
    next = reducer(next, { type: 'TICK' })
  }
  return next
}
```

Replaying is what keeps every phase boundary, round change, side change and
lead-in intact: a catch-up that spans three exercises ends exactly where a
foreground run of the same length would have. The `isTicking` guard is what
stops it overshooting - the moment a tick completes the session or trips Open
Work's `sessionTargetSeconds` hard stop, `status` leaves `'active'` and the loop
breaks, so a two-hundred-second jump into a sixty-second Open Work session still
logs sixty. `MAX_CATCHUP_SECONDS` (four hours) caps the rest: past that the
workout was abandoned, not backgrounded.

Paused time is never banked. The ticker's effect tears down when `running` goes
false and re-arms with a fresh baseline on resume, so the gap is discarded
rather than owed.

**Cues don't burst.** One `TICK_N` is one React commit, and every cue in the
Tracker fires from comparing previous to next state in an effect
(`usePhaseTransitionCues`, the round watcher in `SteppedSession`, the phase
watcher in `OpenWorkSession`) rather than from counting ticks. So a catch-up
across several phases plays at most one cue - the one for the state it landed
in - not one per second skipped.

**A rehydrate does not catch up.** The mirrored session carries no timestamp,
deliberately: on reload the ticker starts from `Date.now()` with nothing owed,
so a workout resumes from its last mirrored state (up to one 3-second mirror
interval behind) rather than being fast-forwarded to now. Only backgrounding
within a live page is compensated. This is also why `SESSION_SHAPE` didn't need
a bump for any of this - the stored shape is unchanged.

**What it can't fix:** on a locked iPhone, JS and audio are both suspended.
Elapsed time and position are correct the moment you unlock, but cues that would
have sounded while it was locked are gone - they were never scheduled. A wake
lock (above) avoids the automatic case; the side button is still the side
button.

## Known Issues / Changelog

- **Changed (2026-09-30)** - Removed Skip; Next/Previous now handle step
  navigation at phase level, Previous restarts if >3s elapsed. Skip overlapped
  with Next and the two disagreed about what a "step" was: Skip moved one phase,
  Next moved a whole exercise. A session is now a flat list of steps - see "Steps"
  above - and the two arrows are the only navigation there is, in all three modes,
  on the running screen and on both countdown screens. Next on the final step
  completes the workout, resolving the open assumption below. Previous restarts
  the current step past `PREV_RESTART_THRESHOLD_MS` and steps back before it.
  Neither is ever disabled. The per-exercise phase machines
  (`tickStepState`/`skipStepState` and friends) and the exercise-level position
  (`advanceSessionPosition`/`retreatSessionPosition`, `pendingPosition`,
  `transitioning`) are gone with them; `goToStep()` is the single place the index
  moves. `SESSION_SHAPE` went to 5, so an in-flight workout across this deploy is
  discarded, by design.
  *Interpretation worth flagging:* Open Work keeps "End Set / Start Rest"
  alongside Next, which does the same thing during a set. Next doesn't say what it
  counts and that button does, so it stayed. Say the word and it goes.
- **Added** - `Exercise.sided`, so a symmetrical movement runs once per round
  instead of being run twice under two side labels - see "Symmetrical exercises
  run once" above. The session position moved from
  `{ currentIndex, round, side }` to `{ round, passIndex, indexInPass }` over the
  passes from `buildPasses`, which is what lets the right pass be a shorter list
  without the stepping logic knowing about the flag. Defaults true everywhere,
  including for rows that predate it, so nothing changes until a movement is
  explicitly unticked. `SESSION_SHAPE` went to 4; an in-flight workout across
  that deploy is discarded, by design.
  *Decided, not open:* Open Work's `blocked`/`alternating` movement list ignores
  the flag entirely and stays that way. It's a static reference list with no
  sequencing to skip, so there is nothing for the flag to change without
  redefining what that list means. Confirmed by the owner rather than assumed.
- **Fixed** - session time no longer under-counts when the phone is locked or
  the tab is backgrounded. Ticks are measured against the wall clock and replayed
  through the existing single-tick path, so a gap lands where a foreground run
  would have - see "Wall-clock timing" above. The dead `src/lib/useInterval.js`
  went with it; nothing had imported it since the session store took over
  timing, and leaving a second timing hook next to the new one was a trap.
- **Added** - the screen is held awake for the whole of an active session, with a
  "Screen on" indicator in the Tracker header - see "Screen wake lock" above.
  Previously nothing in the app touched `navigator.wakeLock` and the phone slept
  mid-workout on its usual timer.

- **Corrected (doc only)** - the Shared transport section still described two
  things the circuit rework had changed underneath it, and contradicted this
  file's own Interval section while doing it. Stepping to a new exercise was said
  to reset the machine to "round 1" and to never inherit round progress - the
  round left the phase machine for the session position in `b17d84f`, so it now
  carries across a step by design. And the "Up Next" countdown was stated
  unconditionally, when `needsTransitionCountdown()` (also `b17d84f`) skips it on
  a same-side Interval handover. Both bullets now match the code. `b5dab80` and
  `767b106` are the other two commits in that rework - see the two **Changed**
  entries below, which this correction brings the transport section into line
  with. The same drift in `specs/01-data-model.md` is corrected there.
- **Changed** - exercises in a workout are dragged into order by a handle instead
  of nudged one position at a time by up/down buttons - see "Reordering a
  workout's exercises" above. Same component in the Template Editor and the
  Builder; arrow keys on the focused handle still do it without a pointer.
- **Fixed** - audio could stay silent on a phone for three separate reasons, all
  addressed: nothing unlocked the context on a direct Tracker load or a mid-session
  refresh; a cue scheduled against a still-resuming context was dropped; and a
  context suspended by the screen locking was never resumed. See "Audio cues" above.
- **Added** - a Sound check in the Log tab, since a cue that doesn't play says
  nothing about why. *Open: an iPhone's ring/silent switch mutes Web Audio
  regardless of anything the app does. Playing the cues through an `<audio>`
  element instead may dodge that, but it's unverified - there's no iPhone in the
  sandbox this was built in, so it isn't claimed as fixed.*
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
  wrap-around at either end. *That assumption - "Next on the last exercise does
  not complete the workout" - was **resolved the other way** on 2026-09-30: Next
  on the final step now completes the workout. Superseded; see the Skip removal
  at the top of this list.* Note: targeted reproduction of the previously reported
  "skipped/duplicated step" symptom did not reproduce it against the prior
  remount-based implementation either; the explicit reducer-driven version in this
  patch is a hardening of the contract, not a fix for an observed regression.
  Open Work has no per-movement stepping (unchanged, static reference list), so
  this item doesn't apply there.
- **Fixed** - Pails/Rails now has the same transport row as Interval, operating on
  its ramp -> PAILS hold -> switch cue -> RAILS hold sequence via the shared
  step-reset rule above. Interval also gained the same Skip control (advance the
  current phase without leaving the exercise) - it existed for neither mode before
  this patch, despite the "same row as Interval" framing. *Skip was removed again
  on 2026-09-30, its job folded into Next; see the top of this list.*
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
