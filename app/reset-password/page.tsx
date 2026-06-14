'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    
    setLoading(true)
    setError('')
    
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Password updated successfully. Redirecting to login...')
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt="RUN Votes Logo" width={48} height={48} />
          <span className="auth-logo-text">RUN Votes</span>
        </div>

        <h1 className="auth-title">New password</h1>
        <p className="auth-subtitle">Create a new secure password.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert" style={{ background: 'var(--brand-success)', color: '#fff', border: '2px solid var(--border-default)', marginBottom: '1.5rem' }}>{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="password">New password</label>
              <input id="password" type="password" className="form-input" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Confirm password</label>
              <input id="confirm" type="password" className="form-input" placeholder="Repeat your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
