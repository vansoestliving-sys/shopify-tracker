# Create Admin User

## Quick Method (Using API)

The easiest way is to use the Settings page:

1. **First, login as any admin** (or use the script below)
2. Go to **Admin Dashboard** → **Settings** (gear icon)
3. Click **"Add New"**
4. Enter:
   - Email: `vasoestliving@gmail.com`
   - Name: `Admin User` (optional)
5. Click **"Create Admin User"**
6. Copy the generated password (or use: `vinnie614`)

## Alternative: Using Script

### Option 1: Node.js Script (Recommended)

1. Install dotenv if needed:
   ```bash
   npm install dotenv
   ```

2. Run the script:
   ```bash
   node scripts/create-admin.js
   ```

### Option 2: Direct API Call

You can also create the admin user by calling the API directly:

```bash
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vasoestliving@gmail.com",
    "name": "Admin User",
    "password": "vinnie614"
  }'
```

Or use the browser console:
```javascript
fetch('/api/admin/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'vansoestliving@gmail.com',
    name: 'Admin User',
    password: 'vinnie614'
  })
}).then(r => r.json()).then(console.log)
```

## Login Credentials

- **Email**: `vasoestliving@gmail.com`
- **Password**: `vinnie614`
- **Login URL**: `http://localhost:3000/login` (select **Admin** tab)

## Troubleshooting

If you get "User already exists":
- The user is already created, just use the credentials above to login

If you get "Database tables not found":
- Run the migration in Supabase SQL Editor: `supabase/migrations/001_initial_schema.sql`

