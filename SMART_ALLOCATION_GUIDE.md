# Smart Order Allocation - Quantity-Based Linking

## 🎯 How It Works

The **Smart Allocate** feature links orders chronologically based on **available quantities** in each container, not just product matching.

### Example:

**Container 1 (LX1414):**
- 150x Elena
- 120x Rosalie

**Orders (chronological):**
1. Order #1001: 4x Elena, 4x Draaifunctie → Links to Container 1 (Elena: 146 remaining)
2. Order #1002: 6x Elena → Links to Container 1 (Elena: 140 remaining)
3. Order #1003: 8x Rosalie → Links to Container 1 (Rosalie: 112 remaining)
4. Order #1004: 150x Elena → **Skipped** (not enough Elena in Container 1)
5. Order #1005: 10x Elena → Links to Container 2 (if it has Elena)

---

## 🚀 How to Use

### Step 1: Unlink All Orders (Fresh Start)

Run this SQL in Supabase:

\`\`\`sql
UPDATE orders SET container_id = NULL, delivery_eta = NULL, updated_at = NOW() WHERE container_id IS NOT NULL;
\`\`\`

### Step 2: Set Up Container Quantities

1. Go to **Containers** page
2. For each container:
   - Click **Edit**
   - Select products
   - **Set quantities** (e.g., Elena: 150, Maxim: 150, Draaifunctie: 400)
   - Click **Save**

### Step 3: Run Smart Allocation

1. Go to **Admin Dashboard** (homepage)
2. Click **"Slim Toewijzen"** (green button next to "Add Container")
3. Confirm the action
4. Wait for allocation to complete

### Step 4: Check Results

- Success message: "✅ X bestellingen toegewezen!"
- Skipped orders: Orders that couldn't be allocated due to insufficient stock
- Check browser console (F12) for inventory status: `📦 Resterende voorraad per container`

---

## 📋 Allocation Logic

### Order Processing:
1. Fetches all **unlinked orders** (chronologically, oldest first)
2. For each order:
   - Calculates required quantities per product
   - Finds the first container with enough stock for **ALL products**
   - Links the order to that container
   - Deducts quantities from container inventory
3. Skips orders if no container has enough stock

### Example:
- Order has: 4x Elena, 2x Maxim
- Container 1 has: 150x Elena, 0x Maxim → **Can't fulfill** (missing Maxim)
- Container 2 has: 540x Elena, 150x Maxim → **Can fulfill** → Links to Container 2

---

## ⚠️ Important Notes

### Chronological Order:
- Orders are processed by `created_at` (oldest first)
- This ensures Container 1 gets the oldest orders, Container 2 gets the next batch, etc.

### All-or-Nothing:
- An order is only linked if the container has enough stock for **ALL products** in that order
- If an order has 4x Elena + 2x Maxim, the container must have at least 4x Elena AND 2x Maxim

### Skipped Orders:
- Orders are skipped if:
  - No items in the order
  - No container has enough stock for all products
- Skipped orders remain unlinked and can be manually assigned later

### Inventory Tracking:
- The system tracks remaining quantities as it allocates
- Check browser console for final inventory status after allocation

---

## 🔧 Troubleshooting

### "0 bestellingen toegewezen"
- Check that containers have products with quantities set
- Check that there are unlinked orders (run unlink SQL first)
- Check browser console for detailed logs

### "X bestellingen overgeslagen (geen voorraad)"
- Some orders couldn't be allocated due to insufficient stock
- Check which products are missing by viewing skipped orders
- Add more containers or increase quantities

### Orders linked to wrong container
- Make sure you unlinked all orders first (Step 1)
- Make sure container quantities are correct
- Re-run Smart Allocation

---

## 🆚 Difference from Old "Link Orders" Button

### Old Method (Per-Container):
- Clicked "Link Orders" on each container individually
- Linked orders based on product matching only
- Didn't track quantities
- Result: All orders with Elena linked to Container 1, even if it only had 150 pcs

### New Method (Smart Allocate):
- One button for all containers
- Links orders chronologically
- Tracks quantities and deducts as it allocates
- Result: Container 1 gets first 150 Elena orders, Container 2 gets the next batch

---

## 📊 After Allocation

### Check Results:
1. Go to **Orders** page
2. Filter by "Not Linked" to see skipped orders
3. Check container assignments in the "Container" column
4. Verify delivery ETAs are set correctly

### Manual Adjustments:
- You can still manually edit orders if needed
- Click the edit icon on any order to change its container
- Use the "Link Orders" button on individual containers if you want to re-link specific orders

---

## 🎉 Benefits

✅ **Accurate**: Links based on actual quantities, not just product names
✅ **Chronological**: Oldest orders get priority
✅ **Efficient**: One click to allocate all orders
✅ **Transparent**: Shows remaining inventory after allocation
✅ **Safe**: Skips orders instead of over-allocating

---

## 📞 Support

If you encounter issues:
1. Check browser console (F12) for detailed logs
2. Check Supabase database to verify container quantities
3. Re-run unlink SQL and try again
4. Contact support if the issue persists

