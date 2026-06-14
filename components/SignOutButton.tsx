'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="btn btn-outline"
      style={{ width: '100%', borderColor: 'var(--brand-danger)', color: 'var(--brand-danger)' }}
      disabled={loading}
    >
      {loading ? <span className="spinner" style={{ width: '16px', height: '16px', borderTopColor: 'var(--brand-danger)' }} /> : 'Sign out'}
    </button>
  )
}
