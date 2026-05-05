-- Delivery change notification templates and send logs

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  updated_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  order_ids UUID[] DEFAULT '{}',
  order_numbers TEXT[] DEFAULT '{}',
  old_eta DATE,
  new_eta DATE,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('sent', 'failed')),
  resend_email_id VARCHAR(255),
  error_message TEXT,
  sent_by VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_container ON notification_logs(container_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient ON notification_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access notification_templates"
  ON notification_templates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access notification_logs"
  ON notification_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view notification_templates"
  ON notification_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage notification_templates"
  ON notification_templates FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view notification_logs"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO notification_templates (key, name, subject, body_text, is_system)
VALUES (
  'delivery_change_apology',
  'Wijziging leverdatum container',
  'Update over uw levering - bestelling {{order_numbers}}',
  'Beste {{first_name}},

Onze excuses: de verwachte leverdatum van uw bestelling {{order_numbers}} is gewijzigd doordat de planning van container {{container_id}} is aangepast.

De eerder verwachte datum was {{old_date}}. De nieuwe verwachte leverdatum is {{new_date}}.

We begrijpen dat dit vervelend is en houden uw bestelling nauwlettend in de gaten. Zodra er opnieuw iets wijzigt, informeren wij u zo snel mogelijk.',
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  body_text = EXCLUDED.body_text,
  is_system = TRUE,
  updated_at = NOW();
