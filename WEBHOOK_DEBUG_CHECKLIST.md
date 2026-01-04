# Webhook Debugging Checklist

## Issue: Orders show locally but not on Vercel

### Step 1: Verify Webhook URL in Shopify
1. Go to **Shopify Admin** → **Settings** → **Notifications** → **Webhooks**
2. Find your "Order creation" webhook
3. **Verify the URL is exactly:**
   ```
   https://shopify-tracker-umber.vercel.app/api/webhooks/shopify
   ```
4. **NOT** `localhost:3000` or any other URL

### Step 2: Check Webhook Deliveries in Shopify
1. In Shopify webhook settings, click on your webhook
2. Go to **"Recent deliveries"** tab
3. Check the latest delivery:
   - **Status**: Should be `200 OK`
   - **URL**: Should show Vercel URL
   - **Response**: Should show `{"success":true}`
   - **Time**: Check if it's recent

### Step 3: Check Vercel Logs
1. Go to **Vercel Dashboard** → Your Project → **Logs**
2. Filter by `/api/webhooks/shopify`
3. Look for:
   - `🔔 Webhook received at:` - Confirms webhook hit Vercel
   - `📦 Processing order:` - Confirms order processing started
   - `✅ Order created successfully` - Confirms order saved
   - `❌ Invalid webhook signature` - Means `SHOPIFY_WEBHOOK_SECRET` is wrong

### Step 4: Verify Environment Variables in Vercel
Check these are set in **Vercel** → **Settings** → **Environment Variables**:
- ✅ `SHOPIFY_WEBHOOK_SECRET` = `9fa0b2d06a` (or your secret)
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SHOPIFY_STORE_URL`
- ✅ `SHOPIFY_ACCESS_TOKEN`

### Step 5: Test Webhook Manually
1. Create a test order in Shopify
2. Immediately check:
   - **Shopify webhook deliveries** - Did it send?
   - **Vercel logs** - Did it receive?
   - **Supabase database** - Was order created?

### Common Issues

**Issue 1: Webhook hitting localhost**
- **Symptom**: Orders show locally but not on Vercel
- **Fix**: Update webhook URL in Shopify to Vercel URL

**Issue 2: Wrong webhook secret**
- **Symptom**: Vercel logs show `❌ Invalid webhook signature`
- **Fix**: Verify `SHOPIFY_WEBHOOK_SECRET` in Vercel matches Shopify

**Issue 3: Webhook not firing**
- **Symptom**: No deliveries in Shopify webhook history
- **Fix**: Check webhook is enabled and API version is correct (2024-01 or later)

**Issue 4: Database connection issue**
- **Symptom**: Webhook received but order not created
- **Fix**: Check Supabase credentials in Vercel environment variables

### Quick Test
Run this in browser console on Vercel site:
```javascript
fetch('/api/webhooks/shopify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: true })
}).then(r => r.json()).then(console.log)
```

This will show if the endpoint is accessible (will fail without proper auth, but confirms route exists).

