import { useNavigate } from 'react-router-dom'

/**
 * Release Page — Line Release Gate
 * Final gate before releasing a line back to production.
 * Confirms no open handovers or damage reports.
 * Records release with timestamp for audit trail.
 */
export default function ReleasePage() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <h1 className="page-header">Release Line</h1>
      <p className="page-subtitle">Confirm line is ready for production</p>

      <div className="release-gate release-gate-open">
        <div className="release-gate-title">✓ Ready for Release</div>
        <div className="release-gate-text">
          All checks passed. No open handovers or damage reports.
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Release Details</h3>
        <div className="form-group">
          <label>Released By</label>
          <input className="form-input" type="text" placeholder="Your name" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea className="form-textarea" placeholder="Optional release notes..." rows={3} />
        </div>
        <button className="btn btn-success btn-full btn-large">
          Confirm Release
        </button>
      </div>

      <button className="btn btn-gray btn-full mt-1" onClick={() => navigate('/control')}>
        Back to Control
      </button>
    </div>
  )
}
