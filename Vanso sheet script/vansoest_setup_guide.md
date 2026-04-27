# Van Soest Living — Complete System Setup Guide v2.4

---

## PART 1 — SHEET STRUCTURES

### Sheet A: ORDERS SHEET  (GID: 573303195)
> Name it: "Automation sheet voor orders"

| Col | Letter | Header | Notes |
|-----|--------|--------|-------|
| 1 | A | Order ID | Order number, e.g. #12345 |
| 2 | B | Email | Customer email |
| 3 | C | Lineitem Quantity | "4" or "4 - 2" for multiple products |
| 4 | D | Lineitem Name | "Eetkamerstoel Rosalie" or "Rosalie - Jordan" |
| 5 | E | Billing Name | |
| 6 | F | Billing Phone | |
| 7 | G | Shipping Name | |
| 8 | H | Shipping Phone | Used for WhatsApp |
| 9 | I | Shipping Street | |
| 10 | J | Shipping Address2 | |
| 11 | K | Shipping City | |
| 12 | L | Shipping Zip | |
| 13 | M | Shipping Country | "NL" / "BE" — used for phone code |
| 14 | N | Helemaal verwerkt? | Auto-set to "YES" when all items allocated. Can also be typed manually. |
| 15 | O | Allocation Status | Auto: "Rosalie: 4 ✅ \| Jordan: 2 ⏳" |
| 16 | P | Allocation Data | **Internal JSON — hide this column.** {"Rosalie":4} |
| 17 | Q | Batch Date | Auto-filled during allocation |
| 18 | R | Email Trigger | Type **"Send"** → resends Email 1 to customer |
| 19 | S | Status Log | Auto-filled (email/WA log) |
| 20 | T | Preferred Date | Filled by customer via form, or manually |
| 21 | U | WhatsApp Trigger | Type **"Send"** → sends WhatsApp to customer |

**⚠️ Column P (Allocation Data) should be hidden:**
Right-click column P → Hide column. It is internal JSON and must not be edited manually.
Use the menu options (Remove Product / Add Product) for any changes.

**⚠ Columns N, O, P must not be edited manually** except:
- Typing `YES` in col N is allowed and triggers the delivery email sequence automatically.
- Typing a date in col T is allowed and marks the order as complete without sending any email.

**Important — product name rule:**
The name in column D must exactly match the name in ACTION sheet column A.
Use ` - ` (space-dash-space) as separator for multiple products. En-dashes (–) are normalized automatically.

---

### Sheet B: ACTION SHEET  (GID: 955736256)
> Name it: "ACTION"

| Col | Letter | Header | Notes |
|-----|--------|--------|-------|
| 1 | A | Product Name | Must match Orders col D exactly |
| 2 | B | Stock Received | Total units currently in system. Updated by n8n or manually |
| 3 | C | Allocated | **Auto-computed by script. Do not edit manually** |
| 4 | D | Available | Put formula `=MAX(0,B2-C2)` here, copy down for all rows |
| 5 | E | IS_DPD | Type **"DPD"** to mark as small/DPD product |
| 6 | F | Trigger | Type **"Run"** → runs allocation for this product |
| 7 | G | Last Result | Auto-filled result message |
| 8 | H | Last Run Time | Auto-filled timestamp |
| 9 | I | Batch | Optional batch label (text or date) |

**How DPD tagging works:**
- Type `DPD` in col E next to any product that ships via DPD (small items, turn functions, etc.)
- If ALL products in an order are DPD → next workday is auto-filled as delivery date, no email sent
- If order mixes DPD + non-DPD products → normal email flow applies
- DPD auto-dating runs daily at 08:00 and also on every hourly check

**Note on STOCK (col B):**
This column reflects stock currently available in the system — not a cumulative all-time total.
When the fulfillment export runs, shipped quantities are automatically subtracted from col B.
This keeps the available balance accurate so new orders are never over-allocated.

---

## PART 2 — APPS SCRIPT SETUP

### Step 1 — Replace the script

1. Open the Google Spreadsheet
2. Extensions → Apps Script
3. Delete all existing code in Code.gs
4. Paste the entire contents of `vansoest_appscript_v2_fixed.js`
5. Update these values in the `CFG` block at the top:
   - `FULFILLMENT_EMAIL` → actual fulfillment center email
   - `N8N_STOCK_SECRET` → note this value (enter the same in n8n)
   - `WA_WEBHOOK_URL` → confirm correct (already set to n8n.vansoestliving.com)
