import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()

    // Fetch admin users from database
    const { data: adminUsers, error } = await supabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ users: adminUsers || [] })
  } catch (error: any) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin users', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    const body = await request.json()
    const { email, name, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name || null,
        role: 'admin',
      },
    })

    if (authError) {
      // If user already exists, return error
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      }
      throw authError
    }

    if (!authData.user) {
      throw new Error('Failed to create auth user')
    }

    // Create admin user record in database
    const { data: adminUser, error: dbError } = await supabase
      .from('admin_users')
      .insert({
        email,
        name: name || null,
        role: 'admin',
      })
      .select()
      .single()

    if (dbError) {
      // If database insert fails, try to delete the auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw dbError
    }

    return NextResponse.json({
      user: adminUser,
      auth_user_id: authData.user.id,
    })
  } catch (error: any) {
    console.error('Error creating admin user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create admin user', details: error.message },
      { status: 500 }
    )
  }
}

