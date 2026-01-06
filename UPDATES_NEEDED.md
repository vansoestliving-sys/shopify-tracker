# Updates Needed - Customer Portal Improvements

## 1. ✅ Simplify Customer Track Page
**Request:** Remove container details card and status card. Customers only need to see delivery date.

**Changes:**
- Remove container information display
- Remove status badges/cards
- Keep only: Order number, Customer name, Delivery date

---

## 2. ✅ Add Delivery Information Text
**Request:** Add this text to customer track page:
"Rond het moment dat je bestelling klaar is voor levering, word je telefonisch benaderd door de vervoerder. Samen plannen jullie een definitieve leveringsdag die het beste voor jou uitkomt."

**Location:** Below delivery date on track page

---

## 3. ✅ Auto-Reallocate Orders When Deleted
**Request:** When an order is deleted from a container, all newer orders in that container should shift up to fill the gap.

**Example:**
- Container X1 has: Order 1222, 1223, 1224, 1225
- Delete Order 1222
- Result: Order 1223 moves to 1222's position, 1224 moves to 1223's position, etc.

**Why:** Maintains chronological order and fairness. New customers shouldn't get earlier delivery dates.

**Implementation:**
- When order is deleted, check if it was linked to a container
- Find all orders in that container with later `created_at` dates
- Re-run allocation logic for those orders (they'll shift up)

---

## 4. ✅ Show "Delivery in Few Days" for Past Dates
**Request:** If container ETA is in the past (already arrived), show "Levering binnen enkele dagen" instead of the past date.

**Logic:**
- If `delivery_eta < today`: Show "Levering binnen enkele dagen"
- If `delivery_eta >= today`: Show the actual date

---

## 5. ⏳ Delivery Date on Product Pages (Future)
**Request:** Show delivery date on product pages in Shopify, linked to the software.

**Note:** This requires Shopify app/theme integration. Can be done later.

---

## Priority Order:
1. Simplify track page (remove cards)
2. Add delivery text
3. Show "few days" for past dates
4. Auto-reallocate on delete
5. Product page delivery dates (later)

