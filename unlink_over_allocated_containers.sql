-- Unlink orders from over-allocated containers (LX1439 and LX1459)
-- Also unlink orders #1850-1882 as they were incorrectly allocated
-- This will allow "Slim toewijzen" to reallocate them correctly

-- Step 1: Unlink all orders from LX1439 (over-allocated: Elena 540/628, Draaifunctie 398/498)
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  container_id IN (
    SELECT id FROM containers WHERE container_id = 'LX1439'
  );

-- Step 2: Unlink all orders from LX1459 (over-allocated: Lucien 150/164)
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  container_id IN (
    SELECT id FROM containers WHERE container_id = 'LX1459'
  );

-- Step 3: Unlink orders #1850-1882 (affected orders from 2 days ago)
UPDATE orders
SET 
  container_id = NULL,
  delivery_eta = NULL,
  updated_at = NOW()
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) >= 1850
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) <= 1882;

-- Verify the updates
-- Check LX1439
SELECT 
  'LX1439' as container,
  COUNT(*) as remaining_linked_orders
FROM orders
WHERE 
  container_id IN (
    SELECT id FROM containers WHERE container_id = 'LX1439'
  );

-- Check LX1459
SELECT 
  'LX1459' as container,
  COUNT(*) as remaining_linked_orders
FROM orders
WHERE 
  container_id IN (
    SELECT id FROM containers WHERE container_id = 'LX1459'
  );

-- Check orders #1850-1882 (should all be NULL)
SELECT 
  shopify_order_number,
  container_id,
  delivery_eta
FROM orders
WHERE 
  shopify_order_number IS NOT NULL
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) >= 1850
  AND CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) <= 1882
ORDER BY CAST(REPLACE(shopify_order_number, '#', '') AS INTEGER) ASC;

-- Expected result: All should show container_id = NULL after running this SQL

