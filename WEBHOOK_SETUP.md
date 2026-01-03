# Shopify Webhook Setup Guide

## 🎯 Purpose

Configure Shopify to automatically send new orders to your portal in real-time. This enables **automatic order syncing** without manual intervention.

## 📋 Prerequisites

- Shopify Admin access
- Your portal deployed to Vercel (or running locally with ngrok for testing)
- Webhook endpoint URL ready

## 🔧 Setup Steps

### Step 1: Get Your Webhook URL

**Production URL:**
```
https://your-domain.vercel.app/api/webhooks/shopify
```

**Local Testing (using ngrok):**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000

# Use the ngrok URL:
https://your-ngrok-id.ngrok.io/api/webhooks/shopify
```

### Step 2: Configure Webhook in Shopify

1. **Go to Shopify Admin** → Settings → Notifications
2. **Scroll down** to "Webhooks" section
3. **Click "Create webhook"**
4. **Fill in the details:**
   - **Event**: `Order creation`
   - **Format**: `JSON`
   - **URL**: Your webhook URL from Step 1
   - **API version**: `2024-01` (or latest)

5. **Click "Save webhook"**

### Step 3: Set Webhook Secret (Optional but Recommended)

1. **Generate a secret** (random string, at least 32 characters)
   ```bash
   # On Mac/Linux:
   openssl rand -base64 32
   
   # Or use an online generator
   ```

2. **Add to Shopify webhook**:
   - Edit the webhook you just created
   - Add the secret in the "API version" field (if available)
   - Or note it for environment variable

3. **Add to your `.env.local`**:
   ```env
   SHOPIFY_WEBHOOK_SECRET=your-generated-secret-here
   ```

4. **Add to Vercel Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `SHOPIFY_WEBHOOK_SECRET` with your secret value

### Step 4: Test the Webhook

1. **Create a test order** in Shopify
2. **Check your portal** - the order should appear automatically
3. **Check Vercel logs** if order doesn't appear:
   - Vercel Dashboard → Your Project → Logs
   - Look for webhook requests

## ✅ Verification

### Check Webhook is Working

1. **In Shopify Admin** → Settings → Notifications → Webhooks
2. **Click on your webhook**
3. **Check "Recent deliveries"** - should show successful requests

### Test Order Flow

1. Create a test order in Shopify
2. Order should appear in admin dashboard within seconds
3. Customer can see it in their portal immediately

## 🔍 Troubleshooting

### Webhook Not Receiving Orders

1. **Check URL is correct** - must be exact match
2. **Check HTTPS** - Shopify requires HTTPS (not HTTP)
3. **Check Vercel logs** for errors
4. **Verify webhook secret** matches in both places

### Orders Not Appearing

1. **Check webhook deliveries** in Shopify
2. **Check Vercel function logs**
3. **Verify database connection**
4. **Check if order already exists** (webhook skips duplicates)

### Common Errors

**401 Unauthorized**
- Webhook secret mismatch
- Check `SHOPIFY_WEBHOOK_SECRET` in environment variables

**500 Internal Server Error**
- Check Vercel logs for details
- Verify Supabase connection
- Check database tables exist

**404 Not Found**
- Webhook URL incorrect
- Verify endpoint exists: `/api/webhooks/shopify`

## 📊 How It Works

```
Shopify Order Created
    ↓
Shopify Sends Webhook
    ↓
/api/webhooks/shopify Receives Order
    ↓
Order Created in Database
    ↓
Order Items Linked to Products
    ↓
Customer Sees Order in Portal
```

## 🔄 Backup Methods

Even with webhooks, you have backup methods:

1. **Manual Sync Button** - Use for initial setup or manual refresh
2. **Cron Job** - Daily sync at 2 AM (catches missed orders)

## 📝 Notes

- **Webhooks are real-time** - orders appear within seconds
- **Webhook secret is optional** but recommended for security
- **HTTPS required** - Shopify won't send to HTTP URLs
- **Rate limits** - Shopify may throttle if too many requests

## 🎉 Success!

Once configured, new orders will automatically sync to your portal without any manual action needed!

