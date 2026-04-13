import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/review
 * Saves a customer review to the customer_reviews table.
 * Returns redirect_to_trustpilot = true if rating >= 4.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderNumber, customerName, customerEmail, rating, reviewText } = await request.json()

    // Basic validation
    if (!customerEmail || !rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'E-mailadres en een beoordeling van 1–5 zijn verplicht.' },
        { status: 400 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const redirectToTrustpilot = rating >= 4

    // Try to find the order by shopify_order_number so we can link the review
    let orderId: string | null = null
    if (orderNumber) {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('id')
        .eq('shopify_order_number', orderNumber.toString().replace(/^#+/, ''))
        .maybeSingle()
      orderId = orderRow?.id ?? null
    }

    const { error: insertError } = await supabase.from('customer_reviews').insert({
      order_id: orderId,
      shopify_order_number: orderNumber?.toString().replace(/^#+/, '') || null,
      customer_name: customerName?.trim() || null,
      customer_email: customerEmail.trim(),
      rating,
      review_text: reviewText?.trim() || null,
      redirect_to_trustpilot: redirectToTrustpilot,
    })

    if (insertError) {
      console.error('Error inserting review:', insertError)
      return NextResponse.json({ error: 'Kon uw review niet opslaan. Probeer het opnieuw.' }, { status: 500 })
    }

    console.log(`⭐ Review saved: order #${orderNumber}, rating ${rating}, trustpilot=${redirectToTrustpilot}`)

    return NextResponse.json({
      success: true,
      rating,
      redirectToTrustpilot,
      trustpilotUrl: 'https://nl.trustpilot.com/review/www.vansoestliving.nl',
    })
  } catch (error: any) {
    console.error('Review API error:', error)
    return NextResponse.json({ error: 'Er is iets misgegaan.' }, { status: 500 })
  }
}
