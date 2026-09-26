// Pure data layer: validation, normalization and derived values.
// No DOM access, so the validator script and the tests can import it from Node.

export const FIELDS = [
  'video_id', 'url', 'nombre_lugar', 'enlace_google_maps', 'recomendado',
  'que_pedir', 'que_evitar', 'ciudad', 'pais', 'necesita_revision_manual',
];

/** Optional fields: the entry is valid without them, and the UI hides what they feed when absent. */
export const OPTIONAL_FIELDS = ['resumen'];

/** A summary longer than this many words gets a warning; the card line is meant to be short. */
export const RESUMEN_MAX_WORDS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const EARLIEST_MS = Date.UTC(2016, 0, 1);

// --- Text -----------------------------------------------------------------

/** Lowercase, strip accents, trim and collapse whitespace. */
export const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** URL-safe key. Keeps letters and digits from any script, so non-Latin names never collapse to "". */
export const slug = s => norm(s).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

export const countryKey = e => slug(e.pais);
export const cityKey = e => `${slug(e.pais)}/${slug(e.ciudad)}`;

/** Trim and collapse inner whitespace, for display. */
export const tidy = s => s.trim().replace(/\s+/g, ' ');

/** Uppercase the first letter, unless the text starts with a digit ("18 meses" stays as is). */
export const capitalize = s => s.replace(/^([^\p{L}\p{N}]*)(\p{L})/u, (_, pre, c) => pre + c.toLocaleUpperCase('es-MX'));

// --- Dates ----------------------------------------------------------------

/** Upload time carried in the top 32 bits of a TikTok video ID. Best effort, not an official API. */
export const publishedAt = videoId => new Date(Number(BigInt(videoId) >> 32n) * 1000);

/** The decoded date, or null when it falls before 2016 or after tomorrow. */
export function plausibleDate(videoId, now = new Date()) {
  const date = publishedAt(videoId);
  const t = date.getTime();
  return t >= EARLIEST_MS && t <= now.getTime() + DAY_MS ? date : null;
}

