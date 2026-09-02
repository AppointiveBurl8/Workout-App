import { useSearchParams } from 'react-router-dom'

export default function Tracker() {
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('templateId')

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl font-semibold">Tracker</h1>
      <p className="text-neutral-500 dark:text-neutral-400">Coming soon</p>
      {templateId && (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">
          templateId: {templateId}
        </p>
      )}
    </section>
  )
}
