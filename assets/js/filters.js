// Pure view logic: search, facets, ordering, grouping and the URL mapping.
// Works on the output of prepare() in data.js; no DOM access.

import { norm, plural } from './data.js';

export const DEFAULT_STATE = Object.freeze({ q: '', pais: '', ciudad: '', veredicto: '', orden: '' });

const VERDICTS = ['si', 'no'];
const ORDERS = ['recientes'];
const collator = new Intl.Collator('es');

// --- Filtering ------------------------------------------------------------

export const tokens = q => norm(q).split(' ').filter(Boolean);

/** Every word of the query must appear somewhere in the entry. */
export const matchesQuery = (place, words) => words.every(w => place.search.includes(w));

export const matchesVerdict = (place, veredicto) =>
  veredicto === 'si' ? place.recommended : veredicto === 'no' ? !place.recommended : true;

/** Search text and verdict only; the basis for chip counts. */
export function baseFilter(places, state) {
  const words = tokens(state.q);
  return places.filter(p => matchesVerdict(p, state.veredicto) && matchesQuery(p, words));
}

const matchesLocation = (place, state) =>
  (!state.pais || place.countryKey === state.pais)
  && (!state.ciudad || place.cityKey === `${state.pais}/${state.ciudad}`);

export const applyFilters = (places, state) => baseFilter(places, state).filter(p => matchesLocation(p, state));

// --- Facets ---------------------------------------------------------------

/**
 * The location chips for the current state. Counts follow search and verdict but not the
 * location itself; chips with nothing to show are hidden unless selected.
 * Each chip: { kind: 'all' | 'pais' | 'ciudad', value, label, count, pressed }.
 */
export function facets(index, places, state) {
  const base = baseFilter(places, state);
  const count = keyOf => {
    const counts = new Map();
    for (const p of base) counts.set(keyOf(p), (counts.get(keyOf(p)) ?? 0) + 1);
    return counts;
  };
  const byLabel = (a, b) => collator.compare(a.label, b.label);

  if (!state.pais) {
    const counts = count(p => p.countryKey);
    const countries = [...index.countries.values()]
      .map(c => ({ kind: 'pais', value: c.key, label: c.label, count: counts.get(c.key) ?? 0, pressed: false }))
      .filter(c => c.count > 0)
      .sort(byLabel);
    return [{ kind: 'all', value: '', label: 'Todos', count: base.length, pressed: true }, ...countries];
  }

  const counts = count(p => p.cityKey);
  const country = index.countries.get(state.pais);
  const cities = [...index.cities.values()]
    .filter(c => c.countryKey === state.pais)
    .map(c => ({ kind: 'ciudad', value: c.slug, label: c.label, count: counts.get(c.key) ?? 0, pressed: c.slug === state.ciudad }))
    .filter(c => c.count > 0 || c.pressed)
    .sort(byLabel);
  const countryCount = base.filter(p => p.countryKey === state.pais).length;
  return [
    { kind: 'all', value: '', label: 'Todos los países', count: null, pressed: false },
    { kind: 'pais', value: state.pais, label: country.label, count: countryCount, pressed: !state.ciudad },
    ...cities,
  ];
}

// --- Ordering and grouping ------------------------------------------------

const newestFirst = (a, b) => (a.rank === b.rank ? 0 : a.rank > b.rank ? -1 : 1);

/** "Por lugar": country, city, recommended first, confirmed first, newest first. "recientes": newest first. */
export function sortPlaces(index, places, orden) {
  if (orden === 'recientes') return [...places].sort(newestFirst);
  const countryLabel = p => index.countries.get(p.countryKey).label;
  const cityLabel = p => index.cities.get(p.cityKey).label;
  return [...places].sort((a, b) =>
    collator.compare(countryLabel(a), countryLabel(b))
    || (a.countryKey === b.countryKey ? 0 : a.countryKey < b.countryKey ? -1 : 1)
    || collator.compare(cityLabel(a), cityLabel(b))
    || (a.cityKey === b.cityKey ? 0 : a.cityKey < b.cityKey ? -1 : 1)
    || Number(b.recommended) - Number(a.recommended)
    || Number(a.needsReview) - Number(b.needsReview)
    || newestFirst(a, b));
}

/** Groups places already sorted "por lugar" into countries and cities. */
export function groupPlaces(index, sorted) {
  const groups = [];
  for (const p of sorted) {
    let country = groups.at(-1);
    if (!country || country.key !== p.countryKey) {
      country = { key: p.countryKey, label: index.countries.get(p.countryKey).label, cities: [] };
      groups.push(country);
    }
    let city = country.cities.at(-1);
    if (!city || city.key !== p.cityKey) {
      city = { key: p.cityKey, label: index.cities.get(p.cityKey).label, places: [] };
      country.cities.push(city);
    }
    city.places.push(p);
  }
  return groups;
}

// --- Copy -----------------------------------------------------------------

export const NO_RESULTS = 'Ningún lugar coincide con la búsqueda y los filtros.';

/** "9 lugares en 6 ciudades de 5 países", "3 lugares en 2 ciudades de México", "1 lugar en Roma". */
export function summaryText(index, shown, state) {
  if (shown.length === 0) return NO_RESULTS;
  const n = plural(shown.length, 'lugar', 'lugares');
  if (state.ciudad) return `${n} en ${index.cities.get(`${state.pais}/${state.ciudad}`).label}`;
  const cities = plural(new Set(shown.map(p => p.cityKey)).size, 'ciudad', 'ciudades');
  if (state.pais) return `${n} en ${cities} de ${index.countries.get(state.pais).label}`;
  const countries = plural(new Set(shown.map(p => p.countryKey)).size, 'país', 'países');
  return `${n} en ${cities} de ${countries}`;
}

// --- State and URL --------------------------------------------------------

/** Reads state from a query string, dropping unknown or invalid values. */
export function parseState(search, index) {
  const params = new URLSearchParams(search);
  const get = k => (params.get(k) ?? '').trim();
  const state = { ...DEFAULT_STATE, q: params.get('q') ?? '' };
  if (VERDICTS.includes(get('veredicto'))) state.veredicto = get('veredicto');
  if (ORDERS.includes(get('orden'))) state.orden = get('orden');
  if (index.countries.has(get('pais'))) {
    state.pais = get('pais');
    if (index.cities.has(`${state.pais}/${get('ciudad')}`)) state.ciudad = get('ciudad');
  }
  return state;
}

/** The query string for a state, defaults omitted: "", or "?pais=mexico&ciudad=ciudad-de-mexico". */
export function toQuery(state) {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.pais) params.set('pais', state.pais);
  if (state.pais && state.ciudad) params.set('ciudad', state.ciudad);
  if (state.veredicto) params.set('veredicto', state.veredicto);
  if (state.orden) params.set('orden', state.orden);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Search and filters cleared; the order is kept because it never hides anything. */
export const clearFilters = state => ({ ...DEFAULT_STATE, orden: state.orden });

/** The state to use so that the place with this ID is visible. */
export function revealState(places, state, id) {
  const place = places.find(p => p.id === id);
  if (!place || applyFilters([place], state).length) return state;
  return clearFilters(state);
}