const monthYear = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "julio de 2026" */
export const formatMonthYear = date => monthYear.format(date);
const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "sep 2026", in UTC like the other formats. */
export const formatShortMonthYear = date => `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
/** "24 de septiembre de 2026" */
export const formatDay = date => dayMonthYear.format(date);

// --- Links ----------------------------------------------------------------

const isDigits = s => typeof s === 'string' && /^[0-9]+$/.test(s);

/** TikTok link to this very video (or photo post). */
export function isVideoUrl(url, videoId) {
  return typeof url === 'string' && isDigits(videoId)
    && url.startsWith('https://www.tiktok.com/')
    && new RegExp(`/(?:video|photo)/${videoId}(?:[/?#]|$)`).test(url);
}

export function isMapsUrl(url) {
  return typeof url === 'string'
    && (url.startsWith('https://www.google.com/maps/') || url.startsWith('https://maps.app.goo.gl/'));
}

/** The allowlisted Maps link, or a Maps search built from the name, or null. */
export function mapsUrlFor(e) {
  if (isMapsUrl(e.enlace_google_maps)) return e.enlace_google_maps;
  const name = placeName(e);
  if (!name) return null;
  const q = `${name}, ${tidy(e.ciudad)}, ${tidy(e.pais)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** The place name, or null when it is missing or blank. */
export const placeName = e => (typeof e.nombre_lugar === 'string' && e.nombre_lugar.trim() ? tidy(e.nombre_lugar) : null);

/**
 * The one-line summary ("Mariscos frescos con toque chileno"), or null when missing or blank.
 * The entry's own `resumen` wins; otherwise it comes from resumenes.json, keyed by video_id.
 */
export function summaryOf(e, summaries = {}) {
  const s = typeof e.resumen === 'string' && e.resumen.trim() ? e.resumen : summaries[e.video_id];
  return typeof s === 'string' && s.trim() ? capitalize(tidy(s)) : null;
}

/** Errors for the contents of resumenes.json: an object mapping video_id to text. */
export function checkSummaries(summaries) {
  if (!isObject(summaries)) return [{ id: null, message: 'resumenes.json debe ser un objeto { "video_id": "resumen" }' }];
  return Object.entries(summaries)
    .filter(([, v]) => typeof v !== 'string')
    .map(([id]) => ({ id, message: 'el resumen en resumenes.json debe ser texto' }));
}

const wordCount = s => s.trim().split(/\s+/).length;

// --- Validation -----------------------------------------------------------

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmpty = v => typeof v === 'string' && v.trim() !== '';

/** Errors for one entry, in Spanish. An empty array means the entry is valid. */
export function checkEntry(e) {
  if (!isObject(e)) return ['la entrada no es un objeto'];
  const errors = [];
  const missing = FIELDS.filter(k => !(k in e));
  for (const k of missing) errors.push(`falta el campo "${k}"`);
  const has = k => !missing.includes(k);

  const validId = has('video_id') && isDigits(e.video_id);
  if (has('video_id') && !validId) errors.push('"video_id" debe ser un texto con solo dígitos');
  if (has('url')) {
    if (typeof e.url !== 'string') errors.push('"url" debe ser texto');
    else if (validId ? !isVideoUrl(e.url, e.video_id) : !e.url.startsWith('https://www.tiktok.com/')) {
      errors.push('"url" no es un enlace de TikTok a este video');
    }
  }
  if (has('nombre_lugar') && e.nombre_lugar !== null && typeof e.nombre_lugar !== 'string') {
    errors.push('"nombre_lugar" debe ser texto o null');
  }
  if (has('enlace_google_maps') && e.enlace_google_maps !== null) {
    if (typeof e.enlace_google_maps !== 'string') errors.push('"enlace_google_maps" debe ser texto o null');
    else if (!isMapsUrl(e.enlace_google_maps)) errors.push('"enlace_google_maps" no es un enlace de Google Maps permitido');
  }
  for (const k of ['recomendado', 'necesita_revision_manual']) {
    if (has(k) && typeof e[k] !== 'boolean') errors.push(`"${k}" debe ser true o false`);
  }
  for (const k of ['que_pedir', 'que_evitar']) {
    if (!has(k)) continue;
    if (!Array.isArray(e[k]) || !e[k].every(item => typeof item === 'string')) errors.push(`"${k}" debe ser una lista de textos`);
    else if (!e[k].every(isNonEmpty)) errors.push(`"${k}" tiene elementos vacíos`);
  }
  if ('resumen' in e && e.resumen !== null && typeof e.resumen !== 'string') {
    errors.push('"resumen" debe ser texto o null');
  }
  for (const k of ['ciudad', 'pais']) {
    if (!has(k)) continue;
    if (typeof e[k] !== 'string') errors.push(`"${k}" debe ser texto`);
    else if (!isNonEmpty(e[k])) errors.push(`"${k}" está vacío`);
  }
  return errors;
}

const idOf = (e, i) => (isObject(e) && isDigits(e.video_id) ? e.video_id : `#${i + 1}`);

/**
 * Checks a whole data file. Returns the valid entries (first occurrence wins on duplicated IDs),
 * plus errors and warnings as { id, message }, where id is the video_id or "#n" (1-based position).
 */
export function validateData(data, { now = new Date(), summaries = null } = {}) {
  const errors = [];
  const warnings = [];
  if (summaries !== null) errors.push(...checkSummaries(summaries));
  const extra = isObject(summaries) ? summaries : {};
  if (!Array.isArray(data)) {
    errors.push({ id: null, message: 'el archivo debe contener una lista (un arreglo JSON) de entradas' });
    return { entries: [], errors, warnings };
  }

  const entries = [];
  const seen = new Set();
  const unknown = new Map();
  data.forEach((e, i) => {
    const id = idOf(e, i);
    const problems = checkEntry(e);
    if (problems.length === 0 && seen.has(e.video_id)) problems.push('"video_id" repetido');
    for (const message of problems) errors.push({ id, message });
    if (isObject(e)) {
      for (const k of Object.keys(e)) if (!FIELDS.includes(k) && !OPTIONAL_FIELDS.includes(k)) unknown.set(k, (unknown.get(k) ?? 0) + 1);
    }
    if (problems.length) return;
    seen.add(e.video_id);
    entries.push(e);
  });

  for (const e of entries) {
    if (!placeName(e)) warnings.push({ id: e.video_id, message: 'no tiene nombre del lugar' });
    if (e.necesita_revision_manual) warnings.push({ id: e.video_id, message: 'está marcada para revisión manual' });
    const resumen = summaryOf(e, extra);
    if (resumen && wordCount(resumen) > RESUMEN_MAX_WORDS) {
      warnings.push({ id: e.video_id, message: `el resumen tiene ${wordCount(resumen)} palabras (máximo ${RESUMEN_MAX_WORDS})` });
    }
    if (!plausibleDate(e.video_id, now)) {
      warnings.push({ id: e.video_id, message: `la fecha que sale del ID (${publishedAt(e.video_id).toISOString().slice(0, 10)}) no es creíble` });
    }
  }

  const byPlace = groupBy(entries.filter(placeName), e => `${cityKey(e)}|${norm(placeName(e))}`);
  for (const group of byPlace.values()) {
    if (group.length > 1) {
      const ids = group.map(e => e.video_id);
      warnings.push({ id: ids[0], message: `"${placeName(group[0])}" en ${tidy(group[0].ciudad)} aparece en varios videos: ${ids.join(', ')}` });
    }
  }

  for (const [what, key, field] of [['país', countryKey, 'pais'], ['ciudad', cityKey, 'ciudad']]) {
    for (const group of groupBy(entries, key).values()) {
      const spellings = groupBy(group, e => tidy(e[field]));
      if (spellings.size < 2) continue;
      const list = [...spellings].map(([s, es]) => `"${s}" (${es.map(e => e.video_id).join(', ')})`).join(', ');
      warnings.push({ id: group[0].video_id, message: `${what} escrito de varias formas: ${list}` });
    }
  }

  const known = new Set(entries.map(e => e.video_id));
  for (const id of Object.keys(extra)) {
    if (!known.has(id)) warnings.push({ id, message: 'hay un resumen para un video que no está en la lista' });
  }
  const sinResumen = entries.filter(e => !summaryOf(e, extra)).length;
  if (sinResumen && sinResumen < entries.length) {
    warnings.push({ id: null, message: `${plural(sinResumen, 'entrada no tiene', 'entradas no tienen')} resumen` });
  }

  if (unknown.size) {
    const list = [...unknown].map(([k, n]) => `${k} (${plural(n, 'entrada', 'entradas')})`).join(', ');
    warnings.push({ id: null, message: `campos desconocidos, se ignoran: ${list}` });
  }

  return { entries, errors, warnings };
}

// --- Preparation for the UI -----------------------------------------------

/**
 * Turns the raw file into what the UI needs. Invalid entries are skipped with a warning
 * naming their video_id; nothing here throws for bad entries.
 */
export function prepare(data, { now = new Date(), showNeedsReview = true, summaries = {}, warn = console.warn } = {}) {
  if (!Array.isArray(data)) throw new TypeError('lugares.json no contiene una lista');
  if (!isObject(summaries)) summaries = {};

  const kept = [];
  const seen = new Set();
  data.forEach((e, i) => {
    const problems = checkEntry(e);
    if (problems.length === 0 && seen.has(e.video_id)) problems.push('"video_id" repetido');
    if (problems.length) {
      warn(`Se omitió la entrada ${idOf(e, i)}: ${problems.join('; ')}`);
      return;
    }
    seen.add(e.video_id);
    if (showNeedsReview || !e.necesita_revision_manual) kept.push(e);
  });

  const countries = new Map();
  const cities = new Map();
  for (const [key, group] of groupBy(kept, countryKey)) {
    countries.set(key, { key, label: mostCommon(group.map(e => tidy(e.pais))) });
  }
  for (const [key, group] of groupBy(kept, cityKey)) {
    cities.set(key, { key, slug: slug(group[0].ciudad), countryKey: countryKey(group[0]), label: mostCommon(group.map(e => tidy(e.ciudad))) });
  }

  let newest = null;
  const places = kept.map(e => {
    const name = placeName(e);
    const summary = summaryOf(e, summaries);
    const pedir = e.que_pedir.map(s => capitalize(tidy(s)));
    const evitar = e.que_evitar.map(s => capitalize(tidy(s)));
    const date = plausibleDate(e.video_id, now);
    if (date && (!newest || date > newest)) newest = date;
    return {
      id: e.video_id,
      rank: BigInt(e.video_id),
      url: e.url,
      name,
      summary,
      mapsUrl: mapsUrlFor(e),
      recommended: e.recomendado,
      needsReview: e.necesita_revision_manual,
      pedir,
      evitar,
      date,
      countryKey: countryKey(e),
      cityKey: cityKey(e),
      search: norm([name ?? '', summary ?? '', e.ciudad, e.pais, ...e.que_pedir, ...e.que_evitar].join(' ')),
    };
  });

  return { places, countries, cities, newest };
}

// --- Helpers --------------------------------------------------------------

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const k = keyOf(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  return groups;
}

/** Most frequent value; ties go to the one seen first. */
function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  for (const [v, n] of counts) if (n > counts.get(best)) best = v;
  return best;
}
