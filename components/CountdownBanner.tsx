'use client'

import { useState, useEffect } from 'react'

interface CountdownBannerProps {
  status: 'upcoming' | 'active'
  startTime: string | null
  endTime: string | null
}

export default function CountdownBanner({ status, startTime, endTime }: CountdownBannerProps) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    const targetDateStr = status === 'upcoming' ? startTime : endTime
    if (!targetDateStr) return

    const target = new Date(targetDateStr).getTime()

    const updateTimer = () => {
      const now = new Date().getTime()
      const distance = target - now

      if (distance < 0) {
        setTimeLeft(null)
        return false // Return false to stop interval
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      let timeStr = ''
      if (days > 0) timeStr += `${days}d `
      timeStr += `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`

      setTimeLeft(timeStr)
      return true
    }

    // Initial call
    if (!updateTimer()) return

    const interval = setInterval(() => {
      if (!updateTimer()) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [status, startTime, endTime])

  if (!timeLeft) return null

  const bgStyle = status === 'active' 
    ? { background: 'rgba(239, 68, 68, 0.1)', color: 'var(--brand-danger)', borderTop: '1px solid rgba(239, 68, 68, 0.2)' } 
    : { background: 'rgba(124, 58, 237, 0.1)', color: 'var(--brand-primary)', borderTop: '1px solid rgba(124, 58, 237, 0.2)' }
  const message = status === 'active' ? 'Closes in' : 'Opens in'

  return (
    <div style={{ ...bgStyle, padding: '0.75rem', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 -1.5rem -1.5rem -1.5rem', borderRadius: '0 0 12px 12px' }}>
      {message}: <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', marginLeft: '0.5rem', fontWeight: 700, opacity: 0.9 }}>{timeLeft}</span>
    </div>
  )
}
