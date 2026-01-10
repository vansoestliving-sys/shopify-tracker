# Option 1: Shopify Refund/Cancellation Sync - Implementation Summary

## What It Does

When you refund or cancel an order in Shopify (and check "restock items"), the system automatically:
- **Full refund** → Deletes order from portal
- **Partial refund** → Removes refunded items from order, updates quantities
- **Auto-reallocates** remaining orders (shifts up to fill gaps)

## Technical Implementation

### 1. Shopify Webhook Setup
- **Event:** `orders/updated` (fires when order is modified)
- **Endpoint:** `/api/webhooks/shopify-refund`
- **Checks:**
  - `financial_status` = "refunded"
  - `cancelled_at` has a date
  - `restock_line_items` = true (items go back to stock)

### 2. Refund Detection Logic
```
IF order.financial_status = "refunded" OR order.cancelled_at exists:
  IF restock_line_items = true:
    → Process refund
  ELSE:
    → Skip (items not restocked, don't delete)
```

### 3. Full Refund Handling
- Delete order from portal
- Auto-reallocate newer orders in that container (shift up)
- Update container inventory

### 4. Partial Refund Handling
- Compare order items before/after refund
- Remove refunded items from `order_items` table
- Update order total amount
- If all items refunded → Delete order
- Auto-reallocate if needed

### 5. Auto-Reallocation
- When order/item deleted, find newer orders in same container
- Reallocate them to fill the gap (shift up)
- Maintains chronological order

## What You Need to Do

1. **In Shopify Admin:**
   - Go to Settings → Notifications → Webhooks
   - Add webhook: `orders/update` → Your portal URL + `/api/webhooks/shopify-refund`
   - Copy webhook secret

2. **In Portal:**
   - Add webhook secret to environment variables
   - System automatically processes refunds

## Benefits

✅ No manual deletion needed
✅ Always in sync with Shopify
✅ Accurate container inventory
✅ Fair allocation (orders shift up automatically)
✅ Works for both full and partial refunds

## Price: €100-150

**€100:** Basic sync (full refunds only)
**€150:** Full sync (full + partial refunds, with restock detection)

