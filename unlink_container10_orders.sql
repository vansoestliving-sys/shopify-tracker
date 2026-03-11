-- Unlink orders with Eetkamerstoel Elena from CONTAINER-10
-- These orders were misallocated due to the double-deduction bug
-- Only affects Elena orders — other products in CONTAINER-10 are untouched
-- After running this, re-run "Slim toewijzen" to correctly re-allocate via FIFO

-- Step 1: Check which Elena orders are linked to CONTAINER-10
SELECT 
  o.shopify_order_number,
  o.container_id,
  o.delivery_eta,
  o.created_at,
  oi.name AS product_name,
  oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.container_id = (
  SELECT id FROM containers WHERE container_id = 'CONTAINER-10'
)
AND LOWER(oi.name) LIKE '%elena%'
ORDER BY o.created_at ASC;

-- Step 2: Delete allocation records for these Elena orders
DELETE FROM order_container_allocations
WHERE order_id IN (
  SELECT DISTINCT o.id 
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.container_id = (
    SELECT id FROM containers WHERE container_id = 'CONTAINER-10'
  )
  AND LOWER(oi.name) LIKE '%elena%'
);

-- Step 3: Unlink only the Elena orders from CONTAINER-10
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT o.id 
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.container_id = (
    SELECT id FROM containers WHERE container_id = 'CONTAINER-10'
  )
  AND LOWER(oi.name) LIKE '%elena%'
);

-- Step 4: Verify - check remaining orders in CONTAINER-10
SELECT 
  o.shopify_order_number,
  oi.name AS product_name,
  oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.container_id = (
  SELECT id FROM containers WHERE container_id = 'CONTAINER-10'
)
ORDER BY o.created_at ASC;
