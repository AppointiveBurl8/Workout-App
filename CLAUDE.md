# Workout Tracker

**Last updated:** 2026-09-30 · code state describes this branch through the
Skip-removal commit; spec accuracy re-verified at `58cff65` and the fixes that
followed it.

Everything below was checked against `src/` on this commit. Anything not confirmed
in code is marked **not verified**.

## 1. Overview

Mobile-first, local-first workout tracker. Four tabs: **Library** (templates +
exercises), **Builder** (on-the-fly workout), **Tracker** (run a workout against a
timer), **Log** (history + stats).

| | |
|---|---|
| Stack | React 19, Vite 8, Tailwind 4, react-router-dom 7 |
| Storage | Dexie 4 (IndexedDB), schema v8 — the source of truth, works offline |
| Optional sync | Firebase 12 (Firestore + Google auth), whole-blob per user |
| Deploy | GitHub Pages via Actions, `base: '/Workout-App/'` |
| Live URL | https://appointiveburl8.github.io/Workout-App/ |
| Lint | oxlint (`npx oxlint src`) |
| Tests | vitest (`npm test`) — pure logic only |

**Installable PWA** as of the PWA commit: `public/manifest.webmanifest`,
generated icons in `public/icons/`, and a hand-written `public/sw.js` (no
`vite-plugin-pwa`) registered from `main.jsx` in production builds only. The app
shell is cached, so it launches offline; `navigator.storage.persist()` asks the
browser not to evict IndexedDB. See `specs/06-pwa.md`. **Unverified on a real
iPhone** — including whether an installed home-screen app gets its own storage
separate from Safari's, which would make the installed app start with an empty
history. Export a backup or sync before installing.

## 2. Branch & deploy status

- **Current branch:** `claude/workout-tracker-phase-1-huoto1`
- **Merged to default?** There is **no other branch**. `git branch -a` and
  `git ls-remote --heads origin` show this branch only — no `main` exists on the
  remote. This branch *is* the default branch.
- **Live site vs. branch:** identical. Everything on this branch is live,
  including all Sets × Reps work, cloud sync, the circuit/side rework, the
  lead-in countdown, the audio fixes, drag-to-reorder, the wake lock, wall-clock
  timing, the PWA, log editing with rest days, and the per-exercise `sided` flag.
- **Deploy flow:** push → `.github/workflows/deploy.yml` (triggers on `main` *or*
  this branch) → `npm ci` → **`npm test`** → `npm run build` →
  `actions/upload-pages-artifact` → `actions/deploy-pages`. Takes ~1 min.
  Run #29 for `17a6f3a` succeeded (the last one before the test gate went in).
  **A failing test now blocks the deploy** — that's the point of it; the live
  site keeps serving the previous build rather than a broken one.

## 3. Data model (as implemented)

Dexie database `WorkoutTrackerDB`, defined in `src/db.js`. **Schema version 8.**

### Indexes (v8 `stores`, unchanged since v1 apart from `settings`)

```js
exercises:       '++id, name, *categories'
workoutTemplates:'++id, name, category'
loggedSessions:  '++id, date, templateId, category'
settings:        'key'
```

### Exercise

```js
{ id, name, categories: Array<'kettlebell'|'mobility'|'stretching'>,
  sided: boolean /* default true */, notes }
```

No timer mode and no sets/reps — those live on the workout. `sided` is the one
per-exercise side field: "has distinct left and right sides", default `true`, read
as `exercise.sided !== false` everywhere. A symmetrical movement (`false`) runs
**once per round**, in the left pass, and never shows a side label; the right pass
skips it. Named `sided` and not a fourth `sideMode` on purpose — see §7.

### WorkoutTemplate

```js
{
  id, name,
  category: 'kettlebell'|'mobility'|'stretching',
  tags: string[],
  exerciseIds: number[],          // ordered
  archived: boolean,
  defaultTimerMode: 'open_work'|'interval'|'pails_rails',
  intervalConfig:  { workSeconds, restSeconds, rounds, sideMode: 'bilateral'|'unilateral' },
  pailsRailsConfig:{ holdSeconds, rampSeconds, pailsHoldSeconds, railsHoldSeconds,
                     rounds, sideMode: 'unilateral' },   // constant, not user-editable
  openWorkConfig:  { sessionTargetSeconds, restSeconds, setsReps: SetsRepsScheme },
  sideMode: 'bilateral'|'blocked'|'alternating',         // Open Work movement-list grouping only
}
```

