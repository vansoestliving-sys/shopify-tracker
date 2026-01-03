# Van Soest Living - Delivery Tracking Portal

A secure private customer delivery-tracking portal that connects Shopify orders → product container shipments → delivery ETA.

## 🎯 Features

- **Private Customer Portal**: Customers log in securely and only see their own orders
- **Alternative Access**: Unlock using tracking ID + first name
- **Container-Based Tracking**: Container → Product → Shopify Order → Delivery Date mapping
- **Admin Dashboard**: Manage containers, set ETAs, delay shipments, trigger automatic order updates
- **Automatic Sync**: System automatically syncs new Shopify orders
- **Real-time Updates**: Updating container ETA automatically updates all connected orders

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (React + TypeScript)
- **Hosting**: Vercel
- **Database + Auth**: Supabase
- **Source Store**: Shopify Admin API
- **Automation**: Make.com / Vercel Edge Functions

## 📋 Prerequisites

1. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **GitHub Account**: For code repository
4. **Shopify Admin Access**: With API permissions

## 🚀 Setup Instructions

### 1. Clone and Install

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `SHOPIFY_STORE_URL`: Your Shopify store URL
- `SHOPIFY_ACCESS_TOKEN`: Your Shopify Admin API token

### 3. Database Setup

Run the SQL migrations in Supabase SQL Editor:

1. Go to your Supabase project → SQL Editor
2. Run the SQL from `supabase/migrations/001_initial_schema.sql`

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
├── app/                    # Next.js 14 App Router
│   ├── (auth)/            # Authentication pages
│   ├── (customer)/        # Customer portal
│   ├── (admin)/           # Admin dashboard
│   └── api/               # API routes
├── components/            # React components
├── lib/                   # Utilities & helpers
│   ├── supabase/          # Supabase client setup
│   └── shopify/           # Shopify API helpers
├── supabase/              # Database migrations
└── types/                 # TypeScript types
```

## 🔐 Authentication

- **Customer Login**: Email + password (via Supabase Auth)
- **Alternative**: Tracking ID + First Name (no login required)
- **Admin**: Protected admin routes with service role

## 🔄 Shopify Integration

The system automatically syncs:
- New orders from Shopify
- Product information
- Customer data
- Order status updates

## 📊 Database Schema

- **containers**: Container information with ETAs
- **products**: Product-to-container mapping
- **orders**: Shopify orders linked to containers
- **customers**: Customer information
- **container_products**: Many-to-many relationship

## 🚢 Deployment

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## 📝 License

Private - Van Soest Living

