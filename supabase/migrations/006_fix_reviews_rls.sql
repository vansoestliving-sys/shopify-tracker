-- Migration 006: Fix RLS policies to allow authenticated admins to view reviews
-- The previous migration only allowed service_role, blocking the Next.js client-side fetch.

-- Drop the old policy if you want, but adding an 'authenticated' policy is enough
CREATE POLICY "Authenticated users can read customer_reviews"
  ON customer_reviews FOR SELECT
  USING (auth.role() = 'authenticated');
