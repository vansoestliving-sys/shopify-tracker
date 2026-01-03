# Webhook URL Configuration

## Correct Webhook URL

Your admin page: `https://shopify-tracker-umber.vercel.app/admin`

**Webhook URL should be:**
```
https://shopify-tracker-umber.vercel.app/api/webhooks/shopify
```

## Important Notes

- ✅ **Admin page**: `/admin` (for dashboard access)
- ✅ **Webhook endpoint**: `/api/webhooks/shopify` (for Shopify to send order data)

These are **different URLs** - the webhook endpoint is an API route, not a page.

## How to Verify in Shopify

1. Go to **Shopify Admin** → **Settings** → **Notifications** → **Notifications** → **Webhooks
2. Find your "Order creation" webhook
3. Check the **URL** field
4. It should be: `https://shopify-tracker-umber.vercel.app/api/webhooks/shopify`

## If URL is Wrong

If the webhook URL is:
- ❌ `http://localhost:3000/api/webhooks/shopify` → Change to Vercel URL
- ❌ `https://shopify-tracker-umber.vercel.app/admin` → Change to `/api/webhooks/shopify`
- ❌ Missing `/api/webhooks/shopify` → Add the full path

## Test Webhook

After updating:
1. Create a test order in Shopify
2. Check Vercel logs for: `🔔 Webhook received at:`
3. Check admin dashboard for new order

