"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translations } from "@/lib/i18n";
import { matchesMovieQuery } from "@/lib/search";
import { randomizeMovies, sortOldestWatched } from "@/lib/catalog";

const categoryIds = ["movies", "series", "cartoons", "documentaries"];

const statusOrder = ["unwatched", "watched"];

function Icon({ name, size = 20, filled = false }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></>,
    shuffle: <><path d="M16 3h5v5" /><path d="m4 20 16.5-16.5" /><path d="M21 16v5h-5" /><path d="m15 15 5.5 5.5" /><path d="m4 4 5 5" /></>,
    close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrowLeft: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    arrowRight: <><path d="m9 18 6-6-6-6" /><path d="M5 12h10" /></>,
    film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    cloud: <><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z" /><path d="m9 13 2 2 4-4" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    alert: <><path d="M12 8v5" /><path d="M12 17h.01" /><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    share: <><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 11v9h14v-9" /></>,
  };

  return <svg {...props}>{paths[name]}</svg>;
}

function Stars({ value = 0, onChange, compact = false, label }) {
  return (
    <div className={`stars ${compact ? "starsCompact" : ""}`} aria-label={`${label}: ${value}/5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={star <= value ? "star active" : "star"}
          onClick={(event) => {
            event.stopPropagation();
            onChange?.(star === value ? null : star);
          }}
          aria-label={`${label}: ${star}/5`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function AccessScreen({ mode, language, onLanguageChange, onUnlock, onClose }) {
  const t = translations[language];
  const [accessKey, setAccessKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await onUnlock(accessKey);
    if (!result.ok) setError(result.error || t.access.incorrect);
    setSubmitting(false);
  };

  return (
    <div className="accessPage" role={mode === "checking" ? undefined : "presentation"} onMouseDown={onClose}>
      <div className="accessBackdrop" />
      <div className="accessLanguage" aria-label="Language" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={language === "ru" ? "active" : ""} onClick={() => onLanguageChange("ru")}>RU</button>
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
      </div>
      <section
        className="accessCard"
        role={mode === "checking" ? undefined : "dialog"}
        aria-modal={mode === "checking" ? undefined : true}
        aria-label={t.access.title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {onClose && (
          <button type="button" className="accessClose" onClick={onClose} aria-label={t.access.close}>
            <Icon name="close" size={20} />
          </button>
        )}
        <span className="brandMark accessBrand"><Icon name="film" size={27} /></span>
        <span className="sectionKicker">{t.access.eyebrow}</span>
        {mode === "checking" ? (
          <div className="accessLoading"><span className="spinner" /><p>{t.access.checking}</p></div>
        ) : (
          <>
            <h1>{t.access.title}</h1>
            <p>{mode === "setup" ? t.access.notConfigured : t.access.description}</p>
            {mode !== "setup" && (
              <form onSubmit={submit} className="accessForm">
                <label>
                  <Icon name="lock" size={18} />
                  <input
                    type="password"
                    value={accessKey}
                    onChange={(event) => setAccessKey(event.target.value)}
                    placeholder={t.access.placeholder}
                    autoComplete="current-password"
                    required
                    autoFocus
                  />
                </label>
                <button type="submit" className="primaryButton" disabled={submitting || !accessKey}>
                  {submitting ? <span className="spinner small" /> : <Icon name="chevron" size={18} />}
                  {t.access.submit}
                </button>
              </form>
            )}
            {error && <p className="formError" role="alert">{error}</p>}
            {onClose && <button type="button" className="accessContinue" onClick={onClose}>{t.access.close}</button>}
          </>
        )}
      </section>
    </div>
  );
}

function MovieCard({ movie, language, labels, onOpen, onUpdate, view }) {
  const watched = movie.progress.status === "watched";
  const title = language === "en" && movie.titleEn ? movie.titleEn : movie.title;

  return (
    <article className={`movieCard ${view === "list" ? "movieCardList" : ""}`} onClick={() => onOpen(movie.id)}>
      <div className="posterFrame">
        <img src={movie.poster} alt={title} loading="lazy" />
        <span className="categoryBadge">{labels.categories[movie.category]}</span>
        <button
          type="button"
          className={movie.progress.isFavorite ? "favoriteButton active" : "favoriteButton"}
          onClick={(event) => {
            event.stopPropagation();
            onUpdate(movie.id, { isFavorite: !movie.progress.isFavorite });
          }}
          aria-label={movie.progress.isFavorite ? labels.modal.favorite : labels.modal.addFavorite}
        >
          <Icon name="heart" size={16} filled={movie.progress.isFavorite} />
        </button>
        <button
          type="button"
          className={watched ? "watchedButton watched" : "watchedButton unwatched"}
          onClick={(event) => {
            event.stopPropagation();
            onUpdate(movie.id, { status: watched ? "unwatched" : "watched" });
          }}
          aria-label={watched ? labels.catalog.watched : labels.catalog.unwatched}
        >
          <Icon name={watched ? "check" : "alert"} size={watched ? 17 : 16} />
        </button>
        <div className="posterShade" />
      </div>
      <div className="movieMeta">
        <h3>{title}</h3>
        <div className="cardBottom">
          <Stars value={movie.progress.rating || 0} onChange={(rating) => onUpdate(movie.id, { rating })} compact label={labels.modal.rating} />
          <span className="moreLink">{labels.catalog.details} <Icon name="chevron" size={14} /></span>
        </div>
      </div>
    </article>
  );
}

async function optimizePoster(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Unsupported image");

  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = source;
    });
    const scale = Math.min(1, 1000 / image.naturalWidth, 1500 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= 1_450_000) return blob;
    }
    throw new Error("Poster is too large");
  } finally {
    URL.revokeObjectURL(source);
  }
}

function AddMovieModal({ labels, onClose, onCreate }) {
  const initialForm = {
    title: "",
    titleEn: "",
    category: "movies",
    releaseYear: "",
    status: "unwatched",
    rating: null,
    lastWatchedAt: "",
    description: "",
  };
  const [form, setForm] = useState(initialForm);
  const [poster, setPoster] = useState(null);
  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!poster) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(poster);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [poster]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onCreate(form, poster);
    } catch (submitError) {
      setError(submitError.message || labels.addMovie.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="modalBackdrop formBackdrop" role="presentation" onMouseDown={onClose}>
      <section className="addMovieModal" role="dialog" aria-modal="true" aria-label={labels.addMovie.title} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modalClose" onClick={onClose} aria-label={labels.addMovie.close}><Icon name="close" size={22} /></button>
        <div className="addMovieHeading">
          <span className="sectionKicker">{labels.addMovie.eyebrow}</span>
          <h2>{labels.addMovie.title}</h2>
          <p>{labels.addMovie.description}</p>
        </div>
        <form className="addMovieForm" onSubmit={submit}>
          <div className="addMovieFields">
            <label className="wideField">
              <span>{labels.addMovie.name}</span>
              <input required maxLength={160} value={form.title} onChange={(event) => update("title", event.target.value)} placeholder={labels.addMovie.namePlaceholder} autoFocus />
            </label>
            <label>
              <span>{labels.addMovie.englishName}</span>
              <input maxLength={160} value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} placeholder={labels.addMovie.englishNamePlaceholder} />
            </label>
            <label>
              <span>{labels.addMovie.category}</span>
              <select value={form.category} onChange={(event) => update("category", event.target.value)}>
                {categoryIds.map((id) => <option key={id} value={id}>{labels.categories[id]}</option>)}
              </select>
            </label>
            <label>
              <span>{labels.addMovie.releaseYear}</span>
              <input type="number" inputMode="numeric" min="1888" max="2200" value={form.releaseYear} onChange={(event) => update("releaseYear", event.target.value)} placeholder="2026" />
            </label>
            <label>
              <span>{labels.addMovie.status}</span>
              <select value={form.status} onChange={(event) => update("status", event.target.value)}>
                {statusOrder.map((item) => <option key={item} value={item}>{labels.catalog[item]}</option>)}
              </select>
            </label>
            <label>
              <span>{labels.addMovie.watchedAt}</span>
              <input type="date" disabled={form.status !== "watched"} value={form.lastWatchedAt} onChange={(event) => update("lastWatchedAt", event.target.value)} />
            </label>
            <div className="addRating wideField">
              <span>{labels.addMovie.rating}</span>
              <Stars value={form.rating || 0} onChange={(rating) => update("rating", rating)} label={labels.addMovie.rating} />
            </div>
            <label className="wideField">
              <span>{labels.addMovie.descriptionLabel}</span>
              <textarea maxLength={3000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder={labels.addMovie.descriptionPlaceholder} />
            </label>
          </div>

          <label className={preview ? "posterUpload hasPreview" : "posterUpload"}>
            {preview ? <img src={preview} alt="" /> : <Icon name="upload" size={28} />}
            <strong>{labels.addMovie.choosePoster}</strong>
            <small>{labels.addMovie.posterHint}</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPoster(event.target.files?.[0] || null)} />
          </label>

          {error && <p className="formError" role="alert">{error}</p>}
          <button type="submit" className="primaryButton addMovieSubmit" disabled={submitting || !form.title.trim()}>
            {submitting ? <span className="spinner small" /> : <Icon name="plus" size={18} />}
            {submitting ? labels.addMovie.submitting : labels.addMovie.submit}
          </button>
        </form>
      </section>
    </div>
  );
}

function InstallGuide({ labels, onClose }) {
  return (
    <div className="modalBackdrop guideBackdrop" role="presentation" onMouseDown={onClose}>
      <section className="installGuide" role="dialog" aria-modal="true" aria-label={labels.install.title} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modalClose" onClick={onClose} aria-label={labels.install.close}><Icon name="close" size={22} /></button>
        <span className="brandMark installIcon"><Icon name="share" size={24} /></span>
        <span className="sectionKicker">{labels.install.eyebrow}</span>
        <h2>{labels.install.title}</h2>
        <p>{labels.install.description}</p>
        <ol>
          <li>{labels.install.stepOne}</li>
          <li>{labels.install.stepTwo}</li>
          <li>{labels.install.stepThree}</li>
        </ol>
        <button type="button" className="primaryButton" onClick={onClose}>{labels.install.close}</button>
      </section>
    </div>
  );
}

export default function Home() {
  const [language, setLanguage] = useState("ru");
  const [catalogReady, setCatalogReady] = useState(false);
  const [authState, setAuthState] = useState("checking");
  const [accessPromptOpen, setAccessPromptOpen] = useState(false);
  const [movies, setMovies] = useState([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("random");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState(null);
  const [randomHistory, setRandomHistory] = useState([]);
  const [randomIndex, setRandomIndex] = useState(-1);
  const [noteDraft, setNoteDraft] = useState("");
  const [syncState, setSyncState] = useState("synced");
  const [addMovieOpen, setAddMovieOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const requestQueue = useRef(Promise.resolve());
  const pendingAction = useRef(null);
  const t = translations[language];

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("movie-catalog-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
  };

  const loadCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog", { credentials: "same-origin" });
      if (!response.ok) throw new Error("Catalog request failed");
      const data = await response.json();
      setMovies(data.movies);
      window.localStorage.setItem("movie-catalog-cache-v1", JSON.stringify(data.movies));
      setSyncState("synced");
      setCatalogReady(true);
      return true;
    } catch {
      const cached = window.localStorage.getItem("movie-catalog-cache-v1");
      if (cached) {
        setMovies(JSON.parse(cached));
        setSyncState("offline");
        setCatalogReady(true);
        return true;
      }
      setSyncState("error");
      setCatalogReady(true);
      return false;
    }
  }, []);

  useEffect(() => {
    setShuffleSeed(Math.floor(Math.random() * 2_147_483_647));
    const savedLanguage = window.localStorage.getItem("movie-catalog-language");
    if (savedLanguage === "en") {
      setLanguage("en");
      document.documentElement.lang = "en";
    }

    const initialize = async () => {
      try {
        const response = await fetch("/api/session", { credentials: "same-origin" });
        const session = await response.json();
        if (!session.configured) {
          setAuthState("setup");
        } else if (session.authenticated) {
          setAuthState("authenticated");
        } else {
          setAuthState("guest");
        }
      } catch {
        setAuthState("guest");
      }
      await loadCatalog();
    };
    initialize();
  }, [loadCatalog]);

  useEffect(() => {
    const selected = movies.find((movie) => movie.id === selectedId);
    setNoteDraft(selected?.progress.notes || "");
    setHistoryOpen(false);
    setHistoryDates([]);
  }, [selectedId]);

  useEffect(() => {
    const overlayOpen = selectedId || accessPromptOpen || addMovieOpen || installGuideOpen;
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setRandomHistory([]);
        setRandomIndex(-1);
        setAccessPromptOpen(false);
        setAddMovieOpen(false);
        setInstallGuideOpen(false);
        pendingAction.current = null;
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [accessPromptOpen, addMovieOpen, installGuideOpen, selectedId]);

  const unlock = async (accessKey) => {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      const data = await response.json();
      if (!response.ok) return { ok: false, error: data.error };
      setAuthState("authenticated");
      setAccessPromptOpen(false);
      const action = pendingAction.current;
      pendingAction.current = null;
      if (action) await action();
      return { ok: true };
    } catch {
      return { ok: false, error: t.sync.error };
    }
  };

  const logout = async () => {
    await fetch("/api/session", { method: "DELETE", credentials: "same-origin" });
    setAuthState("guest");
    setAccessPromptOpen(false);
    pendingAction.current = null;
  };

  const closeAccessPrompt = () => {
    setAccessPromptOpen(false);
    pendingAction.current = null;
  };

  const requireAccess = (action = null) => {
    if (authState === "authenticated") return action?.();
    pendingAction.current = action;
    setAccessPromptOpen(true);
    return undefined;
  };

  const performUpdateProgress = (movieId, patch) => {
    if (syncState === "offline") return;
    setMovies((current) => current.map((movie) => {
      if (movie.id !== movieId) return movie;
      const next = { ...movie.progress, ...patch };
      if (patch.status === "watched" && !next.lastWatchedAt) {
        next.lastWatchedAt = new Date().toISOString();
        next.watchCount = Math.max(1, next.watchCount || 0);
      }
      if (patch.status === "unwatched") {
        next.lastWatchedAt = null;
        next.watchCount = 0;
      }
      if (patch.lastWatchedAt) next.status = "watched";
      return { ...movie, progress: next };
    }));
    setSyncState("saving");

    requestQueue.current = requestQueue.current
      .then(async () => {
        const response = await fetch(`/api/movies/${movieId}/progress`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (response.status === 401) {
          setAuthState("guest");
          pendingAction.current = () => performUpdateProgress(movieId, patch);
          setAccessPromptOpen(true);
          throw new Error("Authentication required");
        }
        if (!response.ok) throw new Error("Progress update failed");
        const data = await response.json();
        setMovies((current) => current.map((movie) => movie.id === movieId
          ? { ...movie, progress: data.progress }
          : movie));
        if (patch.status || Object.prototype.hasOwnProperty.call(patch, "lastWatchedAt")) {
          setHistoryOpen(false);
          setHistoryDates([]);
        }
        setSyncState("synced");
      })
      .catch(async () => {
        setSyncState("error");
        await loadCatalog();
      });
  };

  const updateProgress = (movieId, patch) => {
    requireAccess(() => performUpdateProgress(movieId, patch));
  };

  const performResetMovie = async (movieId) => {
    if (syncState === "offline") return;
    const response = await fetch(`/api/movies/${movieId}/progress`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (response.status === 401) {
      setAuthState("guest");
      pendingAction.current = () => performResetMovie(movieId);
      setAccessPromptOpen(true);
      return;
    }
    if (response.ok) {
      const data = await response.json();
      setMovies((current) => current.map((movie) => movie.id === movieId
        ? { ...movie, progress: data.progress }
        : movie));
      setSelectedId(null);
    }
  };

  const resetMovie = (movieId) => {
    requireAccess(() => performResetMovie(movieId));
  };

  const performExportBackup = async () => {
    const response = await fetch("/api/export", { credentials: "same-origin" });
    if (response.status === 401) {
      setAuthState("guest");
      pendingAction.current = performExportBackup;
      setAccessPromptOpen(true);
      return;
    }
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movie-catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBackup = () => {
    requireAccess(performExportBackup);
  };

  const selectCategory = (nextCategory) => {
    setCategory(nextCategory);
    setSort("random");
    setShuffleSeed(Math.floor(Math.random() * 2_147_483_647));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAddMovie = () => {
    requireAccess(() => setAddMovieOpen(true));
  };

  const createMovie = async (form, posterFile) => {
    const optimizedPoster = posterFile ? await optimizePoster(posterFile) : null;
    const response = await fetch("/api/movies", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        rating: form.rating || null,
        releaseYear: form.releaseYear || null,
        lastWatchedAt: form.status === "watched" ? form.lastWatchedAt || null : null,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t.addMovie.error);

    if (optimizedPoster) {
      const posterResponse = await fetch(`/api/movies/${data.movie.id}/poster`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": optimizedPoster.type || "image/webp" },
        body: optimizedPoster,
      });
      if (!posterResponse.ok) setSyncState("error");
    }

    await loadCatalog();
    setAddMovieOpen(false);
    setCategory(form.category);
    setSort("random");
    setShuffleSeed(Math.floor(Math.random() * 2_147_483_647));
  };

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/movies/${selectedId}/history`, { credentials: "same-origin" });
      const data = await response.json();
      setHistoryDates(response.ok ? data.dates : []);
    } catch {
      setHistoryDates([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = movies.filter((movie) => {
      if (category !== "all" && movie.category !== category) return false;
      if (!matchesMovieQuery(movie, query, t.locale)) return false;
      if (status === "rated" && !movie.progress.rating) return false;
      if (status === "favorites" && !movie.progress.isFavorite) return false;
      if (statusOrder.includes(status) && movie.progress.status !== status) return false;
      return true;
    });

    if (sort === "random") result = randomizeMovies(result, shuffleSeed);
    if (sort === "title") result = [...result].sort((a, b) => a.title.localeCompare(b.title, t.locale));
    if (sort === "rating") result = [...result].sort((a, b) => (b.progress.rating || 0) - (a.progress.rating || 0));
    if (sort === "recent") result = [...result].sort((a, b) => (b.progress.lastWatchedAt || "").localeCompare(a.progress.lastWatchedAt || ""));
    if (sort === "oldest") result = sortOldestWatched(result);
    return result;
  }, [category, movies, query, shuffleSeed, sort, status, t.locale]);

  const watchedCount = movies.filter((movie) => movie.progress.status === "watched").length;
  const favoriteCount = movies.filter((movie) => movie.progress.isFavorite).length;
  const selected = movies.find((movie) => movie.id === selectedId) || null;
  const randomMode = randomIndex >= 0;

  const getRandomId = (excludeId = null) => {
    const pool = filtered.length ? filtered : movies;
    const candidates = pool.length > 1 ? pool.filter((movie) => movie.id !== excludeId) : pool;
    return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].id : null;
  };

  const chooseRandom = () => {
    const nextId = getRandomId(selectedId);
    if (nextId === null) return;
    setRandomHistory([nextId]);
    setRandomIndex(0);
    setSelectedId(nextId);
  };

  const showPreviousRandom = () => {
    if (randomIndex <= 0) return;
    const previousIndex = randomIndex - 1;
    setRandomIndex(previousIndex);
    setSelectedId(randomHistory[previousIndex]);
  };

  const showNextRandom = () => {
    if (randomIndex < randomHistory.length - 1) {
      const nextIndex = randomIndex + 1;
      setRandomIndex(nextIndex);
      setSelectedId(randomHistory[nextIndex]);
      return;
    }

    const nextId = getRandomId(selectedId);
    if (nextId === null) return;
    const nextHistory = [...randomHistory.slice(0, randomIndex + 1), nextId];
    setRandomHistory(nextHistory);
    setRandomIndex(nextHistory.length - 1);
    setSelectedId(nextId);
  };

  const openMovie = (movieId) => {
    setRandomHistory([]);
    setRandomIndex(-1);
    setSelectedId(movieId);
  };

  const closeMovie = () => {
    setSelectedId(null);
    setRandomHistory([]);
    setRandomIndex(-1);
  };

  if (!catalogReady) {
    return <AccessScreen mode="checking" language={language} onLanguageChange={changeLanguage} onUnlock={unlock} />;
  }

  return (
    <main>
      <header className="siteHeader">
        <a href="#top" className="brand" aria-label="Movie Catalog">
          <span className="brandMark"><Icon name="film" size={22} /></span>
          <span>MOVIE <b>CATALOG</b></span>
        </a>
        <nav className="desktopNav" aria-label={t.nav.collection}>
          {["all", ...categoryIds].map((id) => (
            <button type="button" key={id} className={category === id ? "active" : ""} onClick={() => selectCategory(id)}>
              {t.categories[id]}
            </button>
          ))}
        </nav>
        <div className="headerActions">
          <span className={`syncBadge ${syncState}`} aria-live="polite">
            <Icon name="cloud" size={15} />
            {t.sync[syncState] || t.sync.synced}
          </span>
          <div className="languageSwitch" aria-label="Language">
            <button type="button" className={language === "ru" ? "active" : ""} onClick={() => changeLanguage("ru")}>RU</button>
            <button type="button" className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")}>EN</button>
          </div>
          <button type="button" className="addHeader" onClick={openAddMovie} aria-label={t.nav.add}>
            <Icon name="plus" size={18} /><span>{t.nav.add}</span>
          </button>
          <button type="button" className="randomHeader" onClick={chooseRandom} aria-label={t.nav.random}>
            <Icon name="shuffle" size={18} /><span>{t.nav.random}</span>
          </button>
        </div>
      </header>

      {syncState === "offline" && <div className="offlineBanner">{t.sync.offline}</div>}

      <section className="catalogSection" id="top">
        <div className="sectionIntro catalogIntro">
          <div>
            <span className="sectionKicker">{t.catalog.eyebrow}</span>
            <h1>{t.categories[category]}</h1>
          </div>
          <div className="catalogSummary">
            <div className="catalogStats" aria-label={t.catalog.stats}>
              <span><strong>{movies.length}</strong>{t.hero.total}</span>
              <span><strong>{watchedCount}</strong>{t.hero.watched}</span>
              <span><strong>{favoriteCount}</strong>{t.hero.favorites}</span>
            </div>
            <button type="button" className="catalogRandom" onClick={chooseRandom}>
              <Icon name="shuffle" size={18} /> {t.nav.random}
            </button>
          </div>
        </div>

        <div className="toolbar">
          <label className="searchBox">
            <Icon name="search" size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.catalog.search} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label={t.catalog.reset}><Icon name="close" size={16} /></button>}
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t.modal.status}>
            <option value="all">{t.catalog.allStatuses}</option>
            {statusOrder.map((item) => <option key={item} value={item}>{t.catalog[item]}</option>)}
            <option value="rated">{t.catalog.rated}</option>
            <option value="favorites">{t.catalog.favorites}</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t.catalog.collectionOrder}>
            <option value="random">{t.catalog.randomOrder}</option>
            <option value="collection">{t.catalog.collectionOrder}</option>
            <option value="title">{t.catalog.titleOrder}</option>
            <option value="rating">{t.catalog.ratingOrder}</option>
            <option value="recent">{t.catalog.recentOrder}</option>
            <option value="oldest">{t.catalog.oldestOrder}</option>
          </select>
          <div className="viewSwitch" aria-label={t.nav.collection}>
            <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid"><Icon name="grid" size={18} /></button>
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List"><Icon name="list" size={18} /></button>
          </div>
          <span className="resultCount">{filtered.length} {t.catalog.result} {movies.length}</span>
        </div>

        {filtered.length ? (
          <div className={view === "list" ? "movieGrid listView" : "movieGrid"}>
            {filtered.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                language={language}
                labels={t}
                onOpen={openMovie}
                onUpdate={updateProgress}
                view={view}
              />
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <Icon name="film" size={30} />
            <h3>{t.catalog.emptyTitle}</h3>
            <p>{t.catalog.emptyText}</p>
            <button type="button" onClick={() => { setQuery(""); selectCategory("all"); setStatus("all"); }}>{t.catalog.reset}</button>
          </div>
        )}
      </section>

      <footer className="siteFooter">
        <div className="brand"><span className="brandMark"><Icon name="film" size={18} /></span><span>MOVIE <b>CATALOG</b></span></div>
        <p>{movies.length} {t.footer.description}</p>
        <div className="footerActions">
          <button type="button" onClick={() => setInstallGuideOpen(true)}><Icon name="share" size={17} /> {t.footer.homeScreen}</button>
          <button type="button" onClick={exportBackup}><Icon name="download" size={17} /> {t.footer.export}</button>
          <button type="button" onClick={authState === "authenticated" ? logout : () => requireAccess()}>
            <Icon name={authState === "authenticated" ? "logout" : "lock"} size={17} />
            {authState === "authenticated" ? t.nav.logout : t.nav.edit}
          </button>
        </div>
      </footer>

      {selected && (
        <div className="modalBackdrop" role="presentation" onMouseDown={closeMovie}>
          {randomMode && (
            <button
              type="button"
              className="randomModalNav randomModalPrevious"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={showPreviousRandom}
              disabled={randomIndex <= 0}
              aria-label={t.modal.previousRandom}
            >
              <Icon name="arrowLeft" size={24} />
            </button>
          )}
          <section className={randomMode ? "movieModal randomMode" : "movieModal"} role="dialog" aria-modal="true" aria-label={selected.title} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modalClose" onClick={closeMovie} aria-label={t.modal.close}><Icon name="close" size={22} /></button>
            <div className="modalPoster"><img src={selected.poster} alt={selected.title} /></div>
            <div className="modalInfo">
              <span className="modalCategory">{t.categories[selected.category]}</span>
              <h2>{language === "en" && selected.titleEn ? selected.titleEn : selected.title}</h2>
              {selected.description && <p className="modalLead">{selected.description}</p>}

              <button
                type="button"
                className={selected.progress.isFavorite ? "modalFavorite active" : "modalFavorite"}
                onClick={() => updateProgress(selected.id, { isFavorite: !selected.progress.isFavorite })}
              >
                <Icon name="heart" size={18} filled={selected.progress.isFavorite} />
                {selected.progress.isFavorite ? t.modal.favorite : t.modal.addFavorite}
              </button>

              <div className="ratingBlock"><span>{t.modal.rating}</span><Stars value={selected.progress.rating || 0} onChange={(rating) => updateProgress(selected.id, { rating })} label={t.modal.rating} /></div>

              <div className="detailFields">
                <label>
                  <span>{t.modal.status}</span>
                  <select value={selected.progress.status} onChange={(event) => updateProgress(selected.id, { status: event.target.value })}>
                    {statusOrder.map((item) => <option key={item} value={item}>{t.catalog[item]}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t.modal.date}</span>
                  <div className="dateInput"><Icon name="calendar" size={17} /><input type="date" value={selected.progress.lastWatchedAt?.slice(0, 10) || ""} onChange={(event) => updateProgress(selected.id, { lastWatchedAt: event.target.value || null })} /></div>
                </label>
              </div>

              <div className="watchCount">
                <span>{t.modal.watches}</span>
                <div>
                  <strong>{selected.progress.watchCount || 0}</strong>
                  <button type="button" className="historyInfo" onClick={toggleHistory} aria-label={t.modal.showHistory} aria-expanded={historyOpen}>
                    <Icon name="info" size={18} />
                  </button>
                </div>
              </div>
              {historyOpen && (
                <div className="historyPanel">
                  <span>{t.modal.history}</span>
                  {historyLoading ? <p>{t.modal.historyLoading}</p> : historyDates.length ? (
                    <ul>{historyDates.map((date) => <li key={date}>{new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(date))}</li>)}</ul>
                  ) : <p>{t.modal.historyEmpty}</p>}
                </div>
              )}

              <label className="notesField">
                <span>{t.modal.notes}</span>
                <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={t.modal.notesPlaceholder} />
              </label>
              <div className="modalActions">
                <button type="button" className="saveNote" disabled={noteDraft === selected.progress.notes} onClick={() => updateProgress(selected.id, { notes: noteDraft })}>{t.modal.saveNotes}</button>
                <button type="button" className="resetMovie" onClick={() => resetMovie(selected.id)}>{t.modal.reset}</button>
              </div>
            </div>
          </section>
          {randomMode && (
            <button
              type="button"
              className="randomModalNav randomModalNext"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={showNextRandom}
              aria-label={t.modal.nextRandom}
            >
              <Icon name="arrowRight" size={24} />
            </button>
          )}
        </div>
      )}

      {accessPromptOpen && (
        <AccessScreen
          mode={authState === "setup" ? "setup" : "locked"}
          language={language}
          onLanguageChange={changeLanguage}
          onUnlock={unlock}
          onClose={closeAccessPrompt}
        />
      )}

      {addMovieOpen && (
        <AddMovieModal labels={t} onClose={() => setAddMovieOpen(false)} onCreate={createMovie} />
      )}

      {installGuideOpen && <InstallGuide labels={t} onClose={() => setInstallGuideOpen(false)} />}
    </main>
  );
}
