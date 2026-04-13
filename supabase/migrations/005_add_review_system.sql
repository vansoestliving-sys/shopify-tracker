-- Migration 005: Add review system, delivery dates, and DPD flag

-- Add delivery_date to orders (written when customer fills in bezorgdatum)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_date_confirmed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);

-- Add is_dpd flag to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_dpd BOOLEAN DEFAULT FALSE;

-- Track which review emails have been sent (prevents duplicate sends)
CREATE TABLE IF NOT EXISTS review_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  email_type VARCHAR(50) NOT NULL CHECK (email_type IN ('initial', 'reminder')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_review_emails_order ON review_emails(order_id);

-- Internal reviews submitted via the /review form
CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  shopify_order_number VARCHAR(50),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  redirect_to_trustpilot BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_order ON customer_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_customer_reviews_rating ON customer_reviews(rating);

-- RLS for new tables
ALTER TABLE review_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access review_emails"
  ON review_emails FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access customer_reviews"
  ON customer_reviews FOR ALL
  USING (auth.role() = 'service_role');
