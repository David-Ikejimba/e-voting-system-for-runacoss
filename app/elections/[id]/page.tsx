import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifySession } from '@/lib/verifySession'
import Navbar from '@/components/Navbar'
import BallotClient from '@/components/BallotClient'

export default async function ElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: election } = await supabase
    .from('elections')
    .select('*')
    .eq('id', id)
    .single()

  if (!election) notFound()

  // Verify the student's department is eligible
  if (!election.eligible_departments.includes(profile.department)) {
    redirect('/dashboard')
  }

  // Check if already voted
  const { data: existingVote } = await supabase
    .from('user_votes')
    .select('receipt')
    .eq('user_id', user.id)
    .eq('election_id', id)
    .single()

  if (existingVote) {
    redirect(`/dashboard`)
  }

  if (election.status !== 'active') {
    redirect('/dashboard')
  }

  const { data: candidates } = await supabase
    .from('candidates')
    .select('*')
    .eq('election_id', id)
    .order('candidate_position')

  // Group candidates by candidate_position
  type CandidateRow = NonNullable<typeof candidates>[number]
  const byPosition: Record<string, CandidateRow[]> = {}
  for (const c of candidates ?? []) {
    const key = c.candidate_position
    if (!byPosition[key]) byPosition[key] = []
    byPosition[key]!.push(c)
  }

  return (
    <div className="page-wrapper">
      <Navbar profile={profile} />
      <main className="container">
        <BallotClient
          election={election}
          candidatesByPosition={byPosition}
        />
      </main>
    </div>
  )
}
