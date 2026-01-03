/**
 * Simple script to create admin user
 * Run with: node scripts/create-admin.js
 * 
 * Make sure .env.local has:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

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

  console.log('\n🔧 Creating admin user...')
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${password}\n`)

  try {
    // Check if admin user already exists in database
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single()

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists in database!')
      console.log(`   ID: ${existingAdmin.id}`)
      console.log(`   Email: ${existingAdmin.email}`)
      console.log(`   Role: ${existingAdmin.role}`)
      console.log('\n✅ You can login with these credentials!')
      return
    }

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
        console.log('⚠️  User already exists in auth. Creating database record...')
      } else {
        throw authError
      }
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
      // If it's a duplicate, that's okay
      if (dbError.message.includes('duplicate') || dbError.message.includes('unique')) {
        console.log('⚠️  Admin user already exists in database')
        console.log('✅ You can login with these credentials!')
        return
      }
      throw dbError
    }

    console.log('✅ Admin user created successfully!')
    console.log(`   ID: ${adminUser.id}`)
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Role: ${adminUser.role}`)
    if (authData?.user) {
      console.log(`   Auth User ID: ${authData.user.id}`)
    }
    console.log('\n📝 Login credentials:')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
    console.log(`\n🔗 Login at: http://localhost:3000/login (select Admin tab)`)
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message)
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('\n💡 Make sure you have run the database migration!')
      console.error('   Go to Supabase SQL Editor and run: supabase/migrations/001_initial_schema.sql')
    }
    process.exit(1)
  }
}

createAdmin()

