-- Migration: Add support for split orders across multiple containers
-- This allows orders to be partially allocated to multiple containers
-- The delivery_eta will be the latest date among all containers

-- Create order_container_allocations table to track split allocations
CREATE TABLE order_container_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL, -- Normalized product name
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id, container_id, product_name)
);

-- Indexes for performance
CREATE INDEX idx_order_allocations_order ON order_container_allocations(order_id);
CREATE INDEX idx_order_allocations_container ON order_container_allocations(container_id);
CREATE INDEX idx_order_allocations_product ON order_container_allocations(product_name);

-- Function to update updated_at timestamp
CREATE TRIGGER update_order_allocations_updated_at BEFORE UPDATE ON order_container_allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update order delivery_eta when split across containers
-- This calculates the latest ETA among all containers the order is allocated to
CREATE OR REPLACE FUNCTION update_order_eta_from_allocations()
RETURNS TRIGGER AS $$
DECLARE
  latest_eta DATE;
BEGIN
  -- Get the latest ETA from all containers this order is allocated to
  SELECT MAX(c.eta) INTO latest_eta
  FROM order_container_allocations oca
  JOIN containers c ON c.id = oca.container_id
  WHERE oca.order_id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Update the order's delivery_eta if we found containers
  IF latest_eta IS NOT NULL THEN
    UPDATE orders
    SET delivery_eta = latest_eta,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update order ETA when allocations change
CREATE TRIGGER update_order_eta_on_allocation_change
  AFTER INSERT OR UPDATE OR DELETE ON order_container_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_order_eta_from_allocations();

-- Function to update order ETA when container ETA changes (for split orders)
CREATE OR REPLACE FUNCTION update_split_orders_eta_on_container_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.eta IS DISTINCT FROM NEW.eta THEN
    -- Update all orders that have allocations to this container
    UPDATE orders
    SET delivery_eta = (
      SELECT MAX(c.eta)
      FROM order_container_allocations oca
      JOIN containers c ON c.id = oca.container_id
      WHERE oca.order_id = orders.id
    ),
    updated_at = NOW()
    WHERE id IN (
      SELECT DISTINCT order_id
      FROM order_container_allocations
      WHERE container_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update split orders when container ETA changes
CREATE TRIGGER update_split_orders_on_container_eta_change
  AFTER UPDATE OF eta ON containers
  FOR EACH ROW
  WHEN (OLD.eta IS DISTINCT FROM NEW.eta)
  EXECUTE FUNCTION update_split_orders_eta_on_container_change();

-- RLS Policy for order_container_allocations
ALTER TABLE order_container_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access order_allocations"
  ON order_container_allocations FOR ALL
  USING (auth.role() = 'service_role');

