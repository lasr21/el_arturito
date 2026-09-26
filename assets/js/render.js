// DOM building. Data only ever reaches the page through textContent and
// attribute setters: never innerHTML, insertAdjacentHTML or markup strings.

import { LIST_PREVIEW } from './config.js';
import { formatShortMonthYear, norm } from './data.js';
import { flagFor } from './flags.js';

/** createElement with attributes and children. Strings become text nodes. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  node.append(...children.flat().filter(c => c != null && c !== false));
  return node;
}

/** An external link that opens in a new tab. */
export const outLink = (href, text, attrs = {}) => el('a', { href, target: '_blank', rel: 'noopener', ...attrs }, text);

// --- Chips ----------------------------------------------------------------

/** A decorative flag for a country, or null when there's no file for it. */
export function flag(pais) {
  const src = flagFor(pais);
  return src && el('img', { class: 'flag', src, alt: '', width: 20, height: 15, decoding: 'async' });
}

/**
 * Replaces the location chips and, if asked, restores focus. The sideways scroll
 * position is kept only while the row shows the same level (countries or one country's cities).
 */
export function renderChips(container, chips, focusChip = null) {
  const level = chips[1]?.kind === 'pais' && chips[0].count == null ? chips[1].value : '';
  const scroll = container.dataset.level === level ? container.scrollLeft : 0;
  container.dataset.level = level;
  container.replaceChildren(...chips.map(c => {
    const button = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c.pressed), 'data-kind': c.kind, 'data-value': c.value },
      c.kind === 'pais' && flag(c.label), c.label);
    if (c.count != null) {
      button.append(' ', el('span', { class: 'chip-count' }, String(c.count), el('span', { class: 'sr-only' }, c.count === 1 ? ' lugar' : ' lugares')));
    }
    return button;
  }));
  container.scrollLeft = scroll;
  if (!focusChip) return;
  const buttons = [...container.children];
  const target = buttons.find(b => b.dataset.kind === focusChip.kind && b.dataset.value === focusChip.value)
    ?? buttons.find(b => b.getAttribute('aria-pressed') === 'true');
  target?.focus();
  target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// --- Results --------------------------------------------------------------

/** Grouped view: country h2, city h3, place h4. */
export function renderGroups(container, groups, cardFor) {
  const frag = document.createDocumentFragment();
  for (const country of groups) {
    const section = el('section', { class: 'country' }, el('h2', { class: 'country-title' }, flag(country.label), country.label));
    for (const city of country.cities) {
      section.append(el('section', { class: 'city' },
        el('h3', { class: 'city-title' }, city.label),
        el('div', { class: 'grid' }, city.places.map(p => cardFor(p, 4)))));
    }
    frag.append(section);
  }
  container.replaceChildren(frag);
}

/** Flat view, newest first: place h3 under a visually hidden h2. */
export function renderFlat(container, places, cardFor) {
  container.replaceChildren(el('section', { class: 'flat' },
    el('h2', { class: 'sr-only' }, 'Lugares, del video más reciente al más antiguo'),
    el('div', { class: 'grid' }, places.map(p => cardFor(p, 3)))));
}

/** Builds cards once per heading level and reuses them afterwards. */
export function cardCache(index) {
  const cache = new Map();
  return (place, level) => {
    const key = `${level}:${place.id}`;
    if (!cache.has(key)) cache.set(key, card(place, index, level));
    return cache.get(key);
  };
}

