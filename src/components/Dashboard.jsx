import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Factory,
  AlertTriangle,
  ClipboardList,
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  RefreshCw,
  ChevronRight,
  Download,
  Search,
  FileText,
  Filter,
  Loader2,
  Activity,
  StickyNote,
  Settings,
  Radio,
} from 'lucide-react'
import {
  supabase,
  getCurrentUser,
  getProfile,
  getLines,
  getDamageReports,
  getFindings,
  logActivity,
  getDashboardStats,
} from '@/lib/supabase.js'

/**
 * Dashboard Component
 * Route: /dashboard
 * Accessible to all authenticated users (read-only for employees).
 * Real-time overview of all production lines with stats, cards, activity feed, and findings.
 */
export default function Dashboard() {
  const navigate = useNavigate()

  // ── User ──
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  // ── Data ──
  const [lines, setLines] = useState([])
  const [lineStats, setLineStats] = useState({}) // lineId -> stats
  const [allDamageReports, setAllDamageReports] = useState([])
  const [allFindings, setAllFindings] = useState([])
  const [activityLogs, setActivityLogs] = useState([])

  // ── UI State ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [realtimeActive, setRealtimeActive] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ── Findings Filter (Area Leads+) ──
  const [findingFilter, setFindingFilter] = useState('all') // all | open | resolved
  const [findingSort, setFindingSort] = useState('newest') // newest | oldest

  // ── Activity Pagination ──
  const [activityPage, setActivityPage] = useState(0)
  const ACTIVITY_PAGE_SIZE = 10

  // ── Config ──
  const statusConfig = {
    raw:      { label: 'RAW',      color: '#3498db', bg: '#ebf5fb', desc: 'Ready to Clean' },
    cleaning: { label: 'CLEANING', color: '#f39c12', bg: '#fef9e7', desc: 'Being Cleaned' },
    rte:      { label: 'RTE',      color: '#1a5f2a', bg: '#e8f5e9', desc: 'Ready to Examine' },
    other:    { label: 'OTHER',    color: '#95a5a6', bg: '#f2f3f4', desc: 'Not Started' },
  }

  const severityConfig = {
    low:    { label: 'Low',    color: '#27ae60', bg: '#d4edda' },
    medium: { label: 'Medium', color: '#f39c12', bg: '#fff3cd' },
    high:   { label: 'High',   color: '#e74c3c', bg: '#fdecea' },
    minor:  { label: 'Minor',  color: '#f39c12', bg: '#fff3cd' },
    major:  { label: 'Major',  color: '#e67e22', bg: '#fdebd0' },
    critical:{ label: 'Critical',color: '#e74c3c', bg: '#fdecea' },
  }

  // ═══════════════════════════════════════════
  //  Auth & Initial Data
  // ═══════════════════════════════════════════
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        setLoading(true)
        setError('')

        const currentUser = await getCurrentUser()
        if (!currentUser) {
          navigate('/login')
          return
        }
        if (!cancelled) setUser(currentUser)

        const profileData = await getProfile(currentUser.id)
        if (!cancelled) setProfile(profileData)

        await fetchAllDashboardData()

        if (!cancelled) {
          setLastUpdated(new Date())
          setRealtimeActive(true)
        }

      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => { cancelled = true }
  }, [navigate])

  // ═══════════════════════════════════════════
  //  Realtime Subscriptions — All Lines
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (!user) return

    // Subscribe to production_lines changes (all lines)
    const linesChannel = supabase
      .channel('dashboard-lines')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_lines' }, (payload) => {
        handleRealtimeUpdate(payload)
      })
      .subscribe((status) => {
        setRealtimeActive(status === 'SUBSCRIBED')
      })

    // Subscribe to assignments (all)
    const assignmentsChannel = supabase
      .channel('dashboard-assignments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        refreshData()
      })
      .subscribe()

    // Subscribe to damage_reports (all)
    const damageChannel = supabase
      .channel('dashboard-damage')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damage_reports' }, () => {
        refreshData()
      })
      .subscribe()

    // Subscribe to findings (all)
    const findingsChannel = supabase
      .channel('dashboard-findings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'findings' }, () => {
        refreshData()
      })
      .subscribe()

    // Subscribe to activity_logs (all)
    const activityChannel = supabase
      .channel('dashboard-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        fetchActivityLogs()
      })
      .subscribe()

    return () => {
      linesChannel.unsubscribe()
      assignmentsChannel.unsubscribe()
      damageChannel.unsubscribe()
      findingsChannel.unsubscribe()
      activityChannel.unsubscribe()
    }
  }, [user])

  // ═══════════════════════════════════════════
  //  Data Fetching
  // ═══════════════════════════════════════════
  const fetchAllDashboardData = async () => {
    try {
      // Fetch all production lines
      const { data: linesData, error: linesError } = await getLines()
      if (linesError) throw linesError

      const linesArr = linesData || []
      setLines(linesArr)

      // Fetch stats for each line
      const statsMap = {}
      for (const line of linesArr) {
        try {
          const stats = await getDashboardStats(line.id)
          statsMap[line.id] = stats
        } catch {
          statsMap[line.id] = { areas: [], assignments: [], damageReports: [], findings: [] }
        }
      }
      setLineStats(statsMap)

      // Fetch all damage reports (for summary counts)
      const { data: allDamage } = await supabase
        .from('damage_reports')
        .select('id, status, line_id, area_id, severity, created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
      setAllDamageReports(allDamage || [])

      // Fetch all findings (for summary)
      const { data: allFindingsData } = await supabase
        .from('findings')
        .select('id, status, line_id, area_id, severity, created_at, description, reported_by, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      setAllFindings(allFindingsData || [])

      // Fetch activity logs
      await fetchActivityLogs()

    } catch (err) {
      setError(err.message || 'Failed to load dashboard data')
    }
  }

  const fetchActivityLogs = async () => {
    try {
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      setActivityLogs(logs || [])
    } catch {
      // Silently fail for activity logs
    }
  }

  const handleRealtimeUpdate = useCallback((payload) => {
    // Update the specific line in our local state
    if (payload.eventType === 'UPDATE' && payload.new) {
      setLines(prev => prev.map(line =>
        line.id === payload.new.id ? { ...line, ...payload.new } : line
      ))
    }
    setLastUpdated(new Date())
  }, [])

  const refreshData = useCallback(async () => {
    setRefreshing(true)
    await fetchAllDashboardData()
    setLastUpdated(new Date())
    setRefreshing(false)
  }, [])

  // ═══════════════════════════════════════════
  //  Computed Stats
  // ═══════════════════════════════════════════
  const computeSummaryStats = () => {
    const totalLines = lines.length
    const linesInProgress = lines.filter(l => l.status === 'cleaning').length
    const linesReady = lines.filter(l => l.status === 'rte').length
    const openDamage = allDamageReports.filter(r => r.status === 'open').length
    const openFindings = allFindings.filter(f => f.status === 'open').length

    // Active assignments today (sum across all lines)
    let activeAssignments = 0
    Object.values(lineStats).forEach(stats => {
      activeAssignments += (stats.assignments?.length || 0)
    })

    return { totalLines, linesInProgress, linesReady, openDamage, openFindings, activeAssignments }
  }

  const stats = computeSummaryStats()

  // ═══════════════════════════════════════════
  //  Line Card Stats Helper
  // ═══════════════════════════════════════════
  const getLineCardStats = (lineId) => {
    const stats = lineStats[lineId]
    if (!stats) return { completed: 0, total: 0, assignments: 0, damage: 0, findings: 0 }

    const completed = stats.areas?.filter(a => a.status === 'rte').length || 0
    const total = stats.areas?.length || 0
    const assignments = stats.assignments?.length || 0
    const damage = stats.damageReports?.filter(r => r.status === 'open').length || 0
    const findings = stats.findings?.filter(f => f.status === 'open').length || 0

    return { completed, total, assignments, damage, findings }
  }

  // ═══════════════════════════════════════════
  //  Export Function (Supervisor+)
  // ═══════════════════════════════════════════
  const handleExport = (format) => {
    const today = new Date().toISOString().split('T')[0]

    // Build export data
    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: profile?.full_name || user?.email,
      date_range: today,
      summary: stats,
      lines: lines.map(line => ({
        ...line,
        card_stats: getLineCardStats(line.id),
      })),
      damage_reports: allDamageReports,
      findings: allFindings,
      activity_logs: activityLogs.slice(0, 100),
    }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sanitization-report-${today}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else if (format === 'csv') {
      // CSV export: damage reports + findings
      let csv = 'Type,ID,Line ID,Area ID,Severity,Status,Description,Created At\n'

      allDamageReports.forEach(r => {
        csv += `Damage,${r.id},${r.line_id},${r.area_id},${r.severity},${r.status},"${r.description || ''}",${r.created_at}\n`
      })
      allFindings.forEach(f => {
        csv += `Finding,${f.id},${f.line_id},${f.area_id},${f.severity},${f.status},"${f.description || ''}",${f.created_at}\n`
      })

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sanitization-report-${today}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    // Log export activity
    logActivity({
      action: 'data_exported',
      details: `Dashboard data exported as ${format.toUpperCase()}`,
      performed_by: user?.id,
      created_at: new Date().toISOString(),
    }).catch(() => {})
  }

  // ═══════════════════════════════════════════
  //  Filtered Findings
  // ═══════════════════════════════════════════
  const filteredFindings = allFindings
    .filter(f => findingFilter === 'all' || f.status === findingFilter)
    .sort((a, b) => {
      if (findingSort === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      return new Date(a.created_at) - new Date(b.created_at)
    })

  // ═══════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════
  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  const formatDateTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  const getLineName = (lineId) => {
    return lines.find(l => l.id === lineId)?.name || lineId
  }

  const canExport = profile?.role === 'supervisor' || profile?.role === 'admin'
  const canManageUsers = profile?.role === 'admin'
  const canViewFindings = ['area_lead', 'supervisor', 'admin'].includes(profile?.role)

  // ═══════════════════════════════════════════
  //  Render: Loading Skeleton
  // ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  //  Render: Error
  // ═══════════════════════════════════════════
  if (error) {
    return (
      <div className="page">
        <div className="toast toast-error flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
        <button className="btn btn-primary mt-3" onClick={refreshData}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  //  Render: Main Dashboard
  // ═══════════════════════════════════════════
  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={24} color="var(--color-primary)" />
          <h1 className="page-title mb-0">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Realtime indicator */}
          <div
            className="flex items-center gap-1 text-sm text-muted"
            title={realtimeActive ? 'Realtime updates active' : 'Realtime updates paused'}
          >
            <Radio
              size={12}
              style={{
                color: realtimeActive ? '#27ae60' : '#e74c3c',
                animation: realtimeActive ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span>{realtimeActive ? 'Live' : 'Offline'}</span>
          </div>

          {/* Refresh */}
          <button
            className="navbar-btn"
            onClick={refreshData}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>
      <p className="page-subtitle">
        Real-time overview of cleaning operations
        {lastUpdated && (
          <span className="text-sm text-muted"> · Updated {formatTime(lastUpdated)}</span>
        )}
      </p>

      {/* ── Summary Stats Row ── */}
      <div className="stats-grid mb-4">
        <div className="stat-card stat-primary">
          <div className="stat-value">{stats.totalLines}</div>
          <div className="stat-label">
            <Factory size={12} style={{ display: 'inline' }} /> Total Lines
          </div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.linesInProgress}</div>
          <div className="stat-label">
            <Clock size={12} style={{ display: 'inline' }} /> In Progress
          </div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-value">{stats.linesReady}</div>
          <div className="stat-label">
            <ShieldCheck size={12} style={{ display: 'inline' }} /> Lines Ready
          </div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-value">{stats.openDamage}</div>
          <div className="stat-label">
            <ShieldAlert size={12} style={{ display: 'inline' }} /> Open Damage
          </div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.openFindings}</div>
          <div className="stat-label">
            <StickyNote size={12} style={{ display: 'inline' }} /> Open Findings
          </div>
        </div>
        <div className="stat-card stat-primary">
          <div className="stat-value">{stats.activeAssignments}</div>
          <div className="stat-label">
            <Users size={12} style={{ display: 'inline' }} /> Active Today
          </div>
        </div>
      </div>

      {/* ── Export Controls (Supervisor+) ── */}
      {canExport && (
        <div className="card mb-3" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-sm text-muted flex items-center gap-1">
            <Download size={14} /> Export:
          </span>
          <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={() => handleExport('csv')}>
            <FileText size={14} /> CSV
          </button>
          <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '8px 14px' }} onClick={() => handleExport('json')}>
            <Download size={14} /> JSON
          </button>
          {canManageUsers && (
            <button
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '8px 14px', marginLeft: 'auto' }}
              onClick={() => navigate('/admin/users')}
            >
              <Settings size={14} /> Users
            </button>
          )}
        </div>
      )}

      {/* ── Line Cards Grid ── */}
      <h2 className="page-title" style={{ fontSize: '1.2rem' }}>
        Production Lines
      </h2>
      <p className="page-subtitle">Click a line card to view details</p>

      {lines.length === 0 ? (
        <div className="card text-center text-muted" style={{ padding: '32px 16px' }}>
          <Factory size={32} style={{ margin: '0 auto 8px' }} />
          <p>No production lines configured.</p>
        </div>
      ) : (
        <div className="card-grid mb-4">
          {lines.map((line) => {
            const cardStats = getLineCardStats(line.id)
            const sCfg = statusConfig[line.status] || statusConfig.other
            const progressPercent = cardStats.total > 0
              ? Math.round((cardStats.completed / cardStats.total) * 100)
              : 0

            return (
              <div
                key={line.id}
                className="card card-clickable"
                onClick={() => navigate(`/line/${line.id}/areas`)}
                style={{ borderTop: `3px solid ${sCfg.color}` }}
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="badge"
                    style={{ background: sCfg.color, color: '#fff', fontSize: '0.7rem' }}
                  >
                    {sCfg.label}
                  </span>
                  <ChevronRight size={16} color="var(--color-text-muted)" />
                </div>

                {/* Line Name */}
                <h3 className="card-title">{line.name}</h3>
                <p className="card-desc">{line.facilities?.name || 'MACY Facility'}</p>

                {/* Progress Bar */}
                <div style={{ marginBottom: '8px' }}>
                  <div
                    style={{
                      height: '6px',
                      background: '#f0f0f0',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: progressPercent === 100 ? '#27ae60' : sCfg.color,
                        borderRadius: '3px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <p className="text-sm text-muted mt-1">
                    {cardStats.completed}/{cardStats.total} areas complete ({progressPercent}%)
                  </p>
                </div>

                {/* Quick Stats Row */}
                <div className="flex items-center justify-between text-sm text-muted flex-wrap gap-1">
                  <span className="flex items-center gap-1" title="Active assignments">
                    <Users size={12} /> {cardStats.assignments}
                  </span>
                  <span
                    className="flex items-center gap-1"
                    title="Open damage reports"
                    style={{ color: cardStats.damage > 0 ? '#e74c3c' : 'var(--color-text-muted)' }}
                  >
                    <ShieldAlert size={12} /> {cardStats.damage}
                  </span>
                  <span
                    className="flex items-center gap-1"
                    title="Open findings"
                    style={{ color: cardStats.findings > 0 ? '#f39c12' : 'var(--color-text-muted)' }}
                  >
                    <StickyNote size={12} /> {cardStats.findings}
                  </span>
                  <span className="flex items-center gap-1" title="Last updated">
                    <Clock size={12} /> {formatTime(line.updated_at || line.created_at)}
                  </span>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px', minHeight: '32px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/line/${line.id}/areas`)
                    }}
                  >
                    View
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px', minHeight: '32px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/line/${line.id}/damage-report`)
                    }}
                  >
                    Report Damage
                  </button>
                  {canViewFindings && (
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px', minHeight: '32px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/line/${line.id}/verify`)
                      }}
                    >
                      Verify
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recent Activity Feed ── */}
      <div className="card mb-4">
        <h3 className="card-title flex items-center gap-2" style={{ fontSize: '1.1rem' }}>
          <Activity size={18} />
          Recent Activity
        </h3>

        {activityLogs.length === 0 ? (
          <p className="text-muted text-center text-sm" style={{ padding: '16px' }}>
            No recent activity.
          </p>
        ) : (
          <>
            <div className="activity-list">
              {activityLogs
                .slice(activityPage * ACTIVITY_PAGE_SIZE, (activityPage + 1) * ACTIVITY_PAGE_SIZE)
                .map((log) => (
                  <div key={log.id} className="activity-item">
                    <span className="activity-time">{formatTime(log.created_at)}</span>
                    <div style={{ flex: 1 }}>
                      <span className="text-sm">{log.details || log.action}</span>
                      <div className="text-sm text-muted">
                        {log.profiles?.full_name || 'System'}
                        {log.line_id && ` · ${getLineName(log.line_id)}`}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Activity Pagination */}
            {activityLogs.length > ACTIVITY_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-2">
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', minHeight: '32px' }}
                  onClick={() => setActivityPage(p => Math.max(0, p - 1))}
                  disabled={activityPage === 0}
                >
                  Previous
                </button>
                <span className="text-sm text-muted">
                  Page {activityPage + 1} of {Math.ceil(activityLogs.length / ACTIVITY_PAGE_SIZE)}
                </span>
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', minHeight: '32px' }}
                  onClick={() => setActivityPage(p => p + 1)}
                  disabled={(activityPage + 1) * ACTIVITY_PAGE_SIZE >= activityLogs.length}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Findings Summary (Area Leads+) ── */}
      {canViewFindings && (
        <div className="card mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 className="card-title flex items-center gap-2 mb-0" style={{ fontSize: '1.1rem' }}>
              <FileText size={18} />
              Findings Summary
            </h3>
            <div className="flex items-center gap-2">
              {/* Filter */}
              <select
                className="form-select"
                style={{ fontSize: '0.8rem', padding: '6px 10px', minHeight: '32px', width: 'auto' }}
                value={findingFilter}
                onChange={(e) => setFindingFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
              {/* Sort */}
              <select
                className="form-select"
                style={{ fontSize: '0.8rem', padding: '6px 10px', minHeight: '32px', width: 'auto' }}
                value={findingSort}
                onChange={(e) => setFindingSort(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {filteredFindings.length === 0 ? (
            <p className="text-muted text-center text-sm" style={{ padding: '16px' }}>
              No findings match the selected filter.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f0f0f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Area</th>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Severity</th>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Reporter</th>
                    <th style={{ padding: '8px', fontWeight: 600 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((f) => (
                    <tr
                      key={f.id}
                      style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                      onClick={() => navigate(`/line/${f.line_id}/verify`)}
                    >
                      <td style={{ padding: '8px' }}>
                        <span className="text-sm">
                          {lineStats[f.line_id]?.areas?.find(a => a.id === f.area_id)?.name || f.area_id?.substring(0, 8)}
                        </span>
                      </td>
                      <td style={{ padding: '8px', maxWidth: '200px' }}>
                        <span className="text-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.description}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span
                          className="badge"
                          style={{
                            background: severityConfig[f.severity]?.bg || '#fff3cd',
                            color: severityConfig[f.severity]?.color || '#f39c12',
                            fontSize: '0.65rem',
                          }}
                        >
                          {severityConfig[f.severity]?.label || f.severity}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span
                          className="badge"
                          style={{
                            background: f.status === 'open' ? '#fdecea' : '#d4edda',
                            color: f.status === 'open' ? '#e74c3c' : '#27ae60',
                            fontSize: '0.65rem',
                          }}
                        >
                          {f.status === 'open' ? 'Open' : 'Resolved'}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span className="text-sm text-muted">{f.profiles?.full_name || 'Unknown'}</span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span className="text-sm text-muted">{formatDateTime(f.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Empty State Helpers ── */}
      {lines.length === 0 && activityLogs.length === 0 && (
        <div className="card text-center text-muted" style={{ padding: '48px 16px' }}>
          <LayoutDashboard size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: '1.1rem' }}>Welcome to SaniExpert Dashboard</p>
          <p className="text-sm">Data will appear here once production lines are configured.</p>
        </div>
      )}
    </div>
  )
}
