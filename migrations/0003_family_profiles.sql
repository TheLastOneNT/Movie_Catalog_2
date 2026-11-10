-- Family profiles are independent from legacy shared ratings and historical views.
-- Existing watch_history rows remain intact and are marked as unattributed.
CREATE TABLE family_profiles (
  id INTEGER PRIMARY KEY CHECK (id IN (1, 2)),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 32)
);
INSERT INTO family_profiles(id, display_name) VALUES (1, 'Участник 1'), (2, 'Участник 2');

CREATE TABLE member_progress (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES family_profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  wants_to_watch INTEGER NOT NULL DEFAULT 0 CHECK (wants_to_watch IN (0, 1)),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (movie_id, member_id)
);

CREATE TABLE watch_attendance (
  watch_id INTEGER NOT NULL REFERENCES watch_history(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES family_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (watch_id, member_id)
);
CREATE INDEX watch_attendance_member_idx ON watch_attendance(member_id);
