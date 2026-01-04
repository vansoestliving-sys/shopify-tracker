# CSV Import Guide - Import All Orders

## Why CSV Import?

If you have 751 orders in Shopify but only 250 are synced, and orders need to link to containers based on products, you need **ALL orders** in the database. CSV import ensures:
- ✅ All orders are imported (not just recent 250)
- ✅ First names are included (critical for tracking)
- ✅ Proper order data structure
- ✅ Can link correctly to containers

---

## CSV Format

Your CSV should have these columns (case-insensitive):

### Required Columns:
- `shopify_order_number` or `order_number` - Order number (e.g., 1001, 1523)
- `customer_first_name` or `first_name` - Customer first name (REQUIRED for tracking)

### Optional Columns:
- `shopify_order_id` or `order_id` - Shopify order ID (numeric)
- `customer_email` or `email` - Customer email
- `status` - Order status (pending, confirmed, in_transit, delivered, cancelled)
- `total_amount` - Order total (numeric)
- `currency` - Currency code (default: EUR)
- `created_at` - Order creation date (ISO format)

### Example CSV:

```csv
shopify_order_number,customer_first_name,customer_email,status,total_amount,currency,created_at
1001,John,john@example.com,delivered,444.55,EUR,2024-01-01T10:00:00Z
1002,Mary,mary@example.com,confirmed,299.99,EUR,2024-01-02T11:00:00Z
1003,Peter,peter@example.com,in_transit,599.50,EUR,2024-01-03T12:00:00Z
```

---

## How to Export from Shopify

### Option 1: Shopify Admin Export
1. Go to Shopify Admin → Orders
2. Click "Export" (top right)
3. Select "All orders" or date range
4. Choose CSV format
5. Download

### Option 2: Manual CSV Creation
Create a CSV with these columns:
- Order Number
- Customer First Name
- Customer Email (optional)
- Status
- Total Amount
- Created Date

---

## How to Import

1. **Go to Orders page** (`/admin/orders`)
2. **Click "CSV Importeren"** (green button, top right)
3. **Select your CSV file**
4. **Preview** - Check first 5 rows to verify format
5. **Click "Importeer Orders"**
6. **Wait** - Import may take 2-5 minutes for 751 orders
7. **Done** - Orders are imported and ready to link

---

## What Happens During Import

1. **Parse CSV** - Reads and validates each row
2. **Create/Update Orders** - Adds new orders or updates existing ones
3. **Create Customers** - Creates customer records if needed
4. **Generate Tracking IDs** - Creates tracking IDs (VSL + order number)
5. **Skip Duplicates** - Won't duplicate existing orders (updates instead)

---

## After Import

1. **Go to Containers page**
2. **Set up containers** - Add products + quantities to each container
3. **Link Orders** - Click "Link Orders" on each container
4. **Verify** - Check Orders page to confirm correct linking

---

## Troubleshooting

### "Geen geldige orders gevonden"
- Check CSV format matches requirements
- Ensure `shopify_order_number` and `customer_first_name` columns exist
- Check CSV encoding (should be UTF-8)

### "Missing first name" errors
- Ensure `customer_first_name` or `first_name` column exists
- Check for empty values in that column

### "Missing order number" errors
- Ensure `shopify_order_number` or `order_number` column exists
- Check for empty values

### Import is slow
- Normal for large files (751 orders = 2-5 minutes)
- Don't close browser during import
- Check browser console for progress

---

## CSV Column Mapping

The system automatically maps these column names (case-insensitive):

| CSV Column | Maps To | Required |
|------------|---------|----------|
| `shopify_order_number`, `order_number` | Order Number | ✅ Yes |
| `customer_first_name`, `first_name` | First Name | ✅ Yes |
| `customer_email`, `email` | Email | ❌ No |
| `shopify_order_id`, `order_id` | Shopify Order ID | ❌ No |
| `status` | Status | ❌ No |
| `total_amount`, `amount` | Total Amount | ❌ No |
| `currency` | Currency | ❌ No |
| `created_at`, `date`, `created` | Created Date | ❌ No |

---

## Example: Full CSV with All Columns

```csv
shopify_order_number,shopify_order_id,customer_first_name,customer_email,status,total_amount,currency,created_at
1001,12340583530841,John,john@example.com,delivered,444.55,EUR,2024-01-01T10:00:00Z
1002,12340583530842,Mary,mary@example.com,confirmed,299.99,EUR,2024-01-02T11:00:00Z
1003,12340583530843,Peter,peter@example.com,in_transit,599.50,EUR,2024-01-03T12:00:00Z
```

---

## Next Steps After Import

1. ✅ All orders imported
2. ✅ First names included
3. ✅ Ready to link to containers
4. Go to Containers page → Set up products → Link Orders

---

**Ready to import?** Send your CSV file and we can help verify the format, or use the import feature directly in the portal!