Defaults: interval 30s/15s × 5; pails/rails 15/5/20/20 × 3; open work 1200s target,
120s rest.

### SetsRepsScheme (`src/lib/setsReps.js`) — Open Work only

```js
{ pattern: 'straight'|'top_back_off'|'ramp'|'pyramid'|'reverse_pyramid'|'custom',
  sets, reps, percent, customSets: number[] }
```

Default `{ pattern:'straight', sets:3, reps:10, percent:20, customSets:[10,10,10] }`.
No weight tracking anywhere — `percent` drives *reps*, not load. One plan per
workout, never per exercise.

### LoggedSession

```js
{ id, type: 'workout'|'rest', date /* ISO */, templateId|null, category,
  durationSeconds, setsCompleted|null /* open_work only */, rpe|null /* 1-10 */, notes }
```

A **rest day** (`type: 'rest'`) has a date and optional notes and nothing else —
`category: null`, `durationSeconds: 0`. It **bridges a streak without adding to
it** and counts towards no other stat. A row with no `type` is a workout (every
pre-v7 row); `normalizeLoggedSession()` in `src/lib/loggedSession.js` enforces
that on both external entry points, backup import and cloud pull, via
`importAllData()`. See `specs/07-log.md`.

### Settings (key/value, `db.settings`)

`activeSession` (in-progress Tracker session mirror), `lastExportedAt`,
`cloudSyncedVersion`, `cloudLocalRevision`, `cloudSyncedLocalRevision`,
`cloudDeviceLabel`. Audio mute is **not** here — it lives in `localStorage` under
`workout-tracker:audio-muted`.

### Migrations

| v | Change |
|---|---|
| 1 | Initial schema |
| 2 | Added `settings` table; backfilled `pailsRails.holdSeconds` |
| 3 | Timer mode + configs moved off Exercise onto WorkoutTemplate; `Exercise.category` → `categories[]` |
| 4 | Added `intervalConfig.sideMode`; replaced `pailsRailsConfig.side` with constant `sideMode:'unilateral'` |
| 5 | Dropped `Exercise.repsLabel`; added `WorkoutTemplate.setsReps[]` (one per exercise slot) |
| 6 | Replaced that array with a single `openWorkConfig.setsReps`; carries over the first exercise's v5 scheme |
| 7 | Added `LoggedSession.type`, backfilled `'workout'` on every existing row |
| 8 | Added `Exercise.sided`, backfilled `true` on every existing row |

## 4. Features — status table

