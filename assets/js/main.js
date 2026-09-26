// Boot: load the data, wire the controls, keep the URL in sync.

import { SITE, CREATOR, DATA_URL, SHOW_NEEDS_REVIEW } from './config.js';
import { prepare, formatDay } from './data.js';
import {
  DEFAULT_STATE, applyFilters, facets, sortPlaces, groupPlaces, summaryText, parseState, toQuery, clearFilters, revealState,
} from './filters.js';
import { el, outLink, renderChips, renderGroups, renderFlat, cardCache, landStamps, highlight } from './render.js';

const $ = id => document.getElementById(id);
const ui = {
  q: $('q'),
  clear: $('q-clear'),
  chips: $('chips'),
  count: $('count'),
  results: $('resultados'),
  verdict: document.querySelectorAll('input[name="veredicto"]'),
  order: document.querySelectorAll('input[name="orden"]'),
};

let index = null;
let cardFor = null;
let state = { ...DEFAULT_STATE };

const issuesUrl = () => (SITE.repoUrl ? `${SITE.repoUrl.replace(/\/+$/, '')}/issues` : '');

fillStaticLinks();
wireControls();
load();

async function load() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = prepare(await res.json(), { showNeedsReview: SHOW_NEEDS_REVIEW });
  } catch (err) {
    console.error('No se pudo cargar la lista de lugares:', err);
    showLoadError();
    return;
  } finally {
    ui.results.removeAttribute('aria-busy');
  }
  cardFor = cardCache(index);
  const typed = ui.q.value;
  state = parseState(location.search, index);
  if (typed && typed !== state.q) state.q = typed;
  const target = targetId();
  if (target) state = revealState(index.places, state, target);
  syncControls();
  update();
  landStamps(ui.results);
  if (target) reveal(target);
  if (index.newest) $('frescura').textContent = `Incluye videos hasta el ${formatDay(index.newest)}.`;
}

/** Renders chips, count and results for the current state, and mirrors it to the URL. */
function update({ focusChip = null } = {}) {
  if (!index) return;
  const shown = applyFilters(index.places, state);
  renderChips(ui.chips, facets(index, index.places, state), focusChip);
  ui.count.textContent = summaryText(index, shown, state);

  if (shown.length === 0) {
    const reset = el('button', { type: 'button', class: 'btn btn--reset' }, 'Ver todos los lugares');
    reset.addEventListener('click', () => {
      state = clearFilters(state);
      syncControls();
      update();
      ui.results.focus();
    });
    ui.results.replaceChildren(el('div', { class: 'status' }, reset));
  } else if (state.orden === 'recientes') {
    renderFlat(ui.results, sortPlaces(index, shown, 'recientes'), cardFor);
  } else {
    renderGroups(ui.results, groupPlaces(index, sortPlaces(index, shown, '')), cardFor);
  }
  history.replaceState(null, '', `${location.pathname}${toQuery(state)}${location.hash}`);
}

function syncControls() {
  ui.q.value = state.q;
  ui.clear.hidden = !state.q;
  for (const r of ui.verdict) r.checked = r.value === state.veredicto;
  for (const r of ui.order) r.checked = r.value === state.orden;
}

function wireControls() {
  let timer = 0;
  const applySearch = () => {
    clearTimeout(timer);
    if (state.q === ui.q.value) return;
    state.q = ui.q.value;
    update();
  };
  ui.q.addEventListener('input', () => {
    ui.clear.hidden = !ui.q.value;
    clearTimeout(timer);
    timer = setTimeout(applySearch, 120);
  });
  ui.q.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    applySearch();
    ui.q.blur(); // closes the phone keyboard so the results show
  });
  ui.clear.addEventListener('click', () => {
    ui.q.value = '';
    ui.clear.hidden = true;
    applySearch();
    ui.q.focus();
  });

  ui.chips.addEventListener('click', e => {
    const chip = e.target.closest('button.chip');
    if (!chip || !index) return;
    const { kind, value } = chip.dataset;
    if (kind === 'all') state = { ...state, pais: '', ciudad: '' };
    else if (kind === 'pais') state = { ...state, pais: value, ciudad: '' };
    else state = { ...state, ciudad: state.ciudad === value ? '' : value };
    update({ focusChip: { kind, value } });
  });

  for (const r of ui.verdict) r.addEventListener('change', () => { state = { ...state, veredicto: r.value }; update(); });
  for (const r of ui.order) r.addEventListener('change', () => { state = { ...state, orden: r.value }; update(); });

  addEventListener('hashchange', () => {
    const id = targetId();
    if (!id || !index) return;
    const next = revealState(index.places, state, id);
    if (next !== state) {
      state = next;
      syncControls();
      update();
    }
    reveal(id);
  });
}

function targetId() {
  const m = /^#v-(\d+)$/.exec(location.hash);
  return m ? m[1] : null;
}

function reveal(id) {
  const card = document.getElementById(`v-${id}`);
  if (card) highlight(card);
}

function showLoadError() {
  ui.count.textContent = '';
  ui.chips.replaceChildren();
  const report = issuesUrl() ? outLink(issuesUrl(), 'repórtalo en GitHub') : 'repórtalo en GitHub';
  ui.results.replaceChildren(el('p', { class: 'status status--error' },
    'No se pudo cargar la lista de lugares. Recarga la página; si sigue fallando, ', report, '.'));
}

/** Links that come from config.js: follow lines, repo, and where to send corrections. */
function fillStaticLinks() {
  const links = (list, type) => {
    const parts = new Intl.ListFormat('es', { type }).formatToParts(list.map(l => l.label));
    let i = 0;
    return parts.map(p => (p.type === 'element' ? outLink(list[i++].url, p.value) : p.value));
  };

  $('siguelo').replaceChildren('Síguelo en ', ...links(CREATOR.links, 'conjunction'), '.');

  const author = $('autor');
  author.replaceChildren(`Hecho con amor por ${SITE.author}, fan del Arturito.`);
  if (SITE.social.length) author.append(' Me encuentras en ', ...links(SITE.social, 'conjunction'), '.');

  const report = $('reportar');
  if (SITE.repoUrl) {
    report.replaceChildren('¿Encontraste un error en algún lugar? ',
      outLink(`${SITE.repoUrl.replace(/\/+$/, '')}/issues/new?template=correccion.yml`, 'Abre un issue en GitHub'), ' y avísame.');
  } else report.remove();

  const code = $('codigo');
  if (SITE.repoUrl) code.replaceChildren('Código en ', outLink(SITE.repoUrl, 'GitHub'), '.');
  else code.remove();

  const how = $('contacto');
  if (SITE.social.length) how.replaceChildren('mándame un DM en ', ...links(SITE.social, 'disjunction'));
  else if (issuesUrl()) how.replaceChildren('escríbeme en ', outLink(issuesUrl(), 'GitHub'));
}
