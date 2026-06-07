import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLineControlState } from '@/utils/controlState.js'
import { getStatusLabel, statusBadgeClass } from '@/utils/statusLabels.js'
import { detectShift, getShiftLabel } from '@/utils/shiftDetection.js'
import { ArrowLeft } from 'lucide-react'

/**
 * ControlPage — State-Based Control Hub
 *
 * PURPOSE: Central hub showing the current sanitation state of the selected
 * line and presenting the available next actions. Reads the selected line from
 * localStorage, queries the control state machine, and renders dynamic buttons.
 *
 * HEADER: "MACY – {LineName} Line" (e.g., "MACY – Production Line")
 *          Dynamically built from localStorage selectedLine.
 *
 * HOW IT WORKS:
 * 1. Read selectedLine from localStorage on mount
 * 2. If no selectedLine → redirect to /lines
 * 3. Call getLineControlState(lineId) to determine current workflow state
 * 4. Render action buttons, status info, and warnings based on returned state
 *
 * STATE MACHINE (from controlState.js):
 *
 * | State           | Buttons Shown                          |
 * |-----------------|----------------------------------------|
 * | idle            | [Start Pre-Clean]                      |
 * | pre_done        | [Continue Post-Clean]                  |
 * | post_done       | [Area Lead Verify]                     |
 * | handover_open   | [Review Damage] [Handover Only]        |
 * | verified        | [Release Line]  (if canRelease)        |
 * | released        | "Released" status banner               |
 *
 * BUTTON NAVIGATION:
 * - Start Pre-Clean     → /pre-clean
 * - Continue Post-Clean → /post-clean
 * - Area Lead Verify    → /verify
 * - Review Damage       → /handover
 * - Handover Only       → /handover
 * - Release Line        → /release
 *
 * STATUS DISPLAY:
 * - Current state badge (colored via statusBadgeClass)
 * - Employee name from last pre-clean log (if available)
 * - Current shift from shiftDetection
 * - Last activity timestamp (from preClean / postClean / inspection / release)
 *
 * RELEASE BLOCK WARNING:
 * When state is 'verified' but canRelease is FALSE:
 * - Show warning banner: "⚠ Cannot release — open handovers/damages exist"
 * - List count of open handovers and open damages
 *
 * RULES:
 * - NEVER render blank — always show spinner, error UI, or content
 * - If loading → show spinner
 * - If error → show error + retry button
 * - If no selectedLine → redirect to /lines
 * - All buttons are large (min-height 56px)
 * - Clear visual separation between sections
 */
