# Cloud Sync

Optional Firebase-backed sync so the same data is on the phone and the desktop
without exporting files by hand. The app is fully usable signed out - signing in
is what turns sync on.

## Why whole-blob instead of per-record sync

The entire dataset (every exercise, workout template, and logged session) is a
few kilobytes. One person trains on one device at a time. Per-record merging
would mean tombstones for deletes, per-field conflict rules, and a lot of state
to get subtly wrong, all to solve a problem this app doesn't have.

So the whole export bundle is stored as one JSON string on one document per user,
and `exportAllData`/`importAllData` (already built for the manual backup panel)
do the serializing. The cost of that choice is stated plainly in the UI: when two
devices have both moved on, one copy replaces the other - there is no merging.

## Firestore shape

One document per user at `users/{uid}`:

```
{
  version: number,        // bumped on every successful push
  updatedAt: timestamp,   // serverTimestamp
  deviceLabel: string,    // "iPhone", "Mac" ... names the other side in a conflict
  payloadJson: string,    // JSON.stringify of the exportAllData bundle
}
```

Stored as a string rather than nested objects so Firestore's type restrictions
never come into play, and so a future client-side encryption pass has one field
to encrypt.

`firestore.rules` allows read/write only where `request.auth.uid == userId`, and
denies everything else outright. These rules have to be **published** to the
project (Firebase console -> Firestore -> Rules -> Publish, or `firebase deploy
--only firestore:rules`). Until they are, the project's default rules reject
every read and write, and the app can sign in perfectly while saving nothing.

## Settings keys (local, in `db.settings`)

- `cloudSyncedVersion` - the remote `version` this device last agreed with
- `cloudLocalRevision` - bumped by a Dexie hook on every write to the three data tables
- `cloudSyncedLocalRevision` - the above, captured at the last successful push/pull
- `cloudDeviceLabel` - this device's friendly name

"This device has unsynced work" is `cloudLocalRevision !== cloudSyncedLocalRevision`.
Keeping it in settings rather than memory means it survives a reload, so closing
the app mid-edit doesn't silently lose the fact that there was an edit.

## Reconcile rules

Run on sign-in, on a remote change, and on demand from "Sync now":

| Remote state | This device | Result |
|---|---|---|
| no document | anything | force-push local up |
| `version` == `cloudSyncedVersion` | clean | nothing to do |
| `version` == `cloudSyncedVersion` | dirty | push |
| `version` > `cloudSyncedVersion` | clean | pull |
| `version` > `cloudSyncedVersion` | dirty but locally empty | pull |
| `version` > `cloudSyncedVersion` | dirty with real data | **conflict** - ask the user |

Pushes run inside a Firestore transaction that re-reads `version` and refuses to
write if it moved, so two devices can't overwrite each other by racing. A
conflict is surfaced in the Log tab with two explicit choices: keep this device
(force push) or use the cloud copy (pull).

The "no document" row force-pushes rather than pushing plainly. An ordinary push
compares the remote version against `cloudSyncedVersion` and refuses when they
differ - so a device that remembers version 4 and finds no document at all reads
`0 !== 4` and reports a conflict against a document that doesn't exist, with no
way out: every retry hits the same comparison. Nothing can be lost by writing
over a document that isn't there, so this case skips the guard.

Every sync operation is serialized behind one promise chain. A debounced push, a
tap on Sync now, and a snapshot from another device can all be in flight at once,
and each one reads the synced version, acts, then writes it back; interleaved,
one can act on a version another has already moved past. Serializing keeps each
read-act-write whole. `reconcileIfBehind()` exists for the snapshot listener so
that its "is the remote ahead of us?" test happens inside the lock rather than
before it.

Writes made while applying a pulled snapshot are ignored by the Dexie change
hook, otherwise importing a pull would look like a local edit and bounce straight
back up as a new version.

Local edits are pushed on a 2.5s debounce, so a burst of chip adjustments during
a workout becomes one write rather than twenty. A pending push is flushed
immediately on `visibilitychange` (hidden) and `pagehide` - a workout typically
ends with the phone being put away seconds later, and waiting out the debounce
would strand that last session on the device until the next launch.

Firestore's error codes are translated by `describeSyncError()` before they reach
the screen. `permission-denied` in particular almost always means the rules below
were never published, which is otherwise invisible: the app looks signed in and
simply never saves.

## Setup

`src/lib/firebaseConfig.js` holds the web config. Those values are public by
design - they identify the project, they don't grant access; the rules do that.
Without a config the app runs local-only and the sync UI hides itself entirely.

Local development against the emulators: `VITE_FIREBASE_EMULATOR=1 npm run dev`
alongside `firebase emulators:start --project demo-workout-app --only auth,firestore`.

The Log tab's sync panel reports what the cloud actually holds - counts of
exercises, workouts, and logged sessions, which device wrote them and when - read
back from Firestore on each successful sync rather than inferred from a status
string. "It says synced" and "the data is up there" are different claims, and
only the second one answers the question people actually have.

## Known Issues / Changelog

- **Fixed** - a device could wedge permanently if the cloud document went missing
  (deleted from the console, or a project reset) while the device still
  remembered a version: reconcile reported a conflict against a document that
  didn't exist, and every retry repeated it. Reproduced against the emulator and
  covered by a check.
- **Fixed** - the last write before the app closed could sit unsent until the
  next launch, because the 2.5s push debounce never fired. Pending pushes are now
  flushed when the page is hidden.
- **Fixed** - Firestore error codes reached the screen raw. Unpublished security
  rules, the most likely reason sync silently does nothing, now say so.
- **Investigated, not a defect** - a suspected race where the snapshot listener
  reconciles against this device's own push before it records the version it
  wrote. It does not reproduce: pushes go through a transaction, which Firestore
  does not latency-compensate, so no local echo arrives to race with. The sync
  lock and the `hasPendingWrites` guard were kept anyway - they cost nothing and
  make the ordering explicit rather than incidental.
- **Added** - Google sign-in and whole-blob sync, with the manual export/import
  panel kept as a safety net.
- **Not verified locally** - the Google sign-in popup itself. The sandbox this was
  built in blocks `apis.google.com`, so the popup can't complete there. Everything
  behind it is covered against the emulators with a real signed-in account
  (email/password standing in for the popup): push, pull, conflict, no-loop,
  the listener path, the missing-document recovery, the hidden-page flush, and
  the rules refusing another user's document. The popup itself is stock Firebase
  and fails fast and visibly if the authorized-domain setup is wrong.
- **Open** - Firebase adds ~530KB raw (~160KB gzipped) to the bundle. It should be
  code-split so it only loads when sync is actually configured.
- **By design** - simultaneous edits on two devices resolve as last-write-wins on
  the whole dataset, with a prompt rather than a silent overwrite.
