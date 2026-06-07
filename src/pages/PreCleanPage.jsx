import { useNavigate } from 'react-router-dom'

/**
 * Pre-Clean Checklist Page
 * Step-by-step pre-cleaning checklist with progress tracking.
 * Acceptable / Not Acceptable / N-A buttons per question.
 * Photos and comments supported.
 */
export default function PreCleanPage() {
  const navigate = useNavigate()

  return (
    <div className="page checklist-page">
      <h1 className="page-header">Pre-Clean Checklist</h1>
      <p className="page-subtitle">Complete all items before cleaning begins</p>

      {/* Progress placeholder */}
      <div className="checklist-progress">
        <div className="checklist-progress-bar">
          <div className="checklist-progress-fill" style={{ width: '0%' }} />
        </div>
        <div className="checklist-progress-text">0 of 0 completed</div>
      </div>

      {/* Placeholder for checklist items */}
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <p>Checklist items will be loaded here</p>
      </div>

      <div className="page-actions">
        <button className="btn btn-primary btn-full" onClick={() => navigate('/control')}>
          Back to Control
        </button>
      </div>
    </div>
  )
}
