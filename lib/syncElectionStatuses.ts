import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Checks all elections and auto-transitions their status based on current time:
 * - If start_time has passed and status is 'upcoming' → set to 'active'
 * - If end_time has passed and status is 'active' → set to 'concluded'
 *
 * Call this from any server component that loads elections (admin, dashboard, ballot).
 */
export async function syncElectionStatuses(supabase: SupabaseClient) {
  const now = new Date().toISOString()

  // Activate elections whose start_time has passed
  await supabase
    .from('elections')
    .update({ status: 'active' })
    .eq('status', 'upcoming')
    .not('start_time', 'is', null)
    .lte('start_time', now)

  // Conclude elections whose end_time has passed
  await supabase
    .from('elections')
    .update({ status: 'concluded' })
    .eq('status', 'active')
    .not('end_time', 'is', null)
    .lte('end_time', now)
}
