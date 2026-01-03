# Database Setup - Fix 500 Errors

## The Problem

You're getting 500 errors because the database tables don't exist yet. You need to run the migration in Supabase.

## Quick Fix (2 minutes)

### Step 1: Open Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### Step 2: Run the Migration

1. Open the file: `supabase/migrations/001_initial_schema.sql` in your project
2. Copy **ALL** the contents
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### Step 3: Verify

You should see: "Success. No rows returned"

### Step 4: Test

1. Refresh your admin dashboard
2. The 500 errors should be gone!
3. You should see empty lists (no containers/orders yet)

## What the Migration Creates

- `containers` table
- `products` table  
- `container_products` table
- `customers` table
- `orders` table
- `order_items` table
- Indexes and triggers
- Row Level Security policies

## Troubleshooting

**If you get an error:**
- Make sure you copied the ENTIRE migration file
- Check for syntax errors
- Try running it section by section

**If tables still don't exist:**
- Check Supabase → Table Editor
- You should see the tables listed
- If not, the migration didn't run successfully

## Next Steps

After running the migration:
1. ✅ 500 errors should be fixed
2. ✅ Admin dashboard should load
3. ✅ You can add containers
4. ✅ You can sync orders from Shopify

