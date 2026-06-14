'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { Moon, Sun, Menu, X, Home, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'

interface NavbarProps {
  profile: {
    full_name: string
    department: string
    role: string
  }
}

export default function Navbar({ profile }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const initials = profile.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  return (
    <nav className="navbar">
      <Link href="/dashboard" className="nav-logo">
        <Image src="/logo.png" alt="RUN Votes Logo" width={32} height={32} />
        <span>RUN Votes</span>
      </Link>

      <div className="nav-actions desktop-actions">
        <Link href="/verify" className="btn btn-outline btn-sm" style={{ color: 'var(--text-muted)' }}>Verify Vote</Link>
        <span className="nav-dept-badge">{profile.department}</span>
        {profile.role === 'admin' && (
          pathname === '/admin' ? (
            <Link href="/dashboard" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Home size={16} /> Home
            </Link>
          ) : (
            <Link href="/admin" className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={16} /> Admin
            </Link>
          )
        )}
        
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.4rem', minHeight: '40px', width: '40px' }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}

        <Link href="/profile" title="Profile">
          <div className="nav-avatar">{initials}</div>
        </Link>
      </div>

      <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {menuOpen && (
        <div className="mobile-menu-overlay">
          <div className="mobile-menu-content">
            <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            
            {profile.role === 'admin' && (
              <div className="mobile-menu-section">
                <div className="mobile-menu-section-title">Admin Navigation</div>
                <Link href="/admin#elections" onClick={() => setMenuOpen(false)}>Elections</Link>
                <Link href="/admin#turnout" onClick={() => setMenuOpen(false)}>Live Turnout</Link>
                <Link href="/admin#results" onClick={() => setMenuOpen(false)}>Results</Link>
                <Link href="/admin#logs" onClick={() => setMenuOpen(false)}>Audit Logs</Link>
              </div>
            )}

            <div className="mobile-menu-section" style={{ marginTop: 'auto' }}>
              <Link href="/verify" onClick={() => setMenuOpen(false)}>Verify Vote</Link>
              <Link href="/profile" onClick={() => setMenuOpen(false)}>Profile ({profile.department})</Link>
              {mounted && (
                <button onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setMenuOpen(false); }}>
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
