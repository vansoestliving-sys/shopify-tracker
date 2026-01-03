import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Update container
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET_KEY
    
    // Only require auth if ADMIN_SECRET_KEY is set AND we're in production
    if (adminSecret && process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const body = await request.json()
    const supabase = createSupabaseAdminClient()

    const { data: container, error } = await supabase
      .from('containers')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // The database trigger will automatically update all related orders' delivery_eta
    // when container.eta changes

    return NextResponse.json({ container })
  } catch (error: any) {
    console.error('Error updating container:', error)
    return NextResponse.json(
      { error: 'Failed to update container', details: error.message },
      { status: 500 }
    )
  }
}

// Delete container
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET_KEY
    
    // Only require auth if ADMIN_SECRET_KEY is set AND we're in production
    if (adminSecret && process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const supabase = createSupabaseAdminClient()

    const { error } = await supabase
      .from('containers')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting container:', error)
    return NextResponse.json(
      { error: 'Failed to delete container', details: error.message },
      { status: 500 }
    )
  }
}

