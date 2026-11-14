-- Movie Catalog v5: explicit viewing cycles for series, additive and reversible via backup.
CREATE TABLE series_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('watching','completed','stopped')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((outcome='watching' AND ended_at IS NULL) OR (outcome!='watching' AND ended_at IS NOT NULL))
);
ALTER TABLE season_viewings ADD COLUMN cycle_id INTEGER REFERENCES series_cycles(id) ON DELETE SET NULL;
-- There is no reliable historical boundary between older season viewings.
-- Preserve all older entries inside one clearly labelled legacy cycle per series.
INSERT INTO series_cycles(movie_id,started_at,ended_at,outcome)
SELECT movie_id,MIN(started_at),MAX(COALESCE(finished_at,started_at)),'completed'
FROM season_viewings GROUP BY movie_id;
UPDATE season_viewings SET cycle_id=(
 SELECT id FROM series_cycles WHERE movie_id=season_viewings.movie_id
) WHERE cycle_id IS NULL;
CREATE UNIQUE INDEX series_cycles_one_open_idx ON series_cycles(movie_id) WHERE outcome='watching';
CREATE INDEX season_viewings_cycle_idx ON season_viewings(cycle_id,season_number,finished_at DESC);
