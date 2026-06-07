import { useNavigate } from 'react-router-dom'

/**
 * IndexPage — SaniExpert v2 Landing Page
 *
 * PURPOSE: Branding landing page. User clicks "Start Sanitation" → goes to /lines
 *
 * DESIGN:
 * - Full-screen centered layout using .landing-page CSS class
 * - Large SaniExpert logo ("SE" in a circle) using .logo-icon.large
 * - "SaniExpert" title + "Digital Sanitation Control System" subtitle
 * - Large green "Start Sanitation" button (.btn.btn-primary.btn-large)
 *   with min-height 64px and font-size 20px for mobile touch targets
 * - "v2.0 — Audit Grade" version text at bottom
 *
 * RULES:
 * - NO login required — open entry point
 * - Single button navigates to /lines route
 * - Mobile-first: everything centered, large touch targets
 * - Uses CSS classes: .landing-page, .landing-brand, .logo-icon.large, .btn.btn-primary.btn-large
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
        style={{ minHeight: 64, fontSize: 20, padding: '18px 48px' }}
      >
        Start Sanitation
      </button>

      <p className="landing-version">v2.0 — Audit Grade</p>
    </div>
  )
}
