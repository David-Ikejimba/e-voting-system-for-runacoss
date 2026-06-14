'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, Suspense } from 'react'

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(
    searchParams.get('error') === 'session_expired' 
      ? 'Your session has expired. Please sign in again.' 
      : searchParams.get('error') === 'auth_failed'
      ? 'Authentication failed. Please try again.'
      : ''
  )
  const [resendSuccess, setResendSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
    setResendSuccess('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoading(true)
    setError('')
    setResendSuccess('')

    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        await supabase.auth.resend({ type: 'signup', email: form.email })
        setResendSuccess('Email not confirmed. A new confirmation link has been sent to your email. Please check your inbox.')
      } else {
        setError('Invalid email or password. Please try again.')
      }
      setLoading(false)
      return
    }

    if (authData.user) {
      const deviceId = crypto.randomUUID()
      document.cookie = `run_votes_device_id=${deviceId}; path=/; max-age=31536000`
      await supabase.from('profiles').update({ active_session_id: deviceId }).eq('id', authData.user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          hd: 'run.edu.ng',
        },
      },
    })
  }

  return (
    <div className="auth-page">
      {mounted && (
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn btn-outline btn-sm"
          style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', minHeight: '40px', width: '40px' }}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      )}
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt="RUNACOSS VOTING Logo" width={48} height={48} />
          <span className="auth-logo-text">RUNACOSS VOTING</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to access your ballot.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {resendSuccess && (
          <div className="alert" style={{ background: 'var(--brand-success)', color: '#fff', border: '2px solid var(--border-default)' }}>
            {resendSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">University email</label>
            <input id="login-email" name="email" type="email" className="form-input"
              placeholder="adaobi@run.edu.ng" value={form.email} onChange={handleChange}
              autoComplete="email" required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" className="form-input"
              placeholder="Enter your password" value={form.password} onChange={handleChange}
              autoComplete="current-password" required />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <a href="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</a>
            </div>
          </div>

          <button type="submit" id="login-submit-btn" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button type="button" id="login-google-btn" className="btn btn-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <p className="auth-footer">
          Don&apos;t have an account? <Link href="/signup">Create one</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="spinner"></div></div>}>
      <LoginInner />
    </Suspense>
  )
}
