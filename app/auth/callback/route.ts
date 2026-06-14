import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if this user has a profile row — if not, they need to complete profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const deviceId = crypto.randomUUID()
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        let response: NextResponse
        if (!profile) {
          // First-time Google sign-in — redirect to complete profile
          response = NextResponse.redirect(`${origin}/complete-profile`)
        } else {
          await supabase.from('profiles').update({ active_session_id: deviceId }).eq('id', user.id)
          response = NextResponse.redirect(`${origin}${next}`)
        }
        
        response.cookies.set('run_votes_device_id', deviceId, { path: '/', maxAge: 31536000 })
        return response
      }
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
