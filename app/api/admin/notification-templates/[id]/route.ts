import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const name = body.name?.trim()
    const subject = body.subject?.trim()
    const bodyText = body.body_text?.trim()

    if (!name || !subject || !bodyText) {
      return NextResponse.json({ error: 'Name, subject, and body are required' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('notification_templates')
      .update({
        name,
        subject,
        body_text: bodyText,
        updated_by: auth.user?.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error updating notification template:', error)
    return NextResponse.json({ error: 'Failed to update template', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: template, error: fetchError } = await supabase
      .from('notification_templates')
      .select('is_system')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError
    if (template?.is_system) {
      return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 400 })
    }

    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting notification template:', error)
    return NextResponse.json({ error: 'Failed to delete template', details: error.message }, { status: 500 })
  }
}
