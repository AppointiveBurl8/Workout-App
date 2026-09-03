import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Builder from './pages/Builder'
import Library from './pages/Library'
import Log from './pages/Log'
import StartWorkout from './pages/StartWorkout'
import Tracker from './pages/Tracker'

function App() {
  return (
    <>
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
    </>
  )
}

export default App
