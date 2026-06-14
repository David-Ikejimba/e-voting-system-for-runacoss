'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Email is required'); return }
    
    setLoading(true)
    setError('')
    setMessage('')
    
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setMessage('If an account exists for this email, a password reset link has been sent.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt="RUNACOSS VOTING Logo" width={48} height={48} />
          <span className="auth-logo-text">RUNACOSS VOTING</span>
        </div>

        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">Enter your university email to receive a reset link.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert" style={{ background: 'var(--brand-success)', color: '#fff', border: '2px solid var(--border-default)', marginBottom: '1.5rem' }}>{message}</div>}

        {!message && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email">University email</label>
              <input id="email" type="email" className="form-input" placeholder="adaobi@run.edu.ng" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
        
        <p className="auth-footer" style={{ marginTop: '2rem' }}>
          Remember your password? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
