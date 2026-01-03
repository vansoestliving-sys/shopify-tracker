# Webhook Verification Guide

## Check if Webhook is Hitting Vercel

### 1. Check Vercel Logs
- Go to Vercel Dashboard → Your Project → Logs
- Filter by `/api/webhooks/shopify`
- Look for: `🔔 Webhook received at:` (confirms webhook hit Vercel)
- Look for: `📦 Processing order:` (confirms order processing started)
- Look for: `✅ Order created successfully` (confirms order saved)

### 2. Check Shopify Webhook Deliveries
- Go to Shopify Admin → Settings → Notifications → Webhooks
- Click on your webhook
- Check "Recent deliveries" tab
- Verify:
  - **URL** should be: `https://shopify-tracker-umber.vercel.app/api/webhooks/shopify`
  - **Status** should be `200 OK`
  - **Response** should show `{"success":true}`

### 3. Verify Order in Database
- Go to Supabase Dashboard → Table Editor → `orders` table
- Check if new order exists
- Look for:
  - `shopify_order_number` matches your test order
  - `customer_email` is populated
  - `customer_first_name` may be null (add manually)

## Issue: Order Not Showing in Admin Dashboard

**Possible Causes:**
1. **Webhook hitting wrong URL** (localhost instead of Vercel)
2. **Webhook failing silently** (check Vercel logs for errors)
3. **Order created but UI cached** (click Refresh button)

**Fix:**
1. Verify webhook URL in Shopify is Vercel URL (not localhost)
2. Check Vercel logs for webhook errors
3. Click "Refresh" button in admin dashboard
4. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

## Issue: Products Not Auto-Linking

**This is Expected Behavior!**

Orders do NOT auto-link to containers. You must:
1. Sync products from Shopify (if not done)
2. Add products to containers (Containers page → Edit container)
3. Click "Link Orders" button on the container
4. Orders with matching products will be linked

**Why?** This gives you control over which orders go to which container.

