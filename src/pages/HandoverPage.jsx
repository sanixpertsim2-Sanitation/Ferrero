import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getHandoverTasks, updateHandoverTask, getDamageReports, updateDamageReport, insertHandoverTask } from '@/lib/supabase.js'

/**
 * HandoverPage — Resolve all open handover tasks and damage reports
 * ALL tasks must be completed with photo proof before release is enabled.
 */
export default function HandoverPage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [tasks, setTasks] = useState([])
  const [damages, setDamages] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)
  const [completedBy, setCompletedBy] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [activeDamage, setActiveDamage] = useState(null)
  const [damageAction, setDamageAction] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('selectedLine')
    if (!saved) { navigate('/lines'); return }
    loadData(JSON.parse(saved))
  }, [navigate])

  const loadData = async (parsedLine) => {
    setLine(parsedLine)
    setLoading(true)
    const [t, d] = await Promise.all([getHandoverTasks(parsedLine.id), getDamageReports(parsedLine.id)])
    setTasks(t.filter(x => x.status === 'pending'))
    setCompletedTasks(t.filter(x => x.status === 'completed'))
    setDamages(d.filter(x => x.status === 'open'))
    setLoading(false)
  }

  const handleCompleteTask = async (taskId) => {
    if (!completedBy.trim()) { alert('Completed By name is required'); return }
    await updateHandoverTask(taskId, { status: 'completed', completed_by: completedBy.trim(), completion_notes: completionNotes, completed_at: new Date().toISOString() })
    setActiveTask(null); setCompletedBy(''); setCompletionNotes('')
    loadData(line)
  }

  const handleDamageCompleted = async (damageId) => {
    if (!completedBy.trim()) { alert('Name is required'); return }
    await updateDamageReport(damageId, { status: 'completed', completed_by: completedBy.trim(), completed_at: new Date().toISOString() })
    setActiveDamage(null); setCompletedBy(''); loadData(line)
  }

  const handleDamageHandover = async (damageId) => {
    if (!completionNotes.trim()) { alert('Handover reason is required'); return }
    const dmg = damages.find(d => d.id === damageId)
    await updateDamageReport(damageId, { status: 'handover', handover_reason: completionNotes.trim() })
    await insertHandoverTask({ line_id: line.id, source: 'damage_report', description: dmg.description, status: 'pending' })
    setActiveDamage(null); setCompletionNotes(''); loadData(line)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const openCount = tasks.length + damages.length

  return (
    <div className="page handover-page">
      <h1>Handover Tasks — MACY {line?.name?.replace('MACY ', '')}</h1>

      {openCount === 0
        ? <div className="banner banner-success">All tasks completed — ready for verification</div>
        : <div className="banner banner-warning">{openCount} open items remaining</div>
      }

      {tasks.length > 0 && <h2>Open Tasks ({tasks.length})</h2>}
      {tasks.map(task => (
        <div key={task.id} className="task-card card">
          <span className={`badge badge-${task.source}`}>{task.source.replace('_', ' ')}</span>
          <p>{task.description}</p>
          {activeTask === task.id ? (
            <div className="completion-form">
              <input type="text" placeholder="Completed By *" value={completedBy} onChange={e => setCompletedBy(e.target.value)} />
              <textarea placeholder="Notes" value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={2} />
              <button className="btn btn-primary" onClick={() => handleCompleteTask(task.id)}>Submit</button>
              <button className="btn btn-outline" onClick={() => setActiveTask(null)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setActiveTask(task.id)}>Complete Task</button>
          )}
        </div>
      ))}

      {damages.length > 0 && <h2>Open Damages ({damages.length})</h2>}
      {damages.map(dmg => (
        <div key={dmg.id} className="damage-card card">
          <span className={`badge badge-${dmg.severity}`}>{dmg.severity}</span>
          <p>{dmg.description}</p>
          {activeDamage === dmg.id ? (
            <div className="completion-form">
              <input type="text" placeholder="Name *" value={completedBy} onChange={e => setCompletedBy(e.target.value)} />
              <textarea placeholder={damageAction === 'handover' ? 'Handover Reason *' : 'Notes'} value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={2} />
              {damageAction === 'completed'
                ? <button className="btn btn-primary" onClick={() => handleDamageCompleted(dmg.id)}>Mark Completed</button>
                : <button className="btn btn-warning" onClick={() => handleDamageHandover(dmg.id)}>Create Handover</button>
              }
              <button className="btn btn-outline" onClick={() => setActiveDamage(null)}>Cancel</button>
            </div>
          ) : (
            <div className="damage-actions">
              <button className="btn btn-primary" onClick={() => { setActiveDamage(dmg.id); setDamageAction('completed') }}>Mark Completed</button>
              <button className="btn btn-warning" onClick={() => { setActiveDamage(dmg.id); setDamageAction('handover') }}>Handover</button>
            </div>
          )}
        </div>
      ))}

      {completedTasks.length > 0 && <h2>Completed ({completedTasks.length})</h2>}
      {completedTasks.map(task => (
        <div key={task.id} className="task-card card completed">
          <span className="badge badge-completed">Done</span>
          <p>{task.description}</p>
          {task.completed_by && <small>By: {task.completed_by}</small>}
        </div>
      ))}

      <button className="btn btn-outline" onClick={() => navigate('/control')}>Back to Control</button>
    </div>
  )
}
