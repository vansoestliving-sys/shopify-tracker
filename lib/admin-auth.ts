import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export async function requireAdminUser() {
  const authClient = createRouteHandlerClient({ cookies })
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser()

  if (error || !user?.email) {
    return { user: null, error: 'Unauthorized' }
  }

  const supabase = createSupabaseAdminClient()
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, email, role')
    .eq('email', user.email)
    .maybeSingle()

  if (adminError || !adminUser) {
    return { user: null, error: 'Admin access required' }
  }

  return { user: adminUser, error: null }
}
