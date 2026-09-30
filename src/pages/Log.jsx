import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CategoryBadge from '../components/CategoryBadge'
import BackupControls from '../components/log/BackupControls'
import SoundCheck from '../components/log/SoundCheck'
import LogEntryForm from '../components/log/LogEntryForm'
import SyncControls from '../components/log/SyncControls'
import { EXERCISE_CATEGORIES, getLoggedSessions, getWorkoutTemplates } from '../db'
import { CATEGORY_LABELS, CATEGORY_TAB_ACTIVE_CLASSES } from '../lib/categories'
import {
  countSince,
  currentStreak,
  formatDisplayDate,
  localDayKey,
  startOfMonth,
  startOfWeek,
} from '../lib/dateStats'
import { isRestDay } from '../lib/loggedSession'
import { formatMMSS } from '../lib/formatDuration'
import { inputClass, labelClass, secondaryButtonClass } from '../lib/ui'

const FILTERS = ['all', ...EXERCISE_CATEGORIES]

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-neutral-200 py-3 dark:border-neutral-800">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  )
}

const rowClass =
  'w-full min-h-11 rounded-lg border border-neutral-200 p-3 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-800'

/** A rest day has nothing to show but the fact of it, so it reads as one muted line. */
function RestRow({ session, onEdit }) {
  return (
    <button type="button" onClick={onEdit} className={rowClass}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Rest day
          </span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {formatDisplayDate(session.date)}
          </span>
        </div>
        <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
          ›
        </span>
      </div>
      {session.notes && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{session.notes}</p>
      )}
    </button>
  )
}

function HistoryRow({ session, templateName, onEdit }) {
  return (
    <button type="button" onClick={onEdit} className={rowClass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{templateName ?? 'On-the-fly'}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatDisplayDate(session.date)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <CategoryBadge category={session.category} />
          <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-600">
            ›
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <span>{formatMMSS(session.durationSeconds)}</span>
        {session.rpe != null && <span>RPE {session.rpe}</span>}
        {session.setsCompleted != null && <span>{session.setsCompleted} sets</span>}
      </div>
      {session.notes && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{session.notes}</p>
      )}
    </button>
  )
}

export default function Log() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = location.state?.source === 'tracker-end' ? location.state : null

  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  // null = closed, 'add' = new entry, a number = the id being edited.
  const [editing, setEditing] = useState(null)

  const sessions = useLiveQuery(() => getLoggedSessions(), [])
  const templates = useLiveQuery(() => getWorkoutTemplates(), [])
  const templatesById = new Map((templates ?? []).map((t) => [t.id, t]))

  const closeEntryForm = () => navigate('/log', { replace: true })

  if (draft) {
    return <LogEntryForm draft={draft} onSaved={closeEntryForm} onDiscard={closeEntryForm} />
  }

  const allSessions = sessions ?? []
  const weekCount = countSince(allSessions, startOfWeek())
  const monthCount = countSince(allSessions, startOfMonth())
  const streak = currentStreak(allSessions)
  const editingSession =
    typeof editing === 'number' ? allSessions.find((s) => s.id === editing) : null

  const visible = allSessions
    // A rest day has no category, so a category filter is a workout filter.
    .filter((s) => filter === 'all' || s.category === filter)
    .filter((s) => !dateFrom || localDayKey(s.date) >= dateFrom)
    .filter((s) => !dateTo || localDayKey(s.date) <= dateTo)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Log</h1>
        <button type="button" className={secondaryButtonClass} onClick={() => setEditing('add')}>
          Add entry
        </button>
      </div>

      {(editing === 'add' || editingSession) && (
        <LogEntryForm
          mode={editing === 'add' ? 'add' : 'edit'}
          session={editingSession ?? undefined}
          sessions={allSessions}
          onSaved={() => setEditing(null)}
          onDiscard={() => setEditing(null)}
        />
      )}

      <SyncControls />

      <BackupControls sessionCount={allSessions.length} />

      <SoundCheck />

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="This week" value={weekCount} />
        <StatTile label="This month" value={monthCount} />
        <StatTile label="Day streak" value={streak} />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === f
                ? CATEGORY_TAB_ACTIVE_CLASSES[f]
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            {f === 'all' ? 'All' : CATEGORY_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className={labelClass} htmlFor="log-date-from">
            From
          </label>
          <input
            id="log-date-from"
            type="date"
            className={inputClass}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass} htmlFor="log-date-to">
            To
          </label>
          <input
            id="log-date-to"
            type="date"
            className={inputClass}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {sessions === undefined ? (
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No logged sessions here yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((session) =>
            isRestDay(session) ? (
              <RestRow key={session.id} session={session} onEdit={() => setEditing(session.id)} />
            ) : (
              <HistoryRow
                key={session.id}
                session={session}
                templateName={
                  session.templateId ? templatesById.get(session.templateId)?.name : null
                }
                onEdit={() => setEditing(session.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}
