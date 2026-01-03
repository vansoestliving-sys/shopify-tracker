/**
 * Script to create an admin user
 * Run with: npx tsx scripts/create-admin.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdmin() {
  const email = 'vasoestliving@gmail.com'
  const password = 'vinnie614'
  const name = 'Admin User'

  console.log('Creating admin user...')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)

  try {
    // Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name,
        role: 'admin',
      },
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('⚠️  User already exists in auth. Checking database...')
      } else {
        throw authError
      }
    }

    // Check if admin user already exists in database
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single()

    if (existingAdmin) {
      console.log('✅ Admin user already exists in database!')
      console.log(`   ID: ${existingAdmin.id}`)
      console.log(`   Email: ${existingAdmin.email}`)
      console.log(`   Role: ${existingAdmin.role}`)
      return
    }

    // Create admin user record in database
    const { data: adminUser, error: dbError } = await supabase
      .from('admin_users')
      .insert({
        email,
        name: name,
        role: 'admin',
      })
      .select()
      .single()

    if (dbError) {
      throw dbError
    }

    console.log('✅ Admin user created successfully!')
    console.log(`   ID: ${adminUser.id}`)
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Role: ${adminUser.role}`)
    console.log(`   Auth User ID: ${authData?.user?.id || 'N/A'}`)
    console.log('\n📝 Login credentials:')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
    console.log(`\n🔗 Login at: http://localhost:3000/login (select Admin tab)`)
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message)
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('\n💡 Make sure you have run the database migration!')
      console.error('   Go to Supabase SQL Editor and run: supabase/migrations/001_initial_schema.sql')
    }
    process.exit(1)
  }
}

createAdmin()

