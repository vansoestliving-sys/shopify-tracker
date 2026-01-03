# Troubleshooting Guide

## Disk Space Issue (ENOSPC Error)

If you're getting `ENOSPC: no space left on device` when running `npm install`, here are solutions:

### Quick Fixes

1. **Free Up Disk Space**
   - Delete temporary files: `%TEMP%` folder
   - Empty Recycle Bin
   - Uninstall unused programs
   - Clear browser cache
   - Delete old downloads

2. **Clean npm Cache**
   ```powershell
   npm cache clean --force
   ```

3. **Use Smaller Installation**
   - Install only production dependencies first
   - Or use a different drive if available

### Alternative: Use Vercel for Development

Since you'll deploy to Vercel anyway, you can:

1. **Push to GitHub** (even without node_modules)
2. **Connect to Vercel**
3. **Develop directly on Vercel** with their preview deployments

### Manual Space Cleanup Commands

```powershell
# Clean npm cache
npm cache clean --force

# Clean Windows temp files
Remove-Item -Path "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean npm global packages (if any)
npm list -g --depth=0
```

### Minimum Space Required

- Node modules: ~200-300 MB
- Next.js build: ~100-200 MB
- Total: ~500 MB minimum

### If You Can't Free Space

You can still proceed by:
1. Pushing code to GitHub (without node_modules)
2. Setting up Supabase database
3. Deploying directly to Vercel
4. Vercel will install dependencies automatically

