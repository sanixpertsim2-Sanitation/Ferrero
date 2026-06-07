import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getChecklist, insertInspectionLog, insertHandoverTask } from '@/lib/supabase.js'

/**
 * VerifyPage — Area lead verification with signature
 * Same checklist as post-clean. Any issues create handover tasks.
 */
export default function VerifyPage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [areaLeadName, setAreaLeadName] = useState('')
  const [items, setItems] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signatureData, setSignatureData] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('selectedLine')
    if (!saved) { navigate('/lines'); return }
    const parsed = JSON.parse(saved)
    setLine(parsed)
    getChecklist(parsed.id, 'post-cleaning').then(data => { setItems(data || []); setLoading(false) })
  }, [navigate])

  // Canvas signature handlers
  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'
    ctx.stroke()
  }

  const endDraw = () => {
    setIsDrawing(false)
    setSignatureData(canvasRef.current.toDataURL())
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData('')
  }

  const handleResponse = (value) => {
    const item = items[currentIndex]
    setResponses(prev => ({ ...prev, [item.id]: { response: value, notes: prev[item.id]?.notes || '' } }))
  }

  const handleNotes = (notes) => {
    const item = items[currentIndex]
    setResponses(prev => ({ ...prev, [item.id]: { ...prev[item.id], notes } }))
  }

  const handleSubmit = async () => {
    if (!areaLeadName.trim()) { alert('Area Lead Name is required'); return }
    if (!signatureData) { alert('Signature is required'); return }
    const unanswered = items.filter(i => !responses[i.id]?.response)
    if (unanswered.length > 0) { alert(`${unanswered.length} items unanswered`); return }

    setSubmitting(true)
    try {
      const responsesJson = {}
      Object.entries(responses).forEach(([id, r]) => { responsesJson[id] = r })
      await insertInspectionLog({
        line_id: line.id, area_lead_name: areaLeadName.trim(),
        signature: signatureData, responses: responsesJson,
        completed_at: new Date().toISOString()
      })

      let handoverCount = 0
      for (const [itemId, resp] of Object.entries(responses)) {
        if (resp.response === 'Not Acceptable' || (resp.notes || '').trim()) {
          const item = items.find(i => i.id === itemId)
          await insertHandoverTask({
            line_id: line.id, source: 'area_inspection',
            description: `${item?.item_text}: ${resp.notes || 'Not Acceptable'}`, status: 'pending'
          })
          handoverCount++
        }
      }

      if (handoverCount > 0) { alert(`${handoverCount} handover(s) created`); navigate('/handover') }
      else { alert('Verification complete!'); navigate('/control') }
    } catch (e) { alert('Error: ' + e.message); setSubmitting(false) }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!items.length) return <div className="page"><p>No checklist.</p></div>

  const currentItem = items[currentIndex]
  const currentResponse = responses[currentItem?.id]

  return (
    <div className="page checklist-page">
      <h1>Area Lead Verification — MACY {line?.name?.replace('MACY ', '')}</h1>

      <div className="verify-info card">
        <label>Area Lead Name *<input type="text" value={areaLeadName} onChange={e => setAreaLeadName(e.target.value)} placeholder="Enter name" /></label>
        <label>Signature *</label>
        <canvas ref={canvasRef} width={300} height={100} className="signature-pad"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
        <button className="btn btn-outline" onClick={clearSignature}>Clear</button>
      </div>

      <div className="progress-bar"><div className="progress-fill" style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} /></div>
      <p>Item {currentIndex + 1} of {items.length}</p>

      <div className="checklist-item card">
        <h3>{currentItem.item_text}</h3>
        {currentItem.help_text && <p className="help-text">{currentItem.help_text}</p>}
        <div className="response-buttons">
          <button className={`btn-response btn-acceptable ${currentResponse?.response === 'Acceptable' ? 'active' : ''}`} onClick={() => handleResponse('Acceptable')}>Acceptable</button>
          <button className={`btn-response btn-not-acceptable ${currentResponse?.response === 'Not Acceptable' ? 'active' : ''}`} onClick={() => handleResponse('Not Acceptable')}>Not Acceptable</button>
          <button className={`btn-response btn-na ${currentResponse?.response === 'N/A' ? 'active' : ''}`} onClick={() => handleResponse('N/A')}>N/A</button>
        </div>
        <textarea className="notes-input" placeholder="Notes (required if Not Acceptable)" value={currentResponse?.notes || ''} onChange={e => handleNotes(e.target.value)} rows={3} />
      </div>

      <div className="checklist-nav">
        <button className="btn btn-outline" onClick={() => setCurrentIndex(i => i - 1)} disabled={currentIndex === 0}>Previous</button>
        {currentIndex < items.length - 1
          ? <button className="btn btn-primary" onClick={() => setCurrentIndex(i => i + 1)} disabled={!currentResponse?.response}>Next</button>
          : <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : 'Submit'}</button>
        }
      </div>
    </div>
  )
}
