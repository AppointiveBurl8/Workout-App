import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { ActiveSessionProvider } from './lib/activeSessionStore'
import Builder from './pages/Builder'
import Library from './pages/Library'
import Log from './pages/Log'
import StartWorkout from './pages/StartWorkout'
import Tracker from './pages/Tracker'

function App() {
  return (
    // Mounted above the routes (not inside Tracker) so an active workout's state
    // survives switching to Library/Builder/Log and back.
    <ActiveSessionProvider>
      <main className="flex flex-1 flex-col overflow-y-auto pb-28">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<Library />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/start" element={<StartWorkout />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/log" element={<Log />} />
        </Routes>
      </main>
      <BottomNav />
    </ActiveSessionProvider>
  )
}

export default App
