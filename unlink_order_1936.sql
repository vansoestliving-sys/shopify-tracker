-- Unlink order #1936 to allow re-allocation with split logic
-- This removes both the old container_id link and any split allocations
-- Handles order numbers with or without "#" prefix

-- First, delete any split allocations for this order
DELETE FROM order_container_allocations
WHERE order_id IN (
  SELECT id FROM orders 
  WHERE shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 1936
);

-- Then unlink the order (set container_id and delivery_eta to NULL)
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 1936;

-- Verify the order is unlinked
SELECT 
  shopify_order_number,
  container_id,
  delivery_eta,
  created_at
FROM orders
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 1936;

