-- Unlink orders from LX1439 that are causing over-allocation
-- Specifically: 180 Graden Draaifunctie is over-allocated (420 allocated vs 398 total)
-- Strategy: Unlink orders from LX1439 that have draaifunctie items, starting with newest orders (preserve FIFO)

-- Step 1: Find orders in LX1439 that have draaifunctie items
-- We'll unlink the newest orders first to preserve FIFO (older orders stay linked)

WITH over_allocated_orders AS (
  SELECT DISTINCT o.id, o.shopify_order_number, o.created_at
  FROM orders o
  INNER JOIN containers c ON o.container_id = c.id
  INNER JOIN order_items oi ON o.id = oi.order_id
  WHERE c.container_id = 'LX1439'
    AND LOWER(oi.name) LIKE '%draaifunctie%'
  ORDER BY o.created_at DESC  -- Newest first (unlink newest to preserve FIFO)
  LIMIT 50  -- Safety limit - adjust if needed
)
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE id IN (SELECT id FROM over_allocated_orders);

-- Verify: Check remaining allocated draaifunctie in LX1439
SELECT 
  'LX1439 Draaifunctie' as check_type,
  COUNT(DISTINCT o.id) as linked_orders_with_draaifunctie,
  SUM(oi.quantity) as total_allocated_draaifunctie
FROM orders o
INNER JOIN containers c ON o.container_id = c.id
INNER JOIN order_items oi ON o.id = oi.order_id
WHERE c.container_id = 'LX1439'
  AND LOWER(oi.name) LIKE '%draaifunctie%';

-- Show unlinked orders
SELECT 
  shopify_order_number,
  created_at,
  'Unlinked from LX1439' as action
FROM orders
WHERE 
  container_id IS NULL
  AND id IN (
    SELECT o.id
    FROM orders o
    INNER JOIN order_items oi ON o.id = oi.order_id
    WHERE LOWER(oi.name) LIKE '%draaifunctie%'
  )
ORDER BY created_at DESC
LIMIT 20;

