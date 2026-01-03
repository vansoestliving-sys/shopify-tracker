-- Import Containers and Products Data
-- This script imports the container list with products and quantities

-- First, insert containers with their ETAs
-- Note: Dates are approximate based on Dutch delivery descriptions
INSERT INTO containers (container_id, eta, status) VALUES
  ('LX1414', '2024-12-31', 'in_transit'),  -- Container 1: levering rond eind december
  ('LX1422', '2024-12-31', 'in_transit'),  -- Container 2: levering rond eind december
  ('LX1427', '2025-01-31', 'in_transit'),  -- Container 3: levering eind januari
  ('LX1439', '2025-01-15', 'in_transit'),  -- Container 4: begin januari
  ('LX1456', '2025-02-15', 'in_transit'),  -- Container 5: levering rond midden februari
  ('LX1456-2', '2025-02-15', 'in_transit'),  -- Container 6: levering rond midden februari (duplicate ID, adding -2)
  ('LX1459', '2025-02-15', 'in_transit'),  -- Container 7: levering rond midden februari
  ('CONTAINER-8', '2025-05-15', 'pending'),  -- Container 8: levering midden mei (no ID provided)
  ('CONTAINER-9', '2025-05-15', 'pending'),  -- Container 9: levering midden mei (no ID provided)
  ('CONTAINER-10', '2025-05-15', 'pending'), -- Container 10: levering midden mei (no ID provided)
  ('CONTAINER-11', '2025-05-15', 'pending')  -- Container 11: levering midden mei (no ID provided)
ON CONFLICT (container_id) DO NOTHING;

-- Insert products (using EAN as SKU for now, will need to match with Shopify products later)
-- Note: All products have the same EAN in the data (8.72089E+12 = 8720890000000)
-- You'll need to update these with actual Shopify product IDs after syncing

-- Eetkamerstoel Elena
INSERT INTO products (shopify_product_id, name, sku) VALUES
  (0, 'Eetkamerstoel Elena', '8720890000000-ELENA')  -- Placeholder product_id, update after Shopify sync
ON CONFLICT (shopify_product_id) DO UPDATE SET name = EXCLUDED.name, sku = EXCLUDED.sku;

-- Eetkamerstoel Maxim
INSERT INTO products (shopify_product_id, name, sku) VALUES
  (0, 'Eetkamerstoel Maxim', '8720890000000-MAXIM')  -- Placeholder product_id, update after Shopify sync
ON CONFLICT (shopify_product_id) DO UPDATE SET name = EXCLUDED.name, sku = EXCLUDED.sku;

-- Eetkamerstoel Jordan
INSERT INTO products (shopify_product_id, name, sku) VALUES
  (0, 'Eetkamerstoel Jordan', '8720890000000-JORDAN')  -- Placeholder product_id, update after Shopify sync
ON CONFLICT (shopify_product_id) DO UPDATE SET name = EXCLUDED.name, sku = EXCLUDED.sku;

-- Eetkamerstoel Rosalie
INSERT INTO products (shopify_product_id, name, sku) VALUES
  (0, 'Eetkamerstoel Rosalie', '8720890000000-ROSALIE')  -- Placeholder product_id, update after Shopify sync
ON CONFLICT (shopify_product_id) DO UPDATE SET name = EXCLUDED.name, sku = EXCLUDED.sku;

-- Draaifunctie
INSERT INTO products (shopify_product_id, name, sku) VALUES
  (0, 'Draaifunctie', '8720890000000-DRAAI')  -- Placeholder product_id, update after Shopify sync
ON CONFLICT (shopify_product_id) DO UPDATE SET name = EXCLUDED.name, sku = EXCLUDED.sku;

-- Now link products to containers with quantities
-- Container 1 (LX1414)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 150
FROM containers c, products p
WHERE c.container_id = 'LX1414' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 150
FROM containers c, products p
WHERE c.container_id = 'LX1414' AND p.name = 'Eetkamerstoel Maxim'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 150
FROM containers c, products p
WHERE c.container_id = 'LX1414' AND p.name = 'Eetkamerstoel Jordan'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 120
FROM containers c, products p
WHERE c.container_id = 'LX1414' AND p.name = 'Eetkamerstoel Rosalie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1414' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 2 (LX1422)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'LX1422' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1422' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 3 (LX1427)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 150
FROM containers c, products p
WHERE c.container_id = 'LX1427' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 150
FROM containers c, products p
WHERE c.container_id = 'LX1427' AND p.name = 'Eetkamerstoel Maxim'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 150
FROM containers c, products p
WHERE c.container_id = 'LX1427' AND p.name = 'Eetkamerstoel Jordan'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 120
FROM containers c, products p
WHERE c.container_id = 'LX1427' AND p.name = 'Eetkamerstoel Rosalie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1427' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 4 (LX1439)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'LX1439' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1439' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 5 (LX1456)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'LX1456' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1456' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 6 (LX1456-2)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'LX1456-2' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1456-2' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 7 (LX1459)
-- Note: Original data shows both 200 and 150 for Eetkamerstoel Jordan - using 200
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 200
FROM containers c, products p
WHERE c.container_id = 'LX1459' AND p.name = 'Eetkamerstoel Jordan'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'LX1459' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 8 (CONTAINER-8)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-8' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-8' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 9 (CONTAINER-9)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-9' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-9' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 10 (CONTAINER-10)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-10' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-10' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Container 11 (CONTAINER-11)
INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 540
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-11' AND p.name = 'Eetkamerstoel Elena'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

INSERT INTO container_products (container_id, product_id, quantity)
SELECT c.id, p.id, 400
FROM containers c, products p
WHERE c.container_id = 'CONTAINER-11' AND p.name = 'Draaifunctie'
ON CONFLICT (container_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

