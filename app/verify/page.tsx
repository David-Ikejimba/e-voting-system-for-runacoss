'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

export default function VerifyPage() {
  const [receipt, setReceipt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<'valid' | 'invalid' | null>(null)
  const [error, setError] = useState('')

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!receipt.trim() || receipt.trim().length !== 16) {
      setError('Please enter a valid 16-character receipt code.')
      return
    }
    setError('')
    setResult(null)
    setLoading(true)

    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('verify_receipt', {
      p_receipt: receipt.trim()
    })

    setLoading(false)
    if (rpcError) {
      setError('Something went wrong checking the receipt. Please try again.')
      return
    }

    if (data === true) {
      setResult('valid')
    } else {
      setResult('invalid')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 450 }}>
        <div className="auth-logo">
          <Image src="/logo.png" alt="RUN Votes Logo" width={48} height={48} />
          <span className="auth-logo-text">RUN Votes</span>
        </div>

        <h1 className="auth-title">Verify Receipt</h1>
        <p className="auth-subtitle">
          Enter your 16-character voting receipt code to confirm that your ballot is securely logged in the ledger.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleVerify} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="receipt">Receipt Code</label>
            <input
              id="receipt"
              type="text"
              className="form-input"
              placeholder="e.g. a1b2c3d4e5f6g7h8"
              value={receipt}
              onChange={e => {
                setReceipt(e.target.value)
                setResult(null)
                setError('')
              }}
              style={{ fontFamily: 'monospace', letterSpacing: '1px', fontSize: '1.1rem' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !receipt}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Verifying...' : 'Verify Vote'}
          </button>
        </form>

        {result === 'valid' && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--brand-success)', color: 'white', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✓</div>
            <div style={{ fontWeight: 700 }}>Valid Receipt!</div>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>Your vote is securely recorded in the ledger.</p>
          </div>
        )}

        {result === 'invalid' && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--brand-danger)', color: 'white', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✗</div>
            <div style={{ fontWeight: 700 }}>Receipt Not Found</div>
            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>We could not find this receipt in the system. Check the code and try again.</p>
          </div>
        )}

        <div className="auth-divider"></div>
        <p className="auth-footer">
          <Link href="/dashboard">Return to Dashboard</Link>
        </p>
      </div>
    </div>
  )
}
