import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { isFirebaseConfigured } from './firebase'
import {
  installLocalChangeHooks,
  onLocalDataChange,
  pullRemote,
  pushLocal,
  readSyncedVersion,
  reconcile,
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
  const pushTimerRef = useRef(null)

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
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured) return
    installLocalChangeHooks()
    return watchAuth((nextUser) => {
      setUser(nextUser)
      setStatus(nextUser ? 'connecting' : 'signed-out')
      setConflict(null)
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
        setError(e.message)
        setStatus('error')
      })

    const unwatch = watchRemote(user.uid, async (remote) => {
      const synced = await readSyncedVersion()
      if (cancelled || (remote.version ?? 0) <= synced) return
      applyResult(await reconcile(user.uid))
    })

    return () => {
      cancelled = true
      unwatch()
    }
  }, [user, applyResult])

  // Local edits schedule a debounced push.
  useEffect(() => {
    if (!user) return
    return onLocalDataChange(() => {
      setStatus((prev) => (prev === 'conflict' ? prev : 'syncing'))
      clearTimeout(pushTimerRef.current)
      pushTimerRef.current = setTimeout(async () => {
        try {
          applyResult(await pushLocal(user.uid))
        } catch (e) {
          setError(e.message)
          setStatus('error')
        }
      }, PUSH_DEBOUNCE_MS)
    })
  }, [user, applyResult])

  useEffect(() => () => clearTimeout(pushTimerRef.current), [])

  const signIn = useCallback(async () => {
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      // A closed popup isn't worth surfacing as a failure.
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(e.message)
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
        setError(e.message)
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
      setError(e.message)
      setStatus('error')
    }
  }, [user, applyResult])

  return (
    <CloudSyncContext.Provider
      value={{ user, status, conflict, lastSyncedAt, error, signIn, disconnect, resolveConflict, syncNow }}
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
