const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  console.log('Signing up...')
  const { data, error } = await supabase.auth.signUp({
    email: 'test-error@run.edu.ng',
    password: 'password123',
    options: {
      data: {
        full_name: 'Test Error',
        matric_no: 'RUN/CMP/99/00000',
        department: 'CMP'
      }
    }
  })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Success:', data)
  }
}

run()
