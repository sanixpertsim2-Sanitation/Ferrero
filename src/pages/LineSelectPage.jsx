import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLines } from '@/lib/supabase.js'

/**
 * LineSelectPage — "MACY'S LINES"
 *
 * PURPOSE: Display all available production lines fetched from the Supabase
 * 'areas' table as large, touch-friendly buttons. On selection, stores the
 * chosen line in localStorage and navigates to the control hub.
 *
 * HEADER: Must say exactly "MACY'S LINES" (not "Select Line" or anything else)
 *
 * BUTTONS (fetched dynamically from Supabase via getLines()):
 * - The areas table has 5 rows corresponding to MACY production areas.
 * - Button text: strip "MACY " prefix → show "Production", "Decoration",
 *   "Spiral", "Oven", "Palletizing"
 * - Each button navigates to /control on click.
 *
 * LAYOUT:
 * - 5 large buttons stacked vertically on mobile (grid-template-columns: 1fr)
 *   or 2x2+1 grid on desktop (480px+ breakpoint in CSS switches to 2 cols)
 * - Each button: min-height 72px, font-size 18px, font-weight 600
 *   (matches .line-btn CSS class)
 * - Gap between buttons: 16px (gap-4 utility overrides default 12px)
 *
 * STATE:
 * - selectedLine stored in localStorage as JSON string under key 'selectedLine'
 *
 * RULES:
 * - MUST NOT display Production by default (all 5 shown equally)
 * - MUST fetch from Supabase (not hardcoded) — displays whatever getLines() returns
 * - Show loading spinner while fetching data
 * - Show error message + retry button if fetch fails
 */
export default function LineSelectPage() {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  /**
   * Fetch lines from Supabase on mount.
   * The areas table is ordered by sequence_order via the getLines() helper.
   */
  useEffect(() => {
    getLines()
      .then(data => {
        setLines(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load lines:', err)
        setError(err.message || 'Failed to load production lines')
        setLoading(false)
      })
  }, [])

  /**
   * Handle line selection:
   * 1. Store the full line object in localStorage as 'selectedLine'
   * 2. Navigate to the control hub (/control)
   */
  const handleSelect = (line) => {
    localStorage.setItem('selectedLine', JSON.stringify(line))
    navigate('/control')
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading lines...</p>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="page line-select-page">
        <div className="toast toast-error">{error}</div>
        <button
          className="btn btn-primary btn-full"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Main content: line buttons ──
  return (
    <div className="page line-select-page">
      <h1 className="page-header">MACY&apos;S LINES</h1>
      <div className="line-grid gap-4">
        {lines.map(line => (
          <button
            key={line.id}
            className="line-btn"
            onClick={() => handleSelect(line)}
            style={{ minHeight: 72, fontSize: 18, fontWeight: 600 }}
          >
            {line.name.replace('MACY ', '')}
          </button>
        ))}
      </div>
    </div>
  )
}
