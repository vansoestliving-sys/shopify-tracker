'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, UserPlus, Copy, Check, Trash2, Mail } from 'lucide-react'
import Navigation from '@/components/Navigation'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'
import { supabase } from '@/lib/supabase/client'

interface AdminUser {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string
  auth_user_id?: string
}

export default function AdminSettingsPage() {
  const router = useRouter()
  const toast = useToast()
  const [user, setUser] = useState<any>(null)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [newUserId, setNewUserId] = useState<string | null>(null)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)
    fetchAdminUsers()
  }

  const fetchAdminUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Failed to fetch admin users')
      
      const data = await response.json()
      setAdminUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching admin users:', error)
      toast.error('Failed to load admin users')
    } finally {
      setLoading(false)
    }
  }

  const generatePassword = () => {
    const length = 12
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    return password
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const password = generatePassword()
      setGeneratedPassword(password)

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName || null,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin user')
      }

      setNewUserId(data.user?.id || null)
      toast.success('Admin user created successfully!')
      setNewUserEmail('')
      setNewUserName('')
      setShowAddForm(false)
      fetchAdminUsers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin user')
      setGeneratedPassword(null)
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (userId: string, email: string) => {
    // Protect main admin account
    if (email.toLowerCase() === 'vansoestliving@gmail.com') {
      toast.error('Cannot delete the main admin account')
      return
    }

    if (!confirm(`Are you sure you want to delete admin user ${email}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete admin user')
      }

      toast.success('Admin user deleted successfully')
      fetchAdminUsers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete admin user')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen">
      <Navigation user={user || { email: '' }} onLogout={handleLogout} isAdmin={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <span>Admin Settings</span>
          </h1>
          <p className="text-xs text-gray-600 mt-1">Manage admin users</p>
        </div>

        {/* Add New Admin User */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <UserPlus className="w-5 h-5" />
              <span>Add Admin User</span>
            </h2>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm)
                setGeneratedPassword(null)
                setNewUserId(null)
              }}
              className="text-primary-400 hover:text-primary-500 text-sm font-medium"
            >
              {showAddForm ? 'Cancel' : 'Add New'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 text-sm"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Name (optional)
                </label>
                <input
                  id="name"
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 text-sm"
                  placeholder="John Doe"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {creating ? 'Creating...' : 'Create Admin User'}
              </button>
            </form>
          )}

          {/* Show Generated Credentials */}
          {generatedPassword && newUserId && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <p className="text-sm font-semibold text-green-800 mb-3 flex items-center space-x-2">
                <Check className="w-4 h-4" />
                <span>Admin user created! Copy credentials to send:</span>
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white p-3 rounded border border-green-200">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 mb-1">Email:</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">{newUserEmail}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(newUserEmail, 'email')}
                    className="ml-3 p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Copy email"
                  >
                    {copiedId === 'email' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-white p-3 rounded border border-green-200">
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 mb-1">Password:</p>
                    <p className="text-sm font-mono font-semibold text-gray-900">{generatedPassword}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(generatedPassword, 'password')}
                    className="ml-3 p-2 hover:bg-gray-100 rounded transition-colors"
                    title="Copy password"
                  >
                    {copiedId === 'password' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>

                <div className="flex items-center space-x-2 mt-3">
                  <button
                    onClick={() => {
                      const text = `Email: ${newUserEmail}\nPassword: ${generatedPassword}`
                      handleCopy(text, 'all')
                    }}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-primary-400 hover:bg-primary-500 text-white text-sm font-medium rounded transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All</span>
                  </button>
                  <a
                    href={`mailto:${newUserEmail}?subject=Admin Portal Access&body=Your admin portal login credentials:%0D%0A%0D%0AEmail: ${newUserEmail}%0D%0APassword: ${generatedPassword}%0D%0A%0D%0ALogin at: ${window.location.origin}/login`}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Credentials</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin Users List */}
        <div className="glass-card rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Admin Users</h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No admin users found. Add your first admin user above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {adminUsers.map((adminUser) => (
                <div
                  key={adminUser.id}
                  className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-gray-200 hover:border-primary-200 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{adminUser.email}</p>
                      {adminUser.name && (
                        <span className="text-xs text-gray-500">({adminUser.name})</span>
                      )}
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-semibold rounded">
                        {adminUser.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(adminUser.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {adminUser.email.toLowerCase() !== 'vansoestliving@gmail.com' ? (
                    <button
                      onClick={() => handleDelete(adminUser.id, adminUser.email)}
                      className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      title="Delete admin user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="ml-3 px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded" title="Main admin account cannot be deleted">
                      Protected
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  )
}

