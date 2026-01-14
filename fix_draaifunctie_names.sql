-- Fix old "draaifunctie" product names to match current Shopify naming
-- This updates all variations to the current standard name

-- First, let's see what variations exist
SELECT DISTINCT name, COUNT(*) as count
FROM order_items
WHERE LOWER(name) LIKE '%draaifunctie%'
GROUP BY name
ORDER BY count DESC;

-- Update all draaifunctie variations to the current standard name
-- Change "draaifunctie" to "180 graden draaifunctie - met back to place mechanisme"
UPDATE order_items
SET name = '180 graden draaifunctie - met back to place mechanisme',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%draaifunctie%'
  AND LOWER(name) NOT LIKE '%180 graden%';

-- Verify the update
SELECT DISTINCT name, COUNT(*) as count
FROM order_items
WHERE LOWER(name) LIKE '%draaifunctie%'
GROUP BY name
ORDER BY count DESC;

-- Show how many were updated
SELECT COUNT(*) as total_updated
FROM order_items
WHERE LOWER(name) LIKE '%draaifunctie%'
  AND updated_at > NOW() - INTERVAL '1 minute';