| Feature | Status | Implemented in |
|---|---|---|
| Library: templates list, archive, duplicate | Done | `src/pages/Library.jsx`, `src/components/TemplateCard.jsx` |
| Library: exercises list, create/edit/delete | Done | `src/pages/Library.jsx`, `src/components/ExerciseEditor.jsx`, `ExerciseForm.jsx` |
| Template editor (name, category, tags, exercises, config) | Done | `src/components/TemplateEditor.jsx` |
| Drag-to-reorder exercises | Done | `src/components/ReorderableExerciseList.jsx`, `src/lib/reorder.js` |
| Builder (on-the-fly workout) | Done | `src/pages/Builder.jsx` |
| Start Workout screen (mode picker + editable config + duration estimate) | Done | `src/pages/StartWorkout.jsx`, `src/components/TimerModeConfigFields.jsx` |
| Tracker — Open Work | Done | `src/components/tracker/OpenWorkSession.jsx` |
| Tracker — Interval | Done | `src/components/tracker/IntervalStep.jsx` + `SteppedSession.jsx` |
| Tracker — Pails/Rails | Done | `src/components/tracker/PailsRailsStep.jsx` + `SteppedSession.jsx` |
| Step sequence + Next/Previous navigation | Done | `sessionEngine.js` (`buildStepSequence`), `goToStep()` in `activeSessionStore.jsx` |
| Per-exercise sided flag (symmetrical movements run once) | Done | `sessionEngine.js` (`buildPasses`), `ExerciseForm.jsx` |
| Wall-clock timing (backgrounded time recovered) | Done, unverified on iPhone | `src/lib/useWallClockTicker.js`, `TICK_N` in `activeSessionStore.jsx` |
| Session state survives tab switch + reload | Done | `src/lib/activeSessionStore.jsx` |
| Lead-in "get into position" countdown (10s) | Done | `SteppedSession.jsx`, `sessionEngine.js` (`LEAD_IN_SECONDS`) |
| Phase colors | Done | `sessionEngine.js` (`*_PHASE_COLORS`) |
| Sets × Reps plan + live set tracking | Done | `src/lib/setsReps.js`, `SetsRepsEditor.jsx`, `OpenWorkSession.jsx` |
| Log: stats row, category filter, date range, history | Done | `src/pages/Log.jsx`, `src/lib/dateStats.js` |
| Log entry form (post-workout, add, edit) | Done | `src/components/log/LogEntryForm.jsx` |
| Backup export / import (JSON file) | Done | `src/components/log/BackupControls.jsx` |
| Cloud sync (Google sign-in, whole-blob) | Done, popup unverified | `src/lib/cloudSync.js`, `cloudSyncStore.jsx`, `components/log/SyncControls.jsx` |
| Audio cues + mute toggle | Done, unverified on iPhone | `src/lib/audioCues.js`, `tracker/MuteToggle.jsx` |
| Sound check diagnostic | Done | `src/components/log/SoundCheck.jsx` |
| Bottom nav (4 rounded cards, filled active, safe-area) | Done | `src/components/BottomNav.jsx` |
| PWA install manifest + icons | Done, unverified on iPhone | `public/manifest.webmanifest`, `public/icons/`, `scripts/make-icons.mjs` |
| Offline app shell (service worker) | Done | `public/sw.js`, registered in `src/main.jsx` |
| Persistent-storage request | Done | `src/main.jsx` (`navigator.storage.persist()`) |
| Screen wake lock | Done, unverified on iPhone | `src/lib/useWakeLock.js`, held by `activeSessionStore.jsx` |
| Edit / delete a logged session | Done | `LogEntryForm.jsx` (edit mode, two-step delete), `Log.jsx` |
| Rest-day logging | Done | `src/lib/loggedSession.js`, `LogEntryForm.jsx` |

## 5. Locked design decisions

Kept as stated unless the code contradicts them. Two do.

- Timer mode is chosen **per session** on Start Workout, defaulting to the
  template's `defaultTimerMode`. Never fixed to an exercise. ✅ matches code.
- `intervalConfig` / `pailsRailsConfig` live on **WorkoutTemplate**. ✅
- Exercises can have **multiple categories**. ✅ (`categories[]`, `*categories` index)
- **Open Work:** work timer counts **up**, fixed rest counts **down**, hard stop at
  `sessionTargetSeconds`, static movement list, no per-movement timers or
  checkboxes, no "up next" transition. `sideMode`: bilateral / blocked /
  alternating. ✅ all confirmed in `OpenWorkSession.jsx`.
- **Interval + Pails/Rails:** tappable chips with inline +/- steppers
  (`AdjustableChip.jsx`), durations as M:SS (`formatMMSS`). ✅
- ⚠️ **"10-second 'up next' transition between exercises" — code differs.**
  `needsTransitionCountdown()` in `sessionEngine.js` returns `false` for an
  **Interval** handover that doesn't change side, because an Interval exercise
  always ends on its configured Rest and that Rest *is* the gap — stacking a
  countdown on it meant resting twice between every movement. Pails/Rails gets
  the countdown on every handover (it ends on a hold); **any** side change gets
  one. Deliberate, introduced with the circuit rework.
- ⚠️ **"Pails/Rails is always unilateral" — now qualified.** The mode is still
  always unilateral, but that means "honour the per-exercise `sided` flags", not
  "run everything twice". A Pails/Rails workout of symmetrical stretches runs a
  single unlabelled pass.
- **Pails/Rails sequence:** stretch hold → ramp → PAILs → switch cue → RAILs. ✅
  Colors: hold **yellow**, PAILs **green**, RAILs **red**, ramp/switch **neutral
  gray**. ✅ Interval adds work=indigo, rest=emerald.
- **Transport controls (Previous / Pause-Resume / Next) at the bottom in all
  modes.** ✅ as of the Skip-removal commit — including Open Work, whose steps are
  its work blocks and rests. **There is no Skip**: it overlapped with Next and
  everything it did, Next does. Open Work keeps "End Set / Start Rest" as well,
  because it names what it counts and Next doesn't.
