import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

/**
 * One-time endpoint to create test admin user
 * Call: POST /api/admin/create-test-admin
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient()
    
    const email = 'vasoestliving@gmail.com'
    const password = 'vinnie614'
    const name = 'Admin User'

    // Check if admin user already exists
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single()

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: 'Admin user already exists',
        user: existingAdmin,
        credentials: {
          email,
          password,
        },
      })
    }

    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: 'admin',
      },
    })

    if (authError && !authError.message.includes('already registered')) {
      throw authError
    }

    // Create admin user record in database
    const { data: adminUser, error: dbError } = await supabase
      .from('admin_users')
      .insert({
        email,
        name: name,
        role: 'admin',
      })
      .select()
      .single()

    if (dbError && !dbError.message.includes('duplicate') && !dbError.message.includes('unique')) {
      throw dbError
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully!',
      user: adminUser || existingAdmin,
      credentials: {
        email,
        password,
      },
      loginUrl: '/login',
    })
  } catch (error: any) {
    console.error('Error creating admin user:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create admin user', 
        details: error.message,
        message: error.message?.includes('relation') 
          ? 'Database tables not found. Run the migration first.' 
          : error.message
      },
      { status: 500 }
    )
  }
}

