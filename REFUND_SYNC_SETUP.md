# Shopify Refund Sync - Setup Instructions

## ✅ What's Implemented

- **Full refund** (with restock) → Deletes order from portal
- **Partial refund** (with restock) → Removes refunded items, updates order
- **Auto-reallocation** → Shifts orders up when one is deleted
- **Restock detection** → Only processes if "restock items" checkbox is checked

---

## 🔧 Setup Steps

### Step 1: Get Your Portal URL

Your webhook URL will be:
```
https://shopify-tracker-umber.vercel.app/api/webhooks/shopify-refund
```

(Or your custom domain if you have one)

---

### Step 2: Add Webhook in Shopify

1. **Go to Shopify Admin**
   - Login to your Shopify store
   - Go to: **Settings** → **Notifications** → Scroll down to **Webhooks**

2. **Create New Webhook**
   - Click **"Create webhook"** button
   - **Event:** Select `Order update`
   - **Format:** JSON
   - **URL:** `https://shopify-tracker-umber.vercel.app/api/webhooks/shopify-refund`
   - Click **"Save webhook"**

3. **Copy Webhook Secret**
   - After creating, Shopify will show a secret (looks like: `9fa0b2d06a...`)
   - Copy this secret

---

### Step 3: Add Secret to Vercel

1. **Go to Vercel Dashboard**
   - Login to https://vercel.com
   - Select your project: `shopify-tracker`

2. **Add Environment Variable**
   - Go to **Settings** → **Environment Variables**
   - Add:
     - **Name:** `SHOPIFY_WEBHOOK_SECRET`
     - **Value:** (paste the secret from Shopify)
     - **Environment:** Production, Preview, Development (check all)
   - Click **"Save"**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click **"..."** on latest deployment
   - Click **"Redeploy"**
   - This applies the new environment variable

---

## 🧪 Testing

### Test Full Refund:

1. **In Shopify:**
   - Go to an order
   - Click **"Refund"**
   - Check **"Restock items"** checkbox
   - Refund the full amount
   - Click **"Refund"**

2. **Check Portal:**
   - Go to `/admin/orders`
   - Order should be **deleted**
   - Newer orders in same container should have **shifted up**

### Test Partial Refund:

1. **In Shopify:**
   - Go to an order with multiple items
   - Click **"Refund"**
   - Select only some items to refund
   - Check **"Restock items"** checkbox
   - Refund partial amount
   - Click **"Refund"**

2. **Check Portal:**
   - Go to `/admin/orders`
   - Order should still exist
   - Refunded items should be **removed** from order
   - Order total should be **updated**

---

## ⚠️ Important Notes

### When It Works:
- ✅ Full refund + "Restock items" checked → Deletes order
- ✅ Partial refund + "Restock items" checked → Removes items
- ✅ Order cancelled + "Restock items" checked → Deletes order

### When It Doesn't Work:
- ❌ Refund without "Restock items" → Skipped (items not going back to stock)
- ❌ Order not in portal → Skipped (order doesn't exist)
- ❌ Refund amount < 95% of total → Treated as partial refund

---

## 🔍 Troubleshooting

### Webhook Not Working?

1. **Check Vercel Logs:**
   - Go to Vercel Dashboard → Your Project → **Functions** tab
   - Look for `/api/webhooks/shopify-refund`
   - Check for errors

2. **Check Shopify Webhook Status:**
   - Go to Shopify → Settings → Notifications → Webhooks
   - Check if webhook shows recent deliveries
   - Click on webhook to see delivery history

3. **Verify Secret:**
   - Make sure `SHOPIFY_WEBHOOK_SECRET` in Vercel matches Shopify secret
   - Secret must be exact (no spaces, correct case)

4. **Test Manually:**
   - Create a test order in Shopify
   - Refund it with "Restock items" checked
   - Check portal to see if it's deleted

---

## 📊 What Happens

### Full Refund Flow:
1. Shopify sends webhook → Portal receives
2. Checks: Refunded? Restock checked? → Yes
3. Finds order in database
4. Deletes order + order_items
5. Finds newer orders in same container
6. Reallocates them (shifts up)
7. ✅ Done

### Partial Refund Flow:
1. Shopify sends webhook → Portal receives
2. Checks: Partially refunded? Restock checked? → Yes
3. Finds order in database
4. Compares refunded items
5. Removes refunded items from order_items
6. Updates order total amount
7. If all items refunded → Deletes order
8. ✅ Done

---

## 🎉 You're Done!

Once set up:
- ✅ Refunds automatically sync
- ✅ No manual deletion needed
- ✅ Orders auto-reallocate
- ✅ Always in sync with Shopify

---

## 💰 Price: €150

This includes:
- Full refund handling
- Partial refund handling
- Restock detection
- Auto-reallocation
- Webhook setup assistance

