import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChecklist, insertPreCleanLog } from '@/lib/supabase.js'
import { detectShift } from '@/utils/shiftDetection.js'

/**
 * PreCleanPage — Step-by-step pre-cleaning checklist
 * Employee completes pre-clean inspection → submits to pre_cleaning_logs
 * Completion unlocks post-clean on the Control Page.
 */
export default function PreCleanPage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [employeeName, setEmployeeName] = useState('')
  const [items, setItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selectedLine')
    if (!saved) { navigate('/lines'); return }
    const parsed = JSON.parse(saved)
    setLine(parsed)
    getChecklist(parsed.id, 'pre-cleaning').then(data => {
      setItems(data || [])
      setLoading(false)
    })
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

  const handleSubmit = async () => {
    if (!employeeName.trim()) { alert('Employee name is required'); return }
    const unanswered = items.filter(i => !responses[i.id]?.response)
    if (unanswered.length > 0) { alert(`${unanswered.length} items unanswered`); return }

    setSubmitting(true)
    try {
      const responsesJson = {}
      Object.entries(responses).forEach(([id, r]) => { responsesJson[id] = r })
      await insertPreCleanLog({
        line_id: line.id,
        employee_name: employeeName.trim(),
        shift: detectShift(),
        responses: responsesJson,
        completed_at: new Date().toISOString()
      })
      alert('Pre-cleaning submitted successfully!')
      navigate('/control')
    } catch (e) {
      alert('Error: ' + e.message)
      setSubmitting(false)
    }
  }

  const handleCancel = () => { if (confirm('Cancel and return to control page?')) navigate('/control') }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!items.length) return <div className="page"><p>No checklist items found.</p><button className="btn btn-outline" onClick={handleCancel}>Back</button></div>

  const currentItem = items[currentIndex]
  const currentResponse = responses[currentItem?.id]

  return (
    <div className="page checklist-page">
      <div className="checklist-header">
        <h1>Pre-Cleaning — MACY {line?.name?.replace('MACY ', '')}</h1>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} /></div>
        <p className="progress-text">Item {currentIndex + 1} of {items.length}</p>
      </div>

      <div className="employee-input card">
        <label>Employee Name *</label>
        <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Enter your name" />
      </div>

      <div className="checklist-item card">
        <h3>{currentItem.item_text}</h3>
        {currentItem.help_text && <p className="help-text">{currentItem.help_text}</p>}
        <div className="response-buttons">
          <button className={`btn-response btn-acceptable ${currentResponse?.response === 'Acceptable' ? 'active' : ''}`} onClick={() => handleResponse('Acceptable')}>Acceptable</button>
          <button className={`btn-response btn-not-acceptable ${currentResponse?.response === 'Not Acceptable' ? 'active' : ''}`} onClick={() => handleResponse('Not Acceptable')}>Not Acceptable</button>
          <button className={`btn-response btn-na ${currentResponse?.response === 'N/A' ? 'active' : ''}`} onClick={() => handleResponse('N/A')}>N/A</button>
        </div>
        <textarea className="notes-input" placeholder="Additional notes (optional)" value={currentResponse?.notes || ''} onChange={e => handleNotes(e.target.value)} rows={3} />
      </div>

      <div className="checklist-nav">
        <button className="btn btn-outline" onClick={handlePrev} disabled={currentIndex === 0}>Previous</button>
        {currentIndex < items.length - 1
          ? <button className="btn btn-primary" onClick={handleNext} disabled={!currentResponse?.response}>Next</button>
          : <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !currentResponse?.response}>{submitting ? 'Submitting...' : 'Submit'}</button>
        }
      </div>
      <button className="btn btn-outline btn-cancel" onClick={handleCancel}>Cancel</button>
    </div>
  )
}
