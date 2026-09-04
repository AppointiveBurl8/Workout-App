# Data Model

Dexie (IndexedDB) database `WorkoutTrackerDB`, defined in `src/db.js`. Currently at
schema version 6.

## Exercise

A movement, and nothing about how it's timed - timing (and, for Open Work, the
sets/reps plan) belongs to the workout that runs it, so the same movement can be
run as intervals one day and open work the next.

```
{
  id: number,
  name: string,
  categories: Array<'kettlebell'|'mobility'|'stretching'>,  // an exercise can belong to several
  notes?: string,
}
```

## WorkoutTemplate

```
{
  id: number,
  name: string,
  category: 'kettlebell'|'mobility'|'stretching',
  tags: string[],
  exerciseIds: number[],       // ordered
  archived: boolean,
  defaultTimerMode: 'open_work'|'interval'|'pails_rails',
  intervalConfig: IntervalConfig,
  pailsRailsConfig: PailsRailsConfig,
  openWorkConfig: OpenWorkConfig,
  sideMode: 'bilateral'|'blocked'|'alternating',   // Open Work's movement-list grouping
}
```

### IntervalConfig

```
{
  workSeconds: number,
  restSeconds: number,
  rounds: number,
  sideMode: 'bilateral'|'unilateral',
}
```

`sideMode` is confirmable on the Start Workout screen, same pattern as Open Work's
`sideMode`. `unilateral` inserts a side step (Left, then Right) within each round
before advancing to the next round - see `specs/04-tracker.md`.

### PailsRailsConfig

```
{
  holdSeconds: number,    // initial static stretch hold at end-range, before the ramp
  rampSeconds: number,
  pailsHoldSeconds: number,
  railsHoldSeconds: number,
  rounds: number,
  sideMode: 'unilateral', // constant - Pails/Rails movements are always single-sided
}
```

`sideMode` is not user-editable for this mode; it's stored for symmetry with
`IntervalConfig` but the Start Workout / template editor UI doesn't offer a picker
for it. Every round runs Left, then Right.

### OpenWorkConfig

```
{
  sessionTargetSeconds: number,  // hard-stop total session length
  restSeconds: number,           // rest length after each set
  setsReps: SetsRepsScheme,      // a workout-wide sets/reps plan - see below
}
```

#### SetsRepsScheme

Defined in `src/lib/setsReps.js`. A single, workout-wide plan - not per-exercise,
and exclusive to Open Work: Interval and Pails/Rails already have their own
rounds/work/rest structure, so a separate sets/reps scheme there would just be
redundant. Configured on the Edit Template page and the Start Workout screen
(wherever `TimerModeConfigFields` renders the Open Work fields), never on the
Exercise itself and never shown per-exercise.

```
{
  pattern: 'straight'|'top_back_off'|'ramp'|'pyramid'|'reverse_pyramid'|'custom',
  sets: number,
  reps: number,
  percent: number,        // "Back-off" (top_back_off) or "Set Interval" (ramp) - see below
  customSets: number[],   // explicit reps per set - see below
}
```

`straight` runs `reps` reps for all `sets` sets. The other five patterns each
resolve to a real, varying reps-per-set sequence via `getRepsSequence()` in
`src/lib/setsReps.js` - the app has no weight tracking, so `percent` drives reps
directly instead of standing in for a weight change:

- `top_back_off`: starts at `reps` (the top set) and backs off by `percent`% each
  subsequent set, rounded, floored at 1 - e.g. `reps: 12, percent: 30` -> 12, 8, 6, 4.
  Read-only preview; not hand-editable per set.
- `ramp`: the mirror of `top_back_off` - climbs by `percent`% per set, ending at
  `reps` as the peak set. Also a read-only preview.
- `pyramid`: starts at `reps` and climbs by a fixed step of 2 per set - e.g.
  `reps: 2` over 4 sets -> 2, 4, 6, 8.
- `reverse_pyramid`: the mirror of `pyramid` - the same sequence, descending.
- `custom`: no formula at all - just `customSets` as entered.

`pyramid`/`reverse_pyramid`/`custom` read their per-set rep counts directly from
`customSets`, one entry per set, freely hand-editable and independently
grown/shrunk from `sets`/`reps` (Add Set / remove a row). Switching into
`pyramid`/`reverse_pyramid` seeds `customSets` from the pyramid formula above;
`custom` keeps whatever table is already there (e.g. arriving from Pyramid),
reconciled to the current `sets` count. `top_back_off`/`ramp` don't use
`customSets` at all - their sequence is always recomputed live from `sets`/`reps`/
`percent`, with no independent per-set state to fall out of sync.

## LoggedSession

```
{
  id: number,
  date: string,               // ISO
  templateId: number|null,    // null if this was an on-the-fly session
  category: 'kettlebell'|'mobility'|'stretching',
  durationSeconds: number,
  setsCompleted: number|null, // relevant for open_work sessions
  rpe: number|null,           // 1-10
  notes?: string,
}
```

## Settings

Generic key/value table (`db.settings`, keyed by `key`). Used for the audio-cue
mute flag and, as of the active-session persistence work in `specs/04-tracker.md`,
for mirroring the in-progress Tracker session (key `activeSession`) so a hard app
close/reload doesn't lose it.

## Migration history

- **v1**: initial schema.
- **v2**: added `settings` table; backfilled `pailsRails.holdSeconds` on legacy
  per-exercise config.
- **v3**: moved timer mode and its config off `Exercise` and onto `WorkoutTemplate`
  (`defaultTimerMode`, `intervalConfig`, `pailsRailsConfig`, `openWorkConfig`,
  `sideMode`); `Exercise.category` (single) became `Exercise.categories` (array).
- **v4**: added `intervalConfig.sideMode` (default `'bilateral'`, preserving prior
  behavior for existing templates). Replaced `pailsRailsConfig.side`
  (`'bilateral'|'left_right'`) with a constant `pailsRailsConfig.sideMode:
  'unilateral'` - the field is dropped and re-added on migration, since the old
  `'bilateral'` option no longer has a runtime meaning for this mode (every
  Pails/Rails round is now unconditionally Left-then-Right). No `LoggedSession`
  migration was needed - logged sessions don't reference `side`/`sideMode`.
- **v5**: removed `Exercise.repsLabel` (free-text, per-exercise). Added
  `WorkoutTemplate.setsReps`, one `SetsRepsScheme` per `exerciseIds` position -
  reps moves from a per-exercise label to a per-workout, per-slot structured
  scheme, configured on the Edit Template page instead of on the exercise. Every
  existing template backfilled a default `{ pattern: 'straight', sets: 3, reps: 10,
  percent: 20, customSets: [10, 10, 10] }` scheme per exercise it already had.
  Superseded by v6 below - usability testing showed per-exercise was still the
  wrong place for it.
- **v6**: replaced `WorkoutTemplate.setsReps` (array, one per exercise slot) with
  a single `openWorkConfig.setsReps` - one sets/reps plan per workout, exclusive
  to Open Work, not per-exercise. Existing templates carry over their first
  exercise's v5 scheme (if any) as the new workout-wide default, then drop the
  array.
