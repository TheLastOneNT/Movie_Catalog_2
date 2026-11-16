"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translations } from "@/lib/i18n";
import { matchesMovieQuery } from "@/lib/search";
import { randomizeMovies, sortOldestWatched } from "@/lib/catalog";
import { findDuplicateTitle, findPotentialDuplicatePairs } from "@/lib/title-duplicates";
import { normalizeGenreIds, matchesGenreFilter } from "@/lib/genre-groups";

const categoryIds = ["movies", "series", "cartoons", "documentaries"];
// These are content categories in our top navigation, not useful genre filters.
const nonGenreIds = new Set([16, 99]);
// Consistent, editorially curated labels for TMDB movie and TV genre IDs.
const genreLabels = {
  12:["Приключения","Adventure"],14:["Фэнтези","Fantasy"],18:["Драма","Drama"],
  27:["Ужасы","Horror"],28:["Боевик","Action"],35:["Комедия","Comedy"],
  36:["История","History"],37:["Вестерн","Western"],53:["Триллер","Thriller"],
  80:["Криминал","Crime"],878:["Фантастика","Science fiction"],
  9648:["Детектив","Mystery"],10402:["Музыка","Music"],
  10749:["Мелодрама","Romance"],10751:["Семейный","Family"],
  10752:["Военный","War"],10759:["Боевик и приключения","Action & adventure"],
  10762:["Для детей","Kids"],10763:["Новости","News"],
  10764:["Реалити-шоу","Reality"],10765:["Фантастика и фэнтези","Sci-fi & fantasy"],
  10766:["Мыльная опера","Soap"],10767:["Ток-шоу","Talk show"],
  10768:["Военный и политический","War & politics"],10770:["Телефильм","TV movie"]
};
const cleanGenreLabel=(value)=>{
  const label=String(value||"").trim().replace(/\\s+/g," ");
  return label ? label[0].toLocaleUpperCase()+label.slice(1) : "";
};


const statusOrder = ["watched"];

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

function personalFor(movie, memberId) {
  return movie.members?.[memberId] || { rating: null, isFavorite: false, wantsToWatch: false, notes: "" };
}