6. Click Save (Ctrl+S)

### Step 2 — Set up the onEdit installable trigger

In Apps Script editor → click the ⏰ Triggers icon (left sidebar) → + Add Trigger

**Trigger: onEditInstallable**
- Function: `onEditInstallable`
- Deployment: Head
- Event source: From spreadsheet
- Event type: On edit
- Failure notification: Immediately
→ Click Save → authorize when prompted

### Step 3 — Install time-based triggers via menu

1. Open the Google Spreadsheet
2. Reload the page (the custom menu appears after reload)
3. Click **🏠 Van Soest Living → ⏰ Install / Reset Triggers (run once)**
4. Authorize when prompted
5. A confirmation popup appears:
   - `runDailyJobs` → every day 08:00 Amsterdam
   - `checkFollowUps` → every hour (skips weekends automatically)

> ✅ You only need to run this once. If triggers get duplicated or lost, run it again — it removes old ones first.

### Step 4 — Deploy as Web App (for delivery date form + n8n webhooks)

1. In Apps Script editor → Deploy → New deployment
2. Type: Web app
3. Description: "VSL Production v2"
4. Execute as: Me (your account)
5. Who has access: Anyone
6. Click Deploy
7. **Copy the Web App URL** — you need it for:
   - Customer delivery date form (`doPost` URL)
   - n8n stock/return workflow (HTTP Request node target URL)

**⚠️ Every time you make script changes and redeploy, update the URL in:**
- Environment variable `DELIVERY_DATE_WEBHOOK_URL` on the Next.js host (Apps Script web app URL)
- n8n workflow HTTP Request node (stock/return)

### Delivery date POST — Apps Script `handleDeliveryDate`

The public form posts to **Next.js** `POST /api/delivery-date`, which may forward to the Apps Script `doPost` URL. The script **does not** read Supabase; it finds the row by order id and checks **column B (Email)** on that row.

In `vansoest_appscript_v2_fixed.js`, `handleDeliveryDate` already:

- Requires `email` in the JSON body (otherwise error).
- Compares `normalizeEmailForMatch(data.email)` to column B; on mismatch returns `{ success: false, error: "Email does not match this order" }` and does **not** write column T.
- If column T is already filled, returns “Delivery date already filled” (same pattern).

**If n8n posts bezorgdatum directly to the Apps Script web app**, the body must include `email` from the same source as the sheet, for example:

```json
{
  "type": "date",
  "orderId": "2422",
  "deliveryDate": "2026-05-01",
  "formattedDate": "01-05-2026",
  "email": "{{ $json.customer_email }}"
}
```

The Next.js app now also validates `email` against **Supabase** `orders.customer_email` when that order exists, so the tracker cannot store a delivery date for the wrong person when the order is already synced.

---

## PART 3 — AUTOMATION FLOW

### Full automatic flow (no manual action needed)

```
Warehouse sends [STOCK] or [RETURN] email
    ↓
n8n reads email → Claude AI extracts products + quantities
    ↓
n8n HTTP POST → Apps Script doPost
    ↓
Stock written to ACTION sheet (col B) with lock + requestId dedup
    ↓
autoAllocateProduct() runs for each updated product
    ↓
runAllocation() → matches stock to pending orders (in row order)
    ↓
Order fully allocated → VERWERKT = YES
    ↓
autoSendDeliveryRequest():
  • All products DPD → next workday auto-filled in col T (no email)
  • Any non-DPD product → Email 1 sent to customer
    ↓
Customer clicks link → fills in preferred delivery date
    ↓
doPost (type=date) → col T filled in orders sheet
    ↓
08:00 daily: fulfillment Excel exported → emailed → those rows deleted from sheet
             ACTION STOCK decremented for shipped quantities
```

### Hourly check (every hour, workdays only)

Every hour `checkFollowUps` runs and:
1. Scans ACTION sheet for any products with available stock → allocates to pending orders
2. Finds any YES orders with no delivery date yet → sends Email 1 or DPD auto-date (catch-up)
3. Checks all orders in the follow-up sequence:
   - After 24h since Email 1 → sends Email 2 + WhatsApp 1
   - After 24h since Email 2/WA1 → sends WhatsApp 2
   - After 24h since WA2 → sets SENT_LOG to "Bellen" (red)

### Daily 08:00 job (workdays only)

