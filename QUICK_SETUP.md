# Quick Setup - Fix Login Error & Shopify

## 🔴 Fix Login Error (Missing Supabase)

**Error:** `NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env variables required`

### Solution:

1. **Create `.env.local` file** in project root (same folder as `package.json`)

2. **Add these lines:**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_token_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_SECRET_KEY=any_random_string
```

3. **Get Supabase credentials:**
   - Go to [supabase.com](https://supabase.com) → Your Project
   - Settings → API
   - Copy: Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy: `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy: `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

4. **Restart dev server:** Stop (Ctrl+C) and run `npm run dev` again

---

## 🛍️ Shopify API Setup

### What to Copy from Shopify:

1. **Store URL:**
   - Look at browser address bar when in Shopify admin
   - Format: `https://your-store.myshopify.com`
   - Copy this → `SHOPIFY_STORE_URL`

2. **Admin API Access Token:**
   - Shopify Admin → **Settings** → **Apps and sales channels**
   - Click **"Develop apps"** (or find existing app)
   - Click your app → **"Configure Admin API scopes"**
   - Enable: `read_orders`, `read_products`, `read_customers`
   - **Save** → **Install app**
   - Click **"Reveal token"** → Copy token
   - Format: `shpat_xxxxx...`
   - Copy this → `SHOPIFY_ACCESS_TOKEN`

### Where to Input:

Add to `.env.local` file:
```env
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
```

### Test:

1. Restart server: `npm run dev`
2. Go to: `http://localhost:3000/admin`
3. Click **"Sync Orders"** button
4. Should see orders syncing!

---

## 📝 Complete .env.local Template

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Shopify
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_SECRET_KEY=random_secret_123
```

**Important:** Restart dev server after creating/updating `.env.local`!

