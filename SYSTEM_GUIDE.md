# Van Soest Living - Order Tracking System Guide

## 🌐 Portal URLs

### Customer Portal (Public)
**Homepage:**
```
https://shopify-tracker-umber.vercel.app
```

**Direct Tracking Page:**
```
https://shopify-tracker-umber.vercel.app/track
```

**What customers can do:**
- Enter **Order ID** (e.g., #1745) + **First Name** (e.g., "Lag")
- View order status, container, estimated delivery date
- See order items with quantities
- Track container status (Pending, Confirmed, In Transit, Delivered)

---

### Admin Dashboard (Private)
**Login Page:**
```
https://shopify-tracker-umber.vercel.app/login
```

**Admin Credentials:**
```
Email: vansoestliving@gmail.com
Password: vinnie614
```

**Dashboard:**
```
https://shopify-tracker-umber.vercel.app/admin
```

---

## 🔄 How The System Works

### Automatic Order Flow

1. **Customer places order on Shopify**
2. **Shopify webhook fires** → Sends order data to portal
3. **System extracts:**
   - Order ID (e.g., #1745)
   - Customer email
   - Customer first name
   - Products ordered (with quantities)
4. **Auto-linking happens:**
   - System checks which container has the matching products
   - Links order to that container automatically
   - Sets delivery ETA from container ETA
5. **Customer can now track:**
   - Using Order ID + First Name on `/track` page
   - See current container status and delivery estimate

### Product-Container Linking

**How it works:**
- Each **container** has **products** assigned to it
- When a new order comes in with those products, it **auto-links** to that container
- Example:
  - Container `LX1456` has product "Eetkamerstoel Elena"
  - Customer orders "Eetkamerstoel Elena"
  - Order automatically links to `LX1456`
  - Customer sees: "Estimated Delivery: 15 februari 2025" (container's ETA)

---

## 📊 Admin Dashboard Pages

### 1. Dashboard (Homepage)
**URL:** `/admin`

**What you see:**
- **Total Orders:** 266 (all synced orders)
- **Containers:** 11 (total containers)
- **Orders Not Linked:** 59 (orders without a container)
- **Delivered:** 0 (completed orders)

**Features:**
- **Stats Cards:** Quick overview of system status
- **Containers Section:**
  - List of all containers with ETA, status, order count
  - Actions: Link Orders, Edit, Delete
- **All Orders Section:**
  - Recent orders table (Order #, Customer, Container, Delivery ETA, Status)
  - Search orders
  - View/Edit order details
- **Sync Buttons:**
  - **Sync Orders from Shopify:** Manually sync orders (only needed for initial setup)
  - **Sync Products from Shopify:** Add new products from Shopify store

**Actions:**
- **Link Orders** (chain icon on container):
  - Automatically links all unlinked orders that have products matching that container
  - Shows success message: "Linked X order(s) to container [ID]"
- **Edit** (pencil icon): Modify container details
- **Delete** (trash icon): Remove container
- **View Order** (eye icon): See full order details
- **Edit Order** (pencil icon): Modify order details

---

### 2. Containers Page
**URL:** `/admin/containers`

**Purpose:** Manage shipping containers and their products

**Features:**
- **Add Container:** Create new container with ID, ETA, status
- **Edit Container:**
  - Click edit icon on any container
  - Change container ID, ETA, status
  - **Add/Remove Products:** Select which products are in this container
  - **Product quantities:** Set how many of each product
- **Link Orders:** Auto-link orders based on products
- **Delete Container:** Remove container (unlinks all orders first)

**Container Statuses:**
- `pending` - Waiting to ship
- `confirmed` - Confirmed by supplier
- `in_transit` - On the way
- `delivered` - Arrived

**How to add products to container:**
1. Click **Edit** icon on container
2. In the modal, scroll to **Container Products** section
3. Select products from dropdown (synced from Shopify)
4. Enter quantity for each product
5. Click **Save**
6. Now, any new order with those products will auto-link to this container

---

### 3. Orders Page
**URL:** `/admin/orders`

**Purpose:** View and manage all orders

**Features:**
- **Filter Orders:**
  - **All:** Shows all orders (266)
  - **Not Linked:** Shows orders without a container (59)
  - **Pending/Confirmed/In Transit/Delivered:** Filter by status
- **Search:** Search by order number or email
- **Pagination:** Browse through orders (10 per page)
- **Refresh:** Manually refresh data from database
- **Bulk Update:** (Future feature)

**Order Table Columns:**
- **Order #:** Shopify order number (e.g., #1745)
- **Customer:** Customer first name (or "N/A" if missing)
- **Container:** Container ID (or "Niet gekoppeld" = Not linked)
- **Delivery ETA:** Expected delivery date (or "N/A")
- **Status:** Order status (Pending, Confirmed, etc.)
- **Actions:** View (eye icon), Edit (pencil icon)

**How to edit an order:**
1. Click **Edit** icon (pencil)
2. Modify:
   - Customer Email
   - **Customer First Name** (important for tracking)
   - Status
   - Delivery ETA
   - Container (link to specific container)
3. Click **Save**

**Why edit an order?**
- Add missing first name (for old orders)
- Manually link to a different container
- Update delivery date
- Change status

---

### 4. Settings Page
**URL:** `/admin/settings`

**Purpose:** Manage admin users

**Features:**
- **View all admin users**
- **Add new admin:**
  1. Enter email and password
  2. Click **Create Admin**
  3. New admin can now log in
- **Delete admin:**
  - Click **Delete** on any admin
  - **Note:** Main admin (`vansoestliving@gmail.com`) cannot be deleted (protected)

---

## 🔧 Common Admin Tasks

### Task 1: Add a New Container
**When:** New shipment confirmed from supplier

**Steps:**
1. Go to **Dashboard** or **Containers** page
2. Click **Add Container**
3. Enter:
   - Container ID (e.g., `LX1460`)
   - ETA (expected arrival date)
   - Status (usually `confirmed` or `pending`)
4. Click **Save**
5. Now, **Edit** the container to add products:
   - Click **Edit** icon
   - Scroll to **Container Products**
   - Select products that are in this container
   - Enter quantities
   - Click **Save**

**Result:** Any new orders with those products will auto-link to this container.

---

### Task 2: Sync New Products from Shopify
**When:** You add new products to Shopify store

**Steps:**
1. Go to **Dashboard**
2. Scroll to **Sync Data** section
3. Click **Sync Products from Shopify**
4. Wait for "Successfully synced X products"
5. Now these products are available to assign to containers

---

### Task 3: Fix "Not Linked" Orders
**When:** Orders show "Not linked" even though they have products

**Why this happens:**
- Products in the order are not assigned to any container yet
- OR the order was placed before you set up containers

**Steps:**
1. Go to **Containers** page
2. Find the container that should have these products
3. Click **Edit** on that container
4. Add the missing products to that container
5. Click **Save**
6. Go back to **Containers** page
7. Click **Link Orders** (chain icon) on that container
8. System will auto-link all matching orders

**Result:** Orders now show the correct container and ETA.

---

### Task 4: Update Container ETA
**When:** Shipment is delayed or arriving early

**Steps:**
1. Go to **Containers** page
2. Click **Edit** on the container
3. Change the **ETA** date
4. Click **Save**

**Result:** All orders linked to this container now show the new delivery date.

---

### Task 5: Manually Add an Order
**When:** Order wasn't synced from Shopify, or you need to add a test order

**Steps:**
1. Go to **Orders** page
2. Click **Bestelling Toevoegen** (Add Order) button (top right)
3. Fill in the form:
   - **Bestelnummer** (Order Number): Required (e.g., `1750`)
   - **Klant E-mail**: Optional
   - **Klant Voornaam** (First Name): **Required** for tracking
   - **Status**: Select from dropdown (default: In afwachting)
   - **Container**: Optional - leave empty for auto-linking, or select manually
   - **Leverings-ETA**: Optional - will be copied from container if linked
   - **Totaalbedrag**: Optional
   - **Producten**: Click "Product toevoegen" to add products with quantities
4. Click **Bestelling Toevoegen**

**What happens:**
- Order is created in database
- Order items are created
- If products match a container, order **auto-links** to that container
- Delivery ETA is set from container
- Order appears in orders list immediately

**Result:** Order is now in the system and can be tracked by customers.

---

### Task 6: Fix Old Orders Missing First Name
**When:** Customer calls asking about their order, but tracking doesn't work

**Why:** Old orders (before webhook) don't have first name synced due to Shopify limitations

**Steps:**
1. Go to **Orders** page
2. Search for the order number (e.g., #1742)
3. Click **Edit** (pencil icon)
4. In **Customer First Name** field, enter the customer's first name
5. Click **Save**

**Result:** Customer can now track using Order ID + First Name.

---

### Task 7: Manually Link an Order to a Container
**When:** Order is not auto-linking correctly

**Steps:**
1. Go to **Orders** page
2. Find the order
3. Click **Edit** (pencil icon)
4. In **Container** dropdown, select the correct container
5. (Optional) Set **Delivery ETA** to match container ETA
6. Click **Save**

**Result:** Order now shows the container and delivery date.

---

## ⚠️ Current Limitations

### Old Orders (Before Jan 3, 2026)
**Issue:** ~250+ old orders are missing customer first name

**Why:** Shopify Basic plan doesn't provide customer PII (email, first name) for orders placed before webhook was set up

**What you see:**
- Orders synced successfully
- Products are there
- BUT: Customer field shows email or is empty
- First name field is empty

**Solution:**
1. For important orders, manually add first name:
   - Go to Orders page
   - Click Edit on the order
   - Add first name
   - Save
2. For customer inquiries:
   - Ask customer for their order ID and first name
   - Add first name to the order manually
   - They can now track

**Good news:** All new orders (from Jan 3, 2026 onward) automatically have first name and email. No manual edits needed.

---

### Product Sync
**How it works:**
- Products must be synced from Shopify first
- Click "Sync Products" on dashboard
- Then assign products to containers

**Note:** If you add a new product to Shopify, remember to sync it to the portal before assigning it to a container.

---

## 🎯 Filters Explained

### Orders Page Filters

**All:**
- Shows all orders (266 total)
- Includes linked and unlinked orders
- All statuses

**Not Linked:**
- Shows orders without a container (59 total)
- These orders need to be linked to a container
- Either manually (edit order) or automatically (add products to container → link orders)

**Pending:**
- Orders with status = `pending`
- Usually newly placed orders waiting for confirmation

**Confirmed:**
- Orders with status = `confirmed`
- Order is confirmed, container is being prepared

**In Transit:**
- Orders with status = `in_transit`
- Container is on the way

**Delivered:**
- Orders with status = `delivered`
- Container arrived, order complete

---

## 📱 Customer Experience

### How customers track their order:

1. **Go to tracking page:**
   - `https://shopify-tracker-umber.vercel.app/track`
   
2. **Enter details:**
   - **Order ID:** Found in Shopify order confirmation email (e.g., #1745)
   - **First Name:** Their first name (e.g., "Lag")

3. **Click "Track Order"**

4. **See results:**
   - Order number
   - Customer name
   - Container ID (e.g., LX1456)
   - Estimated Delivery Date (e.g., 15 februari 2025)
   - Container Status (Confirmed, In Transit, etc.)
   - Order Items (products + quantities)

5. **If not found:**
   - Message: "Order not found. Please check your order ID and first name."
   - Reason: Order not synced, or first name is missing/incorrect

---

## 🔐 Security & Privacy

**Customer Portal:**
- Public access (no login required)
- Customers can ONLY see their own order
- Must provide Order ID + First Name (verification)
- No sensitive data exposed (no full address, payment info)

**Admin Dashboard:**
- Login required
- Credentials: `vansoestliving@gmail.com` / `vinnie614`
- Can view all orders, containers, customers
- Can edit/delete data
- Protected routes (middleware authentication)

**Data:**
- All data stored in Supabase (secure PostgreSQL database)
- Row Level Security (RLS) enabled
- API routes protected with authentication

---

## 🌍 Custom Domain (Optional)

You can connect your own domain later, e.g.:
- `track.vansoestliving.nl` (customer portal)
- `admin.vansoestliving.nl` (admin dashboard)

**Requirements:**
- Access to your domain DNS settings (e.g., GoDaddy, Namecheap, Cloudflare)
- Add CNAME record pointing to Vercel

**OR keep current Vercel URL** - up to you!

---

## 🚀 Quick Reference

### URLs
```
Customer Portal:  https://shopify-tracker-umber.vercel.app
Track Page:       https://shopify-tracker-umber.vercel.app/track
Admin Login:      https://shopify-tracker-umber.vercel.app/login
Admin Dashboard:  https://shopify-tracker-umber.vercel.app/admin
```

### Admin Credentials
```
Email:    vansoestliving@gmail.com
Password: vinnie614
```

### Key Features
- ✅ Automatic order sync from Shopify
- ✅ Auto-linking orders to containers
- ✅ Customer self-service tracking
- ✅ Real-time ETA updates
- ✅ Product-container management
- ✅ Order filtering and search
- ✅ Admin user management

### Workflow Summary
1. **Add container** → Set ETA
2. **Add products** to container
3. **New order comes in** from Shopify
4. **Auto-links** to container
5. **Customer tracks** using Order ID + First Name
6. **Update container ETA** → All orders update
7. **Mark as delivered** when arrived

---

## 📞 Support

For technical issues or questions, contact your developer or check the documentation files:
- `SETUP.md` - Initial setup guide
- `VERCEL_SETUP.md` - Deployment guide
- `SHOPIFY_SETUP.md` - Shopify integration
- `WEBHOOK_SETUP.md` - Webhook configuration
- `VERCEL_CACHE_FIX.md` - Troubleshooting cache issues

---

**System Version:** 1.0  
**Last Updated:** January 4, 2026  
**Status:** ✅ Production Ready

