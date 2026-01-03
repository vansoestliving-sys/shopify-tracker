import { NextRequest, NextResponse } from 'next/server'
import { syncProductsFromShopify } from '@/lib/shopify/sync-products'

export async function POST(request: NextRequest) {
  try {
    // Check if Shopify is configured
    if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ACCESS_TOKEN) {
      return NextResponse.json(
        { 
          error: 'Shopify not configured',
          message: 'Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN in .env.local'
        },
        { status: 503 }
      )
    }

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

    const result = await syncProductsFromShopify()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Sync products error:', error)
    return NextResponse.json(
      { error: 'Failed to sync products', details: error.message },
      { status: 500 }
    )
  }
}

