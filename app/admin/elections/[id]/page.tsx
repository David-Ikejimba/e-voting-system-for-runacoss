import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncElectionStatuses } from '@/lib/syncElectionStatuses'
import { verifySession } from '@/lib/verifySession'
import Navbar from '@/components/Navbar'
import ElectionDetailClient from '@/components/ElectionDetailClient'
import Link from 'next/link'

export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, department, matric_no, role, active_session_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')
  await verifySession(supabase, profile.active_session_id)

  // Auto-transition election statuses based on start/end times
  await syncElectionStatuses(supabase)

  const { data: election } = await supabase
    .from('elections')
    .select('*')
    .eq('id', id)
    .single()

  if (!election) notFound()

  const { data: candidates } = await supabase
    .from('candidates')
    .select('*')
    .eq('election_id', id)
    .order('candidate_position')

  return (
    <div className="page-wrapper">
      <Navbar profile={profile} />
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div style={{ marginBottom: '1.5rem', padding: '0 0.875rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin panel</div>
          </div>
          <Link href="/admin" className="admin-nav-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>←</span> All elections
          </Link>
        </aside>
        <div className="admin-content">
          <ElectionDetailClient
            election={election}
            initialCandidates={candidates ?? []}
          />
        </div>
      </div>
    </div>
  )
}
