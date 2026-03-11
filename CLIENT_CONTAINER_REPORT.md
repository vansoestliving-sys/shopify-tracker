# Container tool – client report (March 2026)

## 1. "Totaal Bestellingen" capped at 1000

**Cause:** The admin orders API only requested the first 1000 orders from the database. So the dashboard showed at most 1000 and any older orders were missing from the list and from allocation.

**Fix:** The API now loads **all** orders in batches of 1000. After deploy:
- "Totaal Bestellingen" will show the real total (e.g. 1500+ if you have that many).
- "Sync Data" and "Slim toewijzen" (allocate-orders) also use all orders, so nothing is skipped because of a 1000 limit.

---

## 2. Orders #2371 and #2372 not linked to LX1459

**Possible causes:**

1. **1000 limit (now fixed)**  
   If total orders were above 1000, these could have been outside the set that was loaded. After the fix above, they are included when you run "Slim toewijzen" or link from Container Voorraad.

2. **LX1459 is delivered**  
   In the app, LX1459 has status `delivered`. The allocation logic **does not** assign new orders to delivered containers. So #2371 and #2372 will not be auto-linked to LX1459 by "Slim toewijzen".  
   If they should be on LX1459 for business reasons, link them manually:
   - Go to **Container Voorraad** → open **LX1459** → use the link/link-orders flow for that container, or  
   - Use the admin order table to set container to LX1459 for #2371 and #2372.

3. **Product match**  
   Linking only considers orders whose items match the container’s products. If #2371/#2372 have no (or different) products than LX1459 (e.g. no Eetkamerstoel Sofia/Lucien/Jordan that LX1459 has), they won’t be suggested for LX1459.

**What to do:** After deploying the 1000-limit fix, run "Slim toewijzen" once. If #2371 and #2372 still don’t link to LX1459, link them manually to LX1459 from Container Voorraad or the order table, or confirm whether they should go to another container.

---

## 2b. "I linked orders but Toegewezen / Resterend didn't update after refresh"

**Cause:** Product names in order items (e.g. "Jordan") were matched exactly to container product names (e.g. "Eetkamerstoel Jordan"), so the count didn't find a match.

**Fix:** Container Voorraad now uses **normalized name matching**: same logic as the allocation tool, and we also match when one name contains the other (e.g. "Jordan" matches "Eetkamerstoel Jordan"). After deploy, linking orders and clicking **Vernieuwen** should correctly increase Toegewezen and decrease Resterend.

**Flow:** In Container Voorraad, open the container (e.g. LX1459) → click **"Link bestellingen"** to attach unlinked orders that match that container's products → click **Vernieuwen** on the main page to refresh the table. No manual stock change needed.

---

## 2c. Unlink / space in CRM

**Unlink:** To unlink an order from a container: go to **Admin → Bestellingen**, open the order (edit), set **Container** to *"Geen container"*, and save. The order is then unlinked and allocation records for that order are cleared.

**Link from Container Voorraad:** When viewing a container's orders (click container name), use **"Link bestellingen"** to link unlinked orders that match that container's products. Then use **Vernieuwen** on the main Container Voorraad page to see updated Toegewezen/Resterend.

---

## 3. Order #2120: Container 20 in Voorraad vs Container 13 on order

**If you see the full 4 pcs for #2120 under container 20:** The app shows only what is in the database for that container. So in `order_container_allocations` that order has **4 pcs allocated to container 20** (and possibly nothing for container 13). The split was either never created correctly (all quantity went to one container) or data was changed.

**What we changed:** In Container Voorraad we always use allocation data for that container; numbers shown = quantity allocated to this container only. Note added: "Bij splitbestellingen tonen we alleen de hoeveelheid die aan deze container is toegewezen." If #2120 should be split: unlink it, run "Slim toewijzen" again, or correct `order_container_allocations` manually.

- **Container 20 view** = “orders that have stock from container 20” → includes #2120.
- **Order #2120** = “main” container 13 + split to container 20.

**UI change:** The admin order table now shows **all** containers for split orders (e.g. "Container 13, Container 20" with a SPLIT badge) so it’s clear an order is on multiple containers.

---

## Summary

| Issue | Cause | Fix |
|-------|--------|-----|
| Totaal Bestellingen stuck at 1000 | API only fetched 1000 orders | API now fetches all orders in batches |
| #2371, #2372 not on LX1459 | 1000 limit and/or LX1459 delivered (no auto-link to delivered) | Use all orders + manual link to LX1459 if needed |
| #2120 shows Container 20 in one place, 13 in another | Split order: allocated to both 13 and 20 | Correct; order detail and table now show both containers |
