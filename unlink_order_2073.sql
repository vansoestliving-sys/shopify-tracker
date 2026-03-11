-- Unlink order #2073 and clean up stale allocation records
-- This order was incorrectly split across CONTAINER-10 + LX1427 + LX1456-2
-- due to stale allocation records from a previous allocation

-- Step 1: Delete stale allocation records
DELETE FROM order_container_allocations
WHERE order_id = (
  SELECT id FROM orders
  WHERE shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 2073
);

-- Step 2: Unlink the order
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 2073;

-- Step 3: Verify
SELECT 
  shopify_order_number,
  container_id,
  delivery_eta,
  created_at
FROM orders
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 2073;

-- Verify no allocation records remain
SELECT * FROM order_container_allocations
WHERE order_id = (
  SELECT id FROM orders
  WHERE shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 2073
);
