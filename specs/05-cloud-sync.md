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
denies everything else outright.

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
| no document | anything | push local up |
| `version` == `cloudSyncedVersion` | clean | nothing to do |
| `version` == `cloudSyncedVersion` | dirty | push |
| `version` > `cloudSyncedVersion` | clean | pull |
| `version` > `cloudSyncedVersion` | dirty but locally empty | pull |
| `version` > `cloudSyncedVersion` | dirty with real data | **conflict** - ask the user |

Pushes run inside a Firestore transaction that re-reads `version` and refuses to
write if it moved, so two devices can't overwrite each other by racing. A
conflict is surfaced in the Log tab with two explicit choices: keep this device
(force push) or use the cloud copy (pull).

Writes made while applying a pulled snapshot are ignored by the Dexie change
hook, otherwise importing a pull would look like a local edit and bounce straight
back up as a new version.

Local edits are pushed on a 2.5s debounce, so a burst of chip adjustments during
a workout becomes one write rather than twenty.

## Setup

`src/lib/firebaseConfig.js` holds the web config. Those values are public by
design - they identify the project, they don't grant access; the rules do that.
Without a config the app runs local-only and the sync UI hides itself entirely.

Local development against the emulators: `VITE_FIREBASE_EMULATOR=1 npm run dev`
alongside `firebase emulators:start --project demo-workout-app --only auth,firestore`.

## Known Issues / Changelog

- **Added** - Google sign-in and whole-blob sync, with the manual export/import
  panel kept as a safety net.
- **Not verified locally** - the Google sign-in popup itself. The sandbox this was
  built in blocks `apis.google.com`, so the popup can't complete there. The sync
  engine (push/pull/conflict/no-loop) and the security rules are both covered by
  emulator tests; the popup is stock Firebase and fails fast and visibly if the
  authorized-domain setup is wrong.
- **Open** - Firebase adds ~530KB raw (~160KB gzipped) to the bundle. It should be
  code-split so it only loads when sync is actually configured.
- **By design** - simultaneous edits on two devices resolve as last-write-wins on
  the whole dataset, with a prompt rather than a silent overwrite.
