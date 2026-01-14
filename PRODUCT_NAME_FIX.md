# Product Name Normalization Fix

## Problem

Old orders have product names that don't match current Shopify product names:
- **Old name:** "Draaifunctie" or variations
- **Current name:** "180 graden draaifunctie - met back to place mechanisme"

This causes the allocation system to skip 387 orders because it can't find matching products in containers.

---

## Solution

Update all order items with old "draaifunctie" variations to the current standard name.

### Step 1: Check what variations exist

```sql
SELECT DISTINCT name, COUNT(*) as count
FROM order_items
WHERE LOWER(name) LIKE '%draaifunctie%'
GROUP BY name
ORDER BY count DESC;
```

This shows all draaifunctie variations and how many orders have each.

### Step 2: Update to standard name

```sql
UPDATE order_items
SET name = '180 graden draaifunctie - met back to place mechanisme',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%draaifunctie%'
  AND LOWER(name) NOT LIKE '%180 graden%';
```

This updates all old variations to the current name.

### Step 3: Verify the update

```sql
SELECT DISTINCT name, COUNT(*) as count
FROM order_items
WHERE LOWER(name) LIKE '%draaifunctie%'
GROUP BY name;
```

Should now show only one variation: "180 graden draaifunctie - met back to place mechanisme"

---

## How to Run

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New query"

3. **Run Step 1 (Check variations)**
   - Copy the SQL from Step 1 above
   - Click "Run" (Ctrl+Enter)
   - You'll see all current variations

4. **Run Step 2 (Update names)**
   - Copy the SQL from Step 2 above
   - Click "Run"
   - You'll see "X rows updated"

5. **Run Step 3 (Verify)**
   - Copy the SQL from Step 3 above
   - Click "Run"
   - Should show only the new standard name

---

## After Running

1. **Update Containers**
   - Go to **Containers** page
   - For each container, click **Edit**
   - Remove old "Draaifunctie" product (if present)
   - Add "180 Graden Draaifunctie" product
   - Set quantity (e.g., 400)
   - Save

2. **Unlink All Orders**
   ```sql
   UPDATE orders 
   SET container_id = NULL, 
       delivery_eta = NULL, 
       updated_at = NOW();
   ```

3. **Run Smart Allocation**
   - Go to Admin Dashboard
   - Click **"Slim Toewijzen"** button
   - Should now allocate 500+ orders instead of 222

---

## Expected Results

**Before fix:**
- ✅ Allocated: 222 orders (36%)
- ❌ Skipped: 387 orders (64%)
- Reason: Product name mismatch

**After fix:**
- ✅ Allocated: 500+ orders (80%+)
- ❌ Skipped: 50-100 orders (insufficient total capacity)
- Reason: Not enough chairs or draaifunctie in all containers combined

---

## Notes

- This only affects **order_items** table (not Shopify)
- Shopify product names remain unchanged
- Future orders will use the current Shopify name automatically
- This is a one-time fix for historical data

---

## Troubleshooting

### "0 rows updated"
- All names already match the current standard
- No fix needed

### "Still skipping orders after fix"
- Check that containers have the correct product name
- Make sure quantities are set correctly
- Check console for `⚠️ Sample skipped orders` to see what products are missing

### "Orders still not linking"
- Verify product names in containers match exactly
- Check console for detailed logs
- Try unlinking all orders and running allocation again

