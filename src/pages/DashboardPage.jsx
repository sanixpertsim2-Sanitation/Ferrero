import { useNavigate } from 'react-router-dom'

/**
 * Dashboard Page — Sanitation Overview
 * Real-time overview of all lines, cleaning status,
 * damage reports, and recent activity.
 * Admin access for oversight and reporting.
 */
export default function DashboardPage() {
  const navigate = useNavigate()

  const stats = [
    { label: 'Areas Cleaned', value: '0', total: '0', color: 'primary' },
    { label: 'Pending RTE', value: '0', total: '', color: 'warning' },
    { label: 'Damage Reports', value: '0', total: '', color: 'danger' },
    { label: 'Released', value: '0', total: '', color: 'success' },
  ]

  return (
    <div className="page">
      <h1 className="page-header">Dashboard</h1>
      <p className="page-subtitle">Real-time overview of cleaning operations</p>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className={`stat-card stat-${s.color}`}>
            <div className="stat-value">
              {s.value}{s.total && <span className="stat-total">/{s.total}</span>}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="card-title">Recent Activity</h3>
        <div className="activity-list">
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>No recent activity</p>
          </div>
        </div>
      </div>

      <button className="btn btn-gray btn-full mt-2" onClick={() => navigate('/lines')}>
        Back to Lines
      </button>
    </div>
  )
}
