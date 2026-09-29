# Workout Tracker

**Last updated:** 2026-09-29 · describes commit `5cd7611` (branch HEAD, deployed successfully as Pages run #24).

Everything below was checked against `src/` on this commit. Anything not confirmed
in code is marked **not verified**.

## 1. Overview

Mobile-first, local-first workout tracker. Four tabs: **Library** (templates +
exercises), **Builder** (on-the-fly workout), **Tracker** (run a workout against a
timer), **Log** (history + stats).

| | |
|---|---|
| Stack | React 19, Vite 8, Tailwind 4, react-router-dom 7 |
| Storage | Dexie 4 (IndexedDB), schema v6 — the source of truth, works offline |
| Optional sync | Firebase 12 (Firestore + Google auth), whole-blob per user |
| Deploy | GitHub Pages via Actions, `base: '/Workout-App/'` |
| Live URL | https://appointiveburl8.github.io/Workout-App/ |
| Lint | oxlint (`npx oxlint src`) |

**Not a real PWA.** No `manifest.json`, no service worker — verified absent from
`index.html` and `public/`. It is a normal web page that happens to be
mobile-styled and offline-capable via IndexedDB. "Add to Home Screen" works but
there is no install manifest, offline shell, or app icon set.

## 2. Branch & deploy status

- **Current branch:** `claude/workout-tracker-phase-1-huoto1`
- **Merged to default?** There is **no other branch**. `git branch -a` and
  `git ls-remote --heads origin` show this branch only — no `main` exists on the
  remote. This branch *is* the default branch.
- **Live site vs. branch:** identical. Everything on this branch is live,
  including all Sets × Reps work, cloud sync, the circuit/side rework, the
  lead-in countdown, the audio fixes, and drag-to-reorder.
- **Deploy flow:** push → `.github/workflows/deploy.yml` (triggers on `main` *or*
  this branch) → `npm ci` → `npm run build` → `actions/upload-pages-artifact` →
  `actions/deploy-pages`. Takes ~1 min. Run #24 for `5cd7611` succeeded.

## 3. Data model (as implemented)

Dexie database `WorkoutTrackerDB`, defined in `src/db.js`. **Schema version 6.**

### Indexes (v6 `stores`)

```js
exercises:       '++id, name, *categories'
workoutTemplates:'++id, name, category'
loggedSessions:  '++id, date, templateId, category'
settings:        'key'
```

### Exercise

```js
{ id, name, categories: Array<'kettlebell'|'mobility'|'stretching'>, notes }
```

No timer mode, no sets/reps, no side field — all of that lives on the workout.

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
{ id, date /* ISO */, templateId|null, category, durationSeconds,
  setsCompleted|null /* open_work only */, rpe|null /* 1-10 */, notes }
```

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
| Phase machines (pure) | Done | `src/lib/sessionEngine.js` |
| Session state survives tab switch + reload | Done | `src/lib/activeSessionStore.jsx` |
| Lead-in "get into position" countdown (10s) | Done | `SteppedSession.jsx`, `sessionEngine.js` (`LEAD_IN_SECONDS`) |
| Phase colors | Done | `sessionEngine.js` (`*_PHASE_COLORS`) |
| Sets × Reps plan + live set tracking | Done | `src/lib/setsReps.js`, `SetsRepsEditor.jsx`, `OpenWorkSession.jsx` |
| Log: stats row, category filter, date range, history | Done | `src/pages/Log.jsx`, `src/lib/dateStats.js` |
| Log entry form (after a workout only) | Partial | `src/components/log/LogEntryForm.jsx` — see §7 |
| Backup export / import (JSON file) | Done | `src/components/log/BackupControls.jsx` |
| Cloud sync (Google sign-in, whole-blob) | Done, popup unverified | `src/lib/cloudSync.js`, `cloudSyncStore.jsx`, `components/log/SyncControls.jsx` |
| Audio cues + mute toggle | Done, unverified on iPhone | `src/lib/audioCues.js`, `tracker/MuteToggle.jsx` |
| Sound check diagnostic | Done | `src/components/log/SoundCheck.jsx` |
| Bottom nav (4 rounded cards, filled active, safe-area) | Done | `src/components/BottomNav.jsx` |
| Screen wake lock | **Not started** | — (grep for `wakeLock` returns nothing) |
| Edit / delete a logged session | **Not started** (UI) | db helpers exist, unused — see §7 |
| Rest-day logging | **Not started** | — |

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
- **Pails/Rails sequence:** stretch hold → ramp → PAILs → switch cue → RAILs. ✅
  Colors: hold **yellow**, PAILs **green**, RAILs **red**, ramp/switch **neutral
  gray**. ✅ Interval adds work=indigo, rest=emerald.
- ⚠️ **"Transport controls (pause/resume, prev/next) at bottom in all modes" —
  code differs.** Open Work has Pause/Resume and "End Set / Start Rest" only; it
  has no exercise sequence to step through, and the reducer explicitly rejects
  `NEXT`/`PREV`/`SKIP_PHASE` for `open_work`. Interval and Pails/Rails have the
  full Prev / Pause / Skip / Next row.
- **Bottom nav:** four distinct rounded cards (`rounded-2xl`), filled active state
  (`bg-indigo-600 text-white`), safe-area aware
  (`env(safe-area-inset-bottom)`). ✅
- **iOS ignores vibration; audio is the only reliable cue.** ✅ `navigator.vibrate`
  is called guarded and is a no-op on iOS. Mute persisted in `localStorage`. ✅

## 6. Recent changes

Dated from `git log` (28 commits, 2026-09-02 → 2026-09-29).

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

**Latest (09-26 → 09-29)** — `c117e88` three audio-unlock fixes + Sound check ·
`5cd7611` drag-to-reorder replacing up/down buttons.

## 7. Known bugs & gaps

Answers to the six explicit checks, each verified in code:

**Q: Does manual skip next/prev update round and phase state in all three modes?**
**Interval + Pails/Rails: yes.** `NEXT`/`PREV` go through `atPosition()`, which
sets `currentIndex`, `round` *and* `side` together and rebuilds `stepState` from
scratch. `SKIP_PHASE` advances the phase machine and, when that finishes the
exercise, hands to `afterExercise()` which advances the same position. Round is
correct **by construction** since it moved to session level — it is no longer
possible for the phase machine and the round counter to disagree.
**Open Work: N/A** — the reducer rejects all three actions for `open_work`; there
is no sequence to step.
*Caveat:* there is no dedicated "round-sync fix" commit. `1f7870b` explicitly
records that the reported round-sync bug **could not be reproduced**; the class of
bug was later designed out by `b17d84f`/`767b106`.
*Latent:* `SKIP_PHASE` guards `state.transitioning` but **not** `state.leadIn`.
Unreachable today (the lead-in screen replaces the transport row), but it would
corrupt the first phase if that UI ever changed.

**Q: Does Tracker state survive backgrounding, tab switching, or a page reload?**
**Yes, all three.** `ActiveSessionProvider` is mounted above the router in
`App.jsx`, so switching tabs never unmounts it. State is mirrored to
`db.settings['activeSession']` every 3s and rehydrated on app start.
*Caveat:* the mirror carries a `SESSION_SHAPE` version (currently `3`); a session
stored by a build with a different shape is **discarded** on hydrate rather than
half-restored. So a workout in progress across a deploy is lost by design.
*Caveat:* up to 3s of progress can be lost on a hard kill (the persist interval).
*Not verified:* real iOS backgrounding — timers throttle when a page is hidden and
nothing compensates by wall-clock on resume, so a long background may under-count.

**Q: Is screen wake-lock implemented?** **No.** No `wakeLock` / `NoSleep`
reference anywhere in `src/`. The phone will sleep mid-workout.

**Q: Are Start Workout config fields editable, or read-only?** **Editable.**
`TimerModeConfigFields` renders `<input type="number">` and `<select>` with live
`onChange` for every field of all three modes, plus the Sets × Reps editor. The
mode itself is switchable via `TimerModePicker`. Edits apply to that session only
unless the template is saved separately. A live "Estimated total" recalculates as
fields change (Interval and Pails/Rails only; Open Work has a fixed target).

**Q: Is there any way to log a rest day, or edit/delete a logged session?**
**No to all three.** `LogEntryForm` renders **only** when arriving from the
Tracker (`location.state?.source === 'tracker-end'`) — there is no "add entry"
button, so no manual or rest-day logging. The history list renders no per-session
controls. `updateLoggedSession()` and `deleteLoggedSession()` **exist in
`src/db.js` but are called from nowhere** — dead code awaiting UI.

**Q: Is there a unilateral option for exercises that aren't left/right?**
**Not per exercise.** Side is a workout-level setting, and `sideMode` means three
different things:
- `intervalConfig.sideMode`: `bilateral` | `unilateral` — user-selectable.
- `pailsRailsConfig.sideMode`: **hard-coded `'unilateral'`**, no UI to change it.
  A Pails/Rails workout containing a symmetrical stretch will still run it twice,
  labelled Left then Right, and its duration estimate doubles accordingly.
- `WorkoutTemplate.sideMode`: `bilateral`|`blocked`|`alternating` — this one is
  only a *grouping label* for the Open Work movement list, unrelated to the above.
The three sharing a name is a readability trap for anyone new to the code.

### Other confirmed gaps

- **Bundle size:** 940 KB raw / 282 KB gzipped, Firebase being most of it. Not
  code-split. Noted as open in `specs/05-cloud-sync.md`.
- **No tests in the repo.** All verification this session ran from Playwright
  scripts in a scratch directory, which were not committed.
- **Cloud sync is last-write-wins** on the whole dataset, with a conflict prompt.
  By design, documented.

### Spec vs. code discrepancies

| Where | Spec says | Code does |
|---|---|---|
| `specs/01-data-model.md:51` | Interval `unilateral` "inserts a side step (Left, then Right) **within each round**" | Side is a session-level pass; no side step inside a round, and no `side_switch` phase exists |
| `specs/01-data-model.md:69` | Pails/Rails: "**Every round runs Left, then Right**" | Each round runs the *whole exercise list* left, then the whole list right |
| `specs/04-tracker.md:171` | "Between exercises … an 'Up Next' countdown screen shows" (unqualified) | Interval same-side handovers show none — correctly stated in the same file's Interval section, so the file contradicts itself |
| `specs/04-tracker.md:167` | Stepping resets the machine to "first phase, **round 1**, full duration" | Round is no longer in the phase machine; stepping sets it from the session position |

## 8. Needs on-device testing (iPhone)

**Nothing in this section has been tested on a real device.** There is no iPhone
in the build sandbox. All four are code-complete but unproven.

| Item | Status | What to check |
|---|---|---|
| Audio unlock + playback | **Untested on device.** Verified only in headless Chromium under `--autoplay-policy=document-user-activation-required` | Does the Log tab's **Sound check** report `running`, and do you *hear* the beep? Running + silent ⇒ the ring/silent switch is muting Web Audio, which no app code can override |
| Wake lock | **Not implemented** | Screen will sleep mid-workout |
| PWA safe-area | **Untested.** `env(safe-area-inset-bottom)` is set on the bottom nav and `viewport-fit=cover` in `index.html` | Bottom nav clearing the home indicator on a notched iPhone |
| Backgrounding | **Untested.** Store rehydrates and the audio context resumes on `visibilitychange` | Whether elapsed time stays accurate after a few minutes backgrounded — timers throttle and nothing reconciles against wall-clock |
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
- **Round → side nesting** — settled at round → side → exercise after two
  corrections. Treat as decided.

## 10. File map

```
src/
  App.jsx                      Routes + CloudSyncProvider/ActiveSessionProvider above the router
  main.jsx                     React root
  db.js                        Dexie schema v6, all migrations, every CRUD helper, export/import
  index.css                    Tailwind entry
  pages/
    Library.jsx                Workouts/Exercises toggle, archive, duplicate, delete
    Builder.jsx                On-the-fly exercise list → Start Workout
    StartWorkout.jsx           Mode picker, editable config, duration estimate, "Begin"
    Tracker.jsx                Loads data, picks the mode component, header + MuteToggle
    Log.jsx                    Stats, filters, history; renders LogEntryForm only post-workout
  components/
    BottomNav.jsx              Four rounded cards, safe-area padding
    CategoryBadge.jsx          Category pill
    ExerciseEditor.jsx         Create/edit exercise overlay
    ExerciseForm.jsx           Name, categories, notes
    ExerciseListItem.jsx       One row: drag handle, position number, name, remove
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
      SteppedSession.jsx       Orchestrates Interval/Pails-Rails: countdowns, transport, cues
      MuteToggle.jsx           Mute toggle; unmuting unlocks audio and beeps
      ProgressBar.jsx          Phase progress bar
    log/
      BackupControls.jsx       Export/import JSON + stale-backup reminder
      LogEntryForm.jsx         Post-workout entry (date, category, duration, sets, RPE, notes)
      SoundCheck.jsx           Diagnostic: unlock, play, report AudioContext state
      SyncControls.jsx         Sign in/out, conflict resolution, cloud contents readout
  lib/
    activeSessionStore.jsx     Session reducer + provider; IndexedDB mirror; SESSION_SHAPE
    sessionEngine.js           Pure phase machines, session position, duration estimate
    setsReps.js                Sets × Reps patterns and sequence generation
    reorder.js                 Pure drag-reorder index maths
    audioCues.js               AudioContext unlock/resume, tones, vibration, mute
    cloudSync.js               Push/pull/reconcile, Dexie change hooks, error translation
    cloudSyncStore.jsx         Provider: auth watch, debounced push, conflict state
    firebase.js                App/auth/firestore singletons, emulator wiring
    firebaseConfig.js          Public web config + emulator toggle
    dateStats.js               Week/month counts, streak, local day keys
    sessionConfig.js           Template → session config resolution
    exerciseDraft.js           Exercise form draft shape
    formatDuration.js          formatMMSS
    categories.js              Category labels and colors
    ui.js                      Shared button/input class strings
    useInterval.js             Interval hook
specs/
  01-data-model.md             Schema + migrations (two stale claims — see §7)
  04-tracker.md                Timer modes, circuit/side rules, audio, changelog
  05-cloud-sync.md             Sync design, reconcile table, known issues
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
- **Specs are part of the change, not a follow-up.** Read the relevant file in
  `specs/` before touching that area and update it in the same commit.
- **Before committing:** `npx oxlint src` and `npm run build`. Both must be clean.
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
