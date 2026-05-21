-- Assignment-level expert/reviewer chat for fast issue resolution.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS assignment_comments (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignment_comments_assignment_created
  ON assignment_comments(assignment_id, created_at);
