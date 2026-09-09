import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { isFirebaseConfigured } from './firebase'
import {
  describeSyncError,
  installLocalChangeHooks,
  onLocalDataChange,
  pullRemote,
  pushLocal,
  readCloudSummary,
  reconcile,
  reconcileIfBehind,
  signInWithGoogle,
  signOutOfCloud,
  watchAuth,
  watchRemote,
} from './cloudSync'

/** How long to wait after the last edit before pushing, so a burst of chip
 * adjustments during a workout becomes one write instead of twenty. */
const PUSH_DEBOUNCE_MS = 2500

const CloudSyncContext = createContext(null)

export function CloudSyncProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(isFirebaseConfigured ? 'signed-out' : 'unconfigured')
  const [conflict, setConflict] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [error, setError] = useState('')
  const [cloudSummary, setCloudSummary] = useState(null)
  const pushTimerRef = useRef(null)

  // What the cloud holds, read back from Firestore rather than inferred from a
  // status string - the whole question is whether the write actually landed.
  const refreshCloudSummary = useCallback(async () => {
    if (!user) return
    try {
      setCloudSummary(await readCloudSummary(user.uid))
    } catch {
      setCloudSummary(null)
    }
  }, [user])

  const applyResult = useCallback((result) => {
    if (!result) return
    if (result.status === 'conflict') {
      setConflict({
        remoteVersion: result.remoteVersion,
        remoteDeviceLabel: result.remoteDeviceLabel ?? 'another device',
      })
      setStatus('conflict')
      return
    }
    if (result.status === 'too-large') {
      setError('Your data is too big to sync in one document. Export a backup and tell Claude.')
      setStatus('error')
      return
    }
    setConflict(null)
    setError('')
    setStatus('synced')
    setLastSyncedAt(new Date())
    refreshCloudSummary()
  }, [refreshCloudSummary])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    installLocalChangeHooks()
    return watchAuth((nextUser) => {
      setUser(nextUser)
      setStatus(nextUser ? 'connecting' : 'signed-out')
      setConflict(null)
      setCloudSummary(null)
    })
  }, [])

  // First reconcile after sign-in, then keep listening for pushes from other devices.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    reconcile(user.uid)
      .then((result) => {
        if (!cancelled) applyResult(result)
      })
      .catch((e) => {
        if (cancelled) return
        setError(describeSyncError(e))
        setStatus('error')
      })

    const unwatch = watchRemote(user.uid, async (remote) => {
      try {
        const result = await reconcileIfBehind(user.uid, remote.version)
        if (!cancelled) applyResult(result)
      } catch (e) {
        if (cancelled) return
        setError(describeSyncError(e))
        setStatus('error')
      }
    })

    return () => {
      cancelled = true
      unwatch()
    }
  }, [user, applyResult])

  const push = useCallback(
    async (uid) => {
      try {
        applyResult(await pushLocal(uid))
      } catch (e) {
        setError(describeSyncError(e))
        setStatus('error')
      }
    },
    [applyResult],
  )

  // Local edits schedule a debounced push.
  useEffect(() => {
    if (!user) return
    return onLocalDataChange(() => {
      setStatus((prev) => (prev === 'conflict' ? prev : 'syncing'))
      clearTimeout(pushTimerRef.current)
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null
        push(user.uid)
      }, PUSH_DEBOUNCE_MS)
    })
  }, [user, push])

  // A workout ends and the app gets closed seconds later. Waiting out the
  // debounce would leave that last session on the device until the next launch.
  useEffect(() => {
    if (!user) return
    const flush = () => {
      if (!pushTimerRef.current) return
      clearTimeout(pushTimerRef.current)
      pushTimerRef.current = null
      push(user.uid)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
    }
  }, [user, push])

  useEffect(() => () => clearTimeout(pushTimerRef.current), [])

  const signIn = useCallback(async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      // A closed popup isn't worth surfacing as a failure.
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(describeSyncError(e))
        setStatus('error')
      }
    }
  }, [])

  const disconnect = useCallback(async () => {
    await signOutOfCloud()
  }, [])

  const resolveConflict = useCallback(
    async (choice) => {
      if (!user) return
      setStatus('syncing')
      try {
        applyResult(
          choice === 'keep-local'
            ? await pushLocal(user.uid, { force: true })
            : await pullRemote(user.uid),
        )
      } catch (e) {
        setError(describeSyncError(e))
        setStatus('error')
      }
    },
    [user, applyResult],
  )

  const syncNow = useCallback(async () => {
    if (!user) return
    setStatus('syncing')
    try {
      applyResult(await reconcile(user.uid))
    } catch (e) {
      setError(describeSyncError(e))
      setStatus('error')
    }
  }, [user, applyResult])

  return (
    <CloudSyncContext.Provider
      value={{
        user,
        status,
        conflict,
        lastSyncedAt,
        error,
        cloudSummary,
        signIn,
        disconnect,
        resolveConflict,
        syncNow,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  )
}

export function useCloudSync() {
  const ctx = useContext(CloudSyncContext)
  if (!ctx) throw new Error('useCloudSync must be used within a CloudSyncProvider')
  return ctx
}
