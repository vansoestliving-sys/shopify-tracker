-- Unlink orders #1850 to #1882
-- Handles order numbers with or without "#" prefix

UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) >= 1850
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) <= 1882;

-- Verify the update
SELECT 
  shopify_order_number,
  container_id,
  delivery_eta,
  created_at
FROM orders
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) >= 1850
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) <= 1882
ORDER BY CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) ASC;

