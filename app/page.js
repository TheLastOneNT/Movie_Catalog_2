"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translations } from "@/lib/i18n";

const categoryCards = [
  { id: "movies", image: "/categories/Movies.jpg" },
  { id: "series", image: "/categories/Series.jpg" },
  { id: "cartoons", image: "/categories/Cartoons.jpg" },
  { id: "documentaries", image: "/categories/Documentary.jpg" },
];

const statusOrder = ["unwatched", "planned", "watching", "watched", "dropped"];

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
    film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    cloud: <><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z" /><path d="m9 13 2 2 4-4" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
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

function AccessScreen({ mode, language, onLanguageChange, onUnlock }) {
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
    <main className="accessPage">
      <div className="accessBackdrop" />
      <div className="accessLanguage" aria-label="Language">
        <button type="button" className={language === "ru" ? "active" : ""} onClick={() => onLanguageChange("ru")}>RU</button>
        <button type="button" className={language === "en" ? "active" : ""} onClick={() => onLanguageChange("en")}>EN</button>
      </div>
      <section className="accessCard">
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
          </>
        )}
      </section>
    </main>
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
          className={watched ? "watchedButton active" : "watchedButton"}
          onClick={(event) => {
            event.stopPropagation();
            onUpdate(movie.id, { status: watched ? "unwatched" : "watched" });
          }}
          aria-label={watched ? labels.catalog.watched : labels.catalog.unwatched}
        >
          <Icon name="check" size={17} />
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

