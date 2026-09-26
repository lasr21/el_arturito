import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  norm, slug, cityKey, countryKey, capitalize, publishedAt, plausibleDate, formatMonthYear, formatShortMonthYear, formatDay,
  isVideoUrl, isMapsUrl, mapsUrlFor, checkEntry, validateData, prepare,
} from '../assets/js/data.js';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/lugares-v1.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-09-25T12:00:00Z');
const entry = (over = {}) => ({
  video_id: '7665131431257066759',
  url: 'https://www.tiktok.com/@soyelarturito/video/7665131431257066759',
  nombre_lugar: 'Medias Lunas Marpla',
  enlace_google_maps: null,
  recomendado: true,
  que_pedir: ['medialuna tradicional'],
  que_evitar: [],
  ciudad: 'Buenos Aires',
  pais: 'Argentina',
  necesita_revision_manual: false,
  ...over,
});

test('norm strips accents, case and extra spaces', () => {
  assert.equal(norm('  México  '), 'mexico');
  assert.equal(norm('San  José del\tCabo'), 'san jose del cabo');
  assert.equal(norm('CANTÓN'), 'canton');
  assert.equal(norm('Ñandú'), 'nandu');
});

test('slug and location keys', () => {
  assert.equal(slug('Ciudad de México'), 'ciudad-de-mexico');
  assert.equal(slug(' ¿Qué tal?  '), 'que-tal');
  assert.equal(slug('Estados Unidos'), 'estados-unidos');
  assert.equal(slug('東京'), '東京', 'non-Latin names keep a usable key');
  assert.equal(countryKey({ pais: 'México' }), countryKey({ pais: 'mexico' }));
  assert.equal(cityKey({ pais: 'México', ciudad: 'Ciudad de México' }), 'mexico/ciudad-de-mexico');
  assert.notEqual(cityKey({ pais: 'España', ciudad: 'Mérida' }), cityKey({ pais: 'México', ciudad: 'Mérida' }));
});

test('capitalize only touches the first letter', () => {
  assert.equal(capitalize('medialuna tradicional'), 'Medialuna tradicional');
  assert.equal(capitalize('Lemon Pie'), 'Lemon Pie');
  assert.equal(capitalize('camarones U8 zarandeados'), 'Camarones U8 zarandeados');
  assert.equal(capitalize('¿qué?'), '¿Qué?');
  assert.equal(capitalize('18 meses de jamón'), '18 meses de jamón');
  assert.equal(capitalize('ñoquis'), 'Ñoquis');
});

test('dates decode from video IDs', () => {
  assert.equal(publishedAt('7665131431257066759').toISOString().slice(0, 10), '2026-07-21');
  assert.equal(publishedAt('7689148407067217159').toISOString().slice(0, 10), '2026-09-24');
  assert.equal(publishedAt('7658025624853826834').toISOString().slice(0, 10), '2026-07-02');
  assert.equal(formatMonthYear(publishedAt('7665131431257066759')), 'julio de 2026');
  assert.equal(formatShortMonthYear(publishedAt('7689148407067217159')), 'sep 2026');
  assert.equal(formatDay(publishedAt('7689148407067217159')), '24 de septiembre de 2026');
});

test('video IDs stay exact beyond Number.MAX_SAFE_INTEGER', () => {
  assert.ok(Number('7665131431257066759') === Number('7665131431257066760'), 'Number would collide');
  assert.ok(BigInt('7665131431257066759') < BigInt('7665131431257066760'));
});

test('implausible dates are hidden', () => {
  assert.ok(plausibleDate('7665131431257066759', NOW));
  assert.equal(plausibleDate('12345', NOW), null, 'before 2016');
  const nextWeek = BigInt(Math.floor(NOW.getTime() / 1000) + 7 * 86400) << 32n;
  assert.equal(plausibleDate(String(nextWeek), NOW), null, 'after tomorrow');
});

