'use client'

import { useState } from 'react'

interface LogoProps {
  className?: string
  width?: number
  height?: number
}

export default function Logo({ className = '', width = 150, height = 50 }: LogoProps) {
  const [logoError, setLogoError] = useState(false)

  // Try to load logo in order: SVG -> PNG -> JPG
  const logoPaths = [
    '/assets/images/logo.svg',
    '/assets/logo.svg',
    '/assets/images/logo.png',
    '/assets/images/logo.jpg',
  ]

  const [currentLogo, setCurrentLogo] = useState(logoPaths[0])

  const handleError = () => {
    const currentIndex = logoPaths.indexOf(currentLogo)
    if (currentIndex < logoPaths.length - 1) {
      // Try next format
      setCurrentLogo(logoPaths[currentIndex + 1])
    } else {
      // All formats failed, show text fallback
      setLogoError(true)
    }
  }

  if (logoError) {
    // Fallback to text logo
    return (
      <div className={`font-bold text-gray-900 ${className}`}>
        <span className="text-primary-400">Van Soest</span> Living
      </div>
    )
  }

  return (
    <img
      src={currentLogo}
      alt="Van Soest Living"
      onError={handleError}
      width={width}
      height={height}
      className={`logo-image ${className}`}
      style={{ 
        '--logo-width': `${width}px`,
        '--logo-height': `${height}px`
      } as React.CSSProperties}
    />
  )
}