- **Bottom nav:** four distinct rounded cards (`rounded-2xl`), filled active state
  (`bg-indigo-600 text-white`), safe-area aware
  (`env(safe-area-inset-bottom)`). ✅
- **iOS ignores vibration; audio is the only reliable cue.** ✅ `navigator.vibrate`
  is called guarded and is a no-op on iOS. Mute persisted in `localStorage`. ✅

## 6. Recent changes

Dated from `git log` (34 commits, 2026-09-02 → 2026-09-30).

**Foundation (09-02)** — `dc720fe` scaffold · `422ff2b` Tailwind + Dexie + 4-tab
shell · `c738d1d` Library · `160c414` Builder · `2a047df` Tracker (three modes) ·
`b0b8e6e` Log + session-end handoff.

**Polish & infrastructure (09-02 → 09-03)** — `9efb7f7` mobile polish + Pages
deploy · `face9f8` Pails/Rails stretch-hold phase · `b3265f2` backup
export/import · `927838e` audio + vibration cues · `c3099a0` timer mode decoupled
from exercises, multi-category movements, side patterns · `1f7870b` **phase
colors** (same commit notes the round-sync bug could not be reproduced) ·
`ce7104a` session persistence across tabs, Next/Prev fix, Pails/Rails transport,
unilateral sides, total-duration estimate, start gate.

**Sets × Reps (09-04 → 09-05)** — `33f510a` moved to template, per exercise ·
`15763c2` Top/Back-off + Ramp compute real sequences · `de68350` corrected to one
workout-wide plan, Open Work only (db v6) · `19925ab` live set tracking on the
Tracker · `0936694` collapsed two conflicting set numbers into one.

**Cloud sync (09-08 → 09-09)** — `6f2a950` whole-blob Firebase sync + rules ·
`d147a16` real project config · `a1dc73a` fixed missing-document wedge + lost
last write + plain-language errors · `e7d2cad` fixed restores never syncing
(Dexie hook wrote outside the import transaction).

**Tracker rework (09-11 → 09-12)** — `5f3dfdc` 10s get-into-position countdown ·
`b5dab80` side moved to session level + rest timer names what's next · `b17d84f`
a round became one pass through every exercise · `767b106` corrected nesting to
round → side → exercise.

**Audio & reordering (09-26 → 09-29)** — `c117e88` three audio-unlock fixes +
Sound check · `5cd7611` drag-to-reorder replacing up/down buttons.

**Docs sweep (09-29 → 09-30)** — `171b038` CLAUDE.md rewritten as a verifiable
handoff · `58cff65` four spec statements the circuit rework left behind ·
`948a271` three more §Settings drifts in the data model spec.

**Device & durability (09-30)** — `f1a076a` screen wake lock for the life of a
session · `de04778` wall-clock timing so backgrounded time is recovered
(`TICK_N`) · `81287d0` installable PWA: manifest, icons, service worker,
`storage.persist()`.

**Log & sides (09-30)** — `adf0a15` add/edit/delete log entries + rest days
(db v7) and the first tests in the repo · `17a6f3a` per-exercise `sided` flag,
session position reworked to `(round, passIndex, indexInPass)` (db v8) ·
`c977293` `npm test` gating the deploy.

**Transport (09-30)** — Skip removed; a session became a flat list of steps and
Next/Previous the only navigation, in all three modes.

## 7. Known bugs & gaps

Answers to the six explicit checks, each verified in code:

**Q: Does Next/Previous update round and phase state in all three modes?**
**Yes, by construction.** A session is a flat list of steps built by
`buildStepSequence()`, and the round, pass, side, exercise and phase are all
*fields on the step* — nothing is derived separately, so nothing can disagree.
Next, Previous and a timer running out all go through the single `goToStep()`,
which only moves an index. Open Work has no step list (a work block counts up
with no set length), so its two phases are its steps and Next/Previous move
between them.
*Caveat:* there is no dedicated "round-sync fix" commit to point at. `1f7870b`
explicitly records that the reported round-sync bug **could not be reproduced**;
the class of bug was designed out by `b17d84f`/`767b106` and then designed out
again, more thoroughly, by the step list.

