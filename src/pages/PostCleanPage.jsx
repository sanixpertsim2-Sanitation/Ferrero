import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChecklist, insertPostCleanLog, insertDamageReport, insertHandoverTask, getPreCleanLogs, uploadPhoto } from '@/lib/supabase.js'
import { detectShift } from '@/utils/shiftDetection.js'

/**
 * PostCleanPage — Post-cleaning checklist with bag count validation
 * Validates bag count against pre-clean. Creates handover tasks for "Not Acceptable".
 * Damage report modal available during checklist.
 */
export default function PostCleanPage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [employeeName, setEmployeeName] = useState('')
  const [equipmentCovered, setEquipmentCovered] = useState('')
  const [bagsRetrieved, setBagsRetrieved] = useState('')
  const [items, setItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showDamageModal, setShowDamageModal] = useState(false)
  const [damageDesc, setDamageDesc] = useState('')
  const [damageSeverity, setDamageSeverity] = useState('medium')
  const [damagePhotoFile, setDamagePhotoFile] = useState(null)
  const [damagePhotoPreview, setDamagePhotoPreview] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selectedLine')
    if (!saved) { navigate('/lines'); return }
    const parsed = JSON.parse(saved)
    setLine(parsed)
    getChecklist(parsed.id, 'post-cleaning').then(data => { setItems(data || []); setLoading(false) })
  }, [navigate])

  const handleResponse = (value) => {
    const item = items[currentIndex]
    setResponses(prev => ({ ...prev, [item.id]: { response: value, notes: prev[item.id]?.notes || '' } }))
  }
  const handleNotes = (notes) => {
    const item = items[currentIndex]
    setResponses(prev => ({ ...prev, [item.id]: { ...prev[item.id], notes } }))
  }
  const handleNext = () => { if (currentIndex < items.length - 1) setCurrentIndex(i => i + 1) }
  const handlePrev = () => { if (currentIndex > 0) setCurrentIndex(i => i - 1) }

  const handleDamagePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setDamagePhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setDamagePhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleDamageSubmit = async () => {
    if (!damageDesc.trim()) { alert('Description required'); return }
    setUploadingPhoto(true)
    try {
      let photoUrl = ''
      if (damagePhotoFile) {
        photoUrl = await uploadPhoto(damagePhotoFile)
      }
      await insertDamageReport({ line_id: line.id, description: damageDesc, photo_url: photoUrl, severity: damageSeverity, status: 'open' })
      setShowDamageModal(false); setDamageDesc(''); setDamagePhotoFile(null); setDamagePhotoPreview('');
      alert('Damage reported!')
    } catch (e) { alert('Upload error: ' + e.message) }
    setUploadingPhoto(false)
  }

  const handleSubmit = async () => {
    if (!employeeName.trim()) { alert('Employee name required'); return }
    if (!equipmentCovered || !bagsRetrieved) { alert('Equipment and bag counts required'); return }
    const unanswered = items.filter(i => !responses[i.id]?.response)
    if (unanswered.length > 0) { alert(`${unanswered.length} items unanswered`); return }

    // Bag count validation against pre-clean
    try {
      const preLogs = await getPreCleanLogs(line.id)
      const today = new Date().toISOString().split('T')[0]
      const todayPre = preLogs.find(l => l.completed_at?.startsWith(today))
      if (todayPre?.equipment_covered && parseInt(bagsRetrieved) !== parseInt(todayPre.equipment_covered)) {
        if (!confirm(`Bag count mismatch! Pre-clean equipment: ${todayPre.equipment_covered}, Post-clean bags: ${bagsRetrieved}. Submit anyway?`)) return
      }
    } catch (_) { /* ignore validation errors, allow submission */ }

    setSubmitting(true)
    try {
      const responsesJson = {}
      Object.entries(responses).forEach(([id, r]) => { responsesJson[id] = r })
      await insertPostCleanLog({
        line_id: line.id, employee_name: employeeName.trim(), shift: detectShift(),
        equipment_covered: parseInt(equipmentCovered) || 0, bags_retrieved: parseInt(bagsRetrieved) || 0,
        responses: responsesJson, completed_at: new Date().toISOString()
      })
      // Create handover tasks for Not Acceptable items
      for (const [itemId, resp] of Object.entries(responses)) {
        if (resp.response === 'Not Acceptable') {
          const item = items.find(i => i.id === itemId)
          await insertHandoverTask({ line_id: line.id, source: 'post_cleaning', description: `${item?.item_text || 'Item'} — Not Acceptable`, status: 'pending' })
        }
      }
      alert('Post-cleaning submitted!'); navigate('/control')
    } catch (e) { alert('Error: ' + e.message); setSubmitting(false) }
  }

  const handleCancel = () => { if (confirm('Cancel?')) navigate('/control') }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!items.length) return <div className="page"><p>No checklist items.</p><button className="btn btn-outline" onClick={handleCancel}>Back</button></div>

  const currentItem = items[currentIndex]
  const currentResponse = responses[currentItem?.id]

  return (
    <div className="page checklist-page">
      <div className="checklist-header">
        <h1>Post-Cleaning — MACY {line?.name?.replace('MACY ', '')}</h1>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} /></div>
        <p className="progress-text">Item {currentIndex + 1} of {items.length}</p>
      </div>

      <button className="btn btn-secondary damage-btn" onClick={() => setShowDamageModal(true)}>Report Damage</button>

      <div className="count-inputs card">
        <label>Employee Name *<input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Your name" /></label>
        <label>Equipment Covered *<input type="number" value={equipmentCovered} onChange={e => setEquipmentCovered(e.target.value)} placeholder="Count" min="0" /></label>
        <label>Bags Retrieved *<input type="number" value={bagsRetrieved} onChange={e => setBagsRetrieved(e.target.value)} placeholder="Count" min="0" /></label>
      </div>

      <div className="checklist-item card">
        <h3>{currentItem.item_text}</h3>
        {currentItem.help_text && <p className="help-text">{currentItem.help_text}</p>}
        <div className="response-buttons">
          <button className={`btn-response btn-acceptable ${currentResponse?.response === 'Acceptable' ? 'active' : ''}`} onClick={() => handleResponse('Acceptable')}>Acceptable</button>
          <button className={`btn-response btn-not-acceptable ${currentResponse?.response === 'Not Acceptable' ? 'active' : ''}`} onClick={() => handleResponse('Not Acceptable')}>Not Acceptable</button>
          <button className={`btn-response btn-na ${currentResponse?.response === 'N/A' ? 'active' : ''}`} onClick={() => handleResponse('N/A')}>N/A</button>
        </div>
        <textarea className="notes-input" placeholder="Notes (optional)" value={currentResponse?.notes || ''} onChange={e => handleNotes(e.target.value)} rows={3} />
      </div>

      <div className="checklist-nav">
        <button className="btn btn-outline" onClick={handlePrev} disabled={currentIndex === 0}>Previous</button>
        {currentIndex < items.length - 1
          ? <button className="btn btn-primary" onClick={handleNext} disabled={!currentResponse?.response}>Next</button>
          : <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : 'Submit'}</button>
        }
      </div>
      <button className="btn btn-outline btn-cancel" onClick={handleCancel}>Cancel</button>

      {showDamageModal && (
        <div className="modal-overlay" onClick={() => setShowDamageModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Report Damage</h3>
            <textarea placeholder="Describe the damage..." value={damageDesc} onChange={e => setDamageDesc(e.target.value)} rows={3} />
            <select value={damageSeverity} onChange={e => setDamageSeverity(e.target.value)}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
            <label className="photo-upload">
              <input type="file" accept="image/*" capture="environment" onChange={handleDamagePhotoChange} style={{ display: 'none' }} />
              <div className="photo-dropzone">
                {damagePhotoPreview ? <img src={damagePhotoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 120 }} /> : <span>📷 Tap to take photo</span>}
              </div>
            </label>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDamageModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDamageSubmit} disabled={uploadingPhoto}>{uploadingPhoto ? 'Uploading...' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
