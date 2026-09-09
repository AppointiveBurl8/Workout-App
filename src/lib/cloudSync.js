import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db, exportAllData, getSetting, importAllData, setSetting } from '../db'
import { auth, firestore } from './firebase'

/**
 * Whole-dataset sync: the entire export bundle is stored as one JSON string on a
 * single Firestore document per user. The data is kilobytes, and one user only
 * trains on one device at a time, so per-record merging would be a lot of moving
 * parts to solve a problem that doesn't exist here. Instead every push is guarded
 * by a version number - if the remote moved on since this device last agreed with
 * it, the push is refused and surfaced as a conflict for the user to settle.
 */

const SYNCED_VERSION_KEY = 'cloudSyncedVersion'
const LOCAL_REVISION_KEY = 'cloudLocalRevision'
const SYNCED_REVISION_KEY = 'cloudSyncedLocalRevision'
const DEVICE_LABEL_KEY = 'cloudDeviceLabel'

/** Firestore caps a document at 1MB; warn well before the sync starts failing. */
const PAYLOAD_WARN_BYTES = 700_000

const DATA_TABLES = ['exercises', 'workoutTemplates', 'loggedSessions']

// Set while a remote pull is being written into Dexie, so importing a pulled
// snapshot doesn't look like a local edit and bounce straight back up.
let applyingRemote = false
let hooksInstalled = false
const changeListeners = new Set()