**Q: Does Tracker state survive backgrounding, tab switching, or a page reload?**
**Yes, all three.** `ActiveSessionProvider` is mounted above the router in
`App.jsx`, so switching tabs never unmounts it. State is mirrored to
`db.settings['activeSession']` every 3s and rehydrated on app start.
*Caveat:* the mirror carries a `SESSION_SHAPE` version (currently `5`); a session
stored by a build with a different shape is **discarded** on hydrate rather than
half-restored. So a workout in progress across a deploy is lost by design.
*Caveat:* up to 3s of progress can be lost on a hard kill (the persist interval).
*Backgrounding no longer under-counts.* Ticks are measured against `Date.now()`
by `useWallClockTicker` and replayed through the existing single-tick path as
`TICK_N`, so a throttled or suspended page lands exactly where a foreground run
would have. A rehydrate deliberately does **not** catch up — the mirrored blob
carries no timestamp, so a reload resumes from the mirror rather than
fast-forwarding to now.
*Not verified:* real iOS backgrounding. Verified in Chromium against Playwright's
clock API (`install` + `pauseAt` to freeze it; `fastForward` is the documented
stand-in for a suspended tab), not on a device.

**Q: Is screen wake-lock implemented?** **Yes**, as of the wake-lock commit.
`useWakeLock()` is called by `ActiveSessionProvider` (not the Tracker page, which
unmounts on a tab switch) for as long as `session.status === 'active'` - paused,
lead-in and transition screens included - and releases on the session ending. It
re-acquires on `visibilitychange` (the OS drops the lock whenever the page hides)
and on the next `pointerdown` (some states reject a request without a recent
gesture). A "Screen on" dot in the Tracker header shows when a lock is actually
held, and nothing at all when denied or unsupported.
*Caveat:* this stops the auto-sleep timer only. The side button still locks the
phone and suspends JS.
*Not verified:* on a real iPhone. Headless Chromium refuses a real
`wakeLock.request()`, so the acquire/release/re-acquire wiring was verified
against a recording stub, not the platform API.

**Q: Are Start Workout config fields editable, or read-only?** **Editable.**
`TimerModeConfigFields` renders `<input type="number">` and `<select>` with live
`onChange` for every field of all three modes, plus the Sets × Reps editor. The
mode itself is switchable via `TimerModePicker`. Edits apply to that session only
unless the template is saved separately. A live "Estimated total" recalculates as
fields change (Interval and Pails/Rails only; Open Work has a fixed target).

**Q: Is there any way to log a rest day, or edit/delete a logged session?**
**Yes to all three**, as of the log-editing commit. An **Add entry** button on the
Log opens `LogEntryForm` in `add` mode, with a Workout / Rest day toggle; every
history row is a 44px button opening the same form in `edit` mode, which carries
a two-step delete ("Tap again to delete", four-second window, no undo).
`updateLoggedSession()` / `deleteLoggedSession()` are no longer dead — they're
what edit and delete call, and going through Dexie means the cloud-sync change
hooks fire on all three operations (verified).
A **rest day** bridges a streak without adding to it and counts towards nothing
else. Full rules in `specs/07-log.md`.

**Q: Is there a unilateral option for exercises that aren't left/right?**
**Yes**, as of the `sided` commit: `Exercise.sided` (default `true`) marks whether
a movement has distinct sides. Untick it and the exercise runs **once per round**,
in the left pass at its list position, with no side label anywhere — the right
pass skips it, and the duration estimate counts it once. A workout where nothing
is sided runs a single unlabelled pass. `buildPasses()` in `sessionEngine.js` is
the single source of truth; the session position indexes into the *pass*, not the
exercise list, which is what lets the right pass be a shorter list.

The exercise list (with its flags) is snapshotted onto the session at start, so
editing an exercise mid-workout can't reshape the circuit. Names still resolve
live.

`sideMode` still means three different things, which is why the new field isn't a
fourth one:
- `intervalConfig.sideMode`: `bilateral` | `unilateral` — user-selectable. Under
  `bilateral` the `sided` flag is ignored entirely.
- `pailsRailsConfig.sideMode`: **hard-coded `'unilateral'`**, no UI to change it.
  It now means "honour the per-exercise flags" rather than "run everything twice".
- `WorkoutTemplate.sideMode`: `bilateral`|`blocked`|`alternating` — only a
  *grouping label* for the Open Work movement list, unrelated to the above.
