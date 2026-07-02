'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Election {
  id: string
  title: string
  eligible_departments: string[]
  status: 'upcoming' | 'active' | 'paused' | 'concluded'
  start_time: string | null
  end_time: string | null
}

interface Candidate {
  id: string
  election_id: string
  candidate_position: string
  name: string
  manifesto: string | null
  photo_url: string | null
}

const DEPARTMENTS = ['CMP', 'CYB', 'IFT']
const STATUSES = ['upcoming', 'active', 'paused', 'concluded'] as const

function toLocalDatetimeString(isoString: string | null) {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ElectionDetailClient({
  election: initialElection,
  initialCandidates,
}: {
  election: Election
  initialCandidates: Candidate[]
}) {
  const router = useRouter()
  const supabase = createClient()

  // ── Election settings state ──
  const [election, setElection] = useState(initialElection)
  const [editForm, setEditForm] = useState({
    title: election.title,
    eligible_departments: [...election.eligible_departments],
    start_time: toLocalDatetimeString(election.start_time),
    end_time: toLocalDatetimeString(election.end_time),
    status: election.status,
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState('')

  // ── Candidates state ──
  const [candidates, setCandidates] = useState(initialCandidates)

  // ── Positions ──
  const existingPositions = Array.from(new Set(candidates.map(c => c.candidate_position)))
  const [newPositionName, setNewPositionName] = useState('')
  const [localPositions, setLocalPositions] = useState<string[]>([]) // positions without candidates yet
  const allPositions = [...new Set([...existingPositions, ...localPositions])]

  // ── Add candidate per position ──
  const [activeCandidateForm, setActiveCandidateForm] = useState<string | null>(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateManifesto, setCandidateManifesto] = useState('')
  const [candidatePhoto, setCandidatePhoto] = useState<File | null>(null)
  const [candidatePhotoPreview, setCandidatePhotoPreview] = useState<string | null>(null)
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [candidateError, setCandidateError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Delete election ──
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // ── Save election settings ──
  async function saveSettings() {
    if (!editForm.title || editForm.eligible_departments.length === 0) {
      setSettingsMsg('Title and at least one department are required.')
      return
    }
    setSettingsSaving(true)
    setSettingsMsg('')
    const startIso = editForm.start_time ? new Date(editForm.start_time).toISOString() : null
    const endIso = editForm.end_time ? new Date(editForm.end_time).toISOString() : null

    const { error } = await supabase.from('elections').update({
      title: editForm.title,
      eligible_departments: editForm.eligible_departments,
      start_time: startIso,
      end_time: endIso,
      status: editForm.status,
    }).eq('id', election.id)
    setSettingsSaving(false)
    if (error) { setSettingsMsg(error.message); return }
    setElection(prev => ({ ...prev, ...editForm }))
    setSettingsMsg('Saved!')
    setTimeout(() => setSettingsMsg(''), 2000)
  }

  // ── Add position ──
  function addPosition() {
    const normalized = newPositionName
      .trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    if (!normalized) return
    if (allPositions.includes(normalized)) {
      setNewPositionName('')
      return
    }
    setLocalPositions(prev => [...prev, normalized])
    setNewPositionName('')
  }

  // ── Remove empty position ──
  function removePosition(pos: string) {
    setLocalPositions(prev => prev.filter(p => p !== pos))
  }

  // ── Photo file handler ──
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setCandidatePhoto(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setCandidatePhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setCandidatePhotoPreview(null)
    }
  }

  function resetCandidateForm() {
    setCandidateName('')
    setCandidateManifesto('')
    setCandidatePhoto(null)
    setCandidatePhotoPreview(null)
    setCandidateError('')
    setActiveCandidateForm(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Add candidate ──
  async function addCandidate(position: string) {
    if (!candidateName.trim()) {
      setCandidateError('Candidate name is required.')
      return
    }
    setCandidateLoading(true)
    setCandidateError('')

    let photoUrl: string | null = null

    // Upload photo if provided
    if (candidatePhoto) {
      const ext = candidatePhoto.name.split('.').pop()
      const fileName = `${election.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('candidate-photos')
        .upload(fileName, candidatePhoto, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setCandidateError(`Photo upload failed: ${uploadError.message}`)
        setCandidateLoading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('candidate-photos')
        .getPublicUrl(fileName)
      photoUrl = urlData.publicUrl
    }

    const { data, error } = await supabase.from('candidates').insert({
      election_id: election.id,
      candidate_position: position,
      name: candidateName.trim(),
      manifesto: candidateManifesto.trim() || null,
      photo_url: photoUrl,
    }).select().single()

    setCandidateLoading(false)
    if (error) { setCandidateError(error.message); return }

    setCandidates(prev => [...prev, data])
    // Remove from localPositions if it was there (now has a real candidate)
    setLocalPositions(prev => prev.filter(p => p !== position))
    resetCandidateForm()
  }

  // ── Delete candidate ──
  async function deleteCandidate(id: string, photoUrl: string | null) {
    // Delete photo from storage if exists
    if (photoUrl) {
      const path = photoUrl.split('/candidate-photos/')[1]
      if (path) {
        await supabase.storage.from('candidate-photos').remove([path])
      }
    }
    await supabase.from('candidates').delete().eq('id', id)
    setCandidates(prev => prev.filter(c => c.id !== id))
  }

  // ── Delete election ──
  async function deleteElection() {
    await supabase.from('candidates').delete().eq('election_id', election.id)
    await supabase.from('elections').delete().eq('id', election.id)
    router.push('/admin')
    router.refresh()
  }

  function getStatusBadgeClass(status: string) {
    if (status === 'active') return 'badge-active'
    if (status === 'upcoming') return 'badge-upcoming'
    return 'badge-concluded'
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>{election.title}</h1>
          <p>Manage this election's settings, positions, and candidates.</p>
        </div>
        <span className={`badge ${getStatusBadgeClass(election.status)}`} style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>
          {election.status}
        </span>
      </div>

      {/* ── SETTINGS SECTION ── */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Election Settings</h3>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={editForm.title}
            onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Eligible departments</label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {DEPARTMENTS.map(d => (
              <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input type="checkbox" value={d}
                  checked={editForm.eligible_departments.includes(d)}
                  onChange={e => setEditForm(p => ({
                    ...p,
                    eligible_departments: e.target.checked
                      ? [...p.eligible_departments, d]
                      : p.eligible_departments.filter(x => x !== d)
                  }))} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Start time</label>
            <input type="datetime-local" className="form-input"
              value={editForm.start_time} onChange={e => setEditForm(p => ({ ...p, start_time: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">End time</label>
            <input type="datetime-local" className="form-input"
              value={editForm.end_time} onChange={e => setEditForm(p => ({ ...p, end_time: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Status</label>
          <select className="form-input" value={editForm.status} style={{ width: 'auto' }}
            onChange={e => setEditForm(p => ({ ...p, status: e.target.value as Election['status'] }))}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── POSITIONS & CANDIDATES SECTION ── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Positions &amp; Candidates</h2>
        </div>

        {/* Add position */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Add a new position</label>
              <input className="form-input" placeholder="e.g. President, Secretary"
                value={newPositionName}
                onChange={e => setNewPositionName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addPosition() }}
              />
            </div>
            <button className="btn btn-primary" style={{ width: 'auto' }}
              onClick={addPosition}>
              + Add position
            </button>
          </div>
        </div>

        {allPositions.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>No positions yet. Add a position above to start adding candidates.</p>
          </div>
        )}

        {/* Position sections */}
        {allPositions.map(position => {
          const positionCandidates = candidates.filter(c => c.candidate_position === position)
          const isEmptyPosition = localPositions.includes(position) && positionCandidates.length === 0
          const isFormOpen = activeCandidateForm === position

          return (
            <div key={position} className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="ballot-position-title" style={{ marginBottom: 0, flex: 1 }}>
                  {position}
                  <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                    {positionCandidates.length} candidate{positionCandidates.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                {isEmptyPosition && (
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--brand-danger)', borderColor: 'var(--brand-danger)' }}
                    onClick={() => removePosition(position)}>
                    Remove
                  </button>
                )}
              </div>

              {/* Candidate list */}
              {positionCandidates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {positionCandidates.map(c => (
                    <div key={c.id} className="ed-candidate-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                        {c.photo_url ? (
                          <Image src={c.photo_url} alt={c.name} width={48} height={48}
                            className="ed-candidate-photo" />
                        ) : (
                          <div className="candidate-photo-placeholder" style={{ width: 48, height: 48, fontSize: '1rem' }}>
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>{c.name}</div>
                          {c.manifesto && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{c.manifesto}</div>
                          )}
                        </div>
                      </div>
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--brand-danger)', borderColor: 'var(--brand-danger)', flexShrink: 0 }}
                        onClick={() => deleteCandidate(c.id, c.photo_url)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add candidate form (toggle) */}
              {!isFormOpen ? (
                <button className="btn btn-outline btn-sm"
                  onClick={() => { resetCandidateForm(); setActiveCandidateForm(position) }}>
                  + Add candidate
                </button>
              ) : (
                <div className="ed-add-candidate-form">
                  <h4 style={{ marginBottom: '1rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.9rem' }}>
                    New candidate for {position}
                  </h4>
                  {candidateError && <div className="alert alert-error">{candidateError}</div>}

                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" placeholder="Full name"
                      value={candidateName} onChange={e => setCandidateName(e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Manifesto (optional)</label>
                    <input className="form-input" placeholder="Brief statement or slogan"
                      value={candidateManifesto} onChange={e => setCandidateManifesto(e.target.value)} />
                  </div>


                  <div className="form-group">
                    <label className="form-label">Photo (optional)</label>
                    <div className="ed-photo-upload">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        id="candidate-photo-input"
                        style={{ display: 'none' }}
                      />
                      {candidatePhotoPreview ? (
                        <div className="ed-photo-preview">
                          <Image src={candidatePhotoPreview} alt="Preview" width={80} height={80}
                            style={{ objectFit: 'cover', border: '2px solid var(--border-default)' }} />
                          <button type="button" className="btn btn-outline btn-sm"
                            onClick={() => {
                              setCandidatePhoto(null)
                              setCandidatePhotoPreview(null)
                              if (fileInputRef.current) fileInputRef.current.value = ''
                            }}>
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label htmlFor="candidate-photo-input" className="ed-photo-dropzone">
                          <span style={{ fontSize: '1.5rem' }}>+</span>
                          <span>Upload Photo</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-primary" style={{ width: 'auto' }}
                      onClick={() => addCandidate(position)} disabled={candidateLoading}>
                      {candidateLoading ? <span className="spinner" /> : null}
                      Add candidate
                    </button>
                    <button className="btn btn-outline" style={{ width: 'auto' }}
                      onClick={resetCandidateForm} disabled={candidateLoading}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── SAVE CHANGES ── */}
      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }}
          onClick={saveSettings} disabled={settingsSaving}>
          {settingsSaving ? <span className="spinner" /> : null}
          Save all changes
        </button>
        {settingsMsg && (
          <span style={settingsMsg === 'Saved!' ? { color: 'var(--brand-success)', fontWeight: 700, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.85rem' } : { color: 'var(--brand-danger)', fontWeight: 700, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.85rem' }}>
            {settingsMsg}
          </span>
        )}
      </div>

      {/* ── DANGER ZONE ── */}
      <div className="card" style={{ borderColor: 'var(--brand-danger)' }}>
        <h3 style={{ color: 'var(--brand-danger)', marginBottom: '0.5rem' }}>Danger Zone</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Deleting an election will permanently remove all its candidates and votes. This cannot be undone.
        </p>
        {!deleteConfirm ? (
          <button className="btn btn-outline" style={{ width: 'auto', color: 'var(--brand-danger)', borderColor: 'var(--brand-danger)' }}
            onClick={() => setDeleteConfirm(true)}>
            Delete this election
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>Are you sure?</span>
            <button className="btn btn-primary" style={{ width: 'auto', background: 'var(--brand-danger)' }}
              onClick={deleteElection}>
              Yes, delete
            </button>
            <button className="btn btn-outline" style={{ width: 'auto' }}
              onClick={() => setDeleteConfirm(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
