import { useState, useEffect } from 'react'
import { getLines, getDashboardStats } from '@/lib/supabase.js'
import { getStatusLabel, statusBadgeClass } from '@/utils/statusLabels.js'
import { ADMIN_EMAIL } from '@/lib/supabase.js'

/**
 * DashboardPage — Admin dashboard with stats and line status
 * Microsoft SSO placeholder. Email override: adarsh@sanixperts.com
 */
export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [lines, setLines] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const handleAuth = () => {
    if (email.trim() === ADMIN_EMAIL) setAuthenticated(true)
    else alert('Access Denied')
  }

  useEffect(() => {
    if (!authenticated) return
    Promise.all([getLines(), getDashboardStats()]).then(([l, s]) => {
      setLines(l); setStats(s); setLoading(false)
    })
  }, [authenticated])

  if (!authenticated) {
    return (
      <div className="page dashboard-page">
        <h1>SaniExpert Dashboard</h1>
        <div className="auth-gate card">
          <p>Admin Access</p>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin email" />
          <button className="btn btn-primary" onClick={handleAuth}>Access</button>
          <small>TODO: Replace with Microsoft OAuth</small>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="page dashboard-page">
      <h1>SaniExpert Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{lines.length}</div><div>Total Lines</div></div>
        <div className="stat-card"><div className="stat-value">{stats?.preCleanLogs?.length || 0}</div><div>In Pre-Clean</div></div>
        <div className="stat-card"><div className="stat-value">{stats?.postCleanLogs?.length || 0}</div><div>In Post-Clean</div></div>
        <div className="stat-card"><div className="stat-value">{stats?.handoverTasks?.filter(t => t.status === 'pending')?.length || 0}</div><div>Pending Handovers</div></div>
        <div className="stat-card"><div className="stat-value">{stats?.releaseLogs?.length || 0}</div><div>Released Today</div></div>
        <div className="stat-card"><div className="stat-value">{stats?.damageReports?.filter(d => d.status === 'open')?.length || 0}</div><div>Open Damages</div></div>
      </div>

      <h2>Line Status</h2>
      <div className="table-card">
        {lines.map(line => (
          <div key={line.id} className="line-status-row">
            <span className="line-name">{line.name}</span>
            <span className={`badge ${statusBadgeClass(line.status)}`}>{getStatusLabel(line.status)}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-outline" onClick={() => setAuthenticated(false)}>Logout</button>
    </div>
  )
}
