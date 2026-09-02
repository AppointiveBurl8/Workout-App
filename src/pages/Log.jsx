import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CategoryBadge from '../components/CategoryBadge'
import LogEntryForm from '../components/log/LogEntryForm'
import { EXERCISE_CATEGORIES, getLoggedSessions, getWorkoutTemplates } from '../db'
import { CATEGORY_LABELS, CATEGORY_TAB_ACTIVE_CLASSES } from '../lib/categories'
import {
  computeStreak,
  countSince,
  formatDisplayDate,
  localDayKey,
  startOfMonth,
  startOfWeek,
} from '../lib/dateStats'
import { formatMMSS } from '../lib/formatDuration'
import { inputClass, labelClass } from '../lib/ui'

const FILTERS = ['all', ...EXERCISE_CATEGORIES]

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-neutral-200 py-3 dark:border-neutral-800">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  )
}

function HistoryRow({ session, templateName }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{templateName ?? 'On-the-fly'}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatDisplayDate(session.date)}
          </p>
        </div>
        <CategoryBadge category={session.category} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
        <span>{formatMMSS(session.durationSeconds)}</span>
        {session.rpe != null && <span>RPE {session.rpe}</span>}
        {session.setsCompleted != null && <span>{session.setsCompleted} sets</span>}
      </div>
      {session.notes && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{session.notes}</p>
      )}
    </div>
  )
}

export default function Log() {
  const navigate = useNavigate()
  const location = useLocation()
  const draft = location.state?.source === 'tracker-end' ? location.state : null

  const [filter, setFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
  const streak = computeStreak(allSessions)

  const visible = allSessions
    .filter((s) => filter === 'all' || s.category === filter)
    .filter((s) => !dateFrom || localDayKey(s.date) >= dateFrom)
    .filter((s) => !dateTo || localDayKey(s.date) <= dateTo)
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Log</h1>

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
          {visible.map((session) => (
            <HistoryRow
              key={session.id}
              session={session}
              templateName={session.templateId ? templatesById.get(session.templateId)?.name : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
