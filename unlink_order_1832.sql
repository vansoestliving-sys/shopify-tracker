-- Unlink order #1832 (set container_id and delivery_eta to NULL)
-- This order was incorrectly auto-assigned to delivered container LX1414
-- Handles order numbers with or without "#" prefix

UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 1832;

-- Verify the update
SELECT 
  shopify_order_number,
  container_id,
  delivery_eta,
  created_at
FROM orders
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) = 1832;

