# Order Sync & Container Linking - How It Works

## ⚠️ Important: How Container Linking Works

### The System Links Orders by **PRODUCTS**, NOT by Order Date

**Key Point:** Orders are linked to containers based on **which products are in the order**, not based on when the order was placed.

**Example:**
- Container 1 (LX1414) has: Elena (150 pcs), Maxim (150 pcs)
- Container 2 (LX1422) has: Elena (540 pcs), Draaifunctie (400 pcs)
- Order #1524 (oldest) has: Elena → Links to Container 1 or 2 (whichever has Elena)
- Order #1745 (newest) has: Maxim → Links to Container 1 (has Maxim)

**The system does NOT:**
- ❌ Link oldest orders to Container 1
- ❌ Link orders chronologically
- ❌ Link based on order number sequence

**The system DOES:**
- ✅ Link orders based on product matching
- ✅ Find the container with the most matching products
- ✅ Auto-link when products match

---

## 🔄 Syncing Orders from Shopify

### Option 1: Sync Recent Orders (Default)
- **Button:** "Sync Orders" (blue)
- **Fetches:** Last 250 orders from Shopify
- **Use when:** You just want recent orders, or testing

### Option 2: Sync ALL Orders (New!)
- **Button:** "Sync All Orders" (orange)
- **Fetches:** ALL orders from Shopify (with pagination)
- **Use when:** You want all 751 orders in the portal
- **Time:** May take 5-10 minutes for 751 orders
- **Note:** Shopify API has rate limits, so it fetches in batches

---

## 📋 Step-by-Step: Setting Up Containers Correctly

### Step 1: Fill in Container Products & Quantities
1. Go to **Containers** page
2. For each container (1-11):
   - Click **Edit**
   - Check products that are in that container
   - Set quantities (e.g., Elena: 150, Maxim: 150)
   - Click **Save**

### Step 2: Link Old Orders
After setting up all containers:
1. Go to **Containers** page
2. For each container:
   - Click **Link Orders** (chain icon)
   - System finds all orders with matching products
   - Links them to that container

### Step 3: Verify
- Go to **Orders** page
- Check that orders are linked to correct containers
- If wrong, edit container products and re-link

---

## ❓ Common Questions

### Q: "Will oldest orders link to Container 1?"
**A:** No. Orders link based on **products**, not order date. If Container 1 has "Elena" and an old order has "Elena", it will link to Container 1.

### Q: "I need all 751 orders synced. How?"
**A:** Click **"Sync All Orders"** button (orange). It will fetch all orders with pagination. This may take 5-10 minutes.

### Q: "After syncing all orders, will they auto-link?"
**A:** Partially:
- **New orders** (from webhook): Auto-link immediately ✅
- **Old orders** (already synced): Need manual "Link Orders" click ⚠️
- **Newly synced orders**: Will auto-link if containers are set up ✅

### Q: "Order #1524 is oldest, but it's linked to Container 11. Why?"
**A:** Because Container 11 has products that match Order #1524. The system doesn't care about order date - only product matching.

### Q: "How do I link orders chronologically?"
**A:** You can't automatically. The system is designed for **product-based** linking. If you need chronological linking, you'd need to:
1. Manually edit each order
2. Select the container manually
3. Or change the system logic (not recommended)

---

## 🎯 Best Practice Workflow

1. **Sync All Orders** (orange button) → Get all 751 orders
2. **Set up containers** → Add products + quantities to each container
3. **Link Orders** → Click "Link Orders" on each container
4. **Verify** → Check orders page, manually fix any wrong links
5. **Done** → New orders will auto-link correctly

---

## 📊 Current Status

- **Synced Orders:** 266 (out of 751)
- **Containers:** 11 (need products assigned)
- **Auto-linking:** Works for new orders (webhook)
- **Manual linking:** Available via "Link Orders" button

---

## 🚀 Next Steps

1. Click **"Sync All Orders"** to get all 751 orders
2. Fill in all containers with correct products + quantities
3. Click **"Link Orders"** on each container
4. Verify results on Orders page
5. New orders will auto-link going forward

---

**Remember:** The system links by **products**, not by order date. This ensures orders go to the right container based on what's actually in the shipment, not when the order was placed.

