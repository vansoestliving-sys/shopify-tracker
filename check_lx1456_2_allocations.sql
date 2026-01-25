-- Check which orders have allocations to LX1456-2
-- This will show what's using those 2 Elena spaces

SELECT 
  o.shopify_order_number,
  o.container_id as order_container_id,
  c.container_id as allocation_container_id,
  oca.product_name,
  oca.quantity,
  o.created_at as order_created_at
FROM order_container_allocations oca
JOIN orders o ON o.id = oca.order_id
JOIN containers c ON c.id = oca.container_id
WHERE c.container_id = 'LX1456-2'
  AND oca.product_name = 'eetkamerstoel elena'
ORDER BY o.created_at ASC;

-- Also check total Elena allocated to LX1456-2
SELECT 
  SUM(oca.quantity) as total_elena_allocated,
  COUNT(DISTINCT oca.order_id) as number_of_orders
FROM order_container_allocations oca
JOIN containers c ON c.id = oca.container_id
WHERE c.container_id = 'LX1456-2'
  AND oca.product_name = 'eetkamerstoel elena';

