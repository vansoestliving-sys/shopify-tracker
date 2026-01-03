import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseAdminClient()
    const userId = params.id

    // Get admin user to find auth user ID
    const { data: adminUser, error: fetchError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError || !adminUser) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      )
    }

    // Protect main admin account from deletion
    if (adminUser.email.toLowerCase() === 'vansoestliving@gmail.com') {
      return NextResponse.json(
        { error: 'Cannot delete the main admin account' },
        { status: 403 }
      )
    }

    // Delete auth user if exists
    // Note: We need to find the auth user by email since we don't store auth_user_id
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUser = authUsers?.users.find(u => u.email === adminUser.email)

    if (authUser) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id)
      if (deleteAuthError) {
        console.error('Error deleting auth user:', deleteAuthError)
        // Continue with database deletion even if auth deletion fails
      }
    }

    // Delete admin user from database
    const { error: deleteError } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', userId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting admin user:', error)
    return NextResponse.json(
      { error: 'Failed to delete admin user', details: error.message },
      { status: 500 }
    )
  }
}

