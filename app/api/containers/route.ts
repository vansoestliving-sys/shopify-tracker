import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// GET all containers
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { 
          error: 'Supabase not configured',
          message: 'Please set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local',
          containers: []
        },
        { status: 503 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Test database connection first
    const { error: testError } = await supabase.from('containers').select('id').limit(1)
    
    if (testError) {
      if (testError.message?.includes('relation') || testError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Database tables not found',
            message: 'Please run the database migration in Supabase. Go to SQL Editor and run: supabase/migrations/001_initial_schema.sql',
            containers: []
          },
          { status: 503 }
        )
      }
      throw testError
    }

    const { data: containers, error } = await supabase
      .from('containers')
      .select('*')
      .order('eta', { ascending: true })

    if (error) throw error

    return NextResponse.json({ containers: containers || [] })
  } catch (error: any) {
    console.error('Error fetching containers:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch containers',
        details: error.message,
        message: error.message?.includes('relation') ? 'Database tables not created. Run the migration in Supabase.' : 'Check your Supabase configuration.',
        containers: []
      },
      { status: 500 }
    )
  }
}

// POST create new container
export async function POST(request: NextRequest) {
  try {
    // Only require auth in production
    const authHeader = request.headers.get('authorization')
    const adminSecret = process.env.ADMIN_SECRET_KEY
    
    if (adminSecret && process.env.NODE_ENV === 'production') {
      if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const body = await request.json()
    const { container_id, eta, status } = body

    if (!container_id || !eta) {
      return NextResponse.json(
        { error: 'container_id and eta are required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    const { data: container, error } = await supabase
      .from('containers')
      .insert({
        container_id,
        eta,
        status: status || 'in_transit',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ container })
  } catch (error: any) {
    console.error('Error creating container:', error)
    return NextResponse.json(
      { error: 'Failed to create container', details: error.message },
      { status: 500 }
    )
  }
}

