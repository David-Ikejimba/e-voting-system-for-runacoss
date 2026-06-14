const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const supabase = createClient(
  'https://erkycbnttndjfggfvhia.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVya3ljYm50dG5kamZnZ2Z2aGlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTc3MDcsImV4cCI6MjA5NjkzMzcwN30.whzyfCtAtMpw0j_94OHJCRjZ5FJ7PQKZFMEZsKUFcnM'
)

async function run() {
  console.log('Simulating login from Device B...')
  
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: 'device.test@run.edu.ng',
    password: 'password123'
  })
  
  if (error) {
    console.error('Error logging in:', error.message)
    return
  }

  if (authData?.user) {
    const deviceId = crypto.randomUUID()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ active_session_id: deviceId })
      .eq('id', authData.user.id)
      
    if (updateError) {
      console.error('Error updating profile:', updateError.message)
    } else {
      console.log('Success! Simulated Device B login by updating active_session_id in DB to:', deviceId)
    }
  }
}

run()
