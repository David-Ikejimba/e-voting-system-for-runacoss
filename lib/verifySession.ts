import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verifies that the current browser session matches the active_session_id 
 * stored in the user's profile. If not, logs the user out and redirects.
 */
export async function verifySession(supabase: SupabaseClient, profileSessionId: string | null) {
  const cookieStore = await cookies()
  const deviceId = cookieStore.get('run_votes_device_id')?.value

  if (!deviceId || deviceId !== profileSessionId) {
    // If it doesn't match, this device is no longer the active session
    await supabase.auth.signOut()
    redirect('/login?error=session_expired')
  }
}
