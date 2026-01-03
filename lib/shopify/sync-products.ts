/**
 * Helper script to sync products from Shopify to database
 * This can be called manually or via API
 */

import { fetchShopifyProducts } from './client'
import { createSupabaseAdminClient } from '../supabase/server'

export async function syncProductsFromShopify() {
  try {
    const shopifyProducts = await fetchShopifyProducts(250)
    const supabase = createSupabaseAdminClient()

    let synced = 0
    let errors = 0

    for (const product of shopifyProducts) {
      try {
        // Check if product exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('shopify_product_id', product.id)
          .single()

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('products')
            .update({
              name: product.title,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

          if (updateError) throw updateError
        } else {
          // Create new
          const { error: insertError } = await supabase
            .from('products')
            .insert({
              shopify_product_id: product.id,
              name: product.title,
              sku: product.variants?.[0]?.sku || null,
            })

          if (insertError) throw insertError
        }

        synced++
      } catch (error: any) {
        console.error(`Error syncing product ${product.id}:`, error.message)
        errors++
      }
    }

    return { synced, errors, total: shopifyProducts.length }
  } catch (error: any) {
    console.error('Sync products error:', error)
    throw error
  }
}

