# Vercel Deployment Guide

## 1. Verify Git Setup

```bash
# Check .gitignore includes .env files (already done)
cat .gitignore | grep env

# Add and commit changes
git add .
git commit -m "Prepare for Vercel deployment"

# Push to GitHub
git push origin main
```

## 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. Import from GitHub: `vansoestliving-sys/shopify-tracker`
4. Vercel auto-detects Next.js settings
5. Click **"Deploy"**

## 3. Set Environment Variables in Vercel

After first deployment, go to **Settings → Environment Variables** and add:

### Required Variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SHOPIFY_STORE_URL=your_store_url (e.g., i50v-e1.myshopify.com)
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret (if using webhooks)
ADMIN_SECRET_KEY=your_admin_secret (optional, for production)
```

### For Each Environment:
- Add to **Production**, **Preview**, and **Development** (or just Production)

## 4. Redeploy

After adding env variables:
- Go to **Deployments** tab
- Click **"Redeploy"** on latest deployment
- Or push a new commit to trigger auto-deploy

## 5. Configure Webhook (Optional)

If using Shopify webhooks:
1. In Vercel, copy your deployment URL: `https://your-app.vercel.app`
2. In Shopify Admin → Settings → Notifications → Webhooks
3. Add webhook: `https://your-app.vercel.app/api/webhooks/shopify`
4. Use the `SHOPIFY_WEBHOOK_SECRET` you set in Vercel

## Quick Checklist

- [ ] `.env.local` is in `.gitignore` (already done)
- [ ] Code pushed to GitHub
- [ ] Vercel project connected
- [ ] All environment variables added
- [ ] First deployment successful
- [ ] Webhook configured (if needed)

## Troubleshooting

- **Build fails?** Check environment variables are set correctly
- **API errors?** Verify Supabase and Shopify credentials
- **Webhook not working?** Check webhook URL and secret match

