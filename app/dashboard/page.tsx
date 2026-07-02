import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncElectionStatuses } from '@/lib/syncElectionStatuses'
import { verifySession } from '@/lib/verifySession'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import CountdownBanner from '@/components/CountdownBanner'

interface Election {
  id: string
  title: string
  eligible_departments: string[]
  status: 'upcoming' | 'active' | 'paused' | 'concluded'
  start_time: string | null
  end_time: string | null
}

interface UserVote {
  election_id: string
  receipt: string
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, department, matric_no, role, active_session_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/complete-profile')
  await verifySession(supabase, profile.active_session_id)

  // Auto-transition election statuses based on start/end times
  await syncElectionStatuses(supabase)

  const { data: elections } = await supabase
    .from('elections')
    .select('*')
    .contains('eligible_departments', [profile.department])
    .in('status', ['active', 'upcoming', 'concluded'])
    .order('created_at', { ascending: false }) as { data: Election[] | null }

  const { data: userVotes } = await supabase
    .from('user_votes')
    .select('election_id, receipt')
    .eq('user_id', user.id) as { data: UserVote[] | null }

  const votedMap = new Map((userVotes ?? []).map(v => [v.election_id, v.receipt]))

  const activeElections = (elections ?? []).filter(e => e.status === 'active')
  const upcomingElections = (elections ?? []).filter(e => e.status === 'upcoming')
  const concludedElections = (elections ?? []).filter(e => e.status === 'concluded')

  return (
    <div className="page-wrapper">
      <Navbar profile={profile} />

      <main className="container dashboard-page">
        <div className="page-header">
          <h1>Hello, {profile.full_name?.split(' ')[0]} </h1>
          <p>Your elections dashboard — {profile.department} department</p>
        </div>

        {activeElections.length === 0 && upcomingElections.length === 0 && concludedElections.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}></p>
            <h2>No elections yet</h2>
            <p>There are no elections scheduled for your department right now. Check back soon.</p>
          </div>
        )}

        {activeElections.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-accent)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Active Elections
            </h2>
            <div className="elections-grid">
              {activeElections.map(e => {
                const alreadyVoted = votedMap.has(e.id)
                return (
                  <div key={e.id} className="card">
                    <div className="election-card-header">
                      <div>
                        <div className="election-card-title">{e.title}</div>
                        <div className="election-card-meta">
                          {e.end_time ? `Closes ${new Date(e.end_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'No closing time set'}
                        </div>
                      </div>
                      <span className={`badge ${alreadyVoted ? 'badge-voted' : 'badge-active'}`}>
                        {alreadyVoted ? '✓ Voted' : '● Live'}
                      </span>
                    </div>

                    <div className="dept-tags">
                      {e.eligible_departments.map(d => (
                        <span key={d} className="dept-tag">{d}</span>
                      ))}
                    </div>

                    {alreadyVoted ? (
                      <div className="receipt-box" style={{ marginBottom: '1.5rem' }}>
                        Receipt: {votedMap.get(e.id)}
                      </div>
                    ) : (
                      <div className="election-card-footer" style={{ marginBottom: '1.5rem' }}>
                        <span />
                        <Link href={`/elections/${e.id}`} id={`vote-btn-${e.id}`} className="btn btn-primary btn-sm" style={{ width: 'auto' }}>
                          Cast vote →
                        </Link>
                      </div>
                    )}
                    <CountdownBanner status={e.status} startTime={e.start_time} endTime={e.end_time} />
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {upcomingElections.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Upcoming Elections</h2>
            <div className="elections-grid">
              {upcomingElections.map(e => (
                <div key={e.id} className="card">
                  <div className="election-card-header">
                    <div>
                      <div className="election-card-title">{e.title}</div>
                      <div className="election-card-meta">
                        {e.start_time ? `Opens ${new Date(e.start_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Opening time TBC'}
                      </div>
                    </div>
                    <span className="badge badge-upcoming">⏳ Soon</span>
                  </div>
                  <div className="dept-tags" style={{ marginBottom: '1.5rem' }}>
                    {e.eligible_departments.map(d => <span key={d} className="dept-tag">{d}</span>)}
                  </div>
                  <CountdownBanner status={e.status} startTime={e.start_time} endTime={e.end_time} />
                </div>
              ))}
            </div>
          </section>
        )}

        {concludedElections.length > 0 && (
          <section>
            <h2 style={{ marginBottom: '1rem' }}>Past Elections</h2>
            <div className="elections-grid">
              {concludedElections.map(e => {
                const voted = votedMap.has(e.id)
                return (
                  <div key={e.id} className="card" style={{ opacity: 0.7 }}>
                    <div className="election-card-header">
                      <div className="election-card-title">{e.title}</div>
                      <span className="badge badge-concluded">Concluded</span>
                    </div>
                    {voted && (
                      <div className="receipt-box">Receipt: {votedMap.get(e.id)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