test('URL allowlist', () => {
  const id = '7665131431257066759';
  assert.ok(isVideoUrl(`https://www.tiktok.com/@soyelarturito/video/${id}`, id));
  assert.ok(isVideoUrl(`https://www.tiktok.com/@soyelarturito/photo/${id}?lang=es`, id));
  assert.ok(!isVideoUrl(`https://www.tiktok.com/@soyelarturito/video/${id}9`, id), 'longer ID');
  assert.ok(!isVideoUrl('https://www.tiktok.com/@soyelarturito/video/1', id), 'other video');
  assert.ok(!isVideoUrl(`http://www.tiktok.com/@soyelarturito/video/${id}`, id), 'not https');
  assert.ok(!isVideoUrl(`https://www.tiktok.com.evil.test/video/${id}`, id), 'lookalike host');
  assert.ok(!isVideoUrl(`javascript:alert(1)//https://www.tiktok.com/video/${id}`, id));
  assert.ok(isMapsUrl('https://www.google.com/maps/search/?api=1&query=x'));
  assert.ok(isMapsUrl('https://maps.app.goo.gl/abc'));
  assert.ok(!isMapsUrl('https://www.google.com.evil.test/maps/'));
  assert.ok(!isMapsUrl('javascript:alert(1)'));
  assert.ok(!isMapsUrl(null));
});

test('Maps link falls back to a search built from the name', () => {
  const given = 'https://www.google.com/maps/search/?api=1&query=Marpla';
  assert.equal(mapsUrlFor(entry({ enlace_google_maps: given })), given);
  assert.equal(
    mapsUrlFor(entry({ nombre_lugar: 'Capitanía 624', ciudad: 'San José del Cabo', pais: 'México' })),
    'https://www.google.com/maps/search/?api=1&query=Capitan%C3%ADa%20624%2C%20San%20Jos%C3%A9%20del%20Cabo%2C%20M%C3%A9xico',
  );
  assert.equal(mapsUrlFor(entry({ nombre_lugar: null })), null);
  assert.equal(mapsUrlFor(entry({ nombre_lugar: '   ' })), null);
  assert.equal(mapsUrlFor(entry({ nombre_lugar: null, enlace_google_maps: given })), given);
  assert.match(mapsUrlFor(entry({ enlace_google_maps: 'https://evil.test/' })), /^https:\/\/www\.google\.com\/maps\/search\//);
});

test('checkEntry accepts a good entry and names each problem', () => {
  assert.deepEqual(checkEntry(entry()), []);
  assert.deepEqual(checkEntry('hola'), ['la entrada no es un objeto']);
  const { pais, ...sinPais } = entry();
  assert.deepEqual(checkEntry(sinPais), ['falta el campo "pais"']);
  assert.equal(checkEntry(entry({ recomendado: 'sí' })).length, 1);
  assert.equal(checkEntry(entry({ que_pedir: ['ok', ''] })).length, 1);
  assert.equal(checkEntry(entry({ que_evitar: 'nada' })).length, 1);
  assert.equal(checkEntry(entry({ ciudad: '  ' })).length, 1);
  assert.equal(checkEntry(entry({ enlace_google_maps: 'https://evil.test/' })).length, 1);
  assert.equal(checkEntry(entry({ url: 'https://www.tiktok.com/@soyelarturito/video/1' })).length, 1);
  assert.ok(checkEntry(entry({ video_id: 7665131431257066759 })).length >= 1, 'number IDs are rejected');
});

test('the v1 data validates with one warning', () => {
  const { entries, errors, warnings } = validateData(fixture(), { now: NOW });
  assert.equal(entries.length, 11);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.map(w => w.id), ['7681454363881278728']);
});

test('validateData warns about duplicates, spellings, flags and unknown fields', () => {
  const data = [
    entry(),
    entry({ video_id: '7663597933111168264', url: 'https://www.tiktok.com/@soyelarturito/video/7663597933111168264', pais: 'argentina', necesita_revision_manual: true, extra: 1 }),
    entry(),
  ];
  const { entries, errors, warnings } = validateData(data, { now: NOW });
  assert.equal(entries.length, 2);
  assert.deepEqual(errors.map(e => [e.id, e.message]), [['7665131431257066759', '"video_id" repetido']]);
  const text = warnings.map(w => w.message).join('\n');
  assert.match(text, /revisión manual/);
  assert.match(text, /aparece en varios videos: 7665131431257066759, 7663597933111168264/);
  assert.match(text, /país escrito de varias formas/);
  assert.match(text, /campos desconocidos, se ignoran: extra \(1 entrada\)/);
  assert.deepEqual(validateData({}).errors.length, 1);
});

test('prepare derives what the cards need', () => {
  const { places, countries, cities, newest } = prepare(fixture(), { now: NOW });
  assert.equal(places.length, 11);
  assert.equal(countries.size, 5);
  assert.equal(cities.size, 7);
  assert.equal(formatDay(newest), '24 de septiembre de 2026');
  const austin = places.find(p => p.id === '7681454363881278728');
  assert.equal(austin.name, null);
  assert.equal(austin.mapsUrl, null);
  const marpla = places.find(p => p.id === '7665131431257066759');
  assert.equal(marpla.pedir[0], 'Medialuna tradicional');
  assert.equal(marpla.cityKey, 'argentina/buenos-aires');
  assert.equal(typeof marpla.rank, 'bigint');
});

