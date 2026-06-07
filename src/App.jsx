import { Routes, Route } from 'react-router-dom'
import './App.css'

// Pages
import IndexPage from './pages/IndexPage.jsx'
import LineSelectPage from './pages/LineSelectPage.jsx'
import ControlPage from './pages/ControlPage.jsx'
import PreCleanPage from './pages/PreCleanPage.jsx'
import PostCleanPage from './pages/PostCleanPage.jsx'
import HandoverPage from './pages/HandoverPage.jsx'
import VerifyPage from './pages/VerifyPage.jsx'
import ReleasePage from './pages/ReleasePage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

// Layout wrapper
function Layout({ children }) {
  return (
    <div className="app-layout">
      <main className="main-content">{children}</main>
    </div>
  )
}

/**
 * SaniExpert v2 -- Audit-Grade Sanitation Control System
 * Router with 9 routes covering the full sanitation workflow:
 * Landing -> Line Select -> Control Hub -> (PreClean | PostClean | Handover | Verify | Release) -> Dashboard
 */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/lines" element={<LineSelectPage />} />
        <Route path="/control" element={<ControlPage />} />
        <Route path="/pre-clean" element={<PreCleanPage />} />
        <Route path="/post-clean" element={<PostCleanPage />} />
        <Route path="/handover" element={<HandoverPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/release" element={<ReleasePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </Layout>
  )
}
