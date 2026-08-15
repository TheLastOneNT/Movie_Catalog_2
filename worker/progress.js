export const MOVIE_STATUSES = ["unwatched", "watched"];

const STATUS_SET = new Set(MOVIE_STATUSES);

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeDate(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new ValidationError("The viewing date must be a string or null.");

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) throw new ValidationError("The viewing date is invalid.");
  return date.toISOString();
}

export function normalizeProgressPatch(input, current = {}, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("The request body must be an object.");
  }

  const next = {
    status: current.status || "unwatched",
    rating: current.rating ?? null,
    isFavorite: Boolean(current.isFavorite),
    lastWatchedAt: current.lastWatchedAt || null,
    notes: current.notes || "",
  };

  if (hasOwn(input, "status")) {
    if (!STATUS_SET.has(input.status)) throw new ValidationError("The movie status is invalid.");
    next.status = input.status;
  }

  if (hasOwn(input, "rating")) {
    if (input.rating === null || input.rating === 0) {
      next.rating = null;
    } else if (Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5) {
      next.rating = input.rating;
    } else {
      throw new ValidationError("The rating must be an integer from 1 to 5 or null.");
    }
  }

  if (hasOwn(input, "isFavorite")) {
    if (typeof input.isFavorite !== "boolean") throw new ValidationError("The favorite flag must be boolean.");
    next.isFavorite = input.isFavorite;
  }

  if (hasOwn(input, "lastWatchedAt")) {
    next.lastWatchedAt = normalizeDate(input.lastWatchedAt);
    if (next.lastWatchedAt) next.status = "watched";
  }

  if (hasOwn(input, "notes")) {
    if (typeof input.notes !== "string") throw new ValidationError("Notes must be a string.");
    if (input.notes.length > 5000) throw new ValidationError("Notes cannot exceed 5,000 characters.");
    next.notes = input.notes;
  }

  if (next.status === "watched" && !next.lastWatchedAt) {
    next.lastWatchedAt = now.toISOString();
  }

  if (next.status === "unwatched") {
    next.lastWatchedAt = null;
  }

  return {
    value: next,
    addHistory: Boolean(next.lastWatchedAt && next.lastWatchedAt !== current.lastWatchedAt),
    clearHistory: next.status === "unwatched",
  };
}
