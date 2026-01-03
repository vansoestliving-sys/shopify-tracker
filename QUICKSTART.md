# Quick Start Guide

Get your delivery tracking portal up and running in 30 minutes!

## 🚀 5-Minute Setup (Local Development)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Fill in your credentials (see SETUP.md for details).

### 3. Set Up Database

1. Go to [supabase.com](https://supabase.com) and create a project
2. Copy your project URL and API keys
3. Go to SQL Editor
4. Run the migration: `supabase/migrations/001_initial_schema.sql`

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📦 Initial Data Setup

### Add Your First Container

1. Go to `/admin` (or create admin access)
2. Click "Add Container"
3. Enter:
   - Container ID: `C12`
   - ETA: `2024-03-18`
   - Status: `in_transit`

### Sync Orders from Shopify

1. In admin dashboard, click "Sync Orders"
2. This will fetch all orders from your Shopify store
3. Orders will be created in the database

### Link Orders to Containers

1. Add products to containers (via API or admin UI)
2. Click "Link Orders" button next to a container
3. System automatically matches orders with products

## 🧪 Test the System

### Test Customer Portal

1. Create a test order in Shopify
2. Sync orders (admin dashboard)
3. Go to `/track`
4. Enter tracking ID and first name
5. Should see order details!

### Test Customer Login

1. Register at `/register` with a customer email
2. Log in at `/login`
3. Go to `/dashboard`
4. Should see all orders for that customer

## 🎯 Next Steps

1. **Customize Branding**
   - Update colors in `tailwind.config.js`
   - Add your logo

2. **Set Up Production**
   - Deploy to Vercel (see DEPLOYMENT.md)
   - Configure custom domain
   - Set up webhooks

3. **Import Existing Containers**
   - Use the import script: `scripts/import-containers.ts`
   - Or add manually via admin dashboard

4. **Link Old Orders**
   - Use the "Link Orders" feature in admin
   - Or update manually via API

## 📚 Documentation

- **SETUP.md** - Complete setup instructions
- **DEPLOYMENT.md** - Production deployment guide
- **README.md** - Project overview

## 🆘 Need Help?

- Check SETUP.md for detailed instructions
- Review API routes in `app/api/`
- Check Supabase logs for database issues
- Check Vercel logs for deployment issues