**Open Work ignores `sided` completely** — its movement list is a static
reference with no sequencing to skip. **Decided to stay that way** (owner
confirmed, 2026-09-30), not an open question; see `specs/04-tracker.md`.

### Other confirmed gaps

- **Bundle size:** 940 KB raw / 282 KB gzipped, Firebase being most of it. Not
  code-split. Noted as open in `specs/05-cloud-sync.md`.
- **Playwright verification is not committed.** The end-to-end runs live in a
  scratch directory. `npm test` covers pure logic only — the date/streak helpers
  and the logged-session normalizer — not components or the database.
- **Cloud sync is last-write-wins** on the whole dataset, with a conflict prompt.
  By design, documented.

### Spec vs. code discrepancies

**None known as of `2026-09-30`.** The two the `sided` work was expected to fix —
"Interval unilateral is a session-level pass" and "Pails/Rails is round → side →
exercise, not every round runs Left then Right" — were **already corrected** in
`58cff65` and `948a271`; both specs were re-read to confirm before this commit
rather than re-fixed. What did need updating was the opposite direction: the
sections were correct about the old behaviour and this commit changed it.

Seven earlier ones were found and fixed across two commits
— four from the side/round rework (`b5dab80`, `b17d84f`, `767b106`) leaving stale
prose in both specs, and three in `specs/01-data-model.md` §Settings (a mute flag
documented in the wrong storage, a missing `lastExportedAt` key, and the
undocumented `shape`-mismatch discard). Each spec's Changelog section records
what was corrected and why.

What was re-checked against `src/` when closing this out, all matching: the three
mode-config defaults and every `SIDE_MODES`/`TIMER_MODES`/category constant;
`defaultSetsRepsScheme()` and `PYRAMID_STEP`; the `LoggedSession` fields
`addLoggedSession` actually writes; `SWITCH_SECONDS`/`TRANSITION_SECONDS`/
`LEAD_IN_SECONDS`; the Pails/Rails phase order and every phase color; both
duration formulas; all six `unlockAudio()` call sites; and for cloud sync the
debounce, payload warn threshold, Firestore document fields, settings key names
and `firestore.rules`.

Absence of *known* discrepancies is not proof of none — this was a claim-by-claim
read, not a test suite. Re-run the sweep after any behavior change, per the
`/specs` search rule in §11.

## 8. Needs on-device testing (iPhone)

**Nothing in this section has been tested on a real device.** There is no iPhone
in the build sandbox. All four are code-complete but unproven.

| Item | Status | What to check |
|---|---|---|
| Audio unlock + playback | **Untested on device.** Verified only in headless Chromium under `--autoplay-policy=document-user-activation-required` | Does the Log tab's **Sound check** report `running`, and do you *hear* the beep? Running + silent ⇒ the ring/silent switch is muting Web Audio, which no app code can override |
| Wake lock | **Untested on device.** Verified in headless Chromium against a stubbed `navigator.wakeLock`, since the real one refuses there | Start a workout, leave the phone alone for 2 minutes: the screen stays on and the header shows "Screen on" |
| Install to home screen | **Untested.** Manifest, icons and SW verified in Chromium against `vite preview` | Delete the old icon, re-add from Safari's Share sheet. New kettlebell icon, opens without Safari chrome. **Export a backup or sync first** — an installed app may get storage separate from Safari's |
| Offline launch | **Untested on device.** Verified in Chromium with the network cut | Airplane mode, force-quit, reopen: the app loads and history is intact |
| PWA safe-area | **Untested.** `env(safe-area-inset-bottom)` is set on the bottom nav and `viewport-fit=cover` in `index.html` | Bottom nav clearing the home indicator on a notched iPhone |
| Backgrounding | **Untested on device.** Wall-clock ticker verified in Chromium under Playwright's clock API | Lock the phone mid-Interval for 60s and unlock: phase and elapsed should have moved ~60s. Cues that fell during the lock are gone for good — iOS suspends audio too |
| Google sign-in popup | **Untested.** Sandbox blocks `apis.google.com` | Sign-in completing on Safari; `appointiveburl8.github.io` must be in Firebase's Authorized domains |

## 9. Pending decisions

- **Kettlebell load tracking** — currently none. `percent` in a Sets × Reps scheme
  drives reps, not weight. Owner has two 30 lb kettlebells and previously said
  weight tracking isn't wanted; revisit only if that changes.