1. Scan & allocate any pending stock
2. Auto-fill next workday for all-DPD orders
3. Export fulfillment Excel → email to logistics → **delete exported rows from sheet**
4. Subtract shipped quantities from ACTION STOCK col B
5. Refresh ALLOCATED counts

---

## PART 4 — MANUAL TEAM OPERATIONS

### What the team can safely do

| Action | How |
|--------|-----|
| Mark order complete + trigger delivery email | Type `YES` in col N → Email 1 or DPD auto-date fires automatically |
| Set delivery date manually (no email) | Type date directly in col T (e.g. `20-04-2026`) |
| Unreachable customer — set date yourself | Type date in col T first, THEN type `YES` in col N → no email fires |
| Resend delivery request email | Type `Send` in col R |
| Resend WhatsApp | Type `Send` in col U |
| Add a product to an existing order | Menu → **➕ Add Product to Order** |
| Remove a product from an existing order | Menu → **✂️ Remove Product from Order** |
| Combine two unallocated orders | Edit cols A–M freely, delete spare row (safe only if col P is empty) |

### ✂️ Remove Product from Order

Use when a product needs to be removed from an already-allocated order.
Example: removing a turn function from a combined order to free it up for standalone turn-function orders.

1. Menu → **🏠 Van Soest Living → ✂️ Remove Product from Order**
2. Enter the row number of the order (number on the left side of the sheet)
3. Enter the exact product name to remove (e.g. `180 Graden Draaifunctie`)
4. Script handles everything:
   - Removes product from col D and col C
   - Removes product from col P (ALLOC_DATA)
   - Recalculates col N (still YES if remaining products are all allocated)
   - Returns freed stock to ACTION sheet col B
   - Refreshes ALLOCATED counts
5. Then click **⚡ Scan & Allocate Pending Stock Now** → freed units go to waiting orders

### ➕ Add Product to Order

Use when a customer adds an extra product to an existing order (e.g. adding a turn function to a chairs order).

1. Menu → **🏠 Van Soest Living → ➕ Add Product to Order**
2. Enter the row number of the order
3. Enter the exact product name to add (e.g. `180 Graden Draaifunctie`)
4. Enter the quantity needed
5. Script handles everything:
   - If stock is available → immediately allocated to this specific order (bypasses the queue)
   - If no stock → product added to order, allocated automatically when stock arrives
   - If order is now fully allocated → delivery email sent automatically

### What must NOT be edited manually

| Column | Why |
|--------|-----|
| **N** (VERWERKT) | Only type `YES` — never clear or edit existing YES entries |
| **O** (Allocation Status) | Script-only, auto-calculated |
| **P** (ALLOC_DATA JSON) | Use menu options for any changes |
| **C in ACTION** (Allocated) | Script-only, auto-calculated |
| **D** (Product name in Orders) | Do not edit after allocation — use ✂️ Remove Product menu instead |

---

## PART 5 — n8n WORKFLOWS

### n8n Workflow 1: Stock & Return Email Parser

**Purpose:** Reads warehouse emails, uses Claude AI to extract product quantities, updates ACTION sheet, labels emails in Gmail.

**Before you start — create these two labels in Gmail:**
Gmail → Settings → See all settings → Labels → Create new label:
- `ALLOCATION DONE`
- `ALLOCATION NOT DONE`

---

**Node 1: Gmail Trigger**
- Search filter: `subject:[STOCK] OR subject:[RETURN] is:unread`
- Download attachments: No
- Simplify output: Yes

---

**Node 2: Set — Capture email metadata**
```
emailId   : {{ $json.id }}
threadId  : {{ $json.threadId }}
fromEmail : {{ $json.from }}
emailBody : {{ $json.text || $json.snippet }}
emailType : {{ $json.subject.toUpperCase().includes('[RETURN]') ? 'return' : 'stock' }}
subject   : {{ $json.subject }}
```

---

**Node 3: HTTP Request — Claude AI extraction**
- Method: POST
- URL: `https://api.anthropic.com/v1/messages`
- Headers:
  - `anthropic-version`: `2023-06-01`
  - `x-api-key`: `{{ $env.ANTHROPIC_API_KEY }}`
  - `Content-Type`: `application/json`
