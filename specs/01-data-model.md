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
`sideMode`. `unilateral` makes the side a **session-level pass**, not a phase
inside any exercise: the session nests **round -> side -> exercise**, so a round
runs the whole exercise list on the left, then the whole list again on the right,
and the next round starts over on the left. The phase machine carries no side at
all, and there is no `side_switch` phase - see `specs/04-tracker.md`.

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
for it. Each round runs the **full exercise list on the left, then the full list
again on the right** - the side changes between those two passes, never between
one exercise and the next within a pass, and never inside a single exercise. Same
`round -> side -> exercise` nesting as unilateral Interval, above.

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
  type: 'workout'|'rest',     // a missing type means 'workout' - see below
  date: string,               // ISO
  templateId: number|null,    // null if this was an on-the-fly session
  category: 'kettlebell'|'mobility'|'stretching'|null,  // null on a rest day
  durationSeconds: number,    // 0 on a rest day
  setsCompleted: number|null, // relevant for open_work sessions
  rpe: number|null,           // 1-10
  notes?: string,
}
```

A **rest day** (`type: 'rest'`) is a deliberate day off, not training. It carries
a date and optional notes and nothing else: no category, no duration, no sets, no
RPE. It **bridges a streak without adding to it**, and counts towards no other
stat - see `specs/07-log.md` for the full rule.

Rows written before v7 have no `type` at all, and every one of them was a
workout. `normalizeLoggedSession()` in `src/lib/loggedSession.js` maps anything
that isn't explicitly `'rest'` to `'workout'`, and runs on both external entry
points - a restored backup file and a cloud pull - via `importAllData()`.

## Settings

Generic key/value table (`db.settings`, keyed by `key`). Every key written:

| Key | Written by | Notes |
|---|---|---|
| `activeSession` | `src/lib/activeSessionStore.jsx` | The in-progress Tracker session, mirrored every 3s - see below |
| `lastExportedAt` | `src/components/log/BackupControls.jsx` | ISO timestamp of the last backup export; drives the "it's been a while" reminder |
| `cloudSyncedVersion` | `src/lib/cloudSync.js` | see `specs/05-cloud-sync.md` |
| `cloudLocalRevision` | `src/lib/cloudSync.js` | " |
| `cloudSyncedLocalRevision` | `src/lib/cloudSync.js` | " |
| `cloudDeviceLabel` | `src/lib/cloudSync.js` | " |

The four cloud keys are per-device bookkeeping and are deliberately *not* part of
the synced payload, since each device tracks its own position independently.

**The audio mute flag is not here.** It lives in `localStorage` under
`workout-tracker:audio-muted` (`src/lib/audioCues.js`), so unlike everything in
this table it is per-browser and is carried by neither the backup export nor
cloud sync. Clearing site data loses it; so does switching browsers.

### The `activeSession` blob

Mirrored every 3s while a session is running (and cleared the moment one ends) so
a hard close or reload doesn't lose an in-progress workout - see
`specs/04-tracker.md`.

It carries a `shape` field holding `SESSION_SHAPE` from
`src/lib/activeSessionStore.jsx`. On hydrate, a stored session whose `shape`
doesn't match the running build's is **discarded outright** rather than
half-restored. That is deliberate - a session written against a different state
layout would render wrong - but the consequence is real: **a workout in progress
across a deploy that changed the shape is lost.** Bump `SESSION_SHAPE` whenever
the session object's layout changes, and expect that cost.

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
  `'bilateral'` option no longer had a runtime meaning for this mode. The rule
  *at v4* was that every Pails/Rails round ran Left-then-Right within the
  exercise; that is no longer how sides work - see §PailsRailsConfig above for
  the current behavior. No `LoggedSession` migration was needed - logged sessions
  don't reference `side`/`sideMode`.
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
- **v7**: added `LoggedSession.type` (`'workout'|'rest'`), backfilled `'workout'`
  on every existing row - which is what they all were. Indexes unchanged: rest
  days are filtered in memory, and there are never enough logged sessions for
  that to matter. No index on `type` for the same reason.

## Changelog

Schema changes are in "Migration history" above. This section records corrections
to *this document* where it had drifted from the code.

- **Added** - `LoggedSession.type` and the rest-day shape (v7). The rules about
  what a rest day does to a streak and to the stats live in `specs/07-log.md`
  rather than here; this file describes the field.

- **Corrected** - the `sideMode` prose for both `IntervalConfig` and
  `PailsRailsConfig` still described the pre-circuit behavior: a Left/Right side
  step inserted inside each round. Three commits had moved past it without this
  file being updated - `b5dab80` (side lifted out of the per-exercise phase
  machine onto the session, `side_switch` phase deleted), `b17d84f` (a round
  became one pass through every exercise, and the round moved onto the session
  too), and `767b106` (nesting settled at round -> side -> exercise). Both
  sections now state the current nesting. No schema change was involved in any of
  the three - `intervalConfig.sideMode` and `pailsRailsConfig.sideMode` hold the
  same values they did at v4; only what the Tracker does with them changed.
- **Corrected** - §Settings claimed the audio-cue mute flag was stored in
  `db.settings`. It never was: it lives in `localStorage` under
  `workout-tracker:audio-muted`. Grepping every `setSetting()` call in `src/`
  returns `activeSession`, `lastExportedAt` and the four cloud keys, and no mute
  key. The distinction matters - a `localStorage` flag is per-browser and rides
  along with neither the backup export nor cloud sync.
- **Corrected** - §Settings listed no key for `lastExportedAt`, which
  `BackupControls.jsx` has written since `b3265f2`. The section is now an
  exhaustive table of every key with the file that writes it, so the next missing
  key is visible rather than merely absent.
- **Added** - §Settings now documents the `shape` field on the `activeSession`
  blob and what a mismatch costs. `SESSION_SHAPE` was introduced at `2` by
  `b5dab80` (when the side moved onto the session) and bumped to `3` by `b17d84f`
  (when the round followed it); `767b106` reshuffled the nesting without changing
  the layout, so it left the value alone. Both of those events silently discarded
  any workout in progress across the deploy, and nothing in the specs said so.
