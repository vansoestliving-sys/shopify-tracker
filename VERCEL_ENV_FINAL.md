# Vercel Environment Variables - Final List

## ✅ Add These to Vercel (Settings → Environment Variables)

### Required:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SHOPIFY_STORE_URL=your_store_url
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
```

### Optional:
```
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret (only if using webhooks)
ADMIN_SECRET_KEY=your_admin_secret (optional, for extra API protection)
```

## ❌ DO NOT Add:
- `NEXT_PUBLIC_ADMIN_SECRET` - **REMOVED** - No longer needed

## Changes Made:
- ✅ Removed client-side `NEXT_PUBLIC_ADMIN_SECRET` usage
- ✅ API routes now rely on Supabase session auth (via middleware)
- ✅ No secrets exposed to browser

## Ready to Deploy:
1. Add variables above to Vercel
2. Push code
3. Deploy

