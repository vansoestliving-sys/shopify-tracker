import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

// Check if customer exists in database (from Shopify orders)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdminClient()

    // Check if customer exists in customers table
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, email, first_name, last_name')
      .eq('email', email.toLowerCase())
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error
    }

    return NextResponse.json({
      exists: !!customer,
      customer: customer || null,
    })
  } catch (error: any) {
    console.error('Error checking customer:', error)
    return NextResponse.json(
      { error: 'Failed to check customer', details: error.message },
      { status: 500 }
    )
  }
}

