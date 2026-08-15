import { mkdir, writeFile } from "node:fs/promises";
import { movieList } from "../lib/movies.js";

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

const rows = Object.entries(movieList).flatMap(([category, movies]) =>
  movies.map((movie) => ({ ...movie, category })),
);

const inserts = rows.map((movie, index) =>
  `(${movie.id}, ${sqlString(movie.category)}, ${sqlString(movie.name)}, NULL, NULL, NULL, ${sqlString(movie.image)}, NULL, ${index + 1})`,
).join(",\n  ");

const migration = `PRAGMA foreign_keys = ON;

CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('movies', 'series', 'cartoons', 'documentaries')),
  title_ru TEXT NOT NULL,
  title_en TEXT,
  description_ru TEXT,
  description_en TEXT,
  poster_path TEXT NOT NULL,
  release_year INTEGER,
  collection_order INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX movies_category_order_idx ON movies (category, collection_order);

CREATE TABLE movie_progress (
  movie_id INTEGER PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unwatched'
    CHECK (status IN ('unwatched', 'planned', 'watching', 'watched', 'dropped')),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  last_watched_at TEXT,
  watch_count INTEGER NOT NULL DEFAULT 0 CHECK (watch_count >= 0),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX movie_progress_status_idx ON movie_progress (status);
CREATE INDEX movie_progress_favorite_idx ON movie_progress (is_favorite);
CREATE INDEX movie_progress_last_watched_idx ON movie_progress (last_watched_at DESC);

CREATE TABLE watch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  watched_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (movie_id, watched_at)
);

CREATE INDEX watch_history_movie_date_idx ON watch_history (movie_id, watched_at DESC);

INSERT INTO movies (
  id, category, title_ru, title_en, description_ru, description_en,
  poster_path, release_year, collection_order
) VALUES
  ${inserts};
`;

await mkdir("migrations", { recursive: true });
await writeFile("migrations/0001_initial.sql", migration, "utf8");

console.log(`Generated migrations/0001_initial.sql with ${rows.length} movies.`);

