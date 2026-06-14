import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { syncElectionStatuses } from '@/lib/syncElectionStatuses'
import { verifySession } from '@/lib/verifySession'
import AdminDashboardClient from '@/components/AdminDashboardClient'
import Navbar from '@/components/Navbar'

export default async function AdminPage() {
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

  const { data: elections } = await supabase
    .from('elections')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: turnout } = await supabase
    .from('turnout_metrics')
    .select('*')

  // Fetch admin logs and manually join with profiles to avoid PostgREST foreign key issues
  const { data: adminLogs } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  let logsWithNames = adminLogs ?? []
  if (logsWithNames.length > 0) {
    const adminIds = Array.from(new Set(logsWithNames.map(l => l.admin_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', adminIds)
    
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))
    logsWithNames = logsWithNames.map((log: any) => ({
      ...log,
      admin_name: profileMap.get(log.admin_id) || 'Unknown Admin'
    }))
  }

  return (
    <div className="page-wrapper">
      <Navbar profile={profile} />
      <AdminDashboardClient
        elections={elections ?? []}
        turnout={turnout ?? []}
        adminLogs={logsWithNames}
      />
    </div>
  )
}
