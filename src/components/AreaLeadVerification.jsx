import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  User,
  Clock,
  ClipboardList,
  Camera,
  FileText,
  StickyNote,
  Ban,
  Search,
  PenLine,
} from 'lucide-react'
import {
  supabase,
  getCurrentUser,
  getProfile,
  getAreas,
  getDamageReports,
  getFindings,
  getAssignments,
  createFinding,
  createVerification,
  logActivity,
  getDashboardStats,
} from '@/lib/supabase.js'
import { compressPhoto, fileToBase64 } from '@/utils/photoCompression.js'

/**
 * AreaLeadVerification Component
 * Route: /line/:lineId/verify
 * Restricted to: area_lead, supervisor, admin roles
 * Final sign-off after reviewing all cleaning, damage reports, and findings.
 */
export default function AreaLeadVerification() {
  const { lineId } = useParams()
  const navigate = useNavigate()
  const photoInputRef = useRef(null)

  // ── User & Profile ──
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // ── Data ──
  const [areas, setAreas] = useState([])
  const [damageReports, setDamageReports] = useState([])
  const [findings, setFindings] = useState([])
  const [assignments, setAssignments] = useState([])
  const [lineStatus, setLineStatus] = useState('raw')

  // ── UI State ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Accordion State ──
  const [expandedArea, setExpandedArea] = useState(null)

  // ── Finding Form State ──
  const [showFindingForm, setShowFindingForm] = useState(false)
  const [findingAreaId, setFindingAreaId] = useState('')
  const [findingDescription, setFindingDescription] = useState('')
  const [findingSeverity, setFindingSeverity] = useState('minor')
  const [findingPhotoFile, setFindingPhotoFile] = useState(null)
  const [findingPhotoPreview, setFindingPhotoPreview] = useState(null)
  const [findingCompressing, setFindingCompressing] = useState(false)
  const [findingSubmitting, setFindingSubmitting] = useState(false)

  // ── Verification State ──
  const [verifyNotes, setVerifyNotes] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [needsReClean, setNeedsReClean] = useState(false)
  const [reCleanNotes, setReCleanNotes] = useState('')

  // ── Config ──
  const statusConfig = {
    raw:     { label: 'RAW',     color: '#3498db', bg: '#ebf5fb', desc: 'Ready to Clean' },
    cleaning:{ label: 'CLEANING',color: '#f39c12', bg: '#fef9e7', desc: 'Being Cleaned' },
    rte:     { label: 'RTE',     color: '#1a5f2a', bg: '#e8f5e9', desc: 'Ready to Examine' },
    other:   { label: 'OTHER',   color: '#95a5a6', bg: '#f2f3f4', desc: 'Not Started' },
  }

  const severityConfig = {
    minor:   { label: 'Minor',   color: '#f39c12', bg: '#fff3cd' },
    major:   { label: 'Major',   color: '#e67e22', bg: '#fdebd0' },
    critical:{ label: 'Critical',color: '#e74c3c', bg: '#fdecea' },
  }

  const damageStatusConfig = {
    open:        { label: 'Open',        color: '#e74c3c' },
    in_progress: { label: 'In Progress', color: '#f39c12' },
    resolved:    { label: 'Resolved',    color: '#27ae60' },
  }

  // ═══════════════════════════════════════════
  //  Auth & Data Fetch
  // ═══════════════════════════════════════════
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        setLoading(true)
        setError('')

        // Check auth
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          navigate('/login')
          return
        }
        if (!cancelled) setUser(currentUser)

        // Check role authorization
        const profileData = await getProfile(currentUser.id)
        if (!cancelled) setProfile(profileData)

        const allowedRoles = ['area_lead', 'supervisor', 'admin']
        if (!allowedRoles.includes(profileData?.role)) {
          if (!cancelled) setIsAuthorized(false)
          if (!cancelled) setLoading(false)
          return
        }
        if (!cancelled) setIsAuthorized(true)

        // Fetch all data for this line
        await fetchAllData()

      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load verification data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    return () => { cancelled = true }
  }, [lineId, navigate])

  // ═══════════════════════════════════════════
  //  Realtime Subscriptions
  // ═══════════════════════════════════════════
  useEffect(() => {
    const channel = supabase
      .channel(`verify-${lineId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_lines', filter: `id=eq.${lineId}` }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: `line_id=eq.${lineId}` }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'damage_reports', filter: `line_id=eq.${lineId}` }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'findings', filter: `line_id=eq.${lineId}` }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_responses', filter: `line_id=eq.${lineId}` }, () => fetchAllData())
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [lineId])

  // ═══════════════════════════════════════════
  //  Fetch All Data
  // ═══════════════════════════════════════════
  const fetchAllData = async () => {
    try {
      const [areasRes, damageRes, findingsRes, assignmentsRes, statsRes] = await Promise.all([
        getAreas(lineId),
        getDamageReports(lineId),
        getFindings(lineId),
        supabase.from('assignments').select('*, profiles(full_name)').eq('line_id', lineId).eq('date', new Date().toISOString().split('T')[0]),
        getDashboardStats(lineId),
      ])

      setAreas(areasRes.data || [])
      setDamageReports(damageRes.data || [])
      setFindings(findingsRes.data || [])
      setAssignments(assignmentsRes.data || [])

      // Get line status from production_lines
      const { data: lineData } = await supabase
        .from('production_lines')
        .select('status')
        .eq('id', lineId)
        .single()

      if (lineData) {
        setLineStatus(lineData.status || 'raw')
      }
    } catch (err) {
      setError('Failed to refresh data: ' + err.message)
    }
  }

  // ═══════════════════════════════════════════
  //  Damage Report Helpers
  // ═══════════════════════════════════════════
  const unresolvedDamage = damageReports.filter(r => r.status === 'open')
  const canVerify = areas.length > 0 && unresolvedDamage.length === 0

  // ═══════════════════════════════════════════
  //  Finding Photo
  // ═══════════════════════════════════════════
  const handleFindingPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFindingCompressing(true)
    try {
      const compressed = await compressPhoto(file)
      setFindingPhotoFile(compressed)
      const base64 = await fileToBase64(compressed)
      setFindingPhotoPreview(base64)
    } catch (err) {
      setError('Failed to process finding photo: ' + err.message)
    } finally {
      setFindingCompressing(false)
    }
  }

  const clearFindingPhoto = () => {
    setFindingPhotoFile(null)
    setFindingPhotoPreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  // ═══════════════════════════════════════════
  //  Submit Finding
  // ═══════════════════════════════════════════
  const handleSubmitFinding = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!findingAreaId) {
      setError('Please select an area for the finding.')
      return
    }
    if (!findingDescription.trim()) {
      setError('Please describe the finding.')
      return
    }

    setFindingSubmitting(true)

    try {
      let photoUrl = null

      // Upload photo if provided
      if (findingPhotoFile) {
        const fileName = `${lineId}/findings/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('verification-photos')
          .upload(fileName, findingPhotoFile, { contentType: 'image/jpeg' })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('verification-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = publicUrl
      }

      // Create finding
      const finding = {
        line_id: lineId,
        area_id: findingAreaId,
        description: findingDescription.trim(),
        severity: findingSeverity,
        photo_url: photoUrl,
        reported_by: user?.id,
        status: 'open',
        created_at: new Date().toISOString(),
      }

      const { error: findingError } = await createFinding(finding)
      if (findingError) throw findingError

      await logActivity({
        line_id: lineId,
        area_id: findingAreaId,
        action: 'finding_created',
        details: `Finding (${findingSeverity}) logged during verification`,
        performed_by: user?.id,
        created_at: new Date().toISOString(),
      })

      setSuccess('Finding recorded successfully.')

      // Reset form
      setFindingDescription('')
      setFindingSeverity('minor')
      clearFindingPhoto()
      setShowFindingForm(false)

      // Refresh
      const { data: refreshed } = await getFindings(lineId)
      setFindings(refreshed || [])

    } catch (err) {
      setError('Failed to create finding: ' + err.message)
    } finally {
      setFindingSubmitting(false)
    }
  }

  // ═══════════════════════════════════════════
  //  Verify Line
  // ═══════════════════════════════════════════
  const handleVerify = async () => {
    setError('')
    setSuccess('')

    if (unresolvedDamage.length > 0) {
      setError(`Cannot verify: ${unresolvedDamage.length} unresolved damage report(s).`)
      return
    }

    setVerifying(true)

    try {
      const today = new Date().toISOString()
      const shift = detectShift()

      // Create verification record
      const verification = {
        line_id: lineId,
        verified_by: user?.id,
        verified_at: today,
        shift,
        date: today.split('T')[0],
        status: 'verified',
        notes: verifyNotes.trim() || null,
      }

      const { error: verifyError } = await createVerification(verification)
      if (verifyError) throw verifyError

      // Update line status to RTE
      const { error: lineError } = await supabase
        .from('production_lines')
        .update({ status: 'rte', updated_at: today })
        .eq('id', lineId)

      if (lineError) throw lineError

      // Log activity
      await logActivity({
        line_id: lineId,
        action: 'line_verified',
        details: `Line verified by ${profile?.full_name || 'Area Lead'} — status changed to RTE`,
        performed_by: user?.id,
        created_at: today,
      })

      setSuccess('Line verified successfully! Status updated to Ready to Examine (RTE).')
      setLineStatus('rte')

      // Refresh data
      await fetchAllData()

      // Navigate after delay
      setTimeout(() => navigate('/dashboard'), 2000)

    } catch (err) {
      setError('Verification failed: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  // ═══════════════════════════════════════════
  //  Needs Re-Clean
  // ═══════════════════════════════════════════
  const handleNeedsReclean = async () => {
    setError('')
    setSuccess('')
    setVerifying(true)

    try {
      const today = new Date().toISOString()
      const shift = detectShift()

      // Create verification record with needs-reclean status
      const verification = {
        line_id: lineId,
        verified_by: user?.id,
        verified_at: today,
        shift,
        date: today.split('T')[0],
        status: 'needs_reclean',
        notes: reCleanNotes.trim() || 'Issues found during verification',
      }

      const { error: verifyError } = await createVerification(verification)
      if (verifyError) throw verifyError

      // Update line status
      const { error: lineError } = await supabase
        .from('production_lines')
        .update({ status: 'raw', updated_at: today })
        .eq('id', lineId)

      if (lineError) throw lineError

      await logActivity({
        line_id: lineId,
        action: 'line_needs_reclean',
        details: `Line marked for re-clean: ${reCleanNotes.trim() || 'Issues found'}`,
        performed_by: user?.id,
        created_at: today,
      })

      setSuccess('Line marked for re-clean. Status reset to RAW.')
      setLineStatus('raw')

      // Refresh
      await fetchAllData()

    } catch (err) {
      setError('Failed to mark for re-clean: ' + err.message)
    } finally {
      setVerifying(false)
    }
  }

  // ═══════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════
  const detectShift = () => {
    const now = new Date()
    const hour = now.getHours()
    const day = now.getDay()
    if (day === 0) return 'sunday'
    if (hour >= 19 || hour < 7) return 'night'
    if (hour >= 11 && hour < 19) return 'afternoon'
    return 'morning'
  }

  const getAreaName = (areaId) => areas.find(a => a.id === areaId)?.name || 'Unknown'

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const getAreaAssignments = (areaId) => assignments.filter(a => a.area_id === areaId)
  const getAreaDamage = (areaId) => damageReports.filter(r => r.area_id === areaId)
  const getAreaFindings = (areaId) => findings.filter(f => f.area_id === areaId)

  // ═══════════════════════════════════════════
  //  Render: Loading
  // ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading verification data...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  //  Render: Unauthorized
  // ═══════════════════════════════════════════
  if (!isAuthorized) {
    return (
      <div className="page">
        <div className="toast toast-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Ban size={18} />
          <div>
            <strong>Access Denied</strong>
            <p className="text-sm mt-1">Only Area Leads, Supervisors, and Admins can access verification.</p>
          </div>
        </div>
        <button className="btn btn-outline mt-3" onClick={() => navigate(`/line/${lineId}/areas`)}>
          <ChevronLeft size={18} /> Go Back
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  //  Render: Main
  // ═══════════════════════════════════════════
  return (
    <div className="page" style={{ paddingBottom: '140px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button className="navbar-btn" onClick={() => navigate(`/line/${lineId}/areas`)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="page-title mb-0">Area Lead Verification</h1>
      </div>
      <p className="page-subtitle">
        {lineId?.replace(/-/g, ' ')?.toUpperCase()} — Final sign-off review
      </p>

      {/* ── Line Status Overview ── */}
      <div
        className="card mb-3"
        style={{
          borderLeft: `4px solid ${statusConfig[lineStatus]?.color || '#95a5a6'}`,
          background: statusConfig[lineStatus]?.bg || '#f2f3f4',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm text-muted flex items-center gap-1">
              <ClipboardList size={14} /> Current Line Status
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="badge"
                style={{
                  background: statusConfig[lineStatus]?.color,
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              >
                {statusConfig[lineStatus]?.label || lineStatus?.toUpperCase()}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                {statusConfig[lineStatus]?.desc}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-sm text-muted">
              {areas.filter(a => a.status === 'rte').length}/{areas.length} areas ready
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="toast toast-success flex items-center gap-2 mb-3">
          <CheckCircle size={16} />
          {success}
        </div>
      )}
      {error && (
        <div className="toast toast-error flex items-center gap-2 mb-3">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Unresolved Damage Banner ── */}
      {unresolvedDamage.length > 0 && (
        <div className="damage-banner mb-3">
          <div className="flex items-start gap-2">
            <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Cannot verify — {unresolvedDamage.length} unresolved damage report{unresolvedDamage.length !== 1 ? 's' : ''}</strong>
              <p className="text-sm mt-1" style={{ margin: 0 }}>
                All damage reports must be resolved or acknowledged before verification.
              </p>
              <ul className="text-sm mt-1" style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                {unresolvedDamage.map(r => (
                  <li key={r.id}>
                    {getAreaName(r.area_id)}: {r.description.substring(0, 60)}{r.description.length > 60 ? '...' : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Area-by-Area Accordion ── */}
      <div className="area-list mb-4">
        <h3 className="card-title mb-2 flex items-center gap-2" style={{ fontSize: '1.1rem' }}>
          <Search size={18} />
          Area Review ({areas.length} areas)
        </h3>

        {areas.length === 0 ? (
          <div className="card text-center text-muted" style={{ padding: '24px' }}>
            No areas configured for this line.
          </div>
        ) : (
          areas.map((area) => {
            const isExpanded = expandedArea === area.id
            const areaAssignments = getAreaAssignments(area.id)
            const areaDamage = getAreaDamage(area.id)
            const areaFindings = getAreaFindings(area.id)
            const areaStatus = area.status || 'raw'
            const sCfg = statusConfig[areaStatus] || statusConfig.raw

            return (
              <div key={area.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {/* Accordion Header */}
                <button
                  onClick={() => setExpandedArea(isExpanded ? null : area.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <MapPin size={16} color="var(--color-primary)" />
                    <span className="area-name" style={{ fontSize: '1rem' }}>{area.name}</span>
                    <span
                      className="badge"
                      style={{
                        background: sCfg.color,
                        color: '#fff',
                        fontSize: '0.7rem',
                      }}
                    >
                      {sCfg.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {areaDamage.length > 0 && (
                      <span
                        className="badge"
                        style={{
                          background: '#fdecea',
                          color: '#e74c3c',
                          fontSize: '0.7rem',
                        }}
                      >
                        {areaDamage.length} damage
                      </span>
                    )}
                    {areaFindings.length > 0 && (
                      <span
                        className="badge"
                        style={{
                          background: '#fff3cd',
                          color: '#f39c12',
                          fontSize: '0.7rem',
                        }}
                      >
                        {areaFindings.length} findings
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {/* Accordion Body */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f0f0f0' }}>
                    {/* Assignments */}
                    <div style={{ marginTop: '12px' }}>
                      <h4 className="text-sm font-medium text-muted mb-1 flex items-center gap-1">
                        <User size={12} /> Cleaners Assigned
                      </h4>
                      {areaAssignments.length === 0 ? (
                        <p className="text-sm text-muted">No active assignments today.</p>
                      ) : (
                        areaAssignments.map(a => (
                          <div key={a.id} className="text-sm" style={{ padding: '4px 0' }}>
                            {a.profiles?.full_name || 'Unknown'} — {a.status || 'assigned'}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Damage Reports */}
                    {areaDamage.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <h4 className="text-sm font-medium text-muted mb-1 flex items-center gap-1">
                          <ShieldAlert size={12} /> Damage Reports
                        </h4>
                        {areaDamage.map(d => (
                          <div
                            key={d.id}
                            className="text-sm"
                            style={{
                              padding: '8px',
                              background: '#fdecea',
                              borderRadius: 'var(--radius-sm)',
                              marginBottom: '4px',
                              borderLeft: '3px solid #e74c3c',
                            }}
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <span
                                className="badge"
                                style={{
                                  background: damageStatusConfig[d.status]?.color || '#e74c3c',
                                  color: '#fff',
                                  fontSize: '0.65rem',
                                }}
                              >
                                {damageStatusConfig[d.status]?.label || d.status}
                              </span>
                              <span className="badge" style={{ background: severityConfig[d.severity]?.bg, color: severityConfig[d.severity]?.color, fontSize: '0.65rem' }}>
                                {severityConfig[d.severity]?.label || d.severity}
                              </span>
                            </div>
                            <p style={{ margin: 0 }}>{d.description}</p>
                            {d.photo_url && (
                              <img
                                src={d.photo_url}
                                alt="Damage"
                                style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '4px', marginTop: '4px' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Findings */}
                    {areaFindings.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <h4 className="text-sm font-medium text-muted mb-1 flex items-center gap-1">
                          <StickyNote size={12} /> Findings
                        </h4>
                        {areaFindings.map(f => (
                          <div
                            key={f.id}
                            className="text-sm"
                            style={{
                              padding: '8px',
                              background: severityConfig[f.severity]?.bg || '#fff3cd',
                              borderRadius: 'var(--radius-sm)',
                              marginBottom: '4px',
                              borderLeft: `3px solid ${severityConfig[f.severity]?.color || '#f39c12'}`,
                            }}
                          >
                            <span
                              className="badge"
                              style={{
                                background: severityConfig[f.severity]?.color || '#f39c12',
                                color: '#fff',
                                fontSize: '0.65rem',
                              }}
                            >
                              {severityConfig[f.severity]?.label || f.severity}
                            </span>
                            <p style={{ margin: '4px 0 0' }}>{f.description}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Add Finding Form (Collapsible) ── */}
      <div className="card mb-4">
        <button
          onClick={() => setShowFindingForm(!showFindingForm)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0',
          }}
        >
          <h3 className="card-title mb-0 flex items-center gap-2" style={{ fontSize: '1.05rem' }}>
            <PenLine size={18} />
            {showFindingForm ? 'Hide' : 'Add'} Finding
          </h3>
          {showFindingForm ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showFindingForm && (
          <form onSubmit={handleSubmitFinding} style={{ marginTop: '16px' }}>
            <p className="card-desc">Log an issue observed during verification. Photo is optional.</p>

            {/* Area */}
            <div className="form-group">
              <label>Area *</label>
              <select
                className="form-select"
                value={findingAreaId}
                onChange={(e) => setFindingAreaId(e.target.value)}
                required
              >
                <option value="">Select area...</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="form-group">
              <label>Finding Description *</label>
              <textarea
                className="form-textarea"
                placeholder="Describe the issue observed..."
                rows={3}
                value={findingDescription}
                onChange={(e) => setFindingDescription(e.target.value)}
                required
              />
            </div>

            {/* Severity */}
            <div className="form-group">
              <label>Severity *</label>
              <div className="radio-group">
                {Object.entries(severityConfig).map(([key, cfg]) => (
                  <label
                    key={key}
                    className="radio-label"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: findingSeverity === key ? cfg.bg : 'transparent',
                      border: findingSeverity === key ? `2px solid ${cfg.color}` : '2px solid transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="findingSeverity"
                      value={key}
                      checked={findingSeverity === key}
                      onChange={() => setFindingSeverity(key)}
                    />
                    <span style={{ color: cfg.color, fontWeight: 600, fontSize: '0.85rem' }}>{cfg.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Optional Photo */}
            <div className="form-group">
              <label>Photo (Optional)</label>
              {!findingPhotoPreview ? (
                <div
                  className="photo-dropzone"
                  onClick={() => photoInputRef.current?.click()}
                  style={{ minHeight: '100px', padding: '16px' }}
                >
                  {findingCompressing ? (
                    <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Camera size={24} />
                      <p className="text-sm">Tap to add photo (optional)</p>
                    </>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFindingPhoto}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <img
                    src={findingPhotoPreview}
                    alt="Finding"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                  <button
                    type="button"
                    onClick={clearFindingPhoto}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-secondary btn-full"
              disabled={findingSubmitting || findingCompressing}
            >
              {findingSubmitting ? (
                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Recording...</>
              ) : (
                <><StickyNote size={18} /> Record Finding</>
              )}
            </button>
          </form>
        )}
      </div>

      {/* ── Recent Findings Summary ── */}
      {findings.length > 0 && (
        <div className="card mb-4">
          <h3 className="card-title flex items-center gap-2" style={{ fontSize: '1.05rem' }}>
            <FileText size={18} />
            Recent Findings ({findings.length})
          </h3>
          <div className="activity-list">
            {findings.slice(0, 10).map(f => (
              <div key={f.id} className="activity-item">
                <span
                  className="badge"
                  style={{
                    background: severityConfig[f.severity]?.color || '#f39c12',
                    color: '#fff',
                    fontSize: '0.6rem',
                    padding: '2px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {severityConfig[f.severity]?.label}
                </span>
                <div style={{ flex: 1 }}>
                  <span className="text-sm">{getAreaName(f.area_id)}: {f.description.substring(0, 80)}{f.description.length > 80 ? '...' : ''}</span>
                  <div className="text-sm text-muted flex items-center gap-1 mt-1">
                    <User size={10} /> {f.profiles?.full_name || 'Unknown'} · <Clock size={10} /> {formatDate(f.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sticky Verification Actions ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          padding: '16px',
          zIndex: 100,
          borderTopLeftRadius: 'var(--radius-md)',
          borderTopRightRadius: 'var(--radius-md)',
        }}
      >
        <div className="page" style={{ maxWidth: '768px', margin: '0 auto', padding: 0 }}>
          {/* Notes Input */}
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="text-sm">
              <FileText size={12} style={{ display: 'inline' }} /> Verification Notes (optional)
            </label>
            <input
              type="text"
              className="form-input"
              style={{ padding: '10px 12px', fontSize: '0.9rem' }}
              placeholder="Any notes about this verification..."
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-danger"
              style={{ flex: 1, fontSize: '0.85rem', padding: '10px' }}
              onClick={() => setNeedsReClean(!needsReClean)}
              disabled={verifying}
            >
              <XCircle size={16} />
              {needsReClean ? 'Cancel' : 'Needs Re-Clean'}
            </button>

            <button
              className="btn btn-primary"
              style={{
                flex: 2,
                fontSize: '0.9rem',
                padding: '10px',
                opacity: canVerify ? 1 : 0.6,
              }}
              onClick={handleVerify}
              disabled={!canVerify || verifying}
            >
              {verifying ? (
                <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
              ) : (
                <><ShieldCheck size={18} /> Verify Line</>
              )}
            </button>
          </div>

          {!canVerify && unresolvedDamage.length > 0 && (
            <p className="text-sm text-danger mt-1 text-center">
              <AlertTriangle size={12} style={{ display: 'inline' }} /> Resolve {unresolvedDamage.length} damage report(s) to enable verification
            </p>
          )}

          {/* Re-Clean Confirmation */}
          {needsReClean && (
            <div className="mt-2" style={{ padding: '10px', background: '#fdecea', borderRadius: 'var(--radius-sm)' }}>
              <p className="text-sm text-danger mb-1">Confirm: Mark this line for re-cleaning?</p>
              <input
                type="text"
                className="form-input mb-2"
                style={{ fontSize: '0.85rem', padding: '8px 10px' }}
                placeholder="Reason for re-clean..."
                value={reCleanNotes}
                onChange={(e) => setReCleanNotes(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline" style={{ flex: 1, fontSize: '0.8rem' }} onClick={() => setNeedsReClean(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, fontSize: '0.8rem' }}
                  onClick={handleNeedsReclean}
                  disabled={verifying}
                >
                  {verifying ? 'Processing...' : 'Confirm Re-Clean'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
