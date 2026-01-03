-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Containers table
CREATE TABLE containers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_id VARCHAR(100) UNIQUE NOT NULL,
  eta DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'in_transit' CHECK (status IN ('pending', 'in_transit', 'arrived', 'delayed', 'delivered')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table (links to Shopify products)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id BIGINT UNIQUE NOT NULL,
  shopify_variant_id BIGINT,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Container-Product mapping (many-to-many)
CREATE TABLE container_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(container_id, product_id)
);

-- Customers table (synced from Shopify)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_customer_id BIGINT UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table (synced from Shopify)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_order_id BIGINT UNIQUE NOT NULL,
  shopify_order_number VARCHAR(50),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_first_name VARCHAR(100),
  container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  delivery_eta DATE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  total_amount DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'EUR',
  tracking_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items (products in each order)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  shopify_product_id BIGINT,
  shopify_variant_id BIGINT,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users (for admin dashboard access)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_containers_container_id ON containers(container_id);
CREATE INDEX idx_containers_eta ON containers(eta);
CREATE INDEX idx_products_shopify_id ON products(shopify_product_id);
CREATE INDEX idx_container_products_container ON container_products(container_id);
CREATE INDEX idx_container_products_product ON container_products(product_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_shopify_id ON customers(shopify_customer_id);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_container ON orders(container_id);
CREATE INDEX idx_orders_tracking_id ON orders(tracking_id);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update order delivery_eta when container ETA changes
CREATE OR REPLACE FUNCTION update_orders_eta_on_container_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.eta IS DISTINCT FROM NEW.eta THEN
    UPDATE orders
    SET delivery_eta = NEW.eta,
        updated_at = NOW()
    WHERE container_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update orders when container ETA changes
CREATE TRIGGER update_orders_on_container_eta_change
  AFTER UPDATE OF eta ON containers
  FOR EACH ROW
  WHEN (OLD.eta IS DISTINCT FROM NEW.eta)
  EXECUTE FUNCTION update_orders_eta_on_container_change();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Customers can only see their own orders
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  USING (
    auth.uid()::text IN (
      SELECT id::text FROM customers WHERE email = auth.jwt() ->> 'email'
    )
    OR
    customer_email = (auth.jwt() ->> 'email')
  );

-- Customers can view their own customer record
CREATE POLICY "Customers can view own customer record"
  ON customers FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access"
  ON containers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access orders"
  ON orders FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access products"
  ON products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access customers"
  ON customers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access container_products"
  ON container_products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access order_items"
  ON order_items FOR ALL
  USING (auth.role() = 'service_role');

