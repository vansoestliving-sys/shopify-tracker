import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/admin-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { DEFAULT_DELIVERY_CHANGE_TEMPLATE } from '@/lib/delivery-notifications'

export async function GET() {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ templates: data || [] })
  } catch (error: any) {
    console.error('Error fetching notification templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates', details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
      .insert({
        key: body.key || null,
        name,
        subject,
        body_text: bodyText,
        is_system: false,
        updated_by: auth.user?.email,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error creating notification template:', error)
    return NextResponse.json({ error: 'Failed to create template', details: error.message }, { status: 500 })
  }
}

export async function PUT() {
  try {
    const auth = await requireAdminUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('notification_templates')
      .upsert(
        {
          ...DEFAULT_DELIVERY_CHANGE_TEMPLATE,
          is_system: true,
          updated_by: auth.user?.email,
        },
        { onConflict: 'key' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ template: data })
  } catch (error: any) {
    console.error('Error restoring default notification template:', error)
    return NextResponse.json({ error: 'Failed to restore default template', details: error.message }, { status: 500 })
  }
}
