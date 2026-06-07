import { useNavigate } from 'react-router-dom'

/**
 * Landing Page — SaniExpert v2
 * Full-screen branded landing with large "Start Sanitation" button.
 * Entry point for the sanitation workflow.
 */
export default function IndexPage() {
  const navigate = useNavigate()

  return (
    <div className="landing-page">
      <div className="landing-brand">
        <div className="logo-icon large">SE</div>
        <h1>SaniExpert</h1>
        <p>Digital Sanitation Control System</p>
      </div>
      <button
        className="btn btn-primary btn-large"
        onClick={() => navigate('/lines')}
        style={{ minHeight: 64, fontSize: '1.2rem', padding: '18px 48px' }}
      >
        Start Sanitation
      </button>
      <p className="landing-version">v2.0 — Audit Grade</p>
    </div>
  )
}
