# Diagnostic Check - Data Mismatch Issue

## Problem
- Orders created in Supabase (webhook works - order 1751 created)
- Frontend shows wrong data
- Local and Vercel show different data
- Deleted orders still appear

## Step-by-Step Diagnosis

### 1. Verify Supabase Connection

**Check API Route Logs:**
- Go to Vercel → Logs
- Look for: `📦 Fetched X orders directly from Supabase database`
- Look for: `📋 Order IDs in database:`
- **Compare these IDs with what's actually in Supabase**

**Check Browser Console:**
- Open admin page → F12 → Console
- Look for: `Orders page - Data received from API:`
- Check `orderIds` array
- **Compare with Supabase database**

### 2. Verify Environment Variables

**Local (.env.local):**
```
NEXT_PUBLIC_SUPABASE_URL=?
SUPABASE_SERVICE_ROLE_KEY=?
```

**Vercel (Settings → Environment Variables):**
```
NEXT_PUBLIC_SUPABASE_URL=?
SUPABASE_SERVICE_ROLE_KEY=?
```

**⚠️ CRITICAL:** These MUST match! If they're different, local and Vercel are querying different databases!

### 3. Check for Multiple Supabase Projects

**Possible Issue:** Local might be using a different Supabase project than Vercel.

**How to Check:**
1. In Supabase Dashboard → Settings → API
2. Note your Project URL
3. Compare with `.env.local` and Vercel env vars
4. They should be EXACTLY the same

### 4. Verify Database State

**In Supabase Dashboard:**
1. Go to Table Editor → `orders` table
2. Count total orders
3. Note the order IDs (especially latest ones)
4. Check if order 1751 exists

**Compare with:**
- Vercel logs: `📋 Order IDs in database:`
- Browser console: `orderIds` array

### 5. Test Direct API Call

**In Browser Console (on Vercel site):**
```javascript
fetch('/api/admin/orders?t=' + Date.now())
  .then(r => r.json())
  .then(data => {
    console.log('API Response:', data);
    console.log('Order Count:', data.orders?.length);
    console.log('Order IDs:', data.orders?.map(o => o.id));
  });
```

**Compare with Supabase directly.**

## Possible Causes

### Cause 1: Different Supabase Projects
- **Symptom:** Local shows different data than Vercel
- **Fix:** Ensure `.env.local` and Vercel env vars point to same Supabase project

### Cause 2: Stale Browser Cache
- **Symptom:** Deleted orders still appear
- **Fix:** Hard refresh (Ctrl+Shift+R) or clear cache

### Cause 3: API Caching (Unlikely)
- **Symptom:** API returns old data
- **Fix:** Already implemented cache headers - should not be issue

### Cause 4: Wrong Database Connection
- **Symptom:** Webhook creates orders but API doesn't see them
- **Fix:** Verify both use same `SUPABASE_SERVICE_ROLE_KEY`

## Quick Fix: Reset Everything

If data is completely wrong, consider:

1. **Clear Supabase orders table:**
   ```sql
   DELETE FROM order_items;
   DELETE FROM orders;
   ```

2. **Re-sync from Shopify:**
   - Go to Admin Dashboard
   - Click "Sync Orders"

3. **Verify fresh data:**
   - Check Supabase → orders table
   - Check Admin Dashboard → orders list
   - They should match exactly

## Next Steps

1. Check Vercel logs for actual order IDs being fetched
2. Compare with Supabase database
3. Verify environment variables match
4. If mismatch found, update Vercel env vars to match Supabase

