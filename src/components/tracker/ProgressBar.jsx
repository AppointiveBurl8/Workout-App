export default function ProgressBar({ value, colorClassName = 'bg-indigo-600' }) {
  const pct = Math.min(1, Math.max(0, value)) * 100
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
      <div
        className={`h-full rounded-full ${colorClassName} transition-[width] duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