function todayLocal() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function MovieCard({ movie, language, labels, onOpen, view }) {
  const watched = movie.progress.status === "watched";
  const inWatchlist = !watched;
  const rating = movie.progress.rating;
  const title = language === "en" && movie.titleEn ? movie.titleEn : movie.title;

  return (
    <article className={`movieCard ${view === "list" ? "movieCardList" : ""}`}>
      <div className="posterFrame">
        <button type="button" className="posterOpen" onClick={() => onOpen(movie.id)} aria-label={labels.catalog.details + ": " + title}><img src={movie.poster} alt="" loading="lazy" decoding="async" /></button>
        <span className="categoryBadge">{labels.categories[movie.category]}</span>
        <div className="posterShade" />
      </div>
      {view !== "list" && (rating || watched || inWatchlist) && (
        <span className={rating ? "cardRatingBadge" : watched ? "cardRatingBadge viewed" : "cardRatingBadge watchlist"} aria-label={rating
          ? (language === "en" ? `Rating: ${rating} of 5` : `Оценка: ${rating} из 5`)
          : watched ? (language === "en" ? "Watched, not rated" : "Просмотрено, без оценки")
          : (language === "en" ? "Want to watch" : "Хочу посмотреть")}>
          {rating ? `★ ${rating}/5` : watched ? <Icon name="check" size={17} /> : (language === "en" ? "◷ Watchlist" : "◷ В планах")}
        </span>
      )}
      <div className="movieMeta">
        <h3><button type="button" className="cardTitleButton" onClick={() => onOpen(movie.id)}>{title}</button>{movie.releaseYear ? <small className="cardYear"> · {movie.releaseYear}</small> : null}</h3>
        {view === "list" && (
          <div className="cardBottom">
            {(rating || watched || inWatchlist) && <span className={rating ? "listRatingLabel" : watched ? "listRatingLabel viewed" : "listRatingLabel watchlist"}>{rating ? `★ ${rating}/5` : watched ? (language === "en" ? "✓ Watched" : "✓ Просмотрено") : (language === "en" ? "◷ Watchlist" : "◷ В планах")}</span>}
            <button type="button" className="moreLink cardDetailsButton" onClick={() => onOpen(movie.id)} aria-label={labels.catalog.details + ": " + title}>{labels.catalog.details} <Icon name="chevron" size={14} /></button>
          </div>
        )}
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

// One consistent calendar for the add form and the movie details.
// Use the system date picker in BOTH the add form and movie details.
// On iOS it supports jumping directly to a year and month (no month-by-month scrolling).
// The visual shell prevents WebKit's intrinsic date-input width from overflowing.
function ViewingDateField({value,onChange,label,disabled=false,max,language="ru"}) {
  const en=language==="en";
  const pretty=value
    ? new Intl.DateTimeFormat(en?"en-US":"ru-RU",{
        year:"numeric",month:"short",day:"numeric",timeZone:"UTC"
      }).format(new Date(`${value.slice(0,10)}T12:00:00Z`))
    : (en?"Choose date":"Выбрать дату");
  return <span className={disabled?"viewingDateField disabled":"viewingDateField"}>
    <span className="viewingDateFieldText" aria-hidden="true">{pretty}</span>
    <Icon name="calendar" size={18} />
    <input type="date" aria-label={label} value={value||""} disabled={disabled}
      max={max} onChange={(event)=>onChange(event.target.value)} />
  </span>;
}

function AddMovieModal({ labels, onClose, onCreate, initialMovie = null }) {
  const initialForm = {
    title: "",
    titleEn: "", descriptionEn: "",
    category: "movies",
    releaseYear: "",
    status: "watchlist",
    rating: null,
    lastWatchedAt: "",
    startedAt: "",
    seasonNumber: 1,
    description: "",
    wantToWatch: true,
  };
  const [form, setForm] = useState(initialMovie ? {
    title: initialMovie.title || "", titleEn: initialMovie.titleEn || "", descriptionEn: initialMovie.descriptionEn || "", category: initialMovie.category,
    releaseYear: initialMovie.releaseYear || "", status: initialMovie.progress.status, rating: initialMovie.progress.rating,
    lastWatchedAt: initialMovie.progress.lastWatchedAt?.slice(0, 10) || "", startedAt:"",seasonNumber:1,description: initialMovie.description || "",
  } : initialForm);
  const [poster, setPoster] = useState(null);
  const [tmdbMatches, setTmdbMatches] = useState([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [tmdbPoster, setTmdbPoster] = useState(null);
  const [tmdbIdentity, setTmdbIdentity] = useState(null);
  const [tmdbError, setTmdbError] = useState("");
  const searchOnTmdb = async () => {
    if (form.title.trim().length < 2) return;
    setTmdbLoading(true); setTmdbError("");
    try {
      const params = new URLSearchParams({ q: form.title.trim() });
      if (form.releaseYear) params.set("year", String(form.releaseYear));
      const response = await fetch(`/api/tmdb/search?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(labels.family.tmdbUnavailable);
      setTmdbMatches(data.results || []);
      if (!(data.results || []).length) setTmdbError(labels.family.tmdbNoResults);
    } catch (error) { setTmdbError(error.message || labels.family.tmdbUnavailable); }
    finally { setTmdbLoading(false); }
  };
  const selectTmdb = (match) => {
    setForm((current) => ({ ...current, title: match.title || current.title,
      titleEn: match.titleEn || "", description: match.description || "", descriptionEn: match.descriptionEn || "",
      releaseYear: match.releaseYear || "", category: match.category || current.category,
      ...(match.category==="series"&&current.status!=="watched"?{status:"watchlist",wantToWatch:true,rating:null,lastWatchedAt:""}:{}) }));
    setTmdbPoster(match.posterUrl || null);
    setTmdbIdentity({id:match.tmdbId || match.id,mediaType:match.mediaType || (match.category==="series"?"tv":"movie")});
    setTmdbMatches([]);
  };
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

  const update = (field,value)=>{
    if (["titleEn","category","releaseYear"].includes(field)) setTmdbIdentity(null);
    setForm(current=>({...current,[field]:value,
    ...(field==="category"&&value==="series"&&current.status!=="watched"?{status:"watchlist",wantToWatch:true,rating:null,lastWatchedAt:""}:{}),
    ...(field==="status"?{wantToWatch:value==="watchlist",
      rating:value==="watched"?current.rating:null,
      lastWatchedAt:value==="watched"?(current.lastWatchedAt||todayLocal()):"",
      startedAt:value==="watched"?(current.startedAt||todayLocal()):""}:{}),
  }));};
  const submit = async (event) => {
    event.preventDefault();
    if(!form.title.trim()){setError(labels.locale==="en-US"?"Enter a title.":"Укажите название.");return;}
    if(!initialMovie && form.status==="watched" && (!form.lastWatchedAt || form.rating==null || (form.category==="series" && (!form.startedAt || form.lastWatchedAt<form.startedAt)))){
      setError(labels.locale==="en-US"?"Choose viewing date and rating.":"Укажите дату просмотра и оценку.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onCreate(form, poster, tmdbPoster, tmdbIdentity);
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
          <h2>{initialMovie ? labels.family.editMovie : labels.addMovie.title}</h2>
          <p>{labels.addMovie.description}</p>
        </div>
        <form className="addMovieForm" onSubmit={submit}>
          <div className="addMovieFields">
            <label className="wideField">
              <span>{labels.addMovie.name}</span>
              <span className="addTitleInput">
                <input required maxLength={160} value={form.title} onChange={(event) => {update("title", event.target.value);setTmdbIdentity(null);setTmdbMatches([]);setTmdbError("");}} placeholder={labels.addMovie.namePlaceholder} autoFocus />
                {form.title && <button type="button" aria-label={labels.locale==="en-US"?"Clear movie search":"Очистить название"} title={labels.locale==="en-US"?"Clear":"Очистить"} onClick={()=>{update("title","");setTmdbIdentity(null);setTmdbMatches([]);setTmdbPoster(null);setTmdbError("");}}><Icon name="close" size={17}/></button>}
              </span>
            </label>
            {!initialMovie && <div className="tmdbSearch wideField">
              <small className="tmdbSearchHint">{labels.locale === "en-US" ? "Optional year narrows results. If nothing is found, try the original title or tmdb:62320 (TMDB ID)." : "Укажи год выпуска для точного поиска. Можно искать по оригинальному названию или по ID, например tmdb:62320."}</small>
              <button type="button" onClick={searchOnTmdb} disabled={tmdbLoading || form.title.trim().length < 2}>{tmdbLoading ? labels.sync.saving : labels.family.tmdbSearch}</button>
              {tmdbError && <small role="status">{tmdbError}</small>}
              {!!tmdbMatches.length && <div className="tmdbMatches">{tmdbMatches.map((match) => <button type="button" key={match.id + ":" + match.category} onClick={() => selectTmdb(match)}>
                <img src={match.posterUrl || "/poster-placeholder.svg"} alt="" loading="lazy" />
                <span>{match.title}<small>{match.releaseYear || ""}</small></span>
              </button>)}</div>}
            </div>}
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
            {!initialMovie && <label>
              <span>{labels.addMovie.status}</span>
              <select value={form.status} onChange={(event) => update("status", event.target.value)}>
                <option value="watchlist">{labels.family.watchlist}</option>
                <option value="watched">{labels.catalog.watched}</option>
              </select>
            </label>}
            {!initialMovie && form.status==="watched" && (form.category==="series" ?
              <div className="wideField addSeriesHistory">
                <label><span>{labels.locale==="en-US"?"First viewed season":"Первый просмотренный сезон"}</span>
                  <select value={form.seasonNumber} onChange={event=>update("seasonNumber",Number(event.target.value))}>
                    {Array.from({length:30},(_,index)=>index+1).map(n=><option key={n} value={n}>{labels.locale==="en-US"?"Season":"Сезон"} {n}</option>)}
                  </select></label>
                <SeasonRangeCalendar language={labels.locale==="en-US"?"en":"ru"}
                  start={form.startedAt} end={form.lastWatchedAt}
                  onChange={(start,end)=>setForm(current=>({...current,startedAt:start,lastWatchedAt:end}))}/>
                <small>{labels.locale==="en-US"
                  ?"Record a completed season now. You can add the remaining seasons and later rewatches in the series card."
                  :"Сейчас запишите один завершённый сезон. Остальные сезоны и пересмотры можно добавить в карточке сериала."}</small>
              </div> :
              <div className="addViewingDate">
                <span className="seasonFieldCaption">{labels.addMovie.watchedAt} *</span>
                <ViewingDateField value={form.lastWatchedAt} label={labels.addMovie.watchedAt}
                  language={labels.locale==="en-US"?"en":"ru"} max={todayLocal()}
                  onChange={(value)=>update("lastWatchedAt",value)}/>
              </div>)}
            {!initialMovie && form.status === "watched" && <div className="addRating wideField">
              <span>{labels.addMovie.rating} *</span>
              <Stars value={form.rating || 0} onChange={(rating) => update("rating", rating)} label={labels.addMovie.rating} />
            </div>}
            <label className="wideField">
              <span>{labels.addMovie.descriptionLabel} (RU)</span>
              <textarea maxLength={3000} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder={labels.addMovie.descriptionPlaceholder} />
            </label>
            <label className="wideField">
              <span>{labels.addMovie.descriptionLabel} (EN)</span>
              <textarea maxLength={3000} value={form.descriptionEn || ""} onChange={(event) => update("descriptionEn", event.target.value)} placeholder={labels.addMovie.descriptionPlaceholder} />
            </label>
          </div>

          <label className={preview ? "posterUpload hasPreview" : "posterUpload"}>
            <img src={preview || tmdbPoster || "/poster-placeholder.svg"} alt="" />
            <strong>{labels.addMovie.choosePoster}</strong>
            <small>{labels.addMovie.posterHint}</small>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPoster(event.target.files?.[0] || null)} />
          </label>

          {error && <p className="formError" role="alert">{error}</p>}
          <button type="submit" className="primaryButton addMovieSubmit" disabled={submitting || !form.title.trim() || (!initialMovie && form.status==="watched" && (!form.lastWatchedAt || form.rating==null || (form.category==="series" && (!form.startedAt || form.lastWatchedAt<form.startedAt))))}>
            {submitting ? <span className="spinner small" /> : <Icon name="plus" size={18} />}
            {submitting ? labels.addMovie.submitting : initialMovie ? labels.family.save : labels.addMovie.submit}
          </button>
        </form>
      </section>
    </div>
  );
}


// Purpose-built calendar: two taps choose a season's start and end. A single
// selected start is a valid, unfinished viewing period.
function TmdbGenreMatcher({movie,language,onMatched}) {
  const en=language==="en";
  const [query,setQuery]=useState(movie.title||"");
  const [matches,setMatches]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const search=async()=>{
    if(query.trim().length<2)return;
    setBusy(true);setError("");setMatches([]);
    try {
      // Don't impose a year filter: a manually catalogued release year can be wrong.
      const response=await fetch("/api/tmdb/search?q="+encodeURIComponent(query.trim()),{credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"TMDB lookup failed");
      const expected=movie.category==="series"?"tv":"movie";
      const candidates=(data.results||[]).filter(item=>(item.mediaType|| (item.category==="series"?"tv":"movie"))===expected);
      setMatches(candidates);
      if(!candidates.length){
        const otherTypeFound=(data.results||[]).length>0;
        setError(otherTypeFound
          ? (en?"This TMDB title exists, but its type differs from the catalog category. Check whether this entry should be in the Series tab.":"Запись найдена в TMDB, но её тип не совпадает с категорией в каталоге. Проверьте, не должен ли этот фильм находиться во вкладке «Сериалы».")
          : (en?"No matching titles. Try the original title or a TMDB ID, e.g. tmdb:tv:64480.":"Ничего не найдено. Попробуйте оригинальное название или ID TMDB, например tmdb:tv:64480."));
      }
    } catch(err) {setError(err.message);}
    finally {setBusy(false);}
  };
  const choose=async(match)=>{
    const title=match.title||match.titleEn||"";
    const year=match.releaseYear||"?";
    const prompt=en
      ? `Link «${movie.title}» (${movie.releaseYear||"?"}) to TMDB: «${title}» (${year})? Only genres and TMDB ID will change.`
      : `Сопоставить «${movie.title}» (${movie.releaseYear||"?"}) с TMDB: «${title}» (${year})? Изменятся только жанры и ID TMDB.`;
    if(!window.confirm(prompt))return;
    setBusy(true);setError("");
    try{
      const response=await fetch(`/api/movies/${movie.id}/tmdb-genres`,{
        method:"POST",credentials:"same-origin",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({tmdbId:match.tmdbId||match.id,
          mediaType:match.mediaType||(match.category==="series"?"tv":"movie")})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Could not save genres");
      onMatched(data.movie);
      setMatches([]);
    }catch(err){setError(err.message);}
    finally{setBusy(false);}
  };
  return <section className="tmdbGenreMatcher">
    <h3>{en?"Genres not linked to TMDB":"Жанры не сопоставлены с TMDB"}</h3>
    <p>{en?"Find this title in TMDB and pick the correct release. Your poster, rating, dates and descriptions will remain unchanged.":
      "Найдите фильм в TMDB и выберите нужную версию. Постер, оценки, даты просмотров и описания сохранятся."}</p>
    <div className="tmdbGenreMatcherSearch">
      <input value={query} onChange={event=>setQuery(event.target.value)}
        onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();search();}}}
        aria-label={en?"Search TMDB title":"Поиск названия в TMDB"}/>
      <button type="button" onClick={search} disabled={busy||query.trim().length<2}>
        {busy?"…":en?"Search":"Найти"}
      </button>
    </div>
    {error&&<p role="alert" className="formError">{error}</p>}
    {matches.length>0&&<div className="tmdbGenreMatcherResults">
      {matches.map(item=><button type="button" disabled={busy} key={`${item.mediaType||item.category}:${item.id}`}
        onClick={()=>choose(item)}>
        <img src={item.posterUrl||"/poster-placeholder.svg"} alt="" loading="lazy"/>
        <span><strong>{item.title||item.titleEn}</strong>
          <small>{item.titleEn&&item.titleEn!==item.title?`${item.titleEn} · `:""}{item.releaseYear||"?"} · TMDB {item.id}</small></span>
      </button>)}
    </div>}
  </section>;
}

function SeasonRangeCalendar({start, end, onChange, language}) {
  const en=language==="en";
  const locale=en?"en-US":"ru-RU";
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(()=>(start||todayLocal()).slice(0,7));
  const [stage,setStage]=useState("start");
  const year=Number(month.slice(0,4));
  const monthIndex=Number(month.slice(5,7))-1;
  const max=todayLocal();
  const pretty=(date)=>date?new Intl.DateTimeFormat(locale,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})
    .format(new Date(date+"T12:00:00Z")):(en?"Not selected":"Не выбрана");
  const move=(diff)=>{
    const date=new Date(Date.UTC(year,monthIndex+diff,1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`);
  };
  const selectDay=(day)=>{
    const date=`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if(date>max)return;
    if(stage==="start" || !start || date<start){
      onChange(date,"");
      setStage("end");
    } else {
      onChange(start,date);
      setStage("start");
      setOpen(false);
    }
  };
  const openPicker=()=>{
    if(!open){
      setStage(start&&!end?"end":"start");
      setMonth((start||todayLocal()).slice(0,7));
    }
    setOpen(value=>!value);
  };
  const weekdayLabels=en?["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]:["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
  const leading=(new Date(Date.UTC(year,monthIndex,1)).getUTCDay()+6)%7;
  const days=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();
  const cells=Array.from({length:Math.ceil((leading+days)/7)*7},(_,position)=>{
    const day=position-leading+1;
    return day>=1&&day<=days?day:null;
  });
  const years=Array.from({length:new Date().getFullYear()-1887},(_,index)=>new Date().getFullYear()-index);
  return <div className="seasonRangeField">
    <span className="seasonFieldCaption">{en?"Viewing period":"Период просмотра"}</span>
    <button type="button" className="seasonRangeTrigger" onClick={openPicker} aria-expanded={open}
      aria-label={en?"Choose start and end date":"Выбрать начало и окончание просмотра"}>
      <Icon name="calendar" size={18}/>
      <span className="seasonRangeText">{pretty(start)} <span className="seasonRangeSeparator">→</span>
        {end?pretty(end):(start?(en?"Still watching":"Ещё смотрим"):(en?"Choose period":"Выбрать период"))}</span>
    </button>
    {open&&<div className="seasonCalendar" role="group" aria-label={en?"Viewing range calendar":"Календарь периода просмотра"}>
      <div className="seasonCalendarHead">
        <button type="button" onClick={()=>move(-1)} aria-label={en?"Previous month":"Предыдущий месяц"}>‹</button>
        <div className="seasonCalendarJump">
          <select aria-label={en?"Month":"Месяц"} value={monthIndex}
            onChange={event=>setMonth(`${year}-${String(Number(event.target.value)+1).padStart(2,"0")}`)}>
            {Array.from({length:12},(_,index)=><option key={index} value={index}>
              {new Intl.DateTimeFormat(locale,{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2020,index,1)))}
            </option>)}
          </select>
          <select aria-label={en?"Year":"Год"} value={year}
            onChange={event=>setMonth(`${event.target.value}-${String(monthIndex+1).padStart(2,"0")}`)}>
            {years.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button type="button" onClick={()=>move(1)} aria-label={en?"Next month":"Следующий месяц"}
          disabled={month>=max.slice(0,7)}>›</button>
      </div>
      <p className="seasonCalendarHint">{stage==="start"
        ? (en?"First, select the start date":"Сначала выберите дату начала")
        : (en?"Now select the end date, or choose Still watching":"Теперь выберите дату окончания или «Ещё смотрим»")}</p>
      <div className="seasonCalendarGrid">
        {weekdayLabels.map(label=><span className="seasonCalendarWeekday" key={label}>{label}</span>)}
        {cells.map((day,index)=>day?
          <button type="button" key={index} disabled={`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`>max}
            className={["seasonCalendarDay",
              `${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`===start?"start":"",
              `${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`===end?"end":"",
              start&&end&&`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`>start&&
                `${year}-${String(monthIndex+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`<end?"inside":""].filter(Boolean).join(" ")}
            onClick={()=>selectDay(day)}>{day}</button>
          :<span key={index}/>)}
      </div>
      <div className="seasonCalendarActions">
        <button type="button" onClick={()=>{onChange(start||todayLocal(),"");setStage("end");setOpen(false);}}>
          {en?"Still watching":"Ещё смотрим"}
        </button>
        <button type="button" onClick={()=>{onChange("","");setStage("start");setMonth(todayLocal().slice(0,7));}}>
          {en?"Clear period":"Сбросить период"}
        </button>
        <button type="button" onClick={()=>setOpen(false)}>{en?"Close":"Закрыть"}</button>
      </div>
    </div>}
  </div>;
}

function SeasonTracker({ movie, language, onMovieChanged }) {
  const en=language==="en";
  const [cycles,setCycles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [seasonNumber,setSeasonNumber]=useState(1);
  const [startedAt,setStartedAt]=useState(todayLocal);
  const [finishedAt,setFinishedAt]=useState("");
  const [rating,setRating]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const [editingCycleId,setEditingCycleId]=useState(null);
  const [pendingSeasonDelete,setPendingSeasonDelete]=useState(null);
  const [pendingClose,setPendingClose]=useState(null);
  const active=cycles.find(cycle=>cycle.outcome==="watching")||null;
  const reset=()=>{
    setEditingId(null);setEditingCycleId(null);setSeasonNumber(1);
    setStartedAt(todayLocal());setFinishedAt("");setRating(null);
  };
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch(`/api/movies/${movie.id}/cycles`,{credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Failed to load viewing cycles");
      setCycles(data.cycles||[]);setError("");
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  },[movie.id]);
  useEffect(()=>{refresh();},[refresh]);
  const execute=async(url,body,success)=>{
    setSaving(true);setError("");
    try{
      const response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},
        body:JSON.stringify(body)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to save changes");
      setCycles(data.cycles||[]);if(data.movie)onMovieChanged(data.movie);
      success?.();
    }catch(err){setError(err.message);}
    finally{setSaving(false);}
  };
  const createCycle=()=>execute(`/api/movies/${movie.id}/cycles`,{},reset);
  const closeCycle=(cycleId,outcome)=>execute(`/api/movies/${movie.id}/cycles/${cycleId}/close`,
    {outcome},()=>{setPendingClose(null);reset();});
  const cancelEmptyCycle=async(cycleId)=>{
    setSaving(true);setError("");
    try{
      const response=await fetch(`/api/movies/${movie.id}/cycles/${cycleId}`,{
        method:"DELETE",credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Cannot cancel viewing cycle");
      setCycles(data.cycles||[]);reset();
    }catch(err){setError(err.message);}
    finally{setSaving(false);}
  };
  const submit=(event)=>{
    event.preventDefault();
    if(!startedAt){setError(en?"Choose a start date.":"Выберите дату начала.");return;}
    if(finishedAt&&finishedAt<startedAt){setError(en?"End cannot precede start.":"Дата окончания раньше даты начала.");return;}
    if(finishedAt&&rating==null){setError(en?"Rate this finished season.":"Поставьте оценку завершённому сезону.");return;}
    if(!finishedAt&&rating!=null){setError(en?"Finish the season to rate it.":"Для оценки сначала завершите сезон.");return;}
    const cycleId=editingCycleId||active?.id;
    if(!cycleId){setError(en?"Start a viewing cycle first.":"Сначала начните цикл просмотра.");return;}
    execute(`/api/movies/${movie.id}/seasons`,
      {id:editingId,cycleId,seasonNumber,startedAt,finishedAt:finishedAt||null,rating:finishedAt?rating:null},reset);
  };
  const remove=async(entryId)=>{
    setSaving(true);setError("");
    try{
      const response=await fetch(`/api/movies/${movie.id}/seasons/${entryId}`,{method:"DELETE",credentials:"same-origin"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to delete viewing");
      setCycles(data.cycles||[]);if(data.movie)onMovieChanged(data.movie);
      setPendingSeasonDelete(null);
    }catch(err){setError(err.message);}
    finally{setSaving(false);}
  };
  const addHistoricalSeason=(cycle)=>{
    setEditingId(null);setEditingCycleId(cycle.id);
    setSeasonNumber(Math.min(200,Math.max(1,...cycle.seasons.map(entry=>entry.seasonNumber))+1));
    setStartedAt(cycle.endedAt||cycle.startedAt);
    setFinishedAt(cycle.endedAt||cycle.startedAt);
    setRating(null);
    setError("");
  };
  const edit=(entry,cycle)=>{
    setEditingId(entry.id);setEditingCycleId(cycle.id);setSeasonNumber(entry.seasonNumber);
    setStartedAt(entry.startedAt);setFinishedAt(entry.finishedAt||"");setRating(entry.rating);
  };
  const label=(cycle)=>{
    if(cycle.outcome==="watching")return en?"Currently watching":"Смотрим сейчас";
    return cycle.outcome==="completed"?(en?"Finished":"Досмотрели"):(en?"Stopped watching":"Прекратили смотреть");
  };
  const prettyDate=(value)=>value?new Intl.DateTimeFormat(en?"en-US":"ru-RU",
    {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):"—";
  return <section className="seasonTracker">
    <div className="seriesDiaryHeader">
      <h3>{en?"Series viewing diary":"Дневник сериала"}</h3>
      <p>{en?"Each rewatch is a separate cycle. The headline rating changes when a cycle ends.":
        "Каждый пересмотр — отдельный цикл. Общая оценка обновляется после завершения цикла."}</p>
    </div>
    {loading&&<p aria-live="polite">{en?"Loading…":"Загрузка…"}</p>}
    {!loading&&!cycles.length&&<p className="seriesEmptyCycle">{en?
      "No viewing cycles yet. Start one to record your first season.":
      "Просмотров пока нет. Начните цикл, чтобы записать первый сезон."}</p>}
    <div className="seriesCycles">
      {cycles.map((cycle,index)=><section className="seriesCycle" key={cycle.id}>
        <header className="seriesCycleHeader">
          <div><span className="seriesCycleNumber">{en?"Viewing cycle":"Цикл просмотра"} {cycles.length-index}</span>
            <strong>{label(cycle)}</strong>
            <small>{prettyDate(cycle.startedAt)}{cycle.endedAt?` — ${prettyDate(cycle.endedAt)}`:""}</small>
          </div>
          <div className="seriesCycleScore">{cycle.average==null?"—":`★ ${Number(cycle.average).toLocaleString(en?"en-US":"ru-RU",{maximumFractionDigits:1})}/5`}</div>
        </header>
        <ul className="seasonEntries">
          {cycle.seasons.map(entry=><li key={entry.id}>
            <div className="seasonEntryTop">
              <div className="seasonEntryInfo"><strong>{en?"Season":"Сезон"} {entry.seasonNumber}</strong>
                <span className="seasonEntryDates">{prettyDate(entry.startedAt)}
                  {entry.finishedAt?` — ${prettyDate(entry.finishedAt)}`:
                    cycle.outcome==="watching"?(en?" · in progress":" · в процессе"):(en?" · not finished":" · не закончили")}</span>
              </div>
              {entry.rating!=null&&<span className="seasonRating">★ {entry.rating}/5</span>}
            </div>
            <div className="seasonActions">
              <button type="button" disabled={saving} onClick={()=>edit(entry,cycle)}>{en?"Edit":"Изменить"}</button>
              <button type="button" disabled={saving} onClick={()=>setPendingSeasonDelete(entry.id)}>{en?"Delete":"Удалить"}</button>
            </div>
            {pendingSeasonDelete===entry.id&&<div className="seasonDeletePrompt" role="group">
              <strong>{en?"Delete this season record?":"Удалить запись сезона?"}</strong>
              <div className="seasonActions"><button type="button" onClick={()=>setPendingSeasonDelete(null)}>{en?"Cancel":"Отмена"}</button>
                <button type="button" disabled={saving} onClick={()=>remove(entry.id)}>{en?"Delete":"Удалить"}</button></div>
            </div>}
          </li>)}
        </ul>
        {cycle.outcome!=="watching"&&<div className="seasonActions">
          <button type="button" disabled={saving} onClick={()=>addHistoricalSeason(cycle)}>
            {en?"+ Add another season to this viewing":"+ Добавить сезон в этот просмотр"}
          </button>
        </div>}
        {cycle.outcome==="watching"&&<div className="seriesCycleFinish">
          <p>{en?"End this viewing cycle to publish its average rating. Unwatched seasons won't be included.":
            "Завершите цикл, чтобы пересчитать общую оценку. Непросмотренные сезоны не учитываются."}</p>
          {pendingClose===cycle.id?<div className="seriesCycleFinishConfirm">
            <button type="button" onClick={()=>setPendingClose(null)}>{en?"Cancel":"Отмена"}</button>
            <button type="button" disabled={saving||!cycle.ratedSeasons||cycle.seasons.some(item=>!item.finishedAt)}
              onClick={()=>closeCycle(cycle.id,"completed")}>{en?"Finished series":"Досмотрели"}</button>
            <button type="button" disabled={saving||!cycle.ratedSeasons}
              onClick={()=>closeCycle(cycle.id,"stopped")}>{en?"Stopped early":"Прекратили смотреть"}</button>
          </div>:<button type="button" className="seriesCycleEndButton" disabled={saving||!cycle.ratedSeasons}
            onClick={()=>setPendingClose(cycle.id)}>{en?"End viewing cycle":"Завершить цикл просмотра"}</button>}
          {!cycle.ratedSeasons&&<small>{en?"Rate at least one finished season first.":"Сначала завершите и оцените хотя бы один сезон."}</small>}
          {cycle.seasons.some(item=>!item.finishedAt)&&<small>{en?
            "Finish unfinished seasons to mark the series completed. You can stop watching at any time.":
            "Чтобы отметить «Досмотрели», закончите незавершённые сезоны. Для прерванного просмотра выберите «Прекратили смотреть»."}</small>}
          {cycle.seasons.length===0&&<button type="button" className="seriesCancelEmptyCycle"
            disabled={saving} onClick={()=>cancelEmptyCycle(cycle.id)}>{en?"Cancel empty cycle":"Отменить пустой цикл"}</button>}
        </div>}
      </section>)}
    </div>
    {!loading&&!active&&!editingId&&!editingCycleId&&<button type="button" className="seriesNewCycleButton" disabled={saving}
      onClick={createCycle}>{en?"+ Start a viewing cycle":"+ Начать новый цикл просмотра"}</button>}
    {(active||editingId||editingCycleId)&&<form className="seasonForm" onSubmit={submit} noValidate>
      <h4 className="seasonFormTitle">{editingId?(en?"Edit season":"Изменить просмотр сезона"):
        editingCycleId?(en?"Add season to selected viewing":"Добавить сезон в выбранный просмотр"):
        (en?"Add season to current cycle":"Добавить сезон в текущий цикл")}</h4>
      <label className="seasonSelectField"><span className="seasonFieldCaption">{en?"Season":"Сезон"}</span>
        <select value={seasonNumber} onChange={event=>setSeasonNumber(Number(event.target.value))}>
          {Array.from({length:30},(_,i)=>i+1).map(number=><option key={number} value={number}>
            {en?`Season ${number}`:`Сезон ${number}`}</option>)}
        </select>
      </label>
      <SeasonRangeCalendar language={language} start={startedAt} end={finishedAt}
        onChange={(start,end)=>{setStartedAt(start);setFinishedAt(end);if(!end)setRating(null);}} />
      {finishedAt&&<div className="seasonFormRating"><span>{en?"Season rating *":"Оценка сезона *"}</span>
        <Stars value={rating||0} onChange={setRating} label={en?"Season rating":"Оценка сезона"} />
      </div>}
      {error&&<p className="formError" role="alert">{error}</p>}
      <div className="seasonActions"><button type="submit" className="primaryButton"
        disabled={saving||!startedAt||(Boolean(finishedAt)&&rating==null)}>
        {saving?"…":editingId?(en?"Save changes":"Сохранить изменения"):(en?"Save season":"Записать сезон")}
        </button>
        {(editingId||editingCycleId)&&<button type="button" onClick={reset}>{en?"Cancel":"Отмена"}</button>}
      </div>
    </form>}
    {!loading&&!active&&!editingId&&error&&<p className="formError" role="alert">{error}</p>}
  </section>;
}

export default function Home() {
  const [language, setLanguage] = useState("ru");
  const [catalogReady, setCatalogReady] = useState(false);
  const [authState, setAuthState] = useState("checking");
  const [accessPromptOpen, setAccessPromptOpen] = useState(false);
  const [movies, setMovies] = useState([]);
  const [profiles, setProfiles] = useState([{ id: 1, name: "Участник 1" }, { id: 2, name: "Участник 2" }]);
  const activeMember = 1; // Shared household preference record.

  const [editingMovie, setEditingMovie] = useState(null);
  const [watchDate, setWatchDate] = useState(todayLocal);
  const [watchRating, setWatchRating] = useState(null);
  const watchViewers = [1, 2]; // All logged views belong to the household.
  const [watchSubmitting, setWatchSubmitting] = useState(false);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("random");
  const [sortDirection, setSortDirection] = useState("desc");
  const [genre, setGenre] = useState("all");
  const [genreOptions, setGenreOptions] = useState([]);
  const [genreSyncing, setGenreSyncing] = useState(false);
  const [genreSyncMessage, setGenreSyncMessage] = useState("");
  const [unresolvedGenres, setUnresolvedGenres] = useState([]);
  const [unresolvedGenresLoading, setUnresolvedGenresLoading] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [view, setView] = useState("grid");
  const [selectedId, setSelectedId] = useState(null);
  const [zoomPoster, setZoomPoster] = useState(null);
  const [randomHistory, setRandomHistory] = useState([]);
  const [randomIndex, setRandomIndex] = useState(-1);
  const [noteDraft, setNoteDraft] = useState("");
  const [syncState, setSyncState] = useState("synced");
  const [addMovieOpen, setAddMovieOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [collectionInfoOpen, setCollectionInfoOpen] = useState(false);
  const [dismissedLibraryAlerts, setDismissedLibraryAlerts] = useState([]);
  const [libraryAlertsReady, setLibraryAlertsReady] = useState(false);
  const [libraryAlertsError, setLibraryAlertsError] = useState("");
  const requestQueue = useRef(Promise.resolve());
  const restoreInputRef = useRef(null);
  const pendingAction = useRef(null);
  const t = translations[language];

  const personal = (movie) => personalFor(movie, activeMember);
  const genreName = (id) => {
    const known=genreLabels[id];
    if(known)return known[language==="en"?1:0];
    const entry=genreOptions.find(item=>item.id===id);
    return entry ? cleanGenreLabel(language==="en"?entry.en:entry.ru) : (language==="en"?"Other genre":"Другой жанр");
  };
  const loadGenres = useCallback(async()=>{
    try {
      const response=await fetch("/api/tmdb/genres",{credentials:"same-origin"});
      if(!response.ok) return;
      const data=await response.json();
      setGenreOptions(data.genres||[]);
    } catch { /* Genres remain filterable by ID during a TMDB outage. */ }
  }, []);
  useEffect(()=>{
    if(authState==="authenticated") loadGenres();
  },[authState,loadGenres]);
  const availableGenres = useMemo(()=>{
    const ids=new Set(movies.flatMap(movie=>normalizeGenreIds(movie.genreIds)).filter(id=>!nonGenreIds.has(id)));
    return [...ids].sort((a,b)=>genreName(a).localeCompare(genreName(b),language==="en"?"en":"ru"));
  },[movies,genreOptions,language]);
  const loadUnresolvedGenres=useCallback(async()=>{
    setUnresolvedGenresLoading(true);
    try {
      const response=await fetch("/api/tmdb/genres/unresolved",{credentials:"same-origin",cache:"no-store"});
      if(!response.ok) throw new Error("Cannot load unmatched movies");
      const data=await response.json();
      setUnresolvedGenres(data.movies||[]);
    } catch { setGenreSyncMessage(language==="en"?"Could not load unmatched titles.":"Не удалось загрузить список неподобранных фильмов."); }
    finally {setUnresolvedGenresLoading(false);}
  },[language]);
  useEffect(()=>{
    if(collectionInfoOpen&&authState==="authenticated")loadUnresolvedGenres();
  },[collectionInfoOpen,authState,loadUnresolvedGenres]);
  const syncExistingGenres = async()=>{
    if(genreSyncing||syncState==="offline") return;
    setGenreSyncing(true);setGenreSyncMessage("");
    let cursor=0,updated=0,unresolved=0;
    try{
      for(let batch=0;batch<500;batch++){
        const response=await fetch("/api/tmdb/genres/backfill",{method:"POST",credentials:"same-origin",
          headers:{"content-type":"application/json"},body:JSON.stringify({cursor})});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error||"TMDB unavailable");
        updated+=data.updated||0;unresolved+=(data.unresolved||[]).length;
        cursor=data.nextCursor;
        setGenreSyncMessage(language==="en"?`Matched: ${updated}. Needs review: ${unresolved}.`:`Сопоставлено: ${updated}. Требуют проверки: ${unresolved}.`);
        if(data.done)break;
        await new Promise(resolve=>setTimeout(resolve,200));
      }
      await loadCatalog();await loadGenres();await loadUnresolvedGenres();
    }catch(error){setGenreSyncMessage(error.message||"TMDB unavailable");}
    finally{setGenreSyncing(false);}
  };

  const loadLibraryAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/catalog/alerts/dismissed", {credentials:"same-origin",cache:"no-store"});
      if (!response.ok) throw new Error("Could not load catalog warnings.");
      const data = await response.json();
      setDismissedLibraryAlerts(data.keys || []);
      setLibraryAlertsError("");
      setLibraryAlertsReady(true);
    } catch {
      setLibraryAlertsReady(false);
      setLibraryAlertsError("unavailable");
    }
  }, []);

  const loadProfiles = useCallback(async () => {
    const response = await fetch("/api/profiles", { credentials: "same-origin" });
    if (!response.ok) throw new Error("Could not load family profiles.");
    const data = await response.json();
    setProfiles(data.profiles);
  }, []);

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
    // Warnings are shared by all household devices, not saved per browser.
    window.localStorage.removeItem("movie-catalog-dismissed-alerts-v1");
    window.localStorage.removeItem("movie-catalog-member");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    setLanguage(savedLanguage === "en" ? "en" : "ru");
    document.documentElement.lang = savedLanguage === "en" ? "en" : "ru";

    const initialize = async () => {
      try {
        const response = await fetch("/api/session", { credentials: "same-origin" });
        const session = await response.json();
        if (!session.configured) {
          setAuthState("setup");
          setCatalogReady(true);
        } else if (session.authenticated) {
          setAuthState("authenticated");
          await Promise.all([loadCatalog(), loadProfiles(), loadLibraryAlerts()]);
        } else {
          setAuthState("guest");
          setCatalogReady(true);
        }
      } catch {
        if (window.localStorage.getItem("movie-catalog-cache-v1")) {
          setAuthState("authenticated");
          await loadCatalog();
          // The offline cache is read-only; warning dismissals require the server.
          setLibraryAlertsReady(false);
        } else {
          setAuthState("guest");
          setCatalogReady(true);
        }
      }
    };
    initialize();
  }, [loadCatalog, loadProfiles, loadLibraryAlerts]);

  useEffect(() => {
    const selected = movies.find((movie) => movie.id === selectedId);
    setNoteDraft(selected ? personalFor(selected, activeMember).notes : "");
    setHistoryOpen(false);
    setZoomPoster(null);
    setHistoryDates([]);
    setHistoryEvents([]);
    setWatchDate(todayLocal());
    setWatchRating(null);

  }, [selectedId]);

  useEffect(() => {
    const overlayOpen = selectedId || accessPromptOpen || addMovieOpen || installGuideOpen || collectionInfoOpen;
    document.body.style.overflow = overlayOpen ? "hidden" : "";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedId(null);
        setRandomHistory([]);
        setRandomIndex(-1);
        setAccessPromptOpen(false);
        setAddMovieOpen(false);
        setInstallGuideOpen(false);
        setCollectionInfoOpen(false);

        pendingAction.current = null;
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [accessPromptOpen, addMovieOpen, installGuideOpen, selectedId, collectionInfoOpen]);

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
      await Promise.all([loadCatalog(), loadProfiles(), loadLibraryAlerts()]);
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
    setMovies([]);
    setDismissedLibraryAlerts([]);
    setLibraryAlertsReady(false);
    window.localStorage.removeItem("movie-catalog-cache-v1");
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE" });
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


  const updateSharedRating = (movieId, rating) => {
    if (syncState === "offline") return;
    setMovies((current) => current.map((movie) => movie.id !== movieId ? movie : ({
      ...movie, progress: { ...movie.progress, rating },
    })));
    setSyncState("saving");
    requestQueue.current = requestQueue.current.then(async () => {
      const response = await fetch(`/api/movies/${movieId}/rating`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ rating }),
      });
      if (!response.ok) throw new Error("Could not save family rating.");
      setSyncState("synced");
    }).catch(async () => {
      await loadCatalog();
      setSyncState("error");
    });
  };

  const updateMember = (movieId, patch, selectedMember = activeMember) => {
    if (syncState === "offline") return;
    const memberId = selectedMember;
    setMovies((current) => current.map((movie) => movie.id !== movieId ? movie : ({
      ...movie, members: { ...movie.members, [memberId]: { ...personalFor(movie, memberId), ...patch } },
    })));
    setSyncState("saving");
    requestQueue.current = requestQueue.current.then(async () => {
      const response = await fetch(`/api/movies/${movieId}/member/${memberId}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "content-type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error("Could not save personal rating.");
      const data = await response.json();
      setMovies((current) => current.map((movie) => movie.id !== movieId ? movie : ({
        ...movie, members: { ...movie.members, [memberId]: data.member },
      })));
      setSyncState("synced");
    }).catch(async () => {
      await loadCatalog();
      setSyncState("error");
    });
  };

  const recordWatch = async () => {
    if (!selectedId || watchSubmitting || syncState === "offline") return;
    setWatchSubmitting(true);
    try {
      const response = await fetch(`/api/movies/${selectedId}/watches`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: watchDate, viewers: watchViewers, rating: watchRating }),
      });
      if (!response.ok) throw new Error("Failed to record watch.");
      const data = await response.json();
      setMovies((current) => current.map((movie) => movie.id === selectedId ? data.movie : movie));
      setHistoryOpen(true);
      setHistoryEvents(data.events);
      setHistoryDates(data.events.map((event) => event.watchedAt));
      setWatchRating(null);
      setSyncState("synced");
    } catch { setSyncState("error"); }
    finally { setWatchSubmitting(false); }
  };

  const updateWatchRating = async (eventId, rating) => {
    setSyncState("saving");
    try {
      const response = await fetch(`/api/movies/${selectedId}/watches/${eventId}/rating`, {
        method:"PATCH",credentials:"same-origin",headers:{"content-type":"application/json"},
        body:JSON.stringify({rating}),
      });
      if (!response.ok) throw new Error("Could not update viewing rating.");
      const data = await response.json();
      setHistoryEvents(data.events);
      setMovies((current)=>current.map((movie)=>movie.id === selectedId ? data.movie : movie));
      setSyncState("synced");
    } catch {
      await loadCatalog();
      setSyncState("error");
    }
  };
  const removeWatch = async (eventId) => {
    const response = await fetch(`/api/movies/${selectedId}/watches/${eventId}`, {
      method: "DELETE", credentials: "same-origin",
    });
    if (!response.ok) { setSyncState("error"); return; }
    const data = await response.json();
    setMovies((current) => current.map((movie) => movie.id === selectedId ? data.movie : movie));
    setHistoryEvents(data.events);
    setHistoryDates(data.events.map((event) => event.watchedAt));
  };

  const saveEditedMovie = async (form, posterFile) => {
    const movieId = editingMovie.id;
    const response = await fetch(`/api/movies/${movieId}`, {
      method: "PUT", credentials: "same-origin",
      headers: { "content-type": "application/json" }, body: JSON.stringify(form),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 409) {
        throw new Error(language === "en"
          ? `Already in your library: "${payload.duplicateTitle || form.title}". Choose a different title or year.`
          : `Уже есть в коллекции: «${payload.duplicateTitle || form.title}». Выберите другое название или год.`);
      }
      throw new Error(payload.error || t.sync.error);
    }
    if (posterFile) {
      const poster = await optimizePoster(posterFile);
      const upload = await fetch(`/api/movies/${movieId}/poster`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": poster.type || "image/webp" }, body: poster,
      });
      if (!upload.ok) throw new Error(t.sync.error);
    }
    await loadCatalog();
    setEditingMovie(null);
  };

  const removeMovie = async (movieId) => {
    const response = await fetch(`/api/movies/${movieId}`, {
      method: "DELETE", credentials: "same-origin",
    });
    if (!response.ok) { setSyncState("error"); return; }
    setSelectedId(null);
    await loadCatalog();
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

  const restoreFromFile = async (file) => {
    if (!file) return;
    if (file.size > 30_000_000) { window.alert(t.family.restoreTooLarge); return; }
    let raw;
    try {
      raw = await file.text();
      const check = await fetch("/api/import/preview", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: raw,
      });
      const data = await check.json();
      if (!check.ok) throw new Error(data.error || t.family.restoreInvalid);
      if (!window.confirm(t.family.restoreWarning.replace("{movies}", data.summary.movies).replace("{views}", data.summary.views))) return;
      const typed = window.prompt(t.family.restoreKeyword);
      if (typed !== "RESTORE") return;
      const response = await fetch("/api/import", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json", "x-confirm-restore": "REPLACE_ALL" }, body: raw,
      });
      if (!response.ok) throw new Error((await response.json()).error || t.sync.error);
      await Promise.all([loadCatalog(), loadProfiles()]);
      setSelectedId(null);
      window.alert(t.family.restoreSuccess);
    } catch (error) {
      window.alert(error.message || t.family.restoreInvalid);
    }
  };


  const selectCategory = (nextCategory) => {
    setCategory(nextCategory);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openAddMovie = () => {
    requireAccess(() => setAddMovieOpen(true));
  };

  const createMovie = async (form, posterFile, tmdbPoster, tmdbIdentity) => {
    const duplicate = findDuplicateTitle(movies, form);
    if (duplicate) {
      throw new Error(language === "en"
        ? `Already in your library: "${duplicate.title}" (${duplicate.releaseYear || "year unknown"}). Open the existing card instead.`
        : `Уже есть в коллекции: «${duplicate.title}» (${duplicate.releaseYear || "год неизвестен"}). Откройте существующую карточку.`);
    }
    const optimizedPoster = posterFile ? await optimizePoster(posterFile) : null;
    const response = await fetch("/api/movies", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        rating: form.rating || null,
        releaseYear: form.releaseYear || null,
        posterFromTmdb: posterFile ? null : tmdbPoster,
        lastWatchedAt: form.status === "watched" ? form.lastWatchedAt || null : null,
        startedAt: form.category==="series" && form.status==="watched" ? form.startedAt : null,
        seasonNumber: form.category==="series" && form.status==="watched" ? Number(form.seasonNumber) : null,
        status: form.status === "watched" ? "watched" : "unwatched",
        wantToWatch: form.status === "watchlist",
        tmdbId:tmdbIdentity?.id ?? null,
        tmdbMediaType:tmdbIdentity?.mediaType ?? null,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error(language === "en"
          ? `Already in your library: "${data.duplicateTitle || form.title}". Open the existing card instead.`
          : `Уже есть в коллекции: «${data.duplicateTitle || form.title}». Откройте существующую карточку.`);
      }
      throw new Error(data.error || t.addMovie.error);
    }

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
      setHistoryEvents(response.ok ? (data.events || []) : []);
    } catch {
      setHistoryDates([]);
      setHistoryEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = movies.filter((movie) => {
      if (category !== "all" && movie.category !== category) return false;
      if (!matchesMovieQuery(movie, query, t.locale)) return false;
      if (status === "watchlist" && movie.progress.status === "watched" && !personalFor(movie, activeMember).wantsToWatch) return false;
      if (!matchesGenreFilter(movie.genreIds, genre)) return false;
      if (statusOrder.includes(status) && movie.progress.status !== status) return false;
      return true;
    });

    if (sort === "random") result = randomizeMovies(result, shuffleSeed);
    if (sort === "rating" || sort === "year") {
      const key=sort==="rating"?"rating":"releaseYear";
      result = [...result].sort((a,b)=>{
        const left=sort==="rating"?a.progress.rating:a.releaseYear;
        const right=sort==="rating"?b.progress.rating:b.releaseYear;
        if(left==null&&right==null)return a.collectionOrder-b.collectionOrder;
        if(left==null)return 1;
        if(right==null)return -1;
        return (Number(left)-Number(right))*(sortDirection==="asc"?1:-1) || a.collectionOrder-b.collectionOrder;
      });
    }
    if (sort === "oldest") {
      result = sortOldestWatched(result);
      if (sortDirection === "asc") result.reverse();
    }
    return result;
  }, [category, genre, movies, query, shuffleSeed, sort, sortDirection, status, t.locale]);

  const watchedCount = movies.filter((movie) => movie.progress.status === "watched").length;
  const watchlistCount = movies.filter((movie) => movie.progress.status !== "watched" || personalFor(movie, activeMember).wantsToWatch).length;
  const ratedCount = movies.filter((movie) => movie.progress.rating).length;
  const potentialDuplicatePairs = useMemo(() => findPotentialDuplicatePairs(movies), [movies]);
  const visibleLibraryAlerts = libraryAlertsReady
    ? potentialDuplicatePairs.filter((pair) => !dismissedLibraryAlerts.includes(pair.key))
    : [];
  const dismissLibraryAlert = async (key) => {
    if (syncState === "offline") return;
    try {
      const response = await fetch("/api/catalog/alerts/dismissed", {
        method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},
        body:JSON.stringify({key}),
      });
      if (!response.ok) throw new Error("Could not dismiss this warning.");
      setDismissedLibraryAlerts((current)=>current.includes(key)?current:[...current,key]);
      setLibraryAlertsError("");
    } catch {
      setLibraryAlertsError("save");
    }
  };
  useEffect(() => {
    if (collectionInfoOpen && authState === "authenticated" && syncState !== "offline") {
      loadLibraryAlerts();
    }
  }, [collectionInfoOpen, authState, syncState, loadLibraryAlerts]);

  const openAlertMovie = (id) => {
    setCollectionInfoOpen(false);
    openMovie(id);
  };
  const selected = movies.find((movie) => movie.id === selectedId) || null;
  const randomMode = randomIndex >= 0;

  const getRandomId = (excludeId = null) => {
    const pool = filtered;
    const remaining = pool.filter((movie) => !randomHistory.includes(movie.id));
    const candidates = remaining.length ? remaining : pool.filter((movie) => movie.id !== excludeId);
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
  if (authState !== "authenticated") {
    return <AccessScreen mode={authState === "setup" ? "setup" : "locked"} language={language} onLanguageChange={changeLanguage} onUnlock={unlock} />;
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
          <div className="localeSwitch" role="group" aria-label="Language">
            <button type="button" className={language === "ru" ? "active" : ""} onClick={() => changeLanguage("ru")} aria-pressed={language === "ru"}>RU</button>
            <button type="button" className={language === "en" ? "active" : ""} onClick={() => changeLanguage("en")} aria-pressed={language === "en"}>EN</button>
          </div>
          <button type="button" className="collectionInfoButton" onClick={() => setCollectionInfoOpen(true)} aria-label={(language === "en" ? "Collection information" : "Информация о коллекции") + (visibleLibraryAlerts.length ? ` (${visibleLibraryAlerts.length} ${language === "en" ? "warnings" : "предупреждений"})` : "")} title={language === "en" ? "Collection information" : "Информация о коллекции"}><Icon name="info" size={19} />{visibleLibraryAlerts.length > 0 && <span className="collectionInfoAlertDot" aria-hidden="true" />}</button>
          <button type="button" className="addHeader" onClick={openAddMovie} aria-label={t.nav.add}>
            <Icon name="plus" size={18} /><span>{t.nav.add}</span>
          </button>
        </div>
      </header>

      {syncState === "offline" && <div className="offlineBanner">{t.sync.offline}</div>}

      <section className="catalogSection" id="top">
        <div className="sectionIntro catalogIntro discoveryIntro">
          <h1>{language === "en" ? "What should we watch?" : "Что посмотрим?"}</h1>
          <button type="button" className="catalogRandom" onClick={chooseRandom} disabled={!filtered.length}>
            <Icon name="shuffle" size={18} /> {t.nav.random}
          </button>
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
            <option value="watchlist">{t.family.watchlist}</option>
          </select>
          <select value={genre} onChange={event=>setGenre(event.target.value)} aria-label={language==="en"?"Genre":"Жанр"}>
            <option value="all">{language==="en"?"All genres":"Все жанры"}</option>
            {availableGenres.map(id=><option value={id} key={id}>{genreName(id)}</option>)}
          </select>
          <select value={sort} onChange={(event) => {setSort(event.target.value);setSortDirection("desc");}} aria-label={t.catalog.collectionOrder}>
            <option value="random">{language === "en" ? "Default order" : "Обычный порядок"}</option>
            <option value="rating">{language === "en" ? "By rating" : "По оценке"}</option>
            <option value="year">{language === "en" ? "By release year" : "По году выпуска"}</option>
            <option value="oldest">{language === "en" ? "Time since watched" : "Давно не смотрели"}</option>
          </select>
          {sort!=="random"&&<button type="button" className="sortDirectionToggle" onClick={()=>setSortDirection(current=>current==="desc"?"asc":"desc")}
            aria-label={language==="en"?(sortDirection==="desc"?"Reverse order (ascending)":"Reverse order (descending)"):(sortDirection==="desc"?"Изменить порядок: по возрастанию":"Изменить порядок: по убыванию")}
            title={language==="en"?(sortDirection==="desc"?"Descending — tap to reverse":"Ascending — tap to reverse"):(sortDirection==="desc"?"По убыванию — нажмите для смены":"По возрастанию — нажмите для смены")}>
            {sortDirection==="desc"?"↓":"↑"}
          </button>}
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
        <p>{movies.length} {t.footer.description}<span className="tmdbCredits"><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg" alt="TMDB" /></a><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></span></p>
        <div className="footerActions">
          <button type="button" onClick={() => setInstallGuideOpen(true)}><Icon name="share" size={17} /> {t.footer.homeScreen}</button>
          <button type="button" onClick={exportBackup}><Icon name="download" size={17} /> {t.footer.export}</button>
          <button type="button" onClick={() => restoreInputRef.current?.click()}><Icon name="upload" size={17} /> {t.family.restore}</button>
          <input ref={restoreInputRef} className="visuallyHidden" type="file" accept=".json,application/json" onChange={async (event) => {
            const file = event.target.files?.[0]; event.target.value = ""; if (file) await restoreFromFile(file);
          }} />
          <button type="button" onClick={authState === "authenticated" ? logout : () => requireAccess()}>
            <Icon name={authState === "authenticated" ? "logout" : "lock"} size={17} />
            {authState === "authenticated" ? t.nav.logout : t.nav.edit}
          </button>
        </div>
      </footer>

      {collectionInfoOpen && (
        <div className="collectionInfoBackdrop" role="presentation" onMouseDown={() => setCollectionInfoOpen(false)}>
          <section className="collectionInfoDialog" role="dialog" aria-modal="true" aria-labelledby="collectionInfoTitle" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="modalClose" onClick={() => setCollectionInfoOpen(false)} aria-label="Закрыть"><Icon name="close" size={20} /></button>
            <span className="sectionKicker">MOVIE CATALOG</span>
            <h2 id="collectionInfoTitle">{language === "en" ? "Your library" : "Ваша фильмотека"}</h2>
            <div className="collectionInfoStats">
              <div><strong>{movies.length}</strong><span>{language === "en" ? "In the collection" : "В коллекции"}</span></div>
              <div><strong>{watchedCount}</strong><span>{language === "en" ? "Watched" : "Просмотрено"}</span></div>
              <div><strong>{ratedCount}</strong><span>{language === "en" ? "Rated" : "С оценкой"}</span></div>
              <div><strong>{watchlistCount}</strong><span>{language === "en" ? "Watchlist" : "Хочу посмотреть"}</span></div>
            </div>
            <section className="libraryGenreSync">
              <h3>{language==="en"?"TMDB genres":"Жанры TMDB"}</h3>
              <p>{language==="en"?"Fill genres for existing titles using exact TMDB title/year matches. Uncertain matches are skipped; titles, ratings and posters are not changed.":"Подобрать жанры существующим фильмам по точному совпадению названия и года. Неоднозначные совпадения пропускаются; названия, оценки и постеры не изменяются."}</p>
              <button type="button" disabled={genreSyncing||syncState==="offline"} onClick={syncExistingGenres}>
                {genreSyncing?(language==="en"?"Updating genres…":"Подбираем жанры…"):(language==="en"?"Update existing genres":"Подобрать жанры для коллекции")}
              </button>
              {genreSyncMessage&&<p role="status">{genreSyncMessage}</p>}
            </section>
              <section className="libraryUnresolvedGenres" aria-label={language==="en"?"Unmatched movie metadata":"Фильмы без жанров TMDB"}>
                <h4>{language==="en"?"Requires review":"Требуют проверки"} {unresolvedGenres.length>0?`(${unresolvedGenres.length})`:""}</h4>
                {unresolvedGenresLoading?<p>{language==="en"?"Loading…":"Загрузка…"}</p>:
                unresolvedGenres.length===0?<p>{language==="en"?"All movie metadata has been matched.":"Все записи сопоставлены."}</p>:
                <ul>{unresolvedGenres.map(movie=><li key={movie.id}>
                  <button type="button" onClick={()=>{setCollectionInfoOpen(false);openMovie(movie.id);}}>
                    <strong>{language==="en"&&movie.titleEn?movie.titleEn:movie.title}</strong>
                    <span>{movie.releaseYear|| (language==="en"?"Year unknown":"Год неизвестен")} · {t.categories[movie.category]}</span>
                  </button>
                </li>)}</ul>}
                <p>{language==="en"
                  ?"These entries could not be matched with sufficient confidence. Open a card to check the title and year; they are never changed automatically."
                  :"Для этих записей не удалось подтвердить точное соответствие TMDB. Откройте карточку и проверьте название и год. Данные автоматически не изменяются."}</p>
              </section>
            <section className="libraryAlerts" aria-labelledby="libraryAlertsHeading">
              <h3 id="libraryAlertsHeading">{language === "en" ? "Catalog warnings" : "Предупреждения каталога"}
                {visibleLibraryAlerts.length > 0 && <span className="libraryAlertCount">{visibleLibraryAlerts.length}</span>}
              </h3>
              {libraryAlertsError && <p className="formError" role="alert">{language === "en"
                ? "Could not synchronize warnings. Try opening this window again."
                : "Не удалось синхронизировать предупреждения. Откройте это окно повторно."}</p>}
              {visibleLibraryAlerts.length ? (
                <ul className="libraryAlertList">
                  {visibleLibraryAlerts.map(({first,second,key}) => <li key={key} className="libraryAlert">
                    <p>{language === "en" ? "Possible duplicate entries. Review before deleting anything." : "Возможно, эти записи дублируются. Проверьте их перед удалением."}</p>
                    <div className="libraryAlertMovies">
                      {[first,second].map((movie) => <button type="button" key={movie.id} className="libraryAlertMovie" onClick={() => openAlertMovie(movie.id)}>
                        <img src={movie.poster} alt="" loading="lazy" />
                        <span>{language === "en" && movie.titleEn ? movie.titleEn : movie.title} {movie.releaseYear ? `(${movie.releaseYear})` : ""}</span>
                      </button>)}
                    </div>
                    <button type="button" className="libraryAlertDismiss" onClick={() => dismissLibraryAlert(key)}>
                      {language === "en" ? "Dismiss warning" : "Закрыть предупреждение"}
                    </button>
                  </li>)}
                </ul>
              ) : libraryAlertsReady ? <p className="libraryAlertsEmpty">{language === "en" ? "No new warnings." : "Новых предупреждений нет."}</p>
                : <p className="libraryAlertsEmpty">{language === "en" ? "Warnings unavailable offline or while loading." : "Предупреждения недоступны без соединения или ещё загружаются."}</p>}
            </section>
          </section>
        </div>
      )}

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
            <div className="modalPoster"><button type="button" className="modalPosterZoom" onClick={()=>setZoomPoster({src:selected.poster,title:selected.title})} aria-label={language==="en"?"Enlarge poster":"Увеличить постер"}><img src={selected.poster} alt={selected.title}/><span className="posterZoomHint">{language==="en"?"View full size":"Увеличить"}</span></button></div>
            <div className="modalInfo">
              <span className="modalCategory">{t.categories[selected.category]}</span>
              <h2>{language === "en" && selected.titleEn ? selected.titleEn : selected.title}</h2>
              {(language === "en" ? selected.descriptionEn || selected.description : selected.description) && <p className="modalLead">{language === "en" ? selected.descriptionEn || selected.description : selected.description}</p>}
              {selected.releaseYear && <span className="modalYear">{selected.releaseYear}</span>}
              {!!normalizeGenreIds(selected.genreIds).length && <div className="movieGenreTags" aria-label={language==="en"?"Genres":"Жанры"}>
                {normalizeGenreIds(selected.genreIds).map(id=><span key={id}>{genreName(id)}</span>)}
              </div>}
              {!selected.tmdbId&&<TmdbGenreMatcher key={selected.id} movie={selected} language={language}
                onMatched={updated=>{
                  setMovies(current=>current.map(item=>item.id===updated.id?updated:item));
                  setUnresolvedGenres(current=>current.filter(item=>item.id!==updated.id));
                }}/>}


              <div className="familyRatings"><span>{selected.category === "series"
                ? (language === "en" ? "Average season rating" : "Средняя оценка сезонов")
                : (language === "en" ? "Current rating" : "Актуальная оценка")}</span>
                <span className="seriesAverageRating" aria-live="polite">{selected.progress.rating == null
                  ? (language === "en" ? "No rating yet" : "Пока без оценки")
                  : `★ ${Number(selected.progress.rating).toLocaleString(language === "en" ? "en-US" : "ru-RU",{maximumFractionDigits:1})}/5`}</span>
              </div>
              <button type="button" className={personal(selected).wantsToWatch ? "watchlistButton active" : "watchlistButton"} onClick={() => updateMember(selected.id, { wantsToWatch: !personal(selected).wantsToWatch })}>{personal(selected).wantsToWatch ? t.family.inWatchlist : t.family.addWatchlist}</button>

              {selected.category === "series"
                ? <>
                    <SeasonTracker key={selected.id} movie={selected} language={language} onMovieChanged={(movie) =>
                      setMovies((current) => current.map((item) => item.id === movie.id ? movie : item))} />
                    <button type="button" className="legacySeriesHistory" onClick={toggleHistory} aria-expanded={historyOpen}>
                      {language === "en" ? "Earlier viewing dates" : "Ранее записанные даты просмотров"}
                    </button>
                    {historyOpen && <div className="historyPanel">
                      {historyLoading ? <p>…</p> : historyEvents.length ? <ul>
                        {historyEvents.map((event)=><li key={event.id} className="watchEvent">
<div className="watchEventLine"><strong>{new Intl.DateTimeFormat(t.locale,{day:"numeric",month:"long",year:"numeric"}).format(new Date(event.watchedAt))}</strong>
                            <select className="watchEventRatingSelect" aria-label={language === "en" ? "Viewing rating" : "Оценка просмотра"} value={event.rating ?? ""} onChange={(change)=>updateWatchRating(event.id,change.target.value ? Number(change.target.value) : null)}>
                              <option value="">☆ —</option>
                              {[1,2,3,4,5].map(value=><option key={value} value={value}>★ {value}/5</option>)}
                            </select>
                          </div>
                          <button type="button" onClick={()=>setConfirmDelete({kind:"watch",id:event.id})}>{t.family.removeWatch}</button>
                        </li>)}
                      </ul> : <p>{t.modal.historyEmpty}</p>}
                    </div>}
                  </>
                : <>
                  <div className="watchRecorder">
                    <h3>{t.family.recordWatch}</h3>
                    <label className="watchDate"><span>{t.modal.date}</span><ViewingDateField label={t.modal.date} value={watchDate} language={language} max={todayLocal()} onChange={setWatchDate} /></label>
                    <div className="watchRatingInput">
                      <span>{language === "en" ? "Rating for this viewing (optional)" : "Оценка этого просмотра (необязательно)"}</span>
                      <Stars value={watchRating || 0} onChange={setWatchRating} label={language === "en" ? "Viewing rating" : "Оценка просмотра"} />
                    </div>
                    <button className="primaryButton recordButton" type="button" onClick={recordWatch} disabled={watchSubmitting || syncState === "offline"}>{watchSubmitting ? t.sync.saving : t.family.recordWatch}</button>
                  </div>
                  <div className="watchCount">
                    <span>{t.modal.watches}</span><div><strong>{selected.progress.watchCount || 0}</strong>
                      <button type="button" className="historyInfo" onClick={toggleHistory} aria-label={t.modal.showHistory} aria-expanded={historyOpen}><Icon name="info" size={18} /></button>
                    </div>
                  </div>
                  {historyOpen && <div className="historyPanel">
                    <span>{t.modal.history}</span>
                    {historyLoading ? <p>{t.modal.historyLoading}</p> : historyEvents.length ? <ul>
                      {historyEvents.map((event) => <li key={event.id} className="watchEvent">
<div className="watchEventLine"><strong>{new Intl.DateTimeFormat(t.locale, {day:"numeric",month:"long",year:"numeric"}).format(new Date(event.watchedAt))}</strong>
                            <select className="watchEventRatingSelect" aria-label={language === "en" ? "Viewing rating" : "Оценка просмотра"} value={event.rating ?? ""} onChange={(change)=>updateWatchRating(event.id,change.target.value ? Number(change.target.value) : null)}>
                              <option value="">☆ —</option>
                              {[1,2,3,4,5].map(value=><option key={value} value={value}>★ {value}/5</option>)}
                            </select>
                          </div>
                        <button type="button" onClick={() => setConfirmDelete({kind:"watch",id:event.id})} aria-label={t.family.removeWatch}>{t.family.removeWatch}</button>
                      </li>)}
                    </ul> : <p>{t.modal.historyEmpty}</p>}
                  </div>}
                </>
              }

              {selected.progress.notes && <p className="legacyNotes">{t.family.legacyNotes}: {selected.progress.notes}</p>}
              <label className="notesField">
                <span>{t.modal.notes}</span>
                <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={t.modal.notesPlaceholder} />
              </label>
              <div className="modalActions">
                <button type="button" className="saveNote" disabled={noteDraft === personal(selected).notes} onClick={() => updateMember(selected.id, { notes: noteDraft })}>{t.modal.saveNotes}</button>
                <button type="button" className="resetMovie" onClick={() => { setEditingMovie(selected); setSelectedId(null); }}>{t.family.editMovie}</button>
                <button type="button" className="resetMovie" onClick={() => setConfirmDelete({ kind: "movie", id: selected.id })}>{t.family.deleteMovie}</button>
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

      {confirmDelete && (
        <div className="confirmBackdrop" role="presentation" onMouseDown={() => setConfirmDelete(null)}>
          <section className="confirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmDeleteTitle" aria-describedby="confirmDeleteText" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="confirmDeleteTitle">{confirmDelete.kind === "watch" ? "Удалить просмотр?" : "Удалить фильм?"}</h2>
            <p id="confirmDeleteText">{confirmDelete.kind === "watch" ? "Дата просмотра будет удалена из истории." : "Фильм и связанная с ним история будут удалены без возможности восстановления."}</p>
            <div className="confirmDialogActions">
              <button type="button" className="confirmCancel" autoFocus onClick={() => setConfirmDelete(null)}>Отмена</button>
              <button type="button" className="confirmDanger" onClick={async () => {
                const target = confirmDelete;
                setConfirmDelete(null);
                if (target.kind === "watch") await removeWatch(target.id);
                else await removeMovie(target.id);
              }}>Удалить</button>
            </div>
          </section>
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

      {zoomPoster && <div className="posterLightbox" role="presentation" onMouseDown={()=>setZoomPoster(null)}>
        <div className="posterLightboxContent" role="dialog" aria-modal="true" aria-label={zoomPoster.title} onMouseDown={event=>event.stopPropagation()}>
          <button type="button" className="posterLightboxClose" aria-label={t.modal.close} onClick={()=>setZoomPoster(null)}>✕</button><img src={zoomPoster.src} alt={zoomPoster.title}/>
        </div></div>}
      {(addMovieOpen || editingMovie) && (
        <AddMovieModal labels={t} initialMovie={editingMovie} onClose={() => { setAddMovieOpen(false); setEditingMovie(null); }} onCreate={editingMovie ? saveEditedMovie : createMovie} />
      )}

      {installGuideOpen && <InstallGuide labels={t} onClose={() => setInstallGuideOpen(false)} />}
    </main>
  );
}
