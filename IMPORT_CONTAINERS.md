# Import Container and Product Data

This guide explains how to import the container list with products and quantities into Supabase.

## Step 1: Run the Migration Script

The SQL migration script has been created at:
```
supabase/migrations/002_import_containers_and_products.sql
```

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `002_import_containers_and_products.sql`
5. Click **Run** to execute the script

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
supabase db push
```

This will run all pending migrations including the new import script.

## Step 2: Verify the Import

After running the script, verify the data was imported correctly:

### Check Containers
```sql
SELECT container_id, eta, status FROM containers ORDER BY eta;
```

You should see 11 containers with their delivery dates.

### Check Products
```sql
SELECT name, sku FROM products;
```

You should see 5 products:
- Eetkamerstoel Elena
- Eetkamerstoel Maxim
- Eetkamerstoel Jordan
- Eetkamerstoel Rosalie
- Draaifunctie

### Check Container-Product Links
```sql
SELECT 
  c.container_id,
  p.name as product_name,
  cp.quantity
FROM container_products cp
JOIN containers c ON cp.container_id = c.id
JOIN products p ON cp.product_id = p.id
ORDER BY c.container_id, p.name;
```

## Step 3: Update Product IDs with Shopify Data

**Important:** The products are currently created with placeholder `shopify_product_id = 0`. You need to:

1. **Sync products from Shopify** using the admin dashboard's "Sync Products" button
2. **Match products by name or SKU** and update the `shopify_product_id` in the products table

Or manually update them:

```sql
-- Example: Update Eetkamerstoel Elena with actual Shopify product ID
UPDATE products 
SET shopify_product_id = YOUR_SHOPIFY_PRODUCT_ID 
WHERE name = 'Eetkamerstoel Elena';
```

## Step 4: Update Container IDs (if needed)

If you have actual container IDs for containers 8-11 (currently named CONTAINER-8, CONTAINER-9, etc.), update them:

```sql
UPDATE containers 
SET container_id = 'ACTUAL_CONTAINER_ID' 
WHERE container_id = 'CONTAINER-8';
```

## Data Summary

### Containers Imported:
- **Container 1:** LX1414 - End December 2024
- **Container 2:** LX1422 - End December 2024
- **Container 3:** LX1427 - End January 2025
- **Container 4:** LX1439 - Beginning January 2025
- **Container 5:** LX1456 - Mid February 2025
- **Container 6:** LX1456-2 - Mid February 2025 (duplicate ID, renamed)
- **Container 7:** LX1459 - Mid February 2025
- **Container 8:** CONTAINER-8 - Mid May 2025 (needs actual ID)
- **Container 9:** CONTAINER-9 - Mid May 2025 (needs actual ID)
- **Container 10:** CONTAINER-10 - Mid May 2025 (needs actual ID)
- **Container 11:** CONTAINER-11 - Mid May 2025 (needs actual ID)

### Products Imported:
- Eetkamerstoel Elena (SKU: 8720890000000-ELENA)
- Eetkamerstoel Maxim (SKU: 8720890000000-MAXIM)
- Eetkamerstoel Jordan (SKU: 8720890000000-JORDAN)
- Eetkamerstoel Rosalie (SKU: 8720890000000-ROSALIE)
- Draaifunctie (SKU: 8720890000000-DRAAI)

## Notes

1. **Container 6** had a duplicate ID (LX1456) with Container 5, so it was renamed to `LX1456-2`. Update this if you have the correct ID.

2. **Container 7** had conflicting quantities (200 and 150) for Eetkamerstoel Jordan. The script uses 200 - verify this is correct.

3. **All products** need to be matched with actual Shopify product IDs after syncing from Shopify.

4. **Container IDs 8-11** are placeholders. Update them with actual container IDs when available.

## Troubleshooting

If you encounter errors:

1. **Duplicate key errors:** The script uses `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`, so it's safe to run multiple times.

2. **Missing products:** Make sure the product names match exactly (case-sensitive).

3. **Date format issues:** The dates are in YYYY-MM-DD format. Adjust if your database uses a different format.

