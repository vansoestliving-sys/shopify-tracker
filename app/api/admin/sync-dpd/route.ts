import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/admin/sync-dpd
 * Reads the ACTION sheet from the Google Sheet (gid 955736256),
 * parses Column A (Product Name) and Column E (IS_DPD),
 * then updates is_dpd on matching products in Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID
    const sheetGid = '955736256' // ACTION sheet

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEET_ID not set in environment variables.' },
        { status: 500 }
      )
    }

    // Fetch sheet as CSV (public sheet — no auth required if shared)
    // Replace with authenticated fetch if the sheet is private
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`

    const res = await fetch(csvUrl, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch Google Sheet: HTTP ${res.status}` },
        { status: 502 }
      )
    }

    const csv = await res.text()
    const rows = csv.split('\n').map(r => r.split(',').map(c => c.replace(/^"|"$/g, '').trim()))

    // Skip header row
    const dataRows = rows.slice(1).filter(r => r[0]?.trim())

    // Build DPD product name list: col A = product name, col E = IS_DPD
    const dpdNames = new Set<string>()
    const nonDpdNames = new Set<string>()

    for (const row of dataRows) {
      const name = row[0]?.trim()
      const isDpd = row[4]?.trim().toUpperCase() === 'DPD'
      if (!name) continue
      if (isDpd) dpdNames.add(name)
      else nonDpdNames.add(name)
    }

    console.log(`📋 DPD products from sheet: ${dpdNames.size}, non-DPD: ${nonDpdNames.size}`)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    let updatedDpd = 0
    let updatedNonDpd = 0

    // Mark DPD products
    if (dpdNames.size > 0) {
      const dpdArr = Array.from(dpdNames)
      const { error } = await supabase
        .from('products')
        .update({ is_dpd: true })
        .in('name', dpdArr)
      if (error) console.warn('Error marking DPD products:', error.message)
      else updatedDpd = dpdArr.length
    }

    // Mark non-DPD products
    if (nonDpdNames.size > 0) {
      const nonDpdArr = Array.from(nonDpdNames)
      const { error } = await supabase
        .from('products')
        .update({ is_dpd: false })
        .in('name', nonDpdArr)
      if (error) console.warn('Error marking non-DPD products:', error.message)
      else updatedNonDpd = nonDpdArr.length
    }

    return NextResponse.json({
      success: true,
      dpdProducts: updatedDpd,
      nonDpdProducts: updatedNonDpd,
      totalRowsFromSheet: dataRows.length,
    })
  } catch (error: any) {
    console.error('DPD sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
