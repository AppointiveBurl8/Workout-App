# Log: history, stats, and editing it

The Log tab is the history of what was actually done, the handful of stats drawn
from it, and — as of the log-editing commit — the only place any of it can be
corrected.

Before that, a logged session could only be created by finishing a workout on
the Tracker, and could never be changed or removed. A mistyped duration was
permanent, a session logged on the wrong day stayed there, and the test sessions
from building the app sat in the history for good.

## Entry types

A logged session is one of two things, carried on `LoggedSession.type`:

| `type` | What it is |
|---|---|
| `'workout'` | Training that happened. Has a category, a duration, optionally sets/RPE/notes. |
| `'rest'` | A deliberate day off. Has a date and optional notes, and nothing else. |

A row with no `type` at all is a workout — that is every row written before v7.
See "Rows from elsewhere" below.

### What a rest day does, and doesn't

**A rest day bridges a streak. It does not add to it.**

That is the whole point of the feature: taking a planned day off shouldn't read
as failure, but it isn't training either. So:

- It keeps the streak alive across that day.
- It does **not** increment the streak.
- It counts towards **nothing** else — not this week, not this month, not total
  time, not any category breakdown. `workoutsOnly()` in `dateStats.js` is the
  filter, and every count and sum goes through it.
- It has no category, so a category filter is by definition a workout filter —
  rest days appear only under **All**.

A streak made entirely of rest days is 0.

## Streak rule

`currentStreak(sessions, today)` in `src/lib/dateStats.js` walks back a day at a
time from today:

- a workout day: `streak += 1`
- a rest day: skip over it, count unchanged
- an empty day: stop — **except today**, which is allowed to be empty, so the
  streak doesn't read 0 every morning before training

The walk is capped at `MAX_STREAK_LOOKBACK_DAYS` (ten years), which only matters
for a history of nothing but rest days.

## Dates

Manual and rest entries are stored at **local noon** of the chosen day
(`dateInputToISO`). Noon rather than midnight so the stored instant cannot land
on the neighbouring calendar day after a timezone change or a DST shift — an
entry twelve hours from either boundary survives both.

The components are read off the string and passed to the `Date` constructor
individually, never `new Date('2026-09-30')`, which parses as **UTC** and shows
up as the 29th anywhere west of Greenwich. There is a test for exactly that.

Two rules follow:

- **Editing an entry whose day is unchanged keeps its original timestamp.** Only
  a real day change moves it, and then to noon. Fixing a typo in the notes
  doesn't quietly restamp the session.
- **No future dates.** The date input is capped at today, and the form refuses
  one anyway in case the cap is bypassed.

The post-workout hand-off from the Tracker is unchanged: it still stores the
actual time of day, because it knows it.

## The form

One component, `src/components/log/LogEntryForm.jsx`, in three modes. Kept as one
so the three can't drift apart in what they accept:

| Mode | Where from | Shape |
|---|---|---|
| `post-workout` | the Tracker redirect (`location.state.source === 'tracker-end'`) | in the page flow, Discard / Save. Behaviour unchanged from before this feature. |
| `add` | the **Add entry** button on the Log | overlay, with the Workout / Rest day toggle |
| `edit` | tapping any history row | overlay, type fixed, with Delete |

Validation, shown inline above the save button rather than in a dialog:

- a date is required, and can't be in the future
- a workout needs a category — the picker starts unset on purpose, since a
  silently pre-selected one mis-files the entry and the mistake is invisible
  until the stats look wrong
- duration can't be negative; RPE is 1–10 or absent (tapping the selected number
  clears it, which is the only way back to "not recorded")
- a rest day is refused on a day that already has a workout, and a second rest
  day is refused on a day that already has one

Note the asymmetry: a **workout** is *not* blocked on a day already marked as
rest. Logging a rest day and then training anyway is a thing that happens, and
the streak resolves it correctly on its own (a day in both sets counts as a
workout). The stale rest row is then the user's to delete.

### Deleting

Delete lives at the bottom of the edit overlay in destructive styling. The first
tap changes the label to **"Tap again to delete"** for four seconds; a second tap
in that window deletes, otherwise it reverts. There is no undo, and a
`window.confirm` is easier to dismiss by reflex on a phone than a label that
changes under your thumb.

## History rows

Every row is a button with a 44px minimum target and a chevron, and opens the
edit overlay. A rest day renders as one muted line — "Rest day", the date, and
notes if there are any — with no duration and no category badge, because it has
neither.

## Rows from elsewhere

`normalizeLoggedSession()` in `src/lib/loggedSession.js` maps anything that isn't
explicitly `'rest'` to `'workout'`. It runs in `importAllData()`, which is the
single funnel for **both** external paths — a restored backup file and a cloud
pull — so a pre-v7 backup and a blob written by a phone on an older build both
land correctly. `getLoggedSessions()` normalizes on the way out too, so nothing
in the UI has to think about it.

The export format has no version field and didn't gain one: the shape is
additive and the normalizer makes old files readable, so there is nothing for a
version to gate.

## Tests

`src/lib/dateStats.test.js` and `src/lib/loggedSession.test.js`, run with
`npm test` (vitest, pure logic only — no UI, no database).

The suite sets `TZ=America/New_York` in `src/test-setup.js`, and the first test
asserts that the zone really does observe DST. Under UTC the DST cases would
pass without testing anything, and a vacuous test is worse than no test.

## Changelog

- **Added** — rest days, and adding, editing and deleting log entries. The Log
  was previously append-only from the Tracker. Dexie v7 adds
  `LoggedSession.type`; existing rows are backfilled `'workout'`.
- **Added** — vitest, and the first tests in the repo: 32 covering the streak
  rule, rest-day exclusion from counts and totals, the local-noon date helper
  across both DST transitions, and the normalizer.
