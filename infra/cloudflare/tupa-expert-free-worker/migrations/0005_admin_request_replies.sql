ALTER TABLE admin_requests ADD COLUMN response TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_requests ADD COLUMN responded_by TEXT;
ALTER TABLE admin_requests ADD COLUMN responded_at TEXT;
ALTER TABLE admin_requests ADD COLUMN updated_at TEXT;
