'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { validateMatricAndEmail } from '@/lib/validation/matric'

export default function CompleteProfilePage() {
  const router = useRouter()
  const [matricNo, setMatricNo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      setError('Could not retrieve your account. Please try again.')
      setLoading(false)
      return
    }

    // Enforce @run.edu.ng domain — app-level check since Free tier can't restrict at provider level
    if (!user.email.endsWith('@run.edu.ng')) {
      await supabase.auth.signOut()
      setError('Only @run.edu.ng Google accounts are allowed. You have been signed out.')
      setLoading(false)
      return
    }

    const result = validateMatricAndEmail(user.email, matricNo)
    if (!result.valid) {
      const messages: Record<string, string> = {
        DOMAIN_MISMATCH: 'Your Google account is not a @run.edu.ng address.',
        FORMAT_MISMATCH: 'Matric must be in format RUN/CMP/22/00123',
        UNSUPPORTED_DEPARTMENT: 'Department must be CMP, CYB, or IFT',
        DIGIT_MISMATCH: 'Matric number does not match your Google email address',
      }
      setError(messages[result.error])
      setLoading(false)
      return
    }

    const deviceId = crypto.randomUUID()

    // Insert profile row
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email.split('@')[0],
      matric_no: result.matricNo,
      department: result.department,
      role: 'student',
      active_session_id: deviceId,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    document.cookie = `run_votes_device_id=${deviceId}; path=/; max-age=31536000`
    router.push('/dashboard')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt="RUN Votes Logo" width={48} height={48} />
          <span className="auth-logo-text">RUN Votes</span>
        </div>

        <h1 className="auth-title">Complete your profile</h1>
        <p className="auth-subtitle">
          Almost there! Enter your matric number to link your Google account.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="complete-matric">Matric number</label>
            <input
              id="complete-matric"
              type="text"
              className="form-input"
              placeholder="RUN/CMP/22/00123"
              value={matricNo}
              onChange={e => { setMatricNo(e.target.value); setError('') }}
              required
            />
            <span className="form-hint">Format: RUN/CMP/22/00123</span>
          </div>

          <button type="submit" id="complete-profile-btn" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Saving…' : 'Complete registration'}
          </button>
        </form>
      </div>
    </div>
  )
}
