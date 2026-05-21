-- Production core schema for https://тупа.рф/expert.
-- Cloudflare D1 executes this migration through GitHub Actions before Worker deploy.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'expert',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_areas_json TEXT NOT NULL DEFAULT '[]',
  credentials_text TEXT NOT NULL DEFAULT '',
  certificates_text TEXT NOT NULL DEFAULT '',
  wants_reviewer INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'expert',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  required_area TEXT,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  accent TEXT NOT NULL DEFAULT 'teal',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  task_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  stored_status TEXT NOT NULL DEFAULT 'queued',
  revision INTEGER NOT NULL DEFAULT 0,
  due_at TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  payload_json TEXT NOT NULL,
  draft_json TEXT NOT NULL DEFAULT '{}',
  submission_json TEXT,
  review_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_drafts (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email_created ON otp_challenges(email, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

CREATE TABLE IF NOT EXISTS agent_threads (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  messages_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO projects (id, name, summary, required_area, task_type, status, accent, created_at) VALUES
  ('civil-classification', 'Классификация обращения', 'Определение правовой области, категории риска и маршрута обработки.', 'Гражданское право', 'classification', 'active', 'teal', '2026-05-21T00:00:00.000Z'),
  ('rubric-legal-answer', 'Оценка правового ответа', 'Рубричная проверка полноты, точности и применимости правового анализа.', 'Арбитраж', 'rubric_scorecard', 'active', 'amber', '2026-05-21T00:00:00.000Z'),
  ('pairwise-analysis', 'Сравнение двух заключений', 'Выбор более качественного экспертного заключения с обоснованием.', 'Налоговое право', 'pairwise_preference', 'active', 'blue', '2026-05-21T00:00:00.000Z'),
  ('triplet-similarity', 'Близость правовых позиций', 'Определение текста, который ближе к эталонной правовой позиции.', 'Интеллектуальные права', 'triplet_similarity', 'active', 'violet', '2026-05-21T00:00:00.000Z');
