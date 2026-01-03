# Auto-Linking Orders to Containers

## What Changed

Orders now **automatically link to containers** when created via webhook, based on product matching.

## How It Works

1. **Order created** via Shopify webhook
2. **Order items saved** to database
3. **System checks** which products are in the order
4. **Finds containers** that contain those products
5. **Links order** to container with most matching products
6. **Sets delivery ETA** from container

## Requirements

- ✅ Products must be synced from Shopify
- ✅ Products must be added to containers
- ✅ Order must contain products that exist in containers

## If Auto-Linking Fails

- Check Vercel logs for: `⚠️ Auto-linking failed`
- Verify products are in containers
- Manually link using "Link Orders" button if needed

## Webhook Not Hitting Vercel?

**Check Shopify Webhook URL:**
1. Shopify Admin → Settings → Notifications → Webhooks
2. Verify URL is: `https://shopify-tracker-umber.vercel.app/api/webhooks/shopify`
3. **NOT** `localhost:3000` or `/admin`

**Check Vercel Logs:**
- Look for: `🔔 Webhook received at:` (confirms webhook hit)
- If missing, webhook URL is wrong

