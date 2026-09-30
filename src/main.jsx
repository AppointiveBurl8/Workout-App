import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Only in a production build: the dev server has no sw.js to serve, and a
// service worker caching a dev bundle would fight HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

// Ask the browser not to evict IndexedDB - it is the only copy of a workout
// history that hasn't been backed up or synced. Harmless if unsupported or denied.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
