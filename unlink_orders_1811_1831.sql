-- Unlink orders #1811 to #1831 (set container_id and delivery_eta to NULL)
-- This works regardless of whether orders are currently linked or unlinked
-- Handles order numbers with or without "#" prefix

UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) >= 1811
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) <= 1831;

-- Verify the update
SELECT 
  shopify_order_number,
  container_id,
  delivery_eta,
  created_at
FROM orders
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) >= 1811
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) <= 1831
ORDER BY CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) ASC;

