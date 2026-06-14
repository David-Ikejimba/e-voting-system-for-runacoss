'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { validateMatricAndEmail } from '@/lib/validation/matric'

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', matricNo: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [globalSuccess, setGlobalSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErrors(prev => ({ ...prev, [e.target.name]: '' }))
  }

  function validate() {
    const newErrors: Record<string, string> = {}
    if (!form.fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!form.email.trim()) newErrors.email = 'Email is required'
    if (!form.matricNo.trim()) newErrors.matricNo = 'Matric number is required'
    if (form.password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'

    if (form.email && form.matricNo) {
      const result = validateMatricAndEmail(form.email, form.matricNo)
      if (!result.valid) {
        const messages: Record<string, string> = {
          DOMAIN_MISMATCH: 'Email must be a @run.edu.ng address',
          FORMAT_MISMATCH: 'Matric must be in format RUN/CMP/XX/XXXXX',
          UNSUPPORTED_DEPARTMENT: 'Department must be CMP, CYB, or IFT',
          DIGIT_MISMATCH: 'Matric number does not match your email address',
        }
        newErrors.matricNo = messages[result.error] || 'Invalid matric number'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setGlobalError('')
    setGlobalSuccess('')

    const supabase = createClient()
    const validResult = validateMatricAndEmail(form.email, form.matricNo)
    if (!validResult.valid) { setLoading(false); return }

    const { data: authData, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          matric_no: validResult.matricNo,
          department: validResult.department,
        },
      },
    })

    if (error) {
      setGlobalError(error.message)
      setLoading(false)
      return
    }

    if (authData.user && !authData.session) {
      setGlobalSuccess('Registration successful! Please check your university email for a confirmation link. You must click it before you can sign in.')
      setLoading(false)
      return
    }

    if (authData.user && authData.session) {
      const deviceId = crypto.randomUUID()
      document.cookie = `run_votes_device_id=${deviceId}; path=/; max-age=31536000`
      await supabase.from('profiles').update({ active_session_id: deviceId }).eq('id', authData.user.id)
    }

    router.push('/dashboard')
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
          hd: 'run.edu.ng', // Restrict to university domain
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
          <Image src="/logo.png" alt="RUN Votes Logo" width={48} height={48} />
          <span className="auth-logo-text">RUN Votes</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Register with your university email and matric number.</p>

        {globalError && <div className="alert alert-error">{globalError}</div>}
        {globalSuccess && (
          <div className="alert" style={{ background: 'var(--brand-success)', color: '#fff', border: '2px solid var(--border-default)' }}>
            {globalSuccess}
          </div>
        )}

        {!globalSuccess && (
          <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" type="text" className={`form-input ${errors.fullName ? 'error' : ''}`}
              placeholder="Adaobi Nwosu" value={form.fullName} onChange={handleChange} autoComplete="name" />
            {errors.fullName && <span className="form-error">{errors.fullName}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">University email</label>
            <input id="email" name="email" type="email" className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="adaobi@run.edu.ng" value={form.email} onChange={handleChange} autoComplete="email" />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="matricNo">Matric number</label>
            <input id="matricNo" name="matricNo" type="text" className={`form-input ${errors.matricNo ? 'error' : ''}`}
              placeholder="RUN/CMP/22/00123" value={form.matricNo} onChange={handleChange} />
            <span className="form-hint">Format: RUN/CMP/22/00123</span>
            {errors.matricNo && <span className="form-error">{errors.matricNo}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="At least 8 characters" value={form.password} onChange={handleChange} autoComplete="new-password" />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
              placeholder="Repeat your password" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
            {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" id="signup-submit-btn" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        )}

        <div className="auth-divider">or</div>

        <button type="button" id="signup-google-btn" className="btn btn-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <p className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
