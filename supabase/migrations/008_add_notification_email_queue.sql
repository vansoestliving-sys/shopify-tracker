-- Queue delivery notification emails that cannot safely be sent immediately.

ALTER TABLE notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_status_check;

ALTER TABLE notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (status IN ('queued', 'sent', 'failed'));

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resend_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_notification_logs_queue
  ON notification_logs(status, scheduled_for, created_at)
  WHERE status = 'queued';

UPDATE notification_templates
SET
  body_text = 'Beste {{first_name}},

Onze excuses: de verwachte leverdatum van uw bestelling {{order_numbers}} is gewijzigd doordat de planning van container {{container_id}} is aangepast.

De nieuwe verwachte leverdatum is {{new_date}}.

We begrijpen dat dit vervelend is en houden uw bestelling nauwlettend in de gaten. Zodra er opnieuw iets wijzigt, informeren wij u zo snel mogelijk.',
  updated_at = NOW()
WHERE key = 'delivery_change_apology'
  AND body_text LIKE '%De eerder verwachte datum was {{old_date}}.%';
