# Webhook Troubleshooting Guide

## Issue: First Name Not Prefilled

**Cause**: Shopify may not include first_name in webhook payload for disabled customers.

**Solution**:
1. Go to Admin Dashboard → Orders
2. Click Edit on the order
3. Manually add the customer's first name
4. Save

**Why it happens**: Shopify PII restrictions for disabled customers.

## Issue: Product Shows "Not Linked"

**Cause**: Products haven't been synced from Shopify yet.

**Solution**:
1. Go to Admin Dashboard
2. Click **"Sync Products"** button
3. Wait for products to sync
4. Go to Containers page
5. Add products to containers (if not already done)
6. Click **"Link Orders"** button on the container
7. Orders with matching products will be linked automatically

**How it works**:
- Products must exist in database first
- Products must be added to containers
- Orders are linked to containers based on product matching

## Check Webhook Logs

In Vercel → Logs, look for:
- `✅ Order created successfully` - confirms order creation
- `⚠️ Product not found in database` - means products need syncing
- `⚠️ First name missing` - means first name wasn't in webhook payload

## Quick Fix Checklist

- [ ] Sync products from Shopify (Admin Dashboard → Sync Products)
- [ ] Add products to containers (Containers page → Edit container → Add products)
- [ ] Link orders to containers (Containers page → Link Orders button)
- [ ] Manually add first name if missing (Orders page → Edit order)

