-- Add RLS policies for authenticated admin users
-- This allows admin users (logged in via Supabase Auth) to read/write data

-- Allow authenticated users to read containers
CREATE POLICY "Authenticated users can view containers"
  ON containers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage containers"
  ON containers FOR ALL
  TO authenticated
  USING (true);

-- Allow authenticated users to read products
CREATE POLICY "Authenticated users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage products"
  ON products FOR ALL
  TO authenticated
  USING (true);

-- Allow authenticated users to read container_products
CREATE POLICY "Authenticated users can view container_products"
  ON container_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage container_products"
  ON container_products FOR ALL
  TO authenticated
  USING (true);

-- Allow authenticated users to read orders
CREATE POLICY "Authenticated users can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (true);

-- Allow authenticated users to read order_items
CREATE POLICY "Authenticated users can view order_items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage order_items"
  ON order_items FOR ALL
  TO authenticated
  USING (true);

-- Allow authenticated users to read customers
CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (true);

