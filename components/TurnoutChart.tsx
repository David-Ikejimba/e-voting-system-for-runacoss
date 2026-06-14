'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface TurnoutChartProps {
  data: {
    vote_hour: string
    vote_count: number
  }[]
}

export default function TurnoutChart({ data }: TurnoutChartProps) {
  // Format data for Recharts
  const formattedData = data.map(d => ({
    ...d,
    formattedHour: new Date(d.vote_hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  }))

  return (
    <div style={{ width: '100%', height: 300, marginTop: '1rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="formattedHour" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            labelStyle={{ fontWeight: 'bold', color: 'var(--text-primary)' }}
          />
          <Line 
            type="monotone" 
            dataKey="vote_count" 
            name="Votes cast"
            stroke="var(--brand-accent)" 
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--brand-accent)' }} 
            activeDot={{ r: 6 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
