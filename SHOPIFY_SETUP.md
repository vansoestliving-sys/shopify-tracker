# Shopify API Setup - Quick Guide

## Step 1: Get Your Shopify API Credentials

1. **Go to Shopify Admin** → Settings → Apps and sales channels
2. **Click "Develop apps"** → Find the app you were invited to (or create new)
3. **Click "Configure Admin API scopes"**
4. **Enable these scopes:**
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `write_orders` (optional, for tags)
5. **Click "Save"**
6. **Click "Install app"** (if not already installed)
7. **Copy these values:**
   - **Store URL**: `https://your-store.myshopify.com` (from browser URL)
   - **Admin API access token**: Click "Reveal token" and copy

## Step 2: Add to Environment Variables

Create `.env.local` file in project root:

```bash
# Supabase (get from supabase.com dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Shopify
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_SECRET_KEY=your_random_secret_here
```

## Step 3: Test

1. Restart dev server: `npm run dev`
2. Go to `/admin`
3. Click "Sync Orders" button
4. Check if orders appear!

## Where to Find in Shopify:

- **Store URL**: Browser address bar when in Shopify admin
- **Access Token**: Settings → Apps → Your app → API credentials → Admin API access token

