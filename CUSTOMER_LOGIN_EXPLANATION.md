# Customer Login - How It Works

## 🔄 Automatic Account Creation

### How It Works
1. **Order placed in Shopify** → Customer data synced to database
2. **Customer in database** → Can login immediately
3. **First login** → Auth account created automatically
4. **No signup needed** → Everything is automatic!

## 📋 Login Flow

### For Customers with Orders
1. Customer enters **email** (from their Shopify order)
2. System checks if customer exists in database
3. If exists:
   - **With password**: Login directly
   - **Without password**: Magic link sent to email
4. Auth account created automatically on first login
5. Customer sees their orders immediately

### For Customers Without Orders
- Message shown: "Account will be created when order is synced"
- Can use tracking page with Tracking ID + First Name

## 🎯 Login Options

### Option 1: Password Login
- Customer sets password on first login
- Uses email + password for future logins

### Option 2: Magic Link (Passwordless)
- Customer leaves password empty
- Magic link sent to email
- Click link to login automatically

## ✅ Benefits

- **No signup required** - Account created automatically
- **Seamless experience** - Works with Shopify orders
- **Secure** - Uses Supabase Auth
- **Flexible** - Password or magic link

## 🔐 Security

- Customers can only see their own orders (RLS)
- Email must match Shopify order email
- Magic links expire after use
- Password requirements enforced

## 📝 Summary

**Customers don't need to sign up!** Their account is automatically created when:
- Order is synced from Shopify (webhook or manual sync)
- Customer tries to login for the first time

The system connects Shopify → Database → Auth seamlessly! 🎉

