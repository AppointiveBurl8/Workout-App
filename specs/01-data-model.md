# Data Model

Dexie (IndexedDB) database `WorkoutTrackerDB`, defined in `src/db.js`. Currently at
schema version 5.

## Exercise

A movement, and nothing about how it's timed or how many sets/reps it calls for -
both belong to the workout that runs it, so the same movement can be run as
intervals one day and open work the next, at a different sets/reps scheme each time.

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
  setsReps: SetsRepsScheme[],  // one per exerciseIds position - see below
  archived: boolean,
  defaultTimerMode: 'open_work'|'interval'|'pails_rails',
  intervalConfig: IntervalConfig,
  pailsRailsConfig: PailsRailsConfig,
  openWorkConfig: OpenWorkConfig,
  sideMode: 'bilateral'|'blocked'|'alternating',   // Open Work's movement-list grouping
}
```

### SetsRepsScheme

Defined in `src/lib/setsReps.js`, configured per-exercise-slot on the Edit Template
page (not on the Exercise itself - the same movement can call for a different
scheme in a different workout, or a different slot of the same workout).

```
{
  pattern: 'straight'|'top_back_off'|'ramp'|'pyramid'|'reverse_pyramid'|'custom',
  sets: number,
  reps: number,
  percent: number,        // "Back-off" (top_back_off) or "Set Interval" (ramp) - see below
  customSets: number[],   // explicit reps per set - see below
}
```

`straight`/`top_back_off`/`ramp` all run `reps` reps for `sets` sets - the app has
no weight tracking, so `percent` is purely a reference note for the lifter (how
much to drop or ramp the weight by on later sets), not something reps are computed
from. `pyramid`/`reverse_pyramid`/`custom` instead read their per-set rep counts
directly from `customSets`, one entry per set, freely editable and independently
grown/shrunk from `sets`/`reps`; switching into `pyramid`/`reverse_pyramid` seeds a
descending/ascending default table from the current `sets`/`reps`, while `custom`
keeps whatever table is already there (reconciled to the current `sets` count).

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
}
```

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
  existing template backfills a default `{ pattern: 'straight', sets: 3, reps: 10,
  percent: 10, customSets: [10, 10, 10] }` scheme per exercise it already has.
