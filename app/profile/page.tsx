import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, department, matric_no, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/complete-profile')

  const initials = profile.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  return (
    <div className="page-wrapper">
      <Navbar profile={profile} />
      <main>
        <div className="profile-page">
          <div className="profile-header">
            <div className="profile-avatar">{initials}</div>
            <div>
              <h1 style={{ marginBottom: '0.25rem' }}>{profile.full_name}</h1>
              <p style={{ margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', fontSize: '0.9rem', fontWeight: 700 }}>
                {profile.role === 'admin' ? 'Admin' : 'Student'}
              </p>
            </div>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Email address</span>
            <span className="profile-field-value">{user.email}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Matric number</span>
            <span className="profile-field-value" style={{ fontFamily: 'monospace' }}>{profile.matric_no}</span>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Department</span>
            <span className="profile-field-value">{profile.department}</span>
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link href="/dashboard" className="btn btn-outline" style={{ width: '100%' }}>← Back to dashboard</Link>
            <SignOutButton />
          </div>
        </div>
      </main>
    </div>
  )
}
