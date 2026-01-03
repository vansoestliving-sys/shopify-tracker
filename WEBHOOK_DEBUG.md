# Webhook Debugging - Local vs Vercel

## Issue
Webhook works locally but not on Vercel deployment.

## Check Webhook URL in Shopify

1. **Go to Shopify Admin** → Settings → Notifications → Webhooks
2. **Check the webhook URL** - should be:
   ```
   https://shopify-tracker-umber.vercel.app/api/webhooks/shopify
   ```
3. **NOT localhost** - if it says `http://localhost:3000` or `127.0.0.1`, that's the problem!

## Verify Webhook is Hitting Vercel

1. **Check Vercel Logs**:
   - Go to Vercel Dashboard → Your Project → Logs
   - Filter by `/api/webhooks/shopify`
   - Look for recent webhook requests
   - If no requests, webhook is hitting wrong URL

2. **Check Shopify Webhook Deliveries**:
   - In Shopify → Settings → Notifications → Webhooks
   - Click on your webhook
   - Check "Recent deliveries" tab
   - See if requests are going to Vercel URL or localhost

## Fix

If webhook URL is wrong:
1. **Edit webhook** in Shopify
2. **Change URL** to: `https://shopify-tracker-umber.vercel.app/api/webhooks/shopify`
3. **Save**
4. **Test** by creating a new order

## Verify Environment Variables in Vercel

Make sure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SHOPIFY_STORE_URL`
- `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_WEBHOOK_SECRET` (if using secret)

## Test

1. Create a test order in Shopify
2. Check Vercel logs for webhook request
3. Check Supabase database for new order
4. Refresh admin dashboard on Vercel

