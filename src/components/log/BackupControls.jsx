import { useEffect, useRef, useState } from 'react'
import { exportAllData, getSetting, importAllData, setSetting } from '../../db'
import { localDayKey } from '../../lib/dateStats'
import { secondaryButtonClass } from '../../lib/ui'

const REMINDER_MS = 14 * 24 * 60 * 60 * 1000

export default function BackupControls({ sessionCount }) {
  const fileInputRef = useRef(null)
  const [now] = useState(() => Date.now())
  const [lastExportedAt, setLastExportedAt] = useState(undefined) // undefined = loading, null = never
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    getSetting('lastExportedAt').then((value) => setLastExportedAt(value ?? null))
  }, [])

  const handleExport = async () => {
    const data = await exportAllData()
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workout-backup-${localDayKey(new Date())}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    await setSetting('lastExportedAt', data.exportedAt)
    setLastExportedAt(data.exportedAt)
    setImportMessage('')
    setImportError('')
    setExportMessage(
      'Save this file somewhere outside the app — iCloud Drive or Files app — so it survives if the app’s local storage gets cleared.',
    )
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return

    setExportMessage('')
    setImportError('')
    setImportMessage('')

    let data
    try {
      data = JSON.parse(await file.text())
    } catch {
      setImportError('That file is not valid JSON.')
      return
    }
    if (!Array.isArray(data.exercises) || !Array.isArray(data.templates) || !Array.isArray(data.sessions)) {
      setImportError('That file doesn’t look like a workout backup (missing exercises/templates/sessions).')
      return
    }

    const dateLabel = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'an unknown date'
    if (!window.confirm(`This will replace your current data with the backup from ${dateLabel}. Continue?`)) {
      return
    }

    await importAllData(data)
    setImportMessage(
      `Restored ${data.exercises.length} exercises, ${data.templates.length} templates, and ${data.sessions.length} logged sessions.`,
    )
  }

  const showReminder =
    !bannerDismissed &&
    sessionCount > 0 &&
    (lastExportedAt === null ||
      (lastExportedAt != null && now - new Date(lastExportedAt).getTime() > REMINDER_MS))

  return (
    <div className="flex flex-col gap-3">
      {showReminder && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <span>It's been a while since your last backup — export now?</span>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" className={secondaryButtonClass} onClick={handleExport}>
          Export data
        </button>
        <button type="button" className={secondaryButtonClass} onClick={() => fileInputRef.current?.click()}>
          Import data
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>

      {exportMessage && (
        <p className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
          {exportMessage}
        </p>
      )}
      {importMessage && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {importMessage}
        </p>
      )}
      {importError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {importError}
        </p>
      )}
    </div>
  )
}
