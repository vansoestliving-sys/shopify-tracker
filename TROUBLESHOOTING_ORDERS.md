# Troubleshooting: Orders Not Showing in Portal

## 🔍 Common Issues

### Issue 1: Orders Exist But Not Showing

**Possible Causes:**
1. Email mismatch between auth and orders
2. `customer_id` is null in orders table
3. RLS policies blocking access

**Solution:**
- ✅ Updated API to check both `customer_id` AND `customer_email`
- ✅ Case-insensitive email matching
- ✅ Uses admin client to bypass RLS (with email filtering for security)

### Issue 2: Customer Not Found

**Check:**
1. Does customer exist in `customers` table?
2. Does email match exactly (case-sensitive in some cases)?

**Solution:**
- ✅ API now checks orders by `customer_email` directly if customer record doesn't exist
- ✅ Case-insensitive matching with `.ilike()`

### Issue 3: RLS Policy Blocking

**Check:**
- RLS policy might be too restrictive
- Auth user email might not match customer email

**Solution:**
- ✅ API uses admin client but filters by email for security
- ✅ Double-checks email match in results

## 🔧 How to Debug

### Step 1: Check Orders in Database

Run in Supabase SQL Editor:
```sql
-- Check if orders exist
SELECT id, shopify_order_number, customer_email, customer_id 
FROM orders 
LIMIT 10;

-- Check customer email
SELECT email, id FROM customers LIMIT 10;

-- Check if email matches
SELECT o.*, c.email as customer_table_email
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
WHERE o.customer_email = 'your-email@example.com';
```

### Step 2: Check Auth User

In browser console (after login):
```javascript
// Check logged in user
const { data: { user } } = await supabase.auth.getUser()
console.log('User email:', user?.email)
```

### Step 3: Test API Directly

```bash
# After logging in, test the API
curl http://localhost:3000/api/customer/orders \
  -H "Cookie: your-session-cookie"
```

## ✅ What's Fixed

1. **Email Matching**: Now uses case-insensitive matching
2. **Null customer_id**: Checks `customer_email` directly if `customer_id` is null
3. **RLS Bypass**: Uses admin client but filters by email for security
4. **Better Error Messages**: Shows helpful messages in dashboard

## 🎯 Quick Fix

If orders still don't show:

1. **Check email match**: Make sure login email matches order email exactly
2. **Check customer_id**: Some orders might have null `customer_id`
3. **Use tracking page**: Customers can always use Tracking ID + First Name

## 📝 Next Steps

If issue persists:
1. Check browser console for errors
2. Check Supabase logs
3. Verify email in orders table matches login email
4. Check if `customer_id` is set in orders

