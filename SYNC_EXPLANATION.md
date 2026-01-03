# 🔄 How Order & Product Syncing Works

## 📊 Overview

Your portal has **three methods** for syncing data from Shopify:

1. **🔄 Real-Time Webhooks** (Primary - Automatic)
2. **🔘 Manual Sync Button** (Backup - On-Demand)
3. **⏰ Daily Cron Job** (Backup - Automatic)

## 1. Real-Time Webhooks (AUTOMATIC) ⚡

### How It Works
- **Shopify sends webhook** → Portal receives order → Order appears instantly
- **No action needed** - fully automatic
- **Real-time** - orders appear within seconds

### Setup Required
- ✅ Code is ready
- ⚠️ **You need to configure webhook in Shopify** (see `WEBHOOK_SETUP.md`)

### When Orders Sync
- ✅ **Automatically** when new order is created in Shopify
- ✅ **Immediately** - no delay
- ✅ **24/7** - works all the time

## 2. Manual Sync Button (BACKUP) 🔘

### When to Use
- ✅ **Initial setup** - sync old orders (first time)
- ✅ **If webhook fails** - manual refresh
- ✅ **When you want to check** - verify all orders are synced
- ✅ **After webhook setup** - sync any orders created before webhook was configured

### How to Use
1. Go to Admin Dashboard
2. Click **"Sync Orders"** button
3. Wait for completion
4. See toast notification with results

### What It Does
- Fetches last **250 orders** from Shopify
- Skips orders that already exist
- Creates new orders in database
- Links products if they exist

### Keep This Button? **YES** ✅
**Reasons:**
- Initial setup (sync old orders)
- Backup if webhook fails
- Manual control when needed
- Transparency for admins

## 3. Daily Cron Job (BACKUP) ⏰

### How It Works
- **Runs automatically** every day at 2 AM
- **Catches missed orders** - if webhook failed
- **No action needed** - fully automatic

### Setup
- ✅ Already configured in `vercel.json`
- ✅ Works automatically in production
- ⚠️ Requires Vercel deployment

## 📦 Product Syncing

### Why Sync Products?
- Products need to be in database before linking to containers
- Products are used to match orders to containers
- Product names/IDs may change in Shopify

### How to Sync Products
1. Go to Admin Dashboard
2. Click **"Sync Products"** button
3. Products are synced from Shopify
4. See toast notification with results

### When to Sync Products
- ✅ **Initial setup** - sync all products
- ✅ **When new products added** - if not synced via orders
- ✅ **Periodically** - to keep product list updated

### Auto-Sync?
- Products are **partially synced** when orders sync
- But full product sync is better for container linking
- **Recommendation**: Sync products manually when needed

## 🔗 Order → Container Linking

### Current Method: Manual
1. Create container
2. Add products to container
3. Click **"Link Orders"** button on container
4. System finds orders with matching products
5. Orders are linked automatically

### Auto-Link? (Future Enhancement)
- Could auto-link when:
  - Order created via webhook
  - Container created/updated
- **Current**: Manual control is preferred for accuracy

## 📋 Complete Workflow

### Initial Setup (First Time)
1. ✅ **Sync Products** - Get all products from Shopify
2. ✅ **Sync Orders** - Get all existing orders
3. ✅ **Create Containers** - Add your containers with ETAs
4. ✅ **Link Products to Containers** - When creating containers
5. ✅ **Link Orders to Containers** - Click "Link Orders" button
6. ✅ **Configure Webhook** - Set up automatic syncing

### Daily Operations (After Setup)
1. ✅ **New orders sync automatically** via webhook
2. ✅ **Create new containers** as needed
3. ✅ **Update container ETAs** - orders update automatically
4. ✅ **Link new orders** - Click "Link Orders" when needed

## ✅ What's Ready

### Fully Implemented
- ✅ Webhook endpoint (`/api/webhooks/shopify`)
- ✅ Manual sync button
- ✅ Product sync button
- ✅ Daily cron job
- ✅ Order → Container linking
- ✅ Auto-update when container ETA changes

### Needs Setup (One-Time)
- ⚠️ Configure webhook in Shopify (see `WEBHOOK_SETUP.md`)
- ⚠️ Deploy to Vercel for cron job

## 🎯 Recommendations

### Keep Sync Buttons? **YES** ✅
- Useful for initial setup
- Backup if webhook fails
- Manual control when needed
- Good for transparency

### Product Sync Button? **YES** ✅
- **Added!** Now available in admin dashboard
- Use for initial setup
- Use when new products added

### Auto-Link Orders? **OPTIONAL** ⚠️
- Current manual method works well
- Gives you control
- Can be enhanced later if needed

## 📝 Summary

**New orders flow automatically** once webhook is configured:
- Order created in Shopify → Webhook sent → Order in portal → Customer sees it

**Sync buttons are for:**
- Initial setup
- Manual refresh
- Backup if webhook fails

**Everything is ready!** Just configure the webhook and you're done! 🎉

