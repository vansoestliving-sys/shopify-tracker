# Van Soest Living - Setup Guide

Complete setup instructions for the delivery tracking portal.

## 📋 Prerequisites

1. **Supabase Account** (Free tier works)
   - Sign up at [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and API keys

2. **Vercel Account** (Free tier works)
   - Sign up at [vercel.com](https://vercel.com)
   - Connect your GitHub account

3. **GitHub Account**
   - For code repository

4. **Shopify Admin Access**
   - Admin API access token
   - Webhook permissions (optional, for real-time sync)

## 🗄️ Database Setup

### Step 1: Run SQL Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run** to execute the migration

This will create all necessary tables, indexes, triggers, and RLS policies.

### Step 2: Verify Tables

In Supabase SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- `containers`
- `container_products`
- `customers`
- `orders`
- `order_items`
- `products`
- `admin_users`

## 🔐 Authentication Setup

### Enable Email Auth in Supabase

1. Go to **Authentication** → **Providers** in Supabase
2. Enable **Email** provider
3. Configure email templates (optional)
4. Set up email redirect URLs:
   - `http://localhost:3000/auth/callback` (development)
   - `https://your-domain.com/auth/callback` (production)

## 🛍️ Shopify Integration

### Step 1: Create Admin API Token

1. Go to Shopify Admin → **Settings** → **Apps and sales channels**
2. Click **Develop apps** → **Create an app**
3. Name it "Delivery Tracking Portal"
4. Configure Admin API scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `write_orders` (optional, for tags)
5. Install the app and copy the **Admin API access token**

### Step 2: Set Up Webhook (Optional - for real-time sync)

1. In your Shopify app settings, go to **Webhooks**
2. Create a new webhook:
   - Event: **Order creation**
   - Format: **JSON**
   - URL: `https://your-domain.com/api/webhooks/shopify`
   - API version: **2024-01**
3. Copy the webhook secret

## 🚀 Deployment

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/vansoestliving-tracking.git
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **New Project**
3. Import your GitHub repository
4. Configure environment variables (see below)
5. Click **Deploy**

### Step 3: Environment Variables

Add these in Vercel dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_admin_api_token
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
ADMIN_SECRET_KEY=your_random_secret_key_here
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Important:** 
- `SUPABASE_SERVICE_ROLE_KEY` should be kept secret (not public)
- `ADMIN_SECRET_KEY` should be a random string for admin API protection
- `NEXT_PUBLIC_APP_URL` should match your Vercel deployment URL

## 📦 Importing Containers

### Option 1: Via Admin Dashboard

1. Log in to admin dashboard at `/admin`
2. Click **Add Container**
3. Enter container ID, ETA, and status

### Option 2: Via API

Use the `/api/containers` POST endpoint with your admin secret:

```bash
curl -X POST https://your-domain.com/api/containers \
  -H "Authorization: Bearer your_admin_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "container_id": "C12",
    "eta": "2024-03-18",
    "status": "in_transit"
  }'
```

### Option 3: Bulk Import Script

See `scripts/import-containers.ts` for bulk import from Excel/CSV.

## 🔄 Syncing Orders

### Manual Sync

1. Go to admin dashboard
2. Click **Sync Orders** button
3. This will fetch all orders from Shopify and create them in the database

### Automatic Sync

#### Option A: Vercel Cron Job (Recommended)

1. Create `vercel.json` with cron configuration (already included)
2. Vercel will automatically run the sync daily

#### Option B: Make.com Webhook

1. Set up a Make.com scenario
2. Trigger on new Shopify order
3. Call `/api/shopify/sync` endpoint

#### Option C: Shopify Webhook (Real-time)

If you set up the Shopify webhook, orders will sync automatically when created.

## 🔗 Linking Orders to Containers

### Automatic Linking

1. Add products to containers via `/api/containers/[id]/products`
2. Click **Link Orders** button in admin dashboard
3. System will automatically match orders with products in the container

### Manual Linking

Update order's `container_id` directly in Supabase or via API.

## 🎨 Customization

### Branding

- Update colors in `tailwind.config.js`
- Replace logo/images in `app/` directory
- Update site name in `app/layout.tsx`

### Domain

1. In Vercel, go to **Settings** → **Domains**
2. Add your custom domain
3. Update `NEXT_PUBLIC_APP_URL` environment variable

## 🔍 Testing

### Test Customer Login

1. Create a test customer in Supabase:
```sql
INSERT INTO customers (email, first_name, last_name)
VALUES ('test@example.com', 'Test', 'User');
```

2. Create a test order linked to this customer
3. Log in at `/login` with the customer email
4. You should see the order in the dashboard

### Test Tracking

1. Get a tracking ID from an order
2. Go to `/track`
3. Enter tracking ID and first name
4. Should display order details

## 🐛 Troubleshooting

### Orders not syncing

- Check Shopify API token permissions
- Verify `SHOPIFY_STORE_URL` format (should end with `.myshopify.com`)
- Check Vercel function logs

### Authentication not working

- Verify Supabase URL and keys
- Check email provider is enabled in Supabase
- Verify redirect URLs are configured

### Container ETA not updating orders

- Check database trigger is created (from migration)
- Verify orders have `container_id` set
- Check Supabase logs for trigger errors

## 📞 Support

For issues or questions, check:
- Supabase logs: Dashboard → Logs
- Vercel logs: Project → Functions → Logs
- Browser console for frontend errors