export function card(place, index, level) {
  const titleId = `t${level}-${place.id}`;
  const city = index.cities.get(place.cityKey).label;
  const country = index.countries.get(place.countryKey).label;

  const actions = el('div', { class: 'ticket-actions' },
    outLink(place.url, 'Ver reseña en TikTok', { class: 'btn btn--video', 'aria-describedby': titleId }),
    place.mapsUrl && outLink(place.mapsUrl, 'Abrir en Google Maps', { class: 'btn btn--maps', 'aria-describedby': titleId }));

  return el('article', { class: 'ticket', id: `v-${place.id}`, 'aria-labelledby': titleId },
    el('div', { class: 'ticket-head' },
      el(`h${level}`, { class: place.name ? 'ticket-title' : 'ticket-title is-unknown', id: titleId }, place.name ?? 'Lugar por identificar'),
      el('p', { class: place.recommended ? 'stamp stamp--si' : 'stamp stamp--no' }, place.recommended ? 'Recomendado' : 'No recomendado')),
    place.summary && el('p', { class: 'ticket-summary' }, place.summary),
    el('p', { class: 'ticket-meta' },
      [level === 3 ? `${shortCity(city)}, ${country}` : shortCity(city), place.date && formatShortMonthYear(place.date)].filter(Boolean).join(' · ')),
    place.needsReview && el('p', { class: 'ticket-note' }, 'Por confirmar'),
    !place.name && el('p', { class: 'ticket-hint' }, 'El nombre no quedó claro en los datos. Mira el video para ubicarlo.'),
    itemList('pedir', place.recommended ? 'Qué pedir' : 'Si vas, pide', place.pedir, level + 1, place.id),
    itemList('evitar', 'Qué evitar', place.evitar, level + 1, place.id),
    actions);
}

/** Short city names for the meta line; anything not listed shows as is. */
const SHORT_CITY = { 'ciudad de mexico': 'CDMX' };
const shortCity = city => SHORT_CITY[norm(city)] ?? city;

/** A list that shows its first LIST_PREVIEW items, with the rest behind a toggle when 2 or more would hide. */
function itemList(kind, heading, items, level, id) {
  if (!items.length) return null;
  const hiddenCount = items.length - LIST_PREVIEW >= 2 ? items.length - LIST_PREVIEW : 0;
  const listId = `${kind}-${id}`;
  const list = el('ul', { class: `list list--${kind}`, id: listId },
    items.map((text, i) => el('li', i >= LIST_PREVIEW && hiddenCount ? { class: 'is-extra', hidden: true } : {}, text)));
  const block = el('div', { class: `ticket-list ticket-list--${kind}` }, el(`h${level}`, { class: 'list-title' }, heading), list);
  if (!hiddenCount) return block;

  const more = `Ver ${hiddenCount} más`;
  const toggle = el('button', { type: 'button', class: 'more', 'aria-expanded': 'false', 'aria-controls': listId }, more);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Ver menos' : more;
    for (const li of list.querySelectorAll('.is-extra')) li.hidden = !open;
    if (!open) toggle.scrollIntoView({ block: 'nearest' });
  });
  block.append(toggle);
  return block;
}

// --- Motion ---------------------------------------------------------------

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** First render only: the stamps in view land once, staggered. */
export function landStamps(root) {
  if (reducedMotion() || typeof Element.prototype.animate !== 'function') return;
  let i = 0;
  for (const stamp of root.querySelectorAll('.stamp')) {
    const { top, bottom } = stamp.getBoundingClientRect();
    if (top > innerHeight) break;
    if (bottom < 0) continue;
    stamp.animate(
      [{ opacity: 0, scale: '1.15' }, { opacity: 1, scale: '1' }],
      { duration: 180, delay: i++ * 40, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' },
    );
  }
}

/** Scrolls to a card and highlights it briefly. */
export function highlight(card) {
  card.setAttribute('tabindex', '-1');
  card.focus({ preventScroll: true });
  // The sticky bar's height varies (the chips wrap on wide screens), so measure it.
  const toCard = () => {
    const bar = document.querySelector('.controls')?.offsetHeight ?? 0;
    scrollTo({ top: card.getBoundingClientRect().top + scrollY - bar - 16 });
  };
  toCard();
  // Cards off screen are sized by estimate (content-visibility), so settle once more after layout.
  requestAnimationFrame(() => requestAnimationFrame(toCard));
  card.classList.remove('is-target');
  void card.offsetWidth;
  card.classList.add('is-target');
  setTimeout(() => card.classList.remove('is-target'), 2000);
}
