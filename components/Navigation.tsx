'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Home, Package, Settings, LogOut, Truck } from 'lucide-react'
import Logo from './Logo'

interface NavigationProps {
  user?: {
    email?: string
  } | null
  onLogout?: () => void
  isAdmin?: boolean
}

export default function Navigation({ user, onLogout, isAdmin = false }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false)
  const settingsDropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  const navItems = isAdmin
    ? [
        { href: '/admin', label: 'Dashboard', icon: Home },
        { href: '/admin/containers', label: 'Containers', icon: Truck },
        { href: '/admin/orders', label: 'Orders', icon: Package },
      ]
    : [
        { href: '/dashboard', label: 'My Orders', icon: Package },
        { href: '/track', label: 'Track Order', icon: Truck },
      ]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setSettingsDropdownOpen(false)
      }
    }

    if (settingsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [settingsDropdownOpen])

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-logo-200/30 shadow-sm sticky top-0 z-50">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 gap-2 min-w-0">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 pr-2">
            <Link href={isAdmin ? '/admin' : '/'} className="flex items-center">
              <Logo width={180} height={68} />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-2">
            {/* Navigation Items */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 h-9 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-400 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Settings Dropdown - Admin only */}
            {isAdmin && (
              <div className="relative ml-2" ref={settingsDropdownRef}>
                <button
                  onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                  className={`flex items-center justify-center w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/admin/settings'
                      ? 'bg-primary-400 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-primary-50 hover:text-primary-700'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-4 h-4 flex-shrink-0" />
                </button>

                {/* Dropdown Menu */}
                {settingsDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 glass-card rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                    <Link
                      href="/admin/settings"
                      onClick={() => setSettingsDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Admin Settings</span>
                    </Link>
                    {user && (
                      <div className="px-4 py-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Logged in as</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                      </div>
                    )}
                    {onLogout && (
                      <button
                        onClick={() => {
                          setSettingsDropdownOpen(false)
                          onLogout()
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors border-t border-gray-200"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-gray-900 p-2"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-base font-medium ${
                    isActive
                      ? 'bg-primary-400 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            {isAdmin && (
              <div className="pt-4 border-t border-gray-200">
                <Link
                  href="/admin/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </Link>
                {user && (
                  <div className="px-3 py-2 text-sm text-gray-600">{user.email}</div>
                )}
                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout()
                      setMobileMenuOpen(false)
                    }}
                    className="flex items-center space-x-2 w-full px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

