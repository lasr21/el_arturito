import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepare } from '../assets/js/data.js';
import {
  DEFAULT_STATE, applyFilters, facets, sortPlaces, groupPlaces, summaryText, parseState, toQuery, revealState, clearFilters,
} from '../assets/js/filters.js';

const NOW = new Date('2026-09-25T12:00:00Z');
const index = prepare(JSON.parse(readFileSync(new URL('./fixtures/lugares-v1.json', import.meta.url), 'utf8')), { now: NOW });
const { places } = index;
const state = over => ({ ...DEFAULT_STATE, ...over });
const names = list => list.map(p => p.name ?? `(${p.id})`);
const search = q => names(applyFilters(places, state({ q })));

test('search ignores case and accents and needs every word', () => {
  assert.equal(search('mexico').length, 4);
  assert.deepEqual(search('MÉXICO').sort(), search('mexico').sort());
  assert.deepEqual(search('wagyu'), ['Madre Rojas']);
  assert.deepEqual(search('pizza buenos'), ['La Mezzetta']);
  assert.deepEqual(search('canton'), ['Cantón Mexicali']);
  assert.deepEqual(search('lunes'), ['Kefish'], 'things to avoid are searched too');
  assert.deepEqual(search('  '), names(places));
  assert.deepEqual(search('pizza roma'), []);
});

test('verdict filter', () => {
  assert.deepEqual(names(applyFilters(places, state({ veredicto: 'no' }))), ['Fuente Alemana']);
  assert.equal(applyFilters(places, state({ veredicto: 'si' })).length, 10);
});

test('country chips with counts, sorted A-Z', () => {
  const chips = facets(index, places, DEFAULT_STATE);
  assert.deepEqual(chips.map(c => `${c.label} ${c.count}`), [
    'Todos 11', 'Argentina 3', 'Chile 1', 'Estados Unidos 1', 'Italia 2', 'México 4',
  ]);
  assert.deepEqual(chips.filter(c => c.pressed).map(c => c.label), ['Todos']);
});

test('drilling into a country shows its cities', () => {
  const chips = facets(index, places, state({ pais: 'argentina' }));
  assert.deepEqual(chips.map(c => [c.kind, c.label, c.count, c.pressed]), [
    ['all', 'Todos los países', null, false],
    ['pais', 'Argentina', 3, true],
    ['ciudad', 'Buenos Aires', 3, false],
  ]);
  const mx = facets(index, places, state({ pais: 'mexico', ciudad: 'san-jose-del-cabo' }));
  assert.deepEqual(mx.map(c => `${c.label} ${c.count}`), [
    'Todos los países null', 'México 4', 'Ciudad de México 1', 'San José del Cabo 2', 'Valle de Guadalupe 1',
  ]);
  assert.deepEqual(mx.filter(c => c.pressed).map(c => c.label), ['San José del Cabo']);
});

test('chip counts follow search and verdict, hide zeros, keep the selected chip', () => {
  const chips = facets(index, places, state({ q: 'tiramisu' }));
  assert.deepEqual(chips.map(c => `${c.label} ${c.count}`), ['Todos 2', 'Italia 2']);
  const kept = facets(index, places, state({ q: 'wagyu', pais: 'mexico', ciudad: 'san-jose-del-cabo' }));
  assert.deepEqual(kept.map(c => `${c.label} ${c.count}`), ['Todos los países null', 'México 0', 'San José del Cabo 0']);
});

test('grouped order: countries, cities, then verdict, review flag and recency', () => {
  const sorted = sortPlaces(index, places, '');
  const groups = groupPlaces(index, sorted);
  assert.deepEqual(groups.map(g => g.label), ['Argentina', 'Chile', 'Estados Unidos', 'Italia', 'México']);
  assert.deepEqual(names(groups[0].cities[0].places), ['Medias Lunas Marpla', 'Madre Rojas', 'La Mezzetta']);
  assert.deepEqual(groups[4].cities.map(c => c.label), ['Ciudad de México', 'San José del Cabo', 'Valle de Guadalupe']);

  const flagged = { ...places[0], id: '1', rank: 10n ** 30n, needsReview: true };
  const negative = { ...places[0], id: '2', rank: 10n ** 31n, recommended: false };
  const city = sortPlaces(index, [flagged, negative, ...places], '').filter(p => p.cityKey === 'argentina/buenos-aires');
  assert.deepEqual(city.map(p => p.id).slice(-2), ['1', '2'], 'confirmed before flagged, recommended before not');
});

test('recency order', () => {
  const sorted = names(sortPlaces(index, places, 'recientes'));
  assert.equal(sorted[0], 'La Matrichana de 1870');
  assert.equal(sorted.at(-1), 'La Mezzetta');
});

test('result count copy, with singulars', () => {
  const text = s => summaryText(index, applyFilters(places, s), s);
  assert.equal(text(DEFAULT_STATE), '11 lugares en 7 ciudades de 5 países');
  assert.equal(text(state({ pais: 'mexico' })), '4 lugares en 3 ciudades de México');
  assert.equal(text(state({ pais: 'estados-unidos', ciudad: 'austin' })), '1 lugar en Austin');
  assert.equal(text(state({ pais: 'italia' })), '2 lugares en 1 ciudad de Italia');
  assert.equal(text(state({ veredicto: 'no' })), '1 lugar en 1 ciudad de 1 país');
  assert.equal(text(state({ q: 'zzz' })), 'Ningún lugar coincide con la búsqueda y los filtros.');
});

test('URL state round-trips and drops unknown values', () => {
  const s = state({ q: 'pizza buenos', pais: 'mexico', ciudad: 'ciudad-de-mexico', veredicto: 'si', orden: 'recientes' });
  const qs = toQuery(s);
  assert.equal(qs, '?q=pizza+buenos&pais=mexico&ciudad=ciudad-de-mexico&veredicto=si&orden=recientes');
  assert.deepEqual(parseState(qs, index), s);
  assert.equal(toQuery(DEFAULT_STATE), '');
  assert.deepEqual(parseState('?pais=narnia&ciudad=roma&veredicto=quizas&orden=viejos&otro=1', index), DEFAULT_STATE);
  assert.deepEqual(parseState('?pais=argentina&ciudad=roma', index), state({ pais: 'argentina' }));
  assert.deepEqual(parseState('?ciudad=roma', index), DEFAULT_STATE, 'a city needs its country');
});

test('a deep link clears filters that would hide its card', () => {
  const fuente = '7662117502515760402';
  const hiding = state({ pais: 'mexico', veredicto: 'si', orden: 'recientes' });
  assert.deepEqual(revealState(places, hiding, fuente), state({ orden: 'recientes' }));
  const showing = state({ pais: 'chile' });
  assert.equal(revealState(places, showing, fuente), showing);
  assert.equal(revealState(places, hiding, '999'), hiding, 'unknown IDs change nothing');
  assert.deepEqual(clearFilters(hiding), state({ orden: 'recientes' }));
});
