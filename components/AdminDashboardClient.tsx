'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ResultsChart from './ResultsChart'
import TurnoutChart from './TurnoutChart'

interface Election {
  id: string
  title: string
  eligible_departments: string[]
  status: 'upcoming' | 'active' | 'paused' | 'concluded'
  start_time: string | null
  end_time: string | null
}

interface TurnoutRow {
  election_id: string
  department: string
  vote_count: number
}

interface AdminLog {
  id: string
  admin_id: string
  action_type: string
  target_table: string
  description: string
  created_at: string
  admin_name?: string
}

type AdminTab = 'elections' | 'turnout' | 'results' | 'logs'

const DEPARTMENTS = ['CMP', 'CYB', 'IFT']
const STATUSES = ['upcoming', 'active', 'paused', 'concluded'] as const

export default function AdminDashboardClient({
  elections: initialElections,
  turnout: initialTurnout,
  adminLogs: initialAdminLogs,
}: {
  elections: Election[]
  turnout: TurnoutRow[]
  adminLogs?: AdminLog[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<AdminTab>('elections')
  const [elections, setElections] = useState(initialElections)
  const [turnout] = useState(initialTurnout)
  const [adminLogs] = useState(initialAdminLogs || [])

  // Election form
  const [electionForm, setElectionForm] = useState({ title: '', eligible_departments: [] as string[], start_time: '', end_time: '' })
  const [electionError, setElectionError] = useState('')
  const [electionLoading, setElectionLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Results
  const [results, setResults] = useState<{ candidate_name: string; candidate_position: string; vote_count: number }[] | null>(null)
  const [resultsElectionId, setResultsElectionId] = useState('')
  const [resultsLoading, setResultsLoading] = useState(false)

  // Turnout Time Series State
  const [turnoutSeries, setTurnoutSeries] = useState<{ vote_hour: string, vote_count: number }[] | null>(null)
  const [turnoutSeriesLoading, setTurnoutSeriesLoading] = useState(false)
  const [activeTurnoutElectionId, setActiveTurnoutElectionId] = useState<string | null>(null)

  const supabase = createClient()

  // Handle Hash Navigation
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace('#', '')
      if (['elections', 'turnout', 'results', 'logs'].includes(hash)) {
        setTab(hash as AdminTab)
      }
    }
    handleHashChange() // Init
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // ── Elections ──────────────────────────────────────────────────
  async function createElection() {
    if (!electionForm.title || electionForm.eligible_departments.length === 0) {
      setElectionError('Title and at least one department are required.')
      return
    }
    setElectionLoading(true)
    const startIso = electionForm.start_time ? new Date(electionForm.start_time).toISOString() : null
    const endIso = electionForm.end_time ? new Date(electionForm.end_time).toISOString() : null

    const { data, error } = await supabase.from('elections').insert({
      title: electionForm.title,
      eligible_departments: electionForm.eligible_departments,
      start_time: startIso,
      end_time: endIso,
      status: 'upcoming',
    }).select().single()
    setElectionLoading(false)
    if (error) { setElectionError(error.message); return }
    setElections(prev => [data, ...prev])
    setElectionForm({ title: '', eligible_departments: [], start_time: '', end_time: '' })
    setElectionError('')
    setShowCreateForm(false)
    // Navigate to the new election's detail page
    router.push(`/admin/elections/${data.id}`)
  }

  // ── Results ────────────────────────────────────────────────────
  async function loadResults() {
    if (!resultsElectionId) return
    setResultsLoading(true)
    const { data, error } = await supabase.rpc('get_results', { p_election_id: resultsElectionId })
    setResultsLoading(false)
    if (error) { alert(error.message); return }
    setResults(data as { candidate_name: string; candidate_position: string; vote_count: number }[])
  }

  function exportCSV() {
    if (!results) return
    const header = 'Position,Candidate,Votes\n'
    const rows = results.map(r => `${r.candidate_position},${r.candidate_name},${r.vote_count}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Turnout ────────────────────────────────────────────────────
  async function loadTurnoutSeries(electionId: string) {
    if (activeTurnoutElectionId === electionId) {
      setActiveTurnoutElectionId(null)
      setTurnoutSeries(null)
      return
    }
    setTurnoutSeriesLoading(true)
    setActiveTurnoutElectionId(electionId)
    const { data, error } = await supabase.rpc('get_turnout_time_series', { p_election_id: electionId })
    setTurnoutSeriesLoading(false)
    if (!error) setTurnoutSeries(data)
  }

  const navItems: { key: AdminTab; label: string; icon: string }[] = [
    { key: 'elections', label: 'Elections', icon: '📋' },
    { key: 'turnout', label: 'Turnout', icon: '📊' },
    { key: 'results', label: 'Results', icon: '🏆' },
    { key: 'logs', label: 'Audit Logs', icon: '🛡️' },
  ]

  const concludedElections = elections.filter(e => e.status === 'concluded')

  function getStatusBadgeClass(status: string) {
    if (status === 'active') return 'badge-active'
    if (status === 'upcoming') return 'badge-upcoming'
    return 'badge-concluded'
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div style={{ marginBottom: '1.5rem', padding: '0 0.875rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin panel</div>
        </div>
        {navItems.map(item => (
          <button
            key={item.key}
            id={`admin-tab-${item.key}`}
            className={`admin-nav-item ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </aside>

      {/* Content */}
      <div className="admin-content">

        {/* ── ELECTIONS TAB ── */}
        {tab === 'elections' && (
          <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1>Elections</h1>
                <p>Create and manage elections.</p>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: 'auto' }}
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                {showCreateForm ? '✕ Cancel' : '+ New election'}
              </button>
            </div>

            {/* Create form (collapsible) */}
            {showCreateForm && (
              <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Create new election</h3>
                {electionError && <div className="alert alert-error">{electionError}</div>}
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" placeholder="e.g. SUG Presidential Election 2026"
                    value={electionForm.title} onChange={e => setElectionForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Eligible departments</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    {DEPARTMENTS.map(d => (
                      <label key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input type="checkbox" value={d}
                          checked={electionForm.eligible_departments.includes(d)}
                          onChange={e => setElectionForm(p => ({
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
                    <label className="form-label">Start time (optional)</label>
                    <input type="datetime-local" className="form-input"
                      value={electionForm.start_time} onChange={e => setElectionForm(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End time (optional)</label>
                    <input type="datetime-local" className="form-input"
                      value={electionForm.end_time} onChange={e => setElectionForm(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
                <button id="create-election-btn" className="btn btn-primary" style={{ width: 'auto' }}
                  onClick={createElection} disabled={electionLoading}>
                  {electionLoading ? <span className="spinner" /> : null}
                  Create election
                </button>
              </div>
            )}

            {/* Elections Grid */}
            {elections.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</p>
                <h2>No elections yet</h2>
                <p>Create your first election to get started.</p>
              </div>
            ) : (
              <div className="elections-grid">
                {elections.map(e => (
                  <Link key={e.id} href={`/admin/elections/${e.id}`} className="election-admin-card card">
                    <div className="election-card-header">
                      <div>
                        <div className="election-card-title">{e.title}</div>
                        <div className="election-card-meta">
                          {e.start_time
                            ? `Starts ${new Date(e.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                            : 'No start time set'}
                        </div>
                      </div>
                      <span className={`badge ${getStatusBadgeClass(e.status)}`}>
                        {e.status}
                      </span>
                    </div>
                    <div className="dept-tags">
                      {e.eligible_departments.map(d => (
                        <span key={d} className="dept-tag">{d}</span>
                      ))}
                    </div>
                    <div className="election-card-footer">
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Edit →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TURNOUT TAB ── */}
        {tab === 'turnout' && (
          <div>
            <div className="page-header">
              <h1>Live Turnout</h1>
              <p>Real-time vote counts per department and velocity over time.</p>
            </div>
            {elections.filter(e => e.status === 'active').map(election => {
              const rows = turnout.filter(t => t.election_id === election.id)
              const total = rows.reduce((s, r) => s + r.vote_count, 0)
              return (
                <div key={election.id} className="card" style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>{election.title}</h3>
                  {DEPARTMENTS.map(dept => {
                    const row = rows.find(r => r.department === dept)
                    const count = row?.vote_count ?? 0
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0
                    return (
                      <div key={dept} className="turnout-bar-wrap">
                        <div className="turnout-bar-label">
                          <span style={{ fontWeight: 600 }}>{dept}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{count} votes ({pct}%)</span>
                        </div>
                        <div className="turnout-bar-track">
                          <div className="turnout-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>Total votes cast: <strong style={{ color: 'var(--text-primary)' }}>{total}</strong></div>
                    <button className="btn btn-outline btn-sm" onClick={() => loadTurnoutSeries(election.id)}>
                      {activeTurnoutElectionId === election.id ? 'Hide Velocity Chart' : 'Show Velocity Chart'}
                    </button>
                  </div>
                  
                  {activeTurnoutElectionId === election.id && (
                    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
                      <h4 style={{ marginBottom: '0.5rem', color: 'var(--brand-primary)' }}>Turnout Velocity</h4>
                      {turnoutSeriesLoading ? (
                        <div className="spinner" style={{ margin: '2rem auto', display: 'block' }} />
                      ) : turnoutSeries && turnoutSeries.length > 0 ? (
                        <TurnoutChart data={turnoutSeries} />
                      ) : (
                        <p style={{ color: 'var(--text-muted)' }}>Not enough data yet.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {elections.filter(e => e.status === 'active').length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No active elections running.</p>
            )}
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === 'results' && (
          <div>
            <div className="page-header">
              <h1>Election Results</h1>
              <p>Results are only available for concluded elections.</p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Select concluded election</label>
                  <select className="form-input" value={resultsElectionId}
                    onChange={e => { setResultsElectionId(e.target.value); setResults(null) }}>
                    <option value="">Choose election…</option>
                    {concludedElections.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                </div>
                <button id="load-results-btn" className="btn btn-primary" style={{ width: 'auto' }}
                  onClick={loadResults} disabled={!resultsElectionId || resultsLoading}>
                  {resultsLoading ? <span className="spinner" /> : 'Load results'}
                </button>
              </div>
            </div>

            {results && (
              <>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button id="export-csv-btn" className="btn btn-outline btn-sm" onClick={exportCSV}>
                    ⬇ Export CSV
                  </button>
                </div>
                {Array.from(new Set(results.map(r => r.candidate_position))).map(position => (
                  <div key={position} className="card" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ marginBottom: '0.75rem', color: 'var(--brand-primary)' }}>{position}</h3>
                    {results
                      .filter(r => r.candidate_position === position)
                      .sort((a, b) => b.vote_count - a.vote_count)
                      .map((r, i) => (
                        <div key={r.candidate_name} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
                          padding: '0.75rem 1rem', background: i === 0 ? 'var(--brand-success)' : 'var(--bg-muted)',
                          marginBottom: '0.5rem', color: i === 0 ? '#fff' : 'var(--text-primary)',
                          border: '2px solid var(--border-default)',
                        }}>
                          <span style={{ fontWeight: i === 0 ? 700 : 400 }}>
                            {i === 0 ? '🏆 ' : ''}{r.candidate_name}
                          </span>
                          <span style={{ fontWeight: 700 }}>
                            {r.vote_count} votes
                          </span>
                        </div>
                      ))}
                    <ResultsChart data={results} position={position} />
                  </div>
                ))}
              </>
            )}

            {concludedElections.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No concluded elections yet.</p>
            )}
          </div>
        )}

        {/* ── AUDIT LOGS TAB ── */}
        {tab === 'logs' && (
          <div>
            <div className="page-header">
              <h1>Audit Logs</h1>
              <p>Security tracking of all administrative actions.</p>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted)', borderBottom: '2px solid var(--border-default)' }}>
                      <th style={{ padding: '1rem' }}>Timestamp</th>
                      <th style={{ padding: '1rem' }}>Admin</th>
                      <th style={{ padding: '1rem' }}>Action</th>
                      <th style={{ padding: '1rem' }}>Table</th>
                      <th style={{ padding: '1rem' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLogs?.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No audit logs found.</td>
                      </tr>
                    ) : (
                      adminLogs?.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>{log.admin_name}</td>
                          <td style={{ padding: '1rem' }}>
                            <span className={`badge ${log.action_type === 'INSERT' ? 'badge-active' : log.action_type === 'DELETE' ? 'badge-concluded' : 'badge-upcoming'}`} style={{ fontSize: '0.7rem' }}>
                              {log.action_type}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{log.target_table}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{log.description}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
