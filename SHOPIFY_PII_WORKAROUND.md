# Shopify PII (Email/First Name) Workaround

## Problem
Shopify Admin API does not return customer email and first_name for:
- Disabled customers (`state: 'disabled'`)
- Stores on Basic plan (PII restrictions)
- Some app configurations

## Best Workaround: Use Webhooks

The `orders/create` webhook **includes customer PII** in its payload when the order is created, even if the API doesn't return it later.

### How It Works
1. When an order is created in Shopify, the webhook sends the **complete order data** including customer email and first_name
2. Our webhook handler (`app/api/webhooks/shopify/route.ts`) captures this data
3. The data is stored in the database immediately

### Current Implementation
✅ Our webhook handler already extracts customer data from the webhook payload
✅ It tries to fetch customer separately if needed
✅ It falls back to order data if customer fetch fails

### Testing the Webhook
To verify webhook is working:
1. Create a new test order in Shopify
2. Check the webhook logs in your server/Vercel logs
3. Verify the order appears in the admin dashboard with customer data

## Alternative Workarounds

### 1. Upgrade Shopify Plan
- Basic plan: No PII access via API
- Shopify plan or higher: Full PII access
- **Cost**: Additional monthly fee

### 2. Check App Type
- Admin-created apps: Limited PII access
- Partner Dashboard apps: Better PII access
- **Action**: Recreate app via Partner Dashboard if needed

### 3. Manual Entry (Current Fallback)
- Orders sync without first_name (set to null)
- Admins can manually edit first_name in admin panel
- Tracking works once first_name is added

## Recommended Solution

**Use Webhooks** - This is already implemented and should work for new orders.

For existing orders that were synced before webhook was set up:
1. They may have `customer_first_name: null`
2. Admins can manually add first_name via the admin panel
3. Or re-sync orders (but this won't help if customer is disabled)

## Next Steps

1. ✅ Webhook handler is already implemented
2. ✅ Webhook should capture customer data for new orders
3. ⚠️ For existing orders: Manual entry may be needed
4. 📝 Consider adding a bulk edit feature for first_name in admin panel

## Testing

Test with a new order:
1. Create a new order in Shopify (even with disabled customer)
2. Check webhook payload - it should include customer email/first_name
3. Verify order appears in admin dashboard with customer data

