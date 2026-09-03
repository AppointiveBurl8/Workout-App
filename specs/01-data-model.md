# Data Model

Dexie (IndexedDB) database `WorkoutTrackerDB`, defined in `src/db.js`. Currently at
schema version 4.

## Exercise

A movement, and nothing about how it's timed - timing belongs to the workout that
runs it, so the same movement can be run as intervals one day and open work the next.

```
{
  id: number,
  name: string,
  categories: Array<'kettlebell'|'mobility'|'stretching'>,  // an exercise can belong to several
  repsLabel: string,   // free-text display only (e.g. "12 reps"), not tracked/counted
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