- Body (JSON):
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 500,
  "messages": [
    {
      "role": "user",
      "content": "Extract all product names and quantities from this warehouse email.\n\nSTRICT RULES:\n- Return ONLY raw JSON\n- No explanation, no markdown, no text before or after\n- Output MUST be a valid JSON array\n\nFORMAT: [{\"product\": \"exact product name\", \"quantity\": 40}]\n\nEmail:\n{{ $json.emailBody }}"
    }
  ]
}
```

---

**Node 4: Code — Parse Claude response**
```javascript
const text = $input.first().json.content[0].text?.trim();
if (!text) throw new Error('Empty response from AI');
const match = text.match(/\[[\s\S]*\]/);
if (!match) throw new Error('No JSON array found in response: ' + text);
let parsed;
try { parsed = JSON.parse(match[0]); }
catch(err) { throw new Error('JSON parse failed: ' + match[0]); }
parsed = parsed.map(item => {
  if (!item.product) throw new Error('Missing product field');
  const quantity = Number(item.quantity);
  if (isNaN(quantity)) throw new Error('Invalid quantity for ' + item.product);
  return { product: item.product.trim(), quantity };
});
if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Parsed data is empty');
return [{
  json: {
    items     : parsed,
    type      : $input.first().json.emailType || 'stock',
    requestId : $input.first().json.emailId,
    emailId   : $input.first().json.emailId,
    threadId  : $input.first().json.threadId,
    fromEmail : $input.first().json.fromEmail,
    subject   : $input.first().json.subject,
  }
}];
```

> ⚠️ Always include `requestId` (set to `emailId` or a UUID). The script uses this to prevent duplicate stock writes if n8n retries the request.

---

**Node 5: HTTP Request — Update ACTION sheet via Apps Script**
- Method: POST
- URL: `[YOUR WEB APP URL]`
- Body content type: `JSON`
- Body fields:
  - `type` → `{{ $json.type }}`
  - `secret` → `vsl-stock-2025`
  - `items` → `{{ $json.items }}`
  - `requestId` → `{{ $json.requestId }}`
- Timeout: `180000` ms (3 minutes)

> ⚠️ If you send more than 20 products in one request, stock is saved but allocation is deferred to the next hourly run. The response will include `deferredAllocation: true`. Split large payloads into batches of ≤20 products for best results.

---

**Node 6: Code — Evaluate results & build summary**
```javascript
const results   = items[0].json.results || [];
const notFound  = results.filter(r => r.status === 'not_found');
const updated   = results.filter(r => r.status === 'updated');
let summary = '';
if (updated.length) {
  summary += '✅ Verwerkt:\n';
  updated.forEach(r => { summary += `  • ${r.product}: nieuw totaal voorraad: ${r.newStock}\n`; });
}
if (notFound.length) {
  summary += '\n❌ Niet gevonden in ACTION sheet:\n';
  notFound.forEach(r => { summary += `  • "${r.product}" — naam komt niet overeen\n`; });
}
return [{
  json: {
    allDone   : notFound.length === 0,
    hasErrors : notFound.length > 0,
    notFound, updated, summary,
    emailId   : items[0].json.emailId,
    threadId  : items[0].json.threadId,
    fromEmail : items[0].json.fromEmail,
    subject   : items[0].json.subject,
  }
}];
```

---

**Node 7: Switch — Route on outcome**
- Rule 1: `{{ $json.allDone === true }}` → "Done"
- Rule 2: `{{ $json.hasErrors === true }}` → "Errors"

**Node 8a (Done): Gmail — Add label `ALLOCATION DONE`**

**Node 8b (Errors): Gmail — Add label `ALLOCATION NOT DONE`**

**Node 9b (Errors only): Gmail — Create Draft reply**
```
Hallo,

De volgende producten zijn niet herkend en NIET toegewezen aan de voorraad:

{{ $json.notFound.map(r => '• "' + r.product + '" — niet gevonden in het systeem').join('\n') }}

Wel correct verwerkt:
{{ $json.updated.length > 0 ? $json.updated.map(r => '• ' + r.product + ': nieuw totaal ' + r.newStock).join('\n') : '(geen)' }}

Stuur een nieuw bericht met de exacte productnaam zoals die in het systeem staat.

Met vriendelijke groet,
Van Soest Living
```

**Node 10 (both): Gmail — Mark as read**

---

### n8n Workflow 2: WhatsApp Handler (existing)

Keep as-is. Apps Script sends:
```json
{
  "phone": "+31612345678",
  "orderId": "12345",
  "email": "customer@email.com",
  "messageType": "whatsapp_1",
  "link": "https://app.vansoestliving.nl/bezorgdatum/12345",
  "timestamp": "08-04-2025 14:32"
}
```

---

## PART 6 — WAREHOUSE EMAIL TEMPLATES

### Template 1: New Stock
```
Subject: [STOCK] Container ontvangen - {datum}