function detectDeviceLabel() {
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android phone'
  if (/Macintosh/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return 'This device'
}

export async function getDeviceLabel() {
  const stored = await getSetting(DEVICE_LABEL_KEY)
  if (stored) return stored
  const label = detectDeviceLabel()
  await setSetting(DEVICE_LABEL_KEY, label)
  return label
}

async function bumpLocalRevision() {
  const current = (await getSetting(LOCAL_REVISION_KEY)) ?? 0
  await setSetting(LOCAL_REVISION_KEY, current + 1)
  for (const cb of changeListeners) cb()
}

/** Every write to the three data tables marks this device as having unsynced work. */
export function installLocalChangeHooks() {
  if (hooksInstalled) return
  hooksInstalled = true
  for (const name of DATA_TABLES) {
    const table = db.table(name)
    for (const event of ['creating', 'updating', 'deleting']) {
      table.hook(event, () => {
        if (!applyingRemote) queueMicrotask(bumpLocalRevision)
      })
    }
  }
}

export function onLocalDataChange(callback) {
  changeListeners.add(callback)
  return () => changeListeners.delete(callback)
}

export async function hasUnsyncedChanges() {
  const [local, synced] = await Promise.all([
    getSetting(LOCAL_REVISION_KEY),
    getSetting(SYNCED_REVISION_KEY),
  ])
  return (local ?? 0) !== (synced ?? 0)
}

async function markSynced(remoteVersion) {
  const localRevision = (await getSetting(LOCAL_REVISION_KEY)) ?? 0
  await setSetting(SYNCED_VERSION_KEY, remoteVersion)
  await setSetting(SYNCED_REVISION_KEY, localRevision)
}

function userDoc(uid) {
  return doc(firestore, 'users', uid)
}

/**
 * Sync operations run one at a time. Several can be in flight at once - a
 * debounced push, a tap on Sync now, a snapshot from another device - and each
 * reads the synced version, acts, then writes it back. Interleaved, one can act
 * on a version another has already moved past and report a conflict that isn't
 * one. Serializing them makes each read-act-write whole.
 */
let syncChain = Promise.resolve()

function withSyncLock(fn) {
  const run = syncChain.then(fn, fn)
  syncChain = run.catch(() => undefined)
  return run
}

/** Firestore's error codes name nothing a person can act on; these do. */
export function describeSyncError(error) {
  switch (error?.code) {
    case 'permission-denied':
      return 'Firebase refused that request. Most likely the rules in firestore.rules have not been published for this project - until they are, the default rules block every read and write.'
    case 'unauthenticated':
      return 'Firebase signed this device out. Sign in again to resume syncing.'
    case 'failed-precondition':
      return 'This project has no Firestore database yet. Create one in the Firebase console, then try again.'
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Could not reach Firebase. Check the connection, then use Sync now.'
    default:
      return error?.message ?? 'Sync failed.'
  }
}

async function applyRemote(remote) {
  const payload = JSON.parse(remote.payloadJson)
  applyingRemote = true
  try {
    await importAllData(payload)
  } finally {
    applyingRemote = false
  }
  await markSynced(remote.version)
}

/** Local wins: overwrite the cloud copy regardless of what version it's on. */
async function pushLocalUnlocked(uid, { force = false } = {}) {
  const payload = await exportAllData()
  const payloadJson = JSON.stringify(payload)
  if (payloadJson.length > PAYLOAD_WARN_BYTES) {
    return { status: 'too-large', bytes: payloadJson.length }
  }

  const syncedVersion = (await getSetting(SYNCED_VERSION_KEY)) ?? 0
  const deviceLabel = await getDeviceLabel()

  const result = await runTransaction(firestore, async (tx) => {
    const snap = await tx.get(userDoc(uid))
    const remoteVersion = snap.exists() ? (snap.data().version ?? 0) : 0
    if (!force && remoteVersion !== syncedVersion) {
      return { status: 'conflict', remoteVersion }
    }
    const version = remoteVersion + 1
    tx.set(userDoc(uid), {
      version,
      updatedAt: serverTimestamp(),
      deviceLabel,
      payloadJson,
    })
    return { status: 'pushed', version }
  })

  if (result.status === 'pushed') await markSynced(result.version)
  return result
}

export function pushLocal(uid, options) {
  return withSyncLock(() => pushLocalUnlocked(uid, options))
}

/** Cloud wins: replace everything on this device with the stored copy. */
async function pullRemoteUnlocked(uid) {
  const snap = await getDoc(userDoc(uid))
  if (!snap.exists()) return { status: 'empty' }
  await applyRemote(snap.data())
  return { status: 'pulled', version: snap.data().version }
}

export function pullRemote(uid) {
  return withSyncLock(() => pullRemoteUnlocked(uid))
}

/**
 * Run on sign-in and whenever the remote changes. Decides between pulling,
 * pushing, doing nothing, or handing an unresolvable difference to the user.
 */
async function reconcileUnlocked(uid) {
  const snap = await getDoc(userDoc(uid))
  const syncedVersion = (await getSetting(SYNCED_VERSION_KEY)) ?? 0
  const dirty = await hasUnsyncedChanges()

  // No remote document at all - nothing can be lost by writing over it, and a
  // plain push would refuse if this device still remembers an older version
  // (which is exactly the state a device is left in if the cloud copy is ever
  // cleared out from under it).
  if (!snap.exists()) {
    return pushLocalUnlocked(uid, { force: true })
  }

  const remote = snap.data()
  const remoteVersion = remote.version ?? 0

  if (remoteVersion === syncedVersion) {
    return dirty ? pushLocalUnlocked(uid) : { status: 'in-sync', version: remoteVersion }
  }

  // Remote moved on. Safe to take it wholesale only if this device has nothing
  // of its own that would be thrown away.
  if (!dirty) {
    await applyRemote(remote)
    return { status: 'pulled', version: remoteVersion }
  }

  const local = await exportAllData()
  const localIsEmpty =
    local.exercises.length === 0 && local.templates.length === 0 && local.sessions.length === 0
  if (localIsEmpty) {
    await applyRemote(remote)
    return { status: 'pulled', version: remoteVersion }
  }

  return { status: 'conflict', remoteVersion, remoteDeviceLabel: remote.deviceLabel ?? 'another device' }
}

export function reconcile(uid) {
  return withSyncLock(() => reconcileUnlocked(uid))
}

/**
 * For the snapshot listener. The "is the remote ahead of us" test has to be made
 * inside the lock: read outside it, a push that hasn't finished recording its
 * version yet still looks like someone else's write, and the device reconciles
 * against its own push. Returns null when there was nothing to do.
 */
export function reconcileIfBehind(uid, remoteVersion) {
  return withSyncLock(async () => {
    const synced = (await getSetting(SYNCED_VERSION_KEY)) ?? 0
    if ((remoteVersion ?? 0) <= synced) return null
    return reconcileUnlocked(uid)
  })
}

export function watchRemote(uid, onRemoteChange) {
  return onSnapshot(userDoc(uid), (snap) => {
    // Belt and braces: pushes go through a transaction, which isn't latency
    // compensated, so this shouldn't fire for our own un-acknowledged write.
    if (snap.exists() && !snap.metadata.hasPendingWrites) onRemoteChange(snap.data())
  })
}

/**
 * What is actually stored in the cloud right now, read straight from Firestore
 * rather than from local bookkeeping - "it says synced" and "the data is up
 * there" are different claims, and only this one answers the second.
 */
export async function readCloudSummary(uid) {
  const snap = await getDoc(userDoc(uid))
  if (!snap.exists()) return null
  const remote = snap.data()
  const payload = JSON.parse(remote.payloadJson)
  return {
    version: remote.version ?? 0,
    deviceLabel: remote.deviceLabel ?? 'another device',
    savedAt: remote.updatedAt?.toDate?.() ?? null,
    exercises: payload.exercises.length,
    templates: payload.templates.length,
    sessions: payload.sessions.length,
  }
}

// ---------------- Auth ----------------

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider())
}

export async function signOutOfCloud() {
  return signOut(auth)
}
