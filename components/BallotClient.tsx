'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Candidate {
  id: string
  name: string
  candidate_position: string
  manifesto: string | null
  photo_url: string | null
}

interface Election {
  id: string
  title: string
  status: string
}

interface BallotClientProps {
  election: Election
  candidatesByPosition: Record<string, Candidate[]>
}

export default function BallotClient({ election, candidatesByPosition }: BallotClientProps) {
  const router = useRouter()
  const positions = Object.keys(candidatesByPosition)

  const [selections, setSelections] = useState<Record<string, string>>({}) // candidate_position → candidate_id
  const [expandedManifesto, setExpandedManifesto] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState('')

  // ── Session Resiliency: Prevent accidental refresh ──
  useEffect(() => {
    const hasSelections = Object.keys(selections).length > 0
    if (!hasSelections || receipt) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Standard way to trigger browser warning
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selections, receipt])

  const allSelected = positions.every(p => selections[p])

  function selectCandidate(candidate_position: string, candidateId: string) {
    setSelections(prev => ({ ...prev, [candidate_position]: candidateId }))
  }

  function toggleManifesto(id: string) {
    setExpandedManifesto(prev => prev === id ? null : id)
  }

  async function castVote() {
    setLoading(true)
    setError('')

    const supabase = createClient()
    const payload = Object.entries(selections).map(([candidate_position, candidate_id]) => ({
      candidate_position,
      candidate_id,
    }))

    const { data, error: rpcError } = await supabase.rpc('cast_vote', {
      p_election_id: election.id,
      p_selections: payload,
    })

    if (rpcError) {
      setError(rpcError.message || 'Something went wrong. Please try again.')
      setLoading(false)
      setShowConfirm(false)
      return
    }

    setReceipt(data as string)
    setShowConfirm(false)
    setLoading(false)
  }

  if (receipt) {
    return (
      <div className="receipt-page">
        <div className="receipt-icon">✓</div>
        <h1>Vote cast!</h1>
        <p>Your vote has been recorded anonymously. Save your receipt code — it proves you voted but cannot reveal how.</p>
        <div className="receipt-code">{receipt}</div>
        <button
          id="back-to-dashboard-btn"
          className="btn btn-primary"
          style={{ maxWidth: 320, margin: '0 auto' }}
          onClick={() => router.push('/dashboard')}
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="ballot-page">
      <div className="page-header" style={{ marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>{election.title}</h1>
        <p>Select one candidate per position, then review and confirm your ballot.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {positions.map(position => (
        <div key={position} className="ballot-position">
          <div className="ballot-position-title">{position}</div>
          <div className="candidate-list">
            {(candidatesByPosition[position] ?? []).map(candidate => (
              <div key={candidate.id}>
                <input
                  type="radio"
                  id={`candidate-${candidate.id}`}
                  name={`position-${candidate.candidate_position}`}
                  className="candidate-radio"
                  value={candidate.id}
                  checked={selections[candidate.candidate_position] === candidate.id}
                  onChange={() => {}}
                  onClick={() => {
                    if (selections[candidate.candidate_position] === candidate.id) {
                      const newSelections = { ...selections }
                      delete newSelections[candidate.candidate_position]
                      setSelections(newSelections)
                    } else {
                      selectCandidate(candidate.candidate_position, candidate.id)
                    }
                  }}
                />
                <label htmlFor={`candidate-${candidate.id}`} className="candidate-label">
                  {candidate.photo_url ? (
                    <Image
                      src={candidate.photo_url}
                      alt={candidate.name}
                      width={52}
                      height={52}
                      className="candidate-photo"
                    />
                  ) : (
                    <div className="candidate-photo-placeholder">
                      {candidate.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="candidate-info">
                    <div className="candidate-name">{candidate.name}</div>
                    <div className="candidate-position-label">{candidate.candidate_position}</div>
                    {candidate.manifesto && (
                      <button
                        type="button"
                        className="candidate-manifesto-btn"
                        onClick={e => { e.preventDefault(); toggleManifesto(candidate.id) }}
                      >
                        {expandedManifesto === candidate.id ? 'Hide manifesto ▲' : 'View manifesto ▼'}
                      </button>
                    )}
                    {expandedManifesto === candidate.id && candidate.manifesto && (
                      <div className="candidate-manifesto">{candidate.manifesto}</div>
                    )}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="ballot-actions">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {Object.keys(selections).length} of {positions.length} positions selected
          </span>
          <button
            id="review-ballot-btn"
            type="button"
            className="btn btn-primary"
            style={{ width: 'auto', minWidth: 180 }}
            disabled={!allSelected}
            onClick={() => setShowConfirm(true)}
          >
            Review ballot →
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => !loading && setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Confirm your ballot</h2>
            <p className="modal-subtitle">Review your selections below. This action cannot be undone.</p>

            <div className="modal-selections">
              {Object.entries(selections).map(([candidate_position, candidateId]) => {
                const candidate = (candidatesByPosition[candidate_position] ?? []).find(c => c.id === candidateId)
                return (
                  <div key={candidate_position} className="modal-selection-item">
                    <div>
                      <div className="modal-selection-position">{candidate_position}</div>
                      <div className="modal-selection-name">{candidate?.name ?? 'Unknown'}</div>
                    </div>
                    <span style={{ fontSize: '1.2rem' }}>✓</span>
                  </div>
                )
              })}
            </div>

            <div className="modal-actions">
              <button
                id="cancel-vote-btn"
                type="button"
                className="btn btn-outline"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
              >
                Go back
              </button>
              <button
                id="confirm-vote-btn"
                type="button"
                className="btn btn-primary"
                onClick={castVote}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Submitting…' : 'Submit ballot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
