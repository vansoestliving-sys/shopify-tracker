-- Track review-request WhatsApp follow-ups handed off to n8n.
-- One follow-up is allowed per order for the post-review-email reminder flow.

CREATE TABLE IF NOT EXISTS review_whatsapp_followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  followup_type VARCHAR(50) NOT NULL DEFAULT 'post_review_email',
  status VARCHAR(30) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent_to_n8n', 'failed', 'skipped')),
  review_url TEXT NOT NULL,
  last_review_email_sent_at TIMESTAMP WITH TIME ZONE,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_to_n8n_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  n8n_status INTEGER,
  n8n_response JSONB,
  n8n_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, followup_type)
);

CREATE INDEX IF NOT EXISTS idx_review_whatsapp_followups_status_schedule
  ON review_whatsapp_followups(status, scheduled_for, created_at);

CREATE INDEX IF NOT EXISTS idx_review_whatsapp_followups_order
  ON review_whatsapp_followups(order_id);

CREATE INDEX IF NOT EXISTS idx_review_whatsapp_followups_sent
  ON review_whatsapp_followups(sent_to_n8n_at)
  WHERE status = 'sent_to_n8n';

CREATE TRIGGER update_review_whatsapp_followups_updated_at
  BEFORE UPDATE ON review_whatsapp_followups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE review_whatsapp_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access review_whatsapp_followups"
  ON review_whatsapp_followups FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view review_whatsapp_followups"
  ON review_whatsapp_followups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage review_whatsapp_followups"
  ON review_whatsapp_followups FOR ALL
  TO authenticated
  USING (true);
