# Git Setup Guide

## ✅ Current Status
- Git repository initialized
- Remote connected to: `https://github.com/vansoestliving-sys/shopify-tracker.git`
- Branch set to: `main`

## Update Git User (if needed)

If you want to use a different GitHub account, update:

```bash
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

Or set globally:
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## First Push

1. **Stage all files:**
   ```bash
   git add .
   ```

2. **Commit:**
   ```bash
   git commit -m "Initial commit - Shopify tracking portal"
   ```

3. **Push to GitHub:**
   ```bash
   git push -u origin main
   ```
   
   If the repo already exists on GitHub and has commits:
   ```bash
   git pull origin main --allow-unrelated-histories
   git push -u origin main
   ```

## Authentication

If prompted for credentials:
- **Personal Access Token**: Use GitHub Personal Access Token (not password)
- Create token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Required scopes: `repo` (full control of private repositories)

## Verify Connection

```bash
git remote -v
git config user.name
git config user.email
```

