import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/library', label: 'Library' },
  { to: '/builder', label: 'Builder' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/log', label: 'Log' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 px-2 pt-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <ul className="flex gap-2">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex min-h-14 items-center justify-center rounded-2xl px-2 text-sm font-semibold ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
