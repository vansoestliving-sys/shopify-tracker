# Security Notes

## Environment Variables

### ✅ Safe to Expose (NEXT_PUBLIC_)
- `NEXT_PUBLIC_SUPABASE_URL` - Public URL, safe to expose
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Safe IF Row Level Security (RLS) is enabled in Supabase

### ⚠️ Security Risk (Currently Exposed)
- `NEXT_PUBLIC_ADMIN_SECRET` - **NOT SAFE** - Exposed to browser
  - Currently used in client-side API calls
  - Anyone can see this in browser DevTools
  - **Recommendation**: Remove client-side usage, use session-based auth instead

### 🔒 Server-Only (NOT Exposed)
- `SUPABASE_SERVICE_ROLE_KEY` - Never expose! Server-side only
- `SHOPIFY_ACCESS_TOKEN` - Never expose! Server-side only
- `SHOPIFY_WEBHOOK_SECRET` - Never expose! Server-side only
- `ADMIN_SECRET_KEY` - Server-side only (different from NEXT_PUBLIC_ADMIN_SECRET)

## Current Security Trade-off

The `NEXT_PUBLIC_ADMIN_SECRET` is exposed because:
1. Client-side code needs to authenticate API calls
2. Currently using shared secret instead of session-based auth

## Recommended Fix (Future)

Replace client-side secret with session-based authentication:
1. Check user's Supabase auth session on client
2. Server validates session instead of secret
3. Remove `NEXT_PUBLIC_ADMIN_SECRET` entirely

## For Now

- The warning is correct - it's exposing a secret
- Acceptable for development/internal tools
- **NOT recommended for production** without additional security measures
- Consider using Vercel's environment variable protection or IP whitelisting

