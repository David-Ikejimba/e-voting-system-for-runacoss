'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ResultsChartProps {
  data: {
    candidate_name: string
    candidate_position: string
    vote_count: number
  }[]
  position: string
}

export default function ResultsChart({ data, position }: ResultsChartProps) {
  const positionData = data
    .filter(r => r.candidate_position === position)
    .sort((a, b) => b.vote_count - a.vote_count)

  const maxVotes = positionData[0]?.vote_count ?? 0

  return (
    <div style={{ width: '100%', height: 300, marginTop: '1rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={positionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis dataKey="candidate_name" type="category" width={150} tick={{ fontSize: 12 }} />
          <Tooltip 
            cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
          />
          <Bar dataKey="vote_count" radius={[0, 4, 4, 0]}>
            {positionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.vote_count === maxVotes && maxVotes > 0 ? 'var(--brand-success)' : 'var(--brand-primary)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
