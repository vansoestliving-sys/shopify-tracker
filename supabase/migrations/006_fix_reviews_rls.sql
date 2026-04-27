-- Migration 006: Fix RLS policies for reviews and review emails
-- This allows authenticated admin users to view and manage these tables.

-- customer_reviews policies
DROP POLICY IF EXISTS "Authenticated users can read customer_reviews" ON customer_reviews;
DROP POLICY IF EXISTS "Authenticated users can delete customer_reviews" ON customer_reviews;

CREATE POLICY "Authenticated users can view customer_reviews"
  ON customer_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage customer_reviews"
  ON customer_reviews FOR ALL
  TO authenticated
  USING (true);

-- review_emails policies
CREATE POLICY "Authenticated users can view review_emails"
  ON review_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage review_emails"
  ON review_emails FOR ALL
  TO authenticated
  USING (true);
