import { useCloudSync } from '../../lib/cloudSyncStore'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../../lib/ui'

const STATUS_TEXT = {
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Everything is backed up',
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export default function SyncControls() {
  const {
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
  } = useCloudSync()

  if (status === 'unconfigured') return null

  if (!user) {
    return (
      <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-sm font-medium">Sync across devices</p>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Sign in and your exercises, workouts, and logged sessions stay in step on your phone and
          your computer - no exporting files.
        </p>
        <button type="button" className={`${primaryButtonClass} mt-3`} onClick={signIn}>
          Sign in with Google
        </button>
        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Synced to {user.email}</p>
        {status !== 'conflict' && status !== 'error' && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {STATUS_TEXT[status] ?? 'Waiting…'}
            {status === 'synced' && lastSyncedAt ? ` · ${lastSyncedAt.toLocaleTimeString()}` : ''}
          </p>
        )}
      </div>

      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        {cloudSummary
          ? `In the cloud: ${plural(cloudSummary.exercises, 'exercise')}, ${plural(
              cloudSummary.templates,
              'workout',
            )}, ${plural(cloudSummary.sessions, 'logged session')} - saved from ${
              cloudSummary.deviceLabel
            }${cloudSummary.savedAt ? ` on ${cloudSummary.savedAt.toLocaleString()}` : ''}.`
          : 'Nothing saved to the cloud yet.'}
      </p>

      {conflict && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">This device and the cloud have both changed.</p>
          <p className="mt-1">
            The cloud copy was last saved from {conflict.remoteDeviceLabel}. Keeping one replaces the
            other - there's no merging.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => resolveConflict('keep-local')}
            >
              Keep this device
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => resolveConflict('keep-cloud')}
            >
              Use the cloud copy
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={secondaryButtonClass} onClick={syncNow}>
          Sync now
        </button>
        <button type="button" className={dangerButtonClass} onClick={disconnect}>
          Sign out
        </button>
      </div>
    </div>
  )
}