- Eetkamerstoel Rosalie: 40
- Eetkamerstoel Jordan: 25
- 180 Graden Draaifunctie: 15
```
- Subject MUST start with `[STOCK]`
- Product names must exactly match ACTION sheet column A

### Template 2: Returns
```
Subject: [RETURN] Retour verwerkt - {datum}

- Eetkamerstoel Mila: 2
```
- Subject MUST start with `[RETURN]`

---

## PART 7 — TEST PLAN

### TEST 1 — Sheet structure
- [ ] Orders sheet has exactly 21 columns (A through U)
- [ ] Column P is hidden
- [ ] ACTION sheet col D has formula `=MAX(0,B2-C2)` in all product rows
- [ ] All product names in ACTION col A match exactly what will appear in Orders col D
- [ ] Apps Script saved and deployed as Web App

### TEST 2 — Allocation (manual trigger)

1. Add test row to Orders sheet: Col A = `#TEST001`, Col C = `2`, Col D = `Eetkamerstoel Rosalie`
2. In ACTION sheet, set Rosalie Stock (col B) = 10
3. Type `Run` in ACTION col F next to Rosalie

Expected:
- [ ] Col F (Trigger) clears itself
- [ ] Col C (Allocated) = 2
- [ ] Col G shows "✅ 2 units allocated to 1 orders."
- [ ] Orders sheet TEST001: Col N = "YES", Col O = "Eetkamerstoel Rosalie: 2 ✅", Col P = `{"Eetkamerstoel Rosalie":2}`

### TEST 3 — Manual YES triggers email

1. Add a real email in col B of a test row with col N empty
2. Make sure col T is empty
3. Type `YES` in col N

Expected:
- [ ] Email 1 arrives at that address within ~30 seconds
- [ ] Col S updated with "Email 1 Sent ..."
- OR if product is DPD: col T gets next workday date, no email

### TEST 4 — Manual date + YES (no email)

1. Type `20-04-2026` in col T of a test row
2. Type `YES` in col N

Expected:
- [ ] No email sent
- [ ] Col S unchanged or empty

### TEST 5 — Email trigger (col R → "Send")

1. Add real email in col B of test row, col S empty, col T empty
2. Type `Send` in col R

Expected:
- [ ] Col R clears itself
- [ ] Col S = "Email 1 Sent ..."
- [ ] Email arrives

### TEST 6 — WhatsApp trigger (col U → "Send")

1. Add valid phone in col H, "NL" in col M
2. Type `Send` in col U

Expected:
- [ ] Col S updated with "WA1 Sent ..."
- [ ] WhatsApp arrives

### TEST 7 — Follow-up sequence

1. In col S of a test row, manually enter: `Email 1 Sent 01-01-2025 10:00`
2. Leave col T empty
3. Menu → 📧 Run Follow-up Check Now

Expected (01-01-2025 is >24h ago):
- [ ] Email 2 sent
- [ ] WhatsApp 1 sent
- [ ] Col S updated

### TEST 8 — Fulfillment export + delete

1. Have at least one order with col N = YES and col T = a date
2. Menu → 📊 Manual Export: Fulfillment File

Expected:
- [ ] Email arrives at FULFILLMENT_EMAIL with Excel attached
- [ ] Exported orders are DELETED from the orders sheet
- [ ] ACTION STOCK decremented by shipped quantities
- [ ] Running export again immediately: "No completed orders — nothing to export"

### TEST 9 — Remove Product from Order

1. Have an allocated order with 2 products
2. Menu → ✂️ Remove Product from Order → enter row + product name

Expected:
- [ ] Product removed from col D and col C
- [ ] Col P JSON updated (product removed)
- [ ] ACTION STOCK for that product increased by freed qty
- [ ] Col N recalculated correctly

### TEST 10 — Add Product to Order

1. Have an allocated order
2. Menu → ➕ Add Product to Order → enter row, product, qty

Expected:
- [ ] Product added to col D and col C
- [ ] If stock available: col P updated, col N = YES, email sent
- [ ] If no stock: product added, shows as waiting in col O

### TEST 11 — n8n stock update

```bash
curl -X POST "[YOUR WEB APP URL]" \
  -H "Content-Type: application/json" \
  -d '{"type":"stock","secret":"vsl-stock-2025","requestId":"test-001","items":[{"product":"Eetkamerstoel Rosalie","quantity":10}]}'
```

