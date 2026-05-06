import { formatDate } from '@/lib/utils'

export const DELIVERY_CHANGE_TEMPLATE_KEY = 'delivery_change_apology'

export const DELIVERY_CHANGE_TOKENS = [
  '{{first_name}}',
  '{{order_numbers}}',
  '{{container_id}}',
  '{{old_date}}',
  '{{new_date}}',
]

export const DEFAULT_DELIVERY_CHANGE_TEMPLATE = {
  key: DELIVERY_CHANGE_TEMPLATE_KEY,
  name: 'Wijziging leverdatum container',
  subject: 'Update over uw levering - bestelling {{order_numbers}}',
  body_text:
    'Beste {{first_name}},\n\nOnze excuses: de verwachte leverdatum van uw bestelling {{order_numbers}} is gewijzigd doordat de planning van container {{container_id}} is aangepast.\n\nDe nieuwe verwachte leverdatum is {{new_date}}.\n\nWe begrijpen dat dit vervelend is en houden uw bestelling nauwlettend in de gaten. Zodra er opnieuw iets wijzigt, informeren wij u zo snel mogelijk.',
}

export interface DeliveryTemplateValues {
  first_name: string
  order_numbers: string
  container_id: string
  old_date: string
  new_date: string
}

export function renderDeliveryTemplate(template: string, values: DeliveryTemplateValues) {
  return template
    .replaceAll('{{first_name}}', values.first_name || 'klant')
    .replaceAll('{{order_numbers}}', values.order_numbers)
    .replaceAll('{{container_id}}', values.container_id)
    .replaceAll('{{old_date}}', values.old_date)
    .replaceAll('{{new_date}}', values.new_date)
}

export function formatDeliveryDateForEmail(date: string | null | undefined) {
  return date ? formatDate(date) : 'nog niet bekend'
}

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || ''
}

export function isValidCustomerEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
