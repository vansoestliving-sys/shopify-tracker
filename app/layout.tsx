import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'Van Soest Living - Order Tracking',
  description: 'Track your furniture order delivery status',
  icons: {
    icon: [
      { url: '/assets/images/logo.svg', type: 'image/svg+xml' },
      { url: '/assets/images/logo.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/assets/images/logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Van Soest Living - Order Tracking',
    description: 'Track your furniture order delivery status',
    images: [
      {
        url: '/assets/images/logo.png',
        width: 1200,
        height: 630,
        alt: 'Van Soest Living',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Van Soest Living - Order Tracking',
    description: 'Track your furniture order delivery status',
    images: ['/assets/images/logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body className={`${poppins.variable} ${poppins.className}`}>{children}</body>
    </html>
  )
}

