import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function check() {
  console.log('Fetching profiles...')
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*')
  console.log('Profiles:', profiles, pError)
}

check()
