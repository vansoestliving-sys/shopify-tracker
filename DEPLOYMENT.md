# Deployment Guide

## Quick Deploy Checklist

- [ ] Supabase project created and migration run
- [ ] Environment variables configured in Vercel
- [ ] Shopify API token created
- [ ] Domain configured (optional)
- [ ] Test customer login works
- [ ] Test order tracking works
- [ ] Admin dashboard accessible
- [ ] Containers imported
- [ ] Orders synced from Shopify

## Step-by-Step Deployment

### 1. Supabase Setup (5 minutes)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor
4. Run migration from `supabase/migrations/001_initial_schema.sql`
5. Copy project URL and API keys

### 2. GitHub Setup (2 minutes)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/vansoestliving-tracking.git
git push -u origin main
```

### 3. Vercel Deployment (5 minutes)

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import GitHub repository
4. Add environment variables (see SETUP.md)
5. Deploy!

### 4. Shopify Configuration (10 minutes)

1. Create Shopify app (see SETUP.md)
2. Get Admin API token
3. Set up webhook (optional)
4. Update environment variables in Vercel

### 5. Initial Data Import (10 minutes)

1. Access admin dashboard: `https://your-domain.com/admin`
2. Add containers manually OR
3. Use import script (see `scripts/import-containers.ts`)
4. Sync orders from Shopify

### 6. Testing (5 minutes)

1. Test customer login
2. Test tracking page
3. Test admin dashboard
4. Verify order-container linking

## Environment Variables Reference

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Shopify
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
ADMIN_SECRET_KEY=generate_random_string_here
CRON_SECRET=generate_random_string_here
```

## Post-Deployment Tasks

1. **Set up custom domain** (optional)
   - Vercel → Settings → Domains
   - Update `NEXT_PUBLIC_APP_URL`

2. **Configure email redirects in Supabase**
   - Authentication → URL Configuration
   - Add your production URL

3. **Test webhook** (if using)
   - Create test order in Shopify
   - Check Vercel logs to verify webhook received

4. **Set up monitoring**
   - Vercel Analytics (optional)
   - Supabase logs monitoring

## Troubleshooting Deployment

### Build fails

- Check Node.js version (should be 18+)
- Verify all environment variables are set
- Check build logs in Vercel

### API routes not working

- Verify environment variables
- Check Vercel function logs
- Ensure Supabase RLS policies allow service role

### Authentication redirects not working

- Update Supabase redirect URLs
- Check `NEXT_PUBLIC_APP_URL` matches actual domain

## Maintenance

### Daily

- Automatic order sync runs via Vercel Cron (2 AM UTC)

### Weekly

- Review admin dashboard for unlinked orders
- Check container ETAs are up to date

### Monthly

- Review Supabase usage (free tier limits)
- Review Vercel usage (free tier limits)
- Backup database (Supabase → Settings → Database → Backups)

