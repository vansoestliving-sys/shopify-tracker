# Vercel Environment Variables Checklist

## ✅ REQUIRED Variables (Must Add to Vercel)

These are **essential** for the app to work:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SHOPIFY_STORE_URL=your_store_url (e.g., i50v-e1.myshopify.com)
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
```

## ⚠️ IMPORTANT Optional Variables

These are **recommended** for full functionality:

```
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
```
**Why:** Needed to verify webhook signatures from Shopify. Without this, webhooks will fail with "Invalid webhook signature" error.

## 🔒 Optional Variables (Not Critical)

```
ADMIN_SECRET_KEY=your_admin_secret
```
**Why:** Optional extra security layer. Not required if using Supabase auth.

## ❌ DO NOT Add

- `NEXT_PUBLIC_ADMIN_SECRET` - Security risk, removed from codebase

## How to Check What's in Your .env.local

Since I can't read your `.env.local` file, please check lines 15-16 and tell me what variables are there. Common ones might be:

- `SHOPIFY_WEBHOOK_SECRET=...` ← **YES, add this to Vercel**
- `ADMIN_SECRET_KEY=...` ← Optional, but can add if you want
- `NEXT_PUBLIC_APP_URL=...` ← Not needed for Vercel (only for local dev)

## Quick Answer

**If lines 15-16 contain `SHOPIFY_WEBHOOK_SECRET`:** 
- ✅ **YES, add it to Vercel** - Required for webhooks to work

**If lines 15-16 contain `ADMIN_SECRET_KEY`:**
- ⚠️ Optional - Only add if you want extra API protection

**If lines 15-16 contain anything else:**
- Tell me what it is and I'll advise

## How to Add to Vercel

1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add each variable
4. Select environment: **Production**, **Preview**, **Development**
5. Click **Save**
6. **Redeploy** (or wait for auto-deploy)

