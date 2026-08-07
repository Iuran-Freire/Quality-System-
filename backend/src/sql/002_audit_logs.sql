CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action VARCHAR(20) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id TEXT,
  route TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  user_id TEXT,
  user_name TEXT,
  username TEXT,
  access_level INTEGER,
  inspection_area VARCHAR(10),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs (created_at DESC);
