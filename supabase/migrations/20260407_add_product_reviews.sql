CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_title TEXT,
  review_body TEXT,
  attachments TEXT[] DEFAULT '{}',
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON product_reviews(customer_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_reviews'
      AND policyname = 'product_reviews_public_select'
  ) THEN
    CREATE POLICY "product_reviews_public_select" ON product_reviews
      FOR SELECT USING (is_visible = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_reviews'
      AND policyname = 'product_reviews_customer_insert'
  ) THEN
    CREATE POLICY "product_reviews_customer_insert" ON product_reviews
      FOR INSERT WITH CHECK (
        customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
      );
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_product_reviews ON product_reviews;
CREATE TRIGGER trg_updated_at_product_reviews
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
