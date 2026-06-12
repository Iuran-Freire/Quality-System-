CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'inspetor',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'IQC',
  pn VARCHAR(120),
  model VARCHAR(120),
  client VARCHAR(120),
  supplier VARCHAR(120),
  resp VARCHAR(120),
  active BOOLEAN NOT NULL DEFAULT true,

  n INTEGER DEFAULT 5,
  box_qty INTEGER DEFAULT 2,

  sampling JSONB DEFAULT '{}'::jsonb,
  chars JSONB DEFAULT '[]'::jsonb,

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY,

  plan_id TEXT,
  plan_name TEXT,

  type VARCHAR(30) DEFAULT 'IQC',

  pn TEXT,
  model TEXT,
  client TEXT,
  supplier TEXT,

  lot TEXT,
  invoice TEXT,
  lot_size INTEGER,
  shift TEXT,
  resp TEXT,
  obs TEXT,

  pallet TEXT,
  reinspection BOOLEAN DEFAULT false,
  reinspection_reason TEXT,

  status VARCHAR(30) DEFAULT 'draft',
  result VARCHAR(30),

  started_at TIMESTAMP,
  finished_at TIMESTAMP,

  created_by TEXT,
  created_by_user TEXT,
  created_by_role TEXT,

  updated_by TEXT,
  updated_by_user TEXT,
  updated_by_role TEXT,

  finished_by TEXT,
  finished_by_user TEXT,
  finished_by_role TEXT,

  plan_samples INTEGER DEFAULT 5,
  plan_box_qty INTEGER DEFAULT 2,
  box_qty INTEGER DEFAULT 2,

  sampling JSONB DEFAULT 'null'::jsonb,
  chars JSONB DEFAULT '[]'::jsonb,
  samples JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);