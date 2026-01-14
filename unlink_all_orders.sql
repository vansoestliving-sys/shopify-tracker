-- Unlink all orders from containers
-- This sets container_id and delivery_eta to NULL for all orders
-- Run this in Supabase SQL Editor before re-linking orders

UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE container_id IS NOT NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_orders,
  COUNT(container_id) as linked_orders,
  COUNT(*) - COUNT(container_id) as unlinked_orders
FROM orders;