export default function Home() {
  const [language, setLanguage] = useState("ru");
  const [accessMode, setAccessMode] = useState("checking");
  const [movies, setMovies] = useState([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("collection");
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [syncState, setSyncState] = useState("synced");
  const requestQueue = useRef(Promise.resolve());
  const t = translations[language];

  const changeLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("movie-catalog-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
  };

  const loadCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog", { credentials: "same-origin" });
      if (response.status === 401) {
        setAccessMode("locked");
        return false;
      }
      if (!response.ok) throw new Error("Catalog request failed");
      const data = await response.json();
      setMovies(data.movies);
      window.localStorage.setItem("movie-catalog-cache-v1", JSON.stringify(data.movies));
      setSyncState("synced");
      setAccessMode("ready");
      return true;
    } catch {
      const cached = window.localStorage.getItem("movie-catalog-cache-v1");
      if (cached) {
        setMovies(JSON.parse(cached));
        setSyncState("offline");
        setAccessMode("ready");
        return true;
      }
      setAccessMode("locked");
      return false;
    }
  }, []);

  useEffect(() => {
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
          setAccessMode("setup");
        } else if (session.authenticated) {
          await loadCatalog();
        } else {
          setAccessMode("locked");
        }
      } catch {
        const cached = window.localStorage.getItem("movie-catalog-cache-v1");
        if (cached) {
          setMovies(JSON.parse(cached));
          setSyncState("offline");
          setAccessMode("ready");
        } else {
          setAccessMode("locked");
        }
      }
    };
    initialize();
  }, [loadCatalog]);

  useEffect(() => {
    const selected = movies.find((movie) => movie.id === selectedId);
    setNoteDraft(selected?.progress.notes || "");
  }, [selectedId]);

  useEffect(() => {
    document.body.style.overflow = selectedId ? "hidden" : "";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedId]);

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
      await loadCatalog();
      return { ok: true };
    } catch {
      return { ok: false, error: t.sync.error };
    }
  };

  const logout = async () => {
    await fetch("/api/session", { method: "DELETE", credentials: "same-origin" });
    setSelectedId(null);
    setMovies([]);
    setAccessMode("locked");
  };

  const updateProgress = (movieId, patch) => {
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
          setAccessMode("locked");
          throw new Error("Session expired");
        }
        if (!response.ok) throw new Error("Progress update failed");
        const data = await response.json();
        setMovies((current) => current.map((movie) => movie.id === movieId
          ? { ...movie, progress: data.progress }
          : movie));
        setSyncState("synced");
      })
      .catch(async () => {
        setSyncState("error");
        await loadCatalog();
      });
  };

  const resetMovie = async (movieId) => {
    if (syncState === "offline") return;
    const response = await fetch(`/api/movies/${movieId}/progress`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (response.ok) {
      const data = await response.json();
      setMovies((current) => current.map((movie) => movie.id === movieId
        ? { ...movie, progress: data.progress }
        : movie));
      setSelectedId(null);
    }
  };

  const exportBackup = async () => {
    const response = await fetch("/api/export", { credentials: "same-origin" });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movie-catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(t.locale);
    let result = movies.filter((movie) => {
      const title = language === "en" && movie.titleEn ? movie.titleEn : movie.title;
      if (category !== "all" && movie.category !== category) return false;
      if (normalizedQuery && !title.toLocaleLowerCase(t.locale).includes(normalizedQuery)) return false;
      if (status === "rated" && !movie.progress.rating) return false;
      if (status === "favorites" && !movie.progress.isFavorite) return false;
      if (statusOrder.includes(status) && movie.progress.status !== status) return false;
      return true;
    });

    if (sort === "title") result = [...result].sort((a, b) => a.title.localeCompare(b.title, t.locale));
    if (sort === "rating") result = [...result].sort((a, b) => (b.progress.rating || 0) - (a.progress.rating || 0));
    if (sort === "recent") result = [...result].sort((a, b) => (b.progress.lastWatchedAt || "").localeCompare(a.progress.lastWatchedAt || ""));
    return result;
  }, [category, language, movies, query, sort, status, t.locale]);

  const watchedCount = movies.filter((movie) => movie.progress.status === "watched").length;
  const favoriteCount = movies.filter((movie) => movie.progress.isFavorite).length;
  const selected = movies.find((movie) => movie.id === selectedId) || null;

  const chooseRandom = () => {
    const pool = filtered.length ? filtered : movies;
    if (pool.length) setSelectedId(pool[Math.floor(Math.random() * pool.length)].id);
  };

  if (accessMode !== "ready") {
    return <AccessScreen mode={accessMode} language={language} onLanguageChange={changeLanguage} onUnlock={unlock} />;
  }

  return (
    <main>
      <header className="siteHeader">
        <a href="#top" className="brand" aria-label="Movie Catalog">
          <span className="brandMark"><Icon name="film" size={22} /></span>
          <span>MOVIE <b>CATALOG</b></span>
        </a>
        <nav className="desktopNav" aria-label={t.nav.collection}>
          <button type="button" className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>{t.nav.collection}</button>
          <button type="button" className={category === "movies" ? "active" : ""} onClick={() => setCategory("movies")}>{t.nav.movies}</button>
          <button type="button" className={category === "series" ? "active" : ""} onClick={() => setCategory("series")}>{t.nav.series}</button>
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
          <button type="button" className="randomHeader" onClick={chooseRandom} aria-label={t.nav.random}>
            <Icon name="shuffle" size={18} /><span>{t.nav.random}</span>
          </button>
        </div>
      </header>

      {syncState === "offline" && <div className="offlineBanner">{t.sync.offline}</div>}

      <section className="hero" id="top">
        <div className="heroBackdrop" />
        <div className="heroGlow" />
        <div className="heroContent">
          <div className="eyebrow"><span /> {t.hero.eyebrow}</div>
          <h1>{t.hero.title}<br /><em>{t.hero.accent}</em></h1>
          <p>{t.hero.description}</p>
          <div className="heroActions">
            <a href="#catalog" className="primaryButton"><Icon name="grid" size={18} /> {t.hero.open}</a>
            <button type="button" className="ghostButton" onClick={chooseRandom}><Icon name="shuffle" size={18} /> {t.hero.random}</button>
          </div>
          <div className="heroStats">
            <div><strong>{movies.length}</strong><span>{t.hero.total}</span></div>
            <i />
            <div><strong>{watchedCount}</strong><span>{t.hero.watched}</span></div>
            <i />
            <div><strong>{favoriteCount}</strong><span>{t.hero.favorites}</span></div>
          </div>
        </div>
      </section>

      <section className="categorySection" aria-labelledby="category-title">
        <div className="sectionIntro">
          <div><span className="sectionKicker">{t.categorySection.eyebrow}</span><h2 id="category-title">{t.categorySection.title}</h2></div>
          <p>{t.categorySection.description}</p>
        </div>
        <div className="categoryGrid">
          {categoryCards.map((item) => {
            const count = movies.filter((movie) => movie.category === item.id).length;
            return (
              <button
                type="button"
                key={item.id}
                className={category === item.id ? "categoryCard active" : "categoryCard"}
                onClick={() => {
                  setCategory(item.id);
                  document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <img src={item.image} alt="" />
                <span className="categoryOverlay" />
                <span className="categoryCopy"><small>{count} {t.categorySection.items}</small><b>{t.categories[item.id]}</b></span>
                <span className="categoryArrow"><Icon name="chevron" size={20} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="catalogSection" id="catalog">
        <div className="sectionIntro catalogIntro">
          <div><span className="sectionKicker">{t.catalog.eyebrow}</span><h2>{t.categories[category]}</h2></div>
          <span className="resultCount">{filtered.length} {t.catalog.result} {movies.length}</span>
        </div>

        <div className="toolbar">
          <label className="searchBox">
            <Icon name="search" size={19} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.catalog.search} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label={t.catalog.reset}><Icon name="close" size={16} /></button>}
          </label>
          <div className="categoryPills">
            {["all", ...categoryCards.map((item) => item.id)].map((id) => (
              <button type="button" key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{t.categories[id]}</button>
            ))}
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t.modal.status}>
            <option value="all">{t.catalog.allStatuses}</option>
            {statusOrder.map((item) => <option key={item} value={item}>{t.catalog[item]}</option>)}
            <option value="rated">{t.catalog.rated}</option>
            <option value="favorites">{t.catalog.favorites}</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t.catalog.collectionOrder}>
            <option value="collection">{t.catalog.collectionOrder}</option>
            <option value="title">{t.catalog.titleOrder}</option>
            <option value="rating">{t.catalog.ratingOrder}</option>
            <option value="recent">{t.catalog.recentOrder}</option>
          </select>
          <div className="viewSwitch" aria-label={t.nav.collection}>
            <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Grid"><Icon name="grid" size={18} /></button>
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="List"><Icon name="list" size={18} /></button>
          </div>
        </div>

        {filtered.length ? (
          <div className={view === "list" ? "movieGrid listView" : "movieGrid"}>
            {filtered.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                language={language}
                labels={t}
                onOpen={setSelectedId}
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
            <button type="button" onClick={() => { setQuery(""); setCategory("all"); setStatus("all"); }}>{t.catalog.reset}</button>
          </div>
        )}
      </section>

      <footer className="siteFooter">
        <div className="brand"><span className="brandMark"><Icon name="film" size={18} /></span><span>MOVIE <b>CATALOG</b></span></div>
        <p>{movies.length} {t.footer.description}</p>
        <div className="footerActions">
          <button type="button" onClick={exportBackup}><Icon name="download" size={17} /> {t.footer.export}</button>
          <button type="button" onClick={logout}><Icon name="logout" size={17} /> {t.nav.logout}</button>
        </div>
      </footer>

      {selected && (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setSelectedId(null)}>
          <section className="movieModal" role="dialog" aria-modal="true" aria-label={selected.title} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modalClose" onClick={() => setSelectedId(null)} aria-label={t.modal.close}><Icon name="close" size={22} /></button>
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

              <div className="watchCount"><span>{t.modal.watches}</span><strong>{selected.progress.watchCount || 0}</strong></div>

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
        </div>
      )}
    </main>
  );
}
