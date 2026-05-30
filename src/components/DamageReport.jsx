import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Camera,
  Upload,
  X,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  ImageOff,
  MapPin,
  User,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Clock
} from 'lucide-react'
import {
  supabase,
  getCurrentUser,
  getProfile,
  getAreas,
  getDamageReports,
  createDamageReport,
  logActivity,
  resolveDamageReport,
} from '@/lib/supabase.js'
import { compressPhoto, fileToBase64 } from '@/utils/photoCompression.js'

/**
 * DamageReport Component
 * Route: /line/:lineId/damage-report
 * Any employee can report damage at any time.
 * Photo is MANDATORY — form blocks submission without it.
 */
export default function DamageReport() {
  const { lineId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // ── User & Data State ──
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [areas, setAreas] = useState([])
  const [damageReports, setDamageReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  // ── Form State ──
  const [areaId, setAreaId] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [compressing, setCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Realtime ──
  const channelRef = useRef(null)

  // ── Severity Config ──
  const severityConfig = {
    low:    { label: 'Low',    color: '#27ae60', bg: '#d4edda' },
    medium: { label: 'Medium', color: '#f39c12', bg: '#fff3cd' },
    high:   { label: 'High',   color: '#e74c3c', bg: '#fdecea' },
  }

  // ── Status Config ──
  const statusConfig = {
    open:       { label: 'Open',        color: '#e74c3c', bg: '#fdecea', icon: AlertTriangle },
    in_progress: { label: 'In Progress', color: '#f39c12', bg: '#fff3cd', icon: Clock },
    resolved:   { label: 'Resolved',    color: '#27ae60', bg: '#d4edda', icon: ShieldCheck },
  }

  // ═══════════════════════════════════════════
  //  Initial Data Fetch
  // ═══════════════════════════════════════════
  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        setLoading(true)
        setFetchError('')

        // Get current user & profile
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          navigate('/login')
          return
        }
        if (!cancelled) setUser(currentUser)

        const profileData = await getProfile(currentUser.id)
        if (!cancelled) {
          setProfile(profileData)
          if (profileData?.full_name) {
            // reporter name is read-only from profile
          }
        }

        // Fetch areas for this line
        const { data: areasData, error: areasError } = await getAreas(lineId)
        if (areasError) throw areasError
        if (!cancelled) {
          setAreas(areasData || [])
          if (areasData?.length > 0) {
            setAreaId(areasData[0].id)
          }
        }

        // Fetch existing damage reports
        const { data: reportsData, error: reportsError } = await getDamageReports(lineId)
        if (reportsError) throw reportsError
        if (!cancelled) setDamageReports(reportsData || [])

      } catch (err) {
        if (!cancelled) setFetchError(err.message || 'Failed to load data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [lineId, navigate])

  // ═══════════════════════════════════════════
  //  Realtime Subscription
  // ═══════════════════════════════════════════
  useEffect(() => {
    const channel = supabase
      .channel(`damage-reports-${lineId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'damage_reports', filter: `line_id=eq.${lineId}` },
        async () => {
          // Refresh damage reports on any change
          const { data } = await getDamageReports(lineId)
          setDamageReports(data || [])
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [lineId])

  // ═══════════════════════════════════════════
  //  Photo Handling
  // ═══════════════════════════════════════════
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFormError('')
    setCompressing(true)

    try {
      // Compress the photo
      const compressed = await compressPhoto(file)
      setPhotoFile(compressed)

      // Generate preview
      const base64 = await fileToBase64(compressed)
      setPhotoPreview(base64)
    } catch (err) {
      setFormError('Failed to process photo: ' + err.message)
      setPhotoFile(null)
      setPhotoPreview(null)
    } finally {
      setCompressing(false)
    }
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // ═══════════════════════════════════════════
  //  Form Submission
  // ═══════════════════════════════════════════
  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSuccess('')

    // ── Validation ──
    if (!areaId) {
      setFormError('Please select an area.')
      return
    }
    if (!description.trim()) {
      setFormError('Please describe the damage.')
      return
    }
    if (!photoFile) {
      setFormError('Photo is required. Please capture or upload a photo of the damage.')
      return
    }
    if (!severity) {
      setFormError('Please select a severity level.')
      return
    }

    setSubmitting(true)

    try {
      // ── Step 1: Upload photo to Supabase Storage ──
      const fileName = `${lineId}/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('verification-photos')
        .upload(fileName, photoFile, { contentType: 'image/jpeg' })

      if (uploadError) throw new Error('Photo upload failed: ' + uploadError.message)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('verification-photos')
        .getPublicUrl(uploadData.path)

      // ── Step 2: Create damage report ──
      const report = {
        line_id: lineId,
        area_id: areaId,
        description: description.trim(),
        photo_url: publicUrl,
        severity,
        reported_by: user?.id,
        status: 'open',
        created_at: new Date().toISOString(),
      }

      const { error: reportError } = await createDamageReport(report)
      if (reportError) throw reportError

      // ── Step 3: Log activity ──
      await logActivity({
        line_id: lineId,
        area_id: areaId,
        action: 'damage_report_created',
        details: `Damage report (${severity}) submitted for ${areas.find(a => a.id === areaId)?.name || 'Unknown Area'}`,
        performed_by: user?.id,
        created_at: new Date().toISOString(),
      })

      // ── Success ──
      setSuccess('Damage report submitted successfully.')

      // Reset form
      setDescription('')
      setSeverity('medium')
      clearPhoto()

      // Refresh reports list
      const { data: refreshed } = await getDamageReports(lineId)
      setDamageReports(refreshed || [])

      // Navigate back after brief delay
      setTimeout(() => {
        navigate(`/line/${lineId}/areas`)
      }, 1500)

    } catch (err) {
      setFormError(err.message || 'Failed to submit damage report.')
    } finally {
      setSubmitting(false)
    }
  }

  // ═══════════════════════════════════════════
  //  Resolve Damage Report
  // ═══════════════════════════════════════════
  const handleResolve = async (reportId) => {
    try {
      const { error } = await resolveDamageReport(reportId)
      if (error) throw error

      await logActivity({
        line_id: lineId,
        action: 'damage_report_resolved',
        details: `Damage report #${reportId} marked as resolved`,
        performed_by: user?.id,
        created_at: new Date().toISOString(),
      })

      const { data: refreshed } = await getDamageReports(lineId)
      setDamageReports(refreshed || [])
    } catch (err) {
      setFormError('Failed to resolve report: ' + err.message)
    }
  }

  // ═══════════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════════
  const getAreaName = (areaId) => {
    return areas.find(a => a.id === areaId)?.name || 'Unknown Area'
  }

  const formatDate = (isoString) => {
    if (!isoString) return ''
    const d = new Date(isoString)
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  // ═══════════════════════════════════════════
  //  Render: Loading
  // ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading damage report form...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  //  Render: Error
  // ═══════════════════════════════════════════
  if (fetchError) {
    return (
      <div className="page">
        <div className="toast toast-error">{fetchError}</div>
        <button className="btn btn-outline" onClick={() => navigate(`/line/${lineId}/areas`)}>
          <ChevronLeft size={18} /> Go Back
        </button>
      </div>
    )
  }

  const openReports = damageReports.filter(r => r.status === 'open')

  // ═══════════════════════════════════════════
  //  Render: Main
  // ═══════════════════════════════════════════
  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button className="navbar-btn" onClick={() => navigate(`/line/${lineId}/areas`)}>
          <ChevronLeft size={20} />
        </button>
        <h1 className="page-title mb-0">Damage Report</h1>
      </div>
      <p className="page-subtitle">
        {lineId?.replace(/-/g, ' ')?.toUpperCase()}
        {profile?.full_name && ` — Reporter: ${profile.full_name}`}
      </p>

      {/* Unresolved damage banner */}
      {openReports.length > 0 && (
        <div className="damage-banner flex items-center gap-2">
          <ShieldAlert size={18} />
          <span>
            <strong>{openReports.length} unresolved</strong> damage report{openReports.length !== 1 ? 's' : ''} on this line.
            These must be resolved before post-cleaning verification.
          </span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="toast toast-success flex items-center gap-2">
          <ShieldCheck size={16} />
          {success}
        </div>
      )}

      {/* Error Message */}
      {formError && (
        <div className="toast toast-error flex items-center gap-2">
          <AlertTriangle size={16} />
          {formError}
        </div>
      )}

      {/* ── Report Form ── */}
      <form onSubmit={handleSubmit} className="card mb-4">
        <h3 className="card-title flex items-center gap-2">
          <ShieldAlert size={18} className="text-danger" />
          New Damage Report
        </h3>
        <p className="card-desc">All fields are required. Photo evidence is mandatory.</p>

        {/* Area Selector */}
        <div className="form-group">
          <label htmlFor="area">
            <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Area
          </label>
          <select
            id="area"
            className="form-select"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            required
          >
            <option value="">Select an area...</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
          {areas.length === 0 && (
            <p className="text-sm text-muted mt-1">No areas found for this line.</p>
          )}
        </div>

        {/* Damage Description */}
        <div className="form-group">
          <label htmlFor="description">Damage Description *</label>
          <textarea
            id="description"
            className="form-textarea"
            placeholder="Describe the damage or maintenance issue in detail..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {/* Severity Selector */}
        <div className="form-group">
          <label>Severity *</label>
          <div className="radio-group">
            {Object.entries(severityConfig).map(([key, config]) => (
              <label
                key={key}
                className="radio-label"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: severity === key ? config.bg : 'transparent',
                  border: severity === key ? `2px solid ${config.color}` : '2px solid transparent',
                  transition: 'var(--transition)',
                }}
              >
                <input
                  type="radio"
                  name="severity"
                  value={key}
                  checked={severity === key}
                  onChange={() => setSeverity(key)}
                />
                <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reporter Name (read-only) */}
        <div className="form-group">
          <label htmlFor="reporter">Reported By</label>
          <input
            id="reporter"
            type="text"
            className="form-input"
            value={profile?.full_name || user?.email || 'Unknown'}
            readOnly
            style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
          />
        </div>

        {/* Photo Upload — MANDATORY */}
        <div className="form-group">
          <label htmlFor="photo">
            <Camera size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Photo Evidence * <span style={{ color: '#e74c3c' }}>(Required)</span>
          </label>

          {!photoPreview ? (
            <div
              className="photo-dropzone"
              onClick={() => fileInputRef.current?.click()}
              style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
            >
              {compressing ? (
                <>
                  <Loader2 size={32} className="text-muted" style={{ animation: 'spin 1s linear infinite' }} />
                  <p>Compressing photo...</p>
                </>
              ) : (
                <>
                  <Camera size={32} />
                  <p>Tap to capture photo</p>
                  <p className="text-sm text-muted">Use device camera for best results</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                id="photo"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <img
                src={photoPreview}
                alt="Damage preview"
                style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
              />
              <button
                type="button"
                onClick={clearPhoto}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
              <div
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  left: '8px',
                  right: '8px',
                  display: 'flex',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '8px', minHeight: '36px', background: 'rgba(255,255,255,0.9)' }}
                >
                  <Camera size={14} /> Retake
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-danger btn-full"
          disabled={submitting || compressing}
        >
          {submitting ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Submitting...
            </>
          ) : (
            <>
              <ShieldAlert size={18} />
              Submit Damage Report
            </>
          )}
        </button>
      </form>

      {/* ── Existing Damage Reports ── */}
      <div className="mt-4">
        <h2 className="page-title" style={{ fontSize: '1.2rem' }}>
          Existing Reports ({damageReports.length})
        </h2>
        <p className="page-subtitle">All damage reports for this production line</p>

        {damageReports.length === 0 ? (
          <div className="card text-center" style={{ padding: '32px 16px', color: 'var(--color-text-muted)' }}>
            <ShieldCheck size={32} style={{ margin: '0 auto 8px', color: 'var(--color-success)' }} />
            <p>No damage reports yet.</p>
            <p className="text-sm">Great! No issues have been reported.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {damageReports.map((report) => {
              const sConfig = statusConfig[report.status] || statusConfig.open
              const sevConfig = severityConfig[report.severity] || severityConfig.medium
              const StatusIcon = sConfig.icon

              return (
                <div key={report.id} className="card" style={{ overflow: 'hidden' }}>
                  {/* Photo Thumbnail */}
                  {report.photo_url && (
                    <div style={{ margin: '-16px -16px 12px', maxHeight: '200px', overflow: 'hidden' }}>
                      <img
                        src={report.photo_url}
                        alt="Damage"
                        style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      {/* Area & Description */}
                      <h4 className="card-title flex items-center gap-2" style={{ fontSize: '1rem' }}>
                        <MapPin size={14} color="var(--color-primary)" />
                        {getAreaName(report.area_id)}
                      </h4>
                      <p style={{ fontSize: '0.9rem', margin: '4px 0 8px', lineHeight: 1.5 }}>
                        {report.description}
                      </p>

                      {/* Badges Row */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <span
                          className="badge"
                          style={{
                            background: sConfig.bg,
                            color: sConfig.color,
                            border: `1px solid ${sConfig.color}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <StatusIcon size={12} />
                          {sConfig.label}
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: sevConfig.bg,
                            color: sevConfig.color,
                            border: `1px solid ${sevConfig.color}`,
                          }}
                        >
                          {sevConfig.label}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="text-sm text-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {report.profiles?.full_name || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(report.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Resolve Action (for leads/admins) */}
                    {(profile?.role === 'area_lead' || profile?.role === 'supervisor' || profile?.role === 'admin') && report.status === 'open' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleResolve(report.id)}
                        style={{ fontSize: '0.8rem', padding: '8px 12px', minHeight: '36px', whiteSpace: 'nowrap' }}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