Expected:
- [ ] Response: `{"success":true,"results":[...]}`
- [ ] ACTION Rosalie stock increased by 10
- [ ] Sending same request again with same requestId: `{"success":true,"skipped":true}`

### TEST 12 — Weekend guard

1. Temporarily set system date to a Saturday (or check logs from a Saturday run)

Expected:
- [ ] `checkFollowUps` logs "skipped — weekend"
- [ ] `runDailyJobs` logs "skipped — weekend"
- [ ] No emails sent, no exports

---

## PART 8 — DAILY OPERATIONS CHEAT SHEET

| Task | How |
|------|-----|
| New container / returns | Warehouse emails `[STOCK]` or `[RETURN]` — automatic |
| Manually allocate stock to orders | ACTION sheet → type `Run` in col F |
| Check allocation status | Orders sheet col O |
| Mark order complete (triggers email) | Type `YES` in col N |
| Set delivery date manually (no email) | Type date in col T |
| Unreachable customer — date yourself | Type date in col T first, then `YES` in col N |
| Resend delivery email | Type `Send` in col R |
| Resend WhatsApp | Type `Send` in col U |
| Add product to existing order | Menu → ➕ Add Product to Order |
| Remove product from existing order | Menu → ✂️ Remove Product from Order |
| Force allocate pending stock now | Menu → ⚡ Scan & Allocate Pending Stock Now |
| Run follow-up check now | Menu → 📧 Run Follow-up Check Now |
| Fix allocated count display | Menu → 🔄 Refresh Allocated Counts |
| Export fulfillment file manually | Menu → 📊 Manual Export: Fulfillment File |
| Export Stofstaal manually | Menu → 📦 Manual Export: Stofstaal Orders |
| Show hidden rows | Menu → 👁️ Show All Hidden Rows |
| Reinstall triggers | Menu → ⏰ Install / Reset Triggers |

**What happens automatically every hour (workdays only):**
1. Scan for products with available stock → allocate to waiting orders
2. Find YES orders with no delivery date → send Email 1 or DPD auto-date
3. Check follow-up sequence → send Email 2, WA1, WA2 as needed → mark "Bellen" if no response

**What happens automatically every day at 08:00 (workdays only):**
1. Scan & allocate any pending stock
2. Auto-fill next workday for all-DPD orders
3. Export fulfillment Excel → email to logistics → delete exported rows from sheet
4. Subtract shipped quantities from ACTION STOCK

---

## PART 9 — COMMON ERRORS

**"Already allocated. No remaining balance" but orders are empty:**
Orders were deleted or hidden manually without running Refresh first. Use:
1. Menu → 👁️ Show All Hidden Rows (to find hidden rows)
2. Delete them properly, then
3. Menu → 🔄 Refresh Allocated Counts

**ACTION STOCK seems too high or too low after manual changes:**
Run Menu → 🔄 Refresh Allocated Counts to recalculate col C. Then manually correct col B (STOCK) if the physical stock level is different from what the sheet shows.

**"Run" trigger does nothing:**
Check installable trigger `onEditInstallable` exists in Apps Script → Triggers. Must be On Edit type.

**Email not sending after type YES in col N:**
The installable trigger `onEditInstallable` may not be authorized. Re-run it in the Triggers panel.

**n8n timeout (300s exceeded):**
Stock was still saved — the hourly scan will handle allocation within the hour. Add `requestId` to prevent duplicate stock if n8n retries. Split payloads to ≤20 products per request.

**Duplicate "In batch" text in col Q:**
Cosmetic only — safe to clear manually. Fixed in current script version.

**Web App URL changed:**
After redeployment as a new deployment, update the URL in both the customer form and the n8n HTTP Request node.

**"ALLOCATION NOT DONE" label but stock partially updated:**
Expected — some products matched, some didn't. Check Gmail Drafts for pre-written reply listing exactly what worked and what failed.

---

## PART 10 — SCALING NOTES

The system handles 200+ products without code changes:
- ACTION sheet: add one row per product (col A = exact name, col D = `=MAX(0,B-C)` formula)
- Orders sheet: no extra columns needed regardless of product count
- Script dynamically looks up products by name

For large containers (many products in one n8n payload):
- Keep batches to ≤20 products per HTTP request
- Stock is always saved even if allocation is deferred
- Hourly scan handles any deferred allocation within the hour
