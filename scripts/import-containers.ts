/**
 * Script to import containers from Excel/CSV file
 * 
 * Usage:
 * 1. Convert Excel to CSV
 * 2. Update the CSV_PATH below
 * 3. Run: npx ts-node scripts/import-containers.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Update this path to your CSV file
const CSV_PATH = path.join(__dirname, '../containers.csv')

interface ContainerRow {
  container_id: string
  eta: string // Format: YYYY-MM-DD
  status?: string
}

function parseCSV(content: string): ContainerRow[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const row: any = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index]
    })
    
    return {
      container_id: row.container_id || row['container id'] || row.id,
      eta: row.eta || row['eta'] || row['arrival date'] || row['delivery date'],
      status: row.status || 'in_transit',
    } as ContainerRow
  }).filter(row => row.container_id && row.eta)
}

async function importContainers() {
  try {
    console.log('Reading CSV file...')
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
    const containers = parseCSV(csvContent)
    
    console.log(`Found ${containers.length} containers to import`)
    
    let imported = 0
    let errors = 0
    
    for (const container of containers) {
      try {
        // Check if container already exists
        const { data: existing } = await supabase
          .from('containers')
          .select('id')
          .eq('container_id', container.container_id)
          .single()
        
        if (existing) {
          console.log(`Container ${container.container_id} already exists, skipping...`)
          continue
        }
        
        // Insert container
        const { error } = await supabase
          .from('containers')
          .insert({
            container_id: container.container_id,
            eta: container.eta,
            status: container.status || 'in_transit',
          })
        
        if (error) {
          console.error(`Error importing ${container.container_id}:`, error.message)
          errors++
        } else {
          console.log(`✓ Imported ${container.container_id}`)
          imported++
        }
      } catch (error: any) {
        console.error(`Error processing ${container.container_id}:`, error.message)
        errors++
      }
    }
    
    console.log(`\nImport complete!`)
    console.log(`Imported: ${imported}`)
    console.log(`Errors: ${errors}`)
  } catch (error: any) {
    console.error('Import failed:', error.message)
    process.exit(1)
  }
}

// Run import
importContainers()

