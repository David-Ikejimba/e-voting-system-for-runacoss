import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import PwaRegistry from '@/components/PwaRegistry'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport = {
  themeColor: '#7c3aed',
}

export const metadata: Metadata = {
  title: 'RUNACOSS VOTING — Redeemer\'s University Elections',
  description: 'Secure online voting platform for Redeemer\'s University of Nigeria students.',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable}`}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <PwaRegistry />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