export default function ControlPage() {
  const navigate = useNavigate()
  const [line, setLine] = useState(null)
  const [controlState, setControlState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shift, setShift] = useState(null)

  /**
   * Fetch the control state for the currently selected line.
   * Called on mount and when retry is triggered.
   */
  const fetchControlState = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Load selected line from localStorage
      const stored = localStorage.getItem('selectedLine')
      if (!stored) {
        // No line selected — redirect to line selection
        navigate('/lines')
        return
      }

      const parsedLine = JSON.parse(stored)
      setLine(parsedLine)

      // Detect current shift for display
      setShift(detectShift())

      // Fetch control state from state machine (queries all relevant tables)
      const state = await getLineControlState(parsedLine.id)
      setControlState(state)
    } catch (err) {
      console.error('Failed to load control state:', err)
      setError(err.message || 'Failed to load control state')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  // Load control state on mount
  useEffect(() => {
    fetchControlState()
  }, [fetchControlState])

  // ── Loading state ──
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading control state...</p>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="page control-page">
        <div className="toast toast-error">{error}</div>
        <button
          className="btn btn-primary btn-full"
          onClick={fetchControlState}
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Derive display values ──

  // Header line name: "MACY – {LineName} Line"
  // Strip "MACY " prefix and append " Line"
  const lineDisplayName = line?.name
    ? `MACY – ${line.name.replace('MACY ', '')} Line`
    : 'MACY – Line'

  // Current state from state machine (idle | pre_done | post_done | handover_open | verified | released)
  const currentState = controlState?.state || 'idle'

  // Employee name from the most recent pre-clean log (if any)
  const employeeName = controlState?.preClean?.employee_name || null

  // Last activity timestamp — use the most recent of pre/post/inspection/release
  const lastActivity = (() => {
    const timestamps = []
    if (controlState?.preClean?.completed_at) {
      timestamps.push(new Date(controlState.preClean.completed_at))
    }
    if (controlState?.postClean?.completed_at) {
      timestamps.push(new Date(controlState.postClean.completed_at))
    }
    if (controlState?.inspection?.completed_at) {
      timestamps.push(new Date(controlState.inspection.completed_at))
    }
    if (controlState?.release?.created_at) {
      timestamps.push(new Date(controlState.release.created_at))
    }
    if (timestamps.length === 0) return null
    // Sort descending, pick most recent
    timestamps.sort((a, b) => b - a)
    return timestamps[0]
  })()

  // Format timestamp for display: "2:45 PM" or "Yesterday 2:45 PM" etc.
  const formatTimestamp = (date) => {
    if (!date) return null
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Today at ${timeStr}`
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${timeStr}`
  }

  // ── Render button for each action key returned by the state machine ──
  const renderButton = (btnKey) => {
    const isHandoverOpen = currentState === 'handover_open'

    switch (btnKey) {
      case 'pre_clean':
        return (
          <button
            key={btnKey}
            className="control-btn btn-pre-clean"
            onClick={() => navigate('/pre-clean')}
            style={{ minHeight: 56 }}
          >
            Start Pre-Clean
          </button>
        )

      case 'post_clean':
        return (
          <button
            key={btnKey}
            className="control-btn btn-post-clean"
            onClick={() => navigate('/post-clean')}
            style={{ minHeight: 56 }}
          >
            Continue Post-Clean
          </button>
        )

      case 'verify':
        return (
          <button
            key={btnKey}
            className="control-btn btn-verify"
            onClick={() => navigate('/verify')}
            style={{ minHeight: 56 }}
          >
            Area Lead Verify
          </button>
        )

      case 'handover':
        // In handover_open state, show "Handover Only" label
        // In other states, show "Handover Tasks (count)"
        return (
          <button
            key={btnKey}
            className="control-btn btn-handover"
            onClick={() => navigate('/handover')}
            style={{ minHeight: 56 }}
          >
            {isHandoverOpen
              ? 'Handover Only'
              : `Handover Tasks (${controlState?.openHandovers?.length || 0})`
            }
          </button>
        )

      case 'damage':
        // In handover_open state, show "Review Damage" label
        // In other states, show "Damage Reports (count)"
        return (
          <button
            key={btnKey}
            className="control-btn btn-damage"
            onClick={() => navigate('/handover')}
            style={{ minHeight: 56 }}
          >
            {isHandoverOpen
              ? 'Review Damage'
              : `Damage Reports (${controlState?.openDamages?.length || 0})`
            }
          </button>
        )

      case 'release':
        return (
          <button
            key={btnKey}
            className="control-btn btn-release"
            onClick={() => navigate('/release')}
            style={{ minHeight: 72 }}
          >
            Release Line
          </button>
        )

      default:
        return null
    }
  }

  return (
    <div className="page control-page">
      {/* ── Back button ── */}
      <button
        className="btn btn-gray mb-2"
        onClick={() => navigate('/lines')}
        style={{ minHeight: 44 }}
      >
        <ArrowLeft size={18} />
        Back to Lines
      </button>

      {/* ── Header: "MACY – {LineName} Line" ── */}
      <div className="control-header">
        <h1>{lineDisplayName}</h1>

        {/* Status badge colored by current state */}
        <div className={`control-status status-badge ${statusBadgeClass(currentState)}`}>
          {getStatusLabel(currentState)}
        </div>
      </div>

      {/* ── Info card: shift, employee, last activity ── */}
      <div className="card mb-2">
        {/* Shift info */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-gray-500">Shift</span>
          <span className="text-sm font-medium">{getShiftLabel(shift)}</span>
        </div>

        {/* Employee name from last pre-clean log */}
        {employeeName && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-gray-500">Last Employee</span>
            <span className="text-sm font-medium">{employeeName}</span>
          </div>
        )}

        {/* Last activity timestamp */}
        {lastActivity && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-500">Last Activity</span>
            <span className="text-sm font-medium">{formatTimestamp(lastActivity)}</span>
          </div>
        )}

        {/* Show "No activity yet" when there's no last activity and not released */}
        {!lastActivity && currentState !== 'released' && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-500">Last Activity</span>
            <span className="text-sm text-gray-400">No activity yet</span>
          </div>
        )}
      </div>

      {/* ── Released state: show status banner only, no buttons ── */}
      {currentState === 'released' && (
        <div className="release-gate release-gate-open mb-2">
          <div className="release-gate-title">✅ Line Released</div>
          <div className="release-gate-text">
            This line has been released and is ready for production.
          </div>
        </div>
      )}

      {/* ── Action buttons based on state machine ── */}
      {controlState?.buttons?.length > 0 && (
        <div className="control-buttons">
          {controlState.buttons.map(btn => renderButton(btn))}
        </div>
      )}

      {/* ── Release block warning ──
           When state is 'verified' but canRelease is FALSE,
           show a prominent warning about open handovers/damages. ── */}
      {currentState === 'verified' && !controlState?.canRelease && (
        <div className="release-gate mt-2">
          <div className="release-gate-title">
            ⚠ Cannot release — open handovers/damages exist
          </div>
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

      {/* ── Open handovers/damages count (shown in non-verified, non-released states) ── */}
      {(controlState?.openHandovers?.length > 0 || controlState?.openDamages?.length > 0) &&
        currentState !== 'verified' && currentState !== 'released' && (
        <div className="release-gate mt-2">
          <div className="release-gate-title">⚠ Open Items</div>
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
    </div>
  )
}
