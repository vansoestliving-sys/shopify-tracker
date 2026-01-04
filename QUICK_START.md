# Quick Start Guide - Van Soest Living Tracking Portal

## 🚀 For Admin Users

### Login
1. Go to: `https://shopify-tracker-umber.vercel.app/login`
2. Email: `vansoestliving@gmail.com`
3. Password: `vinnie614`
4. Click **Inloggen** (Login)

### First Time Setup (Already Done)
- ✅ Containers synced (11 containers)
- ✅ Products synced from Shopify
- ✅ Orders synced (266 orders)
- ✅ Webhook connected to Shopify

---

## 📋 Daily Tasks

### When a New Container Arrives
1. Dashboard → **Add Container**
2. Enter Container ID (e.g., `LX1470`)
3. Set ETA (delivery date)
4. Status: `confirmed`
5. Click **Save**
6. **Edit** → Add products to container
7. Click **Link Orders** to auto-link existing orders

### When Customer Asks About Their Order
1. Go to **Orders** page
2. Search order number (e.g., `1745`)
3. Check:
   - Container linked? ✅
   - First name filled? ✅
   - Delivery ETA correct? ✅
4. If first name missing:
   - Click **Edit**
   - Add first name
   - Save
5. Tell customer:
   - "Go to `https://shopify-tracker-umber.vercel.app/track`"
   - "Enter Order ID: #1745 and First Name: [name]"
   - "You'll see your delivery date and container status"

### When Shipment is Delayed
1. Go to **Containers** page
2. Find the container
3. Click **Edit**
4. Update **ETA** to new date
5. Save
6. **Result:** All orders in that container now show new date

### When You Add New Products to Shopify
1. Go to **Dashboard**
2. Click **Sync Products from Shopify**
3. Wait for success message
4. Now you can add these products to containers

---

## 🔍 Understanding the Dashboard

### Stats Cards (Top)
```
┌─────────────────┐  ┌─────────────┐  ┌──────────────────────┐  ┌────────────┐
│ Total Orders    │  │ Containers  │  │ Orders Not Linked    │  │ Delivered  │
│      266        │  │     11      │  │         59           │  │     0      │
└─────────────────┘  └─────────────┘  └──────────────────────┘  └────────────┘
```

**What they mean:**
- **Total Orders:** All orders synced from Shopify
- **Containers:** Number of shipping containers
- **Orders Not Linked:** Orders without a container (need attention)
- **Delivered:** Completed orders

### Containers Section
```
Container ID: LX1456
ETA: 15 februari 2025
Status: confirmed
Orders: 45

Actions: [🔗 Link] [✏️ Edit] [🗑️ Delete]
```

**Actions:**
- **🔗 Link Orders:** Auto-link orders with matching products
- **✏️ Edit:** Change container details, add/remove products
- **🗑️ Delete:** Remove container

### Orders Section
```
Order #  Customer  Container  Delivery ETA       Status      Actions
#1745    Lag       LX1456     15 februari 2025   CONFIRMED   [👁️ View] [✏️ Edit]
#1744    N/A       Not linked N/A                CONFIRMED   [👁️ View] [✏️ Edit]
```

**What to fix:**
- **Customer = N/A:** Add first name (edit order)
- **Container = Not linked:** Link to container (edit container products → link orders)

---

## 🎯 Most Common Questions

### "Why isn't my order showing up?"
**Answer:**
1. Check if webhook is working:
   - Go to Shopify Admin → Settings → Notifications → Webhooks
   - Check last webhook status (should be 200)
2. Click **Sync Orders** on dashboard (manual sync)
3. Refresh page

### "Customer can't track their order"
**Answer:**
1. Go to Orders page
2. Find their order
3. Check **Customer First Name** column
4. If empty or wrong:
   - Click **Edit**
   - Add correct first name
   - Save
5. Now customer can track using Order ID + First Name

### "Order says 'Not Linked'"
**Answer:**
1. Find which container has the products from that order
2. Go to Containers page
3. Click **Edit** on that container
4. Make sure products are added to container
5. Click **Save**
6. Click **Link Orders** (chain icon)
7. Order will now link automatically

### "I changed container ETA but order still shows old date"
**Answer:**
1. Hard refresh page: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Check Orders page - should show new ETA
3. If still old, click **Refresh** button on Orders page

### "Can I delete old test orders?"
**Answer:**
Yes! Go to Orders page → Click Edit → Change status to `cancelled` OR go to Supabase directly and delete the row.

---

## 📱 For Customers

### How to Track
1. Go to: `https://shopify-tracker-umber.vercel.app/track`
2. Enter:
   - **Bestelnummer** (Order ID): Found in Shopify email (e.g., `1745`)
   - **Voornaam** (First Name): Your first name (e.g., `Lag`)
3. Click **Volg Bestelling** (Track Order)
4. See:
   - Order details
   - Container ID
   - Estimated delivery date
   - Current status

### What Customers See
```
✅ Order #1745
📦 Container: LX1456
📅 Estimated Delivery: 15 februari 2025
🚢 Status: In Transit (Onderweg)

Order Items:
- Eetkamerstoel Elena (Quantity: 2)
```

---

## 🔄 Automatic Features (No Action Needed)

### Auto-Sync
- ✅ New orders from Shopify → Automatically added to portal
- ✅ Order items → Automatically synced
- ✅ Customer details → Automatically extracted (email + first name)

### Auto-Linking
- ✅ Order with "Eetkamerstoel Elena" → Links to container with that product
- ✅ Delivery ETA → Automatically copied from container
- ✅ Multiple products → Links to container with most matching products

### Auto-Update
- ✅ Change container ETA → All linked orders update
- ✅ Change container status → Reflects on customer tracking

---

## ⚙️ Settings & Admin Users

### Add New Admin
1. Go to **Settings** (gear icon top right)
2. Enter email and password
3. Click **Create Admin**
4. New admin can now log in

### Main Admin Protected
- Email: `vansoestliving@gmail.com`
- **Cannot be deleted** (system protection)

---

## 🌟 Tips & Best Practices

### Keep First Names Accurate
- Customer tracking REQUIRES first name
- For old orders (~250), manually add first names when customers ask
- New orders (from Jan 3, 2026) automatically have first names ✅

### Update ETAs Regularly
- When supplier gives new dates, update container ETA
- All orders update automatically
- Customers see latest delivery date

### Link Products to Containers
- When creating/editing container, ALWAYS add products
- This enables auto-linking
- Saves time vs. manually linking each order

### Use Filters
- **Not Linked** filter → Find orders that need attention
- **Pending** filter → See orders waiting for confirmation
- **Search** → Find specific order quickly

### Monitor "Orders Not Linked"
- Dashboard shows count (currently 59)
- These orders need containers assigned
- Either add products to container, or manually link order

---

## 📞 Need Help?

**Common Issues:**
- Orders not syncing → Check webhook in Shopify
- Customer can't track → Add first name to order
- Order not linked → Add products to container
- Page shows old data → Hard refresh (`Ctrl+Shift+R`)

**Technical Support:**
Refer to detailed documentation in `SYSTEM_GUIDE.md`

---

**Quick Links:**
- Customer Portal: https://shopify-tracker-umber.vercel.app
- Admin Login: https://shopify-tracker-umber.vercel.app/login
- Track Page: https://shopify-tracker-umber.vercel.app/track

