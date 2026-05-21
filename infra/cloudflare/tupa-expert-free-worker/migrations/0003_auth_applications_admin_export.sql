-- Auth, registration applications, and admin export support.

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'password';

ALTER TABLE profiles ADD COLUMN coauthor_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN admin_credentials_text TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS registration_applications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  legal_areas_json TEXT NOT NULL DEFAULT '[]',
  wants_reviewer INTEGER NOT NULL DEFAULT 0,
  coauthor_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT NOT NULL DEFAULT '',
  admin_credentials_text TEXT NOT NULL DEFAULT '',
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registration_applications_status_created
  ON registration_applications(status, created_at);
