-- Movie Catalog v4: per-viewing ratings and season viewing periods.
-- Safe additive migration: preserve all existing watches and shared ratings.
ALTER TABLE watch_history ADD COLUMN rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
CREATE TABLE season_viewings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL CHECK (season_number BETWEEN 1 AND 200),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (finished_at IS NULL OR finished_at >= started_at),
  CHECK (finished_at IS NOT NULL OR rating IS NULL)
);
CREATE INDEX season_viewings_movie_season_idx ON season_viewings(movie_id,season_number,started_at DESC);
