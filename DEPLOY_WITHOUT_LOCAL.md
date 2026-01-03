# Deploy Without Local Installation

If you can't free up disk space, you can deploy directly to Vercel!

## Steps

### 1. Push Code to GitHub (No node_modules needed)

```powershell
# Initialize git (if not done)
git init

# Add .gitignore (already created - excludes node_modules)
git add .

# Commit
git commit -m "Initial commit - Van Soest Living tracking portal"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/vansoestliving-tracking.git
git push -u origin main
```

**Note:** `node_modules` is already in `.gitignore`, so it won't be uploaded.

### 2. Set Up Supabase First

While code is deploying, set up your database:

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to SQL Editor
4. Copy/paste contents of `supabase/migrations/001_initial_schema.sql`
5. Run the migration
6. Copy your project URL and API keys

### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will automatically:
   - Install dependencies (on their servers!)
   - Build the project
   - Deploy it

### 4. Add Environment Variables in Vercel

In Vercel dashboard → Project Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SHOPIFY_STORE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_token
ADMIN_SECRET_KEY=generate_random_string
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
```

### 5. Test Your Deployment

- Visit your Vercel URL
- Test the tracking page
- Test admin dashboard

## Benefits

✅ No local disk space needed
✅ Dependencies install on Vercel's servers
✅ Production-ready environment
✅ Automatic deployments on git push
✅ Free SSL certificate
✅ Global CDN

## Development Workflow

After deployment:
- Make changes locally (just code, no npm install needed)
- Push to GitHub
- Vercel auto-deploys
- Test on Vercel preview URL

## When You Have Space Later

You can always install locally later:
```powershell
npm install
npm run dev
```

But for now, Vercel deployment works perfectly!

