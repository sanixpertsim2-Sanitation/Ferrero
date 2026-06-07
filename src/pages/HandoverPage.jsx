import { useNavigate } from 'react-router-dom'

/**
 * Handover Page
 * Manage handover tasks and damage reports.
 * View pending/completed tasks, create new ones.
 */
export default function HandoverPage() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <h1 className="page-header">Handover & Damage</h1>
      <p className="page-subtitle">Manage open tasks and damage reports</p>

      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <p>Handover tasks and damage reports will appear here</p>
      </div>

      <div className="page-actions">
        <button className="btn btn-primary btn-full" onClick={() => navigate('/control')}>
          Back to Control
        </button>
      </div>
    </div>
  )
}
