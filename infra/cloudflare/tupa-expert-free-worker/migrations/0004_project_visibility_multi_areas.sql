-- Project visibility and multi-area routing.

PRAGMA foreign_keys = ON;

ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE projects ADD COLUMN legal_areas_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE assignments ADD COLUMN legal_areas_json TEXT NOT NULL DEFAULT '[]';

UPDATE projects
SET legal_areas_json = CASE
  WHEN required_area IS NOT NULL AND required_area != '' THEN json_array(required_area)
  ELSE '[]'
END
WHERE legal_areas_json = '[]';

UPDATE assignments
SET legal_areas_json = COALESCE(
  (SELECT legal_areas_json FROM projects WHERE projects.id = assignments.project_id),
  '[]'
)
WHERE legal_areas_json = '[]';
