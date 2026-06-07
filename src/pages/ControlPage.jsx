import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLineControlState } from '@/utils/controlState.js'

/**
 * Control Page — Sanitation Workflow Hub
 * State-aware control center that determines which actions to show
 * based on the current state of the selected line.
 *
 * Uses the controlState.js state machine to query:
 * - pre_cleaning_logs
 * - post_cleaning_logs
 * - handover_tasks
 * - damage_reports
 * - area_inspection_logs
 * - line_release_logs
 */
export default function ControlPage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [controlState, setControlState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Load selected line from localStorage
    const stored = localStorage.getItem('selectedLine')
    if (!stored) {
      navigate('/')
      return
    }
    const parsedLine = JSON.parse(stored)
    setLine(parsedLine)

    // Fetch control state from state machine
    getLineControlState(parsedLine.id)
      .then(state => {
        setControlState(state)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load control state:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [navigate])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading control state...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page control-page">
        <div className="toast toast-error">{error}</div>
        <button className="btn btn-primary btn-full" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="page control-page">
      <div className="control-header">
        <h1>CONTROL CENTER</h1>
        <div className="line-name">{line?.name}</div>
        <div className={`control-status status-badge badge-${controlState?.state || 'idle'}`}>
          {controlState?.state === 'idle' && 'Ready to Start'}
          {controlState?.state === 'pre_done' && 'Pre-Clean Complete'}
          {controlState?.state === 'post_done' && 'Post-Clean Complete'}
          {controlState?.state === 'handover_open' && 'Handovers Open'}
          {controlState?.state === 'verified' && 'Verified'}
          {controlState?.state === 'released' && 'Released'}
        </div>
      </div>

      {/* Render action buttons based on state machine */}
      <div className="control-buttons">
        {controlState?.buttons?.map(btn => {
          if (btn === 'pre_clean') {
            return (
              <button key={btn} className="control-btn btn-pre-clean" onClick={() => navigate('/pre-clean')}>
                Start Pre-Clean
              </button>
            )
          }
          if (btn === 'post_clean') {
            return (
              <button key={btn} className="control-btn btn-post-clean" onClick={() => navigate('/post-clean')}>
                Start Post-Clean
              </button>
            )
          }
          if (btn === 'verify') {
            return (
              <button key={btn} className="control-btn btn-verify" onClick={() => navigate('/verify')}>
                Area Lead Verification
              </button>
            )
          }
          if (btn === 'handover') {
            return (
              <button key={btn} className="control-btn btn-handover" onClick={() => navigate('/handover')}>
                Handover Tasks ({controlState?.openHandovers?.length || 0})
              </button>
            )
          }
          if (btn === 'damage') {
            return (
              <button key={btn} className="control-btn btn-damage" onClick={() => navigate('/handover')}>
                Damage Reports ({controlState?.openDamages?.length || 0})
              </button>
            )
          }
          if (btn === 'release') {
            return (
              <button key={btn} className="control-btn btn-release" onClick={() => navigate('/release')}>
                Release Line
              </button>
            )
          }
          return null
        })}
      </div>

      {/* Show open handovers/damages as warning */}
      {(controlState?.openHandovers?.length > 0 || controlState?.openDamages?.length > 0) && (
        <div className="release-gate mt-2">
          <div className="release-gate-title">⚠ Release Blocked</div>
          <div className="release-gate-text">
            {controlState?.openHandovers?.length > 0 && (
              <div>{controlState.openHandovers.length} open handover(s)</div>
            )}
            {controlState?.openDamages?.length > 0 && (
              <div>{controlState.openDamages.length} open damage report(s)</div>
            )}
          </div>
        </div>
      )}

      {/* Navigation to dashboard */}
      <button className="btn btn-gray btn-full mt-2" onClick={() => navigate('/dashboard')}>
        View Dashboard
      </button>
    </div>
  )
}