- **Early-exit partial round logging** — "End Workout" logs
  `sessionElapsedSeconds` and, for Open Work, `setsCompleted`. A partially
  completed round is not recorded as partial; rounds/sides reached aren't stored
  on `LoggedSession` at all.
- **Session resume behavior** — currently: silently resume if the shape matches,
  silently discard if not. No "you have a workout in progress, resume or discard?"
  prompt. Also undecided whether a very old mirrored session should expire.
- **Interval handover countdown** — dropped for same-side handovers (§5). Flagged
  to the owner for confirmation; no response yet.
- **Open Work's "End Set / Start Rest"** — kept alongside Next, which does the
  same thing during a set. Next doesn't say what it counts and that button does.
  Flagged in `specs/04-tracker.md`; drop it if the duplication grates.
- **Round → pass → exercise nesting** — settled after two corrections, then
  generalised from "side" to "pass" when `sided` landed. Treat as decided.
- **Open Work and `sided`** — decided 2026-09-30: Open Work's movement list
  ignores the flag and stays as it is. Closed, not pending.

## 10. File map

```
src/
  App.jsx                      Routes + CloudSyncProvider/ActiveSessionProvider above the router
  main.jsx                     React root
  db.js                        Dexie schema v8, all migrations, every CRUD helper, export/import
  index.css                    Tailwind entry
  pages/
    Library.jsx                Workouts/Exercises toggle, archive, duplicate, delete
    Builder.jsx                On-the-fly exercise list → Start Workout
    StartWorkout.jsx           Mode picker, editable config, duration estimate, "Begin"
    Tracker.jsx                Loads data, picks the mode component, header + MuteToggle
    Log.jsx                    Stats, filters, tappable history; Add entry + the edit overlay
  components/
    BottomNav.jsx              Four rounded cards, safe-area padding
    CategoryBadge.jsx          Category pill
    ExerciseEditor.jsx         Create/edit exercise overlay
    ExerciseForm.jsx           Name, categories, has-left/right-sides, notes
    ExerciseListItem.jsx       One row: drag handle, position, name, "Both sides" chip, remove
    ExercisePicker.jsx         Autocomplete + inline create
    ReorderableExerciseList.jsx Pointer-event drag reorder + keyboard fallback
    SetsRepsEditor.jsx         Sets × Reps overlay (patterns, table, preview)
    TemplateCard.jsx           Library card; unlocks audio on tap
    TemplateEditor.jsx         Full template editor overlay
    TimerModeConfigFields.jsx  Mode picker + per-mode config inputs
    tracker/
      AdjustableChip.jsx       Value chip with +/- steppers
      IntervalStep.jsx         Presentational: phase, side, round, next-up, chips
      PailsRailsStep.jsx       Presentational: phase, side, round, chips
      OpenWorkSession.jsx      Count-up work, count-down rest, set tracking, movement list
      SteppedSession.jsx       Reads the step list: countdowns, Prev/Pause/Next, cues
      MuteToggle.jsx           Mute toggle; unmuting unlocks audio and beeps
      ProgressBar.jsx          Phase progress bar
    log/
      BackupControls.jsx       Export/import JSON + stale-backup reminder
      LogEntryForm.jsx         One form, three modes: post-workout, add, edit (+ two-step delete)
      SoundCheck.jsx           Diagnostic: unlock, play, report AudioContext state
      SyncControls.jsx         Sign in/out, conflict resolution, cloud contents readout
  lib/
    activeSessionStore.jsx     Session reducer + provider; IndexedDB mirror; SESSION_SHAPE
    sessionEngine.js           Pure step sequence, passes, phase colours, duration estimate
    setsReps.js                Sets × Reps patterns and sequence generation
    reorder.js                 Pure drag-reorder index maths
    audioCues.js               AudioContext unlock/resume, tones, vibration, mute
    cloudSync.js               Push/pull/reconcile, Dexie change hooks, error translation
    cloudSyncStore.jsx         Provider: auth watch, debounced push, conflict state
    firebase.js                App/auth/firestore singletons, emulator wiring
    firebaseConfig.js          Public web config + emulator toggle
    dateStats.js               Week/month counts, streak, local day keys, local-noon dates
    sessionConfig.js           Template → session config resolution
    exerciseDraft.js           Exercise form draft shape + the `sided` normalizer
    formatDuration.js          formatMMSS
    categories.js              Category labels and colors
    loggedSession.js           Rest-day shape + the pre-v7 `type` normalizer
    ui.js                      Shared button/input class strings
    useWallClockTicker.js      The one timer that advances session state
    useWakeLock.js             Screen wake lock held for the life of a session
public/
  manifest.webmanifest         Install manifest (relative start_url/scope)
  sw.js                        Offline shell: network-first pages, cache-first assets
  icons/icon.svg               Icon source; the PNGs beside it are generated + committed
  404.html                     GitHub Pages deep-link redirect (predates the SW)
scripts/
  make-icons.mjs               Renders icon.svg to the PNG sizes; run by hand, not in the build
specs/
  01-data-model.md             Schema + migrations + settings keys; Changelog for doc corrections
  04-tracker.md                Timer modes, circuit/side rules, audio, wake lock, wall-clock timing
  05-cloud-sync.md             Sync design, reconcile table, known issues
  06-pwa.md                    Manifest, icons, caching strategy, iOS caveats
  07-log.md                    Entry types, rest-day/streak rules, the three form modes
vitest.config.js               Test runner config (src/**/*.test.js, node env)
src/test-setup.js              Pins TZ to America/New_York so the DST tests mean something
firestore.rules                users/{uid} readable/writable only by that uid
firebase.json                  Emulator ports + rules path
.github/workflows/deploy.yml   Build + deploy to Pages
```

