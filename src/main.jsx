import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

/**
 * SaniExpert v2 Entry Point
 * Uses HashRouter for compatibility with static hosting.
 * StrictMode enabled for development-time checks.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
