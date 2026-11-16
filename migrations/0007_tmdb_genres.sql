-- v7: TMDB references and non-destructive genre metadata.
-- All legacy movies remain intact; metadata starts empty until exact TMDB reconciliation.
ALTER TABLE movies ADD COLUMN tmdb_id INTEGER;
ALTER TABLE movies ADD COLUMN tmdb_media_type TEXT CHECK (tmdb_media_type IN ('movie','tv') OR tmdb_media_type IS NULL);
ALTER TABLE movies ADD COLUMN genre_ids TEXT NOT NULL DEFAULT '[]';
CREATE INDEX movies_tmdb_reference_idx ON movies(tmdb_media_type,tmdb_id);
