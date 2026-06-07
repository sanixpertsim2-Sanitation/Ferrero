import { useNavigate } from 'react-router-dom'

/**
 * Verify Page — Area Lead Verification
 * Area lead reviews checklist completion, photos, and open items.
 * Signature capture and PIN entry for audit trail.
 */
export default function VerifyPage() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <h1 className="page-header">Area Lead Verification</h1>
      <p className="page-subtitle">Review and approve for release</p>

      <div className="card">
        <h3 className="card-title">Verification Checklist</h3>
        <div className="verification-list">
          {[
            'All pre-clean tasks completed and signed off',
            'All post-clean tasks completed and signed off',
            'Damage reports reviewed and addressed',
            'Photo evidence reviewed and approved',
            'Area is safe for production restart',
          ].map((item, i) => (
            <label key={i} className="check-row">
              <input type="checkbox" />
              <span>{item}</span>
            </label>
          ))}
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="signature-label">Lead Signature</label>
          <div className="signature-pad" />
        </div>

        <div className="form-group">
          <label>Comments</label>
          <textarea className="form-textarea" placeholder="Optional comments..." rows={3} />
        </div>

        <button className="btn btn-success btn-full">Verify &amp; Approve</button>
      </div>

      <button className="btn btn-gray btn-full mt-1" onClick={() => navigate('/control')}>
        Back to Control
      </button>
    </div>
  )
}
