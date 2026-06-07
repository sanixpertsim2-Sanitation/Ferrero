import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHandoverTasks, getDamageReports, insertReleaseLog } from '@/lib/supabase.js'

/**
 * ReleasePage — Final line release with guard conditions
 * Allowed ONLY when no open handovers AND no open damages.
 * Inserts into line_release_logs. Redirects to Control Page.
 */
export default function ReleasePage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [openHandovers, setOpenHandovers] = useState(0)
  const [openDamages, setOpenDamages] = useState(0)
  const [releasedBy, setReleasedBy] = useState('')
  const [releaseNotes, setReleaseNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selectedLine')
    if (!saved) { navigate('/lines'); return }
    const parsed = JSON.parse(saved)
    setLine(parsed)
    checkGate(parsed.id)
  }, [navigate])

  const checkGate = async (lineId) => {
    const [h, d] = await Promise.all([getHandoverTasks(lineId), getDamageReports(lineId)])
    setOpenHandovers(h.filter(t => t.status === 'pending').length)
    setOpenDamages(d.filter(r => r.status === 'open').length)
    setLoading(false)
  }

  const handleRelease = async () => {
    if (!releasedBy.trim()) { alert('Released By name is required'); return }
    setSubmitting(true)
    try {
      await insertReleaseLog({ line_id: line.id, released_by: releasedBy.trim(), release_notes: releaseNotes })
      alert('Line released successfully!')
      setTimeout(() => navigate('/control'), 1500)
    } catch (e) { alert('Error: ' + e.message); setSubmitting(false) }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const blocked = openHandovers > 0 || openDamages > 0

  return (
    <div className="page release-page">
      <h1>Release Line — MACY {line?.name?.replace('MACY ', '')}</h1>

      {blocked ? (
        <>
          <div className="banner banner-danger">Release Blocked</div>
          <div className="card">
            {openHandovers > 0 && <p>{openHandovers} open handover task(s)</p>}
            {openDamages > 0 && <p>{openDamages} open damage report(s)</p>}
            <p>All items must be resolved before release.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/handover')}>Go to Handover</button>
          <button className="btn btn-outline" onClick={() => navigate('/control')}>Back to Control</button>
        </>
      ) : (
        <>
          <div className="banner banner-success">All Checks Passed — Ready to Release</div>
          <div className="card">
            <label>Released By *<input type="text" value={releasedBy} onChange={e => setReleasedBy(e.target.value)} placeholder="Your name" /></label>
            <label>Release Notes<textarea value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)} placeholder="Optional" rows={3} /></label>
            <button className="btn btn-primary btn-large" onClick={handleRelease} disabled={submitting}>{submitting ? 'Releasing...' : 'Confirm Release'}</button>
          </div>
        </>
      )}
    </div>
  )
}