test('prepare picks the most common spelling and skips bad entries', () => {
  const warned = [];
  const ids = ['7671739122641341703', '7678824158536518930', '7674743707521797394'];
  const data = [
    entry({ video_id: ids[0], url: `https://www.tiktok.com/@soyelarturito/video/${ids[0]}`, pais: 'Mexico' }),
    entry({ video_id: ids[1], url: `https://www.tiktok.com/@soyelarturito/video/${ids[1]}`, pais: 'México' }),
    entry({ video_id: ids[2], url: `https://www.tiktok.com/@soyelarturito/video/${ids[2]}`, pais: 'México', necesita_revision_manual: true }),
    entry({ video_id: '1', url: 'https://example.com' }),
    entry({ video_id: ids[0], url: `https://www.tiktok.com/@soyelarturito/video/${ids[0]}` }),
    null,
  ];
  const { places, countries } = prepare(data, { now: NOW, warn: m => warned.push(m) });
  assert.equal(places.length, 3);
  assert.equal(countries.get('mexico').label, 'México');
  assert.equal(warned.length, 3);
  assert.match(warned[0], /^Se omitió la entrada 1:/);
  assert.match(warned[1], new RegExp(`${ids[0]}: "video_id" repetido`));
  assert.match(warned[2], /#6/);

  const hidden = prepare(data, { now: NOW, showNeedsReview: false, warn: () => {} });
  assert.equal(hidden.places.length, 2);
  assert.throws(() => prepare({}), TypeError);
});

test('resumen is optional, checked when present and searchable', () => {
  assert.deepEqual(checkEntry(entry({ resumen: 'Medialunas de manteca recién hechas' })), []);
  assert.deepEqual(checkEntry(entry({ resumen: null })), []);
  assert.deepEqual(checkEntry(entry({ resumen: 5 })), ['"resumen" debe ser texto o null']);

  const ids = ['7671739122641341703', '7678824158536518930'];
  const data = [
    entry({ resumen: '  medialunas   de manteca ' }),
    entry({ video_id: ids[0], url: `https://www.tiktok.com/@soyelarturito/video/${ids[0]}`, nombre_lugar: 'Otro', resumen: 'Uno dos tres cuatro cinco seis siete ocho nueve diez once' }),
    entry({ video_id: ids[1], url: `https://www.tiktok.com/@soyelarturito/video/${ids[1]}`, nombre_lugar: 'Tercero' }),
  ];
  const { warnings } = validateData(data, { now: NOW });
  const text = warnings.map(w => w.message).join('\n');
  assert.match(text, /el resumen tiene 11 palabras \(máximo 10\)/);
  assert.match(text, /1 entrada no tiene resumen/);
  assert.doesNotMatch(text, /campos desconocidos/);

  const { places } = prepare(data, { now: NOW });
  assert.equal(places[0].summary, 'Medialunas de manteca');
  assert.equal(places[2].summary, null);
  assert.ok(places[0].search.includes('manteca'));
});

test('summaries can come from resumenes.json, and the entry wins', () => {
  const id = '7671739122641341703';
  const other = entry({ video_id: id, url: `https://www.tiktok.com/@soyelarturito/video/${id}`, nombre_lugar: 'Otro', resumen: 'Del propio archivo' });
  const summaries = { '7665131431257066759': 'medialunas de manteca', [id]: 'Se ignora', '1234': 'Huérfano' };
  const { places } = prepare([entry(), other], { now: NOW, summaries });
  assert.equal(places[0].summary, 'Medialunas de manteca');
  assert.equal(places[1].summary, 'Del propio archivo');

  const { errors, warnings } = validateData([entry(), other], { now: NOW, summaries });
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(w => w.id === '1234' && /no está en la lista/.test(w.message)));
  assert.equal(validateData([entry()], { now: NOW, summaries: [] }).errors.length, 1);
  assert.deepEqual(validateData([entry()], { now: NOW, summaries: { x: 3 } }).errors.map(e => e.id), ['x']);
  assert.equal(prepare([entry()], { now: NOW, summaries: null, warn: () => {} }).places[0].summary, null);
});
