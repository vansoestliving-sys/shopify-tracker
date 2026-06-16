-- Store customer help requests from the public tracking/contactmoment page.
-- This supports a later admin "Hulpverzoeken" view with simple workflow statuses.

CREATE TABLE IF NOT EXISTS tracking_help_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  shopify_order_number VARCHAR(50),
  customer_email VARCHAR(255) NOT NULL,
  customer_first_name VARCHAR(100),
  reason VARCHAR(80) NOT NULL CHECK (
    reason IN (
      'Ik begrijp mijn contactmoment niet',
      'Mijn datum lijkt te laat',
      'Ik heb een ander probleem'
    )
  ),
  message TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Nieuw'
    CHECK (status IN ('Nieuw', 'Bekeken', 'Afgehandeld')),
  source VARCHAR(50) NOT NULL DEFAULT 'tracking_page',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_help_requests_order
  ON tracking_help_requests(order_id);

CREATE INDEX IF NOT EXISTS idx_tracking_help_requests_status_created
  ON tracking_help_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_tracking_help_requests_rate_limit
  ON tracking_help_requests(order_id, lower(customer_email), created_at);

CREATE TRIGGER update_tracking_help_requests_updated_at
  BEFORE UPDATE ON tracking_help_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE tracking_help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access tracking_help_requests"
  ON tracking_help_requests FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view tracking_help_requests"
  ON tracking_help_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage tracking_help_requests"
  ON tracking_help_requests FOR ALL
  TO authenticated
  USING (true);
