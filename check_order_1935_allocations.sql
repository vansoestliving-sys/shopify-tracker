-- Check full allocation for order 1935
-- This will show if it's split across multiple containers

SELECT 
  o.shopify_order_number,
  c.container_id,
  c.eta as container_eta,
  oca.product_name,
  oca.quantity,
  o.container_id as order_primary_container,
  o.delivery_eta as order_delivery_eta
FROM order_container_allocations oca
JOIN orders o ON o.id = oca.order_id
JOIN containers c ON c.id = oca.container_id
WHERE o.shopify_order_number = '1935'
ORDER BY c.eta ASC;

-- Also check what order 1935 needs total
SELECT 
  oi.name,
  oi.quantity
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.shopify_order_number = '1935'
  AND LOWER(oi.name) NOT LIKE '%draaifunctie%'
  AND LOWER(oi.name) NOT LIKE '%turn function%';

