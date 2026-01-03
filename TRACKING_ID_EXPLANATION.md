# Tracking ID System - How It Works

## 🔍 Quick Answer

**Use: Tracking ID + First Name** (current system)

- **Tracking ID**: `VSL{OrderNumber}` (e.g., `VSL123456`)
- **First Name**: Customer's first name for security
- **Why**: Shopify sends order numbers to customers in confirmation emails, so they can easily find their tracking ID

## 📋 How It Works

### 1. **Tracking ID Generation**
- Format: `VSL{Shopify Order Number}`
- Example: Order #123456 → Tracking ID: `VSL123456`
- Generated automatically when order is synced from Shopify

### 2. **Customer Access**
Customers can track orders in two ways:

**Option A: Tracking ID + First Name** (No login required)
- Go to `/track` page
- Enter:
  - Tracking ID: `VSL123456`
  - First Name: `John`
- System verifies both match the order

**Option B: Login** (See all orders)
- Customer logs in with email from their Shopify order
- Sees all their orders automatically

### 3. **What Shopify Sends to Customers**

Shopify **automatically sends** in order confirmation emails:
- ✅ **Order Number** (e.g., `#123456`) - This is what customers see
- ✅ Customer's name
- ❌ NOT the tracking ID (we generate that)

### 4. **Best Practice**

**Recommended**: Tell customers to use their **Order Number** from Shopify email:
- "Your tracking ID is: VSL + your order number"
- Example: "If your order is #123456, your tracking ID is VSL123456"

**Alternative**: You can also:
- Send tracking ID in order confirmation email (via Shopify email template)
- Include it in order notes/tags
- Display it in customer account area

## 🔐 Security

- **Tracking ID alone** = Not secure (anyone could guess)
- **Tracking ID + First Name** = Secure (two-factor verification)
- **Login** = Most secure (email + password)

## 💡 Recommendation

**Current system is best**: Tracking ID + First Name
- Customers already have order number from Shopify
- Easy to remember: `VSL` + order number
- Secure with first name verification
- No need to send separate tracking codes

## 🛠️ Technical Details

- Tracking ID stored in `orders.tracking_id` field
- Format: `VSL{shopify_order_number || shopify_order_id}`
- Case-insensitive matching
- First name matching is case-sensitive (can be made case-insensitive if needed)

