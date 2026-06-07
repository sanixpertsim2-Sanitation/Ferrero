import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLines } from '@/lib/supabase.js'

/**
 * Line Select Page — "MACY'S LINES"
 * Displays all production lines fetched from Supabase as large,
 * touch-friendly buttons. Stores selected line in localStorage
 * and navigates to the control page.
 */
export default function LineSelectPage() {
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getLines()
      .then(data => {
        setLines(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load lines:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleSelect = (line) => {
    localStorage.setItem('selectedLine', JSON.stringify(line))
    navigate('/control')
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading lines...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page line-select-page">
        <div className="toast toast-error">{error}</div>
        <button className="btn btn-primary btn-full" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="page line-select-page">
      <h1 className="page-header">MACY&apos;S LINES</h1>
      <div className="line-grid">
        {lines.map(line => (
          <button
            key={line.id}
            className="line-btn"
            onClick={() => handleSelect(line)}
          >
            {line.name.replace('MACY ', '')}
          </button>
        ))}
      </div>
    </div>
  )
}