## 11. Conventions

- **Comments:** none beyond a short line explaining a non-obvious *why*.
- **Session state** that must survive leaving the Tracker tab lives in
  `src/lib/activeSessionStore.jsx` (app-level context above the router), never in
  the Tracker page or a child component.
- **Pure timer/phase logic** lives in `src/lib/sessionEngine.js`, free of React so
  it can be reasoned about independently of rendering. Same principle for
  `reorder.js` and `setsReps.js`.
- **One timer advances session state**, the wall-clock ticker in
  `activeSessionStore.jsx`. Don't add a `setInterval` that moves the clock
  forward anywhere else — it would count callbacks, which under-counts the moment
  the page is backgrounded, and it would sidestep the `TICK_N` catch-up. Cues
  must stay derived from comparing previous to next state, never from tick
  counts, or a catch-up turns into a burst of beeps.
- **Specs are part of the change, not a follow-up.** Read the relevant file in
  `specs/` before touching that area and update it in the same commit.
- **Before committing any change to tracker behavior, search `/specs` for every
  term the change affects (e.g. side, round, phase, countdown) and update each hit
  in the same commit.** Updating the section you were reading is not enough: the
  side/round rework (`b5dab80`, `b17d84f`, `767b106`) left four stale statements
  behind in two files, including one where `04-tracker.md` contradicted itself.
- **Pure logic gets a test; components don't.** `npm test` (vitest) covers
  `src/lib/*` only — no UI, no Dexie. A test that needs a browser or a database
  belongs in a Playwright script instead.
- **Before committing:** `npx oxlint src`, `npm run build` and `npm test`. All
  three must be clean.
  Two `react(only-export-components)` fast-refresh warnings on the two context
  files are pre-existing and expected.
- **Run locally:** `npm install` then `npm run dev` → http://localhost:5173/Workout-App/
  Against Firebase emulators: `VITE_FIREBASE_EMULATOR=1 npm run dev` alongside
  `npx firebase emulators:start --project demo-workout-app --only auth,firestore`.
- **Deploy:** push to this branch; Actions builds and publishes. No manual step.
- **Commit style:** imperative subject describing the behavior change (not the
  files touched), then a body explaining *why* and what was verified. Bodies end
  with the `Co-Authored-By:` and `Claude-Session:` trailers.
- **Bump `SESSION_SHAPE`** in `activeSessionStore.jsx` whenever the active-session
  object changes shape, or an in-flight workout will half-restore across a deploy.
- **Bump `CACHE` in `public/sw.js`** only when the `SHELL` list changes. Ordinary
  code changes don't need it — hashed asset names self-invalidate and
  `index.html` is network-first.
- **Icons are generated, not hand-drawn.** Edit `public/icons/icon.svg`, run
  `node scripts/make-icons.mjs`, commit the PNGs. The build must never depend on
  `sharp`.
