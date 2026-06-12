# Vercel Environment Variables - Complete List

## ✅ Add These to Vercel (Settings → Environment Variables)

### Public Variables (Safe to Expose)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Server-Only Variables (Never Exposed to Browser)
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SHOPIFY_STORE_URL=your_store_url (e.g., i50v-e1.myshopify.com)
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret (if using webhooks)
ADMIN_SECRET_KEY=your_admin_secret (optional, for production API protection)
REVIEW_WHATSAPP_WEBHOOK_URL=your_n8n_review_whatsapp_webhook_url
REVIEW_WHATSAPP_DAILY_LIMIT=25
REVIEW_WHATSAPP_STAGGER_MINUTES=10
REVIEW_WHATSAPP_TEMPLATE_NAME=review_followup
REVIEW_WHATSAPP_TEMPLATE_LANGUAGE=nl
```

`REVIEW_WHATSAPP_WEBHOOK_URL` is required for the automated WhatsApp review follow-up. The other `REVIEW_WHATSAPP_*` variables are optional controls:

- `REVIEW_WHATSAPP_DAILY_LIMIT`: max n8n handoffs per day, defaults to `25`.
- `REVIEW_WHATSAPP_DELAY_DAYS`: days after the last review email before WhatsApp, defaults to `7`.
- `REVIEW_WHATSAPP_STAGGER_MINUTES`: spacing between scheduled WhatsApp sends, defaults to `10`.
- `REVIEW_WHATSAPP_BASE_SEND_HOUR_UTC`: first scheduled send hour in UTC, defaults to `9`.
- `REVIEW_WHATSAPP_TEMPLATE_NAME` / `REVIEW_WHATSAPP_TEMPLATE_LANGUAGE`: template metadata passed to n8n.

## ❌ DO NOT Add These

- `NEXT_PUBLIC_ADMIN_SECRET` - Remove this! It's a security risk
- Any variable with sensitive data that shouldn't be in browser

## How to Add in Vercel

1. Go to your project in Vercel
2. Settings → Environment Variables
3. Add each variable above
4. Select environment: **Production**, **Preview**, and **Development** (or just Production)
5. Click **Save**

## After Adding Variables

1. Go to **Deployments** tab
2. Click **"..."** on latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger auto-deploy

## Notes

- `NEXT_PUBLIC_` prefix = exposed to browser (only use for public data)
- No prefix = server-side only (secure)
- `ADMIN_SECRET_KEY` is optional - only needed if you want to protect API routes in production

