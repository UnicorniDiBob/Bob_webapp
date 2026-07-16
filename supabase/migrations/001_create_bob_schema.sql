-- BACKFILLED 2026-07-16: this migration was applied live on 2026-06-02 but never
-- committed as a file. Recovered verbatim from supabase_migrations.schema_migrations
-- (statements column) so a fresh clone can rebuild the schema from scratch.
-- Do not edit the SQL below — it's a historical record of what actually ran.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CITIES
CREATE TABLE cities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('active', 'coming_soon')),
  created_at timestamptz DEFAULT now()
);

-- 2. SERVICES
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 3. SUBSERVICES
CREATE TABLE subservices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 4. USERS (estende auth.users di Supabase)
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'professional', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- 5. PROFILES
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  phone text,
  about text,
  created_at timestamptz DEFAULT now()
);

-- 6. PROFESSIONALS
CREATE TABLE professionals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES cities(id),
  headline text,
  bio text,
  years_experience smallint,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified')),
  response_time_label text,
  created_at timestamptz DEFAULT now()
);

-- 7. PROFESSIONAL_SERVICES
CREATE TABLE professional_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  subservice_id uuid REFERENCES subservices(id),
  min_price numeric,
  max_price numeric,
  price_note text,
  city_id uuid NOT NULL REFERENCES cities(id)
);

-- 8. RATINGS
CREATE TABLE ratings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES users(id),
  score smallint NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- 9. REQUESTS
CREATE TABLE requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid NOT NULL REFERENCES users(id),
  city_id uuid NOT NULL REFERENCES cities(id),
  service_id uuid NOT NULL REFERENCES services(id),
  subservice_id uuid REFERENCES subservices(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'matched', 'closed')),
  problem_description text,
  urgency text CHECK (urgency IN ('bassa', 'media', 'alta')),
  availability_note text,
  budget_min numeric,
  budget_max numeric,
  created_at timestamptz DEFAULT now()
);

-- 10. REQUEST_PROFESSIONALS
CREATE TABLE request_professionals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES professionals(id),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'contacted', 'responded', 'declined')),
  created_at timestamptz DEFAULT now()
);

-- 11. REQUEST_MESSAGES
CREATE TABLE request_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'professional', 'bob')),
  sender_id uuid,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- INDEXES utili
CREATE INDEX idx_professionals_city ON professionals(city_id);
CREATE INDEX idx_professional_services_professional ON professional_services(professional_id);
CREATE INDEX idx_professional_services_service ON professional_services(service_id);
CREATE INDEX idx_requests_customer ON requests(customer_id);
CREATE INDEX idx_request_professionals_request ON request_professionals(request_id);
CREATE INDEX idx_ratings_professional ON ratings(professional_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies base: lettura pubblica dove opportuno
CREATE POLICY "Public read cities" ON cities FOR SELECT USING (true);
CREATE POLICY "Public read services" ON services FOR SELECT USING (true);
CREATE POLICY "Public read subservices" ON subservices FOR SELECT USING (true);
CREATE POLICY "Public read professionals" ON professionals FOR SELECT USING (true);
CREATE POLICY "Public read professional_services" ON professional_services FOR SELECT USING (true);
CREATE POLICY "Public read ratings" ON ratings FOR SELECT USING (true);

-- RLS policies: utente vede solo i propri dati
CREATE POLICY "User reads own profile" ON profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "User updates own profile" ON profiles FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "User reads own requests" ON requests FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "User inserts own requests" ON requests FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "User reads own request_messages" ON request_messages FOR SELECT
  USING (request_id IN (SELECT id FROM requests WHERE customer_id = auth.uid()));

CREATE POLICY "User reads own request_professionals" ON request_professionals FOR SELECT
  USING (request_id IN (SELECT id FROM requests WHERE customer_id = auth.uid()));
